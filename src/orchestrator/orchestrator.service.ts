// ─── Decision Orchestration Layer — Service ───────────────────────────────────
//
// System Governor: loads all per-angle signals from every subsystem, runs the
// FINAL_WEIGHT formula, resolves all inter-subsystem conflicts, selects primary
// + secondary + exploration slots, and emits a fully-structured OrchestratorDecision.
//
// Dependency order:
//   1. AngleService   — provides base confidence, fatigue, goal/emotion match
//   2. LearningService — scoringAlignment from LearningCycle history
//   3. MirofishService — mirofishSignal from inline simulation
//   4. All combined   → AngleSignalBundle per angle → resolveConflicts → rank
// ─────────────────────────────────────────────────────────────────────────────

import { Injectable, Logger, Optional }              from '@nestjs/common';
import { randomUUID }                                from 'crypto';
import { PrismaService }                             from '../prisma/prisma.service';
import { AngleService }                              from '../angle/angle.service';
import { LearningService, BaseLearningSignal }       from '../learning/learning.service';
import { MirofishService }                           from '../mirofish/mirofish.service';
import { FatigueService }        from '../fatigue/fatigue.service';
import { ExplorationService }    from '../exploration/exploration.service';
import { ObservabilityService }  from '../observability/observability.service';
import { DecisionTraceBuilder }  from '../observability/models/decision-trace-builder';
import { ExecutionStoreService } from './execution/execution-store.service';
import { explainAngle }          from './execution/explainability.engine';
import { toDecisionPageViewModel } from '../product/transformers/decision.transformer';
import type { DecisionExecution, ExplainedBundle } from './execution/execution.types';

import {
  AngleSignalBundle,
  ConflictEntry,
  DecideInput,
  OrchestratorContext,
  OrchestratorDecision,
  SystemStabilityState,
} from './orchestrator.types';

import { computeFinalWeight, normalizeInfluences, influencesToBreakdown } from './resolvers/weight.resolver';
import { resolveConflicts }                                                from './resolvers/conflict.resolver';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Minimum memory samples before a system-stability judgement is meaningful. */
const STABILITY_MIN_SAMPLES = 5;

/** Ratio of FATIGUED+BLOCKED angles that indicates system instability. */
const INSTABILITY_FATIGUE_RATIO = 0.50;

/** Ratio of WARMING angles that indicates a warming trend. */
const WARMING_RATIO = 0.30;

// ─── Internal types ───────────────────────────────────────────────────────────

