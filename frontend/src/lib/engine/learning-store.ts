// ─── Learning Store — Per-User Adaptive State ─────────────────────────────────
// Stores evolved learning state for each user in localStorage.
// This is LOCAL learning — fully isolated per user, no cross-user leakage.
//
// Schema: cos_learning_{userId_prefix}
//
// Lifecycle:
//   1. Load at session start
//   2. Read modifiers during ranking (applyRealImpactLayer)
//   3. Write after each InteractionOutcome
//   4. Sync to backend asynchronously (future — not blocking)

import type { InteractionOutcome, StoredOutcome } from './interaction-outcome';
import {
  loadOutcomes,
  computeAngleMetrics,
  computeUserRates,
} from './interaction-outcome';
import {
  updateMemoryModifier,
  updateExplorationBiasDelta,
  updateRiskToleranceDelta,
  updateConversionPreference,
  applyInertiaGuard,
  classifyOutcome,
  ewma,
  clamp,
} from './weight-evolution';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AngleLearnedState {
  modifier:         number;   // multiplied into final score (0.50–1.45)
  successRate:      number;   // EWMA smoothed success rate
  interactionCount: number;   // times this angle was presented to this user
  lastUpdated:      string;
}

export interface UserLearningState {
  userId:           string;
  schemaVersion:    1;
  interactionCount: number;   // total interactions across all sessions
  lastUpdated:      string;

  // Per-angle learned modifiers (LOCAL — specific to this user's experience)
  angleModifiers: Record<string, AngleLearnedState>;

  // Adaptive deltas on top of the deterministic behavior profile
  adaptiveProfile: {
    exploration_bias_delta:    number;   // added to base exploration_bias
    risk_tolerance_delta:      number;   // added to base risk_tolerance
    decision_speed_factor:     number;   // 1.0 = normal, >1 = prefers fast-result angles
    conversion_preference_map: Record<string, number>;  // contextKey → preference score
  };

  // Rate tracking (EWMA smoothed, session-level signals)
  rates: {
    skipRate:            number;
    conversionRate:      number;
    exploreSelectRate:   number;  // fraction of selections from explore slot
  };
}

// ── Default State ─────────────────────────────────────────────────────────────

function defaultLearningState(userId: string): UserLearningState {
  return {
    userId,
    schemaVersion:    1,
    interactionCount: 0,
    lastUpdated:      new Date().toISOString(),
    angleModifiers:   {},
    adaptiveProfile: {
      exploration_bias_delta:    0.00,
      risk_tolerance_delta:      0.00,
      decision_speed_factor:     1.00,
      conversion_preference_map: {},
    },
    rates: {
      skipRate:          0.50,
      conversionRate:    0.50,
      exploreSelectRate: 0.25,
    },
  };
}

// ── Storage ───────────────────────────────────────────────────────────────────

function storageKey(userId: string): string {
  return `cos_learning_${userId.slice(0, 16)}`;
}

export function loadLearningState(userId: string): UserLearningState {
  if (typeof window === 'undefined') return defaultLearningState(userId);
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return defaultLearningState(userId);
    const parsed = JSON.parse(raw) as UserLearningState;
    // Schema migration guard
    if (parsed.schemaVersion !== 1) return defaultLearningState(userId);
    return parsed;
  } catch { return defaultLearningState(userId); }
}

export function saveLearningState(state: UserLearningState): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(storageKey(state.userId), JSON.stringify({
      ...state,
      lastUpdated: new Date().toISOString(),
    }));
  } catch { /* storage full — silently skip */ }
}

// ── Learning Update ───────────────────────────────────────────────────────────

/**
 * Process one InteractionOutcome and return the updated learning state.
 * This is the core of the self-learning loop.
 *
 * ALL updates are:
 *   - Bounded (no runaway drift)
 *   - EWMA-smoothed (no oscillation)
 *   - Inertia-guarded (no pruning below MIN_INERTIA)
 *   - Deterministic given the same sequence of outcomes
 */
