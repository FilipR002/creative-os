// ─── Decision Orchestration Layer — Types ────────────────────────────────────

/** All signal components for one angle, loaded from every subsystem. */
export interface AngleSignalBundle {
  angleId:     string;
  slug:        string;
  label:       string;
  description: string | null;
  source:      string;
  isActive:    boolean;
  // ── Subsystem signal scores (all 0–1) ─────────────────────────────────────
  /** 4.2 EWMA smoothedScore from AngleWeight (global context). Memory truth anchor. */
  memoryScore:           number;
  /** Normalized win-rate + avg-actual-score from LearningCycle history. */
  scoringAlignment:      number;
  /** MIROFISH overall_score × historical prediction accuracy. Advisory only. */
  mirofishSignal:        number;
  /** Best synergy score with any valid partner. 0.5 if no candidate. */
  blendingCompatibility: number;
  /** Low-usage boost or stagnation boost. 0.5 baseline. */
  explorationFactor:     number;
  // ── Computed ──────────────────────────────────────────────────────────────
  finalWeight:           number;
  rankPosition:          number;   // 1-based after sorting
  // ── Metadata ─────────────────────────────────────────────────────────────
  sampleCount:           number;
  winCount:              number;
  fatigueLevel:          'HEALTHY' | 'WARMING' | 'FATIGUED' | 'BLOCKED';
  inGoalPool:            boolean;
  inEmotionBoost:        boolean;
  /** True when MIROFISH rank conflicted with memory rank and was overruled. */
  mirofishOverruled:     boolean;
  // ── 4.1 signal (pure goal+emotion match, no history) ─────────────────────
  signal41:              number;   // 0, 0.5, or 1.0 based on goal/emotion match
}

export interface ConflictEntry {
  conflict:   string;
  resolution: string;
  winner:     string;
}

export type SystemStabilityState = 'stable' | 'warming' | 'unstable';

export interface DecisionInfluences {
  memory:      number;  // 0–1 proportion
  scoring:     number;
  mirofish:    number;
  blending:    number;
  exploration: number;
}

export interface DecisionBreakdown {
  memory_influence:      string;  // "45%"
  scoring_influence:     string;  // "30%"
  mirofish_influence:    string;  // "15%"
  blending_influence:    string;  // "7%"
  exploration_influence: string;  // "3%"
}

export interface OrchestratorDecision {
  selected_angles:          unknown[];     // SelectedAngle[] compatible shape
  primary_angle:            string;
  secondary_angle:          string | null;
  decision_breakdown:       DecisionBreakdown;
  conflict_resolution_log:  ConflictEntry[];
  final_decision_reasoning: string;
  system_stability_state:   SystemStabilityState;
  _meta: {
    angles_evaluated:   number;
    conflicts_detected: number;
    mirofish_overruled: number;
    computation_ms:     number;
  };
}

export interface DecideInput {
  concept_id?:  string;
  campaign_id?: string;
  user_id?:     string;
  goal?:        string;
  emotion?:     string;
  format?:      string;
  client_id?:   string;
  industry?:    string;
}

export interface OrchestratorContext {
  goal:       string | null;
  emotion:    string | null;
  format:     string | null;
  clientId:   string | null;
  industry:   string | null;
  userId:     string | null;
  campaignId: string | null;
  goalPool:   string[];
  emoBoosts:  string[];
  recentMem:  { angle: string; totalScore: number; isWinner: boolean }[];
  isNewUser:  boolean;
  highExploreMode: boolean;  // if system is in stagnation/exploration state
}
