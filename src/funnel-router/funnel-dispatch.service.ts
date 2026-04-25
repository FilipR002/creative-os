/**
 * funnel-dispatch.service.ts
 *
 * Dispatch Layer — Phase 1.2
 *
 * Dispatches creatives for all active formats, routing ALL generation through
 * ExecutionGatewayService (FIX 1 — no direct CarouselService / BannerService calls).
 *
 * Routing map:
 *   ugc      → ViralTestService.launch()         (Phase 1.1 — full A/B/C pipeline)
 *   carousel → ExecutionGatewayService.execute() (N variants, mode-aware)
 *   banner   → ExecutionGatewayService.execute() (N variants, mode-aware)
 *
 * All formats run concurrently via Promise.allSettled — one failing format
 * does not block others.
 */

import { Injectable, Logger } from '@nestjs/common';

import { ViralTestService }        from '../ugc/viral-test.service';
import { ExecutionGatewayService } from '../creative-os/lib/execution-gateway';
// W2: Real executionMode — SmartRoutingService is @Global, no module change needed
import { SmartRoutingService }     from '../routing/smart/routing.service';
import { decideMode }              from '../creative-os/lib/model-router';

import type {
  VariantAllocation,
  SharedCreativeCore,
  FormatDispatchResult,
  CreativeFormat,
} from './funnel-router.types';
import type { RoutingDecision, RoutingContext } from '../routing/smart/routing.types';

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class FunnelDispatchService {
  private readonly logger = new Logger(FunnelDispatchService.name);

  constructor(
    private readonly viralTest:    ViralTestService,
    private readonly gateway:      ExecutionGatewayService,
    // W2: SmartRoutingService is @Global — inject directly, no module change
    private readonly smartRouting: SmartRoutingService,
  ) {}

  // ─── W2: Real executionMode resolver ──────────────────────────────────────
  // fatigueState is WARMING (neutral) — no per-angle fatigue data at dispatch layer.
  // Platform signal from SmartRoutingService → decideMode() maps to ugc|cinematic|hybrid.

  private resolveDispatchMode(
    campaignId: string,
    platform:   string,
    count:      number,
  ): { executionMode: string; renderEngine: string; routingDecision: RoutingDecision } {
    const ctx: RoutingContext = {
      clientId:           campaignId,
      goal:               'conversion',   // default — not available at funnel dispatch level
      fatigueState:       'WARMING',       // neutral fallback
      memoryStability:    0.70,
      explorationEntropy: 0.30,
      trendPressure:      0,
      mirofishConfidence: 0,
    };
    const routingDecision = this.smartRouting.decide(ctx);
    const modeDecision    = decideMode(
      { scene_type: 'hook', pacing: 'moderate', platform, emotion: 'confident' },
      routingDecision,
    );
    return {
      executionMode:  modeDecision.mode,
      renderEngine:   modeDecision.model,
      routingDecision,
    };
  }

  /**
   * Dispatch all active formats concurrently.
   * Returns one FormatDispatchResult per active format.
   */
  async dispatchAll(opts: {
    campaignId:  string;
    conceptId?:  string;
    platform:    string;
    allocation:  VariantAllocation;
    sharedCore:  SharedCreativeCore;
    userId:      string;
  }): Promise<FormatDispatchResult[]> {
    const { campaignId, conceptId, platform, allocation, sharedCore, userId } = opts;

    const dispatches: Promise<FormatDispatchResult>[] = [];

    if (allocation.ugcVariants > 0) {
      dispatches.push(
        this.dispatchUGC({ campaignId, conceptId, platform, sharedCore, variantCount: allocation.ugcVariants, userId }),
      );
    }

    if (allocation.carouselVariants > 0) {
      dispatches.push(
        this.dispatchCarousel({ campaignId, conceptId, sharedCore, variantCount: allocation.carouselVariants, platform, userId }),
      );
    }

    if (allocation.bannerVariants > 0) {
      dispatches.push(
        this.dispatchBanner({ campaignId, conceptId, sharedCore, variantCount: allocation.bannerVariants, userId }),
      );
    }

    const results = await Promise.allSettled(dispatches);

    return results.map((r, i) => {
      if (r.status === 'fulfilled') return r.value;
      const format = allocation.priority[i] ?? 'ugc';
      this.logger.error(`[FunnelDispatch] ${format} failed: ${r.reason}`);
      return {
        format: format as CreativeFormat,
        status: 'failed',
        ids:    [],
        variantCount: 0,
        error:  String(r.reason),
      } satisfies FormatDispatchResult;
    });
  }

  // ─── UGC dispatch (unchanged — ViralTestService is the correct path) ───────

  private async dispatchUGC(opts: {
    campaignId:   string;
    conceptId?:   string;
    platform:     string;
    sharedCore:   SharedCreativeCore;
    variantCount: number;
    userId:       string;
  }): Promise<FormatDispatchResult> {
    const { campaignId, conceptId, platform, sharedCore, variantCount, userId } = opts;

    this.logger.log(
      `[FunnelDispatch] UGC → viralTest.launch hook="${sharedCore.hook.slice(0, 50)}"`,
    );

    const personaCount = Math.min(4, Math.max(1, Math.ceil(variantCount / 3)));

    const result = await this.viralTest.launch(
      { campaignId, conceptId, platform, personaCount, durationSeconds: 15 },
      userId,
    );

    return {
      format:       'ugc',
      status:       'dispatched',
      ids:          result.jobIds,
      variantCount: result.variantCount,
    };
  }

  // ─── Carousel dispatch via ExecutionGateway (W2 FIX) ─────────────────────

  private async dispatchCarousel(opts: {
    campaignId:   string;
    conceptId?:   string;
    sharedCore:   SharedCreativeCore;
    variantCount: number;
    platform:     string;
    userId:       string;
  }): Promise<FormatDispatchResult> {
    const { campaignId, conceptId, sharedCore, variantCount, platform, userId } = opts;

    const { executionMode, renderEngine, routingDecision } =
      this.resolveDispatchMode(campaignId, platform, variantCount);

    this.logger.log(
      `[FunnelDispatch] Carousel → ${variantCount} variant(s) via gateway | ` +
      `angle=${sharedCore.angle} executionMode=${executionMode} engine=${renderEngine}`,
    );

    const ids: string[] = [];

    for (let i = 0; i < variantCount; i++) {
      const modeDecision = decideMode(
        { scene_type: 'hook', pacing: 'moderate', platform, emotion: 'confident' },
        routingDecision,
      );
      const result = await this.gateway.execute(
        {
          format:          'carousel',
          campaignId,
          conceptId:       conceptId ?? '',
          angleSlug:       sharedCore.angle,
          styleContext:    sharedCore.styleContext,
          executionMode:   modeDecision.mode,
          renderEngine:    modeDecision.model,
          modeReasoning:   modeDecision.reasoning,
          routingDecision: { ...routingDecision, variantCount: 1 },
          modelDecisions:  [modeDecision],
          slideCount:      5,
          platform,
          variantCount:    1,
        },
        userId,
      );
      ids.push(result.primaryCreativeId);
    }

    return {
      format:       'carousel',
      status:       'dispatched',
      ids,
      variantCount: ids.length,
    };
  }

  // ─── Banner dispatch via ExecutionGateway (W2 FIX) ───────────────────────

  private async dispatchBanner(opts: {
    campaignId:   string;
    conceptId?:   string;
    sharedCore:   SharedCreativeCore;
    variantCount: number;
    userId:       string;
  }): Promise<FormatDispatchResult> {
    const { campaignId, conceptId, sharedCore, variantCount, userId } = opts;

    const platform = 'tiktok'; // default — not in sharedCore at this layer
    const { executionMode, renderEngine, routingDecision } =
      this.resolveDispatchMode(campaignId, platform, variantCount);

    this.logger.log(
      `[FunnelDispatch] Banner → ${variantCount} variant(s) via gateway | ` +
      `signal=${sharedCore.ctaLogic.split('|')[0].trim()} executionMode=${executionMode} engine=${renderEngine}`,
    );

    const ids: string[] = [];

    for (let i = 0; i < variantCount; i++) {
      const modeDecision = decideMode(
        { scene_type: 'hook', pacing: 'moderate', platform, emotion: 'confident' },
        routingDecision,
      );
      const result = await this.gateway.execute(
        {
          format:          'banner',
          campaignId,
          conceptId:       conceptId ?? '',
          angleSlug:       sharedCore.angle,
          styleContext:    sharedCore.styleContext,
          executionMode:   modeDecision.mode,
          renderEngine:    modeDecision.model,
          modeReasoning:   modeDecision.reasoning,
          routingDecision: { ...routingDecision, variantCount: 1 },
          modelDecisions:  [modeDecision],
          sizes:           ['1200x628', '1080x1080', '1080x1920'],
          variantCount:    1,
        },
        userId,
      );
      ids.push(result.primaryCreativeId);
    }

    return {
      format:       'banner',
      status:       'dispatched',
      ids,
      variantCount: ids.length,
    };
  }
}
