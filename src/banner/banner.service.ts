import { Injectable, BadRequestException, forwardRef, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CampaignService } from '../campaign/campaign.service';
import { ImageService } from '../image/image.service';
import { buildBannerImagePrompt } from '../image/utils/prompt-builder';
import { GenerateBannerDto } from './banner.dto';
import { buildPersonaBlock }  from '../resources/persona-prompt';
import axios from 'axios';

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
  constructor(
    private readonly prisma:    PrismaService,
    private readonly config:    ConfigService,
    private readonly images:    ImageService,
    @Inject(forwardRef(() => CampaignService))
    private readonly campaigns: CampaignService,
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
          model: 'claude-sonnet-4-5',
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
          content: { banners, angle: angleLabel },
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
      angle:    content.angle    || 'engaging',
      format:   'banner',
      platform: 'display',
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

    // Persist the image URL and prompt back into each banner
    const updatedBanners = banners.map((banner, i) => ({
      ...banner,
      imageUrl:    results[i]?.imageUrl ?? null,
      imagePrompt: results[i]?.promptUsed ?? null,
    }));

    await this.prisma.creative.update({
      where: { id: creativeId },
      data:  { content: { ...content, banners: updatedBanners } },
    });

    return { images: results };
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
