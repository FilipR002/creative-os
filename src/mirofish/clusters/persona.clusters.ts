// ─── MIROFISH Persona Clusters ────────────────────────────────────────────────
//
// 200-persona population modelled as 5 weighted clusters.
// Each cluster defines base behavioral parameters and how sensitively
// it responds to different creative signals.
//
// Weights sum to 1.0 (20% + 30% + 20% + 15% + 15% = 100%)
// ─────────────────────────────────────────────────────────────────────────────

export interface PersonaCluster {
  id:     string;
  name:   string;
  /** Proportion of the 200-persona population this cluster represents. */
  weight: number;

  /** Baseline behavioral scores before any creative signal is applied. */
  base: {
    attention:        number;  // 0–1
    trust:            number;  // 0–1
    emotion:          number;  // 0–1
    conversionIntent: number;  // 0–1
  };

  /**
   * How strongly this cluster responds to each creative signal type.
   * Multiplied against the signal strength delta — range 0–1.
   * Higher = amplified response to that signal.
   */
  sensitivity: {
    hook:        number;  // strong opening / pattern interrupt
    social_proof: number; // testimonials, data, before/after
    emotional:   number;  // emotional storytelling, empathy
    educational: number;  // informational / teach / tips
    urgency:     number;  // scarcity, problem framing, CTA push
  };
}

export const PERSONA_CLUSTERS: readonly PersonaCluster[] = [
  // ── HIGH INTENT (20%) ──────────────────────────────────────────────────────
  // Purchase-ready. Responds strongly to trust signals and urgency.
  // Already evaluating — needs proof to convert.
  {
    id:     'high_intent',
    name:   'High Intent',
    weight: 0.20,
    base: {
      attention:        0.62,
      trust:            0.70,
      emotion:          0.45,
      conversionIntent: 0.75,
    },
    sensitivity: {
      hook:         0.40,
      social_proof: 0.85,
      emotional:    0.30,
      educational:  0.50,
      urgency:      0.90,
    },
  },

  // ── CURIOUS (30%) ─────────────────────────────────────────────────────────
  // Largest cluster. Hook-driven. Will engage if captured, but uncommitted.
  // Responds to novelty, emotional hooks, and informational value.
  {
    id:     'curious',
    name:   'Curious',
    weight: 0.30,
    base: {
      attention:        0.80,
      trust:            0.50,
      emotion:          0.65,
      conversionIntent: 0.40,
    },
    sensitivity: {
      hook:         0.90,
      social_proof: 0.40,
      emotional:    0.70,
      educational:  0.70,
      urgency:      0.30,
    },
  },

  // ── SKEPTICAL (20%) ───────────────────────────────────────────────────────
  // Hard to move. Low trust by default. Responds almost exclusively to
  // data, proof, and educational credibility signals. Ignore emotional claims.
  {
    id:     'skeptical',
    name:   'Skeptical',
    weight: 0.20,
    base: {
      attention:        0.55,
      trust:            0.22,
      emotion:          0.28,
      conversionIntent: 0.18,
    },
    sensitivity: {
      hook:         0.50,
      social_proof: 0.95,
      emotional:    0.12,
      educational:  0.82,
      urgency:      0.18,
    },
  },

  // ── EMOTIONAL (15%) ───────────────────────────────────────────────────────
  // Driven by feeling, not logic. High emotional baseline.
  // Responds to story, empathy, before/after narratives.
  // Poor response to data or hard-sell urgency.
  {
    id:     'emotional',
    name:   'Emotional',
    weight: 0.15,
    base: {
      attention:        0.70,
      trust:            0.60,
      emotion:          0.85,
      conversionIntent: 0.55,
    },
    sensitivity: {
      hook:         0.60,
      social_proof: 0.48,
      emotional:    0.95,
      educational:  0.22,
      urgency:      0.38,
    },
  },

  // ── INDIFFERENT (15%) ─────────────────────────────────────────────────────
  // Passive audience. Low baseline across all dimensions.
  // Only a very strong hook can break through. Rarely converts.
  {
    id:     'indifferent',
    name:   'Indifferent',
    weight: 0.15,
    base: {
      attention:        0.28,
      trust:            0.38,
      emotion:          0.28,
      conversionIntent: 0.22,
    },
    sensitivity: {
      hook:         0.72,
      social_proof: 0.28,
      emotional:    0.38,
      educational:  0.28,
      urgency:      0.48,
    },
  },
] as const;
