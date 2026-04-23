// ─── Global aggregation contract ─────────────────────────────────────────────
// Cross-client views ONLY use this shape — raw per-client data never crosses
// the isolation boundary. sampleSize must be >= MIN_COHORT_SIZE before any
// aggregated value is returned (k-anonymity guard).

export const MIN_COHORT_SIZE = 5;

export interface AggregatedSignal {
  industry:              string;
  angle:                 string;
  percentileScore:       number;   // 0–100: where this angle sits in the industry distribution
  normalizedPerformance: number;   // 0–1: industry-normalised avg score
  sampleSize:            number;   // number of clients contributing (must be >= MIN_COHORT_SIZE)
}

/** Returned when a cohort is too small to reveal aggregated data safely. */
export interface InsufficientCohort {
  industry:   string;
  angle:      string;
  reason:     'INSUFFICIENT_COHORT';
  minRequired: number;
}

export type AggregationResult = AggregatedSignal | InsufficientCohort;

export function isSufficientCohort(r: AggregationResult): r is AggregatedSignal {
  return (r as AggregatedSignal).sampleSize !== undefined
    && (r as AggregatedSignal).sampleSize >= MIN_COHORT_SIZE;
}
