// ─── Satori Renderer Service ───────────────────────────────────────────────────
//
// Renders text-only ad templates to PNG without a browser process.
// Pipeline: CompositorInput → element tree → Satori SVG → resvg-js PNG
//
// Speed: ~30-80 ms per slide vs 500-2000 ms for Puppeteer HTML rendering.
// Used for all templates that have no imageUrl. Falls back to Puppeteer when
// something is unsupported (caller catches and re-routes).
//
// Font strategy: Inter Regular 400 + Bold 700 loaded once from @fontsource/inter
// (bundled WOFF files — no network calls, works offline/in containers).

import * as fs   from 'fs';
import * as path from 'path';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Resvg }                            from '@resvg/resvg-js';
import type { CompositorInput, CompositorOutput, TemplateId } from '../types/compositor.types';
import { parseSize }         from '../design/design-system';
import { selectFontPairing } from '../fonts/font-library';
import { getColorPalette }   from '../design/design-system';
import { buildSatoriElement } from './satori-templates';

// ─── Templates routed to Satori (no imageUrl required) ───────────────────────

export const SATORI_TEMPLATE_IDS = new Set<TemplateId>([
  'minimal',
  'text-only-bold',
  'gradient-pop',
  'feature-list',
  'bright-minimal',
  'cta-final',
  'stats-hero',
  'bold-headline',    // text-over-gradient variant (no image)
  'problem-slide',
  'story-hook',       // text variant (no image)
  'color-block',
  'number-list',
  'brand-manifesto',
  'empathy-card',
  'hot-take',
]);

type SatoriFont = { name: string; data: ArrayBuffer; weight: 100|200|300|400|500|600|700|800|900; style: 'normal'|'italic' };

@Injectable()
export class SatoriRendererService implements OnModuleInit {
  private readonly logger = new Logger(SatoriRendererService.name);

  // Loaded once on startup — cached for all renders
  private fonts: SatoriFont[] = [];
  // Dynamically imported because satori is ESM-only
  private satoriFn: ((node: unknown, opts: unknown) => Promise<string>) | null = null;

  async onModuleInit() {
    await this.loadFonts();
    await this.importSatori();
    this.logger.log(`SatoriRenderer ready — ${this.fonts.length} fonts loaded, satori=${!!this.satoriFn}`);
  }

  // ── Font loading ────────────────────────────────────────────────────────────

  private async loadFonts() {
    const fontDir = path.join(process.cwd(), 'node_modules/@fontsource/inter/files');
    const pairs: { file: string; weight: SatoriFont['weight'] }[] = [
      { file: 'inter-latin-400-normal.woff', weight: 400 },
      { file: 'inter-latin-700-normal.woff', weight: 700 },
    ];

    for (const { file, weight } of pairs) {
      const fullPath = path.join(fontDir, file);
      if (!fs.existsSync(fullPath)) {
        this.logger.warn(`Font not found: ${fullPath} — Satori may not render text correctly`);
        continue;
      }
      const buf  = fs.readFileSync(fullPath);
      this.fonts.push({ name: 'Inter', data: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), weight, style: 'normal' });
    }
  }

  // ── ESM dynamic import ──────────────────────────────────────────────────────

  private async importSatori() {
    try {
      const mod = await (Function('return import("satori")')() as Promise<any>);
      this.satoriFn = mod.default ?? mod;
    } catch (err: any) {
      this.logger.error(`Failed to import satori: ${err.message}`);
    }
  }

  // ── Main render ─────────────────────────────────────────────────────────────

  async render(input: CompositorInput): Promise<CompositorOutput> {
    if (!this.satoriFn) throw new Error('Satori not loaded');
    if (this.fonts.length === 0) throw new Error('No fonts loaded');

    const startMs = Date.now();
    const size    = parseSize(input.size);
    const fonts   = selectFontPairing(input.style.tone, input.style.fontPairingId);
    const scheme  = input.style.colorScheme ?? (
      input.style.tone === 'minimal' || input.style.tone === 'premium' ? 'light' : 'dark'
    );
    const palette = getColorPalette(scheme, input.style.tone, input.style.primaryColor);

    // Resolve the templateId (auto-select mirrors compositor.service logic)
    const templateId = input.templateId;

    // Build element tree
    const element = buildSatoriElement(input, size, palette);

    // Render SVG via satori
    const svg = await this.satoriFn(element, {
      width:  size.width,
      height: size.height,
      fonts:  this.fonts,
    });

    // Convert SVG → PNG via resvg-js (Rust/WASM, works on Alpine musl)
    const resvgInstance = new Resvg(svg, {
      fitTo: { mode: 'width', value: size.width },
      font:  { loadSystemFonts: false },
    });
    const rendered = resvgInstance.render();
    const png      = rendered.asPng();
    const imageDataUrl = `data:image/png;base64,${Buffer.from(png).toString('base64')}`;

    const renderTimeMs = Date.now() - startMs;
    this.logger.debug(`Satori render | template=${templateId} size=${input.size} ${renderTimeMs}ms`);

    return { imageDataUrl, templateId, fontPairing: fonts, renderTimeMs, size: input.size };
  }

  /** Whether a given input should be routed to Satori */
  canRender(input: CompositorInput): boolean {
    return !input.imageUrl && SATORI_TEMPLATE_IDS.has(input.templateId);
  }
}
