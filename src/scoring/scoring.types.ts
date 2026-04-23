export type CreativeFormat = 'video' | 'carousel' | 'banner';

export interface CreativeInput {
  id: string;
  format: CreativeFormat;
  content: any;
  angle: string;
  concept: any;
}

// Raw dimension scores (0–1 each)
export interface VideoScoreDimensions {
  hookStrength: number;
  clarity: number;
  emotionalIntensity: number;
  structureCompleteness: number;
}

export interface CarouselScoreDimensions {
  headlineClarity: number;
  slideFlowQuality: number;
  ctaStrength: number;
  persuasionArc: number;
}

export interface BannerScoreDimensions {
  readability: number;
  visualHierarchy: number;
  ctaVisibility: number;
  messageDensity: number;
}

// Normalised composite proxies (before weighting)
export interface ScoreProxies {
  ctrProxy: number;       // click-through rate heuristic
  engagementProxy: number; // emotional + hook
  conversionProxy: number; // CTA + clarity
  clarity: number;         // raw clarity dimension
}

import type { MirofishResult } from '../mirofish/engines/aggregation.engine';

// Final per-creative result
export interface CreativeScoreResult {
  creativeId: string;
  format: CreativeFormat;
  dimensions: VideoScoreDimensions | CarouselScoreDimensions | BannerScoreDimensions;
  proxies: ScoreProxies;
  ctrScore: number;
  engagement: number;
  conversion: number;
  clarity: number;
  totalScore: number;
  isWinner: boolean;
  /** MIROFISH predictive simulation result — present when the MIROFISH module is active. */
  mirofish?: MirofishResult;
}
