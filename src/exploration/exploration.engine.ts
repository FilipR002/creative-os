// ─── 4.5 Adaptive Exploration Engine — Pure Computation ──────────────────────
//
// No dependency injection. No Prisma. No side effects.
// Receives pre-normalised 0–1 signals. Returns ExplorationPressureResult.
//
// FINAL FORMULA:
//   contributions = {
//     memory:   memorySignal   × 0.40  (capped at 0.40)
//     fatigue:  fatigueSignal  × 0.35  (capped at 0.35)
//     mirofish: mirofishSignal × 0.25  (capped at 0.25)
//   }
//   if sum(contributions) > 1.0 → normalise proportionally (anti-drift)
//
//   exploration_pressure_delta = clamp(sum − BASE, −0.10, +0.25)
//   where BASE = 0.20
//
// ANTI-DOUBLE-COUNTING GUARANTEES (enforced by data sourcing in the service):
//   memory   signal → from CreativeMemory stagnation metrics (no MIROFISH data)
//   fatigue  signal → from 4.4 exploration_signal (BLOCKED excluded; already absorbs
//                     mirofishNegativeDelta internally — not re-applied here)
//   mirofish signal → from MirofishSignal.learningSignalStrength ONLY
//                     (NOT predictionError, which 4.4 already uses)
// ─────────────────────────────────────────────────────────────────────────────

import {
  ExplorationBreakdown,
  ExplorationPressureResult,
  ExplorationRawSignals,
} from './exploration.types';

// ─── Constants ────────────────────────────────────────────────────────────────

const BASE_EXPLORATION = 0.20 as const;

/** Maximum contribution caps per signal (must sum to 1.0). */
const MAX_CONTRIB = {
  memory:   0.40,
  fatigue:  0.35,
  mirofish: 0.25,
} as const;

const DELTA_MIN = -0.10;
const DELTA_MAX = +0.25;

// ─── Step 1: Signal normalisers ───────────────────────────────────────────────

/**
 * Memory stagnation signal (0–1) from CreativeMemory records.
 *
 * Driving factors:
 *   - Performance not improving (plateau / decline) → higher signal
 *   - Repeated winning angle → dampens signal (system is working — don't explore)
 *   - Low angle diversity in recent campaigns → raises signal
 *   - New user (< 5 records) → high exploration recommended
 */
export function computeMemorySignal(
  records: { angle: string; totalScore: number; isWinner: boolean }[],
): number {
  if (records.length === 0) return 0.60;   // no data → lean toward exploration
  if (records.length < 5)  return 0.55;   // minimal data → slightly elevated

  const scores5  = records.slice(0, 5).map(r => r.totalScore);
  const scores10 = records.slice(5, 10).map(r => r.totalScore);

  // Performance trend — stagnation or decline raises exploration need
  let stagnationScore = 0.30; // neutral baseline when no prior window
  if (scores10.length >= 3) {
    const change = avg(scores5) - avg(scores10);
    if (change < -0.05)           stagnationScore = 0.70; // declining
    else if (Math.abs(change) < 0.02) stagnationScore = 0.50; // plateauing
    else                          stagnationScore = 0.15; // improving
  }

  // Repeated winner (same angle wins ≥ 3 of last 5) → stable → dampen exploration
  const recentWinnerSlugs = records
    .slice(0, 5)
    .filter(r => r.isWinner)
    .map(r => r.angle);
  const winnerFreq = countFreq(recentWinnerSlugs);
  const repeatedWinner = Object.values(winnerFreq).some(c => c >= 3);
  const winnerMod = repeatedWinner ? -0.30 : 0;

  // Low angle diversity (≤ 2 unique angles in last 8 runs) → raise exploration
  const uniqueAngles = new Set(records.slice(0, 8).map(r => r.angle)).size;
  const diversityMod = uniqueAngles <= 2 ? +0.25 : 0;

  return clamp(stagnationScore + winnerMod + diversityMod);
}

/**
 * Fatigue pressure signal (0–1) derived from 4.4 exploration_signal outputs.
 *
 * BLOCKED angles are excluded per spec ("BLOCKED → NO direct impact").
 * Uses the pre-computed exploration_signal [0, 0.25] from 4.4 — normalised to [0, 1].
 * This means mirofishNegativeDelta is absorbed here via 4.4's internal formula;
 * it must NOT be re-applied in computeMirofishSignal (double-count prevention).
 */
export function computeFatigueSignal(
  explorationSignals: number[],   // per-angle exploration_signal from non-BLOCKED 4.4 results
): number {
  if (explorationSignals.length === 0) return 0;
  // 4.4 exploration_signal max is 0.25 → divide to normalise to [0, 1]
  const normalised = explorationSignals.map(s => clamp(s / 0.25));
  return avg(normalised);
}

/**
 * MIROFISH uncertainty signal (0–1) from learningSignalStrength.
 *
 * Uses learningSignalStrength ONLY — not predictionError (which 4.4 already uses).
 * HIGH strength = confident predictions = LOWER exploration need.
 * LOW / null  strength = uncertain = HIGHER exploration need.
 *
 * Baseline when no MIROFISH data: 0.50 (mild uncertainty — system is learning).
 */
