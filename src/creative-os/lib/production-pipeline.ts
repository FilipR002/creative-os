/**
 * production-pipeline.ts
 *
 * Self-optimising creative production engine for the Creative OS generation module.
 *
 * Canonical execution chain (enforced — no bypasses allowed):
 *
 *   INPUT
 *   → 1.  Fetch Creative DNA context              (CreativeDNAService)
 *   → 2.  Resolve routing signals                 (FatigueService + MirofishService + TrendIntelligenceService)
 *   → 3.  Derive routing decision                 (SmartRoutingService.decide())
 *   → 4.  Extract + optimise scenes               (scene-optimizer: hook-boost + rewrite + DNA)
 *   → 5.  Decide execution mode per scene         (model-router: ugc | cinematic | hybrid)
 *   → 6.  Execute via ExecutionGatewayService     (ONLY entry point for rendering)
 *   → 7.  Score all variants                      (ScoringService)
 *   → 8.  Select winner                           (AutoWinnerService)
 *   → 9.  Report outcomes + learning              (OutcomesService + LearningService — fire-and-forget)
 *   → 10. Return PipelineResult with full ExecutionTrace
 *
 * Hard rules:
 *   ✘ No direct VideoService / CarouselService / BannerService calls
 *   ✘ No hardcoded routing values — ALL signals are data-driven
 *   ✘ No parallel pipelines outside this chain
 *   ✔ ALL rendering goes through ExecutionGatewayService.execute()
 *   ✔ Every execution produces a complete ExecutionTrace
 *   ✔ RoutingDecision is fully propagated into the trace + execution payload
 */

import { Injectable, Logger } from '@nestjs/common';

import { SmartRoutingService }       from '../../routing/smart/routing.service';
import { HookBoosterService }        from '../../hook-booster/hook-booster.service';
import { SceneRewriterService }      from '../../scene-rewriter/scene-rewriter.service';
import { CreativeDNAService }        from '../../creative-dna/creative-dna.service';
import { FatigueService }            from '../../fatigue/fatigue.service';
import { MirofishService }           from '../../mirofish/mirofish.service';
import { TrendIntelligenceService }  from '../../trends/trend-intelligence.service';
import { ScoringService }            from '../../scoring/scoring.service';
import { AutoWinnerService }         from '../../auto-winner/auto-winner.service';
import { OutcomesService }           from '../../outcomes/outcomes.service';
import { LearningService }           from '../../learning/learning.service';
// FIX 7: PrismaService injected for blueprint persistence
import { PrismaService }             from '../../prisma/prisma.service';

import { ExecutionGatewayService }   from './execution-gateway';

import type { MasterBlueprint }               from '../sonnet-orchestrator';
import type { ExecutionDiagnostics }          from '../execution-mapper';
import { mapBlueprintToGenerationPayload }    from '../execution-mapper';
import type { CreativePlan }                  from '../../creative-director/creative-director-orchestrator';

import {
  decideMode,
  tallyModeUsage,
  type ModelDecision,
  type ModeUsageStats,
} from './model-router';

import {
  optimizeSceneSet,
  blueprintToVirtualScenes,
  creativePlanVideoScenesToRaw,
  creativePlanCarouselSlidesToRaw,
  scenesToStyleContext,
  type RawScene,
  type OptimizedScene,
} from './scene-optimizer';

import type { RoutingContext, RoutingDecision } from '../../routing/smart/routing.types';
import type { AngleFatigueResult }              from '../../fatigue/fatigue.types';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface PipelineInput {
  blueprint:       MasterBlueprint;
  campaignId:      string;
  conceptId:       string;
  userId:          string;
  angleSlug:       string;
  diagnostics:     ExecutionDiagnostics;
  validationFixes: string[];
  concept: {
    emotion:  string;
    platform: string;
    audience: string;
    goal:     string;
  };
  /**
   * Full multi-format plan from Creative Director Brain.
   * Fix 4: creativePlan is now REQUIRED — the gateway enforces it at runtime.
   * Callers must generate a plan via CreativeDirectorService before invoking
   * the pipeline. The pipeline throws if creativePlan is missing.
   */
  creativePlan: CreativePlan;
}

/**
 * ExecutionTrace — canonical per-execution audit record.
 *
 * REQUIRED: every field must be populated before the pipeline returns.
 * Missing any field → treated as an execution fault.
 */
export interface ExecutionTrace {
  // ── Identity ───────────────────────────────────────────────────────────────
  campaignId:       string;
  /** Synthetic ID derived from blueprint metadata for traceability */
  blueprintId:      string;

