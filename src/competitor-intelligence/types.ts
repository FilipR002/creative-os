export type CIAutonomyLevel = 0 | 1 | 2 | 3;

export interface CompetitorInput {
  competitorName: string;
  brandUrl: string;
  industry: string;
  keywords?: string[];
}

export type JobStatus =
  | 'pending' | 'scraping' | 'normalizing'
  | 'scoring' | 'clustering' | 'insights'
  | 'complete' | 'failed';

export interface AnalysisJob {
  id:            string;
  input:         CompetitorInput;
  status:        JobStatus;
  progress:      number;  // 0-100
  sourcesFound:  number;
  adsDiscovered: number;
  startedAt:     Date;
  completedAt?:  Date;
  error?:        string;
  events:        string[];
}

export interface ScoreBreakdown {
  engagementLikelihood: number;
  clarityScore:         number;
  emotionalIntensity:   number;
  noveltyScore:         number;
  repetitionFrequency:  number;
}

export interface AdIntelItem {
  id:                    string;
  brand:                 string;
  hook:                  string;
  copy:                  string;
  cta:                   string;
  format:                string;
  emotionalTrigger:      string;
  landingPageStructure:  string;
  performanceSignal:     number;
  clusterId:             string;
  source:                string;
  scores:                ScoreBreakdown;
}

export type ClusterType =
  | 'winning_hooks' | 'winning_formats'
  | 'saturated_patterns' | 'emerging_trends';

export interface Cluster {
  id:       string;
  type:     ClusterType;
  label:    string;
  items:    string[];  // AdIntelItem ids
  avgScore: number;
}

export interface MarketInsights {
  whatIsWorking:               string[];
  whatIsOverused:              string[];
  whatIsMissing:               string[];
  competitorStrategySummary:   string;
}

export interface AnalysisResult {
  jobId:        string;
  input:        CompetitorInput;
  ads:          AdIntelItem[];
  clusters:     Cluster[];
  insights:     MarketInsights;
  sources:      string[];
  completedAt:  Date;
}

export interface ExportToBuilderInput {
  jobId:      string;
  clusterIds: string[];
}

export interface ExportedIntel {
  hooks:            string[];
  ctas:             string[];
  emotionalAngles:  string[];
  formats:          string[];
  strategySummary:  string;
  source:           'competitor_intelligence';
  exportedAt:       Date;
}
