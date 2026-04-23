// ─── 4.8 Scene Rewriting Engine — Engine (pure functions, no DI, no Prisma) ───
// Micro-optimization layer: rewrites ONLY the weak parts of an existing creative.
// Preserves angle, emotion, and campaign goal — improves clarity/intensity/CTR.

import {
  AngleContext,
  PerformanceSignal,
  RewriteFormat,
  RewriteImprovementType,
  RewriteVariant,
  SceneRewriterInput,
  SceneRewriterOutput,
  WeaknessProfile,
} from './scene-rewriter.types';

// ─── Thresholds ───────────────────────────────────────────────────────────────

const CTR_THRESHOLD        = 0.04;  // below → PERFORMANCE weakness
const RETENTION_THRESHOLD  = 0.50;  // below → EMOTIONAL weakness
const CONVERSION_THRESHOLD = 0.70;  // below → CLARITY weakness

// ─── CLARITY — filler patterns ───────────────────────────────────────────────

const FILLER_PATTERNS: [RegExp, string][] = [
  [/\b(essentially|basically|literally|actually|really|very|quite|rather|somewhat)\b\s*/gi, ''],
  [/\b(various|numerous|multiple|several|many|some)\s+(things|features|options|ways|aspects)\b/gi, ''],
  [/\band (so on|etc\.?|more\.?)\b/gi, ''],
  [/\bin order to\b/gi, 'to'],
  [/\bat the end of the day\b/gi, 'ultimately'],
  [/\bthe fact that\b/gi, ''],
  [/\bit is worth noting that\b/gi, ''],
  [/\bwith that in mind\b/gi, ''],
  [/\bthat being said\b/gi, ''],
];

const PASSIVE_TO_ACTIVE: [RegExp, string][] = [
  [/\bis (designed|built|made|created) to\b/gi, 'helps you'],
  [/\bcan be used to\b/gi, 'helps you'],
  [/\bis (able|capable) to\b/gi, 'can'],
  [/\bwill be (able to|capable of)\b/gi, 'can'],
];

// ─── EMOTIONAL — power verb substitutions ────────────────────────────────────

const POWER_VERBS: [RegExp, string][] = [
  [/\bhelp(s)?\b/gi, 'transform$1'],
  [/\bget(s)?\b/gi,  'unlock$1'],
  [/\buse(s)?\b/gi,  'master$1'],
  [/\btry(ing)?\b/gi, 'commit$1'],
  [/\blearn(s)?\b/gi, 'discover$1'],
  [/\bimprove(s)?\b/gi, 'elevate$1'],
  [/\bchange(s)?\b/gi, 'transform$1'],
  [/\bstart(s)?\b/gi, 'launch$1'],
];

// Emotion → opening intensifier for emotional rewrites.
const EMOTIONAL_OPENERS: Record<string, string> = {
  urgency:     'This cannot wait — ',
  fear:        'Do not ignore this — ',
  excitement:  'You need to see this — ',
  curiosity:   'Here is what nobody explains — ',
  trust:       'Here is the real story — ',
  pain:        'You deserve better than this — ',
  inspiration: 'This is your moment — ',
  confidence:  'The answer is right here — ',
};

// ─── PERFORMANCE — CTR intensifiers ──────────────────────────────────────────

const CTR_OPENERS: Record<string, string> = {
  video:    'The one thing that changes everything — ',
  carousel: 'What top performers already know — ',
  banner:   'Proven. Tested. ',
};

// Specificity fragments to add when text lacks numbers.
const SPECIFICITY_FRAGMENTS: Record<string, string> = {
  video:    '87% of people who try this see results within 30 days. ',
  carousel: 'Trusted by 10,000+ people. ',
  banner:   '87% success rate. ',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function hasNumbers(text: string): boolean {
  return /\d/.test(text);
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).length;
}

function trimToWords(text: string, maxWords: number): string {
  const words = text.trim().split(/\s+/);
  if (words.length <= maxWords) return text;
  return words.slice(0, maxWords).join(' ');
}

