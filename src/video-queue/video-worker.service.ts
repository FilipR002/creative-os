/**
 * video-worker.service.ts
 *
 * BullMQ Worker for the `video-render` queue.
 *
 * Each job:
 *   1. Iterates angles from payload (sequentially to respect Kling rate limits)
 *   2. For each angle: computes routing/fatigue/mirofish → builds execution input
 *      → calls ExecutionGatewayService.execute() (Kling render + Stitch)
 *   3. Scores all creatives
 *   4. Fires memory + learning + evolution (all fire-and-forget)
 *   5. Returns a complete VideoJobResult stored in BullMQ as job.returnvalue
 *
 * Progress milestones:
 *   5  — job accepted
 *   10 + (i / angles.length * 70) — after each angle render
 *   85  — scoring done
 *   95  — memory / learning triggered
 *   100 — complete
 *
 * CRITICAL: Do NOT call Kling, Stitch, or ExecutionGateway from anywhere
 * other than this worker. All video generation routes through this service.
 */

import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService }            from '@nestjs/config';
import { Worker, Job }              from 'bullmq';
import type { ConnectionOptions }   from 'bullmq';
import { randomUUID }               from 'crypto';

import { ExecutionGatewayService }  from '../creative-os/lib/execution-gateway';
import { ScoringService }           from '../scoring/scoring.service';
import { MemoryService }            from '../memory/memory.service';
import { LearningService }          from '../learning/learning.service';
import { EvolutionService }         from '../evolution/evolution.service';
import { SmartRoutingService }      from '../routing/smart/routing.service';
import { FatigueService }           from '../fatigue/fatigue.service';
import { MirofishService }          from '../mirofish/mirofish.service';
import { decideMode }               from '../creative-os/lib/model-router';
import { CampaignMode }             from '../campaign/campaign.dto';
import { ConceptGoal }              from '../concept/concept.dto';
import type { RoutingContext }       from '../routing/smart/routing.types';
import type { CreativePlan }        from '../creative-director/creative-director-orchestrator';
import type { GatewayExecutionInput } from '../creative-os/lib/execution-gateway';

import {
  VIDEO_QUEUE_NAME,
  VideoJobPayload,
  VideoJobResult,
}                                   from './video-job.types';
import type { RunCreativeItem, RunScoringItem, RunAngleItem } from '../product-run/product-run.types';

// ─── Constants ─────────────────────────────────────────────────────────────────
const EVOLUTION_THRESHOLD   = 0.70;
const KLING_MAX_SCENE_SECS  = 10;

const DURATION_TIER_SECS: Record<string, number> = {
  SHORT: 15, MEDIUM: 30, LONG: 60, EXTENDED: 90,
};

// ─── Synthetic plan builder (mirrors product-run.service.ts) ──────────────────

function buildSceneTemplates(
  hook: string, cta: string, platform: string, angleSlug: string, count: number,
): Array<{ kling_prompt: string; overlay_text: string; transition: any; pacing: string }> {
  const slug = angleSlug.replace(/_/g, ' ');
  const pool = [
    { kling_prompt: `${hook} | authentic UGC | platform:${platform}`,           overlay_text: hook.slice(0, 60),           transition: 'cut'  as const, pacing: 'aggressive' as any },
    { kling_prompt: `Problem | tension | close-up | ${platform}`,                overlay_text: 'Does this feel familiar?',  transition: 'zoom' as any, pacing: 'moderate'   as any },
    { kling_prompt: `Solution reveal | confident | ${platform}`,                 overlay_text: `${slug} works.`,            transition: 'cut'  as any, pacing: 'moderate'   as any },
    { kling_prompt: `Social proof | testimonial style | ${platform}`,            overlay_text: 'Others are seeing it too.', transition: 'zoom' as any, pacing: 'moderate'   as any },
    { kling_prompt: `Before vs after | transformation | ${platform}`,            overlay_text: 'See the difference.',       transition: 'cut'  as any, pacing: 'aggressive' as any },
    { kling_prompt: `Feature highlight | close-up detail | ${platform}`,         overlay_text: `Why ${slug} works.`,        transition: 'cut'  as any, pacing: 'moderate'   as any },
    { kling_prompt: `Emotional peak | aspirational moment | ${platform}`,        overlay_text: 'This could be you.',        transition: 'zoom' as any, pacing: 'moderate'   as any },
    { kling_prompt: `Objection handling | reassurance | ${platform}`,            overlay_text: 'No catch. Just results.',   transition: 'cut'  as any, pacing: 'moderate'   as any },
    { kling_prompt: `CTA: ${cta} | direct to camera | ${platform}`,             overlay_text: cta,                         transition: 'cut'  as any, pacing: 'moderate'   as any },
  ];
  if (count === 1) return [pool[0]];
  if (count === 2) return [pool[0], pool[8]];
  const middle = pool.slice(1, 8);
  const middleSlots = Array.from({ length: count - 2 }, (_, i) => middle[i % middle.length]);
  return [pool[0], ...middleSlots, pool[8]];
}

