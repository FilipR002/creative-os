// ─── MIROFISH Aggregation Engine ─────────────────────────────────────────────
//
// Combines outputs from all engines into the final MirofishResult.
//
// Responsibility:
//   - Derive final metric values from simulation + variance + risk
//   - Apply synergy bonus to overall score
//   - Determine recommendation: 'proceed' | 'revise' | 'reject'
//   - Produce the strict output contract required by the controller
// ─────────────────────────────────────────────────────────────────────────────

import { ClusterResponse } from './simulation.engine';
import { VarianceResult }  from './variance.engine';
import { SynergyResult }   from './synergy.engine';
import { RiskResult }      from './risk.engine';

export interface MirofishResult {
  // ── Core prediction scores ──────────────────────────────────────────────
  overall_score:          number;
  conversion_probability: number;
  attention_score:        number;
  trust_score:            number;
  virality_score:         number;
  risk_variance:          number;

  // ── Learning loop signals (Phase MIROFISH-LL) ──────────────────────────
  /** actual − predicted. Null until feedback is injected after scoring. */
  prediction_error:              number | null;
  /** Rolling delta for this angle from recent signal history. Null if no history. */
  angle_performance_delta:       number | null;
  /** How much this run pushes exploration rate. 0 = stable; positive = explore more. */
  exploration_adjustment_signal: number;
  /** Confidence in this prediction: 1 = highly certain, 0 = high uncertainty. */
  learning_signal_strength:      number;

  angle_analysis: {
    primary_angle:   string;
    secondary_angle: string | null;
    synergy_score:   number | null;
  };

  risk_assessment: {
    level:   'LOW' | 'MEDIUM' | 'HIGH';
    reasons: string[];
  };

  recommendation: 'proceed' | 'revise' | 'reject';

  _meta: {
    mode:                string;
    clusters_simulated:  number;
    variance_label:      string;
    synergy_label:       string;
    simulation_ms:       number;
  };
}

// ─── Recommendation logic ─────────────────────────────────────────────────────
//
//   proceed  → strong overall score, risk does not override
//   revise   → borderline score or elevated risk — improvement recommended
//   reject   → weak score or HIGH risk — creative unlikely to perform

function determineRecommendation(
  overallScore: number,
  riskLevel:    RiskResult['level'],
): MirofishResult['recommendation'] {
  if (overallScore >= 0.65 && riskLevel === 'LOW')    return 'proceed';
  if (overallScore >= 0.65 && riskLevel === 'MEDIUM') return 'proceed';
  if (overallScore >= 0.65 && riskLevel === 'HIGH')   return 'revise';
  if (overallScore >= 0.48 && riskLevel === 'LOW')    return 'revise';
  if (overallScore >= 0.48 && riskLevel === 'MEDIUM') return 'revise';
  return 'reject';
}

// ─── Virality score ───────────────────────────────────────────────────────────
// Viral potential comes from two sources:
//   1. High variance (polarizing response distribution)
//   2. Strong hook + emotional intensity in curious + emotional clusters

function computeViralityScore(
  clusters:  ClusterResponse[],
  variance:  VarianceResult,
): number {
  const curiousCluster   = clusters.find(c => c.clusterId === 'curious');
  const emotionalCluster = clusters.find(c => c.clusterId === 'emotional');

  // Hook × emotion in the two most virality-prone clusters
  const hookEmotionSignal =
    (curiousCluster   ? curiousCluster.attention   * curiousCluster.emotion   * 0.55 : 0) +
    (emotionalCluster ? emotionalCluster.attention * emotionalCluster.emotion * 0.45 : 0);

  // Variance contribution: high variance = split audience = shareable tension
  const varianceContrib = variance.normalisedVariance * 0.40;

  const rawVirality = hookEmotionSignal * 0.60 + varianceContrib;

  return clamp(rawVirality);
}

// ─── Main aggregation ─────────────────────────────────────────────────────────

export function aggregate(input: {
  clusters:       ClusterResponse[];
  variance:       VarianceResult;
  synergy:        SynergyResult;
  risk:           RiskResult;
  primaryAngle:   string;
  secondaryAngle?: string;
  mode:           string;
  simulationMs:   number;
  /** Learning signals from MIROFISH history — passed in from MirofishService (DB-enriched path) */
  learningSignals?: {
    prediction_error?:              number | null;
    angle_performance_delta?:       number | null;
    exploration_adjustment_signal?: number;
  };
}): MirofishResult {
  const { clusters, variance, synergy, risk } = input;

  // ── Population-weighted dimension scores ─────────────────────────────────
  const wtAvg = (key: keyof ClusterResponse) =>
    clusters.reduce((sum, c) => sum + (c[key] as number) * c.weight, 0);

  const attentionScore  = wtAvg('attention');
  const trustScore      = wtAvg('trust');
  const conversionProb  = wtAvg('conversionIntent');

  // ── Overall score ─────────────────────────────────────────────────────────
  // Base: attention-weighted mean from variance engine (more accurate than simple mean)
  // Synergy bonus: validated angle pairs get up to +4% lift
  const synBonus    = (synergy.score !== null && isFinite(synergy.score)) ? (synergy.score - 0.50) * 0.08 : 0;
  const riskPenalty = isFinite(risk.score) ? risk.score * 0.10 : 0;  // risk suppresses overall score slightly

  const overallScore = clamp(variance.attentionWeightedMean + synBonus - riskPenalty);

  // ── Virality score ────────────────────────────────────────────────────────
  const viralityScore = computeViralityScore(clusters, variance);

  // ── Recommendation ────────────────────────────────────────────────────────
  const recommendation = determineRecommendation(overallScore, risk.level);

  // ── Learning signal strength: inverse of normalised variance ─────────────
  // High variance prediction = low confidence = lower signal strength.
  // This is computed from the simulation itself (no DB needed).
  const learningSignalStrength = clamp(1 - variance.normalisedVariance * 0.8);

  return {
    overall_score:          r3(overallScore),
    conversion_probability: r3(conversionProb),
    attention_score:        r3(attentionScore),
    trust_score:            r3(trustScore),
    virality_score:         r3(viralityScore),
    risk_variance:          r3(variance.normalisedVariance),

    // Learning loop signals
    prediction_error:              input.learningSignals?.prediction_error              ?? null,
    angle_performance_delta:       input.learningSignals?.angle_performance_delta       ?? null,
    exploration_adjustment_signal: input.learningSignals?.exploration_adjustment_signal ?? 0,
    learning_signal_strength:      r3(learningSignalStrength),

    angle_analysis: {
      primary_angle:   input.primaryAngle,
      secondary_angle: input.secondaryAngle ?? null,
      synergy_score:   synergy.score,
    },

    risk_assessment: {
      level:   risk.level,
      reasons: risk.reasons,
    },

    recommendation,

    _meta: {
      mode:               input.mode,
      clusters_simulated: clusters.length,
      variance_label:     variance.label,
      synergy_label:      synergy.label,
      simulation_ms:      input.simulationMs,
    },
  };
}

function clamp(v: number): number { return Math.min(1, Math.max(0, v)); }
function r3(n: number):   number  { return Math.round(n * 1000) / 1000; }
