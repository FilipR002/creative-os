/**
 * scene-optimizer.ts
 *
 * Optimises a set of virtual scenes extracted from a MasterBlueprint before
 * they are serialised into the generation payload.
 *
 * Per-scene pipeline:
 *   1. Hook enhancement  (HookBoosterService)  — hook/problem scenes only
 *   2. Overlay rewrite   (SceneRewriterService) — all scenes
 *   3. Creative DNA injection (CreativeDNAService) — appended to visual prompt
 *
 * Pure orchestration — delegates all intelligence to existing engines.
 * Services are passed as a dependency bag; no NestJS DI here so the function
 * can also be unit-tested with mock objects.
 */

import type { HookBoosterService }  from '../../hook-booster/hook-booster.service';
import type { SceneRewriterService } from '../../scene-rewriter/scene-rewriter.service';
import type { HookBoosterInput }    from '../../hook-booster/hook-booster.types';
import type { SceneRewriterInput }  from '../../scene-rewriter/scene-rewriter.types';
import type { SceneType }           from './model-router';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RawScene {
  /** Kling/Veo visual prompt */
  kling_prompt:  string;
  /** On-screen text */
  overlay_text:  string;
  /** Narrative role — may be absent if derived from blueprint position */
  scene_type?:   SceneType;
  transition?:   string;
  pacing?:       string;
  voiceover?:    string;
}

export interface OptimizedScene extends RawScene {
  /** Best hook variant (hook/problem scenes only) */
  boosted_hook?: string;
  /** Best rewrite of overlay_text */
  rewritten_text:   string;
  /** Whether Creative DNA was injected into kling_prompt */
  dna_injected:     boolean;
  /** Human-readable optimisation notes for pipelineTrace */
  optimization_log: string[];
}

export interface SceneOptimizationContext {
  angleSlug:  string;
  emotion:    string;
  goal:       string;
  format:     'video' | 'carousel' | 'banner';
  platform:   string;
  /** Pre-fetched DNA context string (or null if no DNA available yet) */
  dnaContext: string | null;
}

export interface OptimizerServices {
  hookBooster:   HookBoosterService;
  sceneRewriter: SceneRewriterService;
}

// ─── Single-scene optimiser ───────────────────────────────────────────────────

