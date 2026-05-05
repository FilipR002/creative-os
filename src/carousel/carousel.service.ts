import { Injectable, BadRequestException, forwardRef, Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CampaignService } from '../campaign/campaign.service';
import { ImageService } from '../image/image.service';
import { CompositorService } from '../compositor/compositor.service';
import { StyleTranslatorService } from '../user-style/style-translator.service';
import { GenerateCarouselDto } from './carousel.dto';
import { buildPersonaBlock }   from '../resources/persona-prompt';
import { autoSelectTemplate }  from '../compositor/templates/template-engine';
import type { CompositorInput, AdTone, AdSize } from '../compositor/types/compositor.types';
import { ResourcesService }    from '../resources/resources.service';
import axios from 'axios';

// ─── Emotional trigger extractor ─────────────────────────────────────────────
// Parses an angle label and returns the dominant emotional keyword for Imagen.

function extractEmotionalTrigger(angleLabel: string): string {
  const a = angleLabel.toLowerCase();
  if (a.match(/fear|fomo|miss.*out|scarcity/)) return 'fear';
  if (a.match(/pride|aspir|achiev|success/))   return 'pride';
  if (a.match(/curiosity|discover|secret|reveal/)) return 'curiosity';
  if (a.match(/joy|happ|fun|energet|excite/))  return 'joy';
  if (a.match(/trust|proof|result|credib/))    return 'trust';
  if (a.match(/social|community|togeth/))      return 'social';
  if (a.match(/urgency|now|limited|hurry/))    return 'urgency';
  return '';
}

// ─── Slide sequence helper ────────────────────────────────────────────────────

function buildSlideSequence(count: number): string[] {
  const base = ['cover', 'problem', 'value', 'solution', 'proof', 'tips', 'cta'];
  if (count <= 3) return ['cover', 'value', 'cta'];
  if (count <= 5) return ['cover', 'problem', 'value', 'proof', 'cta'];
  return base.slice(0, count);
}

// ─── Compositor helpers ───────────────────────────────────────────────────────

