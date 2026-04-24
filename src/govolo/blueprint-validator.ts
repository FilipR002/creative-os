/**
 * blueprint-validator.ts
 *
 * Validates a MasterBlueprint and auto-fixes common issues before execution.
 * Returns the (potentially mutated) blueprint and a list of applied fixes.
 *
 * Rules enforced:
 *   - format is one of: video | carousel | banner
 *   - video: duration_tier must be a valid DurationTier; derived scene count must be 1–10
 *   - carousel: slide_count must be 3–10
 *   - banner: sizes array must contain only valid sizes; min 1
 *   - style_dna and platform_copy fields must be non-empty strings
 *   - angle_slug must be non-empty
 *
 * Auto-fixes applied (non-breaking mutations):
 *   - Unknown duration_tier → nearest valid tier by numeric value
 *   - carousel slide_count < 3 → 3; > 10 → 10
 *   - banner sizes filtered to valid set; empty after filter → default set
 *   - Empty string fields → sensible defaults from concept data
 *   - pacing / hook_type outside allowed enum → closest valid value
 */

import type { MasterBlueprint, BlueprintFormat } from './sonnet-orchestrator';

// ─── Constants ────────────────────────────────────────────────────────────────

export const VALID_DURATION_TIERS = ['5s','8s','10s','15s','30s','45s','60s','75s','90s'] as const;
export type DurationTier = typeof VALID_DURATION_TIERS[number];

/** Number of scenes expected for each duration tier */
export const SCENES_BY_TIER: Record<DurationTier, number> = {
  '5s': 1, '8s': 1, '10s': 2, '15s': 2,
  '30s': 3, '45s': 6, '60s': 7, '75s': 8, '90s': 10,
};

export const VALID_BANNER_SIZES = [
  '1200x628', '1080x1080', '1080x1920', '300x250', '728x90',
] as const;

const VALID_PACING    = ['fast', 'medium', 'slow'] as const;
const VALID_HOOK_TYPES = ['question', 'statement', 'statistic', 'story'] as const;
const VALID_FORMATS: BlueprintFormat[] = ['video', 'carousel', 'banner'];

const DEFAULT_BANNER_SIZES = ['1080x1080', '1200x628'];

// ─── Result type ──────────────────────────────────────────────────────────────