export function optimizeScene(
  scene:    RawScene,
  ctx:      SceneOptimizationContext,
  services: OptimizerServices,
): OptimizedScene {
  const log: string[] = [];
  let   finalText    = scene.overlay_text;
  let   boostedHook: string | undefined;
  let   klingPrompt  = scene.kling_prompt;
  const isAttentionScene = (
    scene.scene_type === 'hook' ||
    scene.scene_type === 'problem' ||
    !scene.scene_type            // first scene with no explicit type → treat as hook
  );

  // ── Step 1: Hook enhancement (attention scenes only) ──────────────────────
  if (isAttentionScene && scene.overlay_text.trim().length > 0) {
    try {
      const hookInput: HookBoosterInput = {
        format:           ctx.format,
        primary_angle:    ctx.angleSlug,
        emotion:          ctx.emotion,
        goal:             ctx.goal,
        product_context:  null,
        audience_context: null,
      };
      const hookOutput  = services.hookBooster.generate(hookInput);
      const bestVariant = hookOutput.hooks[hookOutput.best_hook_index];
      if (bestVariant && bestVariant.strength_score > 0.55) {
        boostedHook = bestVariant.hook;
        finalText   = bestVariant.hook;
        log.push(`hook_boosted: strength=${bestVariant.strength_score.toFixed(2)} strategy=${bestVariant.strategy}`);
      } else {
        log.push(`hook_boost_skipped: best_score=${bestVariant?.strength_score?.toFixed(2) ?? 'n/a'}`);
      }
    } catch {
      log.push('hook_boost_error: skipped (non-blocking)');
    }
  }

  // ── Step 2: Overlay text rewrite ──────────────────────────────────────────
  try {
    const rewriteInput: SceneRewriterInput = {
      format:                   ctx.format,
      creative_segment:         finalText,
      original_hook_or_scene:   scene.overlay_text,
      performance_signal:       {
        // Neutral forward-looking signal — no historical data at generation time
        ctr:        0.02,
        retention:  0.50,
        conversion: 0.03,
      },
      angle_context:  { primary: ctx.angleSlug },
      emotion_context: ctx.emotion,
    };
    const rewriteOutput = services.sceneRewriter.rewrite(rewriteInput);
    const bestRewrite   = rewriteOutput.rewrites[rewriteOutput.best_rewrite_index];
    if (bestRewrite && bestRewrite.impact_score > 0.50) {
      finalText = bestRewrite.rewritten_segment;
      log.push(`rewrite: type=${bestRewrite.improvement_type} impact=${bestRewrite.impact_score.toFixed(2)}`);
    } else {
      log.push(`rewrite_skipped: low_impact=${bestRewrite?.impact_score?.toFixed(2) ?? 'n/a'}`);
    }
  } catch {
    log.push('rewrite_error: skipped (non-blocking)');
  }

  // ── Step 3: Creative DNA injection into kling_prompt ──────────────────────
  let dnaInjected = false;
  if (ctx.dnaContext) {
    klingPrompt = `${scene.kling_prompt}\n\n[CREATIVE DNA BIAS]\n${ctx.dnaContext}`;
    dnaInjected = true;
    log.push('dna_injected: creative DNA appended to kling_prompt');
  }

  return {
    ...scene,
    kling_prompt:     klingPrompt,
    overlay_text:     finalText,
    boosted_hook:     boostedHook,
    rewritten_text:   finalText,
    dna_injected:     dnaInjected,
    optimization_log: log,
  };
}

// ─── Scene-set optimiser ──────────────────────────────────────────────────────

/**
 * optimizeSceneSet
 *
 * Batch-optimises an array of scenes.
 * DNA context is fetched once and shared across all scenes for consistency.
 */
export function optimizeSceneSet(
  scenes:   RawScene[],
  ctx:      SceneOptimizationContext,
  services: OptimizerServices,
): OptimizedScene[] {
  return scenes.map(scene => optimizeScene(scene, ctx, services));
}

// ─── Blueprint → virtual scene extractor ─────────────────────────────────────

/**
 * blueprintToVirtualScenes
 *
 * Derives a minimal set of virtual scenes from a MasterBlueprint when no
 * explicit CreativePlan scenes are available.
 * Positions are: hook → problem → solution → solution (×n) → cta
 */
export function blueprintToVirtualScenes(blueprint: {
  platform_copy:    { hook: string; core_message: string; value_proposition: string; key_objection: string; cta: string };
  style_dna:        { tone: string; visual_style: string; emotion: string; pacing: string };
  production_stack: { duration_tier?: string };
  angle_slug:       string;
  format:           string;
}): RawScene[] {
  const { platform_copy, style_dna } = blueprint;
  const basePrompt = `${style_dna.visual_style} style, ${style_dna.tone} tone, ${style_dna.emotion} emotion`;

  const scenes: RawScene[] = [
    {
      scene_type:   'hook',
      kling_prompt: `${basePrompt}. Opening hook: grab attention in 3 seconds. Close-up, high energy.`,
      overlay_text: platform_copy.hook,
      transition:   'glitch',
      pacing:       style_dna.pacing === 'fast' ? 'aggressive' : 'moderate',
    },
    {
      scene_type:   'problem',
      kling_prompt: `${basePrompt}. Showing the problem: ${platform_copy.key_objection}. Relatable frustration.`,
      overlay_text: platform_copy.key_objection || platform_copy.core_message,
      transition:   'cut',
      pacing:       'moderate',
    },
    {
      scene_type:   'solution',
      kling_prompt: `${basePrompt}. Revealing the solution: ${platform_copy.value_proposition}. Product in focus.`,
      overlay_text: platform_copy.value_proposition || platform_copy.core_message,
      transition:   'zoom',
      pacing:       'moderate',
    },
    {
      scene_type:   'cta',
      kling_prompt: `${basePrompt}. Call to action. Urgency. Clear brand. White space.`,
      overlay_text: platform_copy.cta,
      transition:   'burst',
      pacing:       'aggressive',
    },
  ];

  return scenes;
}

