/**
 * ugc-memory-feedback.service.ts
 *
 * Memory Feedback Loop — Phase 1.1
 *
 * After winner selection, sends three downstream signals:
 *
 *   1. MemoryService.store()    — writes winner pattern to memory
 *                                 reinforces persona weight + hook pattern
 *   2. FeedbackService.submitRealMetrics() — sends UGC-derived proxy metrics
 *                                            (hook retention → CTR, watch → retention, etc.)
 *   3. OutcomesService.reportOutcome()     — updates angle performance weights
 *
 * All three calls are non-blocking (fire-and-forget within the method).
 * Errors are caught + logged; they never throw to the caller.
 *
 * This service is the Creative OS learning loop for UGC.
 */

import { Injectable, Logger } from '@nestjs/common';

import { MemoryService }   from '../memory/memory.service';
import { FeedbackService } from '../feedback/feedback.service';
import { OutcomesService } from '../outcomes/outcomes.service';
import type { UGCMemoryFeedbackInput } from './types/viral-test.types';

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class UGCMemoryFeedbackService {
  private readonly logger = new Logger(UGCMemoryFeedbackService.name);

  constructor(
    private readonly memory:    MemoryService,
    private readonly feedback:  FeedbackService,
    private readonly outcomes:  OutcomesService,
  ) {}

  /**
   * Fire all three feedback signals for the winning UGC variant.
   * This is async but callers should NOT await it in the hot path —
   * use .catch() to prevent uncaught promise rejections.
   */
  async sendWinnerFeedback(input: UGCMemoryFeedbackInput): Promise<void> {
    const { testId, campaignId, userId, clientId, industry, winner, winnerVariant } = input;

    this.logger.log(
      `[UGCFeedback] testId=${testId} winner="${winner.winnerVariantId}" ` +
      `confidence=${winner.confidence.toFixed(2)} persona=${winnerVariant.personaId}`,
    );

    await Promise.allSettled([
      this.storeInMemory(input),
      this.submitFeedbackMetrics(input),
      this.reportOutcome(input),
    ]);
  }

  // ─── 1. Memory store ────────────────────────────────────────────────────────

  private async storeInMemory(input: UGCMemoryFeedbackInput): Promise<void> {
    const { campaignId, userId, clientId, industry, winner, winnerVariant } = input;
    try {
      await this.memory.store({
        userId,
        clientId,
        industry,
        campaignId,
        // jobId used as creativeId proxy — no Prisma creative record for UGC jobs
        creativeId: winner.winnerVariantId,
        format:     'video',
        angle:      winnerVariant.hookStrategy,
        concept: {
          persona:      winnerVariant.personaId,
          hook:         winnerVariant.hook,
          hookVariant:  winnerVariant.hookVariantId,
          emotionArc:   winnerVariant.emotionArc,
          tone:         winnerVariant.tone,
          pacing:       winnerVariant.pacing,
          confidence:   winner.confidence,
        },
        scores: {
          // Map UGC score dimensions back to memory schema fields
          ctr:        winnerVariant.ugcScoreEstimate,
          engagement: winner.leaderboard[0]?.emotionalEngagement ?? 0.70,
          conversion: winner.leaderboard[0]?.conversionProbability ?? 0.68,
          clarity:    winner.leaderboard[0]?.hookRetention ?? 0.75,
          total:      winner.winnerScore,
        },
        totalScore: winner.winnerScore,
        isWinner:   true,
      });
      this.logger.debug(`[UGCFeedback] Memory stored for variant="${winner.winnerVariantId}"`);
    } catch (err) {
      this.logger.warn(`[UGCFeedback] Memory store failed: ${err}`);
    }
  }

  // ─── 2. Feedback real-metrics ────────────────────────────────────────────────

  private async submitFeedbackMetrics(input: UGCMemoryFeedbackInput): Promise<void> {
    const { winner, winnerVariant } = input;
    const scored = winner.leaderboard[0];
    if (!scored) return;

    try {
      await this.feedback.submitRealMetrics({
        creativeId: winner.winnerVariantId,
        // UGC proxy mappings: hookRetention → CTR, avgWatchTime → retention
        ctr:        scored.hookRetention,
        retention:  scored.avgWatchTime,
        conversion: scored.conversionProbability,
        industry:   winnerVariant.personaId,   // using personaId as industry segment tag
      });
      this.logger.debug(`[UGCFeedback] Feedback metrics submitted for "${winner.winnerVariantId}"`);
    } catch (err) {
      this.logger.warn(`[UGCFeedback] Feedback submit failed: ${err}`);
    }
  }

  // ─── 3. Outcome report ───────────────────────────────────────────────────────

  private async reportOutcome(input: UGCMemoryFeedbackInput): Promise<void> {
    const { campaignId, userId, winner, winnerVariant } = input;
    const scored = winner.leaderboard[0];
    if (!scored) return;

    try {
      // Synthesise impression/click/conversion proxies from UGC scores
      const impressions  = 1000;
      const clicks       = Math.round(impressions * scored.hookRetention);
      const conversions  = Math.round(clicks * scored.conversionProbability);

      await this.outcomes.reportOutcome({
        userId,
        campaignId,
        angleSlug: winnerVariant.hookStrategy,
        metrics: {
          impressions,
          clicks,
          conversions,
        },
      });
      this.logger.debug(`[UGCFeedback] Outcome reported for angle="${winnerVariant.hookStrategy}"`);
    } catch (err) {
      this.logger.warn(`[UGCFeedback] Outcome report failed: ${err}`);
    }
  }
}
