/**
 * video-job.types.ts
 *
 * Shared types for the BullMQ video-render queue.
 *
 * Payload is intentionally small — concept + angles + RunDto only.
 * The Worker recomputes routing/fatigue/plan from those inputs at
 * execution time, keeping the Redis payload under ~1 KB per job.
 */

import type { RunDto, RunAngleItem, RunCreativeItem, RunScoringItem } from '../product-run/product-run.types';

// ── Queue name (single source of truth) ────────────────────────────────────────
export const VIDEO_QUEUE_NAME = 'video-render';

// ── Job payload (serialised to Redis) ─────────────────────────────────────────
export interface VideoJobPayload {
  executionId: string;
  campaignId:  string;
  userId:      string;

  /** Full RunDto — needed so the worker can rebuild execution inputs per angle */
  dto: RunDto;

  /** Pre-generated concept (saves a Claude round-trip in the worker) */
  concept: {
    id:                string;
    brief:             string;
    goal:              string;
    keyObjection?:     string | null;
    valueProposition?: string | null;
  };

  /** Pre-selected angles (saves an angle-selection round-trip in the worker) */
  angles: RunAngleItem[];
}

// ── Job result (stored in BullMQ on completion) ────────────────────────────────
export interface VideoJobResult {
  executionId:          string;
  campaignId:           string;
  creatives:            RunCreativeItem[];
  scoring:              RunScoringItem[];
  winner:               RunScoringItem | null;
  learningUpdateStatus: 'triggered' | 'skipped';
  evolutionTriggered:   boolean;
  explanation:          string;
}

// ── Queued response returned to the caller of POST /api/run for video ─────────
export interface RunQueuedResponse {
  executionId: string;
  campaignId:  string;
  jobId:       string;
  status:      'queued';
  concept: {
    id:    string;
    brief: string;
    goal:  string;
  };
  angles:  RunAngleItem[];
  message: string;
}
