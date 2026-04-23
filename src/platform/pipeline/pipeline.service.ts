// ─── Phase 5 execution pipeline ──────────────────────────────────────────────
//
// Hook points around Phase 4:
//   before()  — context enrichment before Phase 4 runs (read-only)
//   after()   — signal capture + plugin execution after Phase 4 returns
//
// Rule: if ANY Phase 5 step fails, the Phase 4 output is returned unchanged.
// Phase 5 is always ADDITIVE — never modifies the core output.

import { Injectable, Logger } from '@nestjs/common';
import { ClientContext }      from '../context/client-context.interface';
import { BaseSignal }         from '../signals/signal-contracts';
import { PluginRegistry }     from '../plugins/plugin-registry.service';
import { AggregationService } from '../aggregation/aggregation.service';

export interface PipelineBeforeResult {
  ctx:       ClientContext;
  requestMs: number;
}

export interface PipelineAfterResult<T> {
  phase4Output:  T;
  enrichments:   Record<string, unknown>;
  warnings:      string[];
  pipelineMs:    number;
}

@Injectable()
export class PipelineService {
  private readonly logger = new Logger(PipelineService.name);

  constructor(
    private readonly registry:     PluginRegistry,
    private readonly aggregation:  AggregationService,
  ) {}

  // ── Pre-Phase-4 hook ──────────────────────────────────────────────────────

  before(ctx: ClientContext): PipelineBeforeResult {
    return { ctx, requestMs: Date.now() };
  }

  // ── Post-Phase-4 hook ─────────────────────────────────────────────────────

  async after<T>(
    phase4Output: T,
    signals:      BaseSignal[],
    before:       PipelineBeforeResult,
  ): Promise<PipelineAfterResult<T>> {
    const t0 = Date.now();

    try {
      const pluginInput = {
        phase4Output,
        signals,
        requestMs: t0 - before.requestMs,
      };

      const pluginResults = await this.registry.executeAll(before.ctx, pluginInput);

      // Flatten plugin outputs into a single enrichments map
      const enrichments: Record<string, unknown>   = {};
      const warnings:    string[]                  = [];

      for (const [name, result] of Object.entries(pluginResults)) {
        enrichments[name] = result.data;
        warnings.push(...result.warnings.map(w => `[${name}] ${w}`));
      }

      return {
        phase4Output,
        enrichments,
        warnings,
        pipelineMs: Date.now() - t0,
      };
    } catch (err) {
      this.logger.error(`Phase 5 pipeline failed — returning Phase 4 output unchanged: ${(err as Error).message}`);
      return {
        phase4Output,
        enrichments: {},
        warnings:    ['PHASE5_PIPELINE_ERROR'],
        pipelineMs:  Date.now() - t0,
      };
    }
  }

  // ── Aggregation convenience ───────────────────────────────────────────────

  async getIndustryContext(ctx: ClientContext, angleSlugs: string[]) {
    try {
      return await this.aggregation.getBatchPercentiles(ctx.metadata.industry, angleSlugs);
    } catch {
      return [];
    }
  }
}
