// ─── 4.9 Auto Winner System — Engine (pure functions, no DI, no Prisma) ───────
// Post-generation evaluation layer: ranks creative variants, selects winner,
// and prepares feedback signals for the memory system (4.10).

import {
  scoreVideo, scoreCarousel, scoreBanner, computeTotalScore,
} from '../scoring/scoring.utils';
import {
  AutoWinnerInput,
  AutoWinnerOutput,
  CreativeVariant,
  RawProxies,
  ScoredVariant,
  VariantScoreBreakdown,
  WinnerAngleContext,
  WinnerFormat,
} from './auto-winner.types';

// ─── Constants ────────────────────────────────────────────────────────────────

// Max additive/subtractive adjustments (points on the 0-100 scale).
const MAX_ANGLE_PENALTY     = 8;
const MAX_FATIGUE_PENALTY   = 10;
const MAX_EXPLORATION_BONUS = 10;
const MAX_MEMORY_BOOST      = 5;

// ─── Angle keyword map ────────────────────────────────────────────────────────
// Used for angle alignment detection. Each set is characteristic vocabulary.

const ANGLE_KEYWORDS: Record<string, string[]> = {
  teach:              ['learn', 'discover', 'know', 'understand', 'lesson', 'insight', 'teach', 'master'],
  show_off:           ['look', 'see', 'watch', 'results', 'proof', 'real', 'actual', 'show'],
  storytelling:       ['story', 'happened', 'changed', 'told', 'journey', 'was', 'when i', 'she', 'he'],
  tips_tricks:        ['tip', 'trick', 'hack', 'method', 'step', 'way', 'simple', 'easy'],
  spark_conversation: ['opinion', 'think', 'believe', 'debate', 'hot take', 'disagree', 'conversation'],
  data_stats:         ['%', 'percent', 'study', 'research', 'data', 'number', 'statistic', 'proven'],
  before_after:       ['before', 'after', 'transformation', 'changed', 'difference', 'vs', 'compare'],
  unpopular_opinion:  ['unpopular', 'controversial', 'nobody', 'truth', 'honest', 'admit'],
  do_this_not_that:   ['stop', 'instead', 'wrong', 'right', 'mistake', 'correct', 'avoid'],
  proof:              ['proof', 'evidence', 'verified', 'real', 'testimonial', 'review', 'witness'],
  curiosity:          ['secret', 'hidden', 'unknown', 'surprising', 'never knew', 'what if', 'curious'],
  hot_take:           ['hot take', 'actually', 'controversial', 'debate', 'split', 'divided'],
  problem_solution:   ['problem', 'solution', 'solve', 'fix', 'answer', 'struggle', 'challenge'],
  mistake_avoidance:  ['mistake', 'avoid', 'error', 'wrong', 'cost', 'danger', 'warning'],
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function clamp(v: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, v));
}

