// ─── MIROFISH Variance Engine ─────────────────────────────────────────────────
//
// Computes the distribution variance of composite scores across persona clusters.
//
// High variance → polarizing creative (low-scoring clusters pull distribution apart)
//              → viral potential (strong reaction either way is shareable)
// Low variance  → safe, stable — predictable broad appeal
//
// Uses population-weighted variance:
//   var = Σ weight_i × (score_i - mean)²
// ─────────────────────────────────────────────────────────────────────────────

import { ClusterResponse } from './simulation.engine';

export interface VarianceResult {
  /** Population-weighted mean composite score across all clusters. */
  mean:     number;
  /** Population-weighted variance (0–0.25 theoretical max). */
  variance: number;
  /** Normalised variance scaled to 0–1 for output contract. */
  normalisedVariance: number;
  /** Qualitative label. */
  label:   'safe' | 'moderate' | 'polarizing';
  /** True when variance indicates split-audience / viral potential. */
  viralPotential: boolean;
  /** Attention-weighted mean (emphasises clusters that actually engage). */
  attentionWeightedMean: number;
}

// ─── Thresholds ───────────────────────────────────────────────────────────────

/** Below this weighted variance → safe / stable creative. */
const VARIANCE_SAFE_THRESHOLD       = 0.012;
/** Above this weighted variance → polarizing / viral potential. */
const VARIANCE_POLARIZING_THRESHOLD = 0.030;

export function computeVariance(clusters: ClusterResponse[]): VarianceResult {
  // ── Weighted mean ──────────────────────────────────────────────────────────
  const mean = clusters.reduce(
    (sum, c) => sum + c.compositeScore * c.weight,
    0,
  );

  // ── Weighted variance: Σ w_i × (score_i - μ)² ────────────────────────────
  const variance = clusters.reduce(
    (sum, c) => sum + c.weight * Math.pow(c.compositeScore - mean, 2),
    0,
  );

  // ── Attention-weighted mean ────────────────────────────────────────────────
  // Clusters that actually pay attention drive more real-world outcomes.
  const attentionTotalWeight = clusters.reduce((s, c) => s + c.weight * c.attention, 0);
  const attentionWeightedMean =
    attentionTotalWeight > 0
      ? clusters.reduce((s, c) => s + c.compositeScore * c.weight * c.attention, 0) /
        attentionTotalWeight
      : mean;

  // ── Normalise variance to 0–1 (max theoretical = 0.25 for binary dist.) ──
  const normalisedVariance = Math.min(variance / 0.25, 1);

  // ── Label ─────────────────────────────────────────────────────────────────
  const label: VarianceResult['label'] =
    variance <= VARIANCE_SAFE_THRESHOLD       ? 'safe'
    : variance >= VARIANCE_POLARIZING_THRESHOLD ? 'polarizing'
    : 'moderate';

  return {
    mean:                  r3(mean),
    variance:              r4(variance),
    normalisedVariance:    r3(normalisedVariance),
    label,
    viralPotential:        label === 'polarizing',
    attentionWeightedMean: r3(attentionWeightedMean),
  };
}

function r3(n: number): number { return Math.round(n * 1000) / 1000; }
function r4(n: number): number { return Math.round(n * 10000) / 10000; }
