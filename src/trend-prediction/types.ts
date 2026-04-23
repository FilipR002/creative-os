export type TrendStage = 'early' | 'emerging' | 'rising' | 'peak' | 'saturating';

export interface TrendSignal {
  pattern:           string;    // e.g. "urgency + landing_page"
  emotionalTrigger:  string;
  format:            string;
  occurrences:       number;
  recentOccurrences: number;    // last 24h equivalent weight
  velocity:          number;    // 0-1 growth rate
  avgScore:          number;
  competitors:       string[];  // brand names
  hooks:             string[];  // example hooks
  firstSeenAt:       Date;
  lastSeenAt:        Date;
}

export interface PredictedTrend {
  id:                  string;
  trendName:           string;
  hookPattern:         string;
  creativeFormat:      string;
  emotionalDriver:     string;
  predictedPeakTime:   string;   // human-readable, e.g. "3-5 days"
  viralityScore:       number;   // 0-1
  confidence:          number;   // 0-1
  currentStage:        TrendStage;
  supportingExamples:  string[];
  riskOfSaturation:    number;   // 0-1
  detectedAt:          Date;
  updatedAt:           Date;
  competitors:         number;   // how many competitors show this
}

export interface TrendHistory {
  trend:      PredictedTrend;
  snapshots:  { timestamp: Date; viralityScore: number; stage: TrendStage }[];
}

export interface TrendSummary {
  total:         number;
  earlySignals:  number;
  emerging:      number;
  rising:        number;
  saturating:    number;
  topTrend:      PredictedTrend | null;
  lastUpdated:   Date;
}
