/**
 * variant.service.ts
 *
 * UGC Variant Generator — second stage of the UGC Engine.
 *
 * Converts UGCBrainOutput + campaign context into N concrete UGCVariants,
 * each with a distinct persona, hook, emotion, tone, pacing, script,
 * and a conversion strength estimate.
 *
 * Rules:
 *   - One variant per persona (up to variantCount)
 *   - Hook is derived from persona hookTemplates + active hookStrategy
 *   - Script follows the emotional arc from the Brain output
 *   - conversionStrength = normalized score from hook strategy + persona energy
 */

import { Injectable, Logger } from '@nestjs/common';
import { randomUUID }         from 'crypto';

import type {
  UGCBrainInput,
  UGCBrainOutput,
  UGCVariant,
  UGCTone,
  UGCPacing,
  HookStrategy,
  UGCPersona,
} from './types/ugc.types';

// ─── Hook strategy → tone affinity ───────────────────────────────────────────

const STRATEGY_TONE: Record<HookStrategy, UGCTone> = {
  shock:         'energetic',
  curiosity:     'educational',
  relatable_pain:'authentic',
  authority:     'authoritative',
  social_proof:  'authentic',
  before_after:  'emotional',
  controversy:   'energetic',
  tutorial:      'educational',
};

const STRATEGY_STRENGTH: Record<HookStrategy, number> = {
  shock:          0.82,
  curiosity:      0.74,
  relatable_pain: 0.78,
  authority:      0.70,
  social_proof:   0.72,
  before_after:   0.80,
  controversy:    0.76,
  tutorial:       0.68,
};

const ENERGY_PACING: Record<'low' | 'medium' | 'high', UGCPacing> = {
  low:    'slow',
  medium: 'medium',
  high:   'fast',
};

// ─── Hook template interpolation ─────────────────────────────────────────────

function interpolateHook(
  template:  string,
  context:   { product: string; painPoint: string; angle: string; audience: string },
): string {
  return template
    .replace(/\{\{product(?:_type)?\}\}/g, context.product)
    .replace(/\{\{pain_point\}\}/g,        context.painPoint)
    .replace(/\{\{angle\}\}/g,             context.angle)
    .replace(/\{\{audience\}\}/g,          context.audience)
    .replace(/\{\{goal\}\}/g,              'your goal')
    .replace(/\{\{count\}\}/g,             '10+')
    .replace(/\{\{outcome\}\}/g,           'results')
    .replace(/\{\{relationship\}\}/g,      'friend')
    .replace(/\{\{professional_context\}\}/g, 'Industry expert')
    .trim();
}

// ─── Script builder ───────────────────────────────────────────────────────────

function buildScript(opts: {
  hook:        string;
  persona:     UGCPersona;
  brainInput:  UGCBrainInput;
  brainOutput: UGCBrainOutput;
  strategy:    HookStrategy;
  pacing:      UGCPacing;
}): string {
  const { hook, persona, brainInput, brainOutput, strategy, pacing } = opts;
  const { product, painPoint, angle, audience, goal } = brainInput;
  const ctaStyle = brainOutput.platformSignals.ctaStyle.split('|')[0].trim();

  const pacingNote = pacing === 'fast'
    ? '[fast cuts, punchy delivery]'
    : pacing === 'slow'
      ? '[measured delivery, pause for effect]'
      : '[steady flow]';

  const lines: string[] = [
    `[HOOK] ${hook}`,
    `[PERSONA: ${persona.name} — ${persona.tone}] ${pacingNote}`,
    `[PROBLEM] If you're struggling with ${painPoint}, you're not alone. ${audience} deal with this every day.`,
    `[ANGLE: ${angle}] ${brainOutput.emotionalArc}`,
    `[SOLUTION] That's exactly why ${product} exists. Designed to solve ${painPoint} — not work around it.`,
    goal ? `[BENEFIT] ${goal} — that's what you're actually buying.` : '',
    `[CTA] ${ctaStyle} — don't wait.`,
  ].filter(Boolean);

  return lines.join('\n');
}

// ─── Conversion strength estimator ───────────────────────────────────────────

function estimateConversionStrength(
  strategy: HookStrategy,
  energy:   'low' | 'medium' | 'high',
): number {
  const base        = STRATEGY_STRENGTH[strategy] ?? 0.65;
  const energyBonus = energy === 'high' ? 0.05 : energy === 'low' ? -0.05 : 0;
  return Math.min(1, Math.max(0, base + energyBonus));
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class VariantService {
  private readonly logger = new Logger(VariantService.name);

  /**
   * Generate up to `variantCount` UGCVariants from Brain output.
   * Each variant maps to one persona from the brain's ranked list.
   */
  generate(
    brainInput:   UGCBrainInput,
    brainOutput:  UGCBrainOutput,
    variantCount: number = 3,
  ): UGCVariant[] {
    const count    = Math.min(variantCount, brainOutput.personas.length);
    const variants: UGCVariant[] = [];

    for (let i = 0; i < count; i++) {
      const persona  = brainOutput.personas[i];
      const strategy = brainOutput.hookStrategies[i % brainOutput.hookStrategies.length];
      const pacing   = ENERGY_PACING[persona.energy];
      const tone     = STRATEGY_TONE[strategy] ?? 'authentic';

      // Pick hook template — prefer strategy-aligned if available, else first
      const templateRaw = persona.hookTemplates[i % persona.hookTemplates.length];
      const hook = interpolateHook(templateRaw, {
        product:    brainInput.product,
        painPoint:  brainInput.painPoint,
        angle:      brainInput.angle,
        audience:   brainInput.audience,
      });

      const script = buildScript({
        hook,
        persona,
        brainInput,
        brainOutput,
        strategy,
        pacing,
      });

      const conversionStrength = estimateConversionStrength(strategy, persona.energy);

      variants.push({
        id:                 randomUUID(),
        persona:            persona.id,
        hook,
        emotion:            brainInput.emotion ?? 'authentic',
        tone,
        pacing,
        script,
        conversionStrength,
        hookStrategy:       strategy,
      });

      this.logger.debug(
        `[Variant ${i + 1}] persona=${persona.id} strategy=${strategy} ` +
        `tone=${tone} pacing=${pacing} strength=${conversionStrength.toFixed(2)}`,
      );
    }

    // Sort by estimated conversion strength desc
    return variants.sort((a, b) => b.conversionStrength - a.conversionStrength);
  }
}
