// ─── Phase 5.2 Cross-Client Pattern Learning — shared types ───────────────────

import { MIN_COHORT_SIZE } from '../../platform/aggregation/aggregated-signal.interface';
export { MIN_COHORT_SIZE };

// ── Input: anonymized signal contributed by one client ────────────────────────

export interface AnonymousSignal {
  /** SHA-256 hash of clientId — one-way, cannot reconstruct original id. */
  clientIdHash: string;
  industry:     string;
  angle:        string;
  format:       string;
  ctr:          number;
  conversion:   number;
  retention:    number;
  timestamp:    number;
}

// ── Output: aggregated, industry-level pattern ────────────────────────────────

export interface AggregatedPattern {
  industry:   string;
  angle:      string;
  format:     string;

  metrics: {
    avgCTR:        number;
    avgConversion: number;
    avgRetention:  number;
  };

  /** Number of distinct client hashes contributing to this pattern. */
  sampleSize: number;

  /** 0–1; reaches 1.0 at MIN_COHORT_SIZE * 10 samples. */
  confidence: number;
}

// ── Output: system-wide intelligence summary ──────────────────────────────────

export interface GlobalInsights {
  /** Top 3 angles per industry ranked by avg CTR (sufficient cohort only). */
  topAnglesByIndustry: Record<string, string[]>;

  /** Top 3 formats per industry ranked by avg conversion. */
  topFormatsByIndustry: Record<string, string[]>;

  /** Patterns where avg retention < 0.30 — signal fatigue risk. */
  fatiguePronePatterns: string[];

  /** Patterns where avg conversion > 0.70 — high-value benchmarks. */
  highConversionPatterns: string[];
}
