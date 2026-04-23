// ─── 4.4 Fatigue Engine — Pure Computation ────────────────────────────────────
//
// No dependency injection. No Prisma. No side effects.
// Input: 5 normalised signals (0–1 each).
// Output: AngleFatigueResult shape, minus DB fields.
//
// FINAL FATIGUE FORMULA:
//   fatigue_score =
//     (usage_frequency      × 0.35)
//   + (performance_decay    × 0.30)
//   + (mirofish_neg_delta   × 0.20)
//   + (blending_repetition  × 0.10)
//   + (ranking_drop_vel     × 0.05)
//
// State mapping (0–1):
//   0.00–0.25 → HEALTHY
//   0.25–0.55 → WARMING
//   0.55–0.80 → FATIGUED
//   0.80–1.00 → BLOCKED  (all 4 conditions must generally converge)
// ─────────────────────────────────────────────────────────────────────────────

import { FatigueSignals, FatigueState, AngleFatigueResult } from './fatigue.types';

// ─── Weights ──────────────────────────────────────────────────────────────────

const W = {
  usageFrequency:       0.35,
  performanceDecay:     0.30,
  mirofishNegativeDelta: 0.20,
  blendingRepetition:   0.10,
  rankingDropVelocity:  0.05,
} as const;

// ─── State thresholds ─────────────────────────────────────────────────────────

const THRESHOLDS = {
  WARMING:  0.25,
  FATIGUED: 0.55,
  BLOCKED:  0.80,
} as const;

// ─── Core formula ─────────────────────────────────────────────────────────────

export function computeFatigueScore(s: FatigueSignals): number {
  const safe = (v: number) => isFinite(v) ? v : 0;
  const raw =
    safe(s.usageFrequency)        * W.usageFrequency        +
    safe(s.performanceDecay)      * W.performanceDecay       +
    safe(s.mirofishNegativeDelta) * W.mirofishNegativeDelta  +
    safe(s.blendingRepetition)    * W.blendingRepetition     +
    safe(s.rankingDropVelocity)   * W.rankingDropVelocity;

  return clamp(raw);
}

export function fatigueStateFromScore(score: number): FatigueState {
  if (score >= THRESHOLDS.BLOCKED)  return 'BLOCKED';
  if (score >= THRESHOLDS.FATIGUED) return 'FATIGUED';
  if (score >= THRESHOLDS.WARMING)  return 'WARMING';
  return 'HEALTHY';
}

// ─── Probability modifier ─────────────────────────────────────────────────────
//
// HEALTHY  →  0           (no penalty)
// WARMING  →  −0.10 to −0.25 (linear within state range)
// FATIGUED →  −0.30 to −0.60 (linear within state range)
// BLOCKED  →  −1.00       (signal only — drives finalWeight to 0 via conflict resolver;
//                          orchestrator is the sole authority on exclusion)

export function probabilityModifier(state: FatigueState, score: number): number {
  switch (state) {
    case 'HEALTHY':
      return 0;

    case 'WARMING': {
      const t = normalize(score, THRESHOLDS.WARMING, THRESHOLDS.FATIGUED);
      return clamp(-(0.10 + t * 0.15), -1, 0.25);   // −0.10 → −0.25
    }

    case 'FATIGUED': {
      const t = normalize(score, THRESHOLDS.FATIGUED, THRESHOLDS.BLOCKED);
      return clamp(-(0.30 + t * 0.30), -1, 0.25);   // −0.30 → −0.60
    }

    case 'BLOCKED':
      return -1.00;
  }
}

// ─── Exploration signal ───────────────────────────────────────────────────────
//
// HEALTHY  →  0
// WARMING  →  +0.03 to +0.10
// FATIGUED →  +0.10 to +0.25
// BLOCKED  →  +0.25 (maximum exploration pressure)

export function explorationSignal(state: FatigueState, score: number): number {
  switch (state) {
    case 'HEALTHY':
      return 0;

    case 'WARMING': {
      const t = normalize(score, THRESHOLDS.WARMING, THRESHOLDS.FATIGUED);
      return 0.03 + t * 0.07;            // +0.03 → +0.10
    }

    case 'FATIGUED': {
      const t = normalize(score, THRESHOLDS.FATIGUED, THRESHOLDS.BLOCKED);
      return 0.10 + t * 0.15;            // +0.10 → +0.25
    }

    case 'BLOCKED':
      return 0.25;
  }
}

// ─── Reasoning builder ────────────────────────────────────────────────────────

