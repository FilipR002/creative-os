// ─── 4.9 Auto Winner System — Types ──────────────────────────────────────────

export type WinnerFormat = 'video' | 'carousel' | 'banner';

// ─── Input ────────────────────────────────────────────────────────────────────

export interface WinnerAngleContext {
  primary:    string;
  secondary?: string | null;
}

/** Pre-measured or simulated performance for one variant. */
export interface VariantPerformanceSignal {
  ctr?:        number;  // 0–1
  retention?:  number;  // 0–1
  conversion?: number;  // 0–1
  clarity?:    number;  // 0–1
}

/** A single creative variant to be evaluated. */
export interface CreativeVariant {
  id:      string;
  /** Structured creative content (video/carousel/banner) or plain hook string. */
  content: any;
  /** Optional pre-provided performance metrics — takes precedence over heuristics. */
  performance_data?: VariantPerformanceSignal;
}

/** Simplified hook reference from Hook Booster v1/v2. */
export interface HookBoosterRef {
  hook:            string;
  strength_score?: number;
}

/** Simplified rewrite reference from Scene Rewriter 4.8. */
export interface SceneRewriteRef {
  rewritten_segment: string;
  impact_score?:     number;
  improvement_type?: string;
}

export interface MemorySignals {
  /** angle_slug → historical avg performance (0–1). */
  angle_performance?: Record<string, number>;
}

export interface FatigueSignals {
  /** angle_slug → fatigue level (0–1). */
  angle_fatigue?: Record<string, number>;
}

export interface AutoWinnerInput {
  format:                  WinnerFormat;
  creative_variants:       CreativeVariant[];
  angle_context:           WinnerAngleContext;
  hook_booster_outputs?:   HookBoosterRef[];
  scene_rewrite_outputs?:  SceneRewriteRef[];
  /** Per-variant performance map: variant_id → signal. */
  performance_signals?:    Record<string, VariantPerformanceSignal>;
  memory_signals?:         MemorySignals;
  fatigue_signals?:        FatigueSignals;
  /** Exploration pressure delta from 4.5. Range −0.10 to +0.25. */
  exploration_signal?:     number;
}

// ─── Output ───────────────────────────────────────────────────────────────────

export interface VariantScoreBreakdown {
  ctr:        number;  // 0–100
  retention:  number;  // 0–100
  conversion: number;  // 0–100
  clarity:    number;  // 0–100
}

export interface ScoredVariant {
  id:                string;
  final_score:       number;  // 0–100
  breakdown:         VariantScoreBreakdown;
  angle_alignment:   number;  // 0–1
  fatigue_penalty:   number;  // 0–10 (subtracted)
  exploration_bonus: number;  // 0–10 (added)
}

export interface AutoWinnerOutput {
  format:   WinnerFormat;
  variants: ScoredVariant[];
  winner: {
    id:          string;
    final_score: number;
  };
  reasoning: string;
}

// ─── Internal ─────────────────────────────────────────────────────────────────

export interface RawProxies {
  ctrProxy:         number;  // 0–1
  engagementProxy:  number;  // 0–1
  conversionProxy:  number;  // 0–1
  clarity:          number;  // 0–1
}
