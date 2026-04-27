import { Injectable, BadRequestException, forwardRef, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CampaignService } from '../campaign/campaign.service';
import { ImageService } from '../image/image.service';
import { GenerateCarouselDto } from './carousel.dto';
import { buildPersonaBlock }   from '../resources/persona-prompt';
import axios from 'axios';

// ─── Slide sequence helper ────────────────────────────────────────────────────

function buildSlideSequence(count: number): string[] {
  const base = ['cover', 'problem', 'value', 'solution', 'proof', 'tips', 'cta'];
  if (count <= 3) return ['cover', 'value', 'cta'];
  if (count <= 5) return ['cover', 'problem', 'value', 'proof', 'cta'];
  return base.slice(0, count);
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class CarouselService {
  constructor(
    private readonly prisma:    PrismaService,
    private readonly config:    ConfigService,
    private readonly images:    ImageService,
    @Inject(forwardRef(() => CampaignService))
    private readonly campaigns: CampaignService,
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
          model:      'claude-sonnet-4-5',
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
          content:    { slides, platform, angle: angleLabel },
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

    const metadata = {
      angle:    content.angle    || 'engaging',
      format:   'carousel',
      platform: content.platform || 'instagram',
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

    // Persist the prompt used back into each slide for reproducibility
    const updatedSlides = slides.map((slide, i) => ({
      ...slide,
      imageUrl:    results[i]?.imageUrl   ?? null,
      imagePrompt: results[i]?.promptUsed ?? null,
    }));

    await this.prisma.creative.update({
      where: { id: creativeId },
      data:  { content: { ...content, slides: updatedSlides } },
    });

    return { images: results };
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
