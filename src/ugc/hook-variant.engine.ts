/**
 * hook-variant.engine.ts
 *
 * Hook Variant Engine — A/B/C testing core (Phase 1.1)
 *
 * For each persona in the split, generates exactly 3 hook variants (A, B, C)
 * using distinct strategies so each variant attacks the audience from a
 * different psychological angle.
 *
 * Strategy assignment per variant slot:
 *   A → primary hook strategy (highest predicted strength for this persona)
 *   B → secondary strategy (emotional contrast)
 *   C → wildcard / pattern interrupt
 *
 * Pure functions — no DI required. Injectable wrapper is HookVariantService.
 */

import type { UGCPersona, HookStrategy } from './types/ugc.types';
import type { HookVariant, PersonaHookSet, HookVariantId } from './types/viral-test.types';

// ─── Persona → strategy mapping ───────────────────────────────────────────────
// Each persona gets 3 ordered strategies: [primary, secondary, wildcard]

const PERSONA_STRATEGY_SLOTS: Record<string, [HookStrategy, HookStrategy, HookStrategy]> = {
  skeptical_user: ['social_proof',   'before_after',   'shock'],
  excited_user:   ['shock',          'curiosity',      'before_after'],
  founder_voice:  ['relatable_pain', 'authority',      'controversy'],
  reviewer:       ['authority',      'social_proof',   'tutorial'],
  before_after:   ['before_after',   'relatable_pain', 'shock'],
  tutorial:       ['tutorial',       'curiosity',      'authority'],
  testimonial:    ['social_proof',   'before_after',   'relatable_pain'],
  authority:      ['authority',      'tutorial',       'social_proof'],
};

const DEFAULT_STRATEGIES: [HookStrategy, HookStrategy, HookStrategy] =
  ['curiosity', 'relatable_pain', 'social_proof'];

// ─── Strategy hook templates ──────────────────────────────────────────────────
// Each strategy has 3 templates; slot index (0|1|2) picks which one to use
// so A/B/C get distinct phrasing even within the same strategy.

const STRATEGY_TEMPLATES: Record<HookStrategy, [string, string, string]> = {
  shock: [
    'Nobody told me {{product}} could do this…',
    'This changed everything about how I deal with {{pain_point}}',
    'I genuinely did not expect this result',
  ],
  curiosity: [
    'The one thing about {{product}} no one talks about',
    'What happens when you actually use {{product}} for 30 days?',
    'Here\'s what I found out about fixing {{pain_point}}',
  ],
  relatable_pain: [
    'If {{pain_point}} is ruining your day, you need to see this',
    'I\'ve been dealing with {{pain_point}} for way too long',
    'Honestly tired of {{pain_point}} being an issue — until this',
  ],
  authority: [
    'After testing {{product}} against everything else — here\'s the truth',
    'The data on {{product}} is actually surprising',
    'Let me show you exactly what works for {{pain_point}}',
  ],
  social_proof: [
    'Why {{audience}} keeps coming back to {{product}}',
    'This is the {{product}} everyone is quietly switching to',
    'Real results from real people solving {{pain_point}}',
  ],
  before_after: [
    'Before {{product}}: {{pain_point}} every single day. After:',
    'I documented the whole process — before vs. after is wild',
    '30 days of {{product}} vs. 30 days of {{pain_point}}. Guess who won.',
  ],
  controversy: [
    'The {{product}} industry doesn\'t want you to know this',
    'Unpopular opinion: {{pain_point}} is 100% fixable',
    'Hot take: you\'ve been solving {{pain_point}} the wrong way',
  ],
  tutorial: [
    'How to actually fix {{pain_point}} in under 60 seconds',
    'The 3-step process that finally solved {{pain_point}} for me',
    'Stop guessing — here\'s exactly how {{product}} works',
  ],
};

// ─── Hook strength by strategy + slot ────────────────────────────────────────
// Primary slot (A) always slightly stronger; C is the wildcard (lower floor).

const SLOT_STRENGTH_MODIFIER: Record<HookVariantId, number> = {
  A: 0.03,
  B: 0.00,
  C: -0.04,
};

const BASE_STRATEGY_STRENGTH: Record<HookStrategy, number> = {
  shock:          0.82,
  curiosity:      0.74,
  relatable_pain: 0.78,
  authority:      0.70,
  social_proof:   0.72,
  before_after:   0.80,
  controversy:    0.76,
  tutorial:       0.68,
};

// ─── Text interpolation ───────────────────────────────────────────────────────

function interpolate(
  template:  string,
  ctx:       { product: string; painPoint: string; audience: string },
): string {
  return template
    .replace(/\{\{product(?:_type)?\}\}/g, ctx.product)
    .replace(/\{\{pain_point\}\}/g,        ctx.painPoint)
    .replace(/\{\{audience\}\}/g,          ctx.audience)
    .trim();
}

// ─── Public engine function ───────────────────────────────────────────────────

export interface HookVariantEngineInput {
  persona:    UGCPersona;
  product:    string;
  painPoint:  string;
  audience:   string;
}

/**
 * Generate exactly 3 hook variants (A, B, C) for a persona.
 *
 * Each variant uses a distinct strategy + distinct template index so all three
 * are psychologically different — not just paraphrases of each other.
 */
export function generatePersonaHooks(input: HookVariantEngineInput): PersonaHookSet {
  const { persona, product, painPoint, audience } = input;
  const slots = PERSONA_STRATEGY_SLOTS[persona.id] ?? DEFAULT_STRATEGIES;
  const ids: HookVariantId[] = ['A', 'B', 'C'];

  const hooks: HookVariant[] = ids.map((id, i) => {
    const strategy  = slots[i];
    const templates = STRATEGY_TEMPLATES[strategy];
    // Each slot index picks a different template from the strategy's 3 variants
    const template  = templates[i % 3];
    const text      = interpolate(template, { product, painPoint, audience });
    const strength  = Math.min(1, Math.max(0,
      BASE_STRATEGY_STRENGTH[strategy] + SLOT_STRENGTH_MODIFIER[id],
    ));

    return { id, text, strategy, strength };
  });

  return { personaId: persona.id, hooks };
}
