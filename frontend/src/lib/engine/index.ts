// ─── Real Impact Architecture Layer — Unified Engine API ─────────────────────
// v2: Self-Learning Loop integrated.
//
// FULL DATA FLOW:
//
//   UserContext (onboarding) + userId
//        │
//        ├─→ [1] deriveUserBehaviorProfile(userId, ctx)     → decision_style_vector
//        ├─→ [2] computeBehaviorModifiers(angles, profile)  → per-angle behavior mods
//        ├─→ [3] deriveExplorationProfile(userId, ctx)      → exploration_bias etc.
//        │
//        │   ← SELF-LEARNING LAYER (NEW) →
//        ├─→ [4] loadLearningState(userId)                  → UserLearningState
//        ├─→ [5] getAllLearnedModifiers(state)              → per-angle learned mods
//        ├─→ [6] getAdaptiveDeltas(state)                  → adaptive profile deltas
//        ├─→ [7] getGlobalLearningSignal()                 → k-anon global signals
//        │
//   Backend raw SelectedAngle[] (generic base scores)
//        │
//        ↓
//   [8]  applyContextRanking(angles, ctx, behaviorMods × learnedMods)
//            → ContextRankedAngle[] (scores = base × context × behavior × learned)
//        │
//        ↓
//   [9]  applyExplorationLayer (explore slot)
//            → ExplorationScore = base × (explorationBias + adaptiveDelta) × fatigue × novelty
//        │
//        ↓
//   [10] applyGlobalSignalBoost
//            → gentle nudge from system-level angle performance (k-anon gated)
//        │
//        ↓
//   RankedAngle[] — deterministic per session, personalised, behaviourally isolated,
//                   and continuously evolving with each interaction.
//
// AFTER EACH USER ACTION:
//   buildOutcome() → storeOutcome() + contributeToGlobalSignals()
//   → applyOutcomeToLearningState() → saveLearningState()
//   (Next session loads updated state → scores shift accordingly)

import type { UserContext }    from '../user-context';
import type { SelectedAngle }  from '../types/creator';
import type { ContextRankedAngle } from './context-ranking';

import { deriveUserBehaviorProfile, computeBehaviorModifiers } from './behavior-profile';
import { deriveExplorationProfile, computeExplorationScore }   from './exploration-profile';
import { applyContextRanking }                                  from './context-ranking';
import { loadLearningState, getAllLearnedModifiers, getAdaptiveDeltas } from './learning-store';
import { getGlobalLearningSignal }                              from './global-signals';

// ── Re-exports ────────────────────────────────────────────────────────────────

export type { ExplorationProfile }       from './exploration-profile';
export type { UserBehaviorProfile }      from './behavior-profile';
export type { ContextModifierBreakdown, ContextRankedAngle } from './context-ranking';
export type { UserLearningState, LearningDiagnostics }       from './learning-store';
export type { InteractionOutcome, UserAction }                from './interaction-outcome';
export type { GlobalLearningSignal }                          from './global-signals';

export { deriveExplorationProfile }  from './exploration-profile';
export { deriveUserBehaviorProfile } from './behavior-profile';
export { loadLearningState, saveLearningState, applyOutcomeToLearningState, getLearningDiagnostics } from './learning-store';
export { storeOutcome, buildOutcome, loadOutcomes }    from './interaction-outcome';
export { contributeToGlobalSignals, getGlobalLearningSignal } from './global-signals';

// ── Output Type ───────────────────────────────────────────────────────────────

export interface RankedAngle extends ContextRankedAngle {
  personalizedScore: number;
  behaviorModifier:  number;
  learnedModifier:   number;    // ← NEW: learned from past interactions
  explorationScore:  number;
  globalSignalBoost: number;    // ← NEW: k-anon global nudge

  engineMeta: {
    explorationBias:      number;
    behaviorSignature:    number;
    learningCurve:        number;
    rankingVersion:       string;
    originalScore:        number;
    learningInteractions: number;  // ← NEW: how many outcomes trained this
  };
}

// ── Main Engine Function ──────────────────────────────────────────────────────

const GLOBAL_SIGNAL_WEIGHT = 0.06;  // global signals nudge at most ±6% — never dominate

/**
 * applyRealImpactLayer — complete pipeline including self-learning.
 *
 * Session-deterministic: scores are stable within a session.
 * Cross-session adaptive: loadLearningState reads the latest learned weights.
 */