export function computeMirofishSignal(
  learningStrengths: (number | null)[],
): number {
  const valid = learningStrengths.filter((s): s is number => s !== null && s >= 0 && s <= 1);
  if (valid.length === 0) return 0.50;     // no data → neutral uncertainty
  return clamp(1 - avg(valid));            // invert: high confidence → low signal
}

// ─── Step 2: Contribution aggregation with anti-drift normalisation ───────────

export function aggregateContributions(
  memorySignal:   number,
  fatigueSignal:  number,
  mirofishSignal: number,
): ExplorationBreakdown {
  // Apply per-signal contribution caps
  let memory   = memorySignal   * MAX_CONTRIB.memory;
  let fatigue  = fatigueSignal  * MAX_CONTRIB.fatigue;
  let mirofish = mirofishSignal * MAX_CONTRIB.mirofish;

  // Anti-drift: if total somehow exceeds 1.0, scale proportionally
  const total = memory + fatigue + mirofish;
  if (total > 1.0) {
    const scale = 1.0 / total;
    memory   *= scale;
    fatigue  *= scale;
    mirofish *= scale;
  }

  return {
    memory:   round4(memory),
    fatigue:  round4(fatigue),
    mirofish: round4(mirofish),
    base:     BASE_EXPLORATION,
  };
}

// ─── Step 3: Delta computation ────────────────────────────────────────────────

export function computePressureDelta(breakdown: ExplorationBreakdown): number {
  const sum = breakdown.memory + breakdown.fatigue + breakdown.mirofish;
  return round4(clamp(sum - BASE_EXPLORATION, DELTA_MIN, DELTA_MAX));
}

// ─── Step 4: Confidence ───────────────────────────────────────────────────────

export function computeConfidence(raw: ExplorationRawSignals): number {
  // Data sufficiency contribution
  const memSuf  = clamp(raw.memoryRecordCount   / 20) * 0.40;
  const miroSuf = clamp(raw.mirofishRecordCount / 10) * 0.25;
  const fatSuf  = clamp(raw.fatigueAngleCount   / 5)  * 0.20;

  // Signal agreement bonus (all three signals pointing same direction)
  const allRaise = raw.memorySignal > 0.55 && raw.fatigueSignal > 0.45 && raw.mirofishSignal > 0.45;
  const allLower = raw.memorySignal < 0.25 && raw.fatigueSignal < 0.20 && raw.mirofishSignal < 0.25;
  const agreementBonus = (allRaise || allLower) ? 0.15 : 0;

  return round4(clamp(memSuf + miroSuf + fatSuf + agreementBonus));
}

// ─── Step 5: Risk flags ───────────────────────────────────────────────────────

export function detectRiskFlags(
  raw:   ExplorationRawSignals,
  delta: number,
): string[] {
  const flags: string[] = [];

  if (raw.memoryRecordCount   < 5)  flags.push('LOW_MEMORY_DATA');
  if (raw.mirofishRecordCount === 0) flags.push('MIROFISH_MISSING');
  if (raw.fatigueAngleCount   === 0) flags.push('FATIGUE_DATA_MISSING');
  if (delta >= DELTA_MAX)            flags.push('AT_MAX_PRESSURE');
  if (delta <= DELTA_MIN)            flags.push('AT_MIN_PRESSURE');

  // High fatigue pressure (fatigue signal dominated the result)
  if (raw.fatigueSignal > 0.75)     flags.push('HIGH_FATIGUE_PRESSURE');

  // Signal conflict: memory and MIROFISH pointing in opposite directions
  const memHigh  = raw.memorySignal   > 0.60;
  const miroLow  = raw.mirofishSignal < 0.25;
  const memLow   = raw.memorySignal   < 0.25;
  const miroHigh = raw.mirofishSignal > 0.65;
  if ((memHigh && miroLow) || (memLow && miroHigh)) flags.push('SIGNAL_CONFLICT');

  return flags;
}

// ─── Full computation entry-point ─────────────────────────────────────────────

export function computeExplorationPressure(raw: ExplorationRawSignals): ExplorationPressureResult {
  const breakdown = aggregateContributions(raw.memorySignal, raw.fatigueSignal, raw.mirofishSignal);
  const delta     = computePressureDelta(breakdown);
  const conf      = computeConfidence(raw);
  const flags     = detectRiskFlags(raw, delta);

  return {
    exploration_pressure_delta: delta,
    breakdown,
    confidence:  conf,
    risk_flags:  flags,
  };
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function clamp(v: number, lo = 0, hi = 1): number { return Math.min(hi, Math.max(lo, v)); }
function avg(arr: number[]): number {
  return arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
}
function round4(n: number): number { return Math.round(n * 10000) / 10000; }
function countFreq(items: string[]): Record<string, number> {
  return items.reduce((a, x) => { a[x] = (a[x] ?? 0) + 1; return a; }, {} as Record<string, number>);
}
