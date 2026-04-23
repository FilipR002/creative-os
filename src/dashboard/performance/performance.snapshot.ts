// ─── Phase 5.4 — unified performance snapshot ────────────────────────────────

export type DashboardTimeframe = '24h' | '7d' | '30d';

export interface AnglePerformance {
  slug:          string;
  ctr:           number;
  conversion:    number;
  retention:     number;
  strengthScore: number;
  decayRate:     number;
}

export interface HookPerformance {
  structure:    string;
  format:       string;
  avgScore:     number;
  winRate:      number;
  sampleCount:  number;
  reusePenalty: number;
}

export interface FormatPerformance {
  format:   string;
  avgScore: number;
  count:    number;
}

export interface PerformanceSnapshot {
  clientId:    string | null;
  timeframe:   DashboardTimeframe;
  generatedAt: number;

  angles:  AnglePerformance[];
  hooks:   HookPerformance[];
  formats: FormatPerformance[];

  system: {
    /** FatigueState → count of angles in that state. */
    fatigueDistribution:     Record<string, number>;
    /** Average exploration_signal across all angle fatigue results. */
    explorationRate:         number;
    /** From GlobalMemory system update — MIROFISH avg accuracy. */
    mirofishAccuracy:        number;
    systemHealthScore:       number;
    learningEfficiencyIndex: number;
    driftFlags:              string[];
  };

  trends: {
    /** Trend values seen in last 24 h. */
    active:  string[];
    /** Trends with velocity > 0.5. */
    rising:  string[];
    /** Trends with velocity < -0.3 or age-decayed below 0.3. */
    falling: string[];
  };
}
