/**
 * funnel-memory-feedback.service.ts
 *
 * Funnel-Level Memory Feedback Loop — Phase 1.2
 *
 * After all formats are dispatched and scored, sends three feedback signals:
 *
 *   1. MemoryService.store()               — winner format pattern
 *   2. FeedbackService.submitRealMetrics() — cross-format performance proxy
 *   3. OutcomesService.reportOutcome()     — angle performance update
 *
 * Stores: which format won, which hook/angle performed best, funnel stage.
 * This creates the "best format per funnel stage" learning loop.
 *
 * All three calls run concurrently; errors are logged, never thrown.
 */

import { Injectable, Logger } from '@nestjs/common';

import { MemoryService }   from '../memory/memory.service';
import { FeedbackService } from '../feedback/feedback.service';
import { OutcomesService } from '../outcomes/outcomes.service';
import type {
  FunnelRouterResult,
  CrossFormatScore,
  SharedCreativeCore,
} from './funnel-router.types';

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class FunnelMemoryFeedbackService {
  private readonly logger = new Logger(FunnelMemoryFeedbackService.name);

  constructor(
    private readonly memory:   MemoryService,
    private readonly feedback: FeedbackService,
    private readonly outcomes: OutcomesService,
  ) {}

  /**
   * Fire all three feedback signals from a completed funnel run.
   * Non-blocking — call without await in the hot path.
   */
  async sendFunnelFeedback(opts: {
    result:      FunnelRouterResult;
    score:       CrossFormatScore;
    sharedCore:  SharedCreativeCore;
    userId:      string;
    clientId:    string;
    industry:    string;
  }): Promise<void> {
    const { result, score, sharedCore, userId, clientId, industry } = opts;

    this.logger.log(
      `[FunnelFeedback] routerId=${result.routerId} winnerFormat=${score.winnerFormat} ` +
      `score=${score.winnerScore.toFixed(3)} angle=${sharedCore.angle}`,
    );

    await Promise.allSettled([
      this.storeMemory(result, score, sharedCore, userId, clientId, industry),
      this.submitFeedback(result, score, sharedCore),
      this.reportOutcome(result, score, sharedCore, userId),
    ]);
  }

  // ─── 1. Memory store ────────────────────────────────────────────────────────

  private async storeMemory(
    result:     FunnelRouterResult,
    score:      CrossFormatScore,
    core:       SharedCreativeCore,
    userId:     string,
    clientId:   string,
    industry:   string,
  ): Promise<void> {
    try {
      await this.memory.store({
        userId,
        clientId,
        industry,
        campaignId: result.campaignId,
        creativeId: result.routerId,
        format:     score.winnerFormat,
        angle:      core.angle,
        concept: {
          routerId:     result.routerId,
          funnelStage:  result.funnelIntent.funnelStage,
          intentType:   result.funnelIntent.intentType,
          prioritySig:  result.funnelIntent.prioritySignal,
          winnerFormat: score.winnerFormat,
          hook:         core.hook,
          emotion:      core.emotion,
          ctaLogic:     core.ctaLogic,
        },
        scores: {
          ctr:        score.ugcScore      ?? score.winnerScore,
          engagement: score.carouselScore ?? score.winnerScore,
          conversion: score.bannerScore   ?? score.winnerScore,
          clarity:    score.winnerScore,
          total:      score.winnerScore,
        },
        totalScore: score.winnerScore,
        isWinner:   true,
      });
      this.logger.debug(`[FunnelFeedback] Memory stored: routerId=${result.routerId}`);
    } catch (err) {
      this.logger.warn(`[FunnelFeedback] Memory store failed: ${err}`);
    }
  }

  // ─── 2. Feedback metrics ─────────────────────────────────────────────────────

  private async submitFeedback(
    result: FunnelRouterResult,
    score:  CrossFormatScore,
    core:   SharedCreativeCore,
  ): Promise<void> {
    try {
      await this.feedback.submitRealMetrics({
        creativeId: result.routerId,
        // Map cross-format scores to feedback dimensions
        ctr:        score.ugcScore      ?? score.winnerScore * 0.85,
        retention:  score.carouselScore ?? score.winnerScore * 0.80,
        conversion: score.bannerScore   ?? score.winnerScore * 0.75,
        industry:   result.funnelIntent.funnelStage,   // use funnel stage as industry tag
      });
      this.logger.debug(`[FunnelFeedback] Feedback submitted: routerId=${result.routerId}`);
    } catch (err) {
      this.logger.warn(`[FunnelFeedback] Feedback submit failed: ${err}`);
    }
  }

  // ─── 3. Outcome report ───────────────────────────────────────────────────────

  private async reportOutcome(
    result: FunnelRouterResult,
    score:  CrossFormatScore,
    core:   SharedCreativeCore,
    userId: string,
  ): Promise<void> {
    try {
      const impressions = 1000;
      const clicks      = Math.round(impressions * score.winnerScore * 0.85);
      const conversions = Math.round(clicks * score.winnerScore * 0.50);

      await this.outcomes.reportOutcome({
        userId,
        campaignId: result.campaignId,
        angleSlug:  core.angle,
        metrics:    { impressions, clicks, conversions },
      });
      this.logger.debug(`[FunnelFeedback] Outcome reported: angle=${core.angle}`);
    } catch (err) {
      this.logger.warn(`[FunnelFeedback] Outcome report failed: ${err}`);
    }
  }
}
