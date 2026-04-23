// ─── 4.4 Angle Fatigue System — Types ────────────────────────────────────────

export type FatigueState = 'HEALTHY' | 'WARMING' | 'FATIGUED' | 'BLOCKED';

// ─── Per-signal breakdown (internal; exposed for debugging / orchestration) ──

export interface FatigueSignals {
  /** How often angle was used in recent memory (0 = never, 1 = saturated). */
  usageFrequency:       number;
  /** Relative performance decline vs historical baseline (0 = none, 1 = collapsed). */
  performanceDecay:     number;
  /** Average magnitude of negative MIROFISH prediction errors (0 = accurate, 1 = badly wrong). */
  mirofishNegativeDelta: number;
  /** How often angle appeared as blend secondary vs total signals (0 = fresh, 1 = stale). */
  blendingRepetition:   number;
  /** Velocity of memory-rank decline, proxied from EWMA smoothedScore drop (0 = stable, 1 = falling fast). */
  rankingDropVelocity:  number;
}

// ─── Output contract (matches spec output format) ────────────────────────────

export interface AngleFatigueResult {
  angle_name:           string;   // angle slug
  fatigue_state:        FatigueState;
  fatigue_score:        number;   // 0–1
  probability_modifier: number;   // −0.60 to +0.10 (multiplicative on confidence)
  exploration_signal:   number;   // −0.10 to +0.25 (additive on exploration rate)
  reasoning:            string;
  /** Raw signal breakdown — consumed by Orchestration Layer. */
  _signals:             FatigueSignals;
}

// ─── Batch input ──────────────────────────────────────────────────────────────

export interface FatigueBatchInput {
  /** Angle slugs to evaluate. */
  slugs:     string[];
  userId?:   string;
  clientId?: string;
  /** How many CreativeMemory records to look back over (default 30). */
  lookback?: number;
}
