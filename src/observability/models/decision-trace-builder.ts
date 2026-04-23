// ─── Public trace contract + builder ─────────────────────────────────────────
// BuiltTrace is the STABLE schema that all consumers (replay, drift, export) read.
// The builder is the only place that knows about orchestrator internals.
// Swap orchestrator shape freely — update only this file.

const ARRAY_LIMIT = 50;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BuiltTrace {
  timestamp: number;

  // Request context
  clientId:   string | null;
  userId:     string | null;
  campaignId: string | null;

  decision: {
    primaryAngle:   string;
    secondaryAngle: string | null;
    exploration:    { slug: string; confidence: number }[];
  };

  signals: {
    memory:      { slug: string; score: number }[];
    fatigue:     { slug: string; state: string; modifier: number }[];
    mirofish:    { slug: string; score: number }[];
    exploration: number;
  };

  meta: {
    stability:         string;
    confidence:        number;
    goal:              string;
    format:            string | null;
    emotion:           string | null;
    blockedAngles:     string[];
    resolvedConflicts: { conflict: string; resolution: string; winner: string }[];
    overrides:         string[];
  };
}

export interface StoredTrace extends BuiltTrace {
  traceId: string;
}

// ─── Builder ──────────────────────────────────────────────────────────────────

export class DecisionTraceBuilder {
  static build(input: {
    orchestratorOutput: {
      primaryAngle:      string;
      secondaryAngle:    string | null;
      stability:         string;
      winnerConfidence:  number;
      explorationAngles: { slug: string; confidence: number }[];
      resolvedConflicts: { conflict: string; resolution: string; winner: string }[];
      overrides:         string[];
      blockedAngles:     string[];
    };
    bundles:    { slug: string; memoryScore: number; mirofishSignal: number; fatigueLevel: string; finalWeight: number }[];
    exploration: number;
    context: {
      clientId:   string | null;
      userId:     string | null;
      campaignId: string | null;
      goal:       string;
      format:     string | null;
      emotion:    string | null;
    };
  }): BuiltTrace {
    const { orchestratorOutput: o, bundles, exploration, context } = input;

    return {
      timestamp:  Date.now(),
      clientId:   context.clientId,
      userId:     context.userId,
      campaignId: context.campaignId,

      decision: {
        primaryAngle:   o.primaryAngle,
        secondaryAngle: o.secondaryAngle,
        exploration:    trim(o.explorationAngles),
      },

      signals: {
        memory:      trim(bundles.map(b => ({ slug: b.slug, score: b.memoryScore }))),
        fatigue:     trim(bundles.map(b => ({ slug: b.slug, state: b.fatigueLevel, modifier: b.finalWeight }))),
        mirofish:    trim(bundles.map(b => ({ slug: b.slug, score: b.mirofishSignal }))),
        exploration,
      },

      meta: {
        stability:         o.stability,
        confidence:        o.winnerConfidence,
        goal:              context.goal,
        format:            context.format,
        emotion:           context.emotion,
        blockedAngles:     o.blockedAngles,
        resolvedConflicts: trim(o.resolvedConflicts),
        overrides:         trim(o.overrides),
      },
    };
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function trim<T>(arr?: T[]): T[] {
  return (arr ?? []).slice(0, ARRAY_LIMIT);
}
