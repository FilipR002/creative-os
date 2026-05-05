import { Injectable, BadRequestException, forwardRef, Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CampaignService } from '../campaign/campaign.service';
import { ImageService } from '../image/image.service';
import { CompositorService } from '../compositor/compositor.service';
import { StyleTranslatorService } from '../user-style/style-translator.service';
import { buildBannerImagePrompt } from '../image/utils/prompt-builder';
import { GenerateBannerDto } from './banner.dto';
import { buildPersonaBlock }  from '../resources/persona-prompt';
import { autoSelectTemplate }  from '../compositor/templates/template-engine';
import type { CompositorInput, AdTone, AdSize } from '../compositor/types/compositor.types';
import axios from 'axios';

// ─── Compositor helpers ───────────────────────────────────────────────────────

const VALID_BANNER_SIZES = new Set(['1080x1080', '1080x1920', '1200x628', '1080x1350', '300x250']);

function toAdSize(size: string): AdSize {
  return VALID_BANNER_SIZES.has(size) ? (size as AdSize) : '1080x1080';
}

function angleToTone(angleLabel: string): AdTone {
  const a = angleLabel.toLowerCase();
  if (a.includes('urgency') || a.includes('fear') || a.includes('scarcity'))  return 'urgent';
  if (a.includes('luxury')  || a.includes('premium') || a.includes('elite'))  return 'premium';
  if (a.includes('minimal') || a.includes('clean')   || a.includes('simple')) return 'minimal';
  if (a.includes('friend')  || a.includes('warm')    || a.includes('community')) return 'friendly';
  if (a.includes('energy')  || a.includes('power')   || a.includes('strong')) return 'energetic';
  return 'bold';
}

// Map size to layout hints
function layoutHint(size: string): string {
  const map: Record<string, string> = {
    '1200x628': 'horizontal landscape — headline left, visual right, CTA bottom-right',
    '1080x1080': 'square — centered headline, large CTA button, bold background',
    '1080x1920': 'vertical story — headline top-third, visual center, CTA bottom-third',
    '300x250': 'compact rectangle — short headline, CTA prominent, minimal text',
    '728x90': 'leaderboard strip — ultra-short headline, CTA button right side',
  };
  return map[size] || 'standard layout — clear hierarchy: headline → subtext → CTA';
}

@Injectable()
export class BannerService {
  private readonly logger = new Logger(BannerService.name);

  constructor(
    private readonly prisma:          PrismaService,
    private readonly config:          ConfigService,
    private readonly images:          ImageService,
    private readonly compositor:      CompositorService,
    private readonly styleTranslator: StyleTranslatorService,
    @Inject(forwardRef(() => CampaignService))
    private readonly campaigns:       CampaignService,
  ) {}

