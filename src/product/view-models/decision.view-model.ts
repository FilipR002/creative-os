// ─── Phase 6 — Decision ViewModel ────────────────────────────────────────────
// Clean SaaS-facing contract. No raw engine internals exposed to consumers.

export interface SignalBreakdown {
  memory:      number;   // 0–1
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

export interface ConflictSummary {
  description:  string;
  resolution:   string;
  winner:       string;
}

export interface DecisionViewModel {
  angle:        string;
  score:        number;  // 0–100
  confidence:   number;  // 0–1
  fatigueLevel: 'HEALTHY' | 'WARMING' | 'FATIGUED' | 'BLOCKED';
  rankPosition: number;
  explanation:  DecisionExplanation;
  breakdown:    SignalBreakdown;
}

export interface DecisionPageViewModel {
  primaryAngle:      string;
  secondaryAngle:    string | null;
  stabilityState:    'stable' | 'warming' | 'unstable';
  angles:            DecisionViewModel[];
  conflicts:         ConflictSummary[];
  systemReasoning:   string;
  meta: {
    anglesEvaluated:  number;
    conflictsDetected: number;
    mirofishOverruled: number;
    computationMs:    number;
  };
}
