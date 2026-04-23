// ─── Angle Evolution Engine — Types ──────────────────────────────────────────

export interface MutationVector {
  hookStyle?:        string;   // e.g. 'question' | 'bold-claim' | 'story'
  audienceFocus?:    string;   // e.g. 'pain-point' | 'aspiration' | 'social'
  emotionalTrigger?: string;   // e.g. 'fear' | 'curiosity' | 'pride'
  formatBias?:       string;   // e.g. 'video' | 'carousel' | 'static'
  toneShift?:        string;   // e.g. 'softer' | 'more-direct' | 'humorous'
}

export interface AngleMutationRecord {
  id:             string;
  parentSlug:     string;
  mutantSlug:     string;
  mutationReason: string;
  mutationVector: MutationVector;
  status:         'active' | 'pruned' | 'champion';
  usageCount:     number;
  avgPerfScore:   number;
  createdAt:      string;
}

export interface EvolutionLogEntry {
  id:        string;
  event:     'mutated' | 'pruned' | 'promoted' | 'cycle_complete';
  angleSlug: string;
  reason:    string;
  metadata:  Record<string, unknown>;
  createdAt: string;
}

export interface EvolutionCycleResult {
  cycleId:    string;
  evaluated:  number;
  mutated:    string[];
  pruned:     string[];
  promoted:   string[];
  skipped:    number;
  ranAt:      string;
}

export interface EvolutionStatus {
  totalMutations:  number;
  activeMutations: number;
  prunedAngles:    number;
  champions:       number;
  lastCycleAt:     string | null;
}
