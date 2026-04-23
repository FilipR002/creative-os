// ─── Phase 5.5 — NestJS service wrapper ──────────────────────────────────────
// Stateless: each call to decide() is independent.
// Callers (orchestrator, hook booster, dashboard) inject SmartRoutingService.

import { Injectable, Logger } from '@nestjs/common';
import { RoutingEngine }      from './routing.engine';
import { RoutingContext, RoutingDecision } from './routing.types';

const SAFE_FALLBACK: RoutingDecision = {
  mode:               'balanced',
  variantCount:       3,
  blendingEnabled:    true,
  hookAggressiveness: 'medium',
  explorationRate:    0.20,
  riskTolerance:      0.50,
};

@Injectable()
export class SmartRoutingService {
  private readonly logger = new Logger(SmartRoutingService.name);
  private readonly engine = new RoutingEngine();

  /**
   * Compute a routing decision from pre-aggregated context signals.
   * Never throws — returns a safe balanced fallback on any error.
   */
  decide(ctx: RoutingContext): RoutingDecision {
    try {
      return this.engine.compute(ctx);
    } catch (err) {
      this.logger.error(
        `RoutingEngine.compute failed (clientId=${ctx.clientId}): ${(err as Error).message}`,
      );
      return SAFE_FALLBACK;
    }
  }

  /**
   * Convenience: build a RoutingContext from the flat fields that
   * PerformanceSnapshot and FatigueService already produce, then decide.
   */
  decideFromSignals(params: {
    clientId:           string;
    goal:               RoutingContext['goal'];
    fatigueState:       RoutingContext['fatigueState'];
    memoryStability:    number;
    explorationEntropy: number;
    trendPressure:      number;
    mirofishConfidence: number;
  }): RoutingDecision {
    return this.decide(params);
  }
}
