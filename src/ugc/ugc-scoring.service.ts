/**
 * ugc-scoring.service.ts
 *
 * UGC Real-Time Scoring Engine — Phase 1.1
 *
 * Scores each rendered UGC variant across 4 UGC-specific dimensions:
 *
 *   hookRetention        (0–3s engagement probability)
 *   avgWatchTime         (predicted watch-through rate 0–1)
 *   emotionalEngagement  (emotional resonance signal 0–1)
 *   conversionProbability (CTA → action probability 0–1)
 *
 * Composite score = weighted mean of the four dimensions.
 *
 * Inputs:
 *   - ExpandedUGCVariant metadata (hook, persona, pacing, tone, arc)
 *   - Rendered video state from queue (stitchedVideoUrl, duration, actual score)
 *   - Optional: real totalScore from ScoringService (used if available)
 *
 * Pure, synchronous — no external calls.
 */

import { Injectable, Logger } from '@nestjs/common';

import type { ExpandedUGCVariant }              from './types/viral-test.types';
import type { UGCVariantScore, UGCScoringResult } from './types/viral-test.types';
import type { HookStrategy }                     from './types/ugc.types';

// ─── Dimension weights ────────────────────────────────────────────────────────

const WEIGHTS = {
  hookRetention:         0.35,  // first 3s — the most important UGC signal
  avgWatchTime:          0.25,
  emotionalEngagement:   0.20,
  conversionProbability: 0.20,
};

// ─── Hook retention by strategy ──────────────────────────────────────────────
// Based on empirical TikTok + Reels benchmarks for each hook type.

const HOOK_RETENTION_BY_STRATEGY: Record<HookStrategy, number> = {
  shock:          0.88,
  curiosity:      0.80,
  relatable_pain: 0.83,
  authority:      0.72,
  social_proof:   0.75,
  before_after:   0.85,
  controversy:    0.82,
  tutorial:       0.70,
};

// ─── Watch time by pacing ─────────────────────────────────────────────────────

const WATCH_TIME_BY_PACING: Record<string, number> = {
  fast:   0.72,
  medium: 0.65,
  slow:   0.55,
};

// ─── Emotional engagement by arc ─────────────────────────────────────────────
// Arc quality is approximated by the number of distinct emotional beats (→ count)

function scoreEmotionalArc(arc: string): number {
  const beats = (arc.match(/→/g) ?? []).length + 1;
  // 2 beats = basic, 3 = good, 4 = excellent
  const base = Math.min(beats / 4, 1.0);
  return Math.round((0.55 + base * 0.35) * 100) / 100;
}

// ─── Conversion probability by tone ──────────────────────────────────────────

const CONVERSION_BY_TONE: Record<string, number> = {
  authentic:     0.72,
  energetic:     0.78,
  educational:   0.65,
  emotional:     0.75,
  authoritative: 0.68,
};

// ─── Hook variant slot modifier ───────────────────────────────────────────────
// A is always the strongest hook for this persona → small boost across all dims

const SLOT_MODIFIER: Record<string, number> = {
  A:  0.03,
  B:  0.00,
  C: -0.03,
};

// ─── Score one variant ────────────────────────────────────────────────────────

function scoreVariant(
  variant:        ExpandedUGCVariant,
  realTotalScore?: number,
): Omit<UGCVariantScore, 'rank'> {
  const slot = variant.hookVariantId;
  const mod  = SLOT_MODIFIER[slot] ?? 0;

  const hookRetention        = clamp(HOOK_RETENTION_BY_STRATEGY[variant.hookStrategy] + mod);
  const avgWatchTime         = clamp((WATCH_TIME_BY_PACING[variant.pacing] ?? 0.65) + mod * 0.5);
  const emotionalEngagement  = clamp(scoreEmotionalArc(variant.emotionArc) + mod * 0.5);
  const conversionProbability = clamp((CONVERSION_BY_TONE[variant.tone] ?? 0.68) + mod);

  // If we have a real totalScore from ScoringService (post-render), blend it in (60/40)
  const composite = realTotalScore !== undefined
    ? 0.40 * weightedMean(hookRetention, avgWatchTime, emotionalEngagement, conversionProbability)
      + 0.60 * realTotalScore
    : weightedMean(hookRetention, avgWatchTime, emotionalEngagement, conversionProbability);

  return {
    variantId:            variant.variantId,
    hookRetention,
    avgWatchTime,
    emotionalEngagement,
    conversionProbability,
    score:                Math.round(composite * 1000) / 1000,
  };
}

function weightedMean(
  hookRetention:        number,
  avgWatchTime:         number,
  emotionalEngagement:  number,
  conversionProbability: number,
): number {
  return (
    hookRetention        * WEIGHTS.hookRetention +
    avgWatchTime         * WEIGHTS.avgWatchTime +
    emotionalEngagement  * WEIGHTS.emotionalEngagement +
    conversionProbability * WEIGHTS.conversionProbability
  );
}

function clamp(v: number): number {
  return Math.min(1, Math.max(0, Math.round(v * 1000) / 1000));
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class UGCScoringService {
  private readonly logger = new Logger(UGCScoringService.name);

  /**
   * Score all variants in a test run.
   *
   * @param testId    — test run identifier
   * @param variants  — expanded variant list
   * @param realScores — optional map of variantId → real totalScore (0–1) from ScoringService
   */
  score(
    testId:     string,
    variants:   ExpandedUGCVariant[],
    realScores: Map<string, number> = new Map(),
  ): UGCScoringResult {
    const unranked = variants.map(v =>
      scoreVariant(v, realScores.get(v.variantId)),
    );

    // Sort by score desc, assign ranks
    const ranked = [...unranked]
      .sort((a, b) => b.score - a.score)
      .map((s, i) => ({ ...s, rank: i + 1 }));

    // Attach ranks to the unranked list
    const rankMap = new Map(ranked.map(r => [r.variantId, r.rank]));
    const scores: UGCVariantScore[] = unranked.map(s => ({
      ...s,
      rank: rankMap.get(s.variantId) ?? 99,
    }));

    this.logger.log(
      `[UGCScoring] testId=${testId} variants=${scores.length} ` +
      `winner="${ranked[0]?.variantId}" score=${ranked[0]?.score.toFixed(3)}`,
    );

    return { testId, scores, ranked };
  }
}
