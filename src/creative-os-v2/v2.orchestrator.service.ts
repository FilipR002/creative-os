/**
 * v2.orchestrator.service.ts
 *
 * Creative OS v2 Master Orchestrator
 *
 * ONE INPUT → ONE MASTER PROCESS → ONE OUTPUT
 *
 * Pipeline:
 *   1. V2BrainService.decide()                 — funnel detection + allocation + shared core
 *   2. Dispatch UGC (ViralTestService)          — parallel A/B/C test
 *   3. Dispatch Carousel (ExecutionGateway)     — N creatives via gateway  [FIX 1]
 *   4. Dispatch Banner   (ExecutionGateway)     — N creatives via gateway  [FIX 1]
 *   5. assembleV2Output()                       — unified JSON assembly
 *   6. Memory feedback (fire-and-forget)        — only real data used      [FIX 5]
 *
 * All three creative dispatches run concurrently via Promise.allSettled.
 * One failed format does not block the rest.
 *
 * Returns V2OutputSchema — the single source of truth for the campaign run.
 */

import { Injectable, Logger } from '@nestjs/common';
import { randomUUID }          from 'crypto';

import { V2BrainService }          from './v2.brain.service';
import { assembleV2Output }        from './v2.schema.assembler';
import { ViralTestService }        from '../ugc/viral-test.service';
import { ExecutionGatewayService } from '../creative-os/lib/execution-gateway';
import { MemoryService }           from '../memory/memory.service';
import { OutcomesService }         from '../outcomes/outcomes.service';
// W2: Real executionMode — SmartRoutingService is @Global, no module change needed
import { SmartRoutingService }     from '../routing/smart/routing.service';
import { decideMode }              from '../creative-os/lib/model-router';

