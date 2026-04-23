import { Injectable, BadRequestException, forwardRef, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CampaignService } from '../campaign/campaign.service';
import { GenerateConceptDto } from './concept.dto';
import axios from 'axios';

@Injectable()
export class ConceptService {
  constructor(
    private readonly prisma:    PrismaService,
    private readonly config:    ConfigService,
    @Inject(forwardRef(() => CampaignService))
    private readonly campaigns: CampaignService,
  ) {}

  async generate(dto: GenerateConceptDto, userId: string) {
    // Verify campaign belongs to this user
    await this.campaigns.assertOwnership(dto.campaignId, userId);

    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');

    const systemPrompt = `You are a master creative strategist for digital marketing.
Your job is to analyze a brief and extract a structured master concept.
Return ONLY valid JSON. No markdown, no explanation, no backticks.`;

    const hintLines: string[] = [];
    if (dto.angleHint) hintLines.push(`Preferred angle: ${dto.angleHint}`);
    if (dto.toneHint)  hintLines.push(`Preferred tone: ${dto.toneHint}`);
    const hintBlock = hintLines.length
      ? `\nCampaign strategy hints (follow these closely):\n${hintLines.join('\n')}`
      : '';

    const userPrompt = `Brief: "${dto.brief}"
Goal: ${dto.goal}
Platform: ${dto.platform || 'instagram'}
Audience: ${dto.audience || 'general audience'}
Duration tier: ${dto.durationTier || '60s'}${hintBlock}

Generate a master creative concept as a JSON object with EXACTLY these fields:
{
  "goal": "${dto.goal}",
  "audience": "specific target audience description",
  "emotion": "primary emotion to trigger (e.g. curiosity, urgency, relief, FOMO)",
  "core_message": "single core message in one sentence",
  "offer": "what the brand is offering or what action to take",
  "style": "visual/tone style (e.g. cinematic, bold, minimalist, raw, energetic)",
  "platform": "${dto.platform || 'instagram'}",
  "duration_tier": "${dto.durationTier || '60s'}",
  "hook_angle": "the single best angle for this brief (teach | show_off | storytelling | tips_tricks | spark_conversation | data_stats | before_after | unpopular_opinion | do_this_not_that)",
  "why": "one sentence on why this angle works for this brief",
  "key_objection": "the single biggest reason the target audience would NOT buy — the hidden doubt or friction",
  "value_proposition": "the single most compelling reason to buy — one crisp sentence that captures the core benefit"
}`;

    try {
      const response = await axios.post(
        'https://api.anthropic.com/v1/messages',
        {
          model:      'claude-sonnet-4-5',
          max_tokens: 600,
          system:     systemPrompt,
          messages:   [{ role: 'user', content: userPrompt }],
        },
        {
          headers: {
            'x-api-key':          apiKey,
            'anthropic-version':  '2023-06-01',
            'content-type':       'application/json',
          },
          timeout: 30000,
        },
      );

      const raw = response.data.content[0].text.trim();
      const clean = raw.replace(/```json|```/g, '').trim();
      const conceptJson = JSON.parse(clean);

      const saved = await this.prisma.concept.create({
        data: {
          campaignId:   dto.campaignId,
          goal:         conceptJson.goal || dto.goal,
          audience:     conceptJson.audience || dto.audience || '',
          emotion:      conceptJson.emotion || '',
          coreMessage:  conceptJson.core_message || '',
          offer:        conceptJson.offer || '',
          style:        conceptJson.style || '',
          platform:     conceptJson.platform || dto.platform || 'instagram',
          durationTier: conceptJson.duration_tier || dto.durationTier || '60s',
          angleHint:        dto.angleHint                    || null,
          toneHint:         dto.toneHint                     || null,
          keyObjection:     conceptJson.key_objection        || null,
          valueProposition: conceptJson.value_proposition    || null,
          rawJson:          conceptJson,
        },
      });

      await this.prisma.campaign.update({
        where: { id: dto.campaignId },
        data:  { status: 'GENERATED' },
      });

      return { concept: saved, raw: conceptJson };
    } catch (err: any) {
      const msg = err?.response?.data || err?.message || 'Unknown error';
      throw new BadRequestException(`Concept generation failed: ${JSON.stringify(msg)}`);
    }
  }

  async findByCampaign(campaignId: string, userId: string) {
    await this.campaigns.assertOwnership(campaignId, userId);
    return this.prisma.concept.findUnique({ where: { campaignId } });
  }
}
