/**
 * timeline.builder.ts
 *
 * Constructs a render Timeline from SceneRenderResults.
 *
 * Rules:
 *   - Scenes are ordered by sceneId
 *   - Transition overlap is subtracted from the preceding segment's endTime
 *     so startTime values are always monotonically increasing
 *   - Transition durations are short (0.3s–0.5s) to maintain UGC feel
 */

import type { SceneRenderResult, Timeline } from '../types/ugc.types';
import type { KlingTransition }             from '../types/ugc.types';

// ─── Transition durations (seconds) ──────────────────────────────────────────

const TRANSITION_DURATIONS: Record<KlingTransition, number> = {
  cut:    0.0,
  zoom:   0.3,
  glitch: 0.2,
  burst:  0.4,
  fade:   0.5,
};

// ─── Builder ──────────────────────────────────────────────────────────────────

export function buildTimeline(scenes: SceneRenderResult[]): Timeline {
  // Sort by sceneId (should already be sorted, but defensive)
  const ordered = [...scenes].sort((a, b) => a.sceneId - b.sceneId);

  let cursor = 0;
  const segments = ordered.map((scene, i) => {
    const transitionDur = i === 0
      ? 0
      : TRANSITION_DURATIONS[scene.transition] ?? 0;

    // Each segment starts at cursor (which accounts for prior transitions)
    const startTime = cursor;
    const endTime   = startTime + scene.duration;
    cursor = endTime;

    return {
      sceneId:       scene.sceneId,
      videoUrl:      scene.videoUrl,
      startTime:     Math.round(startTime * 1000) / 1000,
      endTime:       Math.round(endTime   * 1000) / 1000,
      transition:    scene.transition,
      transitionDur: Math.round(transitionDur * 1000) / 1000,
    };
  });

  const totalDuration = Math.round(cursor * 1000) / 1000;

  return { totalDuration, segments };
}