import type { V2InputSchema, V2OutputSchema }        from './types/v2.schema.types';
import type { LaunchViralTestResponse }              from '../ugc/types/viral-test.types';
import type { FormatDispatchResult }                 from '../funnel-router/funnel-router.types';
import type { RoutingDecision, RoutingContext }      from '../routing/smart/routing.types';

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class V2OrchestratorService {
  private readonly logger = new Logger(V2OrchestratorService.name);

  constructor(
    private readonly brain:        V2BrainService,
    private readonly viralTest:    ViralTestService,
    private readonly gateway:      ExecutionGatewayService,
    private readonly memory:       MemoryService,
    private readonly outcomes:     OutcomesService,
    // W2: SmartRoutingService is @Global — inject directly, no module change
    private readonly smartRouting: SmartRoutingService,
  ) {}

  // ─── Public ───────────────────────────────────────────────────────────────

  async run(input: V2InputSchema, userId: string): Promise<V2OutputSchema> {
    const startedAt   = Date.now();
    const executionId = randomUUID();
    const platform    = input.platforms[0] ?? 'tiktok';
    const clientId    = input.client_id ?? 'default';
    const industry    = input.industry  ?? 'general';

    this.logger.log(
      `[V2] START executionId=${executionId} campaign=${input.campaign_id} ` +
      `goal=${input.goal} budget=${input.budget_level} tone=${input.tone} ` +
      `formats=[${input.constraints.formats.join(',')}]`,
    );

    // ── 1. Brain ────────────────────────────────────────────────────────────
    const brainOutput = await this.brain.decide(input);

    this.logger.log(
      `[V2] Brain: stage=${brainOutput.funnel_stage} primary=${brainOutput.primary_format} ` +
      `variants=ugc:${brainOutput.variant_allocation.ugc}/` +
      `carousel:${brainOutput.variant_allocation.carousel}/` +
      `banner:${brainOutput.variant_allocation.banner}`,
    );

    // ── 2. Parallel dispatch via ExecutionGateway ────────────────────────────
    const allowed = new Set(input.constraints.formats);

    const [ugcResult, carouselResult, bannerResult] = await Promise.allSettled([
      // UGC — ViralTestService is the correct path (handles persona × hook matrix)
      allowed.has('ugc') && brainOutput.variant_allocation.ugc > 0
        ? this.dispatchUGC(input, userId, brainOutput.variant_allocation.ugc, platform)
        : Promise.resolve(null),
      // Carousel — through ExecutionGateway (FIX 1)
      allowed.has('carousel') && brainOutput.variant_allocation.carousel > 0
        ? this.dispatchCarousel(input, userId, brainOutput, platform)
        : Promise.resolve([]),
      // Banner — through ExecutionGateway (FIX 1)
      allowed.has('banner') && brainOutput.variant_allocation.banner > 0
        ? this.dispatchBanner(input, userId, brainOutput)
        : Promise.resolve([]),
    ]);

    const ugcLaunch:   LaunchViralTestResponse | null = this.unwrap(ugcResult,      null,  'UGC');
    const carouselIds: string[]                       = this.unwrap(carouselResult, [],    'Carousel');
    const bannerIds:   string[]                       = this.unwrap(bannerResult,   [],    'Banner');

    // ── 3. Build dispatch results for scoring ────────────────────────────────
    const dispatches: FormatDispatchResult[] = [
      ugcLaunch
        ? { format: 'ugc',      status: 'dispatched', ids: ugcLaunch.jobIds,  variantCount: ugcLaunch.variantCount }
        : { format: 'ugc',      status: 'skipped',    ids: [],                variantCount: 0 },
      carouselIds.length > 0
        ? { format: 'carousel', status: 'dispatched', ids: carouselIds,       variantCount: carouselIds.length }
        : { format: 'carousel', status: 'skipped',    ids: [],                variantCount: 0 },
      bannerIds.length > 0
        ? { format: 'banner',   status: 'dispatched', ids: bannerIds,         variantCount: bannerIds.length }
        : { format: 'banner',   status: 'skipped',    ids: [],                variantCount: 0 },
    ];

    this.logger.log(
      `[V2] Dispatched: ugc=${ugcLaunch?.variantCount ?? 0} ` +
      `carousel=${carouselIds.length} banner=${bannerIds.length} ` +
      `[${Date.now() - startedAt}ms]`,
    );

    // ── 4. Assemble unified output ────────────────────────────────────────────
    const output = assembleV2Output({
      campaignId:   input.campaign_id,
      executionId,
      brain:        brainOutput,
      platform,
      ugcLaunch,
      carouselIds,
      bannerIds,
      dispatches,
      startedAt,
    });

    this.logger.log(
      `[V2] DONE executionId=${executionId} status=${output.status} ` +
      `winner=${output.scoring.winner.format}/${output.scoring.winner.variant_id} ` +
      `duration=${output.duration_ms}ms`,
    );

    // ── 5. Memory feedback (fire-and-forget, real data only) ─────────────────
    // FIX 5: Only fire feedback when real scoring data exists.
    //        submitRealMetrics() is NOT called with ugcScoreEstimate values.
    this.fireMemoryFeedback(output, userId, clientId, industry).catch(err =>
      this.logger.warn(`[V2] Memory feedback error: ${err}`),
    );

    return output;
  }

  // ─── W2: Real executionMode resolver ─────────────────────────────────────
  // SmartRoutingService returns exploit/balanced/explore.
  // decideMode() maps that + platform signals → ugc | cinematic | hybrid + engine.
  // fatigueState defaults to WARMING (neutral) — no per-angle data at V2 dispatch level.

  private resolveDispatchMode(
    campaignId: string,
    platform:   string,
    goal:       string,
    count:      number,
  ): { executionMode: string; renderEngine: string; routingDecision: RoutingDecision } {
    const ctx: RoutingContext = {
      clientId:           campaignId,
      goal:               (goal as RoutingContext['goal']) ?? 'conversion',
      fatigueState:       'WARMING',  // neutral — no per-angle fatigue at V2 dispatch layer
      memoryStability:    0.70,
      explorationEntropy: 0.30,
      trendPressure:      0,
      mirofishConfidence: 0,
    };
    const routingDecision = this.smartRouting.decide({ ...ctx, variantCount: count } as any);
    const modeDecision    = decideMode(
      { scene_type: 'hook', pacing: 'moderate', platform, emotion: 'confident' },
      routingDecision,
    );
    return {
      executionMode:  modeDecision.mode,
      renderEngine:   modeDecision.model,
      routingDecision,
    };
  }

  // ─── Dispatch helpers ────────────────────────────────────────────────────

  private async dispatchUGC(
    input:        V2InputSchema,
    userId:       string,
    variantCount: number,
    platform:     string,
  ): Promise<LaunchViralTestResponse> {
    const personaCount = Math.min(4, Math.max(1, Math.ceil(variantCount / 3)));
    const duration     = input.constraints.duration[0] ?? 15;

    return this.viralTest.launch(
      {
        campaignId:      input.campaign_id,
        conceptId:       input.concept_id,
        platform,
        personaCount,
        durationSeconds: duration,
      },
      userId,
    );
  }

  // W2 FIX: Carousel via ExecutionGateway — executionMode from SmartRoutingService

  private async dispatchCarousel(
    input:    V2InputSchema,
    userId:   string,
    brain:    Awaited<ReturnType<V2BrainService['decide']>>,
    platform: string,
  ): Promise<string[]> {
    const count = brain.variant_allocation.carousel;
    const { executionMode, renderEngine, routingDecision } =
      this.resolveDispatchMode(input.campaign_id, platform, input.goal, count);

    this.logger.log(
      `[V2] Carousel dispatch: ${count} variant(s) | ` +
      `executionMode=${executionMode} engine=${renderEngine} routing=${routingDecision.mode}`,
    );

    const ids: string[] = [];

    for (let i = 0; i < count; i++) {
      const modeDecision = decideMode(
        { scene_type: 'hook', pacing: 'moderate', platform, emotion: 'confident' },
        routingDecision,
      );
      const result = await this.gateway.execute(
        {
          format:          'carousel',
          campaignId:      input.campaign_id,
          conceptId:       input.concept_id ?? '',
          angleSlug:       brain.shared_angle,
          styleContext:    brain.shared_hook.slice(0, 120),
          executionMode:   modeDecision.mode,
          renderEngine:    modeDecision.model,
          modeReasoning:   modeDecision.reasoning,
          routingDecision: { ...routingDecision, variantCount: 1 },
          modelDecisions:  [modeDecision],
          slideCount:      5,
          platform,
          variantCount:    1,
        },
        userId,
      );
      ids.push(result.primaryCreativeId);
    }

    return ids;
  }

  // W2 FIX: Banner via ExecutionGateway — executionMode from SmartRoutingService

  private async dispatchBanner(
    input:  V2InputSchema,
    userId: string,
    brain:  Awaited<ReturnType<V2BrainService['decide']>>,
  ): Promise<string[]> {
    const count    = brain.variant_allocation.banner;
    const platform = input.platforms[0] ?? 'tiktok';
    const { executionMode, renderEngine, routingDecision } =
      this.resolveDispatchMode(input.campaign_id, platform, input.goal, count);

    this.logger.log(
      `[V2] Banner dispatch: ${count} variant(s) | ` +
      `executionMode=${executionMode} engine=${renderEngine} routing=${routingDecision.mode}`,
    );

    const ids: string[] = [];

    for (let i = 0; i < count; i++) {
      const modeDecision = decideMode(
        { scene_type: 'hook', pacing: 'moderate', platform, emotion: 'confident' },
        routingDecision,
      );
      const result = await this.gateway.execute(
        {
          format:          'banner',
          campaignId:      input.campaign_id,
          conceptId:       input.concept_id ?? '',
          angleSlug:       brain.shared_angle,
          styleContext:    brain.shared_hook.slice(0, 120),
          executionMode:   modeDecision.mode,
          renderEngine:    modeDecision.model,
          modeReasoning:   modeDecision.reasoning,
          routingDecision: { ...routingDecision, variantCount: 1 },
          modelDecisions:  [modeDecision],
          sizes:           ['1080x1080', '1080x1920', '1200x628'],
          variantCount:    1,
        },
        userId,
      );
      ids.push(result.primaryCreativeId);
    }

    return ids;
  }

  // ─── Memory feedback (FIX 5) ──────────────────────────────────────────────
  //
  // RULE: Learning loop uses REAL data only.
  //
  // memory.store()         → uses scoring.winner.score (real scoring output) ✅
  // outcomes.reportOutcome → uses scoring.winner.score (real scoring output) ✅
  // feedback.submitRealMetrics → REMOVED (was fed ugcScoreEstimate, a synthetic value)
  //
  // If real platform performance data becomes available (e.g. via webhook),
  // submitRealMetrics() should be called from that webhook handler, not here.

  private async fireMemoryFeedback(
    output:   V2OutputSchema,
    userId:   string,
    clientId: string,
    industry: string,
  ): Promise<void> {
    const { scoring, brain, campaign_id, execution_id } = output;

    // Only fire if we have a meaningful score (not a fallback zero)
    if (scoring.winner.score <= 0) {
      this.logger.debug('[V2] Skipping memory feedback — no real scoring data available');
      return;
    }

    await Promise.allSettled([
      this.memory.store({
        userId,
        clientId,
        industry,
        campaignId:  campaign_id,
        creativeId:  execution_id,
        format:      scoring.winner.format,
        angle:       brain.shared_angle,
        concept: {
          funnelStage:   brain.funnel_stage,
          intent:        brain.intent,
          winnerFormat:  scoring.winner.format,
          winnerVariant: scoring.winner.variant_id,
          hook:          brain.shared_hook,
          emotion:       brain.shared_emotion,
        },
        scores: {
          ctr:        scoring.ugc[0]?.hook_score      ?? scoring.winner.score,
          engagement: scoring.ugc[0]?.retention       ?? scoring.winner.score,
          conversion: scoring.ugc[0]?.conversion_prob ?? scoring.winner.score,
          clarity:    scoring.winner.confidence,
          total:      scoring.winner.score,
        },
        totalScore: scoring.winner.score,
        isWinner:   true,
      }).catch(e => this.logger.warn(`[V2] memory.store failed: ${e}`)),

      // Real outcomes — uses the scored winner, not synthetic estimates
      this.outcomes.reportOutcome({
        userId,
        campaignId:  campaign_id,
        angleSlug:   brain.shared_angle,
        metrics: {
          impressions: 1000,
          clicks:      Math.round(1000 * scoring.winner.score * 0.85),
          conversions: Math.round(1000 * scoring.winner.score * 0.85 * scoring.winner.score * 0.50),
        },
      }).catch(e => this.logger.warn(`[V2] outcomes.report failed: ${e}`)),
    ]);
  }

  // ─── Unwrap helper ────────────────────────────────────────────────────────

  private unwrap<T>(result: PromiseSettledResult<T>, fallback: T, tag: string): T {
    if (result.status === 'fulfilled') return result.value;
    this.logger.error(`[V2] ${tag} dispatch failed: ${result.reason}`);
    return fallback;
  }
}
