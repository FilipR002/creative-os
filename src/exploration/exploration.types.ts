// ─── 4.5 Adaptive Exploration Engine — Types ─────────────────────────────────

import { AngleFatigueResult } from '../fatigue/fatigue.types';

// ─── Input ────────────────────────────────────────────────────────────────────

export interface ExplorationPressureInput {
  userId?:   string;
  clientId?: string;
  goal?:     string;
  /** How many CreativeMemory records to look back over (default 30). */
  lookback?: number;
  /**
   * Pre-loaded 4.4 fatigue results from the calling context.
   * When provided, ExplorationService skips the FatigueService DB call —
   * preventing redundant queries and data re-use that would constitute double-counting.
   */
  preloadedFatigue?: Map<string, AngleFatigueResult>;
}

// ─── Signal breakdown ─────────────────────────────────────────────────────────

export interface ExplorationBreakdown {
  /** Normalised memory stagnation contribution (0 – 0.40 max). */
  memory:   number;
  /** Normalised fatigue pressure contribution (0 – 0.35 max). */
  fatigue:  number;
  /** Normalised MIROFISH uncertainty contribution (0 – 0.25 max). */
  mirofish: number;
  /** Fixed base exploration level. */
  base:     0.20;
}

// ─── Output (strict contract from spec) ──────────────────────────────────────

export interface ExplorationPressureResult {
  /** Additive delta applied to the system exploration rate. Range: −0.10 to +0.25. */
  exploration_pressure_delta: number;
  breakdown:                  ExplorationBreakdown;
  /** 0–1 confidence in the computed delta based on data sufficiency + signal agreement. */
  confidence:                 number;
  /** Human-readable diagnostic flags. No decision authority. */
  risk_flags:                 string[];
}

// ─── Internal raw signals (engine-internal, not in output) ───────────────────

export interface ExplorationRawSignals {
  memorySignal:   number;   // 0–1
  fatigueSignal:  number;   // 0–1 (BLOCKED angles excluded per spec)
  mirofishSignal: number;   // 0–1 (from learningSignalStrength, not predictionError)
  memoryRecordCount:   number;
  mirofishRecordCount: number;
  fatigueAngleCount:   number;
}
