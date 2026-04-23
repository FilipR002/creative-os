// ─── Write contract ───────────────────────────────────────────────────────────
export interface MemoryWriteInput {
  userId?: string;      // multi-user isolation
  clientId: string;
  industry: string;
  campaignId: string;
  creativeId: string;
  format: string;        // video | carousel | banner
  angle: string;         // angle slug
  concept: Record<string, any>;
  scores: {
    ctr: number;
    engagement: number;
    conversion: number;
    clarity: number;
    total: number;
  };
  totalScore: number;
  isWinner: boolean;
}

// ─── Query contract ───────────────────────────────────────────────────────────
export interface MemoryQueryInput {
  userId?: string;       // filter by user
  clientId?: string;
  industry?: string;
  format?: string;
  angle?: string;
  limit?: number;        // defaults to 10
}

// ─── Analytics result shapes ──────────────────────────────────────────────────
export interface AnglePerformance {
  angle: string;
  avgScore: number;
  winRate: number;       // 0–1
  totalRuns: number;
}

export interface FormatPerformance {
  format: string;
  avgScore: number;
  avgCtr: number;
  avgEngagement: number;
  avgConversion: number;
  totalRuns: number;
}

export interface MemoryQueryResult {
  topCreatives: TopCreative[];
  bestAngles: AnglePerformance[];
  avgScores: {
    ctr: number;
    engagement: number;
    conversion: number;
    clarity: number;
    total: number;
  };
}

export interface TopCreative {
  memoryId: string;
  creativeId: string;
  format: string;
  angle: string;
  totalScore: number;
  isWinner: boolean;
  createdAt: Date;
}
