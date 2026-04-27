import { Injectable, BadRequestException, forwardRef, Inject, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CampaignService } from '../campaign/campaign.service';
import { ImageService } from '../image/image.service';
import { GenerateVideoDto, DurationTier } from './video.dto';
import { HookBoosterService } from './hook-booster.service';
import { calculateHookScore } from '../scoring/scoring.utils';
import axios from 'axios';

const SCENE_COUNTS: Record<DurationTier, number> = {
  '5s':  1,
  '8s':  1,
  '10s': 2,
  '15s': 2,
  '30s': 3,
  '45s': 6,
  '60s': 7,
  '75s': 8,
  '90s': 10,
};

@Injectable()
export class VideoService {
  constructor(
    private readonly prisma:      PrismaService,
    private readonly config:      ConfigService,
    private readonly hookBooster: HookBoosterService,
    private readonly images:      ImageService,
    @Inject(forwardRef(() => CampaignService))
    private readonly campaigns:   CampaignService,
  ) {}

  async generate(dto: GenerateVideoDto, userId: string) {
    // Ownership check
    await this.campaigns.assertOwnership(dto.campaignId, userId);

    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
    const sceneCount = SCENE_COUNTS[dto.durationTier] || 7;

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
    const angleLabel = angleRecord?.label || raw?.hook_angle || 'teach';
    const angleSlug  = angleRecord?.slug  || raw?.hook_angle || 'teach';

    const systemPrompt = [
      `You are a world-class video ad scriptwriter.`,
      `You write scene-by-scene video scripts optimized for social media.`,
      `Return ONLY valid JSON array. No markdown. No explanation. No backticks.`,
      dto.styleContext ? `\n${dto.styleContext}` : '',
    ].filter(Boolean).join('\n');

    const objectionLine     = dto.keyObjection     ? `- Key objection to overcome: ${dto.keyObjection}`     : '';
    const valuePropLine     = dto.valueProposition ? `- Value proposition to lead with: ${dto.valueProposition}` : '';

    const userPrompt = `Create a ${dto.durationTier} video ad script with exactly ${sceneCount} scenes.

CONCEPT:
- Core message: ${raw?.core_message || concept.coreMessage}
- Audience: ${raw?.audience || concept.audience}
- Emotion: ${raw?.emotion || concept.emotion}
- Goal: ${concept.goal}
- Offer: ${raw?.offer || concept.offer || ''}
- Style: ${raw?.style || concept.style || 'cinematic'}
- Angle: ${angleLabel}
${objectionLine}
${valuePropLine}

SCENE STRUCTURE (must follow this order):
hook → setup → conflict → value → payoff → cta
(If more than 6 scenes, expand the "value" section with additional benefit scenes)

Return a JSON array of exactly ${sceneCount} scene objects:
[
  {
    "scene_number": 1,
    "type": "hook",
    "duration_seconds": 5,
    "voiceover": "exact spoken words",
    "on_screen_text": "text overlay (short, punchy)",
    "visual_prompt": "cinematic description of what the camera shows",
    "emotion": "emotion this scene should trigger"
  }
]

Rules:
- hook scene must stop scroll in first 3 seconds
- voiceover max 2 sentences per scene
- on_screen_text max 6 words
- visual_prompt must be photorealistic and platform-ready
- NO scene should exceed ${Math.ceil(parseInt(dto.durationTier) / sceneCount) + 2} seconds`;

    try {
      const response = await axios.post(
        'https://api.anthropic.com/v1/messages',
        {
          model: 'claude-sonnet-4-5',
          max_tokens: 2000,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        },
        {
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          timeout: 45000,
        },
      );

      const raw_text = response.data.content[0].text.trim();
      const clean = raw_text.replace(/```json|```/g, '').trim();
      let scenes = JSON.parse(clean);

      // ── Hook Booster: auto-run if hook is weak (no external call) ──────────
      const hookScene = scenes.find((s: any) => s.type === 'hook') || scenes[0];
      const hookScoreBefore = hookScene
        ? calculateHookScore((hookScene.voiceover || '') + ' ' + (hookScene.on_screen_text || ''))
        : 0;

      let hookBoosted = false;
      if (hookScoreBefore < 0.60) {
        scenes = await this.hookBooster.autoBoostIfWeak(
          '', // no creativeId yet — pass concept+angle directly
          scenes,
          concept,
          angleSlug,
        );
        hookBoosted = true;
      }

      // Save creative
      const creative = await this.prisma.creative.create({
        data: {
          campaignId: dto.campaignId,
          conceptId:  dto.conceptId,
          angleId:    angleRecord?.id || null,
          format:     'VIDEO',
          variant:    dto.variant || 'A',
          content:    { scenes, duration_tier: dto.durationTier, angle: angleLabel },
        },
      });

      return {
        creativeId:    creative.id,
        format:        'video',
        durationTier:  dto.durationTier,
        angle:         angleLabel,
        sceneCount:    scenes.length,
        hookScore:     hookScoreBefore,
        hookBoosted,
        scenes,
      };
    } catch (err: any) {
      const msg = err?.response?.data || err?.message || 'Unknown error';
      throw new BadRequestException(`Video generation failed: ${JSON.stringify(msg)}`);
    }
  }

  async findByCampaign(campaignId: string, userId: string) {
    await this.campaigns.assertOwnership(campaignId, userId);
    return this.prisma.creative.findMany({
      where:   { campaignId, format: 'VIDEO' },
      include: { angle: true },
    });
  }

  // ── Image generation for video scenes ────────────────────────────────────
  // Takes each scene's visual_prompt, generates an image in parallel,
  // persists imageUrl back to the scene, and returns the results.
  // Individual scene failures never kill the batch.

  async generateImages(creativeId: string, userId: string) {
    const creative = await this.prisma.creative.findUnique({ where: { id: creativeId } });
    if (!creative)           throw new NotFoundException(`creative ${creativeId} not found`);
    if (creative.format !== 'VIDEO') throw new BadRequestException('Creative is not a video');

    const content = creative.content as any;
    const scenes:  any[] = content.scenes ?? [];
    const angle:   string = content.angle ?? 'general';
    const platform = 'instagram';

    // Generate one image per scene sequentially to avoid API rate limits
    // TODO: revert to Promise.all once on Anthropic Tier 2+
    const results: any[] = [];
    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      if (i > 0) await new Promise(r => setTimeout(r, 1500));
      const prompt = scene.visual_prompt
        ? `Cinematic marketing photography. ${scene.visual_prompt}. Platform: ${platform}. Angle: ${angle}. No text, no words, no letters in the image. Photorealistic, commercial quality, sharp focus.`
        : null;

      if (!prompt) { results.push({ sceneNumber: i + 1, imageUrl: null, error: 'No visual prompt' }); continue; }

      try {
        const result = await this.images.generateFromPrompt(prompt, {
          angle,
          format:   'video',
          platform,
        });
        scene.imageUrl = result.imageUrl;
        results.push({ sceneNumber: i + 1, imageUrl: result.imageUrl, promptUsed: prompt, error: null });
      } catch (err: any) {
        results.push({ sceneNumber: i + 1, imageUrl: null, error: err?.message ?? 'Failed' });
      }
    }

    // Persist updated scenes (with imageUrl) back to DB
    await this.prisma.creative.update({
      where: { id: creativeId },
      data:  { content: { ...content, scenes } },
    });

    return { images: results };
  }
}