export function applyRealImpactLayer(
  rawAngles: SelectedAngle[],
  userId:    string,
  ctx:       UserContext
): RankedAngle[] {
  if (rawAngles.length === 0) return [];

  // Preserve original backend scores
  const originalScores = Object.fromEntries(
    rawAngles.map(a => [a.angle, a.confidence_score])
  );

  // ── 1–3: Deterministic profile derivation ────────────────────────────────
  const behaviorProfile    = deriveUserBehaviorProfile(userId, ctx);
  const behaviorModifiers  = computeBehaviorModifiers(rawAngles, behaviorProfile);
  const explorationProfile = deriveExplorationProfile(userId, ctx);

  // ── 4–6: Self-learning state ─────────────────────────────────────────────
  const learningState  = loadLearningState(userId);
  const learnedMods    = getAllLearnedModifiers(learningState);
  const adaptiveDeltas = getAdaptiveDeltas(learningState);

  // Merge behavior + learned modifiers (multiplicative)
  const combinedBehaviorMods: Record<string, number> = {};
  rawAngles.forEach(a => {
    const bm = behaviorModifiers[a.angle] ?? 1.0;
    const lm = learnedMods[a.angle]       ?? 1.0;
    combinedBehaviorMods[a.angle] = bm * lm;
  });

  // ── 7: Global signal lookup (k-anon protected) ───────────────────────────
  const globalSignal = getGlobalLearningSignal();

  // ── 8: Context-aware ranking (with combined modifiers) ───────────────────
  const contextRanked = applyContextRanking(rawAngles, ctx, combinedBehaviorMods);

  // ── 9–10: Exploration + global signal layer ───────────────────────────────
  // Adaptive exploration bias = base + delta from learning state
  const adaptedExploreProfile = {
    ...explorationProfile,
    exploration_bias: clamp(
      explorationProfile.exploration_bias + adaptiveDeltas.exploration_bias_delta,
      0.05, 0.95
    ),
    risk_tolerance: clamp(
      explorationProfile.risk_tolerance + adaptiveDeltas.risk_tolerance_delta,
      0.05, 0.95
    ),
  };

  const SLOT_ORDER: Record<string, number> = { exploit: 0, secondary: 1, explore: 2 };

  const final = contextRanked.map<RankedAngle>(angle => {
    const originalScore = originalScores[angle.angle] ?? angle.confidence_score;
    const learnedMod    = learnedMods[angle.angle]    ?? 1.0;
    const behaviorMod   = behaviorModifiers[angle.angle] ?? 1.0;

    // Exploration slot: use adapted exploration formula
    const explorationScore = angle.type === 'explore'
      ? computeExplorationScore(
          originalScore,
          adaptedExploreProfile,
          angle.fatigue_level,
          angle.fatigue_level === 'HEALTHY'
        )
      : angle.contextScore;

    // Global signal boost (bounded, k-anon gated)
    const globalRate       = globalSignal.angleSuccessRates[angle.angle] ?? 0.5;
    const globalSignalBoost = 1.0 + (globalRate - 0.5) * GLOBAL_SIGNAL_WEIGHT;

    // Final personalized score
    const baseScore = angle.type === 'explore' ? explorationScore : angle.contextScore;
    const personalizedScore = clamp(
      baseScore * globalSignalBoost * adaptiveDeltas.decision_speed_factor,
      0.01, 0.99
    );

    return {
      ...angle,
      confidence_score:  personalizedScore,
      personalizedScore,
      behaviorModifier:  behaviorMod,
      learnedModifier:   learnedMod,
      explorationScore,
      globalSignalBoost,
      engineMeta: {
        explorationBias:      adaptedExploreProfile.exploration_bias,
        behaviorSignature:    behaviorProfile.exploration_signature,
        learningCurve:        behaviorProfile.learning_response_curve,
        rankingVersion:       'real-impact-v2-selflearn',
        originalScore,
        learningInteractions: learningState.interactionCount,
      },
    };
  });

  final.sort((a, b) => {
    const sd = (SLOT_ORDER[a.type] ?? 3) - (SLOT_ORDER[b.type] ?? 3);
    if (sd !== 0) return sd;
    return b.personalizedScore - a.personalizedScore;
  });

  return final;
}

// ── Determinism Fingerprint ───────────────────────────────────────────────────

export function getEngineFingerprint(userId: string, ctx: UserContext): string {
  const bp = deriveUserBehaviorProfile(userId, ctx);
  const ep = deriveExplorationProfile(userId, ctx);
  const ls = loadLearningState(userId);
  return [
    bp.profile_id,
    ep.profile_id,
    ctx.riskLevel[0],
    ctx.contentStyle[0],
    `L${ls.interactionCount}`,
  ].join('::');
}

// ── Utility ───────────────────────────────────────────────────────────────────

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
