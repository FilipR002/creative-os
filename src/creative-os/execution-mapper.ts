/**
 * execution-mapper.ts
 *
 * Converts a validated MasterBlueprint into the exact DTO payloads that the
 * existing video / carousel / banner generation services expect.
 *
 * Mapping logic:
 *   blueprint.production_stack  → format-specific params (durationTier, slideCount, sizes)
 *   blueprint.platform_copy     → keyObjection + valueProposition
 *   blueprint.style_dna         → styleContext (single enriched string)
 *   blueprint.angle_slug        → angleSlug
 *
 * This file imports the DTO types from the existing modules so the compiler
 * enforces shape compatibility at build time.
 */

import type { MasterBlueprint }  from './sonnet-orchestrator';
import type { DurationTier }      from './blueprint-validator';
import { SCENES_BY_TIER }         from './blueprint-validator';

// ─── DTO shapes (mirrored from existing modules, not re-imported to avoid
//     circular dependency — keep in sync with changes to source DTOs) ──────────

export interface VideoGeneratePayload {
  campaignId:        string;
  conceptId:         string;
  angleSlug?:        string;
  durationTier:      DurationTier;
  styleContext?:     string;
  keyObjection?:     string;
  valueProposition?: string;
  variant?:          string;
}

export interface CarouselGeneratePayload {
  campaignId:        string;
  conceptId:         string;
  angleSlug?:        string;
  slideCount:        number;
  platform?:         string;
  styleContext?:     string;
  keyObjection?:     string;
  valueProposition?: string;
  variant?:          string;
}

export interface BannerGeneratePayload {
  campaignId:        string;
  conceptId:         string;
  angleSlug?:        string;
  sizes:             string[];
  styleContext?:     string;
  keyObjection?:     string;
  valueProposition?: string;
  variant?:          string;
}

export type GenerationPayload =
  | { format: 'video';    payload: VideoGeneratePayload }
  | { format: 'carousel'; payload: CarouselGeneratePayload }
  | { format: 'banner';   payload: BannerGeneratePayload };

// ─── RunDto shape — maps blueprint to the existing ProductRun endpoint ─────────
// (used as the fallback when calling POST /api/run directly)

export interface RunPayload {
  brief:        string;
  format:       'video' | 'carousel' | 'banner';
  campaignId:   string;
  platform?:    string;
  durationTier?: string;
  slideCount?:  number;
  sizes?:       string[];
  styleContext?: string;
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * mapBlueprintToGenerationPayload
 *
 * Primary mapping path. Returns a typed payload for the specific generator
 * (VideoService | CarouselService | BannerService).
 */
export function mapBlueprintToGenerationPayload(
  blueprint: MasterBlueprint,
): GenerationPayload {
  const styleContext = buildStyleContext(blueprint);
  const base = {
    campaignId:        blueprint.campaign_id,
    conceptId:         blueprint.concept_id,
    angleSlug:         blueprint.angle_slug,
    styleContext,
    keyObjection:      blueprint.platform_copy.key_objection    || undefined,
    valueProposition:  blueprint.platform_copy.value_proposition || undefined,
  };

  switch (blueprint.format) {
    case 'video': {
      const durationTier = (blueprint.production_stack.duration_tier ?? '30s') as DurationTier;
      const payload: VideoGeneratePayload = { ...base, durationTier };
      return { format: 'video', payload };
    }

    case 'carousel': {
      const slideCount = blueprint.production_stack.slide_count ?? 5;
      const payload: CarouselGeneratePayload = {
        ...base,
        slideCount,
        platform: blueprint.platform_copy.platform || undefined,
      };
      return { format: 'carousel', payload };
    }

    case 'banner': {
      const sizes = blueprint.production_stack.sizes ?? ['1080x1080', '1200x628'];
      const payload: BannerGeneratePayload = { ...base, sizes };
      return { format: 'banner', payload };
    }
  }
}

/**
 * mapBlueprintToRunPayload
 *
 * Secondary mapping path. Converts blueprint into a RunDto-compatible payload
 * so the existing ProductRunService.run() can be called when a full pipeline
 * execution (concept + angles + generation + scoring) is desired.
 */
export function mapBlueprintToRunPayload(
  blueprint:    MasterBlueprint,
  conceptBrief: string,
): RunPayload {
  const styleContext = buildStyleContext(blueprint);

  return {
    brief:        conceptBrief,
    format:       blueprint.format,
    campaignId:   blueprint.campaign_id,
    platform:     blueprint.platform_copy.platform,
    styleContext,
    durationTier: blueprint.format === 'video'
      ? blueprint.production_stack.duration_tier
      : undefined,
    slideCount:   blueprint.format === 'carousel'
      ? blueprint.production_stack.slide_count
      : undefined,
    sizes:        blueprint.format === 'banner'
      ? blueprint.production_stack.sizes
      : undefined,
  };
}

// ─── Diagnostics ──────────────────────────────────────────────────────────────

export interface ExecutionDiagnostics {
  format:         string;
  angle_slug:     string;
  style_context:  string;
  expected_scenes?: number;
  slide_count?:   number;
  banner_sizes?:  string[];
  warnings:       string[];
}

/**
 * diagnoseBlueprint
 *
 * Returns a human-readable summary of what will be executed, useful for
 * logging and the API response body.
 */
export function diagnoseBlueprint(blueprint: MasterBlueprint): ExecutionDiagnostics {
  const warnings: string[] = [];
  const diag: ExecutionDiagnostics = {
    format:        blueprint.format,
    angle_slug:    blueprint.angle_slug,
    style_context: buildStyleContext(blueprint),
    warnings,
  };

  if (blueprint.format === 'video') {
    const tier = blueprint.production_stack.duration_tier as DurationTier;
    diag.expected_scenes = SCENES_BY_TIER[tier] ?? 3;
    if (!blueprint.production_stack.duration_tier) {
      warnings.push('duration_tier missing from production_stack — will default to 30s');
    }
  }

  if (blueprint.format === 'carousel') {
    diag.slide_count = blueprint.production_stack.slide_count ?? 5;
  }

  if (blueprint.format === 'banner') {
    diag.banner_sizes = blueprint.production_stack.sizes ?? ['1080x1080', '1200x628'];
  }

  if (!blueprint.platform_copy.key_objection) {
    warnings.push('key_objection is empty — generator will not have objection context');
  }
  if (!blueprint.platform_copy.value_proposition) {
    warnings.push('value_proposition is empty — generator will not have VP context');
  }

  return diag;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * buildStyleContext
 *
 * Collapses style_dna + hook from platform_copy into the single `styleContext`
 * string that existing generators accept.
 * Format: "tone:X | pacing:X | visual:X | emotion:X | hook:X | opening:X"
 */
function buildStyleContext(blueprint: MasterBlueprint): string {
  const { style_dna, platform_copy } = blueprint;
  const parts: string[] = [
    `tone:${style_dna.tone}`,
    `pacing:${style_dna.pacing}`,
    `visual:${style_dna.visual_style}`,
    `emotion:${style_dna.emotion}`,
    `hook_type:${style_dna.hook_type}`,
  ];
  if (platform_copy.hook) {
    parts.push(`opening:"${platform_copy.hook}"`);
  }
  if (platform_copy.cta) {
    parts.push(`cta:"${platform_copy.cta}"`);
  }
  return parts.join(' | ');
}
