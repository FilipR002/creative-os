// ─── Context descriptor ───────────────────────────────────────────────────────

export interface WeightContext {
  clientId?: string | null;
  industry?: string | null;
  goal?:     string | null;
  format?:   string | null;
}

// ─── Per-angle update entry (one per angle per cycle, global context only) ────

export interface AngleCycleEntry {
  slug:             string;
  format:           string;
  // Raw & normalized performance
  actualScore:      number;
  normalizedScore:  number;
  predictedScore:   number;   // smoothedScore before this update
  delta:            number;   // normalizedScore - predictedScore
  // Weight evolution
  weightBefore:     number;
  weightAfter:      number;
  // Stability signals
  learningRate:     number;
  confidence:       number;
  uncertaintyScore: number;
  decayFactor:      number;
  topLocked:        boolean;  // was hysteresis lock active this cycle?
  // Outcome
  isWinner:         boolean;
  isExplore:        boolean;  // was this the explore slot?
  impact:           'positive' | 'negative' | 'minimal' | 'locked';
}

// ─── Exploration signal ───────────────────────────────────────────────────────

export type ExplorationSignalType =
  | 'dominance'
  | 'stagnation'
  | 'repetition'
  | 'overfitting'
  | 'none';

export interface ExplorationSignal {
  triggered: boolean;
  signal:    ExplorationSignalType;
  reason:    string;
  action?:   string;
}

// ─── Full cycle result ────────────────────────────────────────────────────────

export interface CycleResult {
  campaignId:        string;
  updatedAngles:     AngleCycleEntry[];
  explorationSignal: ExplorationSignal;
  systemStats: {
    anglesUpdated:     number;
    avgWeightChange:   number;
    avgNormalizedDelta: number;
    totalCycles:       number;
  };
  cycleAt: string;
}

// ─── System status ────────────────────────────────────────────────────────────

export type LearningHealth = 'healthy' | 'stagnating' | 'volatile';

export interface RankedAngle {
  slug:             string;
  label:            string;
  // Learned signals
  weight:           number;
  smoothedScore:    number;
  uncertaintyScore: number;
  decayFactor:      number;
  effectiveMultiplier: number;   // weight × uncertainty-correction × decay
  // Counts
  sampleCount:      number;
  winCount:         number;
  winRate:          number;
  topLockCycles:    number;
  // Classification
  status:           'reinforced' | 'boosted' | 'neutral' | 'penalized' | 'suppressed';
}

export interface SystemStatus {
  system: {
    totalLearningCycles:  number;
    anglesTracked:        number;
    explorationSignal:    ExplorationSignal;
    avgRecentDelta:       number;
    learningHealth:       LearningHealth;
    dominanceAngle:       string | null;   // currently dominant angle, if any
    baselineCount:        number;          // number of established baselines
  };
  rankedAngles:   RankedAngle[];
  recentActivity: {
    angle:           string;
    score:           number;
    normalizedScore: number;
    delta:           number;
    isWinner:        boolean;
    at:              Date;
  }[];
}