// ─── CreativePlan → RawScene bridge ──────────────────────────────────────────

import type {
  VideoScene,
  CarouselSlide,
} from '../../creative-director/creative-director-orchestrator';

/**
 * mapScenePosition
 *
 * Assigns a SceneType to a video scene based on its index within the full
 * sequence. Uses boundary + midpoint heuristic:
 *
 *   index 0             → 'hook'
 *   index 1..30% total  → 'problem'
 *   index 31%..last-1   → 'solution'
 *   last index          → 'cta'
 */
function mapScenePosition(index: number, total: number): SceneType {
  if (index === 0)           return 'hook';
  if (index === total - 1)   return 'cta';
  const problemCutoff = Math.max(1, Math.floor(total * 0.30));
  return index <= problemCutoff ? 'problem' : 'solution';
}

/**
 * creativePlanVideoScenesToRaw
 *
 * Maps CreativePlan.video.scenes → RawScene[] so they can flow into
 * optimizeSceneSet() for DNA injection and hook enhancement.
 *
 * Every field is preserved verbatim from the Creative Director's output.
 * No synthetic reconstruction occurs.
 */
export function creativePlanVideoScenesToRaw(scenes: VideoScene[]): RawScene[] {
  return scenes.map((s, i) => ({
    scene_type:   mapScenePosition(i, scenes.length),
    kling_prompt: s.kling_prompt,
    overlay_text: s.overlay_text,
    transition:   s.transition,
    pacing:       s.pacing,
    voiceover:    s.voiceover,
  }));
}

/**
 * creativePlanCarouselSlidesToRaw
 *
 * Maps CreativePlan.carousel.slides → RawScene[] for the optimizer pipeline.
 * Uses the slide's visual_direction as kling_prompt and intent as scene_type.
 */
export function creativePlanCarouselSlidesToRaw(slides: CarouselSlide[]): RawScene[] {
  return slides.map(s => ({
    scene_type:   s.intent as SceneType,
    kling_prompt: s.visual_direction,
    overlay_text: s.headline,
    transition:   'cut',
    pacing:       'moderate' as const,
  }));
}

// ─── Optimised scene context → styleContext string ───────────────────────────

/**
 * scenesToStyleContext
 *
 * Serialises the optimised scene context back into the styleContext string
 * that VideoService / CarouselService / BannerService accept.
 * Enriches the original styleContext with optimised copy and DNA signal.
 */
export function scenesToStyleContext(
  originalStyleContext: string,
  scenes:               OptimizedScene[],
): string {
  const hookScene  = scenes.find(s => s.scene_type === 'hook');
  const ctaScene   = scenes.find(s => s.scene_type === 'cta');
  const dnaApplied = scenes.some(s => s.dna_injected);

  const enrichments: string[] = [];
  if (hookScene?.boosted_hook)    enrichments.push(`boosted_hook:"${hookScene.boosted_hook}"`);
  if (hookScene?.rewritten_text)  enrichments.push(`hook_text:"${hookScene.rewritten_text}"`);
  if (ctaScene?.rewritten_text)   enrichments.push(`cta_text:"${ctaScene.rewritten_text}"`);
  if (dnaApplied)                 enrichments.push('dna:applied');

  return enrichments.length
    ? `${originalStyleContext} | ${enrichments.join(' | ')}`
    : originalStyleContext;
}
