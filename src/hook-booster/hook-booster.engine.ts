// ─── 4.6 Hook Booster v1 — Engine (pure functions, no DI, no Prisma) ──────────

import {
  HookBoosterInput,
  HookBoosterOutput,
  HookFormat,
  HookScoreComponents,
  HookStrategy,
  HookVariant,
} from './hook-booster.types';
import {
  EMOTION_MODIFIERS,
  EMOTION_STRATEGY_ALIGNMENT,
  FORMAT_STRATEGY_FIT,
  FORMAT_WORD_TARGETS,
  HOOK_TEMPLATES,
  SECONDARY_REINFORCERS,
  STRATEGY_PRIORITY,
} from './hook-booster.templates';

// ─── Fallback angle used when slug not in template library ───────────────────
const FALLBACK_ANGLE = 'problem_solution';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function wordCount(s: string): number {
  return s.trim().split(/\s+/).length;
}

/** Resolve angle slug to a key guaranteed to exist in HOOK_TEMPLATES. */
function resolveAngle(slug: string): string {
  return HOOK_TEMPLATES[slug] ? slug : FALLBACK_ANGLE;
}

// ─── Step 1: Select 3 diverse strategies ─────────────────────────────────────
// Always uses the angle's top-3 priority strategies for maximum diversity.

function selectStrategies(angleSlug: string): HookStrategy[] {
  const priority = STRATEGY_PRIORITY[resolveAngle(angleSlug)];
  if (priority) return [...priority];
  // Fallback: deterministic spread across all 6
  const all: HookStrategy[] = [
    'DIRECT_IMPACT', 'CURIOSITY_GAP', 'SOCIAL_PROOF',
    'PROBLEM_SHOCK', 'TRANSFORMATION', 'AUTHORITY_TRIGGER',
  ];
  return all.slice(0, 3);
}

// ─── Step 2: Fill placeholders ───────────────────────────────────────────────

function fillPlaceholders(template: string, product: string, audience: string): string {
  return template
    .replace(/\{product\}/g, product)
    .replace(/\{audience\}/g, audience);
}

// ─── Step 3: Apply emotion modifier ──────────────────────────────────────────
// Prefix added only when the emotion key is recognised. No-op otherwise.

function applyEmotionModifier(hook: string, emotion: string): string {
  const modifier = EMOTION_MODIFIERS[emotion.toLowerCase()];
  if (!modifier) return hook;
  // Avoid double-prefixing when the hook naturally starts with the modifier tone.
  return `${modifier}${hook.charAt(0).toLowerCase()}${hook.slice(1)}`;
}

// ─── Step 4: Append secondary angle reinforcer ───────────────────────────────
// Secondary acts as trust / emotion layer ONLY — the primary angle drives copy.

function appendSecondaryReinforcer(
  hook: string,
  secondarySlug: string | null | undefined,
): string {
  if (!secondarySlug) return hook;
  const resolved = resolveAngle(secondarySlug);
  const reinforcer = SECONDARY_REINFORCERS[resolved];
  if (!reinforcer) return hook;
  // Attach as a parenthetical after the main hook.
  const stripped = hook.replace(/[.!?]$/, '');
  return `${stripped} — ${reinforcer}.`;
}

// ─── Step 5: Format adaptation ───────────────────────────────────────────────

function compressForBanner(hook: string): string {
  // Priority: split on em-dash, colon, or period to extract first fragment.
  const delimiters = [' — ', ': ', '. ', '? ', '! '];
  for (const delim of delimiters) {
    const idx = hook.indexOf(delim);
    if (idx > 0) {
      const fragment = hook.slice(0, idx).trim();
      const words = fragment.split(/\s+/);
      if (words.length >= 4 && words.length <= 10) return fragment;
      if (words.length > 10) return words.slice(0, 8).join(' ') + '…';
    }
  }
  // Fallback: first 7 words.
  const words = hook.split(/\s+/);
  if (words.length <= 10) return hook;
  return words.slice(0, 7).join(' ') + '…';
}

function adaptForFormat(hook: string, format: HookFormat): string {
  switch (format) {
    case 'video':
      return hook;
    case 'carousel':
      // Add swipe continuation cue at the end.
      return `${hook.replace(/[.!?]$/, '')} — swipe to see it all ↓`;
    case 'banner':
      return compressForBanner(hook);
    default:
      return hook;
  }
}

// ─── Step 6: Scoring ──────────────────────────────────────────────────────────

function scoreClarityForFormat(finalHook: string, format: HookFormat): number {
  const wc = wordCount(finalHook);
  const target = FORMAT_WORD_TARGETS[format];
  const [iMin, iMax] = target.ideal;
  const [gMin, gMax] = target.good;
  if (wc >= iMin && wc <= iMax) return 1.00;
  if (wc >= gMin && wc <= gMax) return 0.75;
  return 0.50;
}

