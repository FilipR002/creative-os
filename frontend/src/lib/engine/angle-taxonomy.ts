// ─── Angle Taxonomy ───────────────────────────────────────────────────────────
// Maps backend angle slugs to behavioral metadata used by the ranking engine.
// Each angle has affinity scores for goals, platforms, and content styles.
// These drive the ContextModifierLayer — NOT static weights.

import type { GoalType, PlatformType, ContentStyle } from '../user-context';

export interface AngleBehavior {
  goalAffinity:     GoalType[];     // which goals this angle serves best
  platformAffinity: PlatformType[]; // which platforms this angle performs on
  styleAffinity:    ContentStyle[]; // which content styles this angle matches
  noveltyScore:     number;         // 0–1: how "fresh"/underused this angle tends to be
  riskProfile:      number;         // 0–1: how edgy/polarising this angle is
  conversionWeight: number;         // 0–1: direct conversion pull
  emotionalDepth:   number;         // 0–1: emotional resonance capability
}

// Core taxonomy — extended as new angles are added to the backend
export const ANGLE_TAXONOMY: Record<string, AngleBehavior> = {
  before_after: {
    goalAffinity:     ['sales', 'lead_generation'],
    platformAffinity: ['Meta', 'TikTok'],
    styleAffinity:    ['direct_response', 'storytelling'],
    noveltyScore:     0.25, riskProfile: 0.15,
    conversionWeight: 0.85, emotionalDepth: 0.55,
  },
  proof: {
    goalAffinity:     ['sales', 'branding'],
    platformAffinity: ['Meta', 'YouTube', 'Google Ads'],
    styleAffinity:    ['educational', 'direct_response'],
    noveltyScore:     0.20, riskProfile: 0.10,
    conversionWeight: 0.80, emotionalDepth: 0.40,
  },
  show_off: {
    goalAffinity:     ['branding', 'growth'],
    platformAffinity: ['TikTok', 'Meta'],
    styleAffinity:    ['viral', 'storytelling'],
    noveltyScore:     0.50, riskProfile: 0.40,
    conversionWeight: 0.50, emotionalDepth: 0.70,
  },
  curiosity: {
    goalAffinity:     ['growth', 'lead_generation'],
    platformAffinity: ['TikTok', 'YouTube'],
    styleAffinity:    ['viral', 'educational'],
    noveltyScore:     0.60, riskProfile: 0.35,
    conversionWeight: 0.55, emotionalDepth: 0.65,
  },
  hot_take: {
    goalAffinity:     ['growth', 'branding'],
    platformAffinity: ['TikTok'],
    styleAffinity:    ['viral'],
    noveltyScore:     0.80, riskProfile: 0.75,
    conversionWeight: 0.40, emotionalDepth: 0.80,
  },
  teach: {
    goalAffinity:     ['lead_generation', 'branding'],
    platformAffinity: ['YouTube', 'Meta', 'Google Ads'],
    styleAffinity:    ['educational'],
    noveltyScore:     0.30, riskProfile: 0.10,
    conversionWeight: 0.45, emotionalDepth: 0.50,
  },
  unpopular_opinion: {
    goalAffinity:     ['growth'],
    platformAffinity: ['TikTok'],
    styleAffinity:    ['viral'],
    noveltyScore:     0.85, riskProfile: 0.80,
    conversionWeight: 0.35, emotionalDepth: 0.85,
  },
  storytelling: {
    goalAffinity:     ['branding', 'growth'],
    platformAffinity: ['YouTube', 'Meta'],
    styleAffinity:    ['storytelling', 'educational'],
    noveltyScore:     0.40, riskProfile: 0.20,
    conversionWeight: 0.55, emotionalDepth: 0.90,
  },
  urgency: {
    goalAffinity:     ['sales', 'lead_generation'],
    platformAffinity: ['Meta', 'Google Ads'],
    styleAffinity:    ['direct_response'],
    noveltyScore:     0.15, riskProfile: 0.25,
    conversionWeight: 0.90, emotionalDepth: 0.35,
  },
  social_proof: {
    goalAffinity:     ['sales', 'branding'],
    platformAffinity: ['Meta', 'YouTube'],
    styleAffinity:    ['educational', 'storytelling'],
    noveltyScore:     0.20, riskProfile: 0.10,
    conversionWeight: 0.75, emotionalDepth: 0.50,
  },
  problem_agitate: {
    goalAffinity:     ['sales', 'lead_generation'],
    platformAffinity: ['Meta', 'TikTok', 'Google Ads'],
    styleAffinity:    ['direct_response', 'storytelling'],
    noveltyScore:     0.35, riskProfile: 0.30,
    conversionWeight: 0.80, emotionalDepth: 0.70,
  },
  aspirational: {
    goalAffinity:     ['branding', 'growth'],
    platformAffinity: ['TikTok', 'YouTube', 'Meta'],
    styleAffinity:    ['storytelling', 'viral'],
    noveltyScore:     0.45, riskProfile: 0.25,
    conversionWeight: 0.50, emotionalDepth: 0.85,
  },
};

// Fallback for angles not in the taxonomy
export const UNKNOWN_ANGLE_BEHAVIOR: AngleBehavior = {
  goalAffinity:     [],
  platformAffinity: [],
  styleAffinity:    [],
  noveltyScore:     0.50, riskProfile: 0.50,
  conversionWeight: 0.50, emotionalDepth: 0.50,
};

export function getAngleBehavior(slug: string): AngleBehavior {
  return ANGLE_TAXONOMY[slug] ?? UNKNOWN_ANGLE_BEHAVIOR;
}
