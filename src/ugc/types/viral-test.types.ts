/**
 * viral-test.types.ts
 *
 * Type system for the UGC Multi-Persona Viral Testing Engine (Phase 1.1).
 *
 * Pipeline:
 *   PersonaSplitter → HookVariantEngine → ExpandedVariantGenerator
 *   → Parallel Queue → Scoring → AutoWinner → MemoryFeedback
 */

import type { UGCPersonaId, HookStrategy, UGCTone, UGCPacing } from './ugc.types';

// ─── Persona Splitter ─────────────────────────────────────────────────────────

export interface PersonaSplitInput {
  product:    string;
  audience:   string;
  painPoint:  string;
  angle:      string;
  platform:   string;
  emotion?:   string;
  /** Override default persona pool (optional) */
  personaIds?: UGCPersonaId[];
}

export interface PersonaWeight {
  personaId:   UGCPersonaId;
  probability: number;   // 0–1, all weights sum to 1.0
  /** Signal that drove this weight: 'angle_fit' | 'platform_fit' | 'emotion_fit' | 'default' */
  driver:      string;
}

export interface PersonaSplitOutput {
  weights: PersonaWeight[];
  /** Top persona — highest probability */
  dominant: UGCPersonaId;
  /** Brief explanation of the split logic */
  reasoning: string;
}

// ─── Hook Variant Engine (A/B/C) ─────────────────────────────────────────────

export type HookVariantId = 'A' | 'B' | 'C';

export interface HookVariant {
  id:       HookVariantId;
  text:     string;
  strategy: HookStrategy;
  /** Estimated hook strength (0–1) */
  strength: number;
}

export interface PersonaHookSet {
  personaId: UGCPersonaId;
  hooks:     HookVariant[];    // always 3 variants: A, B, C
}

// ─── Expanded Variant (persona × hook) ───────────────────────────────────────

export interface ExpandedUGCVariant {
  /** Format: "{personaId}-{hookId}" e.g. "skeptical_user-A" */
  variantId:          string;
  personaId:          UGCPersonaId;
  hookVariantId:      HookVariantId;
  hook:               string;
  hookStrategy:       HookStrategy;
  /** Emotional arc string e.g. "doubt → surprise → relief" */
  emotionArc:         string;
  tone:               UGCTone;
  pacing:             UGCPacing;
  script:             string;
  /** Pre-render conversion estimate (0–1) */
  ugcScoreEstimate:   number;
  /** Persona weight (probability from splitter) */
  personaProbability: number;
}

// ─── UGC Scoring ─────────────────────────────────────────────────────────────

export interface UGCVariantScore {
  variantId:            string;
  /** Hook retention probability (0–3s engagement) */
  hookRetention:        number;
  /** Predicted avg watch-through rate */
  avgWatchTime:         number;
  /** Emotional engagement signal (0–1) */
  emotionalEngagement:  number;
  /** Conversion probability (0–1) */
  conversionProbability: number;
  /** Composite score — weighted mean */
  score:                number;
  /** Rank among all variants in this test (1 = best) */
  rank:                 number;
}

export interface UGCScoringResult {
  testId:    string;
  scores:    UGCVariantScore[];
  /** Sorted by score desc */
  ranked:    UGCVariantScore[];
}

// ─── Auto Winner ─────────────────────────────────────────────────────────────

export interface UGCWinnerResult {
  testId:          string;
  winnerVariantId: string;
  winnerScore:     number;
  confidence:      number;   // 0–1, gap between winner and runner-up normalised
  runnerUpId?:     string;
  runnerUpScore?:  number;
  /** All variant scores in rank order */
  leaderboard:     UGCVariantScore[];
}

// ─── Memory Feedback ─────────────────────────────────────────────────────────

export interface UGCMemoryFeedbackInput {
  testId:      string;
  campaignId:  string;
  userId:      string;
  clientId:    string;
  industry:    string;
  winner:      UGCWinnerResult;
  /** The expanded variant that won */
  winnerVariant: ExpandedUGCVariant;
}

// ─── Viral Test DTO / Response ────────────────────────────────────────────────

export interface LaunchViralTestDto {
  campaignId:        string;
  conceptId?:        string;
  platform?:         string;
  /** Variants per persona-hook combo: total = personas × 3 hooks (capped at 10) */
  personaCount?:     number;   // 1–4, default 3
  durationSeconds?:  number;   // 15 | 60 | 90
}

export interface LaunchViralTestResponse {
  testId:                     string;
  campaignId:                 string;
  jobIds:                     string[];
  status:                     'queued';
  variantCount:               number;
  personaCount:               number;
  estimatedRenderTimeSeconds: number;
  /** All variants that were generated + queued */
  variants:                   Array<{
    variantId: string;
    persona:   string;
    hookId:    string;
    hook:      string;
    ugcScoreEstimate: number;
  }>;
}

export interface ViralTestStatusResponse {
  testId:       string;
  campaignId:   string;
  status:       'running' | 'scoring' | 'complete' | 'partial';
  jobStatuses:  Array<{
    jobId:            string;
    variantId:        string;
    state:            string;
    score?:           number;
    stitchedVideoUrl?: string;
  }>;
  winner?:      UGCWinnerResult;
  completedAt?: string;
}
