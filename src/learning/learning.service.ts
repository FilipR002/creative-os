import { Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService }             from '../prisma/prisma.service';
import { MirofishLearningService }   from '../mirofish/mirofish.learning.service';
import { MemoryEventService }        from '../optimization/cost/memory-event.service';
import { assertClientScope }         from '../common/guards/client-scope';
import {
  AngleCycleEntry,
  CycleResult,
  ExplorationSignal,
  LearningHealth,
  RankedAngle,
  SystemStatus,
  WeightContext,
} from './learning.types';

// ── Signal atomization ────────────────────────────────────────────────────────
// Single DB fetch (getBaseLearningSignal) → two pure transformations:
//   'scoring'  → scoringAlignment slot  (weight 0.30 in FINAL_WEIGHT, scale 0.40)
//   'blending' → blendingCompatibility slot (weight 0.07 in FINAL_WEIGHT, scale 0.30)
// These share the same rawMultiplier source but are distinct formula slots.
// Never call getContextualMultipliers() more than once per orchestrator request.
export interface BaseLearningSignal {
  rawMultiplier: number;
}

const SCORING_SCALE  = 0.40;  // scoringAlignment projection
const BLENDING_SCALE = 0.30;  // blendingCompatibility projection

// ══════════════════════════════════════════════════════════════════════════════
// CONSTANTS — production-tuned stability parameters
// ══════════════════════════════════════════════════════════════════════════════

// ── Learning rate formula: lr = BASE_LR × confidence × recencyWeight ─────────
const BASE_LR             = 0.15;  // rate at full confidence + full recency
const MIN_LR              = 0.03;  // absolute floor — never fully blind
const MAX_LR              = 0.30;  // ceiling — prevents runaway updates
const MIN_SAMPLES_FULL_LR = 8;     // samples needed for full confidence
const MIN_RECENCY_WEIGHT  = 0.50;  // recency floor (old data still gets 50% lr)

// ── Temporal smoothing — anti-flip EWMA (Section 2) ─────────────────────────
const SMOOTH_ALPHA        = 0.70;  // 70% recent, 30% historical
const SMOOTH_WINDOW       = 10;    // window for variance calculation

// ── Hysteresis lock — top-K ranking stability (Section 3) ───────────────────
const TOP_LOCK_THRESHOLD  = 1.20;  // weight ≥ this → "top position"
const TOP_LOCK_DURATION   = 3;     // cycles locked after entering top position

// ── Weight update asymmetry ───────────────────────────────────────────────────
const BOOST_FACTOR        = 1.25;  // beat expectations → amplified boost
const PENALTY_FACTOR      = 0.80;  // missed expectations → dampened penalty
const WEIGHT_MIN          = 0.20;  // absolute floor
const WEIGHT_MAX          = 2.00;  // absolute ceiling

// ── Consecutive streak reinforcement/decay ────────────────────────────────────
const CONSEC_WIN_THRESHOLD  = 3;
const REINFORCE_MULT        = 1.12;
const CONSEC_LOSS_THRESHOLD = 3;
const CONSEC_DECAY_MULT     = 0.92;

// ── Normalization (Section 4) ─────────────────────────────────────────────────
const NORM_MIN_STD        = 0.05;  // floor on std deviation denominator
const NORM_BASELINE_ALPHA = 0.20;  // EWMA rate for updating baselines

// ── Uncertainty model (Section 6) ────────────────────────────────────────────
const UNCERTAINTY_MAX_SAMPLES = 15;    // samples for minimum scarcity component
const UNCERTAINTY_VAR_MAX     = 0.10;  // max variance before maxing out uncertainty
const UNCERTAINTY_W_SCARCITY  = 0.40;
const UNCERTAINTY_W_VARIANCE  = 0.40;
const UNCERTAINTY_W_RECENCY   = 0.20;

// ── Long-term decay (Section 7) ───────────────────────────────────────────────
const DECAY_HALF_LIFE_DAYS = 30;   // weight halved after 30 days of non-use
const MS_PER_DAY           = 86_400_000;

// ── Exploration feedback (Section 5) ─────────────────────────────────────────
const EXPLORE_WIN_BONUS   = 0.05;  // extra boost when explore slot wins
const EXPLORE_LOSS_DAMPEN = 0.50;  // halve the penalty for explore slot misses

// ── Anti-overfitting (Section 8) ─────────────────────────────────────────────
const DOMINANCE_USAGE_PCT  = 0.70;  // >70% recent wins = dominance → inject
const ANTIFIT_WINDOW       = 15;    // cycles to check for dominance
const DOMINANCE_TAX        = 0.08;  // weight reduction applied to dominant angle

// ── Exploration signal detection ─────────────────────────────────────────────
const EXPL_DOMINANCE_OF_5  = 4;     // wins X of last 5
const STAGNATION_VARIANCE  = 0.015; // score variance below this = stagnating
const REPETITION_OF_N      = 3;     // same winner N campaigns in a row
const EXPLORE_COMPRESS_PCT = 0.20;  // move weights 20% toward 1.0