function buildMinimalPlan(
  dto: VideoJobPayload['dto'],
  angleSlug: string,
  campaignId: string,
  conceptId: string,
): CreativePlan {
  const hook      = dto.styleContext?.split('|')[0].trim().slice(0, 80) ?? `Discover ${angleSlug}`;
  const cta       = dto.goal === 'conversion' ? 'Get started now →' : dto.goal === 'awareness' ? 'Learn more →' : 'See how it works →';
  const platform  = dto.platform ?? 'tiktok';
  const totalSecs = DURATION_TIER_SECS[dto.durationTier ?? 'SHORT'] ?? 15;
  const sceneCount = Math.max(1, Math.ceil(totalSecs / KLING_MAX_SCENE_SECS));
  const slug       = angleSlug.replace(/_/g, ' ');

  return {
    core_story: {
      hook,
      problem:  'The gap between where you are and where you want to be is wider than it needs to be.',
      solution: `${slug} closes that gap — built for real results.`,
      cta,
    },
    video:    { scenes: buildSceneTemplates(hook, cta, platform, angleSlug, sceneCount) as any },
    carousel: {
      slides: [
        { headline: hook,                      intent: 'hook'     as const, visual_direction: `Bold typography, high-energy, ${platform}` },
        { headline: 'The problem most miss.',  intent: 'problem'  as const, visual_direction: 'Pain point visual', subtext: 'Sound familiar?' },
        { headline: `${slug} solves it.`,      intent: 'solution' as const, visual_direction: 'Product hero, clean' },
        { headline: 'Here is why it works.',   intent: 'solution' as const, visual_direction: 'Feature highlight'  },
        { headline: cta,                       intent: 'cta'      as const, visual_direction: 'Strong CTA'         },
      ],
    },
    banner: {
      headline:           hook.slice(0, 50),
      subtext:            `${slug} — built for results.`.slice(0, 80),
      cta,
      visual_composition: `High-impact visual, ${platform} optimized`,
    },
    _meta: {
      generated_at:  new Date().toISOString(),
      model:         'video-worker-synthetic',
      campaign_id:   campaignId,
      concept_id:    conceptId,
      duration_tier: dto.durationTier ?? 'SHORT',
      version:       '2.0',
    },
  };
}

// ─── Connection factory (mirrors video-queue.service.ts) ──────────────────────

function buildConnection(config: ConfigService): ConnectionOptions {
  const url = config.get<string>('REDIS_URL');
  if (url) return { url } as unknown as ConnectionOptions;
  return {
    host: config.get<string>('REDIS_HOST', 'localhost'),
    port: config.get<number>('REDIS_PORT', 6379),
  };
}

// ─── Worker service ───────────────────────────────────────────────────────────

