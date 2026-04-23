// ─── Phase 5 — Standardised signal contracts ─────────────────────────────────
// All subsystem outputs are normalised to these shapes before crossing
// the platform boundary. Consumers read contracts, never internal types.

export interface BaseSignal {
  clientId:    string;
  timestamp:   number;
  slug:        string;
  score:       number;         // 0–1 normalised
  confidence?: number;         // 0–1, absent = unknown
}

export interface MirofishSignal extends BaseSignal {
  predictionError:  number;    // actual − predicted; null before feedback
  learningStrength: number;    // 0–1 inverse of variance
}

export interface FatigueSignal extends BaseSignal {
  state:    'HEALTHY' | 'WARMING' | 'FATIGUED' | 'BLOCKED';
  modifier: number;            // probabilityModifier output, −1 to +0.25
}

export interface MemorySignal extends BaseSignal {
  ewma:  number;               // smoothedScore from AngleWeight
  decay: number;               // 0–1 from global-memory engine
}

export interface ExplorationSignal {
  clientId:    string;
  timestamp:   number;
  delta:       number;         // exploration_pressure_delta, −0.10 to +0.25
  confidence:  number;
  riskFlags:   string[];
}

// ─── Mappers — convert Phase 4 shapes to signal contracts ────────────────────
// Called at the platform boundary; Phase 4 types never leak past here.

export function toMirofishSignal(
  clientId: string,
  slug:     string,
  raw: { overall_score: number; learning_signal_strength: number; prediction_error?: number | null },
): MirofishSignal {
  return {
    clientId,
    timestamp:        Date.now(),
    slug,
    score:            raw.overall_score,
    confidence:       raw.learning_signal_strength,
    predictionError:  raw.prediction_error ?? 0,
    learningStrength: raw.learning_signal_strength,
  };
}

export function toFatigueSignal(
  clientId: string,
  raw: { angle_name: string; fatigue_score: number; fatigue_state: string; probability_modifier: number },
): FatigueSignal {
  return {
    clientId,
    timestamp:  Date.now(),
    slug:       raw.angle_name,
    score:      raw.fatigue_score,
    state:      raw.fatigue_state as FatigueSignal['state'],
    modifier:   raw.probability_modifier,
  };
}

export function toMemorySignal(
  clientId: string,
  raw: { slug: string; strength_score: number; decay_rate: number; weight?: number },
): MemorySignal {
  return {
    clientId,
    timestamp: Date.now(),
    slug:      raw.slug,
    score:     raw.strength_score,
    ewma:      raw.weight ?? raw.strength_score,
    decay:     raw.decay_rate,
  };
}
