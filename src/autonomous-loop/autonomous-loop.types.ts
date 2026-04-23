// ─── Phase 8.4 — Autonomous Loop Controller — Types ──────────────────────────

export type TriggeredAction =
  | { type: 'EVOLUTION_TRIGGERED';   reason: string }
  | { type: 'EXPLORATION_BOOSTED';   from: number; to: number }
  | { type: 'EXPLORATION_REDUCED';   from: number; to: number };

export interface ALCState {
  userId:             string;
  weakAngles:         string[];
  strongAngles:       string[];
  stagnatingAngles:   string[];
  explorationRatio:   number;
  systemEntropyScore: number;
  cycleCount:         number;
  lastEvaluatedAt:    Date;
}

export interface WeightSnapshot {
  capturedAt: Date;
  weights:    Record<string, number>;
}
