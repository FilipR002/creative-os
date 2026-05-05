// ─── Angle Evolution Engine — Types ──────────────────────────────────────────

/**
 * mutationType distinguishes what dimension the mutation targets:
 *   'copy'   — hook/tone/audience shift (existing behaviour)
 *   'visual' — palette / font / layout swap via Angle.visualOverrides
 */
export type MutationDimension = 'copy' | 'visual';

export interface MutationVector {
  // ── Dimension tag ──────────────────────────────────────────────────────────
  mutationType?:     MutationDimension;   // default: 'copy' when absent

  // ── Copy-dimension fields (original set) ───────────────────────────────────
  hookStyle?:        string;   // 'question' | 'bold-claim' | 'story' | 'data-led' | 'contrast'
  audienceFocus?:    string;   // 'pain-point' | 'aspiration' | 'social'
  emotionalTrigger?: string;   // 'fear' | 'curiosity' | 'pride' | 'trust' | 'urgency' | 'joy'
  formatBias?:       string;   // 'video' | 'carousel' | 'static'
  toneShift?:        string;   // 'softer' | 'more-direct' | 'humorous'

  // ── Visual-dimension fields (new) ──────────────────────────────────────────
  // These are written into Angle.visualOverrides and read by compositor.
  visualTone?:        string;  // AdTone: 'bold' | 'minimal' | 'premium' | 'friendly' | 'energetic' | 'urgent'
  visualColorMood?:   string;  // 'dark' | 'light' | 'vibrant' | 'muted' | 'monochrome' | 'warm' | 'cool'
  visualFont?:        string;  // font pairing ID: 'modern-sans' | 'editorial' | 'display-serif' | etc.
  visualLayout?:      string;  // layoutComplexity: 'minimal' | 'balanced' | 'rich'
  visualComposition?: string;  // compositionStyle: 'centered' | 'asymmetric' | 'rule-of-thirds' | 'editorial'
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

/** Shape stored in Angle.visualOverrides — compositor reads these fields. */
export interface AngleVisualOverrides {
  tone?:             string;  // AdTone
  colorMood?:        string;
  typographyStyle?:  string;  // maps to fontPairingId via translator
  compositionStyle?: string;
  layoutComplexity?: string;
}
