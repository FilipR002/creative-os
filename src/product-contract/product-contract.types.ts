// ─── Phase 9.5 — UI Contract Layer: Type Definitions ─────────────────────────
//
// THE COMPLETE CONTRACT BETWEEN BACKEND INTELLIGENCE AND FRONTEND UI.
//
// Frontend MUST ONLY render these fields.
// Frontend MUST NEVER compute logic from this data.
// Frontend MUST NEVER access raw engine endpoints directly.

// ── Allowed screen identifiers ─────────────────────────────────────────────────
export const SCREEN_TYPES = [
  'dashboard',
  'campaign_overview',
  'creative_results',
  'angle_selection',
  'insights_panel',
  'onboarding',
  'error_state',
] as const;

export type ScreenType = typeof SCREEN_TYPES[number];

// ── The one canonical UI response ─────────────────────────────────────────────
export interface ProductResponse {
  screen:           ScreenType;
  title:            string;
  subtitle?:        string;
  primaryMetric?:   string;
  secondaryMetric?: string;
  insight?:         string;
  cta?:             string;
  state:            'success' | 'warning' | 'neutral';
  metadata:         Record<string, string | number | boolean>;
}

// ── List variant — for endpoints that return arrays of product cards ──────────
export interface ProductListResponse {
  screen:   ScreenType;
  items:    ProductCard[];
  summary?: string;
  state:    'success' | 'warning' | 'neutral';
}

export interface ProductCard {
  id:          string;
  label:       string;
  description: string;
  tag?:        string;    // "Recommended" | "Trending" | "New" | "Best"
  state:       'success' | 'warning' | 'neutral';
}

// ── Internal engine fields that are NEVER allowed in any outbound response ─────
// Checked at runtime by the sanitizer; extending this list is the only change
// needed to update the contract.
export const FORBIDDEN_FIELDS = new Set([
  // Angle engine
  'slug', 'confidence', 'outcomeMod', 'fatigueLevel', 'inGoalPool',
  'inEmotionBoost', 'recentlyUsed', 'usageCount', 'rankPosition',
  'insightBoost', 'alcAdj', 'alcAdjustment', 'evolutionBoost',
  'weight', 'angleWeight', 'source', 'parentSlug', 'mutationDepth',
  'isActive', 'angleSlug',
  // Outcome / learning engine
  'ctr', 'conversionRate', 'roas', 'performanceScore', 'ewma',
  'previousWeight', 'newWeight', 'sampleCount', 'reportCount',
  'totalImpressions', 'totalClicks', 'totalConversions', 'totalSpend',
  'totalRevenue', 'avgCtr', 'avgConversionRate', 'avgRoas',
  'avgPerformanceScore', 'calibrationFactor',
  // Creative DNA
  'hookPattern', 'emotionalTone', 'structureType', 'visualContext',
  'survivalRate', 'usageCount',
  // Causal attribution
  'angleContribution', 'creativeContribution', 'visionContribution',
  'evolutionContribution', 'noiseEstimate',
  // ALC / Autonomous loop
  'strongAngles', 'weakAngles', 'stagnatingAngles', 'explorationRatio',
  'entropyScore', 'cycleCount', 'triggeredActions',
  // Emergence
  'driftScore', 'learningVelocity', 'explorationRatioAvg', 'diversityIndex',
  'systemStatus', 'dataPoints',
  // Scoring engine
  'totalScore', 'dimensions', 'dynamicWeights', 'ctrProxy',
  'engagementProxy', 'conversionProxy', 'clarity', 'calibration',
  // Mirofish
  'mirofishScore', 'mirofishPrediction', 'miroProbability',
]);
