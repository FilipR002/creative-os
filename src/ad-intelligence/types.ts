export type AdPlatform = 'meta' | 'tiktok' | 'google' | 'youtube' | 'web';

export interface NormalizedAd {
  id:                   string;
  platform:             AdPlatform;
  brand:                string;
  hook:                 string;
  creativeFormat:       string;
  emotionalTrigger:     string;
  cta:                  string;
  engagementSignal:     number;  // 0-1
  estimatedPerformance: number;  // 0-1
  landingPagePattern:   string;
  sourceUrl:            string;
  scrapedAt:            Date;
  source:               'multi_platform_intelligence';
}

export interface PlatformAnalysis {
  platform:        AdPlatform;
  totalAds:        number;
  avgPerformance:  number;
  topEmotions:     { emotion: string; count: number }[];
  topFormats:      { format: string; count: number }[];
  topHooks:        string[];
  saturationIndex: number;  // 0-1
}

export interface CrossPlatformMatch {
  hookPattern:       string;
  emotionalTrigger:  string;
  platforms:         AdPlatform[];
  occurrences:       number;
  migrationChain:    string;  // e.g. "tiktok → meta → youtube"
  universalScore:    number;  // avg performance across platforms
  firstPlatform:     AdPlatform;
}

export interface UnifiedInsight {
  topUniversalHooks:     string[];
  crossPlatformPatterns: CrossPlatformMatch[];
  platformLeaders:       { platform: AdPlatform; bestHook: string; avgScore: number }[];
  globalPerformanceScore: number;
  recommendedPlatforms:  { platform: AdPlatform; reason: string }[];
}

export interface AggregationJob {
  id:          string;
  urls:        string[];
  status:      'pending' | 'processing' | 'complete' | 'failed';
  progress:    number;
  adsFound:    number;
  startedAt:   Date;
  completedAt?: Date;
}