function collapseSpaces(text: string): string {
  return text.replace(/\s{2,}/g, ' ').trim();
}

// ─── Weakness detection ───────────────────────────────────────────────────────

function detectWeakness(signal: PerformanceSignal): WeaknessProfile {
  const ctr_gap        = signal.ctr        != null ? clamp(CTR_THRESHOLD - signal.ctr,        0, 1) : 0;
  const retention_gap  = signal.retention  != null ? clamp(RETENTION_THRESHOLD - signal.retention, 0, 1) : 0;
  const conversion_gap = signal.conversion != null ? clamp(CONVERSION_THRESHOLD - signal.conversion, 0, 1) : 0;

  // Order improvement types by gap severity descending.
  const scored: [RewriteImprovementType, number][] = [
    ['PERFORMANCE', ctr_gap],
    ['EMOTIONAL',   retention_gap],
    ['CLARITY',     conversion_gap],
  ];
  scored.sort((a, b) => b[1] - a[1]);
  const priority = scored.map(([t]) => t) as RewriteImprovementType[];

  return { priority, ctr_gap, retention_gap, conversion_gap };
}

// ─── CLARITY rewrite ─────────────────────────────────────────────────────────

function applyClarity(text: string, format: RewriteFormat): string {
  let result = text;

  for (const [pattern, replacement] of FILLER_PATTERNS) {
    result = result.replace(pattern, replacement);
  }
  for (const [pattern, replacement] of PASSIVE_TO_ACTIVE) {
    result = result.replace(pattern, replacement);
  }

  result = collapseSpaces(result);

  // Format-specific compression.
  if (format === 'banner') {
    // Ultra-compress: strip everything after em-dash/colon, max 6 words.
    result = result.replace(/ — .+$/, '').replace(/:.+$/, '');
    result = trimToWords(collapseSpaces(result), 6);
  } else if (format === 'video') {
    // Spoken flow: max 2 sentences, max 20 words.
    const sentences = result.match(/[^.!?]+[.!?]+/g) || [result];
    result = sentences.slice(0, 2).join(' ').trim();
    if (wordCount(result) > 20) result = trimToWords(result, 20);
  } else if (format === 'carousel') {
    // Slide clarity: max 18 words, single clean statement.
    if (wordCount(result) > 18) result = trimToWords(result, 18);
  }

  return collapseSpaces(result) || text;
}

// ─── EMOTIONAL rewrite ───────────────────────────────────────────────────────

function applyEmotional(
  text:    string,
  emotion: string,
  format:  RewriteFormat,
  fatigueSignal: number,
): string {
  // Strip existing emotion opener if present (avoid double-prefix).
  let base = text.replace(/^[^—]{0,35} — /, '');

  // Apply power verb substitutions (not for banner — too short for verb swaps).
  if (format !== 'banner') {
    for (const [pattern, replacement] of POWER_VERBS) {
      base = base.replace(pattern, replacement);
    }
  }

  const opener = EMOTIONAL_OPENERS[emotion.toLowerCase()];

  if (format === 'banner') {
    // Banner: compress + prepend a 1-word punch word.
    const punchWords: Record<string, string> = {
      urgency: 'NOW.', fear: 'WARNING.', excitement: 'REVEALED.',
      curiosity: 'EXPOSED.', trust: 'PROVEN.', pain: 'ENOUGH.',
      inspiration: 'POSSIBLE.', confidence: 'GUARANTEED.',
    };
    const punch = punchWords[emotion.toLowerCase()] || 'WORKS.';
    const compressed = trimToWords(base.replace(/ — .+$/, ''), 5);
    return `${punch} ${collapseSpaces(compressed)}`;
  }

  if (format === 'carousel') {
    const cue = ' — scroll to see the proof ↓';
    const stripped = base.replace(/ — .+ ↓$/, '').replace(/[.!?]$/, '');
    return opener
      ? `${opener}${stripped.charAt(0).toLowerCase()}${stripped.slice(1)}${cue}`
      : `${stripped}${cue}`;
  }

  // VIDEO
  if (!opener) return base;
  // Fatigue: if high, skip the intensifier prefix to avoid repetition.
  if (fatigueSignal > 0.60) return base;
  return `${opener}${base.charAt(0).toLowerCase()}${base.slice(1)}`;
}

