// ─── Weight Evolution Engine ──────────────────────────────────────────────────
// Implements the self-learning update algorithms.
//
// Core update formula:
//   NewWeight = clamp(OldWeight + LearningRate × OutcomeDelta, 0.1, 1.0)
//
// Stability rules (ALL enforced):
//   1. EWMA smoothing     — prevents overreaction to single outcomes
//   2. Max delta = 0.05   — prevents large jumps
//   3. Min inertia = 0.20 — no score can drop below 20% of its base
//   4. Decaying LR        — learning rate shrinks as user accumulates history
//   5. Bounded output     — all weights clamped to [0.10, 1.00]

// ── Learning Rate ─────────────────────────────────────────────────────────────

const BASE_LR   = 0.15;   // initial learning rate (first interactions)
const DECAY     = 0.92;   // geometric decay per 10 interactions
const MIN_LR    = 0.040;  // floor — system never stops learning entirely
const MAX_DELTA = 0.050;  // hard cap on per-update weight change

/**
 * Learning rate decays exponentially with interaction count.
 * Prevents overfitting to recent interactions after many data points.
 */
export function computeLearningRate(interactionCount: number): number {
  return Math.max(MIN_LR, BASE_LR * Math.pow(DECAY, Math.floor(interactionCount / 10)));
}

// ── EWMA Smoothing ────────────────────────────────────────────────────────────

const EWMA_ALPHA = 0.25; // smoothing factor — lower = more inertia

/**
 * Exponentially Weighted Moving Average.
 * New observation carries weight α; historical carries (1−α).
 * Prevents oscillation from sequential contrary signals.
 */
export function ewma(newObs: number, historical: number, alpha = EWMA_ALPHA): number {
  return alpha * newObs + (1 - alpha) * historical;
}

// ── Memory Score Update (Part A) ──────────────────────────────────────────────

export type OutcomeSignal = 'strong_success' | 'success' | 'neutral' | 'failure' | 'strong_failure';

/**
 * Maps raw interaction data to an outcome signal.
 */
export function classifyOutcome(params: {
  selected:  boolean;
  converted: boolean;
  skipped:   boolean;
  engagement: number;
}): OutcomeSignal {
  if (params.converted)                             return 'strong_success';
  if (params.selected && params.engagement > 0.70) return 'success';
  if (params.selected)                              return 'neutral';
  if (params.skipped  && params.engagement < 0.30) return 'strong_failure';
  if (params.skipped)                               return 'failure';
  return 'neutral';
}

const OUTCOME_DELTA: Record<OutcomeSignal, number> = {
  strong_success: +1.00,
  success:        +0.60,
  neutral:         0.00,
  failure:        -0.50,
  strong_failure: -0.80,
};

/**
 * Update an angle's memory modifier using EWMA + bounded delta.
 *
 * @param currentModifier  Current learned modifier (starts at 1.0)
 * @param signal           Outcome classification
 * @param interactionCount User's total interaction history count
 */
export function updateMemoryModifier(
  currentModifier:  number,
  signal:           OutcomeSignal,
  interactionCount: number
): number {
  const lr    = computeLearningRate(interactionCount);
  const raw   = OUTCOME_DELTA[signal];
  const delta = clamp(lr * raw, -MAX_DELTA, MAX_DELTA);

  // EWMA smooth the new modifier (target = current ± delta)
  const rawNew    = currentModifier + delta;
  const smoothed  = ewma(rawNew, currentModifier);

  return clamp(smoothed, 0.50, 1.45);  // angle modifiers: 0.5x floor, 1.45x ceiling
}

// ── Exploration Bias Update (Part B) ─────────────────────────────────────────

const EXPLORATION_LR   = 0.08;  // slower than memory (exploration is more stable)
const MAX_EXPLORE_DELTA = 0.03;  // bias shifts ≤ 3% per update

/**
 * Update exploration_bias_delta based on session skip and conversion rates.
 *
 * High skip rate   → user wants more variety → increase exploration bias
 * High conversion  → user is finding what they want → decrease exploration bias
 * No clear signal  → small reversion toward 0 (mean-reversion)
 */
export function updateExplorationBiasDelta(
  currentDelta: number,
  sessionSkipRate: number,
  sessionConversionRate: number
): number {
  let adjustment = 0;

  if (sessionSkipRate > 0.65) {
    // User skips a lot → wants more novel options
    adjustment = +EXPLORATION_LR * (sessionSkipRate - 0.5);
  } else if (sessionConversionRate > 0.45) {
    // User converts well → current angles work → tighten exploration
    adjustment = -EXPLORATION_LR * (sessionConversionRate - 0.3);
  } else {
    // Mean-reversion: gently pull delta back toward 0
    adjustment = -currentDelta * 0.05;
  }

  const clampedAdj = clamp(adjustment, -MAX_EXPLORE_DELTA, MAX_EXPLORE_DELTA);
  const rawNew     = currentDelta + clampedAdj;
  const smoothed   = ewma(rawNew, currentDelta);

  return clamp(smoothed, -0.40, 0.40);  // exploration delta bounded ±40%
}

// ── Risk Tolerance Update ─────────────────────────────────────────────────────

/**
 * If user consistently selects explore-slot angles → risk tolerance goes up.
 * If user consistently selects exploit-slot angles → risk tolerance goes down.
 */
export function updateRiskToleranceDelta(
  currentDelta:     number,
  exploreSelectRate: number,  // fraction of selections from explore slot
  interactionCount: number
): number {
  if (interactionCount < 5) return currentDelta;  // need enough data

  const lr  = computeLearningRate(interactionCount) * 0.5;  // half-speed update
  const dir = exploreSelectRate > 0.35 ? +1 : exploreSelectRate < 0.15 ? -1 : 0;
  const adj = clamp(lr * dir, -0.02, 0.02);
  return clamp(ewma(currentDelta + adj, currentDelta), -0.30, 0.30);
}

// ── Conversion Preference Map Update ─────────────────────────────────────────

/**
 * Track which angles led to conversions per context (goalType × platform).
 * Used to boost proven angle × context combinations.
 */
export function updateConversionPreference(
  currentMap: Record<string, number>,
  contextKey: string,          // e.g. 'sales::Meta'
  converted: boolean,
  interactionCount: number
): Record<string, number> {
  const lr      = computeLearningRate(interactionCount) * 0.6;
  const current = currentMap[contextKey] ?? 0.5;
  const target  = converted ? 1.0 : 0.0;
  const updated = ewma(target, current, lr);
  return { ...currentMap, [contextKey]: clamp(updated, 0.10, 0.90) };
}

// ── Stability Guard ───────────────────────────────────────────────────────────

const MIN_INERTIA = 0.20;  // no modifier can be driven below 20% of its base

/**
 * Apply minimum inertia — prevents aggressive pruning of angles.
 * Even if an angle performs badly, it retains MIN_INERTIA × baseModifier.
 */
export function applyInertiaGuard(
  currentModifier: number,
  baseModifier:    number = 1.0
): number {
  return Math.max(currentModifier, baseModifier * MIN_INERTIA);
}

// ── Utility ───────────────────────────────────────────────────────────────────

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export { clamp };