  async generate(dto: GenerateBannerDto, userId: string) {
    await this.campaigns.assertOwnership(dto.campaignId, userId);
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');

    const concept = await this.prisma.concept.findUnique({
      where: { id: dto.conceptId },
    });
    if (!concept) throw new BadRequestException('Concept not found');

    const raw = concept.rawJson as any;

    let angleRecord = null;
    if (dto.angleId) {
      angleRecord = await this.prisma.angle.findUnique({ where: { id: dto.angleId } });
    } else if (dto.angleSlug) {
      angleRecord = await this.prisma.angle.findUnique({ where: { slug: dto.angleSlug } });
    }
    const angleLabel = angleRecord?.label || raw?.hook_angle || 'show_off';

    const sizesBlock = dto.sizes
      .map((s) => `- ${s}: ${layoutHint(s)}`)
      .join('\n');

    const personaBlock = buildPersonaBlock(dto.resourceCtx);

    const systemPrompt = [
      `You are an expert display banner copywriter and creative director.`,
      `You write banner ad copy that is clear, punchy, and drives clicks.`,
      `Return ONLY valid JSON array. No markdown. No explanation. No backticks.`,
      dto.styleContext ? `\n${dto.styleContext}` : '',
      personaBlock || '',
    ].filter(Boolean).join('\n');

    const objectionLine = dto.keyObjection     ? `- Key objection to overcome: ${dto.keyObjection}`         : '';
    const valuePropLine = dto.valueProposition ? `- Value proposition to lead with: ${dto.valueProposition}` : '';

    const userPrompt = `Create banner ad copy for these sizes.

CONCEPT:
- Core message: ${raw?.core_message || concept.coreMessage}
- Audience: ${raw?.audience || concept.audience}
- Emotion: ${raw?.emotion || concept.emotion}
- Goal: ${concept.goal}
- Offer: ${raw?.offer || concept.offer || ''}
- Angle: ${angleLabel}
${objectionLine}
${valuePropLine}

SIZES TO GENERATE:
${sizesBlock}

For EACH size, return one banner object.

Return a JSON array:
[
  {
    "size": "1200x628",
    "headline": "ultra-short, punchy, max 6 words",
    "subtext": "supporting line, max 10 words",
    "cta": "action button text, max 3 words",
    "layout": "layout description matching the size",
    "visual_direction": "brief description of background/image mood"
  }
]

Rules:
- headline must hook in under 2 seconds of reading
- cta must be action-first (e.g. "Start Free", "Get It Now", "Learn More")
- no punctuation overload
- apply the angle to the messaging angle, not the layout
- adapt copy length to the size (smaller sizes = shorter copy)`;

    try {
      const response = await axios.post(
        'https://api.anthropic.com/v1/messages',
        {
          model: 'claude-sonnet-4-6',
          max_tokens: 800,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        },
        {
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          timeout: 30000,
        },
      );

      const raw_text = response.data.content[0].text.trim();
      const clean = raw_text.replace(/```json|```/g, '').trim();
      const banners = JSON.parse(clean);

      const creative = await this.prisma.creative.create({
        data: {
          campaignId: dto.campaignId,
          conceptId: dto.conceptId,
          angleId: angleRecord?.id || null,
          format: 'BANNER',
          variant: dto.variant || 'A',
          content: {
            banners,
            angle: angleLabel,
            templateId:         dto.templateId  ?? null,
            primaryColor:       dto.primaryColor ?? null,
            // Persist visual overrides from evolved angles so generateImages can apply them
            angleVisualOverrides: (angleRecord as any)?.visualOverrides ?? null,
          },
        },
      });

      return {
        creativeId: creative.id,
        format: 'banner',
        angle: angleLabel,
        count: banners.length,
        banners,
      };
    } catch (err: any) {
      const msg = err?.response?.data || err?.message || 'Unknown error';
      throw new BadRequestException(`Banner generation failed: ${JSON.stringify(msg)}`);
    }
  }

  // ── GENERATE IMAGES ─────────────────────────────────────────────────────────

  async generateImages(creativeId: string, userId: string) {
    const creative = await this.prisma.creative.findUnique({
      where:   { id: creativeId },
      include: { campaign: true },
    });
    if (!creative)                   throw new BadRequestException('Creative not found.');
    if (creative.format !== 'BANNER') throw new BadRequestException('Creative is not a banner.');
    await this.campaigns.assertOwnership(creative.campaignId, userId);

    const content  = creative.content as any;
    const banners: any[] = content.banners || [];
    if (!banners.length) throw new BadRequestException('No banners found in this creative.');

    const metadata = {
      angle:        content.angle        || 'engaging',
      format:       'banner',
      platform:     'display',
      templateId:   content.templateId   || null,  // Phase 6
      primaryColor: content.primaryColor || null,  // Brand color
    };

    // Generate in parallel — one image per banner size
    const results = await Promise.all(
      banners.map(async (banner, i) => {
        const prompt = buildBannerImagePrompt(banner, metadata);
        try {
          const result = await this.images.generateFromPrompt(prompt, metadata);
          return { bannerIndex: i, size: banner.size, imageUrl: result.imageUrl, promptUsed: prompt, error: null };
        } catch (err: any) {
          return { bannerIndex: i, size: banner.size, imageUrl: '', promptUsed: prompt, error: err?.message ?? 'Generation failed' };
        }
      }),
    );

    // ── Validate every result — reject blank / truncated URLs ─────────────────
    for (const r of results) {
      if (r.error) continue; // already captured as an error
      if (!r.imageUrl || r.imageUrl.length < 50) {
        throw new BadRequestException(
          `Imagen 4 returned an invalid image for banner ${r.size} (index ${r.bannerIndex}): ` +
          `URL length ${r.imageUrl?.length ?? 0} is below the 50-character minimum. ` +
          `Check GEMINI_API_KEY and Imagen 4 quota.`,
        );
      }
    }

    // ── Step 2: Compositor pass ─────────────────────────────────────────────────
    const baseTone = angleToTone(content.angle || 'bold');

    // Read visual overrides from the angle (set by visual-type evolution mutations)
    const angleVisualOverrides = (creative.content as any)?.angleVisualOverrides ?? null;

    // Resolve style — angle overrides win over DNA + profile
    const resolvedStyle = await this.styleTranslator.resolveCompositorStyle(
      userId,
      baseTone,
      metadata.primaryColor || undefined,
      angleVisualOverrides,
    );

    const compositorInputs: CompositorInput[] = banners.map((banner, i) => {
      const adSize     = toAdSize(banner.size);
      const platform   = adSize === '1200x628' ? 'display' : 'instagram';
      const templateId = (metadata.templateId as CompositorInput['templateId'] | null)
        ?? autoSelectTemplate(resolvedStyle.tone, platform, !!results[i]?.imageUrl);
      return {
        templateId,
        size: adSize,
        copy: {
          headline: banner.headline || '',
          body:     banner.subtext  || undefined,
          cta:      banner.cta      || undefined,
        },
        imageUrl: results[i]?.imageUrl || undefined,
        style: {
          tone:          resolvedStyle.tone,
          platform,
          colorScheme:   resolvedStyle.colorScheme,
          fontPairingId: resolvedStyle.fontPairingId,
          primaryColor:  metadata.primaryColor || undefined,
          accentColor:   resolvedStyle.accentColor,
        },
      };
    });

    let compositorResults: { imageDataUrl: string }[] = [];
    try {
      compositorResults = await this.compositor.renderBatch(compositorInputs);
      this.logger.log(`Compositor rendered ${compositorResults.length} banners for creative ${creativeId}`);
    } catch (err: any) {
      this.logger.warn(`Compositor render failed (falling back to raw images): ${err?.message}`);
    }

    // Persist image URL, prompt, compositor URL, and input for future re-renders
    const updatedBanners = banners.map((banner, i) => ({
      ...banner,
      imageUrl:        results[i]?.imageUrl             ?? null,
      imagePrompt:     results[i]?.promptUsed           ?? null,
      compositorUrl:   compositorResults[i]?.imageDataUrl ?? null,
      compositorInput: compositorInputs[i]              ?? null,
    }));

    await this.prisma.creative.update({
      where: { id: creativeId },
      data:  { content: { ...content, banners: updatedBanners } },
    });

    return { images: results, compositorBanners: updatedBanners.map((b, i) => ({
      bannerIndex:   i,
      size:          b.size,
      compositorUrl: b.compositorUrl,
      imageUrl:      b.imageUrl,
    }))};
  }

