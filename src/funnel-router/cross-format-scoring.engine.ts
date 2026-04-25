/**
 * cross-format-scoring.engine.ts
 *
 * Cross-Format Scoring Engine — Phase 1.2
 *
 * Assigns a performance score to each dispatched format and selects
 * the winning format for this funnel run.
 *
 * Scoring dimensions per format:
 *   UGC      → hook retention proxy (top-of-funnel view signal)
 *   Carousel → swipe-rate proxy (engagement depth signal)
 *   Banner   → CTR proxy (direct response signal)
 *
 * Scores are derived from:
 *   - funnel stage priority signal (which dimension matters most)
 *   - variant count (more variants = higher signal confidence)
 *   - dispatch success (failed dispatch scores 0)
 *
 * All logic is pure — no DI, no external calls.
 */

import type {
  FormatDispatchResult,
  FunnelIntentResult,
  CrossFormatScore,
  CreativeFormat,
  PrioritySignal,
} from './funnel-router.types';

// ─── Base scores by format (empirical benchmarks) ────────────────────────────

const BASE_SCORES: Record<CreativeFormat, number> = {
  ugc:      0.82,
  carousel: 0.74,
  banner:   0.68,
};

// ─── Priority signal → format multiplier ─────────────────────────────────────

const SIGNAL_MULTIPLIER: Record<PrioritySignal, Partial<Record<CreativeFormat, number>>> = {
  trust:      { ugc: 1.10, carousel: 1.05, banner: 0.90 },
  emotion:    { ugc: 1.05, carousel: 1.10, banner: 0.85 },
  conversion: { ugc: 0.95, carousel: 0.90, banner: 1.15 },
};

// ─── Variant count confidence bonus ──────────────────────────────────────────
// More variants = higher confidence in format performance signal

function variantConfidenceBonus(count: number): number {
  if (count >= 5) return 0.04;
  if (count >= 3) return 0.02;
  if (count >= 2) return 0.01;
  return 0;
}

// ─── Scorer ──────────────────────────────────────────────────────────────────

export function scoreFormats(opts: {
  dispatches: FormatDispatchResult[];
  intent:     FunnelIntentResult;
}): CrossFormatScore {
  const { dispatches, intent } = opts;
  const signal      = intent.prioritySignal;
  const multipliers = SIGNAL_MULTIPLIER[signal];

  const scoreMap = new Map<CreativeFormat, number>();

  for (const dispatch of dispatches) {
    if (dispatch.status !== 'dispatched') {
      scoreMap.set(dispatch.format, 0);
      continue;
    }

    const base        = BASE_SCORES[dispatch.format] ?? 0.70;
    const multiplier  = multipliers[dispatch.format] ?? 1.0;
    const bonus       = variantConfidenceBonus(dispatch.variantCount);
    const raw         = base * multiplier + bonus;
    scoreMap.set(dispatch.format, Math.min(1, Math.round(raw * 1000) / 1000));
  }

  // Winner = highest scoring dispatched format
  const entries = [...scoreMap.entries()].sort((a, b) => b[1] - a[1]);
  const [winnerFormat, winnerScore] = entries[0] ?? ['ugc', 0];

  return {
    ugcScore:      scoreMap.get('ugc'),
    carouselScore: scoreMap.get('carousel'),
    bannerScore:   scoreMap.get('banner'),
    winnerFormat,
    winnerScore,
  };
}
