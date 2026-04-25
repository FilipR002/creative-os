/**
 * expanded-variant.service.ts
 *
 * Expanded UGC Variant Generator — Phase 1.1
 *
 * Combines persona weights + A/B/C hooks into the full variant matrix:
 *   N personas × 3 hooks = up to 12 variants (capped at 10 per spec)
 *
 * Each ExpandedUGCVariant has:
 *   - variantId:   "{personaId}-{hookId}"  e.g. "skeptical_user-A"
 *   - Distinct emotional arc per persona × hook slot
 *   - Pacing derived from persona energy
 *   - ugcScoreEstimate: weighted composite of hook strength × persona probability
 *   - Full script body (same arc structure as VariantService, but hook-injected)
 */

import { Injectable, Logger } from '@nestjs/common';

import { PersonaService }       from './persona.service';
import { generatePersonaHooks } from './hook-variant.engine';
import type { PersonaSplitOutput }  from './types/viral-test.types';
import type { ExpandedUGCVariant }  from './types/viral-test.types';
import type { UGCPersonaId, UGCTone, UGCPacing, HookStrategy } from './types/ugc.types';

// ─── Emotional arc variants by hook slot ──────────────────────────────────────
// A = primary arc, B = contrast arc, C = wildcard arc

const SLOT_EMOTION_ARCS: Record<string, [string, string, string]> = {
  skeptical_user: [
    'doubt → evidence → surprise → trust',
    'curiosity → skepticism → validation → conviction',
    'resistance → honesty → openness → action',
  ],
  excited_user: [
    'excitement → desire → urgency → action',
    'anticipation → reveal → elation → share',
    'energy → focus → impact → momentum',
  ],
  founder_voice: [
    'vulnerability → mission → proof → invitation',
    'struggle → insight → breakthrough → conviction',
    'passion → transparency → credibility → call',
  ],
  reviewer: [
    'curiosity → analysis → verdict → recommendation',
    'expectation → test → surprise → endorsement',
    'skepticism → evaluation → clarity → trust',
  ],
  before_after: [
    'pain → journey → transformation → revelation',
    'before-state → turning-point → after-state → inspire',
    'frustration → decision → change → wow-moment',
  ],
  tutorial: [
    'confusion → guidance → clarity → empowerment',
    'problem → method → result → simplicity',
    'overwhelm → steps → progress → confidence',
  ],
  testimonial: [
    'relatability → experience → proof → warmth',
    'struggle → discovery → results → gratitude',
    'doubt-shared → journey → outcome → recommend',
  ],
  authority: [
    'credibility → data → insight → trust',
    'expertise → evidence → clarity → authority',
    'knowledge → comparison → truth → guidance',
  ],
};

const DEFAULT_ARC = 'problem → solution → outcome → action';

// ─── Pacing from persona energy ───────────────────────────────────────────────

const ENERGY_TO_PACING: Record<'low' | 'medium' | 'high', UGCPacing> = {
  low:    'slow',
  medium: 'medium',
  high:   'fast',
};

// ─── Tone from hook strategy ──────────────────────────────────────────────────

const STRATEGY_TO_TONE: Record<HookStrategy, UGCTone> = {
  shock:          'energetic',
  curiosity:      'educational',
  relatable_pain: 'authentic',
  authority:      'authoritative',
  social_proof:   'authentic',
  before_after:   'emotional',
  controversy:    'energetic',
  tutorial:       'educational',
};

// ─── Script builder ───────────────────────────────────────────────────────────

