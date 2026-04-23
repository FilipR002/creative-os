// ─── 4.10 Global Creative Memory — Types ─────────────────────────────────────

// ─── Ingest input ─────────────────────────────────────────────────────────────

export interface VariantIngestRecord {
  /** Opaque ID — may be a DB creative ID or a generation-run UUID. */
  id:          string;
  /** 0–100 from 4.9 Auto Winner. */
  final_score: number;
  breakdown: {
    ctr:        number;  // 0–100
    retention:  number;
    conversion: number;
    clarity:    number;
  };
  is_winner: boolean;
}

export interface MirofishIngestSignal {
  creative_id?:      string;
  predicted_score:   number;   // 0–1
  actual_score?:     number;   // 0–1, may arrive after the ingest call
  prediction_error?: number;   // actual − predicted
}

export interface HookBoosterIngestRef {
  hook:             string;
  strategy?:        string;   // v1 HookStrategy slug
  strength_score?:  number;   // 0–1
  format:           string;
}

export interface SceneRewriteIngestRef {
  improvement_type: string;   // CLARITY | EMOTIONAL | PERFORMANCE
  impact_score:     number;   // 0–1
  accepted:         boolean;
}

export interface GlobalMemoryIngestInput {
  campaign_id:    string;
  client_id:      string;
  industry:       string;
  user_id?:       string;
  format:         string;       // video | carousel | banner
  primary_angle:  string;
  secondary_angle?: string | null;
  goal?:          string;       // conversion | awareness | engagement
  emotion?:       string;

  /** From 4.9 Auto Winner — required. */
  variant_results:       VariantIngestRecord[];

  /** Optional MIROFISH signal batch for this run. */
  mirofish_signals?:     MirofishIngestSignal[];
  /** Optional hook booster references. */
  hook_booster_refs?:    HookBoosterIngestRef[];
  /** Optional scene rewrite references. */
  scene_rewrite_refs?:   SceneRewriteIngestRef[];
}

// ─── 4-layer output ───────────────────────────────────────────────────────────

export interface AngleMemoryUpdate {
  angle:          string;
  ctr:            number;   // 0–1 rolling avg
  conversion:     number;   // 0–1
  retention:      number;   // 0–1
  strength_score: number;   // 0–1 composite
  decay_rate:     number;   // 0–1 (higher = faster decay / less stable)
}

export interface HookMemoryUpdate {
  structure:      string;   // hook strategy or pattern slug
  format:         string;
  avg_score:      number;   // 0–1
  win_rate:       number;   // 0–1
  sample_count:   number;
  reuse_penalty:  number;   // 0–1 (penalises overused structures)
}

export interface CampaignMemoryUpdate {
  campaign_id:         string;
  angle_combination:   string;   // "primary|secondary"
  total_score:         number;   // 0–1
  blending_success:    boolean;
  mirofish_accuracy:   number;   // 0–1 (1 = perfect prediction)
}

export interface SystemMemoryUpdate {
  system_health_score:       number;   // 0–1
  learning_efficiency_index: number;   // 0–1 (improving = higher)
  drift_flags:               string[];
}

export interface GlobalMemoryOutput {
  angle_memory_updates:    AngleMemoryUpdate[];
  hook_memory_updates:     HookMemoryUpdate[];
  campaign_memory_updates: CampaignMemoryUpdate[];
  system_memory_updates:   SystemMemoryUpdate;
  insights:                string[];
}

// ─── Internal ─────────────────────────────────────────────────────────────────

export interface AngleAggregateRow {
  slug:           string;
  uses:           number;
  wins:           number;
  avgCtr:         number;
  avgRetention:   number;
  avgConversion:  number;
  weight:         number;
  daysSinceUsed:  number | null;
}

export interface LearningTrend {
  /** Slope of actualScore over recent learning cycles (positive = improving). */
  slope:          number;
  sampleCount:    number;
  avgDelta:       number;
}

export interface MirofishAccuracyRow {
  avgAbsError:    number;   // mean absolute prediction error (0–1)
  sampleCount:    number;
  isGrowing:      boolean;  // true if error trend is worsening
}
