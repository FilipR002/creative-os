// ─── Phase 5.3 — NestJS service wrapper ──────────────────────────────────────

import { Injectable }              from '@nestjs/common';
import { TrendStore }              from './trend-store.service';
import { TrendIntelligenceEngine } from './trend-intelligence.engine';
import { TrendBias }               from './trend-signal.interface';

const ZERO_BIAS: TrendBias = { hookBias: 0, ctaBias: 0, formatBias: 0 };

@Injectable()
export class TrendIntelligenceService {
  private readonly engine = new TrendIntelligenceEngine();

  constructor(private readonly store: TrendStore) {}

  /**
   * Orchestrator call-site:
   *
   *   const bias = this.trendIntel.getBiasForIndustry(industry);
   *   finalWeight += bias.hookBias   * 0.05;
   *   finalWeight += bias.ctaBias    * 0.05;
   *   finalWeight += bias.formatBias * 0.03;
   *
   * Max possible injection: 0.13 per angle — additive only, never replaces memory.
   */
  getBiasForIndustry(industry: string): TrendBias {
    try {
      const trends = this.store.getByIndustry(industry);
      if (trends.length === 0) return ZERO_BIAS;
      return this.engine.computeBias(trends);
    } catch {
      return ZERO_BIAS;
    }
  }

  /**
   * Same as getBiasForIndustry but for a specific trend type subset.
   * Useful when callers only need one dimension (e.g. HookBooster).
   */
  getBiasForType(
    industry: string,
    type: 'hook' | 'cta' | 'format',
  ): number {
    const bias = this.getBiasForIndustry(industry);
    return bias[`${type}Bias`];
  }
}
