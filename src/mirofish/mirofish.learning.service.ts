// ─── MIROFISH Learning Service ────────────────────────────────────────────────
//
// Manages the MIROFISH feedback loop — the mechanism by which the system
// learns from the gap between its predictions and actual scoring outcomes.
//
// Responsibilities:
//   1. injectFeedback()                  → write prediction vs actual after scoring
//   2. getAdaptiveExplorationAdjustment() → dynamic explore rate delta for angle service
//   3. getBatchFatigueSignals()          → MIROFISH fatigue signals for all angles
//   4. getMirofishLRModifier()           → LR multiplier for 4.2 learning cycle
//   5. getAnglePerformanceDelta()        → rolling prediction error per angle
//   6. runLearningLoop()                 → post-campaign calibration report
//   7. getSystemAccuracy()               → overall MIROFISH prediction accuracy
//
// CRITICAL SAFETY RULE:
//   This service ONLY influences:
//     - angle selection ranking weights (via LR modifier)
//     - exploration rate (via adjustment signal)
//     - fatigue sensitivity (via decline signal)
//   It NEVER:
//     - modifies creative winners
//     - overrides scoring system outputs
//     - bypasses memory system writes
// ─────────────────────────────────────────────────────────────────────────────

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { computeFeedback } from './engines/feedback.engine';
import {
  computeAdaptiveExplorationRate,
  computeMirofishLRModifier,
  ExplorationAdjustment,
} from './engines/exploration.engine';
import type { MirofishResult } from './engines/aggregation.engine';

// ─── Signal window constants ──────────────────────────────────────────────────

/** How many recent signals to use for exploration rate computation. */
const EXPLORE_SIGNAL_WINDOW = 20;
/** How many recent signals to use for per-angle fatigue detection. */
const FATIGUE_SIGNAL_WINDOW = 10;
/** How many recent signals to use for LR modifier. */
const LR_MODIFIER_WINDOW    = 8;
/** Consecutive negative-error signals needed to flag MIROFISH decline. */
const DECLINE_STREAK_MIN    = 3;
/** Decline signal strength threshold to escalate fatigue. */
const DECLINE_STRENGTH_MIN  = 0.45;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FeedbackInput {
  creativeId:    string;
  campaignId:    string;
  angleSlug:     string;
  secondarySlug?: string;
  goal?:         string;
  predicted:     MirofishResult;
  actual: {
    score:    number;
    isWinner: boolean;
  };
}

export interface MirofishFatigueSignal {
  /** True when MIROFISH predicts continued decline for this angle. */
  declining:       boolean;
  /** 0–1. How strongly MIROFISH believes the decline is real. */
  signalStrength:  number;
  /** Trend direction: negative = declining, positive = improving. */
  trendDirection:  number;
}

