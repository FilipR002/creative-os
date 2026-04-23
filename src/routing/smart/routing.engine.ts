// ─── Phase 5.5 — pure deterministic routing engine (no NestJS, no I/O) ───────

import { RoutingContext, RoutingDecision } from './routing.types';

type FatigueState = RoutingContext['fatigueState'];
type Goal         = RoutingContext['goal'];

// ── Guards ────────────────────────────────────────────────────────────────────

function safe(v: number): number {
  return isFinite(v) ? v : 0;
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, safe(v)));
}

// ── Sub-decisions ─────────────────────────────────────────────────────────────

function selectMode(
  fatigueState:       FatigueState,
  memoryStability:    number,
  trendPressure:      number,
  explorationEntropy: number,
): RoutingDecision['mode'] {
  if (fatigueState === 'BLOCKED')                                    return 'exploit';
  if (memoryStability > 0.8 && trendPressure < 0.3)                 return 'exploit';
  if (explorationEntropy > 0.7)                                      return 'explore';
  return 'balanced';
}

function computeVariantCount(
  goal:               Goal,
  trendPressure:      number,
  memoryStability:    number,
  explorationEntropy: number,
): number {
  const base = goal === 'conversion' ? 3 : goal === 'awareness' ? 6 : 4;
  const raw  = base
    + safe(trendPressure)      * 3
    - safe(memoryStability)    * 2
    + safe(explorationEntropy) * 2;
  return clamp(Math.round(raw), 1, 10);
}

function computeBlending(
  goal:            Goal,
  fatigueState:    FatigueState,
  memoryStability: number,
): boolean {
  if (fatigueState === 'FATIGUED')    return false;
  if (memoryStability >= 0.85)        return false;
  if (goal === 'conversion')          return false;
  return true;
}

function computeHookAggressiveness(
  goal:         Goal,
  fatigueState: FatigueState,
  trendPressure: number,
): RoutingDecision['hookAggressiveness'] {
  if (goal === 'conversion' && fatigueState === 'HEALTHY') return 'high';
  if (safe(trendPressure) > 0.7)                           return 'high';
  if (fatigueState === 'WARMING')                          return 'medium';
  if (fatigueState === 'FATIGUED')                         return 'low';
  return 'medium';
}

function computeExplorationRate(
  explorationEntropy: number,
  trendPressure:      number,
  memoryStability:    number,
  mirofishConfidence: number,
): number {
  const raw = 0.2
    + safe(explorationEntropy) * 0.4
    + safe(trendPressure)      * 0.2
    - safe(memoryStability)    * 0.3
    - safe(mirofishConfidence) * 0.2;
  return Math.round(clamp(raw, 0.05, 0.60) * 10_000) / 10_000;
}

function computeRiskTolerance(
  goal:               Goal,
  fatigueState:       FatigueState,
  explorationEntropy: number,
): number {
  // Goal-specific base and range
  const [base, min, max] =
    goal === 'conversion' ? [0.30, 0.20, 0.40] :
    goal === 'awareness'  ? [0.75, 0.60, 0.90] :
                            [0.55, 0.40, 0.70];

  const fatigueDelta: Record<FatigueState, number> = {
    HEALTHY:  0,
    WARMING:  0.05,
    FATIGUED: 0.10,
    BLOCKED:  0.15,
  };

  const raw = base + fatigueDelta[fatigueState] + safe(explorationEntropy) * 0.15;
  return Math.round(clamp(raw, min, max) * 100) / 100;
}

// ── Engine ────────────────────────────────────────────────────────────────────

export class RoutingEngine {
  compute(ctx: RoutingContext): RoutingDecision {
    const mode = selectMode(
      ctx.fatigueState,
      ctx.memoryStability,
      ctx.trendPressure,
      ctx.explorationEntropy,
    );

    const variantCount = computeVariantCount(
      ctx.goal,
      ctx.trendPressure,
      ctx.memoryStability,
      ctx.explorationEntropy,
    );

    const blendingEnabled = computeBlending(
      ctx.goal,
      ctx.fatigueState,
      ctx.memoryStability,
    );

    const hookAggressiveness = computeHookAggressiveness(
      ctx.goal,
      ctx.fatigueState,
      ctx.trendPressure,
    );

    const explorationRate = computeExplorationRate(
      ctx.explorationEntropy,
      ctx.trendPressure,
      ctx.memoryStability,
      ctx.mirofishConfidence,
    );

    const riskTolerance = computeRiskTolerance(
      ctx.goal,
      ctx.fatigueState,
      ctx.explorationEntropy,
    );

    return {
      mode,
      variantCount,
      blendingEnabled,
      hookAggressiveness,
      explorationRate,
      riskTolerance,
    };
  }
}