function platformToAdSize(platform: string): AdSize {
  const p = platform.toLowerCase();
  if (p.includes('tiktok'))                           return '1080x1920';
  if (p.includes('story') || p.includes('reel'))      return '1080x1920';
  if (p.includes('facebook') || p.includes('google')) return '1200x628';
  return '1080x1080';   // default: instagram square
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

function slideTypeForCompositor(
  type: string,
): 'cover' | 'problem' | 'proof' | 'feature' | 'cta' {
  switch (type) {
    case 'cover':    return 'cover';
    case 'problem':  return 'problem';
    case 'proof':    return 'proof';
    case 'cta':      return 'cta';
    default:         return 'feature';  // value, solution, tips, hook → feature slide
  }
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class CarouselService {
  private readonly logger = new Logger(CarouselService.name);

  constructor(
    private readonly prisma:           PrismaService,
    private readonly config:           ConfigService,
    private readonly images:           ImageService,
    private readonly compositor:       CompositorService,
    private readonly styleTranslator:  StyleTranslatorService,
    private readonly resources:        ResourcesService,
    @Inject(forwardRef(() => CampaignService))
    private readonly campaigns:        CampaignService,
  ) {}

  // ── GENERATE SLIDES ─────────────────────────────────────────────────────────

  async generate(dto: GenerateCarouselDto, userId: string) {
    await this.campaigns.assertOwnership(dto.campaignId, userId);
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');

    const concept = await this.prisma.concept.findUnique({ where: { id: dto.conceptId } });
    if (!concept) throw new BadRequestException('Concept not found');

    const raw = concept.rawJson as any;

    let angleRecord = null;
    if (dto.angleId) {
      angleRecord = await this.prisma.angle.findUnique({ where: { id: dto.angleId } });
    } else if (dto.angleSlug) {
      angleRecord = await this.prisma.angle.findUnique({ where: { slug: dto.angleSlug } });
    }

    const angleLabel    = angleRecord?.label || raw?.hook_angle || 'teach';
    const slideSequence = buildSlideSequence(dto.slideCount);
    const platform      = dto.platform || concept.platform || 'instagram';

    const personaBlock = buildPersonaBlock(dto.resourceCtx);

    const systemPrompt = [
      `You are an expert carousel ad copywriter for social media.`,
      `You write slide-by-slide carousel scripts that stop scroll, teach value, and drive action.`,
      `Return ONLY valid JSON array. No markdown. No explanation. No backticks.`,
      dto.styleContext ? `\n${dto.styleContext}` : '',
      personaBlock || '',
    ].filter(Boolean).join('\n');

    const objectionLine = dto.keyObjection     ? `- Key objection to overcome: ${dto.keyObjection}`         : '';
    const valuePropLine = dto.valueProposition ? `- Value proposition to lead with: ${dto.valueProposition}` : '';

    const userPrompt = `Create a ${dto.slideCount}-slide carousel for ${platform}.

CONCEPT:
- Core message: ${raw?.core_message || concept.coreMessage}
- Audience: ${raw?.audience || concept.audience}
- Emotion: ${raw?.emotion || concept.emotion}
- Goal: ${concept.goal}
- Offer: ${raw?.offer || concept.offer || ''}
- Angle: ${angleLabel}
${objectionLine}
${valuePropLine}

SLIDE SEQUENCE: ${slideSequence.join(' → ')}

RULES:
- First slide = hook only (make them swipe)
- Middle slides = teach value, one idea per slide
- Last slide = CTA only (the only slide with a call-to-action button)
- hook field: short punchy opener connected to the brief (max 8 words)
- headline: bold statement or insight (max 10 words)
- body: 1-2 sentences of value or insight
- cta field: ONLY on the last slide, leave empty string "" on all others

Return a JSON array of exactly ${dto.slideCount} slide objects:
[
  {
    "slide_number": 1,
    "type": "cover",
    "hook": "short punchy opener (first slide only, empty string on others)",
    "headline": "bold headline",
    "body": "supporting copy, 1-2 sentences max",
    "cta": ""
  }
]

For the LAST slide (slide ${dto.slideCount}) only:
- type: "cta"
- cta: clear call to action text (e.g. "Download Free" / "Start Today" / "Learn More")
- body: brief value summary`;

    try {
      const response = await axios.post(
        'https://api.anthropic.com/v1/messages',
        {
          model:      'claude-sonnet-4-6',
          max_tokens: 400 * dto.slideCount,
          system:     systemPrompt,
          messages:   [{ role: 'user', content: userPrompt }],
        },
        {
          headers: {
            'x-api-key':         apiKey,
            'anthropic-version': '2023-06-01',
            'content-type':      'application/json',
          },
          timeout: 45000,
        },
      );

      const rawText = response.data.content[0].text.trim();
      const slides  = JSON.parse(rawText.replace(/```json|```/g, '').trim());

      const creative = await this.prisma.creative.create({
        data: {
          campaignId: dto.campaignId,
          conceptId:  dto.conceptId,
          angleId:    angleRecord?.id || null,
          format:     'CAROUSEL',
          variant:    dto.variant || 'A',
          content:    {
            slides,
            platform,
            angle: angleLabel,
            // Phase 6 — store template override so generateImages can apply it
            templateId:   dto.templateId   ?? null,
            // Brand color — passed through to compositor
            primaryColor: dto.primaryColor ?? null,
            // Persist visual overrides from evolved angles so generateImages can apply them
            angleVisualOverrides: (angleRecord as any)?.visualOverrides ?? null,
          },
        },
      });

      return {
        creativeId: creative.id,
        format:     'carousel',
        platform,
        angle:      angleLabel,
        slideCount: slides.length,
        slides,
      };
    } catch (err: any) {
      const msg = err?.response?.data || err?.message || 'Unknown error';
      throw new BadRequestException(`Carousel generation failed: ${JSON.stringify(msg)}`);
    }
  }

  // ── GENERATE IMAGES ─────────────────────────────────────────────────────────
  /**
   * Delegates entirely to ImageService.
   * flow: prompt-builder → ImageService → GeminiImageProvider → results
   */
  async generateImages(creativeId: string, userId: string) {
    const creative = await this.prisma.creative.findUnique({
      where:   { id: creativeId },
      include: { campaign: true },
    });
    if (!creative)                    throw new BadRequestException('Creative not found.');
    if (creative.format !== 'CAROUSEL') throw new BadRequestException('Creative is not a carousel.');
    await this.campaigns.assertOwnership(creative.campaignId, userId);

    const content  = creative.content as any;
    const slides: any[] = content.slides || [];
    if (!slides.length) throw new BadRequestException('No slides found in this creative.');

    // Load resource context (product, persona, brand visual style) for prompt enrichment
    const resourceCtx = await this.resources.getContext(userId).catch(() => null);

    // Extract angle emotional trigger keyword from angle label
    const angleLabel: string = content.angle || 'engaging';
    const angleEmotionalTrigger = extractEmotionalTrigger(angleLabel);

    const metadata = {
      angle:        angleLabel,
      format:       'carousel',
      platform:     content.platform     || 'instagram',
      templateId:   content.templateId   || null,
      primaryColor: content.primaryColor || null,
      // #4 enrichment — persona, angle, uploaded brand images
      productName:           resourceCtx?.productName           || undefined,
      personaDemographics:   resourceCtx?.persona?.demographics || undefined,
      brandVisualStyle:      resourceCtx?.brandVisualStyle      || undefined,
      angleEmotionalTrigger: angleEmotionalTrigger              || undefined,
    };

    // Build inputs — one per slide
    const inputs = slides.map(slide => ({
      slide: {
        type:     slide.type,
        hook:     slide.hook     || '',
        headline: slide.headline || '',
        body:     slide.body     || '',
      },
      metadata,
    }));

    // Delegate to ImageService — all Gemini logic lives there
    const results = await this.images.generateBatch(inputs);

    // ── Validate every result — reject blank / truncated URLs ─────────────────
    // A base64 JPEG data URL is always > 100 chars. A URL shorter than 50
    // characters is definitely wrong (empty string, error fragment, etc.)
    for (const r of results) {
      if (r.error) continue; // already captured as an error
      if (!r.imageUrl || r.imageUrl.length < 50) {
        throw new BadRequestException(
          `Imagen 4 returned an invalid image for slide ${r.slideNumber}: ` +
          `URL length ${r.imageUrl?.length ?? 0} is below the 50-character minimum. ` +
          `Check GEMINI_API_KEY and Imagen 4 quota.`,
        );
      }
    }

    // ── Step 2: Compositor pass — render final pixel-perfect PNG per slide ──────
    const platform = metadata.platform;
    const adSize   = platformToAdSize(platform);
    const baseTone = angleToTone(metadata.angle);

    // Read visual overrides from the angle (set by visual-type evolution mutations)
    const angleVisualOverrides = (creative.content as any)?.angleVisualOverrides ?? null;

    // Resolve style — angle overrides win over DNA + profile
    const resolvedStyle = await this.styleTranslator.resolveCompositorStyle(
      userId,
      baseTone,
      metadata.primaryColor || undefined,
      angleVisualOverrides,
    );

    const compositorInputs: CompositorInput[] = slides.map((slide, i) => {
      const slideType  = slideTypeForCompositor(slide.type);
      const templateId = (metadata.templateId as CompositorInput['templateId'] | null)
        ?? autoSelectTemplate(resolvedStyle.tone, platform, !!results[i]?.imageUrl, false, slideType);
      return {
        templateId,
        size: adSize,
        copy: {
          headline: slide.headline || '',
          body:     slide.body     || undefined,
          cta:      slide.cta      || undefined,
          eyebrow:  slide.type?.toUpperCase() || undefined,
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
      this.logger.log(`Compositor rendered ${compositorResults.length} slides for creative ${creativeId}`);
    } catch (err: any) {
      this.logger.warn(`Compositor render failed (falling back to raw images): ${err?.message}`);
    }

    // Persist image URL, prompt, compositor URL, and input for future re-renders
    const updatedSlides = slides.map((slide, i) => ({
      ...slide,
      imageUrl:       results[i]?.imageUrl          ?? null,
      imagePrompt:    results[i]?.promptUsed         ?? null,
      compositorUrl:  compositorResults[i]?.imageDataUrl ?? null,
      compositorInput: compositorInputs[i]           ?? null,
    }));

    await this.prisma.creative.update({
      where: { id: creativeId },
      data:  { content: { ...content, slides: updatedSlides } },
    });

    return { images: results, compositorSlides: updatedSlides.map((s, i) => ({
      slideNumber:   i + 1,
      compositorUrl: s.compositorUrl,
      imageUrl:      s.imageUrl,
    }))};
  }

  // ── RERENDER SINGLE SLIDE ───────────────────────────────────────────────────
  /**
   * Re-render one slide with copy or template overrides — no AI calls.
   * POST /api/carousel/:creativeId/slides/:index/rerender
   */
  async rerenderSlide(
    creativeId:          string,
    slideIndex:          number,
    userId:              string,
    copyOverrides:       Partial<CompositorInput['copy']> = {},
    templateOverride?:   CompositorInput['templateId'],
    fontPairingOverride?: string,
  ) {
    const creative = await this.prisma.creative.findUnique({ where: { id: creativeId } });
    if (!creative)                     throw new BadRequestException('Creative not found.');
    if (creative.format !== 'CAROUSEL') throw new BadRequestException('Not a carousel.');
    await this.campaigns.assertOwnership(creative.campaignId, userId);

    const content = creative.content as any;
    const slides: any[] = content.slides || [];
    const slide = slides[slideIndex];
    if (!slide) throw new BadRequestException(`Slide index ${slideIndex} not found.`);

    const originalInput: CompositorInput = slide.compositorInput ?? {
      templateId: 'full-bleed',
      size:       platformToAdSize(content.platform || 'instagram'),
      copy:       { headline: slide.headline || '', body: slide.body, cta: slide.cta },
      imageUrl:   slide.imageUrl || undefined,
      style:      { tone: 'bold', platform: content.platform || 'instagram' },
    };

    const result = await this.compositor.rerender(
      originalInput,
      copyOverrides,
      templateOverride,
      fontPairingOverride,
    );

    // Patch just this slide
    slides[slideIndex] = {
      ...slide,
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
      data:  { content: { ...content, slides } },
    });

    return {
      slideIndex,
      compositorUrl: result.imageDataUrl,
      templateId:    result.templateId,
      fontPairing:   result.fontPairing.id,
      renderTimeMs:  result.renderTimeMs,
      critique:      result.critique ?? null,
    };
  }

  // ── LIST ────────────────────────────────────────────────────────────────────

  async findByCampaign(campaignId: string, userId: string) {
    await this.campaigns.assertOwnership(campaignId, userId);
    return this.prisma.creative.findMany({
      where:   { campaignId, format: 'CAROUSEL' },
      include: { angle: true },
    });
  }
}
