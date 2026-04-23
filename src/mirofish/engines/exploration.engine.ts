// ─── MIROFISH Exploration Engine ─────────────────────────────────────────────
//
// Computes an adaptive exploration rate adjustment from recent signal history.
//
// Rules:
//   High prediction error variance → system is unpredictable → explore more
//   Low prediction error variance  → system is well-calibrated → can exploit
//   Systematic underperformance    → angles overestimated → explore alternatives
//   Repeated surprise winners      → patterns outside current pool → explore
//
// Output: rate adjustment delta clamped to [EXPLORE_MIN, EXPLORE_MAX].
// ─────────────────────────────────────────────────────────────────────────────

export interface ExplorationAdjustment {
  /** Delta to add to the current base explore rate. */
  adjustment:    number;
  /** Final rate after applying adjustment (clamped). */
  adjustedRate:  number;
  /** Machine-readable reason for the adjustment. */
  rationale:     ExplorationRationale;
}

export type ExplorationRationale =
  | 'insufficient_history'
  | 'stable_predictions'
  | 'moderate_variance'
  | 'high_prediction_variance'
  | 'systematic_underperformance'
  | 'repeated_surprise_winners'
  | 'combined_pressure';

// ─── Thresholds ───────────────────────────────────────────────────────────────

/** Minimum number of recent signals needed to compute a meaningful adjustment. */
const MIN_SIGNALS              = 3;
/** Below this variance → stable system → reduce exploration. */
const VARIANCE_LOW             = 0.005;
/** Above this variance → unpredictable → increase exploration. */
const VARIANCE_HIGH            = 0.028;
/** Systematic bias threshold (mean error more negative than this → underperforming). */
const SYSTEMATIC_BIAS_FLOOR    = -0.06;
/** How many recent signals with |error| > 0.10 counts as "repeated surprise". */
const SURPRISE_REPEAT_TRIGGER  = 3;
/** Absolute floor and ceiling for explore rate (must match RATES in angle.service). */
const EXPLORE_MIN              = 0.10;
const EXPLORE_MAX              = 0.45;

// ─── Core function ────────────────────────────────────────────────────────────

/**
 * Compute adaptive exploration rate adjustment from a rolling window of
 * recent prediction errors (most-recent first).
 *
 * @param baseRate    Current explore rate (from RATES.baseline.explore etc.)
 * @param recentErrors  Array of predictionError values from recent MirofishSignals
 */
export function computeAdaptiveExplorationRate(
  baseRate:     number,
  recentErrors: number[],
): ExplorationAdjustment {

  if (recentErrors.length < MIN_SIGNALS) {
    return {
      adjustment:   0,
      adjustedRate: clamp(baseRate, EXPLORE_MIN, EXPLORE_MAX),
      rationale:    'insufficient_history',
    };
  }

  const mean     = avg(recentErrors);
  const variance = avg(recentErrors.map(e => Math.pow(e - mean, 2)));

  // Track multiple pressure signals — apply largest or combine
  let adjustment = 0;
  let rationale: ExplorationRationale = 'moderate_variance';

  // ── 1. Variance-based signal ────────────────────────────────────────────
  if (variance > VARIANCE_HIGH) {
    adjustment = 0.10 + (variance - VARIANCE_HIGH) * 2.0;  // scale with excess
    rationale  = 'high_prediction_variance';
  } else if (variance < VARIANCE_LOW) {
    adjustment = -0.05;  // very stable → reward with exploitation
    rationale  = 'stable_predictions';
  }

  // ── 2. Systematic underperformance ─────────────────────────────────────
  if (mean < SYSTEMATIC_BIAS_FLOOR) {
    const biasContrib = Math.abs(mean) * 0.60;
    if (biasContrib > adjustment) {
      adjustment = biasContrib;
      rationale  = 'systematic_underperformance';
    } else {
      adjustment += biasContrib * 0.40; // partial add if variance already leading
      rationale  = 'combined_pressure';
    }
  }

  // ── 3. Repeated surprise winners (many large-error positives) ───────────
  const surpriseCount = recentErrors.filter(e => Math.abs(e) > 0.10).length;
  if (surpriseCount >= SURPRISE_REPEAT_TRIGGER) {
    const surpriseContrib = 0.06 + (surpriseCount - SURPRISE_REPEAT_TRIGGER) * 0.02;
    if (surpriseContrib > Math.abs(adjustment)) {
      adjustment = surpriseContrib;
      rationale  = 'repeated_surprise_winners';
    } else {
      adjustment += surpriseContrib * 0.30;
      rationale  = 'combined_pressure';
    }
  }

  // ── Final clamp ─────────────────────────────────────────────────────────
  adjustment = clamp(adjustment, -0.10, 0.25);  // max ±25% from a single signal pass
  const adjustedRate = clamp(baseRate + adjustment, EXPLORE_MIN, EXPLORE_MAX);

  return {
    adjustment:   r3(adjustment),
    adjustedRate: r3(adjustedRate),
    rationale,
  };
}

/**
 * Compute MIROFISH-based learning rate modifier for the 4.2 learning system.
 * High prediction errors → angle is hard to model → learn faster.
 * Low prediction errors  → angle is well-understood → standard LR.
 *
 * Output range: [0.80, 1.20] — multiplied against base LR in LearningService.
 */
export function computeMirofishLRModifier(recentErrors: number[]): number {
  if (recentErrors.length < MIN_SIGNALS) return 1.0; // neutral default

  const avgAbsError = avg(recentErrors.map(Math.abs));

  // Calibration point: 0.10 avg error → 1.00x modifier (no change)
  // 0.25 avg error → ~1.15x (learn faster)
  // 0.05 avg error → ~0.95x (stable — slow down)
  const modifier = 1.0 + (avgAbsError - 0.10) * 1.0;
  return clamp(modifier, 0.80, 1.20);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function avg(arr: number[]): number {
  return arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
}

function clamp(v: number, lo = 0, hi = 1): number {
  return Math.min(hi, Math.max(lo, v));
}

function r3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
