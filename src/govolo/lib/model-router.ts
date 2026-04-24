/**
 * model-router.ts
 *
 * Determines which AI video model (Kling | Veo) to use for each scene by
 * mapping the SmartRoutingService decision onto scene-level signals.
 *
 * Pure function — no NestJS, no I/O, fully testable.
 *
 * Mapping logic:
 *   ┌──────────────┬──────────────────┬─────────────────────────┬────────────┐
 *   │ routing.mode │ scene_type       │ hookAggressiveness      │ model      │
 *   ├──────────────┼──────────────────┼─────────────────────────┼────────────┤
 *   │ exploit      │ any              │ any                     │ kling      │
 *   │ explore      │ any              │ any                     │ veo        │
 *   │ balanced     │ hook / problem   │ high                    │ veo        │
 *   │ balanced     │ hook / problem   │ low / medium            │ kling      │
 *   │ balanced     │ solution / cta   │ any                     │ kling      │
 *   └──────────────┴──────────────────┴─────────────────────────┴────────────┘
 *
 * Pacing modifier:
 *   aggressive pacing → bias toward veo (more dynamic)
 *   moderate pacing   → no change
 */

import type { RoutingDecision } from '../../routing/smart/routing.types';

// ─── Public types ──────────────────────────────────────────────────────────────

export type VideoModel = 'kling' | 'veo';

export type SceneType = 'hook' | 'problem' | 'solution' | 'cta';

export interface SceneModelInput {
  /** Narrative position of this scene */
  scene_type:  SceneType;
  /** From style_dna */
  pacing:      'aggressive' | 'moderate';
  /** Primary emotion — used to break balanced ties */
  emotion:     string;
}

export interface ModelDecision {
  model:      VideoModel;
  confidence: number;  // 0–1
  reason:     string;
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * decideModel
 *
 * Maps a SmartRoutingService decision + scene metadata → video model choice.
 * Call once per scene; aggregate results to build modelUsage stats.
 */
export function decideModel(
  scene:    SceneModelInput,
  routing:  RoutingDecision,
): ModelDecision {
  const { mode, hookAggressiveness, riskTolerance } = routing;

  // ── Deterministic overrides ────────────────────────────────────────────────
  if (mode === 'exploit') {
    return {
      model:      'kling',
      confidence: 0.90,
      reason:     'Exploit mode — proven model selected for maximum reliability',
    };
  }

  if (mode === 'explore') {
    return {
      model:      'veo',
      confidence: 0.80,
      reason:     'Explore mode — experimental model selected to surface novel patterns',
    };
  }

  // ── Balanced mode: scene-type + aggressiveness heuristic ──────────────────
  const isAttentionScene = scene.scene_type === 'hook' || scene.scene_type === 'problem';
  const needsDynamic = (
    (isAttentionScene && hookAggressiveness === 'high') ||
    (scene.pacing === 'aggressive' && riskTolerance > 0.55)
  );

  if (needsDynamic) {
    return {
      model:      'veo',
      confidence: 0.65 + riskTolerance * 0.15,
      reason:     `Balanced + ${hookAggressiveness} hooks on ${scene.scene_type} scene → veo for dynamic energy`,
    };
  }

  return {
    model:      'kling',
    confidence: 0.70,
    reason:     `Balanced mode, ${scene.scene_type} scene — kling for clarity and execution reliability`,
  };
}

// ─── Aggregate helper ─────────────────────────────────────────────────────────

export interface ModelUsageStats {
  kling: number;
  veo:   number;
}

/**
 * tallyModelUsage
 *
 * Summarises per-scene model decisions into a { kling, veo } count object
 * used in the PipelineResult response.
 */
export function tallyModelUsage(decisions: ModelDecision[]): ModelUsageStats {
  return decisions.reduce(
    (acc, d) => {
      acc[d.model]++;
      return acc;
    },
    { kling: 0, veo: 0 } as ModelUsageStats,
  );
}
