// ─── 4.7 Hook Booster v2 — Engine (pure functions, no DI, no Prisma) ──────────
// Upgrades v1 hooks using: memory signal, fatigue signal, exploration pressure.
// EXPLOIT → proven patterns; EXPLORE → unused strategies; HYBRID → blend.

import {
  HookFormat,
  HookStrategy,
  HookV2Input,
  HookV2Output,
  HookV2ScoreComponents,
  HookV2Strategy,
  HookV2Variant,
} from './hook-booster.types';
import {
  EMOTION_STRATEGY_ALIGNMENT,
  FORMAT_STRATEGY_FIT,
  FORMAT_WORD_TARGETS,
  HOOK_TEMPLATES,
  SECONDARY_REINFORCERS,
  STRATEGY_PRIORITY,
} from './hook-booster.templates';

// ─── Constants ────────────────────────────────────────────────────────────────

const FALLBACK_ANGLE = 'problem_solution';

const ALL_STRATEGIES: HookStrategy[] = [
  'DIRECT_IMPACT', 'CURIOSITY_GAP', 'SOCIAL_PROOF',
  'PROBLEM_SHOCK', 'TRANSFORMATION', 'AUTHORITY_TRIGGER',
];

// Stronger emotion intensifiers for v2 video EXPLOIT hooks.
const V2_VIDEO_INTENSIFIERS: Record<string, string> = {
  urgency:     'Stop scrolling — ',
  fear:        'This is your warning — ',
  excitement:  'Everything just changed — ',
  curiosity:   'Here is what nobody tells you — ',
  trust:       'Full transparency — ',
  pain:        'This needs to be said — ',
  inspiration: 'The moment starts here — ',
  confidence:  'Let me be direct — ',
};

