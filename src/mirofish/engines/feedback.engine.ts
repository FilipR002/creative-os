// ─── MIROFISH Feedback Engine ─────────────────────────────────────────────────
//
// Pure computation functions for prediction vs actual comparison.
// Called after scoring completes to derive learning signals from the delta.
//
// No DB calls — all computation is pure math.
// ─────────────────────────────────────────────────────────────────────────────

export interface FeedbackComputation {
  /** actual − predicted. Positive = overperformed, negative = underperformed. */
  predictionError:             number;
  /** 0–1. How strongly this signal should influence learning. */
  learningSignalStrength:      number;
  /** How much this single signal contributes to exploration rate adjustment. */
  explorationAdjustmentSignal: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Error within ±SURPRISE_THRESHOLD is considered "expected" — no exploration push. */
const SURPRISE_THRESHOLD = 0.08;
/** Errors beyond this cap (±50%) are saturated — extreme outliers don't explode signals. */
const MAX_ERROR          = 0.50;
/** Max single-signal contribution to exploration rate. */
const MAX_EXPLORE_DELTA  = 0.15;

// ─── Core functions ───────────────────────────────────────────────────────────

/**
 * Compute raw prediction error.
 * Positive = angle overperformed (MIROFISH underestimated it).
 * Negative = angle underperformed (MIROFISH overestimated it).
 */
export function computePredictionError(predicted: number, actual: number): number {
  return clamp(actual - predicted, -MAX_ERROR, MAX_ERROR);
}

/**
 * Learning signal strength — how much should this feedback change angle weights?
 *
 * Components:
 *   - Error magnitude (primary driver)
 *   - Winner status (validated performance = stronger signal)
 *   - Synergy quality (higher synergy = more attributable to this angle combo)
 */
export function computeLearningSignalStrength(
  predictionError: number,
  synergyScore:    number | null,
  isWinner:        boolean,
): number {
  const errorMagnitude   = Math.abs(predictionError);
  const winnerBonus      = isWinner ? 0.15 : 0;
  const synergyFactor    = synergyScore !== null ? (synergyScore - 0.50) * 0.10 : 0;

  // Scale: ±50% error → 100% signal strength. Bonus for winners and high synergy.
  return clamp(errorMagnitude * 2.0 + winnerBonus + synergyFactor);
}

/**
 * Exploration adjustment contribution from a single signal.
 *
 * Both surprise directions (overperform AND underperform) push exploration:
 *   - Large underperformance → we were wrong about this angle → need to explore
 *   - Large overperformance  → surprise winners exist → stay curious
 *
 * Within SURPRISE_THRESHOLD → system is accurate → no adjustment.
 */
export function computeExplorationAdjustmentSignal(predictionError: number): number {
  const surprise = Math.abs(predictionError) - SURPRISE_THRESHOLD;
  if (surprise <= 0) return 0;

  // Underperformance is slightly more alarming than overperformance
  const directionWeight = predictionError < 0 ? 1.2 : 1.0;
  return clamp(surprise * directionWeight * 0.70, 0, MAX_EXPLORE_DELTA);
}

/**
 * Full feedback computation — all three signals in one call.
 */
export function computeFeedback(
  predicted:    number,
  actual:       number,
  synergyScore: number | null,
  isWinner:     boolean,
): FeedbackComputation {
  const predictionError = computePredictionError(predicted, actual);
  return {
    predictionError,
    learningSignalStrength:      r3(computeLearningSignalStrength(predictionError, synergyScore, isWinner)),
    explorationAdjustmentSignal: r3(computeExplorationAdjustmentSignal(predictionError)),
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clamp(v: number, lo = 0, hi = 1): number {
  return Math.min(hi, Math.max(lo, v));
}

function r3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
