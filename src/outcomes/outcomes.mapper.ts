// ─── Outcome Learning Layer — Metric Normalization ───────────────────────────

import type { OutcomeMetricsInput, NormalizedMetrics } from './outcomes.types';

// Performance score weights
const W_CTR  = 0.30;
const W_CR   = 0.50;
const W_ROAS = 0.20;

// ROAS is normalized to [0,1] range for scoring.
// A ROAS of 2.0 = break-even baseline; cap useful signal at 10.0.
const ROAS_BASELINE = 2.0;
const ROAS_CAP      = 10.0;

/**
 * Normalize raw ad metrics into engine-usable signals.
 * Returns safe values even when denominators are zero.
 */
export function normalizeMetrics(m: OutcomeMetricsInput): NormalizedMetrics {
  const ctr            = m.impressions > 0 ? clamp(m.clicks / m.impressions)       : 0.0;
  const conversionRate = m.clicks       > 0 ? clamp(m.conversions / m.clicks)      : 0.0;

  // ROAS: default to 1.0 (neutral) if no spend/revenue data
  let rawRoas = 1.0;
  if (m.spend && m.spend > 0 && m.revenue !== undefined) {
    rawRoas = m.revenue / m.spend;
  }
  const roas = rawRoas;

  // Normalize ROAS relative to baseline for scoring (0–1 range)
  const roasNorm = clamp((rawRoas - ROAS_BASELINE) / (ROAS_CAP - ROAS_BASELINE) + 0.5);

  const performanceScore = clamp(
    ctr * W_CTR + conversionRate * W_CR + roasNorm * W_ROAS
  );

  return { ctr, conversionRate, roas, performanceScore };
}

function clamp(v: number, lo = 0, hi = 1): number {
  return Math.max(lo, Math.min(hi, v));
}

// ── Weight-space remapping ────────────────────────────────────────────────────
// performanceScore lives in ~[0.05, 0.40] due to realistic CTR/CR ceilings.
// Direct EWMA against a 1.0 weight always pulls down — weights can never rise.
// This function linearly remaps the score range → weight range [0.5, 1.5]
// so EWMA can move weights in BOTH directions depending on performance.
//
//   score 0.05 (bad)     → weight 0.50  (reduce this angle)
//   score 0.225 (median) → weight 1.00  (neutral — no change)
//   score 0.40 (great)   → weight 1.50  (boost this angle)
//
export function mapPerformanceToWeight(score: number): number {
  const MIN_SCORE  = 0.05;
  const MAX_SCORE  = 0.40;
  const WEIGHT_MIN = 0.50;
  const WEIGHT_MAX = 1.50;
  const normalized = (score - MIN_SCORE) / (MAX_SCORE - MIN_SCORE);
  const clamped    = Math.max(0, Math.min(1, normalized));
  return WEIGHT_MIN + clamped * (WEIGHT_MAX - WEIGHT_MIN);
}
