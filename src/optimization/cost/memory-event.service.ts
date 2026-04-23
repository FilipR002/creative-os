// ─── Event-driven cache invalidation ─────────────────────────────────────────
// Single source of truth for cache version bumping across the system.
//
// Event sources → effect on fingerprints:
//   GlobalMemoryService.ingest()      → MEMORY_UPDATE           → bumps globalVersion
//   TrendStore.add() / remove()       → TREND_INGEST            → bumps globalVersion
//   LearningService.runCycle()        → LEARNING_CYCLE_COMPLETE → bumps globalVersion
//
// CostOptimizerService.buildFingerprint() uses getVersion() as the unified
// version token in the SHA-256 fingerprint. Any of the three events above
// causes a new version token and therefore a cache miss on the next request.
//
// Constraint: do NOT add TTL-based invalidation here — that lives in
// ExecutionCacheService (HOT_TTL / STABLE_TTL). This service handles
// correctness-driven invalidation only.

import { Injectable } from '@nestjs/common';

export type MemoryEventType =
  | 'MEMORY_UPDATE'
  | 'TREND_INGEST'
  | 'LEARNING_CYCLE_COMPLETE';

@Injectable()
export class MemoryEventService {
  private globalVersion = 0;

  /** Increment the global version counter. Called by any subsystem that mutates shared state. */
  notify(_event: MemoryEventType): void {
    this.globalVersion++;
  }

  /** Version token for use in cache fingerprints. Changes on every notify() call. */
  getVersion(): string {
    return `v${this.globalVersion}`;
  }
}
