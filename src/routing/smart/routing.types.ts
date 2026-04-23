export interface RoutingContext {
  clientId: string;

  goal: 'conversion' | 'awareness' | 'engagement';

  fatigueState: 'HEALTHY' | 'WARMING' | 'FATIGUED' | 'BLOCKED';

  /** 0–1: how stable is learned memory for this client. */
  memoryStability: number;

  /** 0–1: entropy in exploration signals — higher = more uncertain. */
  explorationEntropy: number;

  /** 0–1: combined strength of active trend signals for this industry. */
  trendPressure: number;

  /** 0–1: MIROFISH simulation confidence for recent requests. */
  mirofishConfidence: number;
}

export interface RoutingDecision {
  /** Primary mode — governs explore/exploit balance. */
  mode: 'exploit' | 'balanced' | 'explore';

  /** How many creative variants to generate. Clamped 1–10. */
  variantCount: number;

  /** Whether angle blending is active for this request. */
  blendingEnabled: boolean;

  /** Hook copy intensity. */
  hookAggressiveness: 'low' | 'medium' | 'high';

  /** Exploration rate cap fed to orchestrator. Clamped 0.05–0.60. */
  explorationRate: number;

  /** Risk ceiling for downstream creative decisions. 0–1. */
  riskTolerance: number;
}