interface AngleRow {
  id: string; slug: string; label: string; description: string | null;
  source: string; isActive: boolean;
  angleStats: { uses: number; wins: number; avgCtr: number; avgRetention: number; avgConversion: number } | null;
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class OrchestratorService {
  private readonly logger = new Logger(OrchestratorService.name);

  constructor(
    private readonly prisma:          PrismaService,
    private readonly angles:          AngleService,
    private readonly executionStore:  ExecutionStoreService,
    @Optional() private readonly learning:      LearningService,
    @Optional() private readonly mirofish:      MirofishService,
    @Optional() private readonly fatigue:       FatigueService,
    @Optional() private readonly exploration:   ExplorationService,
    @Optional() private readonly observability: ObservabilityService,
  ) {}

  // ── Single execution engine ───────────────────────────────────────────────
  // All decision paths go through here. Explanation is generated from the live
  // signal snapshot — never recomputed outside this method.

  async executeDecision(
    input:       DecideInput,
    executionId?: string,
  ): Promise<DecisionExecution> {
    const id = executionId ?? randomUUID();
    const exec = this.executionStore.init(id);
    const t0   = exec.startedAt;

    try {
      // Phase 1 — build context + load active angles
      const ctx = await this.buildContext(input);
      const allAngles = (await this.prisma.angle.findMany({
        where:   { isActive: true },
        include: { angleStats: true },
      })) as AngleRow[];

      if (allAngles.length === 0) {
        const decision = this.emptyDecision(Date.now() - t0);
        const viewModel = toDecisionPageViewModel(decision, []);
        this.executionStore.complete(id, { decision, bundles: [], viewModel });
        return this.executionStore.get(id)!;
      }

      // Phase 2 — signal computation
      const { bundles, explorationDelta } = await this.buildSignalBundles(allAngles, ctx);
      this.executionStore.advance(id, 'signals', { count: bundles.length });

      // Phase 3 — conflict resolution + slot selection
      const { bundles: resolved, log } = resolveConflicts(bundles);
      const { primary, secondary, exploration } = this.selectSlots(resolved, ctx);

      if (!primary) {
        const decision = this.emptyDecision(Date.now() - t0);
        const viewModel = toDecisionPageViewModel(decision, []);
        this.executionStore.complete(id, { decision, bundles: [], viewModel });
        return this.executionStore.get(id)!;
      }

      const influences    = normalizeInfluences(primary);
      const breakdown     = influencesToBreakdown(influences);
      const stability     = this.assessStability(resolved);
      const mirofishCount = resolved.filter(b => b.mirofishOverruled).length;

      const selectedAngles = [
        this.toSelectedAngle(primary,     'exploit',   ctx),
        ...(secondary   ? [this.toSelectedAngle(secondary,   'secondary', ctx)] : []),
        ...(exploration ? [this.toSelectedAngle(exploration, 'explore',   ctx)] : []),
      ];

      const decision: OrchestratorDecision = {
        selected_angles:          selectedAngles,
        primary_angle:            primary.slug,
        secondary_angle:          secondary?.slug ?? null,
        decision_breakdown:       breakdown,
        conflict_resolution_log:  log,
        final_decision_reasoning: this.buildReasoning(primary, secondary, resolved, ctx, log),
        system_stability_state:   stability,
        _meta: {
          angles_evaluated:   resolved.length,
          conflicts_detected: log.length,
          mirofish_overruled: mirofishCount,
          computation_ms:     Date.now() - t0,
        },
      };
      this.executionStore.advance(id, 'decision', { primary: decision.primary_angle });

      // Phase 4 — explanation from the same live snapshot (no recomputation allowed)
      const explainedBundles: ExplainedBundle[] = resolved.map(b => ({
        ...b,
        explanation: explainAngle(b, decision),
      }));
      this.executionStore.advance(id, 'explanation', { count: explainedBundles.length });

      // Phase 5 — build ViewModel from pre-explained bundles
      const viewModel = toDecisionPageViewModel(decision, explainedBundles);

      this.executionStore.complete(id, { decision, bundles: explainedBundles, viewModel });
      this.emitTrace(decision, resolved, ctx, explorationDelta);

    } catch (err) {
      const msg = (err as Error).message ?? 'unknown error';
      this.logger.error(`[executeDecision] ${id} failed: ${msg}`);
      this.executionStore.fail(id, msg);
    }

    return this.executionStore.get(id)!;
  }

  // ── decide() — backwards-compatible wrapper ───────────────────────────────

  async decide(input: DecideInput): Promise<OrchestratorDecision> {
    const exec = await this.executeDecision(input);
    return exec.decision ?? this.emptyDecision(0);
  }

  // ── Status snapshot (lightweight, no DB scoring) ─────────────────────────

  async status(): Promise<{
    angles_active: number;
    system_stability: SystemStabilityState;
    learning_active: boolean;
    mirofish_active: boolean;
    timestamp: string;
  }> {
    const count  = await this.prisma.angle.count({ where: { isActive: true } });
    const mem    = await this.prisma.creativeMemory.findMany({
      orderBy: { createdAt: 'desc' }, take: 20, select: { angle: true },
    });

    const anglesInMem = await this.prisma.angle.findMany({
      where: { isActive: true }, select: { slug: true, angleStats: true },
    }) as { slug: string; angleStats: { uses: number } | null }[];

    const fatigued = anglesInMem.filter(a => (a.angleStats?.uses ?? 0) > 10).length;
    const ratio    = count > 0 ? fatigued / count : 0;
    const stability: SystemStabilityState =
      ratio >= INSTABILITY_FATIGUE_RATIO ? 'unstable'
      : ratio >= WARMING_RATIO           ? 'warming'
      : 'stable';

    return {
      angles_active:    count,
      system_stability: stability,
      learning_active:  !!this.learning,
      mirofish_active:  !!this.mirofish,
      timestamp:        new Date().toISOString(),
    };
  }

  // ── Context builder ───────────────────────────────────────────────────────

  private async buildContext(input: DecideInput): Promise<OrchestratorContext> {
    const goalMap: Record<string, string[]> = {
      conversion: ['before_after', 'show_off', 'proof'],
      awareness:  ['storytelling', 'curiosity', 'unpopular_opinion'],
      engagement: ['spark_conversation', 'tips_tricks', 'hot_take'],
    };
    const emoMap: Record<string, string[]> = {
      curiosity:   ['curiosity', 'unpopular_opinion', 'storytelling'],
      trust:       ['proof', 'before_after', 'show_off'],
      excitement:  ['show_off', 'before_after', 'storytelling'],
      fear:        ['before_after', 'problem_solution', 'mistake_avoidance'],
      hope:        ['storytelling', 'before_after', 'show_off'],
      urgency:     ['problem_solution', 'before_after', 'proof'],
    };

    const goal      = input.goal    || 'conversion';
    const emotion   = (input.emotion || '').toLowerCase().trim();
    const goalPool  = goalMap[goal]     ?? Object.values(goalMap).flat();
    const emoBoosts = emoMap[emotion]   ?? [];

    const recentMem: OrchestratorContext['recentMem'] = [];
    let isNewUser = true;

    if (input.user_id) {
      const mem = await this.prisma.creativeMemory.findMany({
        where:   { userId: input.user_id },
        orderBy: { createdAt: 'desc' },
        take:    30,
        select:  { angle: true, totalScore: true, isWinner: true },
      });
      mem.forEach(m => recentMem.push({ angle: m.angle, totalScore: m.totalScore, isWinner: m.isWinner }));
      isNewUser = mem.length < 3;
    }

    const s5  = recentMem.slice(0, 5).map(m => m.totalScore);
    const s10 = recentMem.slice(5, 10).map(m => m.totalScore);
    const avg5  = s5.length  ? s5.reduce((a, b) => a + b, 0)  / s5.length  : 0;
    const avg10 = s10.length ? s10.reduce((a, b) => a + b, 0) / s10.length : 0;

    const declining       = s10.length >= 3 && avg5 < avg10 - 0.05;
    const highExploreMode = declining || isNewUser;

    return {
      goal,
      emotion:    emotion || null,
      format:     input.format    || null,
      clientId:   input.client_id || null,
      industry:   input.industry  || null,
      userId:     input.user_id   || null,
      campaignId: input.campaign_id || null,
      goalPool,
      emoBoosts,
      recentMem,
      isNewUser,
      highExploreMode,
    };
  }

  // ── Signal bundle assembly ────────────────────────────────────────────────

  private async buildSignalBundles(
    angles: AngleRow[],
    ctx:    OrchestratorContext,
  ): Promise<{ bundles: AngleSignalBundle[]; explorationDelta: number }> {

    // ── Load all subsystem signals in parallel ────────────────────────────

    // 4.2 — Memory scores from AngleWeight EWMA (blended with client data in FIX 2)
    const memoryScores = await this.loadMemoryScores(angles, ctx);

    // Single DB fetch for learning signals — derived into scoring + blending slots
    // via pure transformations (FIX 1: eliminates duplicate getContextualMultipliers call)
    const baseSignals = this.learning
      ? await this.learning.getBaseLearningSignal(
          angles.map(a => a.id),
          { goal: ctx.goal, clientId: ctx.clientId, industry: ctx.industry },
        ).catch(() => ({} as Record<string, BaseLearningSignal>))
      : {} as Record<string, BaseLearningSignal>;

    // MIROFISH signals — inline simulation (non-blocking, <5ms per angle)
    const mirofishSignals = await this.loadMirofishSignals(angles, ctx);

    // 4.4 Fatigue signals (preferred over deriveFatigueLevel fallback)
    const fatigueMap = this.fatigue
      ? await this.fatigue.computeBatch({
          slugs:   angles.map(a => a.slug),
          userId:  ctx.userId   ?? undefined,
          clientId: ctx.clientId ?? undefined,
        }).catch(() => new Map())
      : new Map();

    // 4.5 Adaptive Exploration Engine — system-wide pressure signal.
    // Computed once per request; passed the pre-loaded fatigueMap to avoid
    // redundant DB queries and prevent double-counting.
    // When active, replaces per-angle fatigueExploreBoost in bundle assembly.
    const explorationPressure45 = this.exploration
      ? await this.exploration.computePressure({
          userId:           ctx.userId   ?? undefined,
          clientId:         ctx.clientId ?? undefined,
          goal:             ctx.goal,
          preloadedFatigue: fatigueMap.size > 0 ? fatigueMap : undefined,
        }).catch(() => null)
      : null;
    // null → 4.5 unavailable; bundle assembly will fall back to per-angle 4.4 signal.
    const systemPressureDelta: number | null =
      explorationPressure45?.exploration_pressure_delta ?? null;

    // ── Assemble bundles ──────────────────────────────────────────────────

    const bundles = angles.map(a => {
      const s = a.angleStats;

      // 4.1 signal: pure goal + emotion match (no history)
      const inGoalPool    = ctx.goalPool.includes(a.slug);
      const inEmotionBoost= ctx.emoBoosts.includes(a.slug);
      const signal41      = inGoalPool && inEmotionBoost ? 1.0
                          : inGoalPool || inEmotionBoost ? 0.5
                          : 0;

      // Memory score (4.2 EWMA smoothed)
      const memoryScore = memoryScores[a.id] ?? 0.50;

      // SLOT: scoringAlignment (weight 0.30)
      // Source: BaseLearningSignal.rawMultiplier × SCORING_SCALE (0.40)
      // Measures: how much the angle outperforms goal/context expectations from LearningCycles.
      const scoringAlignment = this.learning?.transformForUsage(baseSignals[a.id], 'scoring') ?? 0.50;

      // SLOT: blendingCompatibility (weight 0.07)
      // Source: same BaseLearningSignal.rawMultiplier × BLENDING_SCALE (0.30) — different projection.
      // Measures: contextual fit for multi-angle blending (weaker signal, narrower scale).
      const blendingCompatibility = this.learning?.transformForUsage(baseSignals[a.id], 'blending') ?? 0.50;

      // MIROFISH advisory signal (0–1)
      const mirofishSignal = mirofishSignals[a.id] ?? 0.50;

      const fatigueResult = fatigueMap.get(a.slug);

      // Exploration pressure additive:
      //   4.5 active → system-wide unified delta (replaces per-angle fatigue boost)
      //   4.5 absent → per-angle 4.4 exploration_signal as fallback
      // This ensures MIROFISH data is never counted twice (4.5 already absorbs it).
      const exploreBoost = systemPressureDelta !== null
        ? systemPressureDelta                                   // 4.5 unified pressure
        : (fatigueResult ? fatigueResult.exploration_signal : 0); // 4.4 per-angle fallback

      const uses       = s?.uses ?? 0;
      const lowUsage   = uses < 3;
      const stagnation = ctx.highExploreMode;
      const explorationFactor = clamp(
        0.50
        + (lowUsage   ? 0.20 : 0)
        + (stagnation ? 0.15 : 0)
        - (uses > 15  ? 0.15 : 0)
        + exploreBoost,
      );

      // Fatigue level — 4.4 FatigueService preferred, local derivation as fallback
      const fatigueLevel = (fatigueResult?.fatigue_state as AngleSignalBundle['fatigueLevel'])
                        ?? this.deriveFatigueLevel(a.slug, ctx.recentMem);

      const sampleCount = s?.uses  ?? 0;
      const winCount    = s?.wins  ?? 0;

      const finalWeight = computeFinalWeight({
        memoryScore, scoringAlignment, mirofishSignal,
        blendingCompatibility, explorationFactor,
      });

      return {
        angleId:               a.id,
        slug:                  a.slug,
        label:                 a.label,
        description:           a.description,
        source:                a.source,
        isActive:              a.isActive,
        memoryScore,
        scoringAlignment,
        mirofishSignal,
        blendingCompatibility,
        explorationFactor,
        finalWeight,
        rankPosition:          0,   // assigned after conflict resolution
        sampleCount,
        winCount,
        fatigueLevel,
        inGoalPool,
        inEmotionBoost,
        mirofishOverruled:     false,
        signal41,
      } satisfies AngleSignalBundle;
    });

    return { bundles, explorationDelta: systemPressureDelta ?? 0 };
  }

  // ── Subsystem signal loaders ──────────────────────────────────────────────

  private async loadMemoryScores(
    angles: AngleRow[],
    ctx:    OrchestratorContext,
  ): Promise<Record<string, number>> {
    // Global: AngleWeight EWMA smoothedScore (keyed by angleId)
    const weights = await this.prisma.angleWeight.findMany({
      select: { angleId: true, smoothedScore: true },
    }).catch(() => [] as { angleId: string; smoothedScore: number }[]);

    const globalMap: Record<string, number> = {};
    for (const w of weights) globalMap[w.angleId] = clamp(w.smoothedScore);

    // Client-scoped: avg totalScore from CreativeMemory (keyed by angle slug)
    const clientSlugMap: Record<string, number> = {};
    if (ctx.clientId) {
      const clientMem = await this.prisma.creativeMemory.findMany({
        where:  { clientId: ctx.clientId },
        select: { angle: true, totalScore: true },
      }).catch(() => [] as { angle: string; totalScore: number }[]);

      const sums: Record<string, { total: number; count: number }> = {};
      for (const m of clientMem) {
        const e = sums[m.angle] ?? { total: 0, count: 0 };
        e.total += m.totalScore;
        e.count += 1;
        sums[m.angle] = e;
      }
      for (const [slug, { total, count }] of Object.entries(sums)) {
        clientSlugMap[slug] = clamp(total / count);
      }
    }

    // Blend: globalScore × 0.6 + clientScore × 0.4; fall back to global-only
    const map: Record<string, number> = {};
    for (const a of angles) {
      const globalScore = globalMap[a.id] ?? 0.50;
      const clientScore = clientSlugMap[a.slug];
      map[a.id] = clientScore !== undefined
        ? clamp(globalScore * 0.6 + clientScore * 0.4)
        : globalScore;
    }
    return map;
  }

  private async loadMirofishSignals(
    angles: AngleRow[],
    ctx:    OrchestratorContext,
  ): Promise<Record<string, number>> {
    if (!this.mirofish) {
      return Object.fromEntries(angles.map(a => [a.id, 0.50]));
    }

    const results: Record<string, number> = {};

    await Promise.allSettled(
      angles.map(async a => {
        try {
          const r = this.mirofish!.simulateInline({
            primaryAngle:   a.slug,
            secondaryAngle: undefined,
            goal:           ctx.goal,
            emotion:        ctx.emotion ?? undefined,
            format:         ctx.format  ?? undefined,
          });
          // overall_score is 0–100; normalise to 0–1
          results[a.id] = clamp(r.overall_score / 100);
        } catch {
          results[a.id] = 0.50;
        }
      }),
    );

    return results;
  }

  // ── Fatigue derivation ────────────────────────────────────────────────────

  private deriveFatigueLevel(
    slug: string,
    mem:  OrchestratorContext['recentMem'],
  ): AngleSignalBundle['fatigueLevel'] {
    const last10    = mem.slice(0, 10);
    const usageIn10 = last10.filter(m => m.angle === slug).length;

    if (usageIn10 >= 5) return 'BLOCKED';

    const angleRuns  = mem.filter(m => m.angle === slug);
    let baseLevel: AngleSignalBundle['fatigueLevel'] = 'HEALTHY';

    if (angleRuns.length >= 4) {
      const r = (arr: { totalScore: number }[]) =>
        arr.length ? arr.reduce((s, m) => s + m.totalScore, 0) / arr.length : 0;
      const recentAvg = r(angleRuns.slice(0, 3));
      const prevAvg   = r(angleRuns.slice(3, 6));
      if (prevAvg > 0 && recentAvg < prevAvg - 0.10) baseLevel = 'FATIGUED';
      else if (prevAvg > 0 && recentAvg < prevAvg - 0.05) {
        baseLevel = usageIn10 >= 3 ? 'FATIGUED' : 'WARMING';
      }
    }

    if (baseLevel === 'HEALTHY') {
      if (usageIn10 >= 3) baseLevel = 'FATIGUED';
      else if (usageIn10 >= 2) baseLevel = 'WARMING';
    }

    return baseLevel;
  }

  // ── Slot selection ────────────────────────────────────────────────────────

  private selectSlots(
    bundles: AngleSignalBundle[],
    ctx:     OrchestratorContext,
  ): { primary: AngleSignalBundle | null; secondary: AngleSignalBundle | null; exploration: AngleSignalBundle | null } {
    // Weight-only gate — conflict resolver already zeroes finalWeight for BLOCKED angles.
    // fatigueLevel is not used as a decision condition; weight is the single authority.
    const eligible = bundles.filter(b => b.finalWeight > 0);
    if (eligible.length === 0) {
      // All angles are zeroed (full system BLOCKED). Fall back to best-by-memory rather
      // than returning null — ensures the caller always gets a usable primary angle.
      const fallback = this.fallbackSelection(bundles);
      return { primary: fallback, secondary: null, exploration: null };
    }

    // Primary — highest finalWeight in goal/emotion pool (4.1 preference preserved)
    const pooled  = eligible.filter(b => b.inGoalPool || b.inEmotionBoost);
    const primary = (pooled.length > 0 ? pooled : eligible)[0] ?? eligible[0];

    // Secondary — next highest, different from primary, not exploration-driven
    const rem1      = eligible.filter(b => b.angleId !== primary.angleId);
    const secondary = rem1.filter(b => b.inGoalPool || b.inEmotionBoost || b.scoringAlignment >= 0.50)[0]
                   ?? rem1[0]
                   ?? null;

    // Exploration — lowest usage (explorationFactor highest), different from both
    const rem2 = eligible.filter(b =>
      b.angleId !== primary.angleId && b.angleId !== (secondary?.angleId ?? ''),
    );
    const exploration = [...rem2].sort((a, b) => b.explorationFactor - a.explorationFactor)[0] ?? null;

    return { primary, secondary, exploration };
  }

  // ── Stability assessment ──────────────────────────────────────────────────

  private assessStability(bundles: AngleSignalBundle[]): SystemStabilityState {
    if (bundles.length < STABILITY_MIN_SAMPLES) return 'stable';

    const fatigued   = bundles.filter(b => b.fatigueLevel === 'FATIGUED' || b.fatigueLevel === 'BLOCKED').length;
    const warming    = bundles.filter(b => b.fatigueLevel === 'WARMING').length;
    const ratio      = fatigued / bundles.length;
    const warmRatio  = (fatigued + warming) / bundles.length;

    if (ratio   >= INSTABILITY_FATIGUE_RATIO) return 'unstable';
    if (warmRatio >= WARMING_RATIO)            return 'warming';
    return 'stable';
  }

  // ── Reasoning string ──────────────────────────────────────────────────────

  private buildReasoning(
    primary:    AngleSignalBundle,
    secondary:  AngleSignalBundle | null,
    bundles:    AngleSignalBundle[],
    ctx:        OrchestratorContext,
    log:        ConflictEntry[],
  ): string {
    const parts: string[] = [];

    parts.push(
      `Primary: "${primary.slug}" (weight=${primary.finalWeight.toFixed(3)}, memory=${primary.memoryScore.toFixed(3)})`,
    );

    if (secondary) {
      parts.push(`Secondary: "${secondary.slug}" (weight=${secondary.finalWeight.toFixed(3)})`);
    }

    parts.push(`Goal: ${ctx.goal}${ctx.emotion ? `, emotion: ${ctx.emotion}` : ''}`);

    const overruled = bundles.filter(b => b.mirofishOverruled).length;
    if (overruled > 0) {
      parts.push(`MIROFISH overruled on ${overruled} angle(s) — memory priority applied`);
    }

    if (log.length > 0) {
      parts.push(`${log.length} conflict(s) resolved`);
    }

    return parts.join(' | ');
  }

  // ── Serialise to selected-angle shape ────────────────────────────────────

  private toSelectedAngle(
    b:    AngleSignalBundle,
    slot: 'exploit' | 'secondary' | 'explore',
    ctx:  OrchestratorContext,
  ): Record<string, unknown> {
    const META = {
      exploit:   { section: 'SELECTED ANGLE',    status: 'USED IN GENERATION' },
      secondary: { section: 'SECONDARY ANGLE',   status: 'NOT USED' },
      explore:   { section: 'EXPLORATION ANGLE', status: 'NOT USED' },
    };
    const TAGS: Record<string, string> = {
      before_after: 'BEFORE_AFTER', show_off: 'SHOW_OFF', proof: 'SOCIAL_PROOF',
      storytelling: 'STORY', curiosity: 'CURIOSITY', unpopular_opinion: 'OPINION',
      spark_conversation: 'CONVERSATION', tips_tricks: 'TIPS', hot_take: 'HOT_TAKE',
      teach: 'TEACH', data_stats: 'DATA', do_this_not_that: 'DO_VS_DONT',
      problem_solution: 'PROBLEM_SOLUTION', mistake_avoidance: 'MISTAKE',
    };

    return {
      angle:        b.slug,
      tag:          TAGS[b.slug]  ?? b.slug.toUpperCase(),
      label:        b.label,
      description:  b.description,
      section:      META[slot].section,
      status:       META[slot].status,
      slot,
      weight:       parseFloat(b.finalWeight.toFixed(4)),
      rank:         b.rankPosition,
      fatigue:      b.fatigueLevel,
      in_goal_pool: b.inGoalPool,
      mirofish_overruled: b.mirofishOverruled,
      signals: {
        memory:      parseFloat(b.memoryScore.toFixed(4)),
        scoring:     parseFloat(b.scoringAlignment.toFixed(4)),
        mirofish:    parseFloat(b.mirofishSignal.toFixed(4)),
        blending:    parseFloat(b.blendingCompatibility.toFixed(4)),
        exploration: parseFloat(b.explorationFactor.toFixed(4)),
      },
    };
  }

  // ── Fallback selection ────────────────────────────────────────────────────
  // Used when all angles are zeroed out. Picks the angle with the highest
  // memoryScore as a deterministic last resort; tie-breaks by slug.

  private fallbackSelection(bundles: AngleSignalBundle[]): AngleSignalBundle | null {
    if (bundles.length === 0) return null;
    return [...bundles].sort(
      (a, b) => b.memoryScore - a.memoryScore || a.slug.localeCompare(b.slug),
    )[0] ?? null;
  }

  // ── Fallback decision (no angles at all) ─────────────────────────────────

  private emptyDecision(ms: number): OrchestratorDecision {
    return {
      selected_angles:          [],
      primary_angle:            '',
      secondary_angle:          null,
      decision_breakdown:       { memory_influence: '0%', scoring_influence: '0%', mirofish_influence: '0%', blending_influence: '0%', exploration_influence: '0%' },
      conflict_resolution_log:  [],
      final_decision_reasoning: 'No eligible angles found',
      system_stability_state:   'stable',
      _meta: { angles_evaluated: 0, conflicts_detected: 0, mirofish_overruled: 0, computation_ms: ms },
    };
  }

  // ── Observability ─────────────────────────────────────────────────────────

  private emitTrace(
    decision:        OrchestratorDecision,
    bundles:         AngleSignalBundle[],
    ctx:             OrchestratorContext,
    explorationDelta: number,
  ): void {
    if (!this.observability) return;

    const selected = decision.selected_angles as Record<string, unknown>[];

    const trace = DecisionTraceBuilder.build({
      orchestratorOutput: {
        primaryAngle:     decision.primary_angle,
        secondaryAngle:   decision.secondary_angle,
        stability:        decision.system_stability_state,
        winnerConfidence: bundles.find(b => b.slug === decision.primary_angle)?.finalWeight ?? 0,
        explorationAngles: selected
          .filter(a => a['slot'] === 'explore')
          .map(a => ({ slug: a['angle'] as string, confidence: (a['weight'] as number) ?? 0 })),
        resolvedConflicts: decision.conflict_resolution_log,
        overrides: decision.conflict_resolution_log
          .filter(e => e.winner === 'memory')
          .map(e => e.conflict),
        blockedAngles: bundles.filter(b => b.fatigueLevel === 'BLOCKED').map(b => b.slug),
      },
      bundles,
      exploration: explorationDelta,
      context: {
        clientId:   ctx.clientId,
        userId:     ctx.userId,
        campaignId: ctx.campaignId,
        goal:       ctx.goal,
        format:     ctx.format,
        emotion:    ctx.emotion,
      },
    });

    void this.observability.createTrace(trace);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clamp(v: number, lo = 0, hi = 1): number {
  if (!isFinite(v)) return lo;
  return Math.min(hi, Math.max(lo, v));
}
