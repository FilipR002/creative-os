/**
 * model-router.ts
 *
 * Decides the EXECUTION MODE (ugc | cinematic | hybrid) and assigns render
 * engines (kling | veo | mixed) per scene.
 *
 * ─── Architecture note ────────────────────────────────────────────────────────
 * Kling and Veo are NOT paradigm-specific engines.
 * They are UNIVERSAL render engines with different technical strengths:
 *   - Kling  → reliable motion control, fast iteration
 *   - Veo    → cinematic depth, camera language, lighting
 *
 * Either engine can execute either mode. The routing layer decides based on
 * campaign signals, NOT on a hardcoded kling=UGC / veo=cinematic rule.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Routing signal priority:
 *   1. Platform  (tiktok → ugc;  youtube → cinematic;  instagram → balanced)
 *   2. Hook aggressiveness  (high → ugc;  low → cinematic)
 *   3. Pacing    (aggressive → ugc;  moderate → cinematic)
 *   4. Campaign goal  (conversion → platform-led;  awareness → cinematic)
 *   5. Risk tolerance  (> 0.55 → hybrid;  ≤ 0.40 → exploit known mode)
 *
 * Pure function — no NestJS, no I/O, fully testable.
 */

import type { RoutingDecision } from '../../routing/smart/routing.types';

// ─── Public types ──────────────────────────────────────────────────────────────

/** Execution mode — WHAT kind of creative experience to produce */
export type ExecutionMode = 'ugc' | 'cinematic' | 'hybrid';

/** Render engine — WHICH engine(s) execute the scenes */
export type RenderEngine = 'kling' | 'veo' | 'mixed';

export type SceneType = 'hook' | 'problem' | 'solution' | 'cta';

export interface SceneModelInput {
  /** Narrative position of this scene */
  scene_type: SceneType;
  /** From style_dna */
  pacing:     'aggressive' | 'moderate';
  /** Target platform — primary routing signal */
  platform?:  string;
  /** Primary emotion from concept */
  emotion:    string;
}

export interface ModelDecision {
  /** The execution mode for this scene */
  mode:       ExecutionMode;
  /** The render engine best suited for this mode + scene */
  model:      RenderEngine;
  confidence: number;   // 0–1
  reasoning:  string;
}

// ─── Platform → mode map ──────────────────────────────────────────────────────

const PLATFORM_MODE: Record<string, ExecutionMode> = {
  tiktok:    'ugc',
  instagram: 'hybrid',
  facebook:  'hybrid',
  youtube:   'cinematic',
  display:   'cinematic',
  ctv:       'cinematic',
  ads:       'hybrid',
};

function platformToMode(platform: string | undefined): ExecutionMode | null {
  if (!platform) return null;
  return PLATFORM_MODE[platform.toLowerCase()] ?? null;
}

// ─── Engine assignment ────────────────────────────────────────────────────────

/**
 * Each engine is assigned to the mode where its strengths are most relevant.
 * Assignment is a recommendation — the execution layer may override it.
 *
 * ugc      → kling (primary: motion control, authentic feel)
 * cinematic → veo  (primary: depth, lighting, camera language)
 * hybrid   → mixed (both engines used across scenes)
 */
function modeToEngine(mode: ExecutionMode): RenderEngine {
  switch (mode) {
    case 'ugc':       return 'kling';
    case 'cinematic': return 'veo';
    case 'hybrid':    return 'mixed';
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * decideMode
 *
 * Maps scene metadata + SmartRoutingService decision → execution mode + engine.
 *
 * Signal priority:
 *  1. Risk tolerance > 0.55 → hybrid (high-risk = explore both modes)
 *  2. Platform signal (tiktok/youtube/etc.)
 *  3. Hook aggressiveness (high → ugc; low → cinematic)
 *  4. Scene type + pacing (hook/aggressive → ugc; solution/moderate → cinematic)
 */
export function decideMode(
  scene:   SceneModelInput,
  routing: RoutingDecision,
): ModelDecision {
  const { mode: routingMode, hookAggressiveness, riskTolerance } = routing;

  // ── Signal 1: High risk tolerance → hybrid ───────────────────────────────
  if (riskTolerance > 0.55 && routingMode !== 'exploit') {
    return {
      mode:       'hybrid',
      model:      'mixed',
      confidence: 0.70,
      reasoning:  `Risk tolerance ${riskTolerance.toFixed(2)} > 0.55 in ${routingMode} mode — hybrid execution selected`,
    };
  }

  // ── Signal 2: Platform-driven decision ───────────────────────────────────
  const platformMode = platformToMode(scene.platform);
  if (platformMode && routingMode !== 'exploit') {
    const engine = modeToEngine(platformMode);
    return {
      mode:       platformMode,
      model:      engine,
      confidence: 0.82,
      reasoning:  `Platform "${scene.platform}" maps to ${platformMode} mode → ${engine}`,
    };
  }

  // ── Signal 3: Hook aggressiveness ────────────────────────────────────────
  if (hookAggressiveness === 'high' && (scene.scene_type === 'hook' || scene.scene_type === 'problem')) {
    return {
      mode:       'ugc',
      model:      'kling',
      confidence: 0.75,
      reasoning:  `High hook aggressiveness on ${scene.scene_type} scene → ugc mode (kling)`,
    };
  }

  if (hookAggressiveness === 'low' && (scene.scene_type === 'solution' || scene.scene_type === 'cta')) {
    return {
      mode:       'cinematic',
      model:      'veo',
      confidence: 0.72,
      reasoning:  `Low aggressiveness on ${scene.scene_type} scene → cinematic mode (veo)`,
    };
  }

  // ── Signal 4: Scene type + pacing fallback ────────────────────────────────
  const isUGCSignal = (
    scene.pacing === 'aggressive' ||
    scene.scene_type === 'hook' ||
    scene.scene_type === 'problem'
  );

  if (isUGCSignal) {
    return {
      mode:       'ugc',
      model:      'kling',
      confidence: 0.65,
      reasoning:  `Scene type=${scene.scene_type}, pacing=${scene.pacing} → ugc mode (kling)`,
    };
  }

  return {
    mode:       'cinematic',
    model:      'veo',
    confidence: 0.65,
    reasoning:  `Scene type=${scene.scene_type}, pacing=${scene.pacing} → cinematic mode (veo)`,
  };
}

// ─── Backward-compat alias ────────────────────────────────────────────────────
/** @deprecated Use decideMode() — decideModel() will be removed in a future version */
export const decideModel = decideMode;

// ─── Aggregate helper ─────────────────────────────────────────────────────────

export interface ModeUsageStats {
  ugc:       number;
  cinematic: number;
  hybrid:    number;
}

/**
 * tallyModeUsage
 *
 * Summarises per-scene mode decisions into a { ugc, cinematic, hybrid } count
 * used in the PipelineResult response.
 */
export function tallyModeUsage(decisions: ModelDecision[]): ModeUsageStats {
  return decisions.reduce(
    (acc, d) => { acc[d.mode]++; return acc; },
    { ugc: 0, cinematic: 0, hybrid: 0 } as ModeUsageStats,
  );
}

/** @deprecated Use tallyModeUsage() */
export const tallyModelUsage = (decisions: ModelDecision[]) => tallyModeUsage(decisions);

/** @deprecated — kept for type compatibility; use ModeUsageStats */
export type ModelUsageStats = ModeUsageStats;