function scoreEmotionalAlignment(strategy: HookStrategy, emotion: string): number {
  const matrix = EMOTION_STRATEGY_ALIGNMENT[strategy];
  const key = emotion.toLowerCase();
  return matrix[key] ?? 0.60; // Default when emotion is non-standard
}

function scoreAngleFit(strategy: HookStrategy, angleSlug: string): number {
  const priority = STRATEGY_PRIORITY[resolveAngle(angleSlug)];
  if (!priority) return 0.45;
  const idx = priority.indexOf(strategy);
  if (idx === 0) return 1.00;
  if (idx === 1) return 0.80;
  if (idx === 2) return 0.65;
  return 0.45;
}

function scoreFormatOptimization(strategy: HookStrategy, format: HookFormat): number {
  return FORMAT_STRATEGY_FIT[strategy]?.[format] ?? 0.70;
}

function computeStrengthScore(components: HookScoreComponents): number {
  return clamp(
    components.clarity              * 0.30 +
    components.emotional_alignment  * 0.25 +
    components.angle_fit            * 0.25 +
    components.format_optimization  * 0.20,
    0,
    1,
  );
}

// ─── Step 7: Build a single HookVariant ─────────────────────────────────────

function buildVariant(
  strategy:      HookStrategy,
  angleSlug:     string,
  secondarySlug: string | null | undefined,
  emotion:       string,
  format:        HookFormat,
  product:       string,
  audience:      string,
): HookVariant {
  const resolved = resolveAngle(angleSlug);
  const baseTemplate = HOOK_TEMPLATES[resolved][strategy];

  // Fill → emotion modifier → secondary reinforcer → format adaptation.
  const filled       = fillPlaceholders(baseTemplate, product, audience);
  const withEmotion  = applyEmotionModifier(filled, emotion);
  const withSecondary = appendSecondaryReinforcer(withEmotion, secondarySlug);
  const finalHook    = adaptForFormat(withSecondary, format);

  // Scoring
  const components: HookScoreComponents = {
    clarity:             scoreClarityForFormat(finalHook, format),
    emotional_alignment: scoreEmotionalAlignment(strategy, emotion),
    angle_fit:           scoreAngleFit(strategy, angleSlug),
    format_optimization: scoreFormatOptimization(strategy, format),
  };
  const strength_score = parseFloat(computeStrengthScore(components).toFixed(3));

  return {
    hook: finalHook,
    strategy,
    angle_usage: {
      primary:   angleSlug,
      secondary: secondarySlug ?? null,
    },
    emotion,
    strength_score,
  };
}

// ─── Step 8: Best hook selection ─────────────────────────────────────────────

function pickBestIndex(variants: HookVariant[]): number {
  let best = 0;
  for (let i = 1; i < variants.length; i++) {
    if (variants[i].strength_score > variants[best].strength_score) best = i;
  }
  return best;
}

// ─── Step 9: Reasoning ───────────────────────────────────────────────────────

function buildReasoning(
  variants:       HookVariant[],
  bestIdx:        number,
  format:         HookFormat,
  primaryAngle:   string,
  secondaryAngle: string | null | undefined,
): string {
  const best = variants[bestIdx];
  const strategyLine = `Hook ${bestIdx + 1} (${best.strategy}) scores highest at ${best.strength_score}.`;
  const formatLine   = `Format "${format}" rewards ${best.strategy} with strong format-strategy fit.`;
  const angleLine    = `Primary angle "${primaryAngle}"${secondaryAngle ? ` reinforced by "${secondaryAngle}"` : ''} aligns naturally with this strategy.`;
  const diversityLine = `All 3 hooks use distinct strategies: ${variants.map(v => v.strategy).join(', ')}.`;
  return `${strategyLine} ${formatLine} ${angleLine} ${diversityLine}`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function generateHooks(input: HookBoosterInput): HookBoosterOutput {
  const product  = input.product_context?.trim()  || 'this';
  const audience = input.audience_context?.trim() || 'people';

  const strategies = selectStrategies(input.primary_angle);

  const variants: HookVariant[] = strategies.map(strategy =>
    buildVariant(
      strategy,
      input.primary_angle,
      input.secondary_angle,
      input.emotion,
      input.format,
      product,
      audience,
    ),
  );

  const best_hook_index = pickBestIndex(variants);
  const reasoning = buildReasoning(
    variants,
    best_hook_index,
    input.format,
    input.primary_angle,
    input.secondary_angle,
  );

  return {
    format: input.format,
    hooks: variants,
    best_hook_index,
    reasoning,
  };
}
