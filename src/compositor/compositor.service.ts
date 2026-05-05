// ─── Compositor Service ───────────────────────────────────────────────────────
// Core rendering engine. Takes CompositorInput → renders HTML template via
// Puppeteer headless Chrome → returns PNG as base64 data URL.
//
// Browser instance is reused across requests (one per process) for performance.
// Each render gets its own Page which is closed after screenshotting.

import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import * as puppeteer from 'puppeteer';
import type { Browser, Page } from 'puppeteer';
import type { CompositorInput, CompositorOutput } from './types/compositor.types';
import { parseSize }          from './design/design-system';
import { selectFontPairing }  from './fonts/font-library';
import { getColorPalette }    from './design/design-system';
import { renderTemplate, autoSelectTemplate } from './templates/template-engine';
import { SatoriRendererService } from './satori/satori-renderer.service';
import { VisualCriticService }   from './critic/visual-critic.service';

@Injectable()
export class CompositorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CompositorService.name);
  private browser: Browser | null = null;

  constructor(
    private readonly satoriRenderer: SatoriRendererService,
    private readonly visualCritic:   VisualCriticService,
  ) {}

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  async onModuleInit() {
    await this.launchBrowser();
  }

  async onModuleDestroy() {
    await this.browser?.close();
    this.browser = null;
  }

  private async launchBrowser(): Promise<void> {
    try {
      this.browser = await puppeteer.launch({
        headless: true,
        // Use system Chromium when PUPPETEER_EXECUTABLE_PATH is set (Railway/Alpine).
        // Falls back to Puppeteer's bundled Chrome in local dev.
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process',   // required in Alpine/container environments
          '--disable-gpu',
          '--font-render-hinting=none',  // crisp font rendering
        ],
      });
      this.logger.log('Compositor browser launched');
    } catch (err) {
      this.logger.error(`Failed to launch browser: ${(err as Error).message}`);
    }
  }

  private async ensureBrowser(): Promise<Browser> {
    if (!this.browser || !this.browser.connected) {
      await this.launchBrowser();
    }
    if (!this.browser) throw new Error('Compositor browser unavailable');
    return this.browser;
  }

  // ─── Main render ───────────────────────────────────────────────────────────

  async render(input: CompositorInput, skipCritic = false): Promise<CompositorOutput> {
    // ── Fast path: Satori (text-only templates, ~30-80ms, no browser) ─────────
    if (this.satoriRenderer.canRender(input)) {
      try {
        const satoriOut = await this.satoriRenderer.render(input);
        return await this.applyCritic(satoriOut, input, skipCritic);
      } catch (err: any) {
        this.logger.warn(`Satori render failed, falling back to Puppeteer: ${err?.message}`);
      }
    }

    const startMs = Date.now();

    // 1. Resolve size
    const size = parseSize(input.size);

    // 2. Auto-select template if needed
    const templateId = input.templateId ?? autoSelectTemplate(
      input.style.tone,
      input.style.platform,
      !!input.imageUrl,
    );
    const resolvedInput = { ...input, templateId };

    // 3. Resolve font pairing
    const fonts = selectFontPairing(
      input.style.tone,
      input.style.fontPairingId,
    );

    // 4. Resolve colour palette
    const scheme  = input.style.colorScheme ?? (
      input.style.tone === 'minimal' || input.style.tone === 'premium' ? 'light' : 'dark'
    );
    const palette = getColorPalette(scheme, input.style.tone, input.style.primaryColor);

    // 5. Build HTML
    const html = renderTemplate(resolvedInput, size, fonts, palette);

    // 6. Render via Puppeteer
    const imageDataUrl = await this.renderHtml(html, size.width, size.height);

    const renderTimeMs = Date.now() - startMs;
    this.logger.debug(
      `Render complete | template=${templateId} size=${input.size} fonts=${fonts.id} ${renderTimeMs}ms`,
    );

    const output: CompositorOutput = {
      imageDataUrl,
      templateId,
      fontPairing: fonts,
      renderTimeMs,
      size: input.size,
    };

    return this.applyCritic(output, input, skipCritic);
  }

  // ─── Visual critic pass (non-blocking) ────────────────────────────────────

  private async applyCritic(
    output:     CompositorOutput,
    input:      CompositorInput,
    skip:       boolean,
  ): Promise<CompositorOutput> {
    if (skip) return output;
    const critique = await this.visualCritic.critique(output, input);
    return { ...output, critique };
  }

  // ─── Batch render (carousel: multiple slides) ──────────────────────────────

  async renderBatch(inputs: CompositorInput[]): Promise<CompositorOutput[]> {
    // Render in parallel (each gets its own page); skip critic in batch to avoid rate limiting
    return Promise.all(inputs.map(input => this.render(input, true)));
  }

  // ─── Re-render single slide with updated copy ──────────────────────────────
  // Allows the user to edit headline/body/cta without re-running AI

  async rerender(
    originalInput: CompositorInput,
    copyOverrides: Partial<CompositorInput['copy']>,
    templateOverride?: CompositorInput['templateId'],
    fontPairingOverride?: string,
  ): Promise<CompositorOutput> {
    return this.render({
      ...originalInput,
      copy: { ...originalInput.copy, ...copyOverrides },
      templateId:          templateOverride ?? originalInput.templateId,
      style: {
        ...originalInput.style,
        fontPairingId: fontPairingOverride ?? originalInput.style.fontPairingId,
      },
    });
  }

  // ─── HTML → PNG via Puppeteer ──────────────────────────────────────────────

  private async renderHtml(
    html:   string,
    width:  number,
    height: number,
  ): Promise<string> {
    const browser = await this.ensureBrowser();
    let page: Page | null = null;

    try {
      page = await browser.newPage();

      // Set exact canvas size
      await page.setViewport({ width, height, deviceScaleFactor: 1 });

      // Load HTML — use setContent (no network request for the page itself)
      await page.setContent(html, {
        waitUntil: 'networkidle0',   // wait for Google Fonts to load
        timeout:   15_000,
      });

      // Extra font rendering wait (Google Fonts may need a moment)
      await page.evaluate(() => document.fonts.ready);

      // Screenshot as PNG
      const buffer = await page.screenshot({
        type:   'png',
        clip:   { x: 0, y: 0, width, height },
        omitBackground: false,
      });

      return `data:image/png;base64,${Buffer.from(buffer).toString('base64')}`;

    } finally {
      await page?.close().catch(() => {});
    }
  }

  // ─── Health check ──────────────────────────────────────────────────────────

  isHealthy(): boolean {
    return !!this.browser?.connected;
  }
}
