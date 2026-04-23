import { RoutingDecision } from '../../routing/smart/routing.types';

// ── Fingerprint input ─────────────────────────────────────────────────────────

export interface FingerprintInput {
  clientId:        string;
  conceptId?:      string;
  goal:            string;
  angles:          string[];
  routingDecision: RoutingDecision;
  // trendState and memorySnapshotVersion are now system-generated inside
  // CostOptimizerService — callers must NOT supply them to prevent stale reuse.
}

// ── Fingerprint result ────────────────────────────────────────────────────────

export interface ExecutionFingerprint {
  hash:           string;
  scope:          'full' | 'partial';
  reused:         boolean;
  cachedStages:   string[];
  computeSavedMs: number;
}

// ── Cost tracking ─────────────────────────────────────────────────────────────

export interface CostMetrics {
  totalComputeMs:         number;
  cachedReuseRatio:       number;   // 0–1
  skippedStages:          string[];
  mirofishSavedCalls:     number;
  fatigueBatchReuse:      number;
  estimatedCostReduction: number;   // percentage 0–100
}

// ── Cache entry ───────────────────────────────────────────────────────────────

export interface CacheEntry<T> {
  value:     T;
  expiresAt: number;
  hitCount:  number;
}

/** Cacheable pipeline stages. */
export const PIPELINE_STAGES = [
  'angle-intelligence',
  'memory-ranking',
  'fatigue-batch',
  'mirofish-inline',
  'routing-decision',
] as const;

export type PipelineStage = typeof PIPELINE_STAGES[number];
