// ─── Phase 5.3 — pure bias computation (no NestJS, no I/O) ──────────────────

import { TrendSignal, TrendBias, decayFactor } from './trend-signal.interface';

export class TrendIntelligenceEngine {
  /**
   * Compute additive bias values from a set of trend signals.
   *
   * Each signal is first decayed by its age (exp(-h/72)) so stale trends
   * fade out automatically. The result is clamped to [0, 1] per component
   * so the orchestrator's fixed multipliers (0.05 / 0.03) remain safe.
   */
  computeBias(trends: TrendSignal[]): TrendBias {
    const hookBiasRaw   = trends
      .filter(t => t.type === 'hook')
      .reduce((acc, t) => acc + this.weightedScore(t, 0.6, 0.4), 0);

    const ctaBiasRaw    = trends
      .filter(t => t.type === 'cta')
      .reduce((acc, t) => acc + this.weightedScore(t, 0.7, 0.3), 0);

    const formatBiasRaw = trends
      .filter(t => t.type === 'format')
      .reduce((acc, t) => acc + this.weightedScore(t, 0.5, 0.5), 0);

    return {
      hookBias:   this.clamp(hookBiasRaw),
      ctaBias:    this.clamp(ctaBiasRaw),
      formatBias: this.clamp(formatBiasRaw),
    };
  }

  private weightedScore(t: TrendSignal, wStrength: number, wVelocity: number): number {
    const decay = decayFactor(t.timestamp);
    const s     = isFinite(t.strength) ? t.strength : 0;
    const v     = isFinite(t.velocity) ? t.velocity : 0;
    return (s * wStrength + v * wVelocity) * decay;
  }

  private clamp(v: number): number {
    return Math.min(1, Math.max(0, isFinite(v) ? v : 0));
  }
}