  // ── Creative Director ──────────────────────────────────────────────────────
  creativePlanUsed: boolean;
  /**
   * Where the execution scenes were sourced from.
   * 'creativePlan' = real planned scenes from Creative Director Brain (correct).
   * 'blueprint'    = virtual scenes derived from Blueprint (fallback — only valid
   *                  when no CreativePlan was available).
   */
  sceneSource: 'creativePlan' | 'blueprint';
  /**
   * True when blueprint-derived virtual scenes were used.
   * INVALID if this is true AND creativePlanUsed is also true — that means
   * a CreativePlan existed but was ignored.
   */
  blueprintFallbackUsed: boolean;

  // ── Routing — full decision object, not a summary ─────────────────────────
  routingDecision:  RoutingDecision;

  // ── Execution mode — top-level, not buried in scenes[] ────────────────────
  executionMode:    string;   // ugc | cinematic | hybrid
  modelUsed:        string;   // kling | veo | mixed

  // ── Output ─────────────────────────────────────────────────────────────────
  creativeIds:      string[];

  // ── Mode routing confirmation (mandatory — FAIL if false) ─────────────────
  /** True IFF mode-based branching was enforced inside ExecutionGatewayService */
  modeApplied:  boolean;
  /** True IFF render engine was determined by routing (not overridden/dropped) */
  modelApplied: boolean;
  /**
   * Actual engines used across all variants.
   * ugc-only    → ['kling']
   * cinematic   → ['veo']
   * hybrid      → ['kling', 'veo']
   */
  engineUsed:   string[];

  // ── Pipeline completion flags ──────────────────────────────────────────────
  scoringTriggered:  boolean;
  learningTriggered: boolean;
}

/**
 * PipelineTrace — extended diagnostic record.
 * Embeds the canonical ExecutionTrace and adds granular diagnostics.
 */
export interface PipelineTrace extends ExecutionTrace {
  // ── Signal breakdown ───────────────────────────────────────────────────────
  routingSignals: {
    fatigueState:       string;
    explorationEntropy: number;
    memoryStability:    number;
    mirofishConfidence: number;
    trendPressure:      number;
  };

  // ── Per-scene decisions ────────────────────────────────────────────────────
  scenes: Array<{
    scene_type?:      string;
    mode:             string;
    model:            string;
    optimization_log: string[];
  }>;

  // ── Context flags ──────────────────────────────────────────────────────────
  dnaContext: boolean;

  // ── Execution detail ───────────────────────────────────────────────────────
  execution: {
    service:      string;
    variantCount: number;
    creativeIds:  string[];
  };

  // ── Scoring ────────────────────────────────────────────────────────────────
  scoring: {
    totalScore: number;
    ctrScore:   number;
    engagement: number;
    conversion: number;
  };

  // ── Winner ─────────────────────────────────────────────────────────────────
  winner: { id: string; final_score: number } | null;

  // ── Learning detail ────────────────────────────────────────────────────────
  learning: {
    outcomesReported:      boolean;
    learningCycleTriggered: boolean;
  };
}

export interface PipelineResult {
  executionId:     string;
  campaignId:      string;
  creativeId:      string;
  format:          string;
  angleSlug:       string;
  bestCreative:    { creativeId: string; score: number; isWinner: boolean };
  score:           number;
  modeUsage:       ModeUsageStats;
  diagnostics:     ExecutionDiagnostics;
  blueprintMeta:   MasterBlueprint['_meta'];
  validationFixes: string[];
  /** Canonical execution trace — every field is always populated */
  pipelineTrace:   PipelineTrace;
}

// ─── Fatigue → entropy lookup ─────────────────────────────────────────────────

type FatigueState = AngleFatigueResult['fatigue_state'];