export interface LearningLoopReport {
  campaignId:        string;
  signalsProcessed:  number;
  systemAccuracy:    number;           // 1 - avg|predictionError|
  avgPredictionError: number;          // signed mean
  explorationAdjustment: number;       // computed delta for future runs
  angleDeltaSummary: {
    slug:             string;
    avgError:         number;
    signalCount:      number;
    recommendation:   'increase_weight' | 'decrease_weight' | 'stable';
  }[];
  calibrationStatus: 'improving' | 'stable' | 'degrading';
  ranAt:             string;
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class MirofishLearningService {
  private readonly logger = new Logger(MirofishLearningService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── 1. Feedback injection — write prediction vs actual ────────────────────

  /**
   * Called fire-and-forget from ScoringService after evaluate() completes.
   * Compares MIROFISH prediction against actual scoring results and
   * persists a MirofishSignal record with all derived learning signals.
   */
  async injectFeedback(input: FeedbackInput): Promise<void> {
    const predicted = input.predicted.overall_score;
    const actual    = input.actual.score;
    const synergy   = input.predicted.angle_analysis.synergy_score;

    const fb = computeFeedback(predicted, actual, synergy, input.actual.isWinner);

    try {
      await this.prisma.mirofishSignal.create({
        data: {
          creativeId:            input.creativeId,
          campaignId:            input.campaignId,
          angleSlug:             input.angleSlug,
          secondarySlug:         input.secondarySlug ?? null,
          goal:                  input.goal ?? null,
          predictedScore:        predicted,
          predictedConversion:   input.predicted.conversion_probability,
          predictedAttention:    input.predicted.attention_score,
          predictedTrust:        input.predicted.trust_score,
          synergyScore:          synergy,
          actualScore:           actual,
          isWinner:              input.actual.isWinner,
          predictionError:       fb.predictionError,
          learningSignalStrength: fb.learningSignalStrength,
          explorationAdjustment: fb.explorationAdjustmentSignal,
        },
      });

      this.logger.debug(
        `[MIROFISH-LL] Feedback injected — angle=${input.angleSlug} ` +
        `predicted=${r3(predicted)} actual=${r3(actual)} ` +
        `error=${r3(fb.predictionError)} strength=${r3(fb.learningSignalStrength)}`,
      );
    } catch (err) {
      this.logger.error(`[MIROFISH-LL] Failed to write signal: ${(err as Error).message}`);
    }
  }

  // ── 2. Adaptive exploration rate ─────────────────────────────────────────

  /**
   * Returns the delta to add to the current exploration rate.
   * Reads recent MirofishSignal records (optionally filtered by goal).
   * Range: -0.10 to +0.25.
   */
  async getAdaptiveExplorationAdjustment(context: {
    goal?:     string | null;
    clientId?: string | null;
  } = {}): Promise<number> {
    const signals = await this.prisma.mirofishSignal.findMany({
      where: {
        ...(context.goal ? { goal: context.goal } : {}),
        predictionError: { not: null },
      },
      orderBy: { createdAt: 'desc' },
      take:    EXPLORE_SIGNAL_WINDOW,
      select:  { predictionError: true },
    });

    if (signals.length < 3) return 0;

    const errors = signals
      .map(s => s.predictionError)
      .filter((e): e is number => e !== null);

    // computeAdaptiveExplorationRate expects a base rate, we return only the delta
    const result = computeAdaptiveExplorationRate(0, errors);
    return result.adjustment;
  }

  /**
   * Full adaptive exploration rate computation (delta + final rate).
   * Used internally and by the controller's status endpoint.
   */
  async computeFullExplorationAdjustment(
    baseRate: number,
    context: { goal?: string | null } = {},
  ): Promise<ExplorationAdjustment> {
    const signals = await this.prisma.mirofishSignal.findMany({
      where: {
        ...(context.goal ? { goal: context.goal } : {}),
        predictionError: { not: null },
      },
      orderBy: { createdAt: 'desc' },
      take:    EXPLORE_SIGNAL_WINDOW,
      select:  { predictionError: true },
    });

    const errors = signals
      .map(s => s.predictionError)
      .filter((e): e is number => e !== null);

    return computeAdaptiveExplorationRate(baseRate, errors);
  }

  // ── 3. Fatigue signals (batch) ────────────────────────────────────────────

  /**
   * Returns MIROFISH fatigue signals for a batch of angle slugs.
   * Reads per-angle recent signal history and detects declining prediction trends.
   *
   * Called by AngleService at the start of selectForConcept() to enrich fatigue detection.
   */
  async getBatchFatigueSignals(
    slugs: string[],
  ): Promise<Record<string, MirofishFatigueSignal>> {
    if (!slugs.length) return {};

    const signals = await this.prisma.mirofishSignal.findMany({
      where: {
        angleSlug:       { in: slugs },
        predictionError: { not: null },
      },
      orderBy: { createdAt: 'desc' },
      take:    slugs.length * FATIGUE_SIGNAL_WINDOW,
      select:  { angleSlug: true, predictionError: true, learningSignalStrength: true },
    });

    const result: Record<string, MirofishFatigueSignal> = {};

    for (const slug of slugs) {
      const angleSignals = signals
        .filter(s => s.angleSlug === slug)
        .slice(0, FATIGUE_SIGNAL_WINDOW);

      result[slug] = this.computeFatigueSignalFromHistory(angleSignals);
    }

    return result;
  }

  /** Fatigue signal for a single angle (for one-off lookups). */
  async getMirofishFatigueSignal(slug: string): Promise<MirofishFatigueSignal> {
    const signals = await this.prisma.mirofishSignal.findMany({
      where:   { angleSlug: slug, predictionError: { not: null } },
      orderBy: { createdAt: 'desc' },
      take:    FATIGUE_SIGNAL_WINDOW,
      select:  { predictionError: true, learningSignalStrength: true },
    });

    return this.computeFatigueSignalFromHistory(signals);
  }

  // ── 4. LR modifier for 4.2 learning service ───────────────────────────────

  /**
   * Returns a learning rate multiplier (0.80–1.20) for a specific angle.
   * High prediction errors → learn faster (amplify LR).
   * Low prediction errors  → stable, reduce LR slightly.
   *
   * Called by LearningService.runCycle() for each angle being updated.
   */
  async getMirofishLRModifier(slug: string): Promise<number> {
    const signals = await this.prisma.mirofishSignal.findMany({
      where:   { angleSlug: slug, predictionError: { not: null } },
      orderBy: { createdAt: 'desc' },
      take:    LR_MODIFIER_WINDOW,
      select:  { predictionError: true },
    });

    if (signals.length < 3) return 1.0; // neutral until enough history

    const errors = signals
      .map(s => s.predictionError)
      .filter((e): e is number => e !== null);

    return computeMirofishLRModifier(errors);
  }

  // ── 5. Angle performance delta ────────────────────────────────────────────

  /**
   * Returns the rolling mean prediction error for an angle.
   * Used by MirofishService.simulate() to enrich the output with history.
   */
  async getAnglePerformanceDelta(slug: string): Promise<number | null> {
    const signals = await this.prisma.mirofishSignal.findMany({
      where:   { angleSlug: slug, predictionError: { not: null } },
      orderBy: { createdAt: 'desc' },
      take:    LR_MODIFIER_WINDOW,
      select:  { predictionError: true },
    });

    if (signals.length < 3) return null;

    const errors = signals
      .map(s => s.predictionError)
      .filter((e): e is number => e !== null);

    return r3(avg(errors));
  }

  // ── 6. Post-campaign learning loop ────────────────────────────────────────

  /**
   * Full post-campaign calibration run.
   * Called fire-and-forget from ScoringService after all feedback is injected.
   *
   * Steps:
   *   1. Collect all MirofishSignals for this campaign
   *   2. Compute per-angle prediction accuracy
   *   3. Compute global exploration adjustment
   *   4. Return calibration report (does NOT write to DB — purely diagnostic)
   */
  async runLearningLoop(campaignId: string): Promise<LearningLoopReport> {
    const signals = await this.prisma.mirofishSignal.findMany({
      where:   { campaignId, predictionError: { not: null } },
      orderBy: { createdAt: 'desc' },
      select: {
        angleSlug:       true,
        predictionError: true,
        isWinner:        true,
        learningSignalStrength: true,
      },
    });

    if (!signals.length) {
      return this.emptyReport(campaignId);
    }

    const errors = signals
      .map(s => s.predictionError)
      .filter((e): e is number => e !== null);

    const avgAbsError      = avg(errors.map(Math.abs));
    const avgSignedError   = avg(errors);
    const systemAccuracy   = r3(Math.max(0, 1 - avgAbsError));

    // Per-angle summary
    const angleMap = new Map<string, number[]>();
    for (const s of signals) {
      if (s.predictionError !== null) {
        const arr = angleMap.get(s.angleSlug) ?? [];
        arr.push(s.predictionError);
        angleMap.set(s.angleSlug, arr);
      }
    }

    const angleDeltaSummary = [...angleMap.entries()].map(([slug, errs]) => {
      const mean = avg(errs);
      return {
        slug,
        avgError:        r3(mean),
        signalCount:     errs.length,
        recommendation:  (
          mean > 0.06  ? 'increase_weight' :
          mean < -0.06 ? 'decrease_weight' :
                         'stable'
        ) as 'increase_weight' | 'decrease_weight' | 'stable',
      };
    });

    // Global exploration adjustment
    const { adjustment } = computeAdaptiveExplorationRate(0.20, errors);

    // Calibration status
    const prevSignals = await this.prisma.mirofishSignal.findMany({
      where:  { predictionError: { not: null } },
      orderBy: { createdAt: 'desc' },
      take:   40,
      skip:   signals.length,  // signals before this campaign
      select: { predictionError: true },
    });

    let calibrationStatus: LearningLoopReport['calibrationStatus'] = 'stable';
    if (prevSignals.length >= 5) {
      const prevErrors     = prevSignals.map(s => s.predictionError).filter((e): e is number => e !== null);
      const prevAbsError   = avg(prevErrors.map(Math.abs));
      const improvement    = prevAbsError - avgAbsError;
      calibrationStatus    =
        improvement > 0.02 ? 'improving' :
        improvement < -0.02 ? 'degrading' :
        'stable';
    }

    this.logger.log(
      `[MIROFISH-LL] Learning loop — campaign=${campaignId} signals=${signals.length} ` +
      `accuracy=${systemAccuracy} exploreAdj=${r3(adjustment)} status=${calibrationStatus}`,
    );

    return {
      campaignId,
      signalsProcessed:   signals.length,
      systemAccuracy,
      avgPredictionError: r3(avgSignedError),
      explorationAdjustment: r3(adjustment),
      angleDeltaSummary,
      calibrationStatus,
      ranAt: new Date().toISOString(),
    };
  }

  // ── 7. System accuracy status ─────────────────────────────────────────────

  /**
   * Returns overall MIROFISH prediction accuracy from recent signal history.
   * Exposed via controller for monitoring.
   */
  async getSystemAccuracy(): Promise<{
    accuracy:           number;
    avgAbsError:        number;
    signalCount:        number;
    explorationAdj:     number;
    topUnderestimated:  string[];
    topOverestimated:   string[];
  }> {
    const signals = await this.prisma.mirofishSignal.findMany({
      where:   { predictionError: { not: null } },
      orderBy: { createdAt: 'desc' },
      take:    100,
      select:  { angleSlug: true, predictionError: true },
    });

    if (!signals.length) {
      return { accuracy: 1, avgAbsError: 0, signalCount: 0, explorationAdj: 0, topUnderestimated: [], topOverestimated: [] };
    }

    const errors     = signals.map(s => s.predictionError).filter((e): e is number => e !== null);
    const avgAbsErr  = avg(errors.map(Math.abs));
    const accuracy   = r3(Math.max(0, 1 - avgAbsErr));

    // Per-angle mean error
    const angleErrors = new Map<string, number[]>();
    for (const s of signals) {
      if (s.predictionError !== null) {
        const arr = angleErrors.get(s.angleSlug) ?? [];
        arr.push(s.predictionError);
        angleErrors.set(s.angleSlug, arr);
      }
    }

    const angleMeans = [...angleErrors.entries()]
      .map(([slug, errs]) => ({ slug, mean: avg(errs) }))
      .filter(a => angleErrors.get(a.slug)!.length >= 2);

    const topUnderestimated = angleMeans
      .filter(a => a.mean > 0.05)
      .sort((a, b) => b.mean - a.mean)
      .slice(0, 3)
      .map(a => a.slug);

    const topOverestimated = angleMeans
      .filter(a => a.mean < -0.05)
      .sort((a, b) => a.mean - b.mean)
      .slice(0, 3)
      .map(a => a.slug);

    const { adjustment } = computeAdaptiveExplorationRate(0.20, errors);

    return { accuracy, avgAbsError: r3(avgAbsErr), signalCount: signals.length, explorationAdj: r3(adjustment), topUnderestimated, topOverestimated };
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private computeFatigueSignalFromHistory(
    signals: { predictionError: number | null; learningSignalStrength?: number | null }[],
  ): MirofishFatigueSignal {
    const errors = signals
      .map(s => s.predictionError)
      .filter((e): e is number => e !== null);

    if (errors.length < 2) {
      return { declining: false, signalStrength: 0, trendDirection: 0 };
    }

    // Count consecutive negative errors (most-recent first → most-recent errors = underperformance)
    let negativeStreak = 0;
    for (const e of errors) {
      if (e < -0.03) negativeStreak++;
      else break;
    }

    // Trend direction: positive mean = improving, negative = declining
    const trendDirection = r3(avg(errors));

    // Signal strength: avg learningSignalStrength of declining signals
    const decliningSignals = signals
      .filter(s => (s.predictionError ?? 0) < -0.03 && s.learningSignalStrength !== null);

    const signalStrength = decliningSignals.length > 0
      ? avg(decliningSignals.map(s => s.learningSignalStrength ?? 0))
      : 0;

    const declining =
      negativeStreak >= DECLINE_STREAK_MIN ||
      (trendDirection < -0.05 && signalStrength > DECLINE_STRENGTH_MIN);

    return {
      declining,
      signalStrength: r3(Math.min(signalStrength, 1)),
      trendDirection,
    };
  }

  private emptyReport(campaignId: string): LearningLoopReport {
    return {
      campaignId,
      signalsProcessed:      0,
      systemAccuracy:        1,
      avgPredictionError:    0,
      explorationAdjustment: 0,
      angleDeltaSummary:     [],
      calibrationStatus:     'stable',
      ranAt:                 new Date().toISOString(),
    };
  }
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────

function avg(arr: number[]): number {
  return arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
}

function r3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
