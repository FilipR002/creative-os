export type ImprovementType = 'hook' | 'cta' | 'clarity' | 'structure';

export interface WeaknessFlags {
  needsHook:      boolean;  // ctr < 0.60
  needsCTA:       boolean;  // conversion < 0.70
  needsClarity:   boolean;  // clarity < 0.70
  needsStructure: boolean;  // missing required scene/slide types
}

export interface AppliedChange {
  field:    string;
  before:   string;
  after:    string;
  reason:   string;
}

export interface ImprovementPlan {
  types:     ImprovementType[];
  changes:   AppliedChange[];
  patchedContent: any;
}

export interface ImprovementResult {
  originalCreativeId:  string;
  improvedCreativeId:  string | null;
  improvementTypes:    ImprovementType[];
  scoreBefore:         number;
  scoreAfter:          number | null;
  delta:               number | null;
  accepted:            boolean;
  changesApplied:      AppliedChange[];
  message:             string;
}
