// ─── Phase 5.6 — top-level cost optimizer ────────────────────────────────────
// Wraps ExecutionCache + OrchestrationCache + Deduplicator behind one API.
// Never changes what is computed — only whether it is computed.

import { Injectable, Logger, Optional }  from '@nestjs/common';
import { ExecutionCacheService }          from './execution-cache.service';
import { OrchestrationCacheService }      from './orchestration-cache.service';
import { ComputeDeduplicatorService }     from './compute-deduplicator.service';
import {
  FingerprintInput,
  ExecutionFingerprint,
  CostMetrics,
  PipelineStage,
} from './cost.types';
import { GlobalMemoryService }  from '../../global-memory/global-memory.service';
import { TrendStore }           from '../../trends/trend-store.service';
import { MemoryEventService }   from './memory-event.service';
import { assertClientScope }    from '../../common/guards/client-scope';

const SKIP_THRESHOLD = {
  memoryStability: 0.85,
  trendDelta:      0.20,
};

@Injectable()
export class CostOptimizerService {
  private readonly logger = new Logger(CostOptimizerService.name);

  private savedCalls   = { mirofish: 0, fatigueBatch: 0 };
  private requestCount = 0;
  private cacheHits    = 0;

  constructor(
    private readonly executionCache: ExecutionCacheService,
    private readonly stageCache:     OrchestrationCacheService,
    private readonly deduplicator:   ComputeDeduplicatorService,
    // Version providers — @Optional() so module works before dependencies boot
    @Optional() private readonly globalMemory: GlobalMemoryService,
    @Optional() private readonly trendStore:   TrendStore,
    @Optional() private readonly memoryEvent:  MemoryEventService,
  ) {}

  // ── Fingerprint + skip check ────────────────────────────────────────────────

  buildFingerprint(input: FingerprintInput): ExecutionFingerprint {
    // Phase 5.7 — execution cache is client-scoped data; clientId is mandatory.
    // FingerprintInput.clientId is typed as `string` (not optional), but this
    // runtime guard catches code paths that coerce undefined to string.
    assertClientScope(input.clientId);

    // Unified event-driven version — incremented by MEMORY_UPDATE, TREND_INGEST,
    // LEARNING_CYCLE_COMPLETE events. Falls back to per-service versions when
    // MemoryEventService is not yet available (early boot).
    const unifiedVersion = this.memoryEvent?.getVersion()
      ?? `${this.globalMemory?.getVersion() ?? 'mem-v0'}:${this.trendStore?.getCurrentVersion() ?? 'trend-v0'}`;

    const hash         = this.executionCache.buildFingerprintFromResolved({
      ...input,
      memoryVersion: unifiedVersion,
      trendVersion:  unifiedVersion,
    });
    const cachedStages = this.stageCache.cachedStages(hash);
    const reused       = this.stageCache.isFullHit(hash);

    if (reused) this.cacheHits++;
    this.requestCount++;

    return {
      hash,
      scope:          reused ? 'full' : cachedStages.length > 0 ? 'partial' : 'full',
      reused,
      cachedStages,
      computeSavedMs: reused ? 120 : cachedStages.length * 15,
    };
  }

  // ── Skip rules ──────────────────────────────────────────────────────────────

  canSkipFullPipeline(params: {
    fingerprint:         ExecutionFingerprint;
    memoryStability:     number;
    prevTrendPressure?:  number;
    currTrendPressure?:  number;
    fatigueStateChanged: boolean;
    routingModeChanged:  boolean;
  }): boolean {
    if (!params.fingerprint.reused)                                  return false;
    if (params.fatigueStateChanged)                                  return false;
    if (params.routingModeChanged)                                   return false;
    if (params.memoryStability < SKIP_THRESHOLD.memoryStability)     return false;
    const trendDelta = Math.abs(
      (params.currTrendPressure ?? 0) - (params.prevTrendPressure ?? 0),
    );
    if (trendDelta > SKIP_THRESHOLD.trendDelta)                      return false;
    return true;
  }

  pendingStages(fingerprint: ExecutionFingerprint): PipelineStage[] {
    const all: PipelineStage[] = [
      'angle-intelligence',
      'memory-ranking',
      'fatigue-batch',
      'mirofish-inline',
      'routing-decision',
    ];
    const cached = new Set(fingerprint.cachedStages);
    return all.filter(s => !cached.has(s));
  }

  // ── Deduplication convenience ───────────────────────────────────────────────

  deduplicateMirofish<T>(contextHash: string, fn: () => Promise<T>): Promise<T> {
    return this.deduplicator.deduplicate(`mirofish:${contextHash}`, fn);
  }

  deduplicateFatigueBatch<T>(contextHash: string, fn: () => Promise<T>): Promise<T> {
    return this.deduplicator.deduplicate(`fatigue:${contextHash}`, fn);
  }

  // ── Metrics ─────────────────────────────────────────────────────────────────

  getMetrics(): CostMetrics {
    const cacheRatio = this.requestCount > 0 ? this.cacheHits / this.requestCount : 0;
    return {
      totalComputeMs:         0,
      cachedReuseRatio:       Math.round(cacheRatio * 100) / 100,
      skippedStages:          [],
      mirofishSavedCalls:     this.savedCalls.mirofish,
      fatigueBatchReuse:      this.savedCalls.fatigueBatch,
      estimatedCostReduction: Math.round(cacheRatio * 100),
    };
  }
}