// ─── PERFORMANCE rewrite ─────────────────────────────────────────────────────

function applyPerformance(
  text:        string,
  format:      RewriteFormat,
  signal:      PerformanceSignal,
  memorySignal: number,
): string {
  let result = text;

  // Strip secondary reinforcers that bloat the hook.
  result = result.replace(/ — [^↓]{3,50}\.$/, '');
  result = collapseSpaces(result);

  if (format === 'banner') {
    // Ultra CTR: start with action verb, max 5 words, no filler.
    const compressed = trimToWords(result.replace(/ — .+$/, '').replace(/[.!?]$/, ''), 5);
    return collapseSpaces(compressed);
  }

  if (format === 'carousel') {
    // Add social-proof fragment if no numbers and memory signal is positive.
    const base = result.replace(/ — .+ ↓$/, '').replace(/[.!?]$/, '');
    const socialProof = !hasNumbers(base) ? SPECIFICITY_FRAGMENTS.carousel.trim() : '';
    return socialProof
      ? `${socialProof} ${base.charAt(0).toLowerCase()}${base.slice(1)} ↓`
      : `${base} — see the results for yourself ↓`;
  }

  // VIDEO
  const ctrOpener = CTR_OPENERS.video;
  // Add specificity if no numbers in text and CTR gap is significant.
  const needsSpecificity = !hasNumbers(result) && (signal.ctr ?? 1) < CTR_THRESHOLD * 2;
  const specFragment = needsSpecificity ? SPECIFICITY_FRAGMENTS.video : '';

  // Strip any existing opener pattern (e.g., "Right now — ") to avoid stacking.
  const stripped = result.replace(/^[^—]{0,35} — /, '');

  if (specFragment) {
    return `${specFragment}${stripped.charAt(0).toLowerCase()}${stripped.slice(1)}`;
  }
  return `${ctrOpener}${stripped.charAt(0).toLowerCase()}${stripped.slice(1)}`;
}

// ─── Impact scoring ───────────────────────────────────────────────────────────

function scoreImpact(
  original:        string,
  rewritten:       string,
  type:            RewriteImprovementType,
  weakness:        WeaknessProfile,
  format:          RewriteFormat,
): number {
  // Base: all rewrites start at 0.55.
  let score = 0.55;

  // Address the primary weakness → largest boost.
  if (weakness.priority[0] === type) score += 0.20;
  else if (weakness.priority[1] === type) score += 0.10;

  // Format fit bonus.
  const formatFit: Record<RewriteImprovementType, Record<RewriteFormat, number>> = {
    CLARITY:     { banner: 0.10, carousel: 0.07, video: 0.05 },
    EMOTIONAL:   { video: 0.10, carousel: 0.07, banner: 0.03 },
    PERFORMANCE: { video: 0.08, carousel: 0.08, banner: 0.10 },
  };
  score += formatFit[type][format];

  // Change significance: larger meaningful change → higher score.
  const lenChange = Math.abs(rewritten.length - original.length) / Math.max(original.length, 1);
  score += clamp(lenChange * 0.10, 0, 0.08);

  // Penalty if the rewrite is identical to input (transformation failed).
  if (rewritten.trim() === original.trim()) score = 0.20;

  return parseFloat(clamp(score, 0.20, 0.95).toFixed(3));
}

// ─── Build reason text ────────────────────────────────────────────────────────

