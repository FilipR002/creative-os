import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import axios from 'axios';
import type {
  CreateGenerationDto,
  UpdateBlockDto,
  ImproveBlockDto,
  CreateVersionDto,
  SendFeedbackDto,
} from './generations.dto';

@Injectable()
export class GenerationsService {
  constructor(
    private readonly prisma:  PrismaService,
    private readonly config:  ConfigService,
  ) {}

  // ── POST /generations ───────────────────────────────────────────────────────

  async create(dto: CreateGenerationDto, userId: string) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: dto.campaign_id },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');
    if (campaign.userId && campaign.userId !== userId) {
      throw new ForbiddenException('Campaign does not belong to you');
    }

    // Resolve final context: override > campaign > defaults
    const intent = {
      goal:    dto.override_settings?.goal    ?? campaign.goal    ?? 'conversions',
      angle:   dto.override_settings?.angle   ?? campaign.angle   ?? undefined,
      tone:    dto.override_settings?.tone    ?? campaign.tone    ?? undefined,
      persona: dto.override_settings?.persona ?? campaign.persona ?? undefined,
      format:  dto.override_settings?.format  ?? (campaign.formats?.[0] ?? 'banner'),
    };

    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');

    const hintLines: string[] = [];
    if (intent.angle)   hintLines.push(`Angle: ${intent.angle}`);
    if (intent.tone)    hintLines.push(`Tone: ${intent.tone}`);
    if (intent.persona) hintLines.push(`Target persona: ${intent.persona}`);
    const hintBlock = hintLines.length ? `\nStrategy hints:\n${hintLines.join('\n')}` : '';

    const systemPrompt = `You are a world-class advertising copywriter.
Return ONLY valid JSON. No markdown, no backticks, no explanation.`;

    const userPrompt = `Create an advertising creative for this brief.

Brief: "${dto.brief}"
Goal: ${intent.goal}
Format: ${intent.format}${hintBlock}

Return a JSON object with EXACTLY these fields:
{
  "hook": "opening line that stops scroll — max 12 words",
  "body": "supporting copy that sells the idea — 2-4 sentences",
  "cta": "action text — max 4 words",
  "reasoning": "1 sentence explaining why this approach works for the goal",
  "variations": [
    {
      "id": "var_1",
      "label": "short",
      "content": {
        "hook": "shorter punchier version of hook — max 7 words",
        "body": "condensed body — 1 sentence",
        "cta": "same or simpler cta"
      }
    },
    {
      "id": "var_2",
      "label": "alternative",
      "content": {
        "hook": "different angle on the same brief — max 12 words",
        "body": "supporting copy from a different perspective — 2-3 sentences",
        "cta": "alternative action text"
      }
    }
  ]
}`;

    try {
      const response = await axios.post(
        'https://api.anthropic.com/v1/messages',
        {
          model:      'claude-sonnet-4-6',
          max_tokens: 800,
          system:     systemPrompt,
          messages:   [{ role: 'user', content: userPrompt }],
        },
        {
          headers: {
            'x-api-key':         apiKey,
            'anthropic-version': '2023-06-01',
            'content-type':      'application/json',
          },
          timeout: 30000,
        },
      );

      const raw  = response.data.content[0].text.trim();
      const json = JSON.parse(raw.replace(/```json|```/g, '').trim());

      const generation = await this.prisma.generation.create({
        data: {
          campaignId:      dto.campaign_id,
          userId,
          inputBrief:      dto.brief,
          intentSnapshot:  intent,
          hook:            json.hook       || '',
          body:            json.body       || '',
          cta:             json.cta        || '',
          variations:      json.variations ?? [],
          reasoning:       json.reasoning  || null,
          overrideSettings: dto.override_settings ? (dto.override_settings as any) : null,
        },
      });

      return generation;
    } catch (err: any) {
      const msg = err?.response?.data || err?.message || 'Unknown error';
      throw new BadRequestException(`Generation failed: ${JSON.stringify(msg)}`);
    }
  }

  // ── GET /generations/:id ────────────────────────────────────────────────────

  async findOne(id: string, userId: string) {
    const gen = await this.prisma.generation.findUnique({ where: { id } });
    if (!gen) throw new NotFoundException('Generation not found');
    if (gen.userId !== userId) throw new ForbiddenException('Not your generation');
    return gen;
  }

  // ── GET /campaigns/:campaignId/generations ──────────────────────────────────

  async findByCampaign(campaignId: string, userId: string) {
    const campaign = await this.prisma.campaign.findUnique({ where: { id: campaignId } });
    if (!campaign) throw new NotFoundException('Campaign not found');
    if (campaign.userId && campaign.userId !== userId) throw new ForbiddenException('Not your campaign');
    return this.prisma.generation.findMany({
      where:   { campaignId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── PATCH /generations/:id/block ────────────────────────────────────────────

  async updateBlock(id: string, dto: UpdateBlockDto, userId: string) {
    const gen = await this.findOne(id, userId);

    // Snapshot current state before mutation
    await this.prisma.generationVersion.create({
      data: {
        generationId: id,
        hook:         gen.hook,
        body:         gen.body,
        cta:          gen.cta,
        createdFrom:  'edit',
      },
    });

    const updated = await this.prisma.generation.update({
      where: { id },
      data:  { [dto.block]: dto.value },
    });

    return updated;
  }

  // ── POST /generations/:id/improve ───────────────────────────────────────────

  async improveBlock(id: string, dto: ImproveBlockDto, userId: string) {
    const gen = await this.findOne(id, userId);
    const currentText = gen[dto.block] as string;

    const intent = gen.intentSnapshot as any;
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');

    const contextLines: string[] = [];
    if (intent?.goal)    contextLines.push(`Goal: ${intent.goal}`);
    if (intent?.angle)   contextLines.push(`Angle: ${intent.angle}`);
    if (intent?.tone)    contextLines.push(`Tone: ${intent.tone}`);

    const systemPrompt = `You are an expert advertising copywriter.
Return ONLY the improved text. No explanation, no quotes, no markdown.`;

    const userPrompt = `Current ${dto.block}: "${currentText}"
${contextLines.length ? `\nContext:\n${contextLines.join('\n')}` : ''}
Brief: "${gen.inputBrief}"

Instruction: ${dto.instruction}

Return ONLY the improved ${dto.block} text.`;

    try {
      const response = await axios.post(
        'https://api.anthropic.com/v1/messages',
        {
          model:      'claude-sonnet-4-6',
          max_tokens: 200,
          system:     systemPrompt,
          messages:   [{ role: 'user', content: userPrompt }],
        },
        {
          headers: {
            'x-api-key':         apiKey,
            'anthropic-version': '2023-06-01',
            'content-type':      'application/json',
          },
          timeout: 20000,
        },
      );

      const improved = response.data.content[0].text.trim().replace(/^["']|["']$/g, '');

      // Snapshot before mutation
      await this.prisma.generationVersion.create({
        data: {
          generationId: id,
          hook:         gen.hook,
          body:         gen.body,
          cta:          gen.cta,
          createdFrom:  'improve',
        },
      });

      const updated = await this.prisma.generation.update({
        where: { id },
        data:  { [dto.block]: improved },
      });

      const version = await this.prisma.generationVersion.findFirst({
        where:   { generationId: id },
        orderBy: { createdAt: 'desc' },
      });

      return {
        updated_block: improved,
        version_id:    version?.id ?? null,
        generation:    updated,
      };
    } catch (err: any) {
      const msg = err?.response?.data || err?.message || 'Unknown error';
      throw new BadRequestException(`Improve failed: ${JSON.stringify(msg)}`);
    }
  }

  // ── GET /generations/:id/versions ───────────────────────────────────────────

  async getVersions(generationId: string, userId: string) {
    await this.findOne(generationId, userId);
    return this.prisma.generationVersion.findMany({
      where:   { generationId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── POST /generations/:id/versions ──────────────────────────────────────────

  async createVersion(generationId: string, dto: CreateVersionDto, userId: string) {
    const gen = await this.findOne(generationId, userId);
    return this.prisma.generationVersion.create({
      data: {
        generationId,
        hook:        gen.hook,
        body:        gen.body,
        cta:         gen.cta,
        createdFrom: dto.created_from ?? 'manual',
      },
    });
  }

  // ── POST /versions/:id/restore ───────────────────────────────────────────────

  async restoreVersion(versionId: string, userId: string) {
    const version = await this.prisma.generationVersion.findUnique({
      where: { id: versionId },
    });
    if (!version) throw new NotFoundException('Version not found');

    // Ownership check via generation
    await this.findOne(version.generationId, userId);

    // Snapshot current state before restoring
    const current = await this.prisma.generation.findUnique({
      where: { id: version.generationId },
    });
    if (current) {
      await this.prisma.generationVersion.create({
        data: {
          generationId: version.generationId,
          hook:         current.hook,
          body:         current.body,
          cta:          current.cta,
          createdFrom:  'edit',
        },
      });
    }

    return this.prisma.generation.update({
      where: { id: version.generationId },
      data:  { hook: version.hook, body: version.body, cta: version.cta },
    });
  }

  // ── POST /feedback ────────────────────────────────────────────────────────────

  async sendFeedback(dto: SendFeedbackDto, userId: string) {
    return this.prisma.feedbackSignal.create({
      data: {
        userId,
        generationId: dto.generation_id ?? null,
        signalType:   dto.signal_type,
        block:        dto.block      ?? null,
        changeType:   dto.change_type ?? null,
      },
    });
  }
}
