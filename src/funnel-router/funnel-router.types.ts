/**
 * funnel-router.types.ts
 *
 * Canonical type definitions for the Full Funnel Creative OS Router (Phase 1.2).
 *
 * Pipeline:
 *   FunnelIntentDetector → FormatDecisionEngine → CreativeAllocationBrain
 *   → CrossFormatSync → DispatchLayer → Scoring → WinnerFormat → MemoryFeedback
 */

// ─── Funnel stages + intent ───────────────────────────────────────────────────

export type FunnelStage    = 'TOFU' | 'MOFU' | 'BOFU';
export type IntentType     = 'cold' | 'warm' | 'hot';
export type PrioritySignal = 'trust' | 'emotion' | 'conversion';
export type BudgetLevel    = 'low' | 'medium' | 'high';
export type CampaignGoal   = 'conversion' | 'awareness' | 'retargeting' | 'engagement' | 'leads';
export type CreativeFormat = 'ugc' | 'carousel' | 'banner';

// ─── Funnel Intent Detector ───────────────────────────────────────────────────

export interface FunnelRouterInput {
  campaignId:    string;
  conceptId?:    string;
  product:       string;
  audience:      string;
  goal:          CampaignGoal;
  budgetLevel:   BudgetLevel;
  platform?:     string;
  /** Override detected funnel stage (optional) */
  funnelStage?:  FunnelStage;
  /** Override detected intent (optional) */
  intentType?:   IntentType;
}

export interface FunnelIntentResult {
  funnelStage:         FunnelStage;
  intentType:          IntentType;
  prioritySignal:      PrioritySignal;
  /** Ranked format list — first = highest priority */
  recommendedFormats:  CreativeFormat[];
  /** Brief reasoning trace */
  reasoning:           string;
}

// ─── Format Decision Engine ───────────────────────────────────────────────────

export interface FormatAllocation {
  ugc:      number;   // 0–1, must sum to 1.0
  carousel: number;
  banner:   number;
}

export interface FormatDecision {
  allocation:      FormatAllocation;
  primaryFormat:   CreativeFormat;
  secondaryFormat: CreativeFormat;
  /** Formats that will be generated (budget-filtered) */
  activeFormats:   CreativeFormat[];
}

// ─── Creative Allocation Brain ────────────────────────────────────────────────

export interface VariantAllocation {
  ugcVariants:      number;
  carouselVariants: number;
  bannerVariants:   number;
  /** Ordered priority — first format gets most resources */
  priority:         CreativeFormat[];
  /** Total variant count across all formats */
  totalVariants:    number;
}

// ─── Cross-Format Sync ────────────────────────────────────────────────────────

export interface SharedCreativeCore {
  /** Hook text shared across all formats */
  hook:         string;
  /** Angle slug shared across all formats */
  angle:        string;
  /** Emotion label shared across all formats */
  emotion:      string;
  /** CTA logic string shared across all formats */
  ctaLogic:     string;
  /** Style context string injected into all format generators */
  styleContext: string;
}

// ─── Dispatch results ─────────────────────────────────────────────────────────

export interface FormatDispatchResult {
  format:      CreativeFormat;
  status:      'dispatched' | 'skipped' | 'failed';
  /** Job IDs or creative IDs returned by the engine */
  ids:         string[];
  variantCount: number;
  error?:      string;
}

// ─── Cross-Format Scoring ─────────────────────────────────────────────────────

export interface CrossFormatScore {
  ugcScore?:      number;   // retention-based
  carouselScore?: number;   // swipe-rate proxy
  bannerScore?:   number;   // CTR proxy
  winnerFormat:   CreativeFormat;
  winnerScore:    number;
}

// ─── Full router result ───────────────────────────────────────────────────────

export interface FunnelRouterResult {
  routerId:        string;
  campaignId:      string;
  funnelIntent:    FunnelIntentResult;
  formatDecision:  FormatDecision;
  allocation:      VariantAllocation;
  sharedCore:      SharedCreativeCore;
  dispatches:      FormatDispatchResult[];
  crossFormatScore?: CrossFormatScore;
  status:          'dispatched' | 'partial' | 'failed';
  dispatchedAt:    string;
}

// ─── HTTP DTO ─────────────────────────────────────────────────────────────────

export interface RunFunnelRouterDto {
  campaignId:   string;
  conceptId?:   string;
  product:      string;
  audience:     string;
  goal:         CampaignGoal;
  budgetLevel:  BudgetLevel;
  platform?:    string;
  funnelStage?: FunnelStage;
  intentType?:  IntentType;
}
