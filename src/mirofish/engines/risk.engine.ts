// ─── MIROFISH Risk Engine ─────────────────────────────────────────────────────
//
// Detects failure patterns from simulated cluster responses.
// Risk is assessed across 4 dimensions:
//
//   1. Weak Hook        — opening fails to capture attention
//   2. Low Trust Signal — insufficient credibility / proof
//   3. Emotional Mismatch — emotionally-driven clusters unresponsive
//   4. CTA Failure      — conversion intent doesn't materialise
//
// Each detected pattern contributes to risk score and adds a reason string.
// ─────────────────────────────────────────────────────────────────────────────

import { ClusterResponse } from './simulation.engine';

export interface RiskResult {
  /** 0–1. Higher = more risk. */
  score:  number;
  /** Categorical risk level. */
  level:  'LOW' | 'MEDIUM' | 'HIGH';
  /** Human-readable failure reasons. */
  reasons: string[];
  /** Per-dimension flags. */
  flags: {
    weakHook:           boolean;
    lowTrust:           boolean;
    emotionalMismatch:  boolean;
    ctaFailure:         boolean;
  };
}

// ─── Thresholds ───────────────────────────────────────────────────────────────

const THRESHOLDS = {
  /** Population-weighted avg attention below this → weak hook */
  weakHook:               0.45,
  /** Population-weighted avg trust below this → low trust signal */
  lowTrust:               0.38,
  /** Emotional cluster score ratio below this vs overall mean → mismatch */
  emotionalMismatchRatio: 0.72,
  /** Population-weighted avg conversion intent below this → CTA failure */
  ctaFailure:             0.33,
  /** Risk score to level mapping */
  mediumRisk:             0.30,
  highRisk:               0.55,
} as const;

export function computeRisk(clusters: ClusterResponse[]): RiskResult {
  const reasons: string[] = [];
  const flags = {
    weakHook:          false,
    lowTrust:          false,
    emotionalMismatch: false,
    ctaFailure:        false,
  };

  // ── Population-weighted dimension averages ────────────────────────────────
  const wtAvg = (key: keyof ClusterResponse) =>
    clusters.reduce((sum, c) => sum + (c[key] as number) * c.weight, 0);

  const avgAttention        = wtAvg('attention');
  const avgTrust            = wtAvg('trust');
  const avgConversionIntent = wtAvg('conversionIntent');
  const avgComposite        = wtAvg('compositeScore');

  // ── 1. Weak Hook ──────────────────────────────────────────────────────────
  // Check population avg AND specifically the curious cluster (biggest segment)
  const curiousCluster = clusters.find(c => c.clusterId === 'curious');
  const hookFails      = avgAttention < THRESHOLDS.weakHook;
  const curiousMissed  = curiousCluster
    ? curiousCluster.attention < THRESHOLDS.weakHook + 0.05
    : false;

  if (hookFails) {
    flags.weakHook = true;
    reasons.push(
      curiousMissed
        ? `Weak hook: avg attention ${pct(avgAttention)} — fails both broad population and curious segment (${pct(curiousCluster?.attention ?? 0)})`
        : `Weak hook: population-weighted attention ${pct(avgAttention)} is below ${pct(THRESHOLDS.weakHook)} threshold`,
    );
  }

  // ── 2. Low Trust Signal ───────────────────────────────────────────────────
  // Check overall avg AND skeptical cluster specifically
  const skepticalCluster = clusters.find(c => c.clusterId === 'skeptical');
  const trustFails       = avgTrust < THRESHOLDS.lowTrust;
  const skepticsUnmoved  = skepticalCluster
    ? skepticalCluster.trust < THRESHOLDS.lowTrust + 0.08
    : false;

  if (trustFails) {
    flags.lowTrust = true;
    reasons.push(
      `Low trust signal: avg trust ${pct(avgTrust)} — insufficient credibility elements to move sceptical audience (${pct(skepticalCluster?.trust ?? 0)})`,
    );
  } else if (skepticsUnmoved) {
    // Soft flag: overall trust ok but skeptical cluster unresponsive
    flags.lowTrust = true;
    reasons.push(
      `Trust gap in skeptical segment: overall ${pct(avgTrust)} but skeptical cluster at ${pct(skepticalCluster?.trust ?? 0)} — needs more social proof`,
    );
  }

  // ── 3. Emotional Mismatch ────────────────────────────────────────────────
  // Emotional cluster should track near the overall mean.
  // If it's significantly below → emotional content isn't landing.
  const emotionalCluster = clusters.find(c => c.clusterId === 'emotional');
  if (emotionalCluster && avgComposite > 0) {
    const ratio = emotionalCluster.compositeScore / avgComposite;
    if (ratio < THRESHOLDS.emotionalMismatchRatio) {
      flags.emotionalMismatch = true;
      reasons.push(
        `Emotional mismatch: emotional cluster composite ${pct(emotionalCluster.compositeScore)} is ${pct(1 - ratio)} below overall mean ${pct(avgComposite)} — messaging doesn't connect emotionally`,
      );
    }
  }

  // ── 4. CTA Failure ────────────────────────────────────────────────────────
  // High-intent cluster failing to convert is the strongest CTA failure signal.
  const highIntentCluster = clusters.find(c => c.clusterId === 'high_intent');
  const ctaFails          = avgConversionIntent < THRESHOLDS.ctaFailure;
  const highIntentFails   = highIntentCluster
    ? highIntentCluster.conversionIntent < 0.50
    : false;

  if (ctaFails) {
    flags.ctaFailure = true;
    reasons.push(
      `CTA failure: avg conversion intent ${pct(avgConversionIntent)} — weak call-to-action or misaligned offer`,
    );
  } else if (highIntentFails) {
    // High-intent below 0.50 is a soft CTA failure even if avg is ok
    flags.ctaFailure = true;
    reasons.push(
      `CTA underperforms for purchase-ready audience: high-intent cluster conversion ${pct(highIntentCluster?.conversionIntent ?? 0)} — CTA may lack urgency or specificity`,
    );
  }

  // ── Risk score ────────────────────────────────────────────────────────────
  // Each flag has a weighted contribution; CTA and trust are highest risk.
  const flagScores = {
    weakHook:          flags.weakHook          ? 0.20 : 0,
    lowTrust:          flags.lowTrust          ? 0.28 : 0,
    emotionalMismatch: flags.emotionalMismatch ? 0.18 : 0,
    ctaFailure:        flags.ctaFailure        ? 0.34 : 0,
  };

  const rawRiskScore = Object.values(flagScores).reduce((s, v) => s + v, 0);

  // Compress into 0–1 (theoretical max = 1.0 if all 4 fire)
  const riskScore = clamp(rawRiskScore);

  const level: RiskResult['level'] =
    riskScore >= THRESHOLDS.highRisk   ? 'HIGH'
    : riskScore >= THRESHOLDS.mediumRisk ? 'MEDIUM'
    : 'LOW';

  return {
    score:   r3(riskScore),
    level,
    reasons: reasons.length > 0 ? reasons : ['No significant risk patterns detected'],
    flags,
  };
}

function clamp(v: number): number { return Math.min(1, Math.max(0, v)); }
function r3(n: number):   number  { return Math.round(n * 1000) / 1000; }
function pct(n: number):  string  { return `${Math.round(n * 100)}%`; }
