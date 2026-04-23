// ─── Weight Resolver ──────────────────────────────────────────────────────────
//
// Pure computation layer for the FINAL_WEIGHT formula and influence normalisation.
//
// FINAL_WEIGHT =
//   (MEMORY_SCORE        × 0.45)
// + (SCORING_ALIGNMENT   × 0.30)
// + (MIROFISH_SIGNAL     × 0.15)
// + (BLENDING_COMPAT     × 0.07)
// + (EXPLORATION_FACTOR  × 0.03)
//
// Normalization rules (from spec):
//   - No single subsystem > 55% of final influence
//   - Memory minimum 40% influence floor
//   - Exploration < 10% baseline (3% nominal)
// ─────────────────────────────────────────────────────────────────────────────

import { AngleSignalBundle, DecisionInfluences } from '../orchestrator.types';

// ─── Base weights (must sum to 1.0) ──────────────────────────────────────────

export const BASE_WEIGHTS = {
  memory:      0.45,
  scoring:     0.30,
  mirofish:    0.15,
  blending:    0.07,
  exploration: 0.03,
} as const;

// ─── Normalization caps ───────────────────────────────────────────────────────

const CAP_ANY_SUBSYSTEM = 0.55;   // no single influence > 55%
const FLOOR_MEMORY      = 0.40;   // memory always minimum 40%
const CAP_EXPLORATION   = 0.10;   // exploration never above 10%

// ─── FINAL_WEIGHT ─────────────────────────────────────────────────────────────

export function computeFinalWeight(b: Pick<AngleSignalBundle,
  'memoryScore' | 'scoringAlignment' | 'mirofishSignal' |
  'blendingCompatibility' | 'explorationFactor'
>): number {
  return clamp(
    b.memoryScore          * BASE_WEIGHTS.memory      +
    b.scoringAlignment     * BASE_WEIGHTS.scoring     +
    b.mirofishSignal       * BASE_WEIGHTS.mirofish    +
    b.blendingCompatibility * BASE_WEIGHTS.blending   +
    b.explorationFactor    * BASE_WEIGHTS.exploration,
  );
}

// ─── Influence normalisation ──────────────────────────────────────────────────
//
// Takes raw component scores and expresses the actual influence each subsystem
// had as a proportion of the final weight (sums to 1.0 after normalisation).
// Applies the cap/floor rules before presenting.

export function normalizeInfluences(b: Pick<AngleSignalBundle,
  'memoryScore' | 'scoringAlignment' | 'mirofishSignal' |
  'blendingCompatibility' | 'explorationFactor'
>): DecisionInfluences {
  // Step 1: Raw contributions (component × base_weight)
  const raw = {
    memory:      b.memoryScore          * BASE_WEIGHTS.memory,
    scoring:     b.scoringAlignment     * BASE_WEIGHTS.scoring,
    mirofish:    b.mirofishSignal       * BASE_WEIGHTS.mirofish,
    blending:    b.blendingCompatibility * BASE_WEIGHTS.blending,
    exploration: b.explorationFactor    * BASE_WEIGHTS.exploration,
  };

  // Step 2: Apply MIROFISH cap (max 15% already guaranteed by base weight;
  // but if overruled, mirofish contribution may be reduced externally).
  raw.exploration = Math.min(raw.exploration, CAP_EXPLORATION);

  // Step 3: Apply memory floor
  const total1 = Object.values(raw).reduce((s, v) => s + v, 0);
  if (total1 <= 0) return defaultInfluences();
  const memShare = raw.memory / total1;
  if (memShare < FLOOR_MEMORY) {
    // Boost memory to floor, reduce others proportionally
    const excess    = FLOOR_MEMORY - memShare;
    const otherSum  = total1 - raw.memory;
    if (otherSum > 0) {
      const scale = Math.max(0, 1 - (excess * total1) / otherSum);
      raw.scoring     *= scale;
      raw.mirofish    *= scale;
      raw.blending    *= scale;
      raw.exploration *= scale;
      raw.memory       = FLOOR_MEMORY * total1;
    }
  }

  // Step 4: Normalise to sum = 1.0
  const total2 = Object.values(raw).reduce((s, v) => s + v, 0);
  if (total2 <= 0) return defaultInfluences();

  const norm: DecisionInfluences = {
    memory:      raw.memory      / total2,
    scoring:     raw.scoring     / total2,
    mirofish:    raw.mirofish    / total2,
    blending:    raw.blending    / total2,
    exploration: raw.exploration / total2,
  };

  // Step 5: Apply universal cap (no subsystem > 55%)
  for (const key of Object.keys(norm) as (keyof DecisionInfluences)[]) {
    if (norm[key] > CAP_ANY_SUBSYSTEM) norm[key] = CAP_ANY_SUBSYSTEM;
  }

  // Step 6: Final re-normalise after capping
  const total3 = Object.values(norm).reduce((s, v) => s + v, 0);
  if (total3 > 0) {
    for (const key of Object.keys(norm) as (keyof DecisionInfluences)[]) {
      norm[key] = norm[key] / total3;
    }
  }

  return norm;
}

export function influencesToBreakdown(inf: DecisionInfluences) {
  return {
    memory_influence:      pct(inf.memory),
    scoring_influence:     pct(inf.scoring),
    mirofish_influence:    pct(inf.mirofish),
    blending_influence:    pct(inf.blending),
    exploration_influence: pct(inf.exploration),
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function defaultInfluences(): DecisionInfluences {
  return { memory: 0.45, scoring: 0.30, mirofish: 0.15, blending: 0.07, exploration: 0.03 };
}

function clamp(v: number): number {
  if (!isFinite(v)) return 0;
  return Math.min(1, Math.max(0, v));
}
function pct(n: number): string   { return `${Math.round(n * 100)}%`; }