export interface ValidationResult {
  valid:  boolean;
  fixes:  string[];         // human-readable description of each auto-fix
  errors: string[];         // fatal issues that could not be auto-fixed
  blueprint: MasterBlueprint;
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function validateAndFix(raw: MasterBlueprint): ValidationResult {
  // Deep-clone so callers can compare before/after
  const bp    = JSON.parse(JSON.stringify(raw)) as MasterBlueprint;
  const fixes:  string[] = [];
  const errors: string[] = [];

  // ── Identity fields ────────────────────────────────────────────────────────
  if (!bp.campaign_id) errors.push('campaign_id is missing');
  if (!bp.concept_id)  errors.push('concept_id is missing');

  // ── Format ─────────────────────────────────────────────────────────────────
  if (!VALID_FORMATS.includes(bp.format)) {
    // Try to infer from production_stack
    if (bp.production_stack?.duration_tier) {
      bp.format = 'video';
      fixes.push(`format was invalid ("${bp.format}") — inferred "video" from production_stack`);
    } else if (typeof bp.production_stack?.slide_count === 'number') {
      bp.format = 'carousel';
      fixes.push(`format was invalid — inferred "carousel" from production_stack`);
    } else if (Array.isArray(bp.production_stack?.sizes)) {
      bp.format = 'banner';
      fixes.push(`format was invalid — inferred "banner" from production_stack`);
    } else {
      errors.push(`format "${bp.format}" is not valid and could not be inferred`);
    }
  }

  // ── Format-specific production_stack validation ────────────────────────────
  if (!bp.production_stack) {
    bp.production_stack = {};
    fixes.push('production_stack was missing — initialised as empty object');
  }

  if (bp.format === 'video') {
    bp.production_stack = fixVideoStack(bp.production_stack, fixes, errors);
  } else if (bp.format === 'carousel') {
    bp.production_stack = fixCarouselStack(bp.production_stack, fixes, errors);
  } else if (bp.format === 'banner') {
    bp.production_stack = fixBannerStack(bp.production_stack, fixes);
  }

  // ── style_dna ─────────────────────────────────────────────────────────────
  if (!bp.style_dna) {
    bp.style_dna = {
      tone: 'conversational', pacing: 'medium',
      visual_style: 'cinematic', emotion: 'trust', hook_type: 'statement',
    };
    fixes.push('style_dna was missing — applied defaults');
  } else {
    if (!VALID_PACING.includes(bp.style_dna.pacing as typeof VALID_PACING[number])) {
      fixes.push(`pacing "${bp.style_dna.pacing}" is invalid — defaulting to "medium"`);
      bp.style_dna.pacing = 'medium';
    }
    if (!VALID_HOOK_TYPES.includes(bp.style_dna.hook_type as typeof VALID_HOOK_TYPES[number])) {
      fixes.push(`hook_type "${bp.style_dna.hook_type}" is invalid — defaulting to "statement"`);
      bp.style_dna.hook_type = 'statement';
    }
    bp.style_dna.tone         = requireString(bp.style_dna.tone,         'conversational', 'style_dna.tone',         fixes);
    bp.style_dna.visual_style = requireString(bp.style_dna.visual_style, 'cinematic',      'style_dna.visual_style', fixes);
    bp.style_dna.emotion      = requireString(bp.style_dna.emotion,      'curiosity',      'style_dna.emotion',      fixes);
  }

  // ── platform_copy ─────────────────────────────────────────────────────────
  if (!bp.platform_copy) {
    bp.platform_copy = {
      hook: 'Watch this.', core_message: '', value_proposition: '',
      key_objection: '', cta: 'Learn more', platform: 'instagram',
    };
    fixes.push('platform_copy was missing — applied defaults');
  } else {
    bp.platform_copy.hook              = requireString(bp.platform_copy.hook,              'Watch this.',   'platform_copy.hook',              fixes);
    bp.platform_copy.core_message      = requireString(bp.platform_copy.core_message,      '',              'platform_copy.core_message',      fixes);
    bp.platform_copy.value_proposition = requireString(bp.platform_copy.value_proposition, '',              'platform_copy.value_proposition', fixes);
    bp.platform_copy.key_objection     = requireString(bp.platform_copy.key_objection,     '',              'platform_copy.key_objection',     fixes);
    bp.platform_copy.cta               = requireString(bp.platform_copy.cta,               'Learn more',    'platform_copy.cta',               fixes);
    bp.platform_copy.platform          = requireString(bp.platform_copy.platform,          'instagram',     'platform_copy.platform',          fixes);
  }

  // ── angle_slug ────────────────────────────────────────────────────────────
  if (!bp.angle_slug || typeof bp.angle_slug !== 'string') {
    bp.angle_slug = 'problem_solution';
    fixes.push('angle_slug was missing — defaulted to "problem_solution"');
  }

  return {
    valid:     errors.length === 0,
    fixes,
    errors,
    blueprint: bp,
  };
}

// ─── Per-format fixers ────────────────────────────────────────────────────────

function fixVideoStack(
  stack:  MasterBlueprint['production_stack'],
  fixes:  string[],
  errors: string[],
): MasterBlueprint['production_stack'] {
  const tier = stack.duration_tier;

  if (!tier) {
    stack.duration_tier = '30s';
    fixes.push('production_stack.duration_tier was missing — defaulted to "30s"');
    return stack;
  }

  if (VALID_DURATION_TIERS.includes(tier as DurationTier)) {
    return stack; // already valid
  }

  // Try to parse numeric value and snap to nearest valid tier
  const seconds = parseFloat(tier);
  if (!isNaN(seconds)) {
    const nearest = snapToNearestTier(seconds);
    fixes.push(`duration_tier "${tier}" is not valid — snapped to nearest valid tier "${nearest}"`);
    stack.duration_tier = nearest;
  } else {
    errors.push(`duration_tier "${tier}" is not a valid tier and could not be parsed`);
  }

  return stack;
}

function fixCarouselStack(
  stack:  MasterBlueprint['production_stack'],
  fixes:  string[],
  errors: string[],
): MasterBlueprint['production_stack'] {
  if (typeof stack.slide_count !== 'number' || isNaN(stack.slide_count)) {
    stack.slide_count = 5;
    fixes.push('production_stack.slide_count was missing or NaN — defaulted to 5');
    return stack;
  }

  if (stack.slide_count < 3) {
    fixes.push(`slide_count ${stack.slide_count} is below minimum (3) — set to 3`);
    stack.slide_count = 3;
  } else if (stack.slide_count > 10) {
    fixes.push(`slide_count ${stack.slide_count} exceeds maximum (10) — capped at 10`);
    stack.slide_count = 10;
  }

  return stack;
}

function fixBannerStack(
  stack: MasterBlueprint['production_stack'],
  fixes: string[],
): MasterBlueprint['production_stack'] {
  if (!Array.isArray(stack.sizes) || stack.sizes.length === 0) {
    stack.sizes = DEFAULT_BANNER_SIZES;
    fixes.push(`production_stack.sizes was missing or empty — defaulted to ${JSON.stringify(DEFAULT_BANNER_SIZES)}`);
    return stack;
  }

  const before = stack.sizes;
  stack.sizes = stack.sizes.filter(s => (VALID_BANNER_SIZES as readonly string[]).includes(s));

  if (stack.sizes.length === 0) {
    stack.sizes = DEFAULT_BANNER_SIZES;
    fixes.push(`All sizes in [${before.join(', ')}] were invalid — defaulted to ${JSON.stringify(DEFAULT_BANNER_SIZES)}`);
  } else if (stack.sizes.length < before.length) {
    const removed = before.filter(s => !stack.sizes!.includes(s));
    fixes.push(`Removed invalid banner sizes: [${removed.join(', ')}]`);
  }

  return stack;
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function requireString(
  val:          unknown,
  defaultValue: string,
  field:        string,
  fixes:        string[],
): string {
  if (typeof val === 'string' && val.trim().length > 0) return val.trim();
  if (defaultValue !== '') {
    fixes.push(`${field} was empty — defaulted to "${defaultValue}"`);
  }
  return defaultValue;
}

function snapToNearestTier(seconds: number): DurationTier {
  const numericTiers: Array<[number, DurationTier]> = VALID_DURATION_TIERS.map(t => [
    parseInt(t, 10),
    t,
  ]);

  let best      = numericTiers[0];
  let bestDelta = Math.abs(seconds - best[0]);

  for (const [s, tier] of numericTiers) {
    const delta = Math.abs(seconds - s);
    if (delta < bestDelta) { bestDelta = delta; best = [s, tier]; }
  }

  return best[1];
}