@Injectable()
export class VideoWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(VideoWorkerService.name);
  private worker!: Worker<VideoJobPayload, VideoJobResult>;

  constructor(
    private readonly gateway:      ExecutionGatewayService,
    private readonly scoring:      ScoringService,
    private readonly memory:       MemoryService,
    private readonly learning:     LearningService,
    private readonly evolution:    EvolutionService,
    private readonly smartRouting: SmartRoutingService,
    private readonly fatigue:      FatigueService,
    private readonly mirofish:     MirofishService,
    private readonly config:       ConfigService,
  ) {}

  // ─── Lifecycle ──────────────────────────────────────────────────────────────

  onModuleInit(): void {
    const connection = buildConnection(this.config);

    this.worker = new Worker<VideoJobPayload, VideoJobResult>(
      VIDEO_QUEUE_NAME,
      (job) => this.process(job),
      {
        connection,
        concurrency:         2,   // 2 parallel jobs max — Kling has rate limits
        lockDuration:        600_000, // 10 min lock per job (Kling can be slow)
        stalledInterval:     60_000,
        maxStalledCount:     2,
      },
    );

    this.worker.on('completed', (job) =>
      this.logger.log(`[VideoWorker] ✅ Job ${job.id} completed (executionId=${job.data.executionId})`),
    );

    this.worker.on('failed', (job, err) =>
      this.logger.error(`[VideoWorker] ❌ Job ${job?.id} failed: ${err.message}`, err.stack),
    );

    this.worker.on('error', (err) =>
      this.logger.error(`[VideoWorker] Worker error: ${err.message}`),
    );

    this.logger.log('[VideoWorker] Worker started — listening for video-render jobs');
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    this.logger.log('[VideoWorker] Worker closed');
  }

  // ─── Job processor ──────────────────────────────────────────────────────────

  private async process(
    job: Job<VideoJobPayload, VideoJobResult>,
  ): Promise<VideoJobResult> {
    const { executionId, campaignId, userId, dto, concept, angles } = job.data;
    const t0 = Date.now();

    this.logger.log(
      `[VideoWorker] Processing job=${job.id} executionId=${executionId} ` +
      `angles=${angles.length} durationTier=${dto.durationTier ?? 'SHORT'}`,
    );

    await job.updateProgress(5);

    // ── Step 1: Render each angle sequentially (Kling rate-limit safe) ────────
    const creativeResults: RunCreativeItem[] = [];

    for (let i = 0; i < angles.length; i++) {
      const angle = angles[i];

      this.logger.log(
        `[VideoWorker] job=${job.id} rendering angle ${i + 1}/${angles.length}: ${angle.slug}`,
      );

      try {
        const result = await this.renderAngle(
          dto, campaignId, concept, angle.slug, userId,
        );
        creativeResults.push(result);
      } catch (err: any) {
        // Log but continue — other angles should still render
        this.logger.error(
          `[VideoWorker] job=${job.id} angle=${angle.slug} failed: ${err.message}`,
        );
      }

      // Progress: 5% base + up to 75% for renders
      await job.updateProgress(Math.round(5 + ((i + 1) / angles.length) * 75));
    }

    if (creativeResults.length === 0) {
      throw new Error('[VideoWorker] All angle renders failed — no creatives produced.');
    }

    // ── Step 2: Score creatives ────────────────────────────────────────────────
    this.logger.log(`[VideoWorker] job=${job.id} scoring ${creativeResults.length} creatives`);

    const creativeIds = creativeResults.map(c => c.creativeId);
    const scores      = await this.scoring.evaluate(creativeIds);

    await job.updateProgress(85);

    const angleByCreative = new Map<string, string>(
      creativeResults.map(c => [c.creativeId, c.angleSlug]),
    );

    const scoringItems: RunScoringItem[] = scores.map(s => ({
      creativeId: s.creativeId,
      angleSlug:  angleByCreative.get(s.creativeId) ?? '',
      totalScore: round2(s.totalScore),
      ctrScore:   round2(s.ctrScore),
      engagement: round2(s.engagement),
      conversion: round2(s.conversion),
      isWinner:   s.isWinner,
    }));

    const winnerScore = scores.find(s => s.isWinner) ?? null;
    const winner      = winnerScore
      ? (scoringItems.find(s => s.creativeId === winnerScore.creativeId) ?? null)
      : null;

    // ── Step 3: Memory + learning (fire-and-forget) ───────────────────────────
    this.memory
      .storeFromScoringResult(scores, dto.clientId, dto.industry, userId)
      .catch(err => this.logger.warn(`[VideoWorker] Memory store failed: ${err?.message}`));

    this.learning
      .runCycle(campaignId)
      .catch(err => this.logger.warn(`[VideoWorker] Learning failed: ${err?.message}`));

    // ── Step 4: Evolution (conditional, fire-and-forget) ─────────────────────
    const evolutionTriggered = !!winner && winner.totalScore >= EVOLUTION_THRESHOLD;
    if (evolutionTriggered) {
      this.evolution
        .runEvolutionCycle()
        .catch(err => this.logger.warn(`[VideoWorker] Evolution failed: ${err?.message}`));
      this.logger.log(
        `[VideoWorker] job=${job.id} evolution triggered (score ${winner!.totalScore} ≥ ${EVOLUTION_THRESHOLD})`,
      );
    }

    await job.updateProgress(95);

    const elapsed = Date.now() - t0;
    this.logger.log(
      `[VideoWorker] job=${job.id} done in ${(elapsed / 1_000).toFixed(1)}s — ` +
      `${creativeResults.length} creatives, winner: ${winner?.angleSlug ?? 'none'}`,
    );

    await job.updateProgress(100);

    return {
      executionId,
      campaignId,
      creatives:            creativeResults,
      scoring:              scoringItems,
      winner,
      learningUpdateStatus: 'triggered',
      evolutionTriggered,
      explanation:          buildExplanation(angles, winner, evolutionTriggered),
    };
  }

  // ─── Per-angle render ────────────────────────────────────────────────────────

  private async renderAngle(
    dto:       VideoJobPayload['dto'],
    campaignId: string,
    concept:   VideoJobPayload['concept'],
    angleSlug: string,
    userId:    string,
  ): Promise<RunCreativeItem> {

    // Fatigue signal
    let fatigueState: 'HEALTHY' | 'WARMING' | 'FATIGUED' | 'BLOCKED' = 'WARMING';
    let fatigueScore = 0.30;
    try {
      const fr  = await this.fatigue.computeForSlug(angleSlug, userId);
      fatigueState = fr.fatigue_state;
      fatigueScore  = fr.fatigue_score;
    } catch (err) {
      this.logger.warn(
        `[VideoWorker] FatigueService failed for angle=${angleSlug}: ${(err as Error).message}`,
      );
    }

    // MIROFISH confidence
    let mirofishConfidence = 0;
    try {
      const mr = this.mirofish.simulateInline({
        primaryAngle: angleSlug,
        goal:         dto.goal ?? 'conversion',
        emotion:      'confident',
        format:       dto.format,
      });
      mirofishConfidence = mr.learning_signal_strength;
    } catch { /* 0 is safe fallback */ }

    // Routing context
    const memoryStability    = Math.max(0.10, 0.85 - fatigueScore * 0.60);
    const explorationEntropy = (
      fatigueState === 'HEALTHY'  ? 0.20 :
      fatigueState === 'WARMING'  ? 0.40 :
      fatigueState === 'FATIGUED' ? 0.65 : 0.82
    );

    const routingCtx: RoutingContext = {
      clientId:           campaignId,
      goal:               (dto.goal as RoutingContext['goal']) ?? 'conversion',
      fatigueState,
      memoryStability,
      explorationEntropy,
      trendPressure:      0,
      mirofishConfidence,
    };

    const routingDecision = this.smartRouting.decide(routingCtx);

    const modeDecision = decideMode(
      { scene_type: 'hook', pacing: 'moderate', platform: dto.platform, emotion: 'confident' },
      routingDecision,
    );

    const creativePlan = buildMinimalPlan(dto, angleSlug, campaignId, concept.id);

    const executionInput: GatewayExecutionInput = {
      format:            dto.format as 'video' | 'carousel' | 'banner',
      campaignId,
      conceptId:         concept.id,
      angleSlug,
      styleContext:      dto.styleContext ?? '',
      keyObjection:      concept.keyObjection  ?? undefined,
      valueProposition:  concept.valueProposition ?? undefined,
      executionMode:     modeDecision.mode,
      renderEngine:      modeDecision.model,
      modeReasoning:     modeDecision.reasoning,
      routingDecision,
      modelDecisions:    [modeDecision],
      creativePlan,
      durationTier:      dto.durationTier ?? 'SHORT',
      slideCount:        dto.slideCount   ?? 5,
      platform:          dto.platform,
      sizes:             dto.sizes        ?? ['1080x1080'],
      variantCount:      routingDecision.variantCount,
    };

    const result = await this.gateway.execute(executionInput, userId);

    return {
      creativeId: result.primaryCreativeId,
      angleSlug,
      format:     dto.format,
    };
  }
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function buildExplanation(
  angles:             RunAngleItem[],
  winner:             RunScoringItem | null,
  evolutionTriggered: boolean,
): string {
  const roles  = angles.map(a => a.role).join(', ');
  const count  = angles.length;
  const noun   = count === 1 ? 'creative' : 'creatives';
  const winPart = winner
    ? `Winner: ${winner.angleSlug} (score ${winner.totalScore}).`
    : 'No winner determined.';
  const evoNote = evolutionTriggered
    ? ' Evolution triggered to explore new angle variants.'
    : '';
  return `Generated ${count} video ${noun} across ${roles} strategies. ${winPart} Learning queued.${evoNote}`;
}
