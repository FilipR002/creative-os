/**
 * funnel-router.service.ts
 *
 * Full Funnel Creative OS Router — Phase 1.2
 *
 * The "CEO brain" above all creative engines. Orchestrates the full pipeline:
 *
 *   1. FunnelIntentDetector  — goal + budget → stage + intent
 *   2. FormatDecisionEngine  — stage → format allocation ratios
 *   3. CreativeAllocationBrain — ratios + budget → variant counts per format
 *   4. CrossFormatSyncService — build SharedCreativeCore (hook/angle/emotion/cta)
 *   5. FunnelDispatchService  — dispatch all formats concurrently
 *   6. CrossFormatScoring     — score each dispatched format, select winner
 *   7. FunnelMemoryFeedback   — fire memory/feedback/outcomes (non-blocking)
 */

import { Injectable, Logger } from '@nestjs/common';
import { randomUUID }          from 'crypto';

import { detectFunnelIntent }  from './funnel-intent.detector';
import { decideFormats }       from './format-decision.engine';
import { allocateVariants }    from './creative-allocation.brain';
import { scoreFormats }        from './cross-format-scoring.engine';
import { CrossFormatSyncService }     from './cross-format-sync.service';
import { FunnelDispatchService }      from './funnel-dispatch.service';
import { FunnelMemoryFeedbackService } from './funnel-memory-feedback.service';

import type {
  FunnelRouterInput,
  FunnelRouterResult,
} from './funnel-router.types';

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class FunnelRouterService {
  private readonly logger = new Logger(FunnelRouterService.name);

  constructor(
    private readonly sync:     CrossFormatSyncService,
    private readonly dispatch: FunnelDispatchService,
    private readonly feedback: FunnelMemoryFeedbackService,
  ) {}

  /**
   * Run the full funnel routing pipeline.
   *
   * @param input   — campaign context + funnel parameters
   * @param userId  — authenticated user ID
   * @param clientId — for memory scoping (default 'default')
   * @param industry — for memory/feedback categorisation
   */
  async run(
    input:    FunnelRouterInput,
    userId:   string,
    clientId: string = 'default',
    industry: string = 'general',
  ): Promise<FunnelRouterResult> {
    const routerId = randomUUID();
    const platform = input.platform ?? 'tiktok';

    this.logger.log(
      `[FunnelRouter] routerId=${routerId} campaign=${input.campaignId} ` +
      `goal=${input.goal} budget=${input.budgetLevel}`,
    );

    // ── 1. Funnel Intent Detection ─────────────────────────────────────────
    const funnelIntent = detectFunnelIntent({
      goal:        input.goal,
      budgetLevel: input.budgetLevel,
      funnelStage: input.funnelStage,
      intentType:  input.intentType,
    });

    this.logger.log(
      `[FunnelRouter] stage=${funnelIntent.funnelStage} intent=${funnelIntent.intentType} ` +
      `signal=${funnelIntent.prioritySignal} formats=[${funnelIntent.recommendedFormats.join(',')}]`,
    );

    // ── 2. Format Decision ─────────────────────────────────────────────────
    const formatDecision = decideFormats({
      intent: funnelIntent,
      budget: input.budgetLevel,
    });

    this.logger.log(
      `[FunnelRouter] primary=${formatDecision.primaryFormat} ` +
      `secondary=${formatDecision.secondaryFormat} ` +
      `active=[${formatDecision.activeFormats.join(',')}] ` +
      `alloc=ugc:${formatDecision.allocation.ugc}/carousel:${formatDecision.allocation.carousel}/banner:${formatDecision.allocation.banner}`,
    );

    // ── 3. Variant Allocation ──────────────────────────────────────────────
    const allocation = allocateVariants({
      decision: formatDecision,
      budget:   input.budgetLevel,
    });

    this.logger.log(
      `[FunnelRouter] variants: ugc=${allocation.ugcVariants} ` +
      `carousel=${allocation.carouselVariants} banner=${allocation.bannerVariants} ` +
      `total=${allocation.totalVariants}`,
    );

    // ── 4. Cross-Format Sync ───────────────────────────────────────────────
    const sharedCore = await this.sync.buildSharedCore({
      campaignId: input.campaignId,
      conceptId:  input.conceptId,
      intent:     funnelIntent,
      product:    input.product,
      audience:   input.audience,
    });

    this.logger.log(
      `[FunnelRouter] SharedCore: angle=${sharedCore.angle} emotion=${sharedCore.emotion} ` +
      `hook="${sharedCore.hook.slice(0, 60)}"`,
    );

    // ── 5. Parallel Dispatch ───────────────────────────────────────────────
    const dispatches = await this.dispatch.dispatchAll({
      campaignId:  input.campaignId,
      conceptId:   input.conceptId,
      platform,
      allocation,
      sharedCore,
      userId,
    });

    const anySuccess = dispatches.some(d => d.status === 'dispatched');
    const status: FunnelRouterResult['status'] = anySuccess
      ? dispatches.every(d => d.status === 'dispatched') ? 'dispatched' : 'partial'
      : 'failed';

    for (const d of dispatches) {
      this.logger.log(
        `[FunnelRouter] ${d.format}: status=${d.status} ids=${d.ids.length}` +
        (d.error ? ` error="${d.error}"` : ''),
      );
    }

    // ── 6. Cross-Format Scoring ────────────────────────────────────────────
    const crossScore = anySuccess
      ? scoreFormats({ dispatches, intent: funnelIntent })
      : undefined;

    if (crossScore) {
      this.logger.log(
        `[FunnelRouter] WinnerFormat=${crossScore.winnerFormat} score=${crossScore.winnerScore.toFixed(3)}`,
      );
    }

    // ── 7. Build result ────────────────────────────────────────────────────
    const result: FunnelRouterResult = {
      routerId,
      campaignId:       input.campaignId,
      funnelIntent,
      formatDecision,
      allocation,
      sharedCore,
      dispatches,
      crossFormatScore: crossScore,
      status,
      dispatchedAt:     new Date().toISOString(),
    };

    // ── 8. Memory feedback (fire-and-forget) ───────────────────────────────
    if (crossScore) {
      this.feedback
        .sendFunnelFeedback({ result, score: crossScore, sharedCore, userId, clientId, industry })
        .catch(err => this.logger.warn(`[FunnelRouter] Feedback error: ${err}`));
    }

    return result;
  }
}