function extractText(content: any): string {
  if (typeof content === 'string') return content.toLowerCase();
  const scenes: any[] = content?.scenes || [];
  const slides: any[] = content?.slides || [];
  const banners: any[] = content?.banners || [];
  return [
    ...scenes.flatMap((s: any) => [s.voiceover, s.on_screen_text, s.visual_prompt]),
    ...slides.flatMap((s: any) => [s.hook, s.headline, s.body]),
    ...banners.flatMap((b: any) => [b.headline, b.subtext, b.cta]),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

// ─── Raw proxy computation ────────────────────────────────────────────────────

function computeProxies(variant: CreativeVariant, format: WinnerFormat): RawProxies {
  // If fully pre-provided, use directly (blend with heuristic at 70/30).
  const pd = variant.performance_data;
  if (pd && pd.ctr != null && pd.retention != null && pd.conversion != null && pd.clarity != null) {
    return {
      ctrProxy:        pd.ctr,
      engagementProxy: pd.retention,
      conversionProxy: pd.conversion,
      clarity:         pd.clarity,
    };
  }

  let heuristic: RawProxies;
  const isStringContent = typeof variant.content === 'string';

  if (isStringContent) {
    // Plain hook string: derive proxies from hook-only analysis.
    const { scoreVideo: _sv, ..._ } = { scoreVideo };
    const fakeContent = {
      scenes: [{
        type: 'hook',
        voiceover: variant.content,
        on_screen_text: variant.content,
        visual_prompt: '',
      }, {
        type: 'cta',
        voiceover: 'Click the link below.',
        on_screen_text: 'Get started now.',
        visual_prompt: '',
      }],
    };
    const r = scoreVideo(fakeContent);
    heuristic = { ctrProxy: r.ctrProxy, engagementProxy: r.engagementProxy, conversionProxy: r.conversionProxy, clarity: r.clarity };
  } else {
    let r: { ctrProxy: number; engagementProxy: number; conversionProxy: number; clarity: number };
    if (format === 'video')    r = scoreVideo(variant.content);
    else if (format === 'carousel') r = scoreCarousel(variant.content);
    else                            r = scoreBanner(variant.content);
    heuristic = { ctrProxy: r.ctrProxy, engagementProxy: r.engagementProxy, conversionProxy: r.conversionProxy, clarity: r.clarity };
  }

  // Blend partial pre-provided values with heuristic.
  return {
    ctrProxy:        pd?.ctr        ?? heuristic.ctrProxy,
    engagementProxy: pd?.retention  ?? heuristic.engagementProxy,
    conversionProxy: pd?.conversion ?? heuristic.conversionProxy,
    clarity:         pd?.clarity    ?? heuristic.clarity,
  };
}

// ─── Angle alignment ─────────────────────────────────────────────────────────

function scoreAngleAlignment(text: string, angle: WinnerAngleContext): number {
  const checkAngle = (slug: string | null | undefined, weight: number): number => {
    if (!slug) return weight; // no secondary → neutral (no penalty)
    const keywords = ANGLE_KEYWORDS[slug] ?? [];
    if (!keywords.length) return weight * 0.80; // unknown angle → slight uncertainty
    const matches = keywords.filter(kw => text.includes(kw)).length;
    return weight * Math.min(matches / Math.max(Math.ceil(keywords.length * 0.25), 1), 1);
  };
  const primaryScore   = checkAngle(angle.primary,   0.70);
  const secondaryScore = checkAngle(angle.secondary, 0.30);
  return clamp(primaryScore + secondaryScore, 0, 1);
}

// ─── Fatigue penalty (cross-variant) ─────────────────────────────────────────
// Measures vocabulary overlap between this variant and others.
// High overlap → repetition → penalty.

function computeFatiguePenalties(
  variants:      CreativeVariant[],
  fatigueLevel:  number,  // 0–1 from fatigue_signals
): number[] {
  const texts = variants.map(v => {
    const raw = extractText(v.content);
    return new Set(raw.split(/\s+/).filter(w => w.length > 3));
  });

  return texts.map((wordSet, i) => {
    if (wordSet.size === 0) return 0;
    let overlapCount = 0;
    for (let j = 0; j < texts.length; j++) {
      if (i === j) continue;
      const shared = [...wordSet].filter(w => texts[j].has(w)).length;
      const overlapRatio = shared / wordSet.size;
      if (overlapRatio > 0.50) overlapCount++;
    }
    // Penalty scales with fatigue level (fatigue amplifies repetition cost).
    const rawPenalty = (overlapCount / Math.max(variants.length - 1, 1)) * MAX_FATIGUE_PENALTY;
    return parseFloat(clamp(rawPenalty * (0.50 + fatigueLevel * 0.50), 0, MAX_FATIGUE_PENALTY).toFixed(2));
  });
}

// ─── Exploration bonus ────────────────────────────────────────────────────────
// Rewards variants with vocabulary distinct from the cluster median.

function computeExplorationBonuses(
  variants:         CreativeVariant[],
  explorationDelta: number,  // normalised 0–1
): number[] {
  const texts = variants.map(v => {
    const raw = extractText(v.content);
    return new Set(raw.split(/\s+/).filter(w => w.length > 3));
  });

  // Build cluster vocabulary (union of all words).
  const cluster = new Set<string>();
  texts.forEach(ws => ws.forEach(w => cluster.add(w)));

  return texts.map(wordSet => {
    if (wordSet.size === 0) return 0;
    const uniqueWords = [...wordSet].filter(w => {
      const occursInOthers = texts.filter(other => other !== wordSet && other.has(w)).length;
      return occursInOthers === 0;
    });
    const noveltyRatio = uniqueWords.length / wordSet.size;
    const bonus = noveltyRatio * explorationDelta * MAX_EXPLORATION_BONUS;
    return parseFloat(clamp(bonus, 0, MAX_EXPLORATION_BONUS).toFixed(2));
  });
}

// ─── Memory boost ─────────────────────────────────────────────────────────────

function computeMemoryBoost(primaryAngle: string, memorySignals?: AutoWinnerInput['memory_signals']): number {
  const perf = memorySignals?.angle_performance?.[primaryAngle];
  if (perf == null) return 0;
  // Boost proportional to historical performance above 0.5 baseline.
  return parseFloat(clamp(Math.max(0, perf - 0.50) * 2 * MAX_MEMORY_BOOST, 0, MAX_MEMORY_BOOST).toFixed(2));
}

// ─── Tie-breaker comparison ───────────────────────────────────────────────────

function compareTieBreaker(a: ScoredVariant, b: ScoredVariant): number {
  // 1. Higher conversion
  const convDiff = b.breakdown.conversion - a.breakdown.conversion;
  if (Math.abs(convDiff) > 0.5) return convDiff;
  // 2. Higher clarity
  const clarDiff = b.breakdown.clarity - a.breakdown.clarity;
  if (Math.abs(clarDiff) > 0.5) return clarDiff;
  // 3. Better angle alignment
  return b.angle_alignment - a.angle_alignment;
}

// ─── Winner selection ─────────────────────────────────────────────────────────

function selectWinner(scored: ScoredVariant[]): ScoredVariant {
  return scored.reduce((best, current) => {
    if (current.final_score > best.final_score) return current;
    if (current.final_score === best.final_score) {
      return compareTieBreaker(current, best) < 0 ? current : best;
    }
    return best;
  });
}

// ─── Reasoning ───────────────────────────────────────────────────────────────

function buildReasoning(
  scored:      ScoredVariant[],
  winner:      ScoredVariant,
  format:      WinnerFormat,
  primaryAngle: string,
): string {
  const n = scored.length;
  const scoreRange = `${Math.min(...scored.map(v => v.final_score)).toFixed(1)}–${Math.max(...scored.map(v => v.final_score)).toFixed(1)}`;
  const winnerLine = `Variant "${winner.id}" wins with score ${winner.final_score.toFixed(1)}/100 across ${n} evaluated variants (range: ${scoreRange}).`;
  const breakdownLine = `Breakdown — CTR: ${winner.breakdown.ctr.toFixed(1)}, Retention: ${winner.breakdown.retention.toFixed(1)}, Conversion: ${winner.breakdown.conversion.toFixed(1)}, Clarity: ${winner.breakdown.clarity.toFixed(1)}.`;
  const modLine = winner.fatigue_penalty > 0 || winner.exploration_bonus > 0
    ? `Modifiers: fatigue penalty −${winner.fatigue_penalty}, exploration bonus +${winner.exploration_bonus}.`
    : 'No significant fatigue or exploration modifiers applied to winner.';
  const angleLine = `Angle "${primaryAngle}" alignment: ${(winner.angle_alignment * 100).toFixed(0)}%. Format: ${format}.`;
  return `${winnerLine} ${breakdownLine} ${modLine} ${angleLine}`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function evaluateVariants(input: AutoWinnerInput): AutoWinnerOutput {
  const {
    format, creative_variants, angle_context,
    performance_signals, memory_signals, fatigue_signals,
    exploration_signal,
  } = input;

  // Normalise exploration delta (−0.10…+0.25) to 0–1.
  const normExploration = clamp((( exploration_signal ?? 0) + 0.10) / 0.35, 0, 1);

  // Fatigue level for primary angle.
  const fatigueLevel = clamp(
    fatigue_signals?.angle_fatigue?.[angle_context.primary] ?? 0,
    0, 1,
  );

  const memoryBoost = computeMemoryBoost(angle_context.primary, memory_signals);

  // Merge per-variant performance signals into variants.
  const enriched: CreativeVariant[] = creative_variants.map(v => {
    const sig = performance_signals?.[v.id];
    if (!sig) return v;
    return { ...v, performance_data: { ...sig, ...(v.performance_data ?? {}) } };
  });

  // Cross-variant modifiers.
  const fatiguePenalties   = computeFatiguePenalties(enriched, fatigueLevel);
  const explorationBonuses = computeExplorationBonuses(enriched, normExploration);

  const scored: ScoredVariant[] = enriched.map((variant, idx) => {
    const proxies  = computeProxies(variant, format);
    const baseNorm = computeTotalScore(proxies);  // 0–1 from existing scorer

    // Scale to 0–100 per spec.
    const base100  = baseNorm * 100;

    // Angle alignment (0–1).
    const text           = extractText(variant.content);
    const angle_alignment = parseFloat(scoreAngleAlignment(text, angle_context).toFixed(3));
    const anglePenaltyPts = (1 - angle_alignment) * MAX_ANGLE_PENALTY;

    const fatigue_penalty   = fatiguePenalties[idx];
    const exploration_bonus = explorationBonuses[idx];

    const final_score = parseFloat(
      clamp(
        base100 + memoryBoost - anglePenaltyPts - fatigue_penalty + exploration_bonus,
        0, 100,
      ).toFixed(1),
    );

    const breakdown: VariantScoreBreakdown = {
      ctr:        parseFloat((proxies.ctrProxy        * 100).toFixed(1)),
      retention:  parseFloat((proxies.engagementProxy * 100).toFixed(1)),
      conversion: parseFloat((proxies.conversionProxy * 100).toFixed(1)),
      clarity:    parseFloat((proxies.clarity         * 100).toFixed(1)),
    };

    return { id: variant.id, final_score, breakdown, angle_alignment, fatigue_penalty, exploration_bonus };
  });

  const winner = selectWinner(scored);
  const reasoning = buildReasoning(scored, winner, format, angle_context.primary);

  return {
    format,
    variants: scored,
    winner: { id: winner.id, final_score: winner.final_score },
    reasoning,
  };
}