export function applyOutcomeToLearningState(
  state:   UserLearningState,
  outcome: InteractionOutcome
): UserLearningState {
  const newState   = structuredCloneState(state);
  const interactions = newState.interactionCount + 1;
  newState.interactionCount = interactions;

  // ── 1. Classify outcome signal ─────────────────────────────────────────────
  const signal = classifyOutcome({
    selected:   outcome.userAction === 'select' || outcome.userAction === 'convert',
    converted:  outcome.conversionSignal,
    skipped:    outcome.userAction === 'skip'   || outcome.userAction === 'ignore',
    engagement: outcome.engagementScore,
  });

  // ── 2. Update angle modifier for the selected angle (Part A — Memory) ──────
  const current = newState.angleModifiers[outcome.angleSlug] ?? {
    modifier:         1.00,
    successRate:      0.50,
    interactionCount: 0,
    lastUpdated:      '',
  };

  const newMod = applyInertiaGuard(
    updateMemoryModifier(current.modifier, signal, interactions)
  );

  newState.angleModifiers[outcome.angleSlug] = {
    modifier:         newMod,
    successRate:      ewma(
      signal === 'strong_success' || signal === 'success' ? 1.0 : 0.0,
      current.successRate
    ),
    interactionCount: current.interactionCount + 1,
    lastUpdated:      new Date().toISOString(),
  };

  // Soft-decay ignored angles (they were presented but not chosen)
  outcome.ignoredAngles.forEach(slug => {
    const ig = newState.angleModifiers[slug] ?? {
      modifier: 1.00, successRate: 0.50, interactionCount: 0, lastUpdated: '',
    };
    const decayed = updateMemoryModifier(ig.modifier, 'failure', interactions);
    newState.angleModifiers[slug] = {
      modifier:         applyInertiaGuard(decayed),
      successRate:      ewma(0.0, ig.successRate, 0.05),  // very slow decay on skip
      interactionCount: ig.interactionCount + 1,
      lastUpdated:      new Date().toISOString(),
    };
  });

  // ── 3. Update rate tracking ────────────────────────────────────────────────
  const isSelected     = outcome.userAction === 'select' || outcome.userAction === 'convert';
  const isExploreSlot  = outcome.userAction === 'explore';

  newState.rates.skipRate          = ewma(isSelected ? 0 : 1,      newState.rates.skipRate,        0.20);
  newState.rates.conversionRate    = ewma(outcome.conversionSignal ? 1 : 0, newState.rates.conversionRate, 0.15);
  newState.rates.exploreSelectRate = ewma(isExploreSlot ? 1 : 0,   newState.rates.exploreSelectRate, 0.15);

  // ── 4. Update adaptive profile (Part B — Exploration tuning) ──────────────
  newState.adaptiveProfile.exploration_bias_delta = updateExplorationBiasDelta(
    newState.adaptiveProfile.exploration_bias_delta,
    newState.rates.skipRate,
    newState.rates.conversionRate
  );

  newState.adaptiveProfile.risk_tolerance_delta = updateRiskToleranceDelta(
    newState.adaptiveProfile.risk_tolerance_delta,
    newState.rates.exploreSelectRate,
    interactions
  );

  // ── 5. Conversion preference map ──────────────────────────────────────────
  const ctxKey = `${outcome.contextSnapshot.goalType}::${outcome.contextSnapshot.platform}`;
  newState.adaptiveProfile.conversion_preference_map = updateConversionPreference(
    newState.adaptiveProfile.conversion_preference_map,
    ctxKey,
    outcome.conversionSignal,
    interactions
  );

  // ── 6. Decision speed factor ───────────────────────────────────────────────
  // Fast deciders (< 5s) get a slight boost to conversion-angle weight
  const speedSignal = outcome.timeToDecisionMs < 5000 ? 1.05 : 0.98;
  newState.adaptiveProfile.decision_speed_factor = clamp(
    ewma(speedSignal, newState.adaptiveProfile.decision_speed_factor, 0.10),
    0.80, 1.20
  );

  return newState;
}

// ── Learned Modifier Retrieval ─────────────────────────────────────────────────

/**
 * Get the learned modifier for a single angle.
 * Returns 1.0 (neutral) if no history exists.
 */
export function getLearnedModifier(state: UserLearningState, slug: string): number {
  return state.angleModifiers[slug]?.modifier ?? 1.00;
}

/**
 * Get all angle learned modifiers as a flat Record.
 * Used by the ranking engine to apply learning on top of context modifiers.
 */
export function getAllLearnedModifiers(state: UserLearningState): Record<string, number> {
  return Object.fromEntries(
    Object.entries(state.angleModifiers).map(([slug, s]) => [slug, s.modifier])
  );
}

/**
 * Get adaptive exploration profile deltas (added to base ExplorationProfile).
 */
export function getAdaptiveDeltas(state: UserLearningState): {
  exploration_bias_delta: number;
  risk_tolerance_delta:   number;
  decision_speed_factor:  number;
} {
  return {
    exploration_bias_delta: state.adaptiveProfile.exploration_bias_delta,
    risk_tolerance_delta:   state.adaptiveProfile.risk_tolerance_delta,
    decision_speed_factor:  state.adaptiveProfile.decision_speed_factor,
  };
}

// ── Rebuild From History ───────────────────────────────────────────────────────

/**
 * Rebuild learning state by replaying all stored outcomes.
 * Ensures consistency if localStorage learning state is lost / migrated.
 */
export function rebuildLearningState(userId: string): UserLearningState {
  const outcomes = loadOutcomes(userId);
  let state      = defaultLearningState(userId);

  for (const outcome of outcomes) {
    state = applyOutcomeToLearningState(state, outcome);
  }

  return state;
}

// ── Diagnostics ───────────────────────────────────────────────────────────────

export interface LearningDiagnostics {
  interactionCount:    number;
  topAngles:           { slug: string; modifier: number; successRate: number }[];
  skipRate:            number;
  conversionRate:      number;
  explorationBiasNet:  number;   // base + delta
  riskToleranceNet:    number;
  decisionSpeedFactor: number;
}

export function getLearningDiagnostics(
  state: UserLearningState,
  baseExplorationBias: number,
  baseRiskTolerance:   number
): LearningDiagnostics {
  const top = Object.entries(state.angleModifiers)
    .sort(([, a], [, b]) => b.modifier - a.modifier)
    .slice(0, 5)
    .map(([slug, s]) => ({ slug, modifier: s.modifier, successRate: s.successRate }));

  return {
    interactionCount:    state.interactionCount,
    topAngles:           top,
    skipRate:            state.rates.skipRate,
    conversionRate:      state.rates.conversionRate,
    explorationBiasNet:  clamp(baseExplorationBias + state.adaptiveProfile.exploration_bias_delta, 0.05, 0.95),
    riskToleranceNet:    clamp(baseRiskTolerance   + state.adaptiveProfile.risk_tolerance_delta,   0.05, 0.95),
    decisionSpeedFactor: state.adaptiveProfile.decision_speed_factor,
  };
}

// ── Utility ───────────────────────────────────────────────────────────────────

/** Deep clone without JSON.parse overhead on small objects */
function structuredCloneState(state: UserLearningState): UserLearningState {
  return {
    ...state,
    angleModifiers:  { ...state.angleModifiers },
    adaptiveProfile: {
      ...state.adaptiveProfile,
      conversion_preference_map: { ...state.adaptiveProfile.conversion_preference_map },
    },
    rates: { ...state.rates },
  };
}
