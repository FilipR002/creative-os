/**
 * ugc-winner.service.ts
 *
 * Auto Winner Selector — Phase 1.1
 *
 * Applies multi-criteria winner selection on a scored UGC test run:
 *
 *   Primary condition:  score > all others (rank === 1)
 *   Confidence:         normalised gap between winner and runner-up
 *                       confidence = (winner - runner_up) / winner
 *   Minimum threshold:  winner must score ≥ MIN_WINNER_SCORE (0.60)
 *                       otherwise test is flagged as inconclusive
 *
 * Returns UGCWinnerResult with full leaderboard for UI display.
 */

import { Injectable, Logger } from '@nestjs/common';

import type { UGCScoringResult, UGCWinnerResult } from './types/viral-test.types';

// ─── Constants ────────────────────────────────────────────────────────────────

const MIN_WINNER_SCORE = 0.60;

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class UGCWinnerService {
  private readonly logger = new Logger(UGCWinnerService.name);

  /**
   * Select the winner from a scored test run.
   *
   * Always returns a UGCWinnerResult — even if confidence is low, we still
   * surface the best performer. Downstream callers can inspect `confidence`
   * to decide whether to act on the result.
   */
  select(scoring: UGCScoringResult): UGCWinnerResult {
    const { testId, ranked } = scoring;

    if (ranked.length === 0) {
      throw new Error(`[UGCWinner] No scored variants for testId=${testId}`);
    }

    const winner    = ranked[0];
    const runnerUp  = ranked[1] ?? null;

    // Confidence = normalised gap; 0 if only one variant
    const gap        = runnerUp ? winner.score - runnerUp.score : winner.score;
    const confidence = runnerUp
      ? Math.min(1, Math.round((gap / Math.max(winner.score, 0.001)) * 1000) / 1000)
      : 1.0;

    const result: UGCWinnerResult = {
      testId,
      winnerVariantId: winner.variantId,
      winnerScore:     winner.score,
      confidence,
      runnerUpId:      runnerUp?.variantId,
      runnerUpScore:   runnerUp?.score,
      leaderboard:     ranked,
    };

    const flag = winner.score < MIN_WINNER_SCORE
      ? ' ⚠️ BELOW_THRESHOLD (inconclusive)'
      : confidence < 0.05
        ? ' ⚠️ LOW_CONFIDENCE'
        : '';

    this.logger.log(
      `[UGCWinner] testId=${testId} winner="${winner.variantId}" ` +
      `score=${winner.score.toFixed(3)} confidence=${confidence.toFixed(2)}${flag}`,
    );

    return result;
  }
}
