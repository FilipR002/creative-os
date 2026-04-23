export interface TrendSignal {
  id:        string;
  source:    'manual' | 'api' | 'import';
  industry:  string;
  type:      'hook' | 'cta' | 'format' | 'angle';
  value:     string;

  /** 0–1: absolute strength of this trend. */
  strength:  number;

  /** Growth rate — positive = accelerating, negative = decelerating. */
  velocity:  number;

  /** Unix epoch ms — used for decay calculation. */
  timestamp: number;
}

export interface TrendBias {
  /** Bounded [0, 1] — multiply by 0.05 before injecting into orchestrator. */
  hookBias:   number;
  ctaBias:    number;
  formatBias: number;
}

// ── Decay model ────────────────────────────────────────────────────────────────
// decay = exp(-hoursSince / 72)
// Half-life ≈ 50 h; effectively zero after ~10 days.

export function decayFactor(timestampMs: number): number {
  const hoursSince = (Date.now() - timestampMs) / 3_600_000;
  return Math.exp(-hoursSince / 72);
}
