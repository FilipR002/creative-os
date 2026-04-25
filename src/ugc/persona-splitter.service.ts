/**
 * persona-splitter.service.ts
 *
 * Multi-Persona Splitter — Phase 1.1
 *
 * Determines which personas should dominate the viral test and assigns
 * probability weights based on three signal dimensions:
 *
 *   1. Angle fit   — which persona types best match the creative angle
 *   2. Emotion fit — which personas convert best for the primary emotion
 *   3. Platform fit — which personas the platform algorithm rewards
 *
 * Rules:
 *   - All weights sum to exactly 1.0
 *   - Minimum pool is 2 personas; maximum is 4
 *   - The dominant persona always gets ≥ 0.30 probability
 *   - Weights are soft (probabilistic), not hard cuts
 */

import { Injectable, Logger } from '@nestjs/common';

import { PersonaService }   from './persona.service';
import type {
  PersonaSplitInput,
  PersonaSplitOutput,
  PersonaWeight,
} from './types/viral-test.types';
import type { UGCPersonaId } from './types/ugc.types';

// ─── Angle → persona affinity ─────────────────────────────────────────────────

const ANGLE_PERSONA_AFFINITY: Record<string, UGCPersonaId[]> = {
  direct_benefit:    ['skeptical_user', 'reviewer',      'testimonial'],
  storytelling:      ['before_after',   'founder_voice', 'testimonial'],
  social_proof:      ['testimonial',    'reviewer',      'skeptical_user'],
  urgency:           ['excited_user',   'before_after',  'founder_voice'],
  educational:       ['tutorial',       'authority',     'reviewer'],
  controversy:       ['skeptical_user', 'founder_voice', 'authority'],
  emotional:         ['before_after',   'testimonial',   'excited_user'],
  premium:           ['authority',      'reviewer',      'founder_voice'],
  price_focused:     ['skeptical_user', 'reviewer',      'testimonial'],
};

// ─── Emotion → persona affinity ──────────────────────────────────────────────

const EMOTION_PERSONA_AFFINITY: Record<string, UGCPersonaId[]> = {
  frustrated:  ['skeptical_user', 'before_after',  'testimonial'],
  curious:     ['tutorial',       'authority',     'reviewer'],
  excited:     ['excited_user',   'before_after',  'founder_voice'],
  anxious:     ['testimonial',    'authority',     'skeptical_user'],
  hopeful:     ['before_after',   'excited_user',  'testimonial'],
  skeptical:   ['skeptical_user', 'reviewer',      'authority'],
  motivated:   ['founder_voice',  'excited_user',  'tutorial'],
  overwhelmed: ['tutorial',       'authority',     'testimonial'],
};

// ─── Platform → persona affinity ─────────────────────────────────────────────

const PLATFORM_PERSONA_AFFINITY: Record<string, UGCPersonaId[]> = {
  tiktok:           ['skeptical_user', 'excited_user',  'before_after'],
  instagram_reels:  ['before_after',   'testimonial',   'excited_user'],
  youtube_shorts:   ['tutorial',       'reviewer',      'authority'],
  facebook:         ['testimonial',    'skeptical_user', 'before_after'],
  instagram:        ['before_after',   'testimonial',   'authority'],
  linkedin:         ['founder_voice',  'authority',     'tutorial'],
};

const DEFAULT_PERSONA_ORDER: UGCPersonaId[] = [
  'skeptical_user', 'excited_user', 'before_after', 'testimonial',
];

// ─── Weight assignment ─────────────────────────────────────────────────────────

const WEIGHT_TABLES = [0.35, 0.30, 0.20, 0.15] as const;

function buildWeights(
  ranked: UGCPersonaId[],
  count:  number,
): PersonaWeight[] {
  const pool = ranked.slice(0, count);
  // If we have fewer than `count` unique personas, pad from defaults
  for (const fallback of DEFAULT_PERSONA_ORDER) {
    if (pool.length >= count) break;
    if (!pool.includes(fallback)) pool.push(fallback);
  }

  // Re-normalise weights to sum to 1.0 for the actual count
  const rawWeights = WEIGHT_TABLES.slice(0, pool.length);
  const sum        = rawWeights.reduce((a, b) => a + b, 0);

  return pool.map((personaId, i) => ({
    personaId,
    probability: Math.round((rawWeights[i] / sum) * 1000) / 1000,
    driver:      i === 0 ? 'angle_fit' : i === 1 ? 'emotion_fit' : i === 2 ? 'platform_fit' : 'default',
  }));
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class PersonaSplitterService {
  private readonly logger = new Logger(PersonaSplitterService.name);

  constructor(private readonly personas: PersonaService) {}

  /**
   * Split campaign context into weighted persona pool.
   *
   * @param input — campaign + context signals
   * @param count — number of personas to include (2–4, default 3)
   */
  split(input: PersonaSplitInput, count: number = 3): PersonaSplitOutput {
    const clampedCount = Math.min(4, Math.max(2, count));
    const normalPlatform = input.platform.toLowerCase().replace(/\s+/g, '_');
    const normalAngle    = input.angle.toLowerCase().replace(/[\s-]+/g, '_');
    const normalEmotion  = (input.emotion ?? 'frustrated').toLowerCase();

    // Gather signal lists
    const fromAngle    = ANGLE_PERSONA_AFFINITY[normalAngle]     ?? [];
    const fromEmotion  = EMOTION_PERSONA_AFFINITY[normalEmotion] ?? [];
    const fromPlatform = PLATFORM_PERSONA_AFFINITY[normalPlatform] ??
                         PLATFORM_PERSONA_AFFINITY['tiktok'] ?? [];

    // Use user-supplied overrides if present
    if (input.personaIds && input.personaIds.length >= 2) {
      const weights = buildWeights(input.personaIds, clampedCount);
      return {
        weights,
        dominant:  weights[0].personaId,
        reasoning: `User-specified persona pool: [${input.personaIds.join(', ')}]`,
      };
    }

    // Score each persona ID by how many signal lists it appears in
    const scoreMap = new Map<UGCPersonaId, number>();
    const increment = (id: UGCPersonaId, points: number) =>
      scoreMap.set(id, (scoreMap.get(id) ?? 0) + points);

    fromAngle.forEach((id, i)    => increment(id, 3 - i));   // angle: highest weight
    fromEmotion.forEach((id, i)  => increment(id, 2 - i));   // emotion: medium weight
    fromPlatform.forEach((id, i) => increment(id, 2 - i));   // platform: medium weight

    // Sort by score desc, then alphabetically for determinism
    const ranked = [...scoreMap.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([id]) => id);

    const weights = buildWeights(ranked, clampedCount);

    this.logger.debug(
      `[PersonaSplitter] angle=${normalAngle} emotion=${normalEmotion} ` +
      `platform=${normalPlatform} → [${weights.map(w => `${w.personaId}:${w.probability}`).join(', ')}]`,
    );

    const reasoning =
      `Angle "${normalAngle}" → ${fromAngle.slice(0, 2).join('+')} | ` +
      `Emotion "${normalEmotion}" → ${fromEmotion.slice(0, 2).join('+')} | ` +
      `Platform "${normalPlatform}" → ${fromPlatform.slice(0, 2).join('+')}`;

    return {
      weights,
      dominant:  weights[0].personaId,
      reasoning,
    };
  }
}
