// ─── Phase 5.6 — per-stage orchestration cache ───────────────────────────────
// Consumers call tryGet / store per pipeline stage.
// Routing decisions use HOT_TTL; fatigue batches use STABLE_TTL when stable.

import { Injectable }          from '@nestjs/common';
import { ExecutionCacheService, HOT_TTL_MS, STABLE_TTL_MS } from './execution-cache.service';
import { PipelineStage }       from './cost.types';

const STAGE_TTL: Record<PipelineStage, number> = {
  'angle-intelligence': HOT_TTL_MS,
  'memory-ranking':     HOT_TTL_MS,
  'fatigue-batch':      STABLE_TTL_MS,
  'mirofish-inline':    HOT_TTL_MS,
  'routing-decision':   HOT_TTL_MS,
};

@Injectable()
export class OrchestrationCacheService {
  constructor(private readonly cache: ExecutionCacheService) {}

  stageKey(stage: PipelineStage, fingerprint: string): string {
    return `stage:${stage}:${fingerprint}`;
  }

  tryGet<T>(stage: PipelineStage, fingerprint: string): T | null {
    return this.cache.get<T>(this.stageKey(stage, fingerprint));
  }

  store<T>(stage: PipelineStage, fingerprint: string, value: T, stable = false): void {
    const ttl = stable && stage === 'fatigue-batch' ? STABLE_TTL_MS : STAGE_TTL[stage];
    this.cache.set(this.stageKey(stage, fingerprint), value, ttl);
  }

  /**
   * Returns which stages are already cached for a given fingerprint.
   * Orchestrator uses this to decide which pipeline phases to skip.
   */
  cachedStages(fingerprint: string): PipelineStage[] {
    return (['angle-intelligence', 'memory-ranking', 'fatigue-batch', 'mirofish-inline', 'routing-decision'] as PipelineStage[])
      .filter(s => this.cache.has(this.stageKey(s, fingerprint)));
  }

  /**
   * True when the fingerprint has all mandatory stages cached
   * (angle-intelligence + memory-ranking + fatigue-batch + routing-decision).
   * When true the orchestrator can skip the full pipeline.
   */
  isFullHit(fingerprint: string): boolean {
    const required: PipelineStage[] = ['angle-intelligence', 'memory-ranking', 'fatigue-batch', 'routing-decision'];
    return required.every(s => this.cache.has(this.stageKey(s, fingerprint)));
  }
}