const ENTROPY_BY_FATIGUE: Record<FatigueState, { fast: number; normal: number }> = {
  HEALTHY:  { fast: 0.40, normal: 0.20 },
  WARMING:  { fast: 0.55, normal: 0.40 },
  FATIGUED: { fast: 0.65, normal: 0.65 },
  BLOCKED:  { fast: 0.82, normal: 0.82 },
};

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class ProductionPipelineService {
  private readonly logger = new Logger(ProductionPipelineService.name);

  constructor(
    // ── Routing ────────────────────────────────────────────────────────────
    // @Global() — no module import needed
    private readonly routing:     SmartRoutingService,
    private readonly trendIntel:  TrendIntelligenceService,

    // ── Scene optimisation ─────────────────────────────────────────────────
    private readonly hookBooster:   HookBoosterService,
    private readonly sceneRewriter: SceneRewriterService,
    private readonly creativeDna:   CreativeDNAService,

    // ── Live routing signals — replaces ALL hardcoded constants ───────────
    private readonly fatigue:   FatigueService,
    private readonly mirofish:  MirofishService,

    // ── Canonical execution gateway (ONLY renderer entry point) ───────────
    private readonly gateway:   ExecutionGatewayService,

    // ── Post-execution ─────────────────────────────────────────────────────
    private readonly scoring:    ScoringService,
    private readonly autoWinner: AutoWinnerService,
    private readonly outcomes:   OutcomesService,
    private readonly learning:   LearningService,

    // FIX 7: Blueprint persistence
    private readonly prisma:     PrismaService,
  ) {}

  // ─── Main entry ─────────────────────────────────────────────────────────────

  async run(input: PipelineInput): Promise<PipelineResult> {
    const { blueprint, userId, concept } = input;
    const t0 = Date.now();

    // ── STEP 1 — Creative DNA context ────────────────────────────────────────
    let dnaContext: string | null = null;
    try {
      dnaContext = await this.creativeDna.getDNAPromptContext(3);
    } catch {
      this.logger.warn('[Pipeline] CreativeDNA fetch failed — continuing without DNA injection');
    }

    // ── STEP 2 — Live routing signals (data-driven, no hardcoded constants) ──
    //
    // Signal 1: Angle fatigue (FatigueService)
    // W4 FIX: Default is WARMING (neutral), never HEALTHY.
    // HEALTHY implies the system is confident fatigue data was loaded — it wasn't.
    // WARMING is conservative-neutral: it increases exploration slightly without
    // pretending the angle is fresh. Routing treats it correctly.
    let fatigueResult: AngleFatigueResult = {
      angle_name:           blueprint.angle_slug,
      fatigue_state:        'WARMING',
      fatigue_score:        0.30,   // mid-low: neutral, not optimistic
      probability_modifier: -0.10,  // slight conservative penalty
      exploration_signal:   0.05,
      reasoning:            'WARMING — FatigueService unavailable, using neutral fallback',
      _signals: {
        usageFrequency:        0,
        performanceDecay:      0,
        mirofishNegativeDelta: 0,
        blendingRepetition:    0,
        rankingDropVelocity:   0,
      },
    };
    try {
      fatigueResult = await this.fatigue.computeForSlug(blueprint.angle_slug, userId);
    } catch (err) {
      this.logger.warn(
        `[Pipeline] FatigueService failed for angle=${blueprint.angle_slug} — ` +
        `using WARMING (neutral) fallback, NOT HEALTHY. Reason: ${(err as Error).message}`,
      );
    }

    // Signal 2: MIROFISH prediction confidence
    let mirofishConfidence = 0;
    try {
      const miroResult = this.mirofish.simulateInline({
        primaryAngle: blueprint.angle_slug,
        goal:         concept.goal,
        emotion:      concept.emotion,
        format:       blueprint.format,
      });
      mirofishConfidence = miroResult.learning_signal_strength;
    } catch {
      this.logger.warn('[Pipeline] MirofishService failed — confidence set to 0 (conservative)');
    }

    // Signal 3: Industry trend pressure (TrendIntelligenceService — @Global)
    //   Uses concept.platform as industry proxy; falls back to ZERO_BIAS gracefully.
    let trendPressure = 0;
    try {
      const bias = this.trendIntel.getBiasForIndustry(concept.platform ?? '');
      // Mean of three clamped [0,1] components → trendPressure in [0,1]
      trendPressure = (bias.hookBias + bias.ctaBias + bias.formatBias) / 3;
    } catch {
      this.logger.warn('[Pipeline] TrendIntelligenceService failed — trendPressure set to 0');
    }

    // Derived signals
    const isFastPacing = blueprint.style_dna.pacing === 'fast';
    const entropyTable = ENTROPY_BY_FATIGUE[fatigueResult.fatigue_state] ?? ENTROPY_BY_FATIGUE.HEALTHY;
    const explorationEntropy = isFastPacing ? entropyTable.fast : entropyTable.normal;
    const memoryStability    = Math.max(0.10, 0.85 - fatigueResult.fatigue_score * 0.60);

    // ── STEP 3 — Routing decision ────────────────────────────────────────────
    const routingCtx: RoutingContext = {
      clientId:           input.campaignId,
      goal:               (concept.goal as RoutingContext['goal']) ?? 'conversion',
      fatigueState:       fatigueResult.fatigue_state,
      memoryStability,
      explorationEntropy,
      trendPressure,
      mirofishConfidence,
    };
    const routingDecision: RoutingDecision = this.routing.decide(routingCtx);

    this.logger.log(
      `[Pipeline] Routing decision: mode=${routingDecision.mode} ` +
      `hooks=${routingDecision.hookAggressiveness} variants=${routingDecision.variantCount} ` +
      `risk=${routingDecision.riskTolerance.toFixed(2)} | ` +
      `fatigue=${fatigueResult.fatigue_state} entropy=${explorationEntropy.toFixed(2)} ` +
      `trend=${trendPressure.toFixed(2)} mirofish=${mirofishConfidence.toFixed(2)}`,
    );

    // ── STEP 4 — Scene extraction + optimisation ─────────────────────────────
    //
    // AUTHORITY RULE:
    //   1. CreativePlan (HIGHEST)  — use when available for video / carousel
    //   2. Blueprint   (FALLBACK)  — used only when CreativePlan is absent
    //                                OR format is banner (no scene array in plan)
    //
    // Blueprint virtual scenes are NEVER used when a CreativePlan exists for
    // that format. Using them in that case would silently discard the Creative
    // Director's hook precision, scene ordering, and narrative structure.

    const canUseCreativePlan = (
      input.creativePlan !== undefined &&
      (blueprint.format === 'video' || blueprint.format === 'carousel')
    );

    let rawScenes: RawScene[];
    let sceneSource: 'creativePlan' | 'blueprint';

    if (canUseCreativePlan) {
      // ── PRIMARY PATH — real scenes from Creative Director Brain ─────────────
      sceneSource = 'creativePlan';

      if (blueprint.format === 'video') {
        rawScenes = creativePlanVideoScenesToRaw(input.creativePlan!.video.scenes);
        this.logger.log(
          `[Pipeline] Scene source: CreativePlan (video) — ${rawScenes.length} scenes`,
        );
      } else {
        // carousel
        rawScenes = creativePlanCarouselSlidesToRaw(input.creativePlan!.carousel.slides);
        this.logger.log(
          `[Pipeline] Scene source: CreativePlan (carousel) — ${rawScenes.length} slides`,
        );
      }
    } else {
      // ── FALLBACK PATH — blueprint-derived virtual scenes ─────────────────────
      sceneSource = 'blueprint';
      rawScenes   = blueprintToVirtualScenes(blueprint);

      if (input.creativePlan !== undefined) {
        // CreativePlan exists for this format but we still fell through — warn loudly
        this.logger.warn(
          `[Pipeline] SCENE SOURCE FALLBACK: CreativePlan present but format="${blueprint.format}" ` +
          `has no scene array — using blueprint virtual scenes. ` +
          `This is valid only for banner format.`,
        );
      } else {
        this.logger.log(
          `[Pipeline] Scene source: Blueprint fallback (no CreativePlan available) — ` +
          `${rawScenes.length} virtual scenes`,
        );
      }
    }

    const blueprintFallbackUsed = sceneSource === 'blueprint';

    const optimizedScenes: OptimizedScene[] = optimizeSceneSet(
      rawScenes,
      {
        angleSlug:  blueprint.angle_slug,
        emotion:    concept.emotion,
        goal:       concept.goal,
        format:     blueprint.format,
        platform:   concept.platform,
        dnaContext,
      },
      { hookBooster: this.hookBooster, sceneRewriter: this.sceneRewriter },
    );

    // ── STEP 5 — Per-scene mode decisions ────────────────────────────────────
    const modelDecisions: ModelDecision[] = rawScenes.map((s, i) =>
      decideMode(
        {
          scene_type: s.scene_type ?? (i === 0 ? 'hook' : 'solution'),
          pacing:     (s.pacing ?? 'moderate') as 'aggressive' | 'moderate',
          platform:   concept.platform,
          emotion:    concept.emotion,
        },
        routingDecision,
      ),
    );
    const modeUsage = tallyModeUsage(modelDecisions);

    // Primary (first-scene) decision drives top-level executionMode + modelUsed
    const primaryDecision = modelDecisions[0] ?? {
      mode:       'ugc'   as const,
      model:      'kling' as const,
      confidence: 0.50,
      reasoning:  'no-scenes fallback',
    };

    this.logger.log(
      `[Pipeline] Scenes: total=${optimizedScenes.length} ` +
      `ugc=${modeUsage.ugc} cinematic=${modeUsage.cinematic} hybrid=${modeUsage.hybrid} ` +
      `primary=${primaryDecision.mode}/${primaryDecision.model}`,
    );

    // ── STEP 6 — Execution via gateway (ONLY render entry point) ────────────
    const mapped = mapBlueprintToGenerationPayload(blueprint);
    const enrichedStyleContext = scenesToStyleContext(
      mapped.payload.styleContext ?? '',
      optimizedScenes,
    );

    const gatewayResult = await this.gateway.execute(
      {
        format:            mapped.format as 'video' | 'carousel' | 'banner',
        campaignId:        mapped.payload.campaignId,
        conceptId:         mapped.payload.conceptId,
        angleSlug:         mapped.payload.angleSlug,
        styleContext:      enrichedStyleContext,
        keyObjection:      mapped.payload.keyObjection,
        valueProposition:  mapped.payload.valueProposition,

        // Full routing context — propagated into gateway styleContext
        executionMode:    primaryDecision.mode,
        renderEngine:     primaryDecision.model,
        modeReasoning:    primaryDecision.reasoning,
        routingDecision,
        modelDecisions,

        // Creative Director plan — first-class input
        creativePlan:  input.creativePlan,

        // Format-specific
        durationTier:  (mapped.payload as any).durationTier,
        slideCount:    (mapped.payload as any).slideCount,
        platform:      (mapped.payload as any).platform ?? concept.platform,
        sizes:         (mapped.payload as any).sizes,

        // variantCount driven by routing decision — honoured, not capped at 1
        variantCount:  routingDecision.variantCount,
      },
      userId,
    );

    const creativeId     = gatewayResult.primaryCreativeId;
    const allCreativeIds = gatewayResult.creatives.map(c => c.creativeId);

    this.logger.log(
      `[Pipeline] Generation complete | primary=${creativeId} variants=${allCreativeIds.length}`,
    );

    // ── STEP 7 — Score all variants ──────────────────────────────────────────
    let scoreResult = {
      totalScore: 0,
      ctrScore:   0,
      engagement: 0,
      conversion: 0,
      isWinner:   false,
    };
    let scoringTriggered = false;
    try {
      const scores = await this.scoring.evaluate(allCreativeIds);
      scoringTriggered = true;
      const primary = scores.find(s => s.creativeId === creativeId) ?? scores[0];
      if (primary) {
        scoreResult = {
          totalScore: primary.totalScore,
          ctrScore:   primary.ctrScore,
          engagement: primary.engagement,
          conversion: primary.conversion,
          isWinner:   primary.isWinner,
        };
      }
      this.logger.log(
        `[Pipeline] Score: total=${scoreResult.totalScore.toFixed(3)} ` +
        `ctr=${scoreResult.ctrScore.toFixed(3)} conv=${scoreResult.conversion.toFixed(3)}`,
      );
    } catch (err) {
      this.logger.warn(`[Pipeline] Scoring failed (non-blocking): ${(err as Error).message}`);
    }

    // ── STEP 8 — Winner selection ────────────────────────────────────────────
    let winnerResult: { id: string; final_score: number } | null = null;
    try {
      const winnerOutput = this.autoWinner.evaluate({
        format:            blueprint.format,
        creative_variants: allCreativeIds.map(id => ({
          id,
          content: {},
          performance_data: {
            ctr:        scoreResult.ctrScore,
            retention:  scoreResult.engagement,
            conversion: scoreResult.conversion,
            clarity:    scoreResult.totalScore,
          },
        })),
        angle_context: { primary: blueprint.angle_slug },
        performance_signals: Object.fromEntries(
          allCreativeIds.map(id => [id, {
            ctr:        scoreResult.ctrScore,
            retention:  scoreResult.engagement,
            conversion: scoreResult.conversion,
          }]),
        ),
      });
      winnerResult = winnerOutput.winner;
      this.logger.log(
        `[Pipeline] Winner: id=${winnerResult.id} score=${winnerResult.final_score}`,
      );
    } catch (err) {
      this.logger.warn(`[Pipeline] AutoWinner failed (non-blocking): ${(err as Error).message}`);
    }

    // ── STEP 9 — Outcomes reporting + learning ────────────────────────────────
    // FIX 8: Await both operations before assembling the PipelineTrace so
    // outcomesReported and learningCycleTriggered flags reflect actual completion.

    let outcomesReported = false;
    if (scoreResult.totalScore > 0) {
      const syntheticImpressions = 120;
      const syntheticClicks      = Math.max(1, Math.round(scoreResult.ctrScore * syntheticImpressions));
      const syntheticConversions = Math.max(0, Math.round(scoreResult.conversion * syntheticClicks));

      try {
        await this.outcomes.reportOutcome({
          userId,
          campaignId:  input.campaignId,
          angleSlug:   blueprint.angle_slug,
          metrics: {
            impressions:  syntheticImpressions,
            clicks:       syntheticClicks,
            conversions:  syntheticConversions,
          },
        });
        outcomesReported = true;
        this.logger.log(`[Pipeline] Outcomes reported for angle=${blueprint.angle_slug}`);
      } catch (err) {
        this.logger.warn(`[Pipeline] Outcomes report failed: ${(err as Error).message}`);
      }
    }

    let learningCycleTriggered = false;
    try {
      await this.learning.runCycle(input.campaignId);
      learningCycleTriggered = true;
      this.logger.log(`[Pipeline] Learning cycle triggered for campaign=${input.campaignId}`);
    } catch (err) {
      this.logger.warn(`[Pipeline] Learning cycle failed: ${(err as Error).message}`);
    }

    // ── STEP 10 — Build canonical ExecutionTrace and return ──────────────────
    const elapsed = Date.now() - t0;
    this.logger.log(`[Pipeline] Complete in ${elapsed}ms`);

    // W5 FIX: Blueprint MUST be persisted with a real DB-assigned UUID.
    // Synthetic IDs are not queryable and mask persistence failures silently.
    // If DB write fails → throw. Pipeline MUST NOT return without a real blueprintId.
    const savedBlueprint = await this.prisma.blueprint.create({
      data: {
        campaignId: input.campaignId,
        conceptId:  input.conceptId || undefined,
        format:     blueprint.format,
        angleSlug:  blueprint.angle_slug,
        data:       blueprint as any,
      },
    });
    const blueprintId = savedBlueprint.id;
    this.logger.log(`[Pipeline] Blueprint persisted id=${blueprintId}`);

    const pipelineTrace: PipelineTrace = {
      // ── Canonical ExecutionTrace fields (all REQUIRED) ───────────────────
      campaignId:       input.campaignId,
      blueprintId,
      creativePlanUsed:      input.creativePlan !== undefined,
      sceneSource,
      blueprintFallbackUsed,
      routingDecision,                          // full RoutingDecision object
      executionMode:    primaryDecision.mode,   // top-level — ugc | cinematic | hybrid
      modelUsed:        primaryDecision.model,  // top-level — kling | veo | mixed
      creativeIds:      allCreativeIds,

      // Mode application confirmation — sourced directly from gateway result
      modeApplied:  gatewayResult.modeApplied,
      modelApplied: gatewayResult.modelApplied,
      engineUsed:   gatewayResult.enginesUsed,

      scoringTriggered,
      learningTriggered: learningCycleTriggered,

      // ── Extended diagnostics ─────────────────────────────────────────────
      routingSignals: {
        fatigueState:       fatigueResult.fatigue_state,
        explorationEntropy,
        memoryStability,
        mirofishConfidence,
        trendPressure,
      },
      scenes: optimizedScenes.map((s, i) => ({
        scene_type:       s.scene_type,
        mode:             modelDecisions[i]?.mode  ?? primaryDecision.mode,
        model:            modelDecisions[i]?.model ?? primaryDecision.model,
        optimization_log: s.optimization_log,
      })),
      dnaContext: dnaContext !== null,
      execution: {
        service:      blueprint.format,
        variantCount: gatewayResult.creatives.length,
        creativeIds:  allCreativeIds,
      },
      scoring: {
        totalScore: scoreResult.totalScore,
        ctrScore:   scoreResult.ctrScore,
        engagement: scoreResult.engagement,
        conversion: scoreResult.conversion,
      },
      winner: winnerResult,
      learning: {
        outcomesReported,
        learningCycleTriggered,
      },
    };

    return {
      executionId:     creativeId,
      campaignId:      input.campaignId,
      creativeId,
      format:          blueprint.format,
      angleSlug:       blueprint.angle_slug,
      bestCreative: {
        creativeId,
        score:    scoreResult.totalScore,
        isWinner: scoreResult.isWinner,
      },
      score:           scoreResult.totalScore,
      modeUsage,
      diagnostics:     input.diagnostics,
      blueprintMeta:   blueprint._meta,
      validationFixes: input.validationFixes,
      pipelineTrace,
    };
  }
}