// Upgraded carousel swipe cues for EXPLOIT hooks.
const V2_CAROUSEL_CUES = [
  ' — slide 3 will change how you think about this ↓',
  ' — the real answer is two slides ahead ↓',
  ' — what comes next is the part nobody talks about ↓',
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function wordCount(s: string): number {
  return s.trim().split(/\s+/).length;
}

function resolveAngle(slug: string): string {
  return HOOK_TEMPLATES[slug] ? slug : FALLBACK_ANGLE;
}

function fillPlaceholders(template: string, product: string, audience: string): string {
  return template
    .replace(/\{product\}/g, product)
    .replace(/\{audience\}/g, audience);
}

function applyEmotionModifier(hook: string, emotion: string, modifiers: Record<string, string>): string {
  const modifier = modifiers[emotion.toLowerCase()];
  if (!modifier) return hook;
  return `${modifier}${hook.charAt(0).toLowerCase()}${hook.slice(1)}`;
}

function appendSecondaryReinforcer(hook: string, secondarySlug: string | null | undefined): string {
  if (!secondarySlug) return hook;
  const reinforcer = SECONDARY_REINFORCERS[resolveAngle(secondarySlug)];
  if (!reinforcer) return hook;
  const stripped = hook.replace(/[.!?]$/, '');
  return `${stripped} — ${reinforcer}.`;
}

// ─── Distribution logic ───────────────────────────────────────────────────────
// exploration_pressure_delta range: −0.10 to +0.25.
// Normalise to 0–1 for threshold comparisons.

type HookSlot = { v2Strategy: HookV2Strategy; v1Ref: number };

function normaliseExploration(delta: number): number {
  // Map −0.10…+0.25 → 0…1
  return clamp((delta + 0.10) / 0.35, 0, 1);
}

function buildSlots(v1BestIndex: number, hookCount: number, normExploration: number): HookSlot[] {
  // Rank v1 hooks: best first, then by original index order for ties.
  const indices = Array.from({ length: hookCount }, (_, i) => i);
  const [first, second, third] = [
    v1BestIndex,
    indices.find(i => i !== v1BestIndex) ?? 0,
    indices.find(i => i !== v1BestIndex && i !== indices.find(j => j !== v1BestIndex)) ?? 0,
  ];

  if (normExploration < 0.35) {
    // Low → 2 EXPLOIT, 1 EXPLORE
    return [
      { v2Strategy: 'EXPLOIT', v1Ref: first },
      { v2Strategy: 'EXPLOIT', v1Ref: second },
      { v2Strategy: 'EXPLORE', v1Ref: third },
    ];
  }
  if (normExploration <= 0.65) {
    // Medium → 1 EXPLOIT, 1 HYBRID, 1 EXPLORE
    return [
      { v2Strategy: 'EXPLOIT', v1Ref: first },
      { v2Strategy: 'HYBRID',  v1Ref: second },
      { v2Strategy: 'EXPLORE', v1Ref: third },
    ];
  }
  // High → 1 EXPLOIT, 2 EXPLORE
  return [
    { v2Strategy: 'EXPLOIT', v1Ref: first },
    { v2Strategy: 'EXPLORE', v1Ref: second },
    { v2Strategy: 'EXPLORE', v1Ref: third },
  ];
}

// ─── Unused strategy selection (for EXPLORE) ──────────────────────────────────

function unusedStrategies(usedStrategies: HookStrategy[]): HookStrategy[] {
  const used = new Set(usedStrategies);
  // Return unused, preferring angle priority order (fall through to full list).
  return ALL_STRATEGIES.filter(s => !used.has(s));
}

// ─── Hook text generation ─────────────────────────────────────────────────────

function generateExploitHook(
  v1Hook: string,
  format: HookFormat,
  emotion: string,
  fatigueAdjusted: boolean,
): string {
  // Strip any existing v1 emotion prefix (pattern: short phrase ending in ' — ').
  const stripped = v1Hook.replace(/^[^—]{0,30} — /, '');

  if (format === 'video') {
    const intensifier = V2_VIDEO_INTENSIFIERS[emotion.toLowerCase()];
    if (!intensifier) return v1Hook;
    // If fatigue is high we skip the intensifier and keep the original phrasing.
    if (fatigueAdjusted) return v1Hook;
    return `${intensifier}${stripped.charAt(0).toLowerCase()}${stripped.slice(1)}`;
  }

  if (format === 'carousel') {
    // Replace v1 swipe cue with stronger v2 alternative.
    const base = v1Hook
      .replace(/ — swipe to see it all ↓$/, '')
      .replace(/ — .+ ↓$/, '')
      .replace(/[.!?]$/, '');
    const cue = V2_CAROUSEL_CUES[emotion.length % V2_CAROUSEL_CUES.length];
    return `${base}${cue}`;
  }

  if (format === 'banner') {
    // Ultra-compress: 3–5 most impactful words (strip modifiers/reinforcers first).
    const clean = v1Hook
      .replace(/ — .+$/, '')
      .replace(/^[^—]{0,30} — /, '');
    const words = clean.trim().split(/\s+/);
    return words.slice(0, 5).join(' ');
  }

  return v1Hook;
}

function generateExploreHook(
  unusedStrategy: HookStrategy,
  angleSlug: string,
  secondarySlug: string | null | undefined,
  emotion: string,
  format: HookFormat,
  product: string,
  audience: string,
): string {
  const resolved = resolveAngle(angleSlug);
  const template = HOOK_TEMPLATES[resolved][unusedStrategy];
  if (!template) return '';

  const filled = fillPlaceholders(template, product, audience);
  const withSecondary = appendSecondaryReinforcer(filled, secondarySlug);

  // EXPLORE hooks use lighter format adaptation to preserve novelty.
  if (format === 'banner') {
    const words = withSecondary.replace(/ — .+$/, '').split(/\s+/);
    return words.slice(0, 6).join(' ');
  }
  if (format === 'carousel') {
    const base = withSecondary.replace(/[.!?]$/, '');
    return `${base} ↓`;
  }
  return withSecondary;
}

function generateHybridHook(
  v1Hook: string,
  secondarySlug: string | null | undefined,
  emotion: string,
  format: HookFormat,
): string {
  // Strip any existing secondary reinforcer then re-embed more aggressively.
  const stripped = v1Hook.replace(/ — [^↓]+\.$/, '').replace(/ — .+ ↓$/, '');

  if (secondarySlug) {
    const resolved = resolveAngle(secondarySlug);
    const reinforcer = SECONDARY_REINFORCERS[resolved];
    if (reinforcer) {
      const base = stripped.replace(/[.!?]$/, '');
      const intensifier = V2_VIDEO_INTENSIFIERS[emotion.toLowerCase()] ?? '';
      if (format === 'video' && intensifier) {
        // Embed secondary into the body rather than appending.
        const bodyClean = base.replace(/^[^—]{0,30} — /, '');
        return `${intensifier}${bodyClean.charAt(0).toLowerCase()}${bodyClean.slice(1)} — ${reinforcer}.`;
      }
      if (format === 'carousel') {
        return `${base} — ${reinforcer} ↓`;
      }
      if (format === 'banner') {
        return base.split(/\s+/).slice(0, 5).join(' ');
      }
      return `${base} — ${reinforcer}.`;
    }
  }

  // No secondary → return stripped v1 with light touch.
  return stripped;
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

function scoreMemoryAlignment(memorySignal: number, v2Strategy: HookV2Strategy): number {
  // EXPLOIT hooks benefit most from positive memory signal.
  if (v2Strategy === 'EXPLOIT') return clamp(0.50 + memorySignal * 0.50, 0, 1);
  if (v2Strategy === 'HYBRID')  return clamp(0.40 + memorySignal * 0.40, 0, 1);
  // EXPLORE: memory_signal suppressed — novelty is the goal.
  return clamp(0.30 + memorySignal * 0.20, 0, 1);
}

function scoreEmotionalIntensity(v1Hook: string, v2Hook: string, emotion: string): number {
  // Measure if v2 hook intensified the emotion vs v1.
  const intensifier = V2_VIDEO_INTENSIFIERS[emotion.toLowerCase()];
  const hasIntensifier = intensifier
    ? v2Hook.startsWith(intensifier.trim())
    : false;
  const longerCue = v2Hook.includes('↓') && v2Hook.length > v1Hook.length;
  if (hasIntensifier || longerCue) return 0.90;
  if (v2Hook !== v1Hook) return 0.75;
  return 0.60;
}

function scoreAngleFit(strategy: HookStrategy | null, angleSlug: string): number {
  if (!strategy) return 0.60;
  const priority = STRATEGY_PRIORITY[resolveAngle(angleSlug)];
  if (!priority) return 0.45;
  const idx = priority.indexOf(strategy);
  if (idx === 0) return 1.00;
  if (idx === 1) return 0.80;
  if (idx === 2) return 0.65;
  return 0.50;
}

function scoreClarity(hook: string, format: HookFormat): number {
  const wc = wordCount(hook);
  const target = FORMAT_WORD_TARGETS[format];
  const [iMin, iMax] = target.ideal;
  const [gMin, gMax] = target.good;
  if (wc >= iMin && wc <= iMax) return 1.00;
  if (wc >= gMin && wc <= gMax) return 0.75;
  return 0.50;
}

function scoreFormatOpt(strategy: HookStrategy | null, format: HookFormat): number {
  if (!strategy) return 0.70;
  return FORMAT_STRATEGY_FIT[strategy]?.[format] ?? 0.70;
}

function scoreExplorationNovelty(v2Strategy: HookV2Strategy, normExploration: number): number {
  // EXPLORE hooks earn novelty score; EXPLOIT hooks earn stability credit.
  if (v2Strategy === 'EXPLORE') return clamp(0.60 + normExploration * 0.40, 0, 1);
  if (v2Strategy === 'HYBRID')  return clamp(0.40 + normExploration * 0.30, 0, 1);
  return clamp(0.80 - normExploration * 0.40, 0.30, 0.80); // EXPLOIT: stable but not max
}

function computeV2Score(c: HookV2ScoreComponents): number {
  return clamp(
    c.memory_alignment    * 0.25 +
    c.emotional_intensity * 0.20 +
    c.angle_fit           * 0.20 +
    c.clarity             * 0.15 +
    c.format_optimization * 0.10 +
    c.exploration_novelty * 0.10,
    0, 1,
  );
}

// ─── Best hook selection ──────────────────────────────────────────────────────

function pickBestIndex(variants: HookV2Variant[]): number {
  let best = 0;
  for (let i = 1; i < variants.length; i++) {
    if (variants[i].strength_score > variants[best].strength_score) best = i;
  }
  return best;
}

// ─── Reasoning ───────────────────────────────────────────────────────────────

function buildReasoning(
  variants:    HookV2Variant[],
  bestIdx:     number,
  format:      HookFormat,
  primaryAngle: string,
  memSignal:   number,
  normExplore: number,
): string {
  const best = variants[bestIdx];
  const dist = variants.map(v => v.strategy).join(' / ');
  const memLine = `Memory signal ${memSignal.toFixed(2)} applied — ${best.strategy} benefits most.`;
  const exploreLine = `Exploration pressure ${normExplore.toFixed(2)} → distribution: ${dist}.`;
  const scoreLine = `Hook ${bestIdx + 1} scores highest at ${best.strength_score.toFixed(3)} on format "${format}" × angle "${primaryAngle}".`;
  return `${scoreLine} ${memLine} ${exploreLine}`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function generateV2Hooks(input: HookV2Input): HookV2Output {
  const product  = input.product_context?.trim()  || 'this';
  const audience = input.audience_context?.trim() || 'people';

  const normExploration = normaliseExploration(input.exploration_pressure_delta);
  const memorySignal    = clamp(input.memory_signal,  0, 1);
  const fatigueSignal   = clamp(input.fatigue_signal, 0, 1);
  const fatigueHigh     = fatigueSignal > 0.60;

  const v1Hooks  = input.hook_v1_outputs.hooks;
  const v1Best   = input.hook_v1_outputs.best_hook_index;
  const usedStrats: HookStrategy[] = v1Hooks.map(h => h.strategy);

  const slots = buildSlots(v1Best, v1Hooks.length, normExploration);
  const unused = unusedStrategies(usedStrats);

  const variants: HookV2Variant[] = slots.map((slot, slotIdx) => {
    const v1Ref  = v1Hooks[slot.v1Ref];
    const v1Hook = v1Ref?.hook ?? '';

    let hookText: string;
    let internalStrategy: HookStrategy | null = v1Ref?.strategy ?? null;
    let fatigueAdjusted = false;

    if (slot.v2Strategy === 'EXPLOIT') {
      // Fatigue: if high and this is the 2nd EXPLOIT slot, skip intensifier.
      fatigueAdjusted = fatigueHigh && slotIdx > 0;
      hookText = generateExploitHook(v1Hook, input.format, input.emotion, fatigueAdjusted);
    } else if (slot.v2Strategy === 'EXPLORE') {
      // Use a distinct unused strategy per explore slot.
      const exploreIdx = slots
        .slice(0, slotIdx)
        .filter(s => s.v2Strategy === 'EXPLORE').length;
      const exploreStrat = unused[exploreIdx % Math.max(unused.length, 1)] ?? unused[0];
      internalStrategy = exploreStrat ?? null;
      hookText = generateExploreHook(
        exploreStrat,
        input.primary_angle,
        input.secondary_angle,
        input.emotion,
        input.format,
        product,
        audience,
      );
      // Fatigue: if high, ensure explore hook doesn't mirror v1 structure.
      fatigueAdjusted = fatigueHigh;
    } else {
      // HYBRID
      fatigueAdjusted = fatigueHigh;
      hookText = generateHybridHook(v1Hook, input.secondary_angle, input.emotion, input.format);
    }

    // Exploration weight per hook type.
    const explorationWeight =
      slot.v2Strategy === 'EXPLOIT' ? clamp(0.10 + normExploration * 0.10, 0.10, 0.20)
      : slot.v2Strategy === 'HYBRID' ? clamp(0.30 + normExploration * 0.20, 0.30, 0.50)
      : clamp(0.60 + normExploration * 0.30, 0.60, 0.90);

    const components: HookV2ScoreComponents = {
      memory_alignment:    scoreMemoryAlignment(memorySignal, slot.v2Strategy),
      emotional_intensity: scoreEmotionalIntensity(v1Hook, hookText, input.emotion),
      angle_fit:           scoreAngleFit(internalStrategy, input.primary_angle),
      clarity:             scoreClarity(hookText, input.format),
      format_optimization: scoreFormatOpt(internalStrategy, input.format),
      exploration_novelty: scoreExplorationNovelty(slot.v2Strategy, normExploration),
    };

    const strength_score = parseFloat(computeV2Score(components).toFixed(3));

    return {
      hook:               hookText,
      strategy:           slot.v2Strategy,
      improved_from:      String(slot.v1Ref),
      angle_usage: {
        primary:   input.primary_angle,
        secondary: input.secondary_angle ?? null,
      },
      emotion:            input.emotion,
      memory_bias_applied: memorySignal > 0,
      fatigue_adjusted:   fatigueAdjusted,
      exploration_weight: parseFloat(explorationWeight.toFixed(3)),
      strength_score,
    };
  });

  const best_hook_index = pickBestIndex(variants);
  const reasoning = buildReasoning(
    variants,
    best_hook_index,
    input.format,
    input.primary_angle,
    memorySignal,
    normExploration,
  );

  return {
    format: input.format,
    hooks:  variants,
    best_hook_index,
    reasoning,
  };
}
