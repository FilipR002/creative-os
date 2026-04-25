/**
 * persona.service.ts
 *
 * UGC Persona Registry — canonical source for all UGC personas.
 *
 * Each persona encodes:
 *   - Tone + energy level (drives Kling prompt style)
 *   - Platform fit signals (TikTok vs Instagram vs YouTube Shorts)
 *   - Hook opening templates (raw material for UGC Brain)
 */

import { Injectable } from '@nestjs/common';

import type { UGCPersona, UGCPersonaId } from './types/ugc.types';

// ─── Persona registry ─────────────────────────────────────────────────────────

const PERSONA_REGISTRY: Record<UGCPersonaId, UGCPersona> = {

  skeptical_user: {
    id:          'skeptical_user',
    name:        'The Skeptic',
    description: 'Real person who tried it and was surprised it worked. Validates objections.',
    tone:        'honest, slightly surprised, conversational',
    energy:      'medium',
    bestFor:     ['tiktok', 'instagram_reels', 'facebook'],
    hookTemplates: [
      'I was skeptical at first, but…',
      'I didn\'t believe this would work until…',
      'OK I tried every {{product_type}} and this one actually…',
      'Genuine reaction: I thought this was a gimmick',
    ],
  },

  excited_user: {
    id:          'excited_user',
    name:        'The Enthusiast',
    description: 'High energy, genuine excitement. Drives impulse action.',
    tone:        'enthusiastic, fast-paced, punchy',
    energy:      'high',
    bestFor:     ['tiktok', 'instagram_reels'],
    hookTemplates: [
      'I CANNOT believe I just found this',
      'This just changed everything for {{pain_point}}',
      'POV: you finally found the thing that works',
      'Stop scrolling. You need to see this.',
    ],
  },

  founder_voice: {
    id:          'founder_voice',
    name:        'The Founder',
    description: 'Authentic founder or team member explaining the why behind the product.',
    tone:        'direct, passionate, transparent',
    energy:      'medium',
    bestFor:     ['instagram_reels', 'youtube_shorts', 'linkedin'],
    hookTemplates: [
      'I built this because {{pain_point}} was ruining my life',
      'We spent 2 years fixing {{pain_point}} — here\'s what we learned',
      'Real talk: why I started {{product}}',
      'The problem nobody was solving until we did',
    ],
  },

  reviewer: {
    id:          'reviewer',
    name:        'The Reviewer',
    description: 'Structured comparison format. Builds trust through systematic evaluation.',
    tone:        'measured, credible, analytical',
    energy:      'medium',
    bestFor:     ['youtube_shorts', 'tiktok', 'instagram_reels'],
    hookTemplates: [
      'I tested {{product}} for 30 days — honest review',
      'vs every other {{product_type}}: who wins?',
      '3 things I wish I knew before buying {{product}}',
      'Is {{product}} worth it? I\'ll tell you exactly',
    ],
  },

  before_after: {
    id:          'before_after',
    name:        'Before / After',
    description: 'Visual transformation arc. Maximum impact for tangible outcomes.',
    tone:        'emotional, aspirational, relatable',
    energy:      'high',
    bestFor:     ['tiktok', 'instagram_reels', 'facebook'],
    hookTemplates: [
      'This is what {{pain_point}} looked like 30 days ago…',
      'Before {{product}} vs after: the difference is insane',
      'Week 1 vs Week 4 — you won\'t believe the change',
      'I documented everything. Here\'s what happened.',
    ],
  },

  tutorial: {
    id:          'tutorial',
    name:        'The Tutorial',
    description: 'Step-by-step walkthrough. High retention, strong CTA for value-led products.',
    tone:        'clear, helpful, confident',
    energy:      'medium',
    bestFor:     ['youtube_shorts', 'tiktok', 'instagram'],
    hookTemplates: [
      'How to fix {{pain_point}} in under 60 seconds',
      'The exact process I use for {{goal}}',
      'Step 1 to solving {{pain_point}} (most people skip this)',
      'Watch this before you waste money on {{product_type}}',
    ],
  },

  testimonial: {
    id:          'testimonial',
    name:        'The Testimonial',
    description: 'Social proof through real customer narrative. Builds trust rapidly.',
    tone:        'warm, authentic, grateful',
    energy:      'low',
    bestFor:     ['facebook', 'instagram', 'tiktok'],
    hookTemplates: [
      '{{product}} genuinely changed my {{outcome}}',
      'I\'ve recommended this to {{count}} people already',
      'My {{relationship}} told me to try this and honestly…',
      'After years of dealing with {{pain_point}}, this is the one',
    ],
  },

  authority: {
    id:          'authority',
    name:        'The Authority',
    description: 'Expert framing — practitioner or professional endorsement angle.',
    tone:        'authoritative, precise, trustworthy',
    energy:      'low',
    bestFor:     ['instagram', 'youtube_shorts', 'linkedin'],
    hookTemplates: [
      'As someone who\'s dealt with {{pain_point}} professionally:',
      'The thing experts know about {{product_type}} that you don\'t',
      '{{professional_context}} explains why {{product}} works',
      'I\'ve reviewed hundreds of {{product_type}}. Here\'s the truth.',
    ],
  },
};

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class PersonaService {

  /** All personas as an array */
  all(): UGCPersona[] {
    return Object.values(PERSONA_REGISTRY);
  }

  /** Single persona by ID */
  get(id: UGCPersonaId): UGCPersona {
    return PERSONA_REGISTRY[id];
  }

  /**
   * Select personas best suited for a given platform.
   * Falls back to all personas if no platform match found.
   */
  forPlatform(platform: string): UGCPersona[] {
    const normalised = platform.toLowerCase().replace(/[^a-z_]/g, '_');
    const matched = this.all().filter(p =>
      p.bestFor.some(pf => normalised.includes(pf) || pf.includes(normalised)),
    );
    return matched.length >= 2 ? matched : this.all();
  }

  /**
   * Select top N personas by energy level match.
   * Useful when pacing signal is available from routing decision.
   */
  byEnergy(energy: 'low' | 'medium' | 'high'): UGCPersona[] {
    return this.all().filter(p => p.energy === energy);
  }

  /**
   * Select a ranked subset for a generation run.
   * Priority: platform fit → energy match → fallback to all.
   * Returns up to `limit` personas (default 3).
   */
  selectFor(opts: {
    platform: string;
    energy?:  'low' | 'medium' | 'high';
    limit?:   number;
  }): UGCPersona[] {
    const limit = opts.limit ?? 3;
    let pool = this.forPlatform(opts.platform);

    if (opts.energy) {
      const energyMatch = pool.filter(p => p.energy === opts.energy);
      if (energyMatch.length >= 2) pool = energyMatch;
    }

    return pool.slice(0, limit);
  }
}
