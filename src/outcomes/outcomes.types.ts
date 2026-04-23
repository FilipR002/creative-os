// ─── Outcome Learning Layer — Types ──────────────────────────────────────────

export interface OutcomeMetricsInput {
  impressions:  number;
  clicks:       number;
  conversions:  number;
  spend?:       number;
  revenue?:     number;
}

export interface ReportOutcomeDto {
  userId:     string;
  campaignId: string;
  angleSlug:  string;
  metrics:    OutcomeMetricsInput;
}

export interface NormalizedMetrics {
  ctr:             number;   // clicks / impressions
  conversionRate:  number;   // conversions / clicks
  roas:            number;   // revenue / spend  (1.0 if no spend data)
  performanceScore: number;  // ctr*0.3 + cr*0.5 + roas_normalized*0.2
}

export interface OutcomeLearningUpdate {
  angleSlug:        string;
  previousWeight:   number;
  newWeight:        number;
  performanceScore: number;
  impressions:      number;
  skipped:          boolean;   // true if impressions < MIN_IMPRESSIONS
}

export interface ReportOutcomeResponse {
  status:          'accepted' | 'skipped_low_volume';
  reason?:         string;
  normalized?:     NormalizedMetrics;
  learningUpdate?: OutcomeLearningUpdate;
}

// Internal DB shape for angleWeights JSON column
export type AngleWeightMap = Record<string, number>;