export function buildReasoning(
  slug:   string,
  state:  FatigueState,
  score:  number,
  s:      FatigueSignals,
): string {
  const parts: string[] = [`${slug} → ${state} (score=${fmt(score)})`];

  if (s.usageFrequency >= 0.60)
    parts.push(`high usage frequency (${fmt(s.usageFrequency)})`);

  if (s.performanceDecay >= 0.40)
    parts.push(`performance decay (${fmt(s.performanceDecay)})`);

  if (s.mirofishNegativeDelta >= 0.35)
    parts.push(`MIROFISH negative delta (${fmt(s.mirofishNegativeDelta)})`);

  if (s.blendingRepetition >= 0.50)
    parts.push(`blending repetition saturation (${fmt(s.blendingRepetition)})`);

  if (s.rankingDropVelocity >= 0.50)
    parts.push(`memory rank dropping (${fmt(s.rankingDropVelocity)})`);

  if (parts.length === 1) parts.push('all signals nominal');

  return parts.join('; ');
}

// ─── Full computation (single angle) ─────────────────────────────────────────

export function computeAngleFatigue(
  slug:    string,
  signals: FatigueSignals,
): AngleFatigueResult {
  const score   = computeFatigueScore(signals);
  const state   = fatigueStateFromScore(score);
  const probMod = probabilityModifier(state, score);
  const expSig  = explorationSignal(state, score);
  const reason  = buildReasoning(slug, state, score, signals);

  return {
    angle_name:           slug,
    fatigue_state:        state,
    fatigue_score:        round4(score),
    probability_modifier: round4(probMod),
    exploration_signal:   round4(expSig),
    reasoning:            reason,
    _signals:             {
      usageFrequency:       round4(signals.usageFrequency),
      performanceDecay:     round4(signals.performanceDecay),
      mirofishNegativeDelta: round4(signals.mirofishNegativeDelta),
      blendingRepetition:   round4(signals.blendingRepetition),
      rankingDropVelocity:  round4(signals.rankingDropVelocity),
    },
  };
}

// ─── Signal normalisation helpers (exported for service use) ─────────────────

/** Usage in last 20 records → 0–1. Saturates at 5 uses = 1.0. */
export function normalizeUsageFrequency(usageIn20: number): number {
  return clamp(usageIn20 / 5);
}

/**
 * Performance decay: compare recent 3 vs prior 3-6 avg scores.
 * Returns 0 (no decay) to 1 (complete collapse).
 */
export function normalizePerformanceDecay(recentAvg: number, priorAvg: number): number {
  if (priorAvg <= 0) return 0;
  const drop = (priorAvg - recentAvg) / priorAvg;  // negative drop = improving
  return clamp(drop * 2);   // 50% drop → 1.0
}

/**
 * MIROFISH negative delta: avg absolute value of negative prediction errors.
 * 0 = accurate (or no data), 1 = badly wrong. Saturates at ±0.5 error.
 */
export function normalizeMirofishNegativeDelta(avgNegativeError: number): number {
  return clamp(Math.abs(avgNegativeError) / 0.5);
}

/**
 * Blending repetition: count of secondary appearances in recent MirofishSignals.
 * Saturates at 5 secondary uses.
 */
export function normalizeBlendingRepetition(secondaryCount: number): number {
  return clamp(secondaryCount / 5);
}

/**
 * Ranking drop velocity: proxy from AngleWeight smoothedScore.
 * Below 0.40 with meaningful samples → fast drop.
 */
export function normalizeRankingDropVelocity(
  smoothedScore:    number,
  sampleCount:      number,
  uncertaintyScore: number,
): number {
  if (sampleCount < 3) return 0;     // not enough data to judge velocity
  const scoreDrop     = clamp(0.50 - smoothedScore) * 2;   // 0.50 → 0, 0.0 → 1
  const uncertaintyMod = uncertaintyScore * 0.20;           // high uncertainty amplifies velocity signal
  return clamp(scoreDrop + uncertaintyMod);
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function clamp(v: number, lo = 0, hi = 1): number { return Math.min(hi, Math.max(lo, v)); }
function fmt(n: number): string   { return n.toFixed(3); }
function round4(n: number): number { return Math.round(n * 10000) / 10000; }

/**
 * Normalise a score within a state band to [0, 1].
 * Used for linear interpolation within WARMING / FATIGUED bands.
 */
function normalize(score: number, lo: number, hi: number): number {
  const span = hi - lo;
  if (span <= 0) return 0;
  return clamp((score - lo) / span);
}