// ── Context blend priorities ──────────────────────────────────────────────────
const CTX_PRIORITY: Record<string, number> = {
  global: 1.00, goal: 0.70, client: 0.60, industry: 0.50,
};

// ══════════════════════════════════════════════════════════════════════════════
// SERVICE
// ══════════════════════════════════════════════════════════════════════════════

@Injectable()
export class LearningService {
  private readonly logger = new Logger(LearningService.name);

  constructor(
    private readonly prisma:                       PrismaService,
    @Optional() private readonly mirofishLearning: MirofishLearningService,
    @Optional() private readonly memoryEvent:      MemoryEventService,
  ) {}

  // ──────────────────────────────────────────────────────────────────────────
  // SCOPE HELPERS (Phase 5.7)
  // ──────────────────────────────────────────────────────────────────────────
  //
  // Data classification for learning data:
  //   GLOBAL  — AngleWeight (smoothedScore, decayFactor, etc.)
  //             Shared across all clients; reflects system-wide performance.
  //   CLIENT  — per-client context keys (client:{clientId}) in AngleWeight rows
  //             Isolated per tenant; never bleed into cross-client aggregates.
  //
  // CrossClientLearningService is the ONLY path for cross-client aggregation.
  // Never call LearningService methods with a null clientId to simulate global;
  // use getGlobalLearningScope() and pass it as the context.

  /**
   * Returns a WeightContext scoped to a specific client.
   * Use for any per-tenant read/write operation in the learning pipeline.
   */
  getClientLearningScope(clientId: string): WeightContext {
    assertClientScope(clientId);
    return { clientId };
  }

