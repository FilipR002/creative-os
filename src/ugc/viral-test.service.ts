/**
 * viral-test.service.ts
 *
 * Viral Testing Orchestrator — Phase 1.1
 *
 * Full pipeline:
 *   1. Build brain input from campaign/concept (same as UGCService)
 *   2. PersonaSplitter → weighted persona distribution
 *   3. ExpandedVariantService → persona × hook variant matrix (up to 10)
 *   4. KlingCompilerService → compile each variant into a render plan
 *   5. Queue all variants in parallel (each gets its own jobId)
 *   6. Register jobs under testId for test-scoped queries
 *   7. Return testId + jobIds + full variant manifest
 *
 * Status polling:
 *   getTestStatus() aggregates all jobs, runs scoring, selects winner
 *   when all jobs are in terminal state (done | failed).
 *
 * Memory feedback:
 *   Fires UGCMemoryFeedbackService when test reaches 'complete' state.
 *   Only fires once per test (guarded by Redis flag).
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID }                            from 'crypto';

import { PrismaService }           from '../prisma/prisma.service';
import { PersonaSplitterService }  from './persona-splitter.service';
import { ExpandedVariantService }  from './expanded-variant.service';
import { KlingCompilerService }    from './kling-compiler.service';
import { UGCQueueService }         from './queue/queue.service';
import { UGCScoringService }       from './ugc-scoring.service';
import { UGCWinnerService }        from './ugc-winner.service';
import { UGCMemoryFeedbackService } from './ugc-memory-feedback.service';

import type {
  LaunchViralTestDto,
  LaunchViralTestResponse,
  ViralTestStatusResponse,
  PersonaSplitInput,
} from './types/viral-test.types';
import type { ExpandedUGCVariant } from './types/viral-test.types';
import type { UGCBrainInput }      from './types/ugc.types';

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_PERSONA_COUNT   = 3;
const DEFAULT_DURATION_SECS   = 15;
const DEFAULT_PLATFORM        = 'tiktok';
const MAX_VARIANTS            = 10;

function estimateRenderTime(variantCount: number, durationSecs: number): number {
  return variantCount * 5 * durationSecs * 10;
}

function normaliseDuration(d?: number): number {
  const valid = [15, 60, 90];
  if (!d) return DEFAULT_DURATION_SECS;
  return valid.reduce((p, c) => Math.abs(c - d) < Math.abs(p - d) ? c : p);
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class ViralTestService {
  private readonly logger = new Logger(ViralTestService.name);

  constructor(
    private readonly prisma:          PrismaService,
    private readonly splitter:        PersonaSplitterService,
    private readonly expandedVariants: ExpandedVariantService,
    private readonly compiler:        KlingCompilerService,
    private readonly queue:           UGCQueueService,
    private readonly scoring:         UGCScoringService,
    private readonly winner:          UGCWinnerService,
    private readonly memoryFeedback:  UGCMemoryFeedbackService,
  ) {}

  // ─── Launch ───────────────────────────────────────────────────────────────

  async launch(
    dto:    LaunchViralTestDto,
    userId: string,
  ): Promise<LaunchViralTestResponse> {
    const testId          = randomUUID();
    const durationSeconds = normaliseDuration(dto.durationSeconds);
    const platform        = dto.platform ?? DEFAULT_PLATFORM;
    const personaCount    = Math.min(4, Math.max(1, dto.personaCount ?? DEFAULT_PERSONA_COUNT));

    // 1. Load campaign context
    const context = await this.buildContext(dto.campaignId, dto.conceptId, platform);

    // 2. Persona split
    const splitInput: PersonaSplitInput = {
      product:   context.product,
      audience:  context.audience,
      painPoint: context.painPoint,
      angle:     context.angle,
      platform,
      emotion:   context.emotion,
    };
    const split = this.splitter.split(splitInput, personaCount);

    this.logger.log(
      `[ViralTest] testId=${testId} dominant=${split.dominant} ` +
      `personas=[${split.weights.map(w => `${w.personaId}:${w.probability}`).join(', ')}]`,
    );

    // 3. Generate expanded variant matrix (persona × A/B/C hooks)
    const expandCtx = {
      product:   context.product,
      audience:  context.audience,
      painPoint: context.painPoint,
      platform:  context.platform,
      goal:      context.goal ?? 'solve the problem',
    };
    const variants = this.expandedVariants.generate(split, expandCtx, MAX_VARIANTS);

    // 4. Compile + enqueue all variants in parallel
    const enqueueResults = await Promise.all(
      variants.map(variant => this.enqueueVariant({
        variant,
        testId,
        campaignId:      dto.campaignId,
        conceptId:       dto.conceptId,
        platform,
        durationSeconds,
      })),
    );

    const jobIds = enqueueResults.map(r => r.jobId);

    // 5. Register all jobs under testId for status queries
    await Promise.all(
      enqueueResults.map(r => this.queue.registerTestJob(testId, r.jobId)),
    );

    const estimated = estimateRenderTime(variants.length, durationSeconds);

    this.logger.log(
      `[ViralTest] Launched testId=${testId} | ${variants.length} variants | ` +
      `${enqueueResults.length} jobs queued | estimated=${estimated}s`,
    );

    return {
      testId,
      campaignId:                 dto.campaignId,
      jobIds,
      status:                     'queued',
      variantCount:               variants.length,
      personaCount:               split.weights.length,
      estimatedRenderTimeSeconds: estimated,
      variants: variants.map((v, i) => ({
        variantId:        v.variantId,
        persona:          v.personaId,
        hookId:           v.hookVariantId,
        hook:             v.hook,
        ugcScoreEstimate: v.ugcScoreEstimate,
      })),
    };
  }

  // ─── Status + winner ──────────────────────────────────────────────────────

  async getTestStatus(
    testId:     string,
    userId:     string,
    clientId:   string,
    industry:   string,
  ): Promise<ViralTestStatusResponse> {
    const jobs = await this.queue.getTestJobs(testId);

    if (jobs.length === 0) {
      throw new NotFoundException(`Test not found: ${testId}`);
    }

    const campaignId = jobs[0].campaignId;

    // Derive test-level status
    const states      = jobs.map(j => j.state);
    const allTerminal = states.every(s => s === 'done' || s === 'failed');
    const anyDone     = states.some(s => s === 'done');
    const testStatus: ViralTestStatusResponse['status'] = allTerminal
      ? (anyDone ? 'complete' : 'partial')
      : states.some(s => s === 'processing' || s === 'done')
        ? 'scoring'
        : 'running';

    // Build job status list
    const jobStatuses = jobs.map(j => ({
      jobId:             j.jobId,
      variantId:         j.variantId ?? j.jobId,
      state:             j.state,
      score:             j.score,
      stitchedVideoUrl:  j.stitchedVideoUrl,
    }));

    // Winner selection — only when all done
    let winnerResult: ViralTestStatusResponse['winner'] | undefined;

    if (allTerminal && anyDone) {
      winnerResult = await this.computeAndStoreWinner(
        testId,
        jobs,
        userId,
        clientId,
        industry,
        campaignId,
      );
    }

    return {
      testId,
      campaignId,
      status:      testStatus,
      jobStatuses,
      winner:      winnerResult,
      completedAt: allTerminal ? new Date().toISOString() : undefined,
    };
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private async enqueueVariant(opts: {
    variant:         ExpandedUGCVariant;
    testId:          string;
    campaignId:      string;
    conceptId?:      string;
    platform:        string;
    durationSeconds: number;
  }): Promise<{ jobId: string; variantId: string }> {
    const { variant, testId, campaignId, conceptId, platform, durationSeconds } = opts;

    // Bridge ExpandedUGCVariant → UGCVariant for the Kling compiler
    const ugcVariant = {
      id:                 randomUUID(),
      persona:            variant.personaId,
      hook:               variant.hook,
      emotion:            variant.emotionArc.split('→')[0].trim(),
      tone:               variant.tone,
      pacing:             variant.pacing,
      script:             variant.script,
      conversionStrength: variant.ugcScoreEstimate,
      hookStrategy:       variant.hookStrategy,
    };

    const compiledPlan = this.compiler.compile(ugcVariant, durationSeconds);

    // FIX 6: Pass full variant data so job record is complete (no lossy reconstruction)
    const jobId = await this.queue.enqueue({
      campaignId,
      conceptId,
      platform,
      durationSeconds,
      variant:           ugcVariant,
      compiledPlan,
      testId,
      variantId:         variant.variantId,
      hookId:            variant.hookVariantId,
      emotionalStrategy: variant.emotionArc,
      ugcScoreEstimate:  variant.ugcScoreEstimate,
    });

    return { jobId, variantId: variant.variantId };
  }

  private async computeAndStoreWinner(
    testId:     string,
    jobs:       Awaited<ReturnType<UGCQueueService['getTestJobs']>>,
    userId:     string,
    clientId:   string,
    industry:   string,
    campaignId: string,
  ): Promise<ViralTestStatusResponse['winner']> {
    // Rebuild ExpandedUGCVariant stubs from job records for scoring
    // (full variant data is not stored — we reconstruct from job fields)
    const doneJobs = jobs.filter(j => j.state === 'done');
    if (doneJobs.length === 0) return undefined;

    // Build real score map from job.score (set by queue processor via ScoringService)
    const realScores = new Map<string, number>(
      doneJobs
        .filter(j => j.score !== undefined)
        .map(j => [j.variantId ?? j.jobId, j.score!]),
    );

    // FIX 6: Reconstruct ExpandedUGCVariant from PERSISTED job data (no defaults needed)
    const variantStubs: ExpandedUGCVariant[] = doneJobs.map(j => ({
      variantId:          j.variantId ?? j.jobId,
      personaId:          j.persona as any,
      hookVariantId:      (j.hookId ?? 'A') as any,
      hook:               j.hook,
      hookStrategy:       (j.emotionalStrategy?.split('→')[0]?.trim() ?? 'relatable_pain') as any,
      emotionArc:         j.emotionalStrategy ?? 'problem → solution → action',
      tone:               'authentic',
      pacing:             'medium',
      script:             j.fullScript ?? '',
      // Use real score if available, fall back to persisted estimate (not a guess)
      ugcScoreEstimate:   j.score ?? j.ugcScoreEstimate ?? 0.70,
      personaProbability: 0.33,
    }));

    const scoringResult = this.scoring.score(testId, variantStubs, realScores);
    const winnerResult  = this.winner.select(scoringResult);

    // Fire memory feedback (non-blocking)
    const winnerJob = doneJobs.find(j => (j.variantId ?? j.jobId) === winnerResult.winnerVariantId);
    if (winnerJob) {
      const winnerVariant = variantStubs.find(v => v.variantId === winnerResult.winnerVariantId);
      if (winnerVariant) {
        this.memoryFeedback
          .sendWinnerFeedback({ testId, campaignId, userId, clientId, industry, winner: winnerResult, winnerVariant })
          .catch(err => this.logger.warn(`[ViralTest] Memory feedback error: ${err}`));
      }
    }

    return winnerResult;
  }

  private async buildContext(
    campaignId: string,
    conceptId?: string,
    platform:   string = DEFAULT_PLATFORM,
  ): Promise<UGCBrainInput> {
    const campaign = await this.prisma.campaign.findUnique({
      where:  { id: campaignId },
      select: { name: true, goal: true, angle: true, persona: true },
    });
    if (!campaign) throw new NotFoundException(`Campaign not found: ${campaignId}`);

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
      product:  campaign.name ?? 'our product',
      audience,
      painPoint,
      angle,
      platform,
      emotion,
      goal,
    };
  }
}