function buildExpandedScript(opts: {
  hook:      string;
  arc:       string;
  persona:   string;
  product:   string;
  painPoint: string;
  audience:  string;
  goal:      string;
  pacing:    UGCPacing;
  strategy:  HookStrategy;
}): string {
  const { hook, arc, persona, product, painPoint, audience, goal, pacing, strategy } = opts;
  const pacingNote = pacing === 'fast'
    ? '[punchy, fast cuts]'
    : pacing === 'slow'
      ? '[measured delivery]'
      : '[steady flow]';

  return [
    `[HOOK] ${hook}`,
    `[PERSONA: ${persona}] [ARC: ${arc}] ${pacingNote}`,
    `[PROBLEM] ${audience} struggle with ${painPoint} more than people admit.`,
    `[STRATEGY: ${strategy}] ${arc.split('→')[1]?.trim() ?? 'Build tension around the problem.'}`,
    `[SOLUTION] ${product} was built specifically for this. Not a workaround — a real fix.`,
    `[BENEFIT] ${goal} — that's the actual outcome people get.`,
    `[CTA] Don't wait on this one.`,
  ].join('\n');
}

// ─── Score estimator ──────────────────────────────────────────────────────────

function estimateUGCScore(
  hookStrength:        number,
  personaProbability:  number,
  slotIndex:           number,   // 0=A, 1=B, 2=C
): number {
  // Primary slot gets a slight boost for being highest-strength
  const slotBonus = slotIndex === 0 ? 0.04 : slotIndex === 2 ? -0.02 : 0;
  // Weight by persona dominance — dominant persona variants score higher
  const personaBonus = personaProbability * 0.10;
  return Math.min(1, Math.max(0, hookStrength + slotBonus + personaBonus));
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class ExpandedVariantService {
  private readonly logger = new Logger(ExpandedVariantService.name);

  constructor(private readonly personaService: PersonaService) {}

  /**
   * Generate the full persona × hook variant matrix.
   *
   * @param split    — PersonaSplitOutput with weighted personas
   * @param context  — campaign context for script + hook interpolation
   * @param maxTotal — hard cap on total variants (default 10)
   */
  generate(
    split:    PersonaSplitOutput,
    context:  {
      product:    string;
      audience:   string;
      painPoint:  string;
      platform:   string;
      goal:       string;
    },
    maxTotal: number = 10,
  ): ExpandedUGCVariant[] {
    const variants: ExpandedUGCVariant[] = [];

    for (const weight of split.weights) {
      if (variants.length >= maxTotal) break;

      const persona = this.personaService.get(weight.personaId);
      if (!persona) continue;

      const hookSet = generatePersonaHooks({
        persona,
        product:   context.product,
        painPoint: context.painPoint,
        audience:  context.audience,
      });

      const arcs = SLOT_EMOTION_ARCS[persona.id] ?? [DEFAULT_ARC, DEFAULT_ARC, DEFAULT_ARC];
      const pacing = ENERGY_TO_PACING[persona.energy];

      hookSet.hooks.forEach((hook, slotIdx) => {
        if (variants.length >= maxTotal) return;

        const arc   = arcs[slotIdx] ?? DEFAULT_ARC;
        const tone  = STRATEGY_TO_TONE[hook.strategy] ?? 'authentic';
        const score = estimateUGCScore(hook.strength, weight.probability, slotIdx);

        const script = buildExpandedScript({
          hook:      hook.text,
          arc,
          persona:   persona.name,
          product:   context.product,
          painPoint: context.painPoint,
          audience:  context.audience,
          goal:      context.goal,
          pacing,
          strategy:  hook.strategy,
        });

        variants.push({
          variantId:          `${persona.id}-${hook.id}`,
          personaId:          persona.id as UGCPersonaId,
          hookVariantId:      hook.id,
          hook:               hook.text,
          hookStrategy:       hook.strategy,
          emotionArc:         arc,
          tone,
          pacing,
          script,
          ugcScoreEstimate:   score,
          personaProbability: weight.probability,
        });
      });
    }

    // Sort by estimated score desc — highest-value variants are rendered first
    const sorted = variants.sort((a, b) => b.ugcScoreEstimate - a.ugcScoreEstimate);

    this.logger.log(
      `[ExpandedVariant] Generated ${sorted.length} variants from ${split.weights.length} personas | ` +
      `top="${sorted[0]?.variantId}" est=${sorted[0]?.ugcScoreEstimate.toFixed(2)}`,
    );

    return sorted;
  }
}
