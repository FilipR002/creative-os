/**
 * ugc.service.ts
 *
 * UGC Service — orchestrates the full UGC Engine pipeline.
 *
 * Public API:
 *   generate(dto, userId)    — full pipeline: Brain → Variants → Compile → Queue
 *   getJobStatus(jobId)      — single job status from Redis
 *   getJobsForCampaign(...)  — list jobs by campaign (via queue service)
 *
 * Pipeline:
 *   1. Load campaign + concept from DB (Prisma)
 *   2. UGC Brain → personas + hook strategies
 *   3. Variant Generator → N UGCVariants
 *   4. Kling Compiler → KlingCompilerOutput per variant
 *   5. Queue → enqueue each compiled variant
 *   6. Return executionId + jobIds
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';

import { PrismaService }        from '../prisma/prisma.service';
import { UGCBrainService }      from './ugc-brain.service';
import { VariantService }       from './variant.service';
import { KlingCompilerService } from './kling-compiler.service';
import { UGCQueueService }      from './queue/queue.service';
import { randomUUID }           from 'crypto';

import type {
  GenerateUGCDto,
  GenerateUGCResponse,
  UGCJobStatusResponse,
  UGCBrainInput,
} from './types/ugc.types';

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_VARIANT_COUNT   = 3;
const DEFAULT_DURATION_SECS   = 15;
const DEFAULT_PLATFORM        = 'tiktok';

// ─── Estimated render time formula ───────────────────────────────────────────

function estimateRenderTime(variantCount: number, durationSeconds: number): number {
  // Each scene ~10s render time per second of content, 5 scenes per variant
  return variantCount * 5 * durationSeconds * 10;
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class UGCService {
  private readonly logger = new Logger(UGCService.name);

  constructor(
    private readonly prisma:    PrismaService,
    private readonly brain:     UGCBrainService,
    private readonly variants:  VariantService,
    private readonly compiler:  KlingCompilerService,
    private readonly queue:     UGCQueueService,
  ) {}

  // ─── Public: Generate ────────────────────────────────────────────────────

  async generate(
    dto:    GenerateUGCDto,
    userId: string,
  ): Promise<GenerateUGCResponse> {
    const variantCount    = Math.min(Math.max(dto.variantCount ?? DEFAULT_VARIANT_COUNT, 1), 10);
    const durationSeconds = this.normaliseDuration(dto.durationSeconds);
    const platform        = dto.platform ?? DEFAULT_PLATFORM;

    // 1. Load campaign context
    const brainInput = await this.buildBrainInput(dto.campaignId, dto.conceptId, platform);

    // 2. UGC Brain
    const brainOutput = this.brain.analyze(brainInput);

    this.logger.log(
      `[UGCService] campaign=${dto.campaignId} personas=[${brainOutput.personas.map(p => p.id).join(',')}] ` +
      `hooks=[${brainOutput.hookStrategies.slice(0, 2).join(',')}]`,
    );

    // 3. Variant Generator
    const generatedVariants = this.variants.generate(brainInput, brainOutput, variantCount);

    // 4. Compile + Enqueue
    const executionId = randomUUID();
    const jobIds: string[] = [];

    for (const variant of generatedVariants) {
      const compiledPlan = this.compiler.compile(variant, durationSeconds);

      const jobId = await this.queue.enqueue({
        campaignId:      dto.campaignId,
        conceptId:       dto.conceptId,
        platform,
        durationSeconds,
        variant,
        compiledPlan,
      });

      jobIds.push(jobId);
    }

    const estimatedRenderTimeSeconds = estimateRenderTime(jobIds.length, durationSeconds);

    this.logger.log(
      `[UGCService] Queued ${jobIds.length} job(s) | executionId=${executionId} ` +
      `estimatedRender=${estimatedRenderTimeSeconds}s`,
    );

    return {
      executionId,
      campaignId:                 dto.campaignId,
      jobIds,
      status:                     'queued',
      variantCount:               jobIds.length,
      estimatedRenderTimeSeconds,
    };
  }

  // ─── Public: Status ───────────────────────────────────────────────────────

  async getJobStatus(jobId: string): Promise<UGCJobStatusResponse> {
    const record = await this.queue.getJob(jobId);

    if (!record) {
      throw new NotFoundException(`UGC job not found: ${jobId}`);
    }

    return {
      jobId:             record.jobId,
      status:            record.state,
      campaignId:        record.campaignId,
      persona:           record.persona,
      hook:              record.hook,
      videoUrl:          record.sceneVideoUrls?.[0],
      stitchedVideoUrl:  record.stitchedVideoUrl,
      score:             record.score,
      error:             record.error,
      createdAt:         record.enqueuedAt,
      completedAt:       record.completedAt,
    };
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private async buildBrainInput(
    campaignId: string,
    conceptId?: string,
    platform:   string = DEFAULT_PLATFORM,
  ): Promise<UGCBrainInput> {
    // Load campaign
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { name: true, goal: true, angle: true, tone: true, persona: true },
    });

    if (!campaign) {
      throw new NotFoundException(`Campaign not found: ${campaignId}`);
    }

    // Load concept for audience, emotion, pain point, and goal context
    let audience  = campaign.persona ?? 'target audience';
    let painPoint = 'common pain points';
    let angle     = campaign.angle ?? 'direct_benefit';
    let emotion   = 'frustrated';
    let goal      = campaign.goal ?? 'solve the problem';

    const conceptQuery = conceptId
      ? this.prisma.concept.findUnique({ where: { id: conceptId } })
      : this.prisma.concept.findUnique({ where: { campaignId } });

    const concept = await conceptQuery.catch(() => null);

    if (concept) {
      audience  = concept.audience    ?? audience;
      emotion   = concept.emotion     ?? emotion;
      painPoint = concept.keyObjection ?? concept.coreMessage ?? painPoint;
      goal      = concept.goal        ?? goal;
      angle     = concept.angleHint   ?? angle;
    }

    return {
      product:   campaign.name ?? 'our product',
      audience,
      painPoint,
      angle,
      platform,
      emotion,
      goal,
    };
  }

  private normaliseDuration(requested?: number): number {
    const valid = [15, 60, 90];
    if (!requested) return DEFAULT_DURATION_SECS;
    // Snap to nearest valid duration
    return valid.reduce((prev, curr) =>
      Math.abs(curr - requested) < Math.abs(prev - requested) ? curr : prev
    );
  }
}
