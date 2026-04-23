// ─── 4.6 Hook Booster v1 — Types ─────────────────────────────────────────────

export type HookFormat   = 'video' | 'carousel' | 'banner';
export type HookStrategy =
  | 'DIRECT_IMPACT'
  | 'CURIOSITY_GAP'
  | 'SOCIAL_PROOF'
  | 'PROBLEM_SHOCK'
  | 'TRANSFORMATION'
  | 'AUTHORITY_TRIGGER';

// ─── Input ────────────────────────────────────────────────────────────────────

export interface HookBoosterInput {
  /** One of: video | carousel | banner */
  format:           HookFormat;
  /** Primary angle slug from orchestrator. */
  primary_angle:    string;
  /** Optional secondary angle slug — used as trust / emotion reinforcer only. */
  secondary_angle?: string | null;
  /** Dominant emotion (e.g. urgency, trust, curiosity, fear, excitement). */
  emotion:          string;
  /** conversion | awareness | engagement */
  goal:             string;
  /** Optional — injected into {product} placeholder. */
  product_context?: string | null;
  /** Optional — injected into {audience} placeholder. */
  audience_context?: string | null;
}

// ─── Output contract (from spec — exact shape required) ──────────────────────

export interface HookVariant {
  hook:         string;
  strategy:     HookStrategy;
  angle_usage: {
    primary:   string;
    secondary: string | null;
  };
  emotion:      string;
  strength_score: number;   // 0–1
}

export interface HookBoosterOutput {
  format:           HookFormat;
  hooks:            HookVariant[];
  best_hook_index:  number;
  reasoning:        string;
}

// ─── Internal scoring breakdown (not in public output) ───────────────────────

export interface HookScoreComponents {
  clarity:              number;  // 0–1, weight 0.30
  emotional_alignment:  number;  // 0–1, weight 0.25
  angle_fit:            number;  // 0–1, weight 0.25
  format_optimization:  number;  // 0–1, weight 0.20
}

// ─── 4.7 Hook Booster v2 — Types ─────────────────────────────────────────────

export type HookV2Strategy = 'EXPLOIT' | 'EXPLORE' | 'HYBRID';

export interface HookV2Input {
  format:                    HookFormat;
  primary_angle:             string;
  secondary_angle?:          string | null;
  emotion:                   string;
  goal:                      string;
  product_context?:          string | null;
  audience_context?:         string | null;
  hook_v1_outputs:           HookBoosterOutput;
  /** 0–1: historical performance score for the primary angle. */
  memory_signal:             number;
  /** 0–1: soft fatigue modifier — higher = more variation needed. */
  fatigue_signal:            number;
  /** −0.10 to +0.25: additive delta driving explore vs exploit distribution. */
  exploration_pressure_delta: number;
}

export interface HookV2Variant {
  hook:              string;
  strategy:          HookV2Strategy;
  /** Index of the v1 hook this was derived from, as a string (e.g. "0"). */
  improved_from:     string;
  angle_usage: {
    primary:   string;
    secondary: string | null;
  };
  emotion:           string;
  memory_bias_applied:  boolean;
  fatigue_adjusted:     boolean;
  exploration_weight:   number;   // 0–1
  strength_score:       number;   // 0–1
}

export interface HookV2Output {
  format:           HookFormat;
  hooks:            HookV2Variant[];
  best_hook_index:  number;
  reasoning:        string;
}

export interface HookV2ScoreComponents {
  memory_alignment:    number;  // 0–1, weight 0.25
  emotional_intensity: number;  // 0–1, weight 0.20
  angle_fit:           number;  // 0–1, weight 0.20
  clarity:             number;  // 0–1, weight 0.15
  format_optimization: number;  // 0–1, weight 0.10
  exploration_novelty: number;  // 0–1, weight 0.10
}