  /**
   * Returns a WeightContext for global (cross-client) learning queries.
   * Only contextKey='global' rows are queried — never mixes client data.
   */
  getGlobalLearningScope(): WeightContext {
    return {};   // no clientId → only contextKey='global' rows matched
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PUBLIC API
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * STABLE CLOSED-LOOP LEARNING CYCLE  (10-step clean architecture)
   *
   * 1.  Load campaign + scored creatives
   * 2.  Measure actual performance
   * 3.  Update performance baselines (industry / format / global)
   * 4.  Normalize score vs baseline  → comparable across contexts
   * 5.  Apply EWMA smoothing  70% recent / 30% historical  → anti-flip
   * 6.  Stability-controlled weight update  (lr formula + hysteresis lock)
   * 7.  Update uncertainty score  (scarcity + variance + recency)
   * 8.  Update temporal decay factor  exp(-days/half-life)
   * 9.  Anti-overfitting check  >70% dominance → inject exploration
   * 10. Sync AngleStats.weight + return full diagnostic report
   */
  async runCycle(campaignId: string): Promise<CycleResult> {
    // ── Step 1: Load campaign ─────────────────────────────────────────────
    const campaign = await this.prisma.campaign.findUnique({
      where:   { id: campaignId },
      include: {
        concept:   true,
        client:    true,
        creatives: { include: { angle: true, score: true } },
      },
    });

    if (!campaign) return this.emptyResult(campaignId, 'Campaign not found');

    const goal     = campaign.concept?.goal    ?? null;
    const clientId = campaign.clientId          ?? null;
    const industry = campaign.client?.industry ?? null;

    const ready = campaign.creatives.filter(
      c => c.score !== null && c.angle !== null && c.angleId !== null,
    );
    if (!ready.length) {
      return this.emptyResult(campaignId, 'No scored creatives with angles found');
    }

    const updatedAngles: AngleCycleEntry[] = [];

    for (const creative of ready) {
      const slug      = creative.angle!.slug;
      const angleId   = creative.angleId!;
      const format    = creative.format.toLowerCase();
      const actual    = creative.score!.totalScore;
      const isWinner  = creative.score!.isWinner;
      const isExplore = creative.variant === 'explore';

      // Contexts: global always + goal / client / industry if available
      const contexts: { key: string; type: string; value: string | null }[] = [
        { key: 'global',                type: 'global',   value: null      },
        ...(goal     ? [{ key: `goal:${goal}`,         type: 'goal',     value: goal      }] : []),
        ...(clientId ? [{ key: `client:${clientId}`,   type: 'client',   value: clientId  }] : []),
        ...(industry ? [{ key: `industry:${industry}`, type: 'industry', value: industry  }] : []),
      ];

      // ── Step 3: Update baselines ────────────────────────────────────────
      await this.updateBaselines(actual, { goal, industry, format });

      for (const ctx of contexts) {
        // Load existing weight row
        const existing = await this.prisma.angleWeight.findUnique({
          where: { angleId_contextKey: { angleId, contextKey: ctx.key } },
        });

        const weightBefore    = existing?.weight          ?? 1.0;
        const prevSmoothed    = existing?.smoothedScore   ?? 0.5;
        const prevUncertainty = existing?.uncertaintyScore ?? 0.5;
        const samples         = existing?.sampleCount     ?? 0;
        const lastUsedAt      = existing?.lastUsedAt;
        const topLockCycles   = existing?.topLockCycles   ?? 0;

        // ── Step 4: Normalize score ───────────────────────────────────────
        const normalizedScore = await this.normalizeScore(actual, ctx.key, { goal, industry, format });

        // ── Step 5: Apply EWMA smoothing (anti-flip) ──────────────────────
        // 70% this result, 30% rolling history — prevents single-campaign dominance
        const newSmoothedScore = SMOOTH_ALPHA * normalizedScore + (1 - SMOOTH_ALPHA) * prevSmoothed;

        // Delta = how much this run beat the smoothed expectation (stable prediction)
        const delta = normalizedScore - prevSmoothed;

        // ── Step 8: Compute decay factor (before lr so recency feeds lr) ──
        const newDecayFactor = this.computeDecayFactor(lastUsedAt ?? null);

        // ── Step 6a: Compute learning rate (full formula) ─────────────────
        // lr = BASE_LR × confidence × recencyWeight × mirofishModifier
        // mirofishModifier: 0.80–1.20 based on recent prediction error history.
        // High prediction error → angle harder to model → learn faster (>1.0).
        // Low prediction error  → well-understood → standard rate (≈1.0).
        const confidence    = Math.min(1.0, (samples + 1) / MIN_SAMPLES_FULL_LR);
        const recencyWeight = Math.max(MIN_RECENCY_WEIGHT, newDecayFactor);
        const mirofishMod   = this.mirofishLearning
          ? await this.mirofishLearning.getMirofishLRModifier(slug).catch(() => 1.0)
          : 1.0;
        const lr            = clamp(BASE_LR * confidence * recencyWeight * mirofishMod, MIN_LR, MAX_LR);

        // ── Step 6b: Hysteresis lock check ───────────────────────────────
        // Top angles are locked against demotion for TOP_LOCK_DURATION cycles
        const isTopLocked = topLockCycles > 0 && delta < 0;
        if (isTopLocked) {
          this.logger.debug(
            `[Stability] ${slug} hysteresis lock active (${topLockCycles} cycles remaining) — skipping demotion`,
          );
        }

        // ── Step 6c: Weight update ────────────────────────────────────────
        let weightAfter = weightBefore;

        if (!isTopLocked) {
          // Exploration feedback integration (Section 5)
          // Exploration wins get an extra bonus; losses get a softer penalty
          const boostF   = isExplore ? BOOST_FACTOR   * 1.10 : BOOST_FACTOR;
          const penaltyF = isExplore ? PENALTY_FACTOR * EXPLORE_LOSS_DAMPEN : PENALTY_FACTOR;

          if (delta >= 0) {
            weightAfter = weightBefore + lr * delta * boostF;
            if (isExplore && isWinner) {
              weightAfter += EXPLORE_WIN_BONUS; // validated exploration → bonus lift
            }
          } else {
            weightAfter = weightBefore + lr * delta * penaltyF;
          }

          // Consecutive streak reinforcement / decay (global context only)
          if (ctx.key === 'global') {
            if (isWinner) {
              const streak = await this.getConsecutiveStreak(slug, 'win');
              if (streak >= CONSEC_WIN_THRESHOLD) {
                weightAfter *= REINFORCE_MULT;
                this.logger.log(`[Learning] ${slug} exponential reinforcement (${streak} wins streak)`);
              }
            } else {
              const streak = await this.getConsecutiveStreak(slug, 'loss');
              if (streak >= CONSEC_LOSS_THRESHOLD) {
                weightAfter *= CONSEC_DECAY_MULT;
                this.logger.log(`[Learning] ${slug} decay suppression (${streak} loss streak)`);
              }
            }
          }
        }

        weightAfter = clamp(weightAfter, WEIGHT_MIN, WEIGHT_MAX);

        // ── New topLockCycles after this cycle ────────────────────────────
        let newTopLock: number;
        if (weightAfter >= TOP_LOCK_THRESHOLD && topLockCycles === 0) {
          // Just entered top position → engage lock
          newTopLock = TOP_LOCK_DURATION;
          this.logger.debug(`[Stability] ${slug} entered top position — locking for ${TOP_LOCK_DURATION} cycles`);
        } else {
          // Decrement existing lock (floor at 0)
          newTopLock = Math.max(0, topLockCycles - 1);
        }

        // ── Step 7: Update uncertainty score ─────────────────────────────
        const recentVariance = await this.computeRecentVariance(slug, SMOOTH_WINDOW);
        const newUncertainty = this.computeUncertaintyScore(samples + 1, recentVariance, newDecayFactor);

        // ── Persist updated weight row ─────────────────────────────────────
        await this.prisma.angleWeight.upsert({
          where:  { angleId_contextKey: { angleId, contextKey: ctx.key } },
          update: {
            weight:          weightAfter,
            sampleCount:     { increment: 1 },
            winCount:        { increment: isWinner ? 1 : 0 },
            smoothedScore:   newSmoothedScore,
            uncertaintyScore: newUncertainty,
            decayFactor:     newDecayFactor,
            topLockCycles:   newTopLock,
            lastUsedAt:      new Date(),
          },
          create: {
            angleId,
            contextKey:      ctx.key,
            contextType:     ctx.type,
            contextValue:    ctx.value,
            weight:          weightAfter,
            sampleCount:     1,
            winCount:        isWinner ? 1 : 0,
            smoothedScore:   newSmoothedScore,
            uncertaintyScore: 0.5,
            decayFactor:     1.0,
            topLockCycles:   0,
            lastUsedAt:      new Date(),
          },
        });

        // Audit log
        await this.prisma.learningCycle.create({
          data: {
            campaignId,
            creativeId:      creative.id,
            angleSlug:       slug,
            format,
            goal:            goal     ?? undefined,
            clientId:        clientId ?? undefined,
            industry:        industry ?? undefined,
            predictedScore:  prevSmoothed,
            actualScore:     actual,
            delta,
            weightBefore,
            weightAfter,
            learningRate:    lr,
            confidenceLevel: confidence,
            isWinner,
          },
        });

        // Surface global-context results in the cycle report
        if (ctx.key === 'global') {
          const wDiff = weightAfter - weightBefore;
          const impact: AngleCycleEntry['impact'] =
            isTopLocked              ? 'locked'
            : Math.abs(wDiff) < 0.005 ? 'minimal'
            : wDiff > 0              ? 'positive'
            :                           'negative';

          updatedAngles.push({
            slug,
            format,
            actualScore:      r2(actual),
            normalizedScore:  r2(normalizedScore),
            predictedScore:   r2(prevSmoothed),
            delta:            r2(delta),
            weightBefore:     r2(weightBefore),
            weightAfter:      r2(weightAfter),
            learningRate:     r2(lr),
            confidence:       r2(confidence),
            uncertaintyScore: r2(newUncertainty),
            decayFactor:      r2(newDecayFactor),
            topLocked:        isTopLocked,
            isWinner,
            isExplore,
            impact,
          });
        }
      }

      // Sync AngleStats.weight immediately
      await this.syncAngleStatsWeight(angleId);
    }

    // ── Step 9: Anti-overfitting + exploration signal ─────────────────────
    const recentCycles = await this.prisma.learningCycle.findMany({
      where:   clientId ? { clientId } : {},
      orderBy: { cycleAt: 'desc' },
      take:    ANTIFIT_WINDOW,
      select:  { angleSlug: true, actualScore: true, isWinner: true, campaignId: true },
    });

    const overfitSignal   = await this.detectAntiOverfitting(recentCycles);
    const explorationSignal = overfitSignal.triggered
      ? overfitSignal
      : this.detectExplorationSignal(recentCycles);

    if (explorationSignal.triggered) {
      await this.compressWeightGap();
      this.logger.log(`[Learning] Exploration compression fired — ${explorationSignal.reason}`);
    }

    // ── Step 10: Return full report ───────────────────────────────────────
    const totalCycles   = await this.prisma.learningCycle.count();
    const avgChange     = updatedAngles.length ? avg(updatedAngles.map(a => Math.abs(a.weightAfter - a.weightBefore))) : 0;
    const avgNormDelta  = updatedAngles.length ? avg(updatedAngles.map(a => a.delta)) : 0;

    this.logger.log(
      `[Learning] Cycle complete | campaign=${campaignId} | angles=${updatedAngles.length} | ` +
      `avgΔw=${r2(avgChange)} | signal=${explorationSignal.signal}`,
    );
    this.memoryEvent?.notify('LEARNING_CYCLE_COMPLETE');

    return {
      campaignId,
      updatedAngles,
      explorationSignal,
      systemStats: {
        anglesUpdated:      updatedAngles.length,
        avgWeightChange:    r2(avgChange),
        avgNormalizedDelta: r2(avgNormDelta),
        totalCycles,
      },
      cycleAt: new Date().toISOString(),
    };
  }

  /**
   * Contextual weight multiplier per angleId — now uncertainty-corrected + decay-adjusted.
   *
   * FORMULA (per dimension row):
   *   effective = 1.0 + (1 - uncertainty) × (weight - 1.0)
   *   effective *= decayFactor
   *
   * High uncertainty → pulls multiplier toward 1.0 (neutral) — more exploration
   * Low uncertainty  → lets weight speak fully — more exploitation
   * Old data (low decay) → reduces the effective multiplier toward 1.0
   */
  async getContextualMultipliers(
    angleIds: string[],
    context:  WeightContext,
  ): Promise<Record<string, number>> {
    if (!angleIds.length) return {};

    const contextKeys = ['global'];
    if (context.goal)     contextKeys.push(`goal:${context.goal}`);
    if (context.clientId) contextKeys.push(`client:${context.clientId}`);
    if (context.industry) contextKeys.push(`industry:${context.industry}`);

    const rows = await this.prisma.angleWeight.findMany({
      where: {
        angleId:    { in: angleIds },
        contextKey: { in: contextKeys },
      },
    });

    const result: Record<string, number> = {};

    for (const angleId of angleIds) {
      const angleRows = rows.filter(r => r.angleId === angleId);
      if (!angleRows.length) {
        result[angleId] = 1.0;
        continue;
      }

      // Confidence-weighted blend across context dimensions
      let totalW  = 0;
      let blended = 0;

      for (const row of angleRows) {
        const priority = CTX_PRIORITY[row.contextType] ?? 0.5;

        // Uncertainty correction: high uncertainty → pull effective weight toward 1.0
        const uncertainty = row.uncertaintyScore;
        const effective   = 1.0 + (1.0 - uncertainty) * (row.weight - 1.0);

        // Temporal decay: reduce influence of stale weight rows
        const decayed = effective * row.decayFactor;

        // Sample-scaled contribution weight
        const sampleScale = Math.min(1, row.sampleCount / MIN_SAMPLES_FULL_LR);
        const w           = priority * (0.3 + 0.7 * sampleScale);

        blended += decayed * w;
        totalW  += w;
      }

      result[angleId] = totalW > 0 ? clamp(blended / totalW, WEIGHT_MIN, WEIGHT_MAX) : 1.0;
    }

    return result;
  }

  /**
   * Single-fetch version of getContextualMultipliers — returns the raw blended
   * multiplier per angleId without applying the scoring/blending projection.
   * Callers use transformForUsage() to derive per-slot values from one DB round-trip.
   */
  async getBaseLearningSignal(
    angleIds: string[],
    context:  WeightContext,
  ): Promise<Record<string, BaseLearningSignal>> {
    const mults = await this.getContextualMultipliers(angleIds, context);
    const out: Record<string, BaseLearningSignal> = {};
    for (const id of angleIds) {
      out[id] = { rawMultiplier: mults[id] ?? 1.0 };
    }
    return out;
  }

  /**
   * Pure deterministic transformation of a BaseLearningSignal to a 0–1 slot value.
   * 'scoring'  → scoringAlignment  (scale 0.40)
   * 'blending' → blendingCompatibility (scale 0.30)
   * Never throws; returns 0.50 baseline for missing/null signal.
   */
  transformForUsage(
    signal: BaseLearningSignal | undefined,
    usage:  'scoring' | 'blending',
  ): number {
    if (!signal) return 0.50;
    const scale = usage === 'scoring' ? SCORING_SCALE : BLENDING_SCALE;
    return clamp(0.50 + (signal.rawMultiplier - 1.0) * scale, WEIGHT_MIN, WEIGHT_MAX);
  }

  /**
   * Full system status: ranked angles by effective multiplier, uncertainty signals,
   * exploration state, learning health, dominant angle detection.
   */
  async getSystemStatus(): Promise<SystemStatus> {
    const [weights, totalCycles, recentCycles, baselineCount] = await Promise.all([
      this.prisma.angleWeight.findMany({
        where:   { contextKey: 'global' },
        include: { angle: { select: { slug: true, label: true } } },
        orderBy: { weight: 'desc' },
      }),
      this.prisma.learningCycle.count(),
      this.prisma.learningCycle.findMany({
        orderBy: { cycleAt: 'desc' },
        take:    20,
        select:  { angleSlug: true, actualScore: true, isWinner: true, campaignId: true, delta: true, cycleAt: true },
      }),
      this.prisma.performanceBaseline.count(),
    ]);

    const explorationSignal = this.detectExplorationSignal(recentCycles);

    const rankedAngles: RankedAngle[] = weights.map(w => {
      const uncertainty = w.uncertaintyScore;
      const effective   = (1.0 + (1.0 - uncertainty) * (w.weight - 1.0)) * w.decayFactor;
      return {
        slug:                w.angle.slug,
        label:               w.angle.label,
        weight:              r2(w.weight),
        smoothedScore:       r2(w.smoothedScore),
        uncertaintyScore:    r2(w.uncertaintyScore),
        decayFactor:         r2(w.decayFactor),
        effectiveMultiplier: r2(clamp(effective, WEIGHT_MIN, WEIGHT_MAX)),
        sampleCount:         w.sampleCount,
        winCount:            w.winCount,
        winRate:             w.sampleCount > 0 ? r2(w.winCount / w.sampleCount) : 0,
        topLockCycles:       w.topLockCycles,
        status: (
          w.weight >= 1.50 ? 'reinforced'
          : w.weight >= 1.10 ? 'boosted'
          : w.weight <= 0.40 ? 'suppressed'
          : w.weight <= 0.70 ? 'penalized'
          :                     'neutral'
        ) as RankedAngle['status'],
      };
    }).sort((a, b) => b.effectiveMultiplier - a.effectiveMultiplier);

    // Detect dominant angle from recent activity
    const recentWinners    = recentCycles.filter(c => c.isWinner).map(c => c.angleSlug);
    const winFreq          = freq(recentWinners);
    const dominantEntry    = Object.entries(winFreq).sort(([, a], [, b]) => b - a)[0];
    const dominanceAngle   = dominantEntry && dominantEntry[1] >= EXPL_DOMINANCE_OF_5 ? dominantEntry[0] : null;

    return {
      system: {
        totalLearningCycles:  totalCycles,
        anglesTracked:        weights.length,
        explorationSignal,
        avgRecentDelta:       r2(avg(recentCycles.map(c => c.delta))),
        learningHealth:       this.computeLearningHealth(recentCycles.map(c => c.actualScore)),
        dominanceAngle,
        baselineCount,
      },
      rankedAngles,
      recentActivity: recentCycles.slice(0, 5).map(c => ({
        angle:           c.angleSlug,
        score:           r2(c.actualScore),
        normalizedScore: r2(c.delta + 0.5), // approx: delta is vs 0.5 baseline for new angles
        delta:           r2(c.delta),
        isWinner:        c.isWinner,
        at:              c.cycleAt,
      })),
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PRIVATE — Normalization (Section 4)
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Normalize actual score against the relevant baseline.
   * Result is mapped to [0, 1] via z-score capped at ±3 std deviations.
   *
   * Prevents unfair comparison between different industries / formats / goals.
   */
  private async normalizeScore(
    actual: number,
    contextKey: string,
    dims: { goal: string | null; industry: string | null; format: string | null },
  ): Promise<number> {
    // Pick the most specific baseline available
    const candidates = [
      dims.industry ? `industry:${dims.industry}` : null,
      dims.goal     ? `goal:${dims.goal}`         : null,
      dims.format   ? `format:${dims.format}`     : null,
      'global',
    ].filter(Boolean) as string[];

    let baseline: { avgScore: number; variance: number; sampleCount: number } | null = null;

    for (const dim of candidates) {
      const row = await this.prisma.performanceBaseline.findUnique({ where: { dimension: dim } });
      if (row && row.sampleCount >= 5) {
        baseline = row;
        break;
      }
    }

    // Not enough baseline data yet → return raw score scaled to [0,1]
    if (!baseline || baseline.sampleCount < 5) return clamp(actual);

    const std = Math.max(NORM_MIN_STD, Math.sqrt(baseline.variance));
    const z   = (actual - baseline.avgScore) / std;
    // Map z in [-3, +3] → [0, 1]
    return clamp((Math.max(-3, Math.min(3, z)) + 3) / 6);
  }

  /**
   * Update all relevant performance baselines with the new score.
   * Uses EWMA with NORM_BASELINE_ALPHA to keep baselines current.
   */
  private async updateBaselines(
    actual: number,
    dims: { goal: string | null; industry: string | null; format: string | null },
  ): Promise<void> {
    const dimensions = [
      'global',
      ...(dims.goal     ? [`goal:${dims.goal}`]         : []),
      ...(dims.industry ? [`industry:${dims.industry}`] : []),
      ...(dims.format   ? [`format:${dims.format}`]     : []),
    ];

    for (const dimension of dimensions) {
      const existing = await this.prisma.performanceBaseline.findUnique({ where: { dimension } });

      if (!existing) {
        await this.prisma.performanceBaseline.create({
          data: { dimension, avgScore: actual, variance: 0.1, sampleCount: 1 },
        });
      } else {
        // EWMA update for mean
        const alpha    = NORM_BASELINE_ALPHA;
        const newAvg   = (1 - alpha) * existing.avgScore + alpha * actual;
        // EWMA update for variance (online Welford-style approximation)
        const newVar   = (1 - alpha) * existing.variance + alpha * Math.pow(actual - newAvg, 2);

        await this.prisma.performanceBaseline.update({
          where: { dimension },
          data: {
            avgScore:    newAvg,
            variance:    newVar,
            sampleCount: { increment: 1 },
          },
        });
      }
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PRIVATE — Uncertainty Model (Section 6)
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * uncertainty = scarcity × 0.4 + variance × 0.4 + staleness × 0.2
   *
   * High uncertainty → exploration probability increases, exploitation dominance reduces
   * Low uncertainty  → exploitation confidence is high
   */
  private computeUncertaintyScore(
    samples:     number,
    variance:    number,
    decayFactor: number,
  ): number {
    // Component 1: scarcity — fewer samples = more uncertain
    const scarcity = Math.max(0, 1 - samples / UNCERTAINTY_MAX_SAMPLES);

    // Component 2: variance — inconsistent results = uncertain
    const varianceComponent = Math.min(1, variance / UNCERTAINTY_VAR_MAX);

    // Component 3: recency — stale data = more uncertain
    const stalenessComponent = 1 - decayFactor;

    const raw = (
      scarcity          * UNCERTAINTY_W_SCARCITY  +
      varianceComponent * UNCERTAINTY_W_VARIANCE  +
      stalenessComponent * UNCERTAINTY_W_RECENCY
    );

    return clamp(raw);
  }

  /** EWMA variance of recent actual scores for this angle */
  private async computeRecentVariance(slug: string, window: number): Promise<number> {
    const recent = await this.prisma.learningCycle.findMany({
      where:   { angleSlug: slug },
      orderBy: { cycleAt: 'desc' },
      take:    window,
      select:  { actualScore: true },
    });
    if (recent.length < 2) return 0.1; // default to moderate uncertainty
    return computeVariance(recent.map(r => r.actualScore));
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PRIVATE — Temporal Decay (Section 7)
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * decay = exp( -days_since_last_use × ln(2) / HALF_LIFE_DAYS )
   *
   * At  0 days → 1.00 (fully relevant)
   * At 30 days → 0.50 (half relevant)
   * At 90 days → 0.13 (mostly forgotten — but never zero)
   */
  private computeDecayFactor(lastUsedAt: Date | null): number {
    if (!lastUsedAt) return 1.0; // first use — no decay
    const daysSince = (Date.now() - lastUsedAt.getTime()) / MS_PER_DAY;
    return Math.exp(-daysSince * Math.LN2 / DECAY_HALF_LIFE_DAYS);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PRIVATE — Anti-Overfitting (Section 8)
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Checks for >70% usage dominance in the recent ANTIFIT_WINDOW cycles.
   * When detected:
   *   1. Applies a DOMINANCE_TAX weight reduction to the dominant angle
   *   2. Resets its hysteresis lock (allows demotion)
   *   3. Returns a triggered exploration signal
   */
  private async detectAntiOverfitting(
    recentCycles: { angleSlug: string; actualScore: number; isWinner: boolean; campaignId: string }[],
  ): Promise<ExplorationSignal> {
    if (recentCycles.length < 5) {
      return { triggered: false, signal: 'none', reason: 'Insufficient data for overfitting check' };
    }

    const winners   = recentCycles.filter(c => c.isWinner).map(c => c.angleSlug);
    const winFreq   = freq(winners);
    const total     = winners.length;

    const dominant = Object.entries(winFreq).find(([, n]) => n / total >= DOMINANCE_USAGE_PCT);
    if (!dominant) {
      return { triggered: false, signal: 'none', reason: 'No overfitting detected — healthy distribution' };
    }

    const [dominantSlug, count] = dominant;
    const usagePct = Math.round((count / total) * 100);

    // Apply dominance tax to this angle's global weight
    const dominantWeight = await this.prisma.angleWeight.findFirst({
      where: { contextKey: 'global', angle: { slug: dominantSlug } },
      include: { angle: true },
    });

    if (dominantWeight) {
      const taxedWeight = clamp(dominantWeight.weight * (1 - DOMINANCE_TAX), WEIGHT_MIN, WEIGHT_MAX);
      await this.prisma.angleWeight.update({
        where: { id: dominantWeight.id },
        data:  { weight: taxedWeight, topLockCycles: 0 }, // reset lock → allows demotion
      });
      await this.syncAngleStatsWeight(dominantWeight.angleId);
      this.logger.warn(
        `[Anti-Overfit] "${dominantSlug}" dominates ${usagePct}% of wins — ` +
        `applied ${DOMINANCE_TAX * 100}% tax (${r2(dominantWeight.weight)} → ${r2(taxedWeight)})`,
      );
    }

    return {
      triggered: true,
      signal:    'overfitting',
      reason:    `"${dominantSlug}" wins ${usagePct}% of recent campaigns — overfitting risk`,
      action:    `Applied dominance tax, reset hysteresis lock, compressing weight gap`,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PRIVATE — Exploration Signal (stagnation / repetition / dominance)
  // ──────────────────────────────────────────────────────────────────────────

  private detectExplorationSignal(
    recentCycles: { angleSlug: string; actualScore: number; isWinner: boolean; campaignId: string }[],
  ): ExplorationSignal {
    if (recentCycles.length < 5) {
      return { triggered: false, signal: 'none', reason: 'Insufficient data for signal detection' };
    }

    // DOMINANCE: same winner X of last 5
    const recent5    = recentCycles.slice(0, 5);
    const winners5   = recent5.filter(c => c.isWinner).map(c => c.angleSlug);
    const winnerFreq = freq(winners5);
    const dominant   = Object.entries(winnerFreq).find(([, n]) => n >= EXPL_DOMINANCE_OF_5);
    if (dominant) {
      return {
        triggered: true,
        signal:    'dominance',
        reason:    `"${dominant[0]}" wins ${dominant[1]} of last 5 — angle dominance detected`,
        action:    'Compressing weight gap, reintroducing suppressed angles',
      };
    }

    // STAGNATION: score variance below threshold
    const scores10  = recentCycles.slice(0, 10).map(c => c.actualScore);
    const variance  = computeVariance(scores10);
    if (scores10.length >= 8 && variance < STAGNATION_VARIANCE) {
      return {
        triggered: true,
        signal:    'stagnation',
        reason:    `Score variance ${r2(variance)} < ${STAGNATION_VARIANCE} — system stagnating`,
        action:    'Boosting exploration probability, compressing weights',
      };
    }

    // REPETITION: same winner N campaigns in a row
    const campaignWinners = [
      ...recentCycles
        .reduce((map, c) => {
          if (c.isWinner && !map.has(c.campaignId)) map.set(c.campaignId, c.angleSlug);
          return map;
        }, new Map<string, string>())
        .values(),
    ];
    if (campaignWinners.length >= REPETITION_OF_N) {
      const allSame = campaignWinners.slice(0, REPETITION_OF_N).every(a => a === campaignWinners[0]);
      if (allSame) {
        return {
          triggered: true,
          signal:    'repetition',
          reason:    `"${campaignWinners[0]}" wins every campaign (${REPETITION_OF_N}+ in a row)`,
          action:    'Reducing winner weight gap, forcing angle variation',
        };
      }
    }

    return { triggered: false, signal: 'none', reason: 'No exploration signal — system healthy' };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PRIVATE — Utility
  // ──────────────────────────────────────────────────────────────────────────

  /** Move all global weights 20% toward 1.0 — reduces exploitation lock-in */
  private async compressWeightGap(): Promise<void> {
    const weights = await this.prisma.angleWeight.findMany({ where: { contextKey: 'global' } });
    await Promise.all(
      weights.map(w => {
        const compressed = w.weight + (1.0 - w.weight) * EXPLORE_COMPRESS_PCT;
        return this.prisma.angleWeight.update({
          where: { id: w.id },
          data:  { weight: clamp(compressed, WEIGHT_MIN, WEIGHT_MAX) },
        });
      }),
    );
  }

  /** Count consecutive wins or losses for an angle (most-recent first) */
  private async getConsecutiveStreak(slug: string, type: 'win' | 'loss'): Promise<number> {
    const recent = await this.prisma.learningCycle.findMany({
      where:   { angleSlug: slug },
      orderBy: { cycleAt: 'desc' },
      take:    10,
      select:  { isWinner: true },
    });
    let streak = 0;
    for (const r of recent) {
      const match = type === 'win' ? r.isWinner : !r.isWinner;
      if (match) streak++; else break;
    }
    return streak;
  }

  /** Mirror global AngleWeight back to AngleStats so the scoring system stays in sync */
  private async syncAngleStatsWeight(angleId: string): Promise<void> {
    const gw = await this.prisma.angleWeight.findUnique({
      where: { angleId_contextKey: { angleId, contextKey: 'global' } },
    });
    if (!gw) return;
    await this.prisma.angleStats.updateMany({ where: { angleId }, data: { weight: gw.weight } });
  }

  private computeLearningHealth(scores: number[]): LearningHealth {
    if (scores.length < 5) return 'healthy';
    const v = computeVariance(scores);
    if (v < STAGNATION_VARIANCE) return 'stagnating';
    if (v > 0.15)               return 'volatile';
    return 'healthy';
  }

  private emptyResult(campaignId: string, reason: string): CycleResult {
    return {
      campaignId,
      updatedAngles:     [],
      explorationSignal: { triggered: false, signal: 'none', reason },
      systemStats:       { anglesUpdated: 0, avgWeightChange: 0, avgNormalizedDelta: 0, totalCycles: 0 },
      cycleAt:           new Date().toISOString(),
    };
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Pure helpers
// ──────────────────────────────────────────────────────────────────────────────

function avg(nums: number[]): number {
  return nums.length ? nums.reduce((s, n) => s + n, 0) / nums.length : 0;
}

function clamp(v: number, lo = 0, hi = 1): number {
  return Math.max(lo, Math.min(hi, v));
}

function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

function freq(items: string[]): Record<string, number> {
  return items.reduce((a, x) => { a[x] = (a[x] || 0) + 1; return a; }, {} as Record<string, number>);
}

function computeVariance(nums: number[]): number {
  if (nums.length < 2) return 0;
  const mean = avg(nums);
  return avg(nums.map(n => Math.pow(n - mean, 2)));
}
