export interface AngleFinalWeight {
  slug:              string;
  finalWeight:       number;
  memoryScore:       number;
  scoringAlignment:  number;
  mirofishSignal:    number;
  blendingCompat:    number;
  explorationFactor: number;
  fatigueLevel:      string;
}

export interface ConflictRecord {
  conflict:   string;
  resolution: string;
  winner:     string;
}

export interface MirofishSignalSnapshot {
  slug:      string;
  signal:    number;
  overruled: boolean;
}

export interface FatigueSnapshot {
  slug:  string;
  state: string;
  score: number;
}

export interface DecisionTrace {
  traceId:    string;
  timestamp:  string;

  // Request context
  clientId:   string | null;
  userId:     string | null;
  campaignId: string | null;
  goal:       string;
  format:     string | null;
  emotionContext: string | null;

  // Inputs
  angleCandidates: string[];

  // Subsystem outputs
  memoryRanking:   { slug: string; score: number }[];
  fatigueStates:   FatigueSnapshot[];
  mirofishSignals: MirofishSignalSnapshot[];
  explorationRate: number;    // exploration_pressure_delta used this request

  // Orchestration result
  primaryAngle:      string;
  secondaryAngle:    string | null;
  explorationAngles: string[];
  finalWeights:      AngleFinalWeight[];

  // Conflicts
  resolvedConflicts: ConflictRecord[];
  overrides:         string[];
  blockedAngles:     string[];

  // Final
  decisionPath:         string;
  winnerConfidence:     number;    // primary angle finalWeight, 0–1
  systemStabilityState: string;   // 'stable' | 'warming' | 'unstable'
}

export interface TraceDiff {
  traceId1:       string;
  traceId2:       string;
  primaryChanged: boolean;
  primaryBefore:  string;
  primaryAfter:   string;
  weightDelta:    number;        // finalWeight change on primary
  conflictsDelta: number;        // difference in conflict count
  stabilityChanged: boolean;
  newFlags:       string[];      // blockedAngles / overrides that appeared
  droppedFlags:   string[];
}

export interface DriftAnalysis {
  creativeId:   string;
  status:       'stable' | 'drifting' | 'unstable';
  score:        number;          // 0–1
  flags:        string[];
  sampleCount:  number;
  breakdown: {
    angleVolatility:      number;
    mirofishTrend:        number;   // negative = degrading
    fatigueEscalation:    number;
    explorationVolatility: number;
  };
}
