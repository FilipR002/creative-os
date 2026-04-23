// ─── Frontend ViewModels — mirrors src/product/view-models/decision.view-model.ts ─

export interface SignalBreakdown {
  memory:      number;
  scoring:     number;
  mirofish:    number;
  blending:    number;
  exploration: number;
}

export interface DecisionExplanation {
  memoryInfluence:      number;
  scoringInfluence:     number;
  mirofishInfluence:    number;
  blendingInfluence:    number;
  explorationInfluence: number;
  finalReasoning:       string;
  confidenceNote:       string;
}

export type FatigueLevel = 'HEALTHY' | 'WARMING' | 'FATIGUED' | 'BLOCKED';
export type StabilityState = 'stable' | 'warming' | 'unstable';

export interface DecisionViewModel {
  angle:        string;
  score:        number;
  confidence:   number;
  fatigueLevel: FatigueLevel;
  rankPosition: number;
  explanation:  DecisionExplanation;
  breakdown:    SignalBreakdown;
}

export interface ConflictSummary {
  description:  string;
  resolution:   string;
  winner:       string;
}

export interface DecisionPageViewModel {
  primaryAngle:    string;
  secondaryAngle:  string | null;
  stabilityState:  StabilityState;
  angles:          DecisionViewModel[];
  conflicts:       ConflictSummary[];
  systemReasoning: string;
  meta: {
    anglesEvaluated:   number;
    conflictsDetected: number;
    mirofishOverruled: number;
    computationMs:     number;
  };
}

// ── Memory snapshot ────────────────────────────────────────────────────────────

export interface MemorySnapshot {
  angle_memory_updates:    unknown[];
  hook_memory_updates:     unknown[];
  campaign_memory_updates: unknown[];
  system_memory_updates:   unknown[];
  insights:                string[];
}

// ── System status ──────────────────────────────────────────────────────────────

export interface SystemStatus {
  angles_active:    number;
  system_stability: StabilityState;
  learning_active:  boolean;
  mirofish_active:  boolean;
  timestamp:        string;
}
