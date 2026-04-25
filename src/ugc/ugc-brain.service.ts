/**
 * ugc-brain.service.ts
 *
 * UGC Brain — first stage of the UGC Engine.
 *
 * Responsibilities:
 *   1. Select the best personas for the campaign context
 *   2. Derive hook strategies from angle + emotion + platform signals
 *   3. Define emotional arc (problem → tension → resolution → action)
 *   4. Emit platform-specific pacing + CTA style signals
 *
 * Pure logic — no external API calls. Fast, deterministic, testable.
 */

import { Injectable, Logger } from '@nestjs/common';

import { PersonaService } from './persona.service';
import type {
  UGCBrainInput,
  UGCBrainOutput,
  UGCPersona,
  HookStrategy,
} from './types/ugc.types';

// ─── Platform config ──────────────────────────────────────────────────────────

interface PlatformConfig {
  preferredPacing: 'slow' | 'medium' | 'fast';
  openingStyle:    string;
  ctaStyle:        string;
  topHooks:        HookStrategy[];
}

const PLATFORM_CONFIGS: Record<string, PlatformConfig> = {
  tiktok: {
    preferredPacing: 'fast',
    openingStyle:    'pattern_interrupt_first_frame',
    ctaStyle:        'follow_for_more | link_in_bio | comment_below',
    topHooks:        ['shock', 'relatable_pain', 'curiosity', 'controversy'],
  },
  instagram_reels: {
    preferredPacing: 'medium',
    openingStyle:    'visual_hook_with_text_overlay',
    ctaStyle:        'save_this | share_if_relatable | link_in_bio',
    topHooks:        ['before_after', 'social_proof', 'relatable_pain', 'tutorial'],
  },
  youtube_shorts: {
    preferredPacing: 'medium',
    openingStyle:    'bold_statement_or_question',
    ctaStyle:        'subscribe | watch_more | comment_your_experience',
    topHooks:        ['tutorial', 'authority', 'curiosity', 'before_after'],
  },
  facebook: {
    preferredPacing: 'slow',
    openingStyle:    'story_driven_opener',
    ctaStyle:        'learn_more | shop_now | comment_below',
    topHooks:        ['social_proof', 'before_after', 'relatable_pain', 'authority'],
  },
};

const DEFAULT_PLATFORM_CONFIG: PlatformConfig = {
  preferredPacing: 'medium',
  openingStyle:    'hook_then_value',
  ctaStyle:        'learn_more | shop_now',
  topHooks:        ['curiosity', 'relatable_pain', 'social_proof'],
};

// ─── Emotion → hook strategy affinity ────────────────────────────────────────

const EMOTION_HOOK_AFFINITY: Record<string, HookStrategy[]> = {
  frustrated:  ['relatable_pain', 'before_after', 'controversy'],
  curious:     ['curiosity', 'tutorial', 'authority'],
  excited:     ['shock', 'before_after', 'social_proof'],
  anxious:     ['relatable_pain', 'authority', 'social_proof'],
  hopeful:     ['before_after', 'social_proof', 'tutorial'],
  skeptical:   ['authority', 'social_proof', 'before_after'],
  motivated:   ['shock', 'curiosity', 'tutorial'],
  overwhelmed: ['tutorial', 'relatable_pain', 'authority'],
};

// ─── Emotional arc templates ───────────────────────────────────────────────────

function buildEmotionalArc(input: UGCBrainInput): string {
  const emotion = input.emotion ?? 'frustrated';
  const arcs: Record<string, string> = {
    frustrated:  `Open with "${input.painPoint}" frustration → build tension → reveal ${input.product} as relief → confident CTA`,
    curious:     `Tease the unknown → create information gap → deliver the "aha" with ${input.product} → drive action`,
    excited:     `High energy opener → quick transformation promise → ${input.product} as the key → urgency CTA`,
    anxious:     `Validate the anxiety around "${input.painPoint}" → calm with facts → ${input.product} as the safe choice → reassuring CTA`,
    hopeful:     `Paint the ideal outcome → show the gap → ${input.product} as the bridge → aspirational CTA`,
    skeptical:   `Acknowledge doubt upfront → prove it systematically → ${input.product} earns trust → soft CTA`,
    motivated:   `Tap into drive → raise the stakes → ${input.product} as the accelerant → bold CTA`,
    overwhelmed: `Simplify the problem → step-by-step path → ${input.product} does the heavy lifting → relief CTA`,
  };
  return arcs[emotion] ?? `Introduce "${input.painPoint}" → build desire for "${input.goal ?? 'a solution'}" → ${input.product} as answer → CTA`;
}

// ─── Hook strategy selection ──────────────────────────────────────────────────

function selectHookStrategies(
  input:          UGCBrainInput,
  platformConfig: PlatformConfig,
): HookStrategy[] {
  const fromEmotion  = EMOTION_HOOK_AFFINITY[input.emotion ?? 'frustrated'] ?? [];
  const fromPlatform = platformConfig.topHooks;

  // Union with platform hooks first (platform wins on priority)
  const merged = [...fromPlatform, ...fromEmotion];
  const seen   = new Set<HookStrategy>();
  const result: HookStrategy[] = [];

  for (const h of merged) {
    if (!seen.has(h)) {
      seen.add(h);
      result.push(h);
    }
    if (result.length >= 4) break;
  }

  return result;
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class UGCBrainService {
  private readonly logger = new Logger(UGCBrainService.name);

  constructor(private readonly personas: PersonaService) {}

  /**
   * Run the UGC Brain — produces personas, hook strategies, emotional arc,
   * and platform-optimised signals for the variant generator.
   */
  analyze(input: UGCBrainInput): UGCBrainOutput {
    const platformKey    = input.platform.toLowerCase().replace(/\s+/g, '_');
    const platformConfig = PLATFORM_CONFIGS[platformKey] ?? DEFAULT_PLATFORM_CONFIG;

    // Select top personas for this platform + energy fit
    const energyForPacing: Record<string, 'low' | 'medium' | 'high'> = {
      fast:   'high',
      medium: 'medium',
      slow:   'low',
    };
    const energy   = energyForPacing[platformConfig.preferredPacing] ?? 'medium';
    const selected = this.personas.selectFor({ platform: platformKey, energy, limit: 3 });

    const hookStrategies = selectHookStrategies(input, platformConfig);
    const emotionalArc   = buildEmotionalArc(input);

    this.logger.debug(
      `[UGCBrain] platform=${input.platform} personas=${selected.map(p => p.id).join(',')} ` +
      `hooks=${hookStrategies.slice(0, 2).join(',')} pacing=${platformConfig.preferredPacing}`,
    );

    return {
      personas:       selected,
      hookStrategies,
      emotionalArc,
      platformSignals: {
        preferredPacing: platformConfig.preferredPacing,
        openingStyle:    platformConfig.openingStyle,
        ctaStyle:        platformConfig.ctaStyle,
      },
    };
  }
}
