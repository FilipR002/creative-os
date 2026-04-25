/**
 * v2.schema.types.ts
 *
 * Creative OS v2 — Unified Master Schema
 *
 * Single source of truth for the entire Creative OS pipeline.
 *
 * Flow:
 *   V2InputSchema
 *     → V2BrainOutput      (funnel detection + format routing)
 *     → V2UGCBlock         (UGC variants + jobs)
 *     → V2CarouselBlock    (carousel creatives)
 *     → V2BannerBlock      (banner creatives)
 *     → V2ExecutionBlock   (unified queue state)
 *     → V2ScoringBlock     (per-variant + cross-format scores)
 *     → V2LearningBlock    (memory signals + trend weights)
 *     → V2OutputSchema     (ONE final JSON)
 */

// ─── Primitive types ──────────────────────────────────────────────────────────

export type V2Goal         = 'conversion' | 'awareness' | 'retention';
export type V2BudgetLevel  = 'low' | 'medium' | 'high';
export type V2Tone         = 'aggressive' | 'friendly' | 'premium';
export type V2FunnelStage  = 'TOFU' | 'MOFU' | 'BOFU';
export type V2Intent       = 'cold' | 'warm' | 'hot';
export type V2Format       = 'ugc' | 'carousel' | 'banner';
export type V2Status       = 'dispatched' | 'processing' | 'partial' | 'failed';
export type V2ModeType     = 'ugc' | 'cinematic' | 'static';

// ─── 1. INPUT SCHEMA ──────────────────────────────────────────────────────────

export interface V2Constraints {
  /** Allowed duration tiers in seconds */
  duration: number[];
  /** Allowed format types */
  formats:  V2Format[];
}

export interface V2InputSchema {
  campaign_id:  string;
  concept_id?:  string;
  product:      string;
  audience:     string;
  goal:         V2Goal;
  platforms:    string[];
  budget_level: V2BudgetLevel;
  tone:         V2Tone;
  constraints:  V2Constraints;
  /** Optional user-provided client + industry for memory scoping */
  client_id?:   string;
  industry?:    string;
}

// ─── 2. BRAIN OUTPUT ──────────────────────────────────────────────────────────

export interface V2Routing {
  ugc:      number;
  carousel: number;
  banner:   number;
}

export interface V2ModeSelection {
  ugc:      V2ModeType;
  carousel: V2ModeType;
  banner:   V2ModeType;
}

export interface V2VariantAllocation {
  ugc:      number;
  carousel: number;
  banner:   number;
  total:    number;
}

export interface V2BrainOutput {
  funnel_stage:      V2FunnelStage;
  intent:            V2Intent;
  priority_signal:   string;
  routing:           V2Routing;
  mode_selection:    V2ModeSelection;
  primary_format:    V2Format;
  secondary_format:  V2Format;
  variant_allocation: V2VariantAllocation;
  /** Shared hook across all formats */
  shared_hook:       string;
  /** Shared angle slug */
  shared_angle:      string;
  /** Shared emotion */
  shared_emotion:    string;
  reasoning:         string;
}

// ─── 3. CREATIVE BLOCKS ───────────────────────────────────────────────────────

// UGC -------------------------------------------------------------------------

export interface V2UGCScene {
  scene_id:    number;
  visual:      string;
  speech:      string;
  camera:      string;
  emotion:     string;
  transition:  string;
  duration:    number;
  kling_prompt: string;
}

export interface V2UGCVariant {
  variant_id:   string;
  persona:      string;
  hook_id:      string;
  hook:         string;
  emotion_arc:  string;
  tone:         string;
  pacing:       string;
  script:       string;
  scenes:       V2UGCScene[];
  kling_jobs:   string[];   // job IDs
  score_estimate: number;
}

export interface V2UGCBlock {
  type:       'ugc';
  platform:   string;
  test_id:    string;
  variants:   V2UGCVariant[];
  job_ids:    string[];
  status:     V2Status;
}

// Carousel --------------------------------------------------------------------

export interface V2CarouselSlide {
  slide:          number;
  headline:       string;
  visual_prompt:  string;
  cta:            string;
}

export interface V2CarouselCreative {
  creative_id: string;
  variant:     string;
  slides:      V2CarouselSlide[];
  status:      V2Status;
}

export interface V2CarouselBlock {
  type:        'carousel';
  engine:      string;
  creatives:   V2CarouselCreative[];
  status:      V2Status;
}

// Banner ----------------------------------------------------------------------

export interface V2BannerCreative {
  creative_id:  string;
  variant:      string;
  headline:     string;
  subtext:      string;
  visual_prompt: string;
  sizes:        string[];
  status:       V2Status;
}

export interface V2BannerBlock {
  type:       'banner';
  creatives:  V2BannerCreative[];
  status:     V2Status;
}

// ─── 4. EXECUTION BLOCK ──────────────────────────────────────────────────────

export interface V2JobEntry {
  job_id:      string;
  format:      V2Format;
  status:      string;
  variant_id?: string;
}

export interface V2ExecutionBlock {
  ugc_jobs:      V2JobEntry[];
  carousel_jobs: V2JobEntry[];
  banner_jobs:   V2JobEntry[];
  total_jobs:    number;
  dispatched_at: string;
}

// ─── 5. SCORING BLOCK ────────────────────────────────────────────────────────

export interface V2VariantScore {
  variant_id:       string;
  hook_score:       number;
  retention:        number;
  conversion_prob:  number;
  composite:        number;
  rank:             number;
}

export interface V2FormatScore {
  format: V2Format;
  score:  number;
}

export interface V2Winner {
  format:     V2Format;
  variant_id: string;
  score:      number;
  confidence: number;
}

export interface V2ScoringBlock {
  ugc:      V2VariantScore[];
  carousel: V2FormatScore[];
  banner:   V2FormatScore[];
  winner:   V2Winner;
}

// ─── 6. LEARNING BLOCK ───────────────────────────────────────────────────────

export interface V2TrendWeights {
  ugc_weight:      number;
  carousel_weight: number;
  banner_weight:   number;
}

export interface V2LearningBlock {
  best_hooks:    string[];
  best_personas: string[];
  best_formats:  V2Format[];
  trend_update:  V2TrendWeights;
}

// ─── 7. FINAL OUTPUT SCHEMA ──────────────────────────────────────────────────

export interface V2OutputSchema {
  campaign_id:  string;
  execution_id: string;
  brain:        V2BrainOutput;
  ugc:          V2UGCBlock | null;
  carousel:     V2CarouselBlock | null;
  banner:       V2BannerBlock | null;
  execution:    V2ExecutionBlock;
  scoring:      V2ScoringBlock;
  learning:     V2LearningBlock;
  status:       V2Status;
  created_at:   string;
  /** ms from run start to output assembly */
  duration_ms:  number;
}
