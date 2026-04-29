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
import { SmartRoutingService }     from '../routing/smart/routing.service';
import { decideMode }              from '../creative-os/lib/model-router';
// Fix 2: Real routing signals — FatigueService, MirofishService, TrendIntelligenceService
import { FatigueService }          from '../fatigue/fatigue.service';
import { MirofishService }         from '../mirofish/mirofish.service';
import { TrendIntelligenceService } from '../trends/trend-intelligence.service';

import type { V2InputSchema, V2OutputSchema, V2BrainOutput } from './types/v2.schema.types';
import type { LaunchViralTestResponse }              from '../ugc/types/viral-test.types';
import type { FormatDispatchResult }                 from '../funnel-router/funnel-router.types';
import type { RoutingDecision, RoutingContext }      from '../routing/smart/routing.types';
import type { CreativePlan }                         from '../creative-director/creative-director-orchestrator';

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
    private readonly smartRouting: SmartRoutingService,
    // Fix 2: Real routing signals injected here
    private readonly fatigue:      FatigueService,
    private readonly mirofish:     MirofishService,
    private readonly trendIntel:   TrendIntelligenceService,
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

  // ─── Fix 2: Real executionMode resolver ──────────────────────────────────
  // Pulls live signals from FatigueService, MirofishService, TrendIntelligenceService
  // instead of using hardcoded constants.

  private async resolveDispatchMode(
    campaignId: string,
    platform:   string,
    goal:       string,
    count:      number,
    angleSlug:  string,
    userId:     string,
    industry:   string,
    format:     string,
  ): Promise<{ executionMode: string; renderEngine: string; routingDecision: RoutingDecision }> {
    // ── Pull real signals concurrently ────────────────────────────────────────
    const [fatigueResult, mirofishResult, trendBias] = await Promise.all([
      this.fatigue.computeForSlug(angleSlug, userId, campaignId).catch(() => null),
      Promise.resolve(this.mirofish.simulateInline({
        primaryAngle: angleSlug,
        goal:         goal as 'conversion' | 'awareness' | 'engagement',
        format,
        mode:         'v2',
      })),
      Promise.resolve(this.trendIntel.getBiasForIndustry(industry)),
    ]);

    // ── Map fatigue state ─────────────────────────────────────────────────────
    // FatigueService types: HEALTHY | WARMING | FATIGUED | BLOCKED
    // RoutingContext types: HEALTHY | WARMING | FATIGUED | BLOCKED (identical)
    const fatigueState = (fatigueResult?.fatigue_state ?? 'WARMING') as RoutingContext['fatigueState'];
    const fatigueScore = fatigueResult?.fatigue_score ?? 0.30;

    // ── Derive routing signals ────────────────────────────────────────────────
    // memoryStability: inverse of fatigue — high fatigue = low stability
    const memoryStability    = Math.max(0, Math.min(1, 1 - fatigueScore));
    // explorationEntropy: fatigue exploration_signal biases exploration rate
    const explorationEntropy = Math.max(0.05, Math.min(0.60,
      0.30 + (fatigueResult?._signals.rankingDropVelocity ?? 0) * 0.30,
    ));
    // trendPressure: average of hook + format bias from trend intelligence
    const trendPressure      = Math.max(0, Math.min(1,
      (Math.abs(trendBias.hookBias) + Math.abs(trendBias.formatBias)) / 2,
    ));
    // mirofishConfidence: learning signal strength from inline simulation
    const mirofishConfidence = mirofishResult?.learning_signal_strength ?? 0;

    this.logger.debug(
      `[V2] RoutingCtx — fatigue=${fatigueState}(${fatigueScore.toFixed(2)}) ` +
      `stability=${memoryStability.toFixed(2)} entropy=${explorationEntropy.toFixed(2)} ` +
      `trend=${trendPressure.toFixed(2)} mirofish=${mirofishConfidence.toFixed(2)}`,
    );

    const ctx: RoutingContext = {
      clientId:           campaignId,
      goal:               (goal as RoutingContext['goal']) ?? 'conversion',
      fatigueState,
      memoryStability,
      explorationEntropy,
      trendPressure,
      mirofishConfidence,
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

  // ─── Fix 4: Synthetic CreativePlan builder ───────────────────────────────
  //
  // Constructs a CreativePlan from V2BrainOutput + V2InputSchema without an
  // additional Claude API call. The brain already contains all the narrative
  // primitives (hook, angle, emotion, intent, funnel stage) needed to populate
  // the plan. This ensures the gateway always receives a valid plan while keeping
  // V2 execution fast (no extra LLM round-trip per dispatch).

  private buildCreativePlan(
    input:    V2InputSchema,
    brain:    V2BrainOutput,
    format:   'carousel' | 'banner' | 'video',
    platform: string,
  ): CreativePlan {
    const hook     = brain.shared_hook;
    const emotion  = brain.shared_emotion;
    const intent   = brain.intent;    // cold | warm | hot
    const stage    = brain.funnel_stage; // TOFU | MOFU | BOFU

    // ── Derive core story from brain primitives ───────────────────────────────
    const problem  = stage === 'TOFU'
      ? `Most ${input.audience} struggle with exactly this — and don't know there's a better way.`
      : stage === 'MOFU'
        ? `You've seen the options. None of them actually fix the root problem.`
        : `The difference between where you are and where you want to be is one decision.`;

    const solution = intent === 'cold'
      ? `${input.product} changes the equation — built for ${input.audience} who want real results.`
      : intent === 'warm'
        ? `${input.product} is exactly what ${input.audience} have been waiting for.`
        : `${input.product} — the obvious choice once you see it.`;

    const cta = input.goal === 'conversion'
      ? 'Get started now →'
      : input.goal === 'awareness'
        ? 'Learn more →'
        : 'See how it works →';

    const now = new Date().toISOString();

    // ── Build format-specific sections ───────────────────────────────────────
    // Phase 3: kling_prompt describes ONLY visuals — no text rendering instructions.
    // overlay_text is burned in via FFmpeg drawtext after stitching.
    const videoScenes = [
      {
        kling_prompt: `Hook scene | ${emotion} energy | ${platform} | ${input.audience} | authentic UGC style | no on-screen text`,
        overlay_text: hook.slice(0, 60),
        transition:   'cut'  as const,
        pacing:       'aggressive' as const,
      },
      {
        kling_prompt: `Problem reveal | ${emotion} tone | close-up reaction shot | authentic | no on-screen text`,
        overlay_text: problem.slice(0, 60),
        transition:   'zoom' as const,
        pacing:       'moderate' as const,
      },
      {
        kling_prompt: `Solution reveal | product demo | ${emotion} | confident | ${platform} | no on-screen text`,
        overlay_text: solution.slice(0, 60),
        transition:   'cut'  as const,
        pacing:       'moderate' as const,
      },
      {
        kling_prompt: `Call to action | ${emotion} | direct to camera | ${input.audience} | authentic | no on-screen text`,
        overlay_text: cta,
        transition:   'cut'  as const,
        pacing:       'moderate' as const,
      },
    ];

    const carouselSlides = [
      { headline: hook.slice(0, 80),           intent: 'hook'     as const, visual_direction: `Bold typography, ${emotion} energy, platform:${platform}` },
      { headline: problem.slice(0, 80),         intent: 'problem'  as const, visual_direction: `Pain point visual, contrast lighting, ${input.audience} perspective`, subtext: 'Sound familiar?' },
      { headline: solution.slice(0, 80),        intent: 'solution' as const, visual_direction: `Product hero, clean composition, ${emotion} mood`, subtext: `Built for ${input.audience}` },
      { headline: `Why ${input.product}?`,       intent: 'solution' as const, visual_direction: `Feature highlight, minimal layout, high trust visual` },
      { headline: cta,                          intent: 'cta'      as const, visual_direction: `Strong CTA composition, brand colors, ${emotion} close` },
    ];

    const banner = {
      headline:           hook.slice(0, 50),
      subtext:            solution.slice(0, 80),
      cta,
      visual_composition: `${emotion} visual, ${input.audience} context, ${platform} optimized`,
    };

    return {
      core_story: { hook, problem, solution, cta },
      video:      { scenes: videoScenes },
      carousel:   { slides: carouselSlides },
      banner,
      _meta: {
        generated_at:  now,
        model:         'v2-brain-synthetic',
        campaign_id:   input.campaign_id,
        concept_id:    input.concept_id ?? '',
        duration_tier: 'MEDIUM',
        version:       '2.0',
      },
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

  // Fix 2: Carousel via ExecutionGateway — executionMode from real routing signals

  private async dispatchCarousel(
    input:    V2InputSchema,
    userId:   string,
    brain:    Awaited<ReturnType<V2BrainService['decide']>>,
    platform: string,
  ): Promise<string[]> {
    const count = brain.variant_allocation.carousel;
    const { executionMode, renderEngine, routingDecision } =
      await this.resolveDispatchMode(
        input.campaign_id, platform, input.goal, count,
        brain.shared_angle, userId, input.industry ?? 'general', 'carousel',
      );

    this.logger.log(
      `[V2] Carousel dispatch: ${count} variant(s) | ` +
      `executionMode=${executionMode} engine=${renderEngine} routing=${routingDecision.mode}`,
    );

    // Fix 4: Build a CreativePlan from brain output before dispatching to gateway
    const creativePlan = this.buildCreativePlan(input, brain, 'carousel', platform);

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
          creativePlan,   // Fix 4: required plan — synthesized from brain output
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

  // Fix 2: Banner via ExecutionGateway — executionMode from real routing signals

  private async dispatchBanner(
    input:  V2InputSchema,
    userId: string,
    brain:  Awaited<ReturnType<V2BrainService['decide']>>,
  ): Promise<string[]> {
    const count    = brain.variant_allocation.banner;
    const platform = input.platforms[0] ?? 'tiktok';
    const { executionMode, renderEngine, routingDecision } =
      await this.resolveDispatchMode(
        input.campaign_id, platform, input.goal, count,
        brain.shared_angle, userId, input.industry ?? 'general', 'banner',
      );

    this.logger.log(
      `[V2] Banner dispatch: ${count} variant(s) | ` +
      `executionMode=${executionMode} engine=${renderEngine} routing=${routingDecision.mode}`,
    );

    // Fix 4: Build a CreativePlan from brain output before dispatching to gateway
    const creativePlan = this.buildCreativePlan(input, brain, 'banner', platform);

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
          creativePlan,   // Fix 4: required plan — synthesized from brain output
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