  // ── RERENDER SINGLE BANNER ──────────────────────────────────────────────────
  /**
   * Re-render one banner size with copy or template overrides — no AI calls.
   * POST /api/banner/:id/banners/:index/rerender
   */
  async rerenderBanner(
    creativeId:          string,
    bannerIndex:         number,
    userId:              string,
    copyOverrides:       Partial<CompositorInput['copy']> = {},
    templateOverride?:   CompositorInput['templateId'],
    fontPairingOverride?: string,
  ) {
    const creative = await this.prisma.creative.findUnique({ where: { id: creativeId } });
    if (!creative)                    throw new BadRequestException('Creative not found.');
    if (creative.format !== 'BANNER') throw new BadRequestException('Not a banner creative.');
    await this.campaigns.assertOwnership(creative.campaignId, userId);

    const content = creative.content as any;
    const banners: any[] = content.banners || [];
    const banner  = banners[bannerIndex];
    if (!banner) throw new BadRequestException(`Banner index ${bannerIndex} not found.`);

    const originalInput: CompositorInput = banner.compositorInput ?? {
      templateId: 'minimal',
      size:       toAdSize(banner.size),
      copy:       { headline: banner.headline || '', body: banner.subtext, cta: banner.cta },
      imageUrl:   banner.imageUrl || undefined,
      style:      { tone: angleToTone(content.angle || 'bold'), platform: 'display' },
    };

    const result = await this.compositor.rerender(
      originalInput,
      copyOverrides,
      templateOverride,
      fontPairingOverride,
    );

    banners[bannerIndex] = {
      ...banner,
      compositorUrl:  result.imageDataUrl,
      compositorInput: {
        ...originalInput,
        copy:       { ...originalInput.copy, ...copyOverrides },
        templateId: templateOverride ?? originalInput.templateId,
        style:      { ...originalInput.style, fontPairingId: fontPairingOverride ?? originalInput.style.fontPairingId },
      },
    };

    await this.prisma.creative.update({
      where: { id: creativeId },
      data:  { content: { ...content, banners } },
    });

    return {
      bannerIndex,
      size:          banner.size,
      compositorUrl: result.imageDataUrl,
      templateId:    result.templateId,
      fontPairing:   result.fontPairing.id,
      renderTimeMs:  result.renderTimeMs,
    };
  }

  // ── LIST ────────────────────────────────────────────────────────────────────

  async findByCampaign(campaignId: string, userId: string) {
    await this.campaigns.assertOwnership(campaignId, userId);
    return this.prisma.creative.findMany({
      where: { campaignId, format: 'BANNER' },
      include: { angle: true },
    });
  }
}