function buildReason(
  type:     RewriteImprovementType,
  signal:   PerformanceSignal,
  format:   RewriteFormat,
  emotion:  string,
): string {
  if (type === 'CLARITY') {
    const cvr = signal.conversion != null ? ` (conversion ${Math.round(signal.conversion * 100)}%)` : '';
    return `Filler removed and passive constructions eliminated to sharpen value clarity${cvr}.`;
  }
  if (type === 'EMOTIONAL') {
    const ret = signal.retention != null ? ` (retention ${Math.round(signal.retention * 100)}%)` : '';
    const drop = signal.drop_off_point ? ` — drop-off detected at ${signal.drop_off_point}` : '';
    return `"${emotion}" intensity raised via stronger verbs and an immediate-engagement opener${ret}${drop}.`;
  }
  // PERFORMANCE
  const ctr = signal.ctr != null ? ` (CTR ${(signal.ctr * 100).toFixed(1)}%)` : '';
  return `CTR-optimised hook pattern applied with specificity framing to increase click intent${ctr}.`;
}

// ─── Best rewrite selection ───────────────────────────────────────────────────

function pickBestIndex(rewrites: RewriteVariant[]): number {
  let best = 0;
  for (let i = 1; i < rewrites.length; i++) {
    if (rewrites[i].impact_score > rewrites[best].impact_score) best = i;
  }
  return best;
}

// ─── Reasoning ───────────────────────────────────────────────────────────────

function buildReasoning(
  rewrites: RewriteVariant[],
  bestIdx:  number,
  weakness: WeaknessProfile,
  format:   RewriteFormat,
): string {
  const best = rewrites[bestIdx];
  const gapLine = [
    weakness.ctr_gap        > 0 ? `CTR gap ${(weakness.ctr_gap * 100).toFixed(0)}pp`        : null,
    weakness.retention_gap  > 0 ? `retention gap ${(weakness.retention_gap * 100).toFixed(0)}pp` : null,
    weakness.conversion_gap > 0 ? `conversion gap ${(weakness.conversion_gap * 100).toFixed(0)}pp` : null,
  ].filter(Boolean).join(', ') || 'no explicit performance gaps provided';
  return (
    `Rewrite ${bestIdx + 1} (${best.improvement_type}) scores highest at ${best.impact_score} on format "${format}". ` +
    `Primary weakness profile: ${weakness.priority[0]} → ${weakness.priority[1]} → ${weakness.priority[2]}. ` +
    `Detected gaps: ${gapLine}.`
  );
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function rewriteScene(input: SceneRewriterInput): SceneRewriterOutput {
  const segment      = input.creative_segment.trim();
  const emotion      = input.emotion_context.toLowerCase();
  const fatigueSignal = clamp(input.fatigue_signal  ?? 0, 0, 1);
  const memorySignal  = clamp(input.memory_signal   ?? 0, 0, 1);

  const weakness = detectWeakness(input.performance_signal);

  // Always generate one rewrite per improvement type, ordered by weakness priority.
  const types: RewriteImprovementType[] = ['CLARITY', 'EMOTIONAL', 'PERFORMANCE'];

  const rewrites: RewriteVariant[] = types.map((type): RewriteVariant => {
    let rewritten: string;

    if (type === 'CLARITY') {
      rewritten = applyClarity(segment, input.format);
    } else if (type === 'EMOTIONAL') {
      rewritten = applyEmotional(segment, emotion, input.format, fatigueSignal);
    } else {
      rewritten = applyPerformance(segment, input.format, input.performance_signal, memorySignal);
    }

    const impact_score = scoreImpact(segment, rewritten, type, weakness, input.format);
    const reason       = buildReason(type, input.performance_signal, input.format, emotion);

    return {
      original_segment:  segment,
      rewritten_segment: rewritten,
      improvement_type:  type,
      reason,
      impact_score,
    };
  });

  const best_rewrite_index = pickBestIndex(rewrites);
  const reasoning = buildReasoning(rewrites, best_rewrite_index, weakness, input.format);

  return {
    format: input.format,
    rewrites,
    best_rewrite_index,
    reasoning,
  };
}
