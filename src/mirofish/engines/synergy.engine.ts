// ─── MIROFISH Synergy Engine ──────────────────────────────────────────────────
//
// Computes the synergy score between a primary and secondary angle pair.
// Three components feed the final score:
//
//   1. Semantic compatibility — do the angles occupy compatible content territory?
//   2. Emotional alignment    — do they target the same emotional state in the audience?
//   3. Reinforcement effect   — does the secondary amplify or dilute the primary?
//
// Max 2 angles per creative (enforced by 4.3 blending system upstream).
// When no secondary angle is provided, synergy score = null / not applicable.
// ─────────────────────────────────────────────────────────────────────────────

export interface SynergyResult {
  score:                 number | null;  // null when no secondary angle
  semanticCompatibility: number | null;
  emotionalAlignment:    number | null;
  reinforcementEffect:   number | null;
  label:                 'none' | 'weak' | 'moderate' | 'strong' | 'optimal';
}

// ─── Validated combo scores (from BLEND_COMBOS — highest-confidence pairs) ────

const VALIDATED_COMBO_SCORES: Record<string, number> = {
  'before_after:proof':     0.90,
  'proof:before_after':     0.90,
  'problem_solution:teach': 0.88,
  'teach:problem_solution': 0.88,
  'storytelling:proof':     0.87,
  'proof:storytelling':     0.87,
  'show_off:proof':         0.83,
  'proof:show_off':         0.83,
};

// ─── Anti-conflict pairs (score floor: very low synergy) ──────────────────────

const CONFLICT_PAIRS = new Set<string>([
  'hot_take:teach', 'teach:hot_take',
  'unpopular_opinion:proof', 'proof:unpopular_opinion',
  'spark_conversation:teach', 'teach:spark_conversation',
  'humor:mistake_avoidance', 'mistake_avoidance:humor',
  'hot_take:data_stats', 'data_stats:hot_take',
  'curiosity:do_this_not_that', 'do_this_not_that:curiosity',
  'humor:before_after', 'before_after:humor',
]);

// ─── Semantic group membership ────────────────────────────────────────────────
// Each angle belongs to 1–2 semantic groups.

const ANGLE_GROUPS: Record<string, string[]> = {
  before_after:       ['proof', 'story'],
  show_off:           ['proof'],
  proof:              ['proof'],
  storytelling:       ['story', 'emotion'],
  curiosity:          ['curiosity', 'emotion'],
  unpopular_opinion:  ['opinion'],
  spark_conversation: ['opinion', 'emotion'],
  tips_tricks:        ['education'],
  hot_take:           ['opinion'],
  teach:              ['education'],
  data_stats:         ['proof', 'education'],
  do_this_not_that:   ['education', 'solution'],
  problem_solution:   ['solution'],
  mistake_avoidance:  ['solution', 'emotion'],
};

// ─── Group × group semantic compatibility matrix ──────────────────────────────
// Scores are symmetric. 'same' group = 0.60 (redundant, not additive).

const GROUP_COMPAT: Record<string, Record<string, number>> = {
  proof:     { proof: 0.60, story: 0.85, education: 0.72, opinion: 0.22, solution: 0.68, curiosity: 0.55, emotion: 0.75 },
  story:     { proof: 0.85, story: 0.58, education: 0.68, opinion: 0.52, solution: 0.62, curiosity: 0.78, emotion: 0.80 },
  education: { proof: 0.72, story: 0.68, education: 0.55, opinion: 0.32, solution: 0.82, curiosity: 0.65, emotion: 0.45 },
  opinion:   { proof: 0.22, story: 0.52, education: 0.32, opinion: 0.42, solution: 0.45, curiosity: 0.70, emotion: 0.60 },
  solution:  { proof: 0.68, story: 0.62, education: 0.82, opinion: 0.45, solution: 0.52, curiosity: 0.58, emotion: 0.70 },
  curiosity: { proof: 0.55, story: 0.78, education: 0.65, opinion: 0.70, solution: 0.58, curiosity: 0.45, emotion: 0.72 },
  emotion:   { proof: 0.75, story: 0.80, education: 0.45, opinion: 0.60, solution: 0.70, curiosity: 0.72, emotion: 0.55 },
};

// ─── Emotional group membership (which emotional states each angle serves) ────

const ANGLE_EMOTIONS: Record<string, string[]> = {
  before_after:       ['hope', 'inspiration', 'trust'],
  show_off:           ['excitement', 'pride'],
  proof:              ['trust'],
  storytelling:       ['empathy', 'hope', 'inspiration'],
  curiosity:          ['curiosity', 'excitement'],
  unpopular_opinion:  ['curiosity', 'surprise'],
  spark_conversation: ['curiosity', 'excitement'],
  tips_tricks:        ['trust', 'hope'],
  hot_take:           ['surprise', 'curiosity'],
  teach:              ['trust', 'hope'],
  data_stats:         ['trust'],
  do_this_not_that:   ['urgency', 'trust'],
  problem_solution:   ['urgency', 'hope'],
  mistake_avoidance:  ['fear', 'urgency'],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function groupCompatibility(a: string, b: string): number {
  const gA = ANGLE_GROUPS[a] ?? ['proof'];  // default fallback
  const gB = ANGLE_GROUPS[b] ?? ['proof'];

  // Take the best group combination
  let best = 0.50;
  for (const ga of gA) {
    for (const gb of gB) {
      const compat = GROUP_COMPAT[ga]?.[gb] ?? 0.50;
      if (compat > best) best = compat;
    }
  }
  return best;
}

function emotionalAlignment(a: string, b: string): number {
  const eA = new Set(ANGLE_EMOTIONS[a] ?? []);
  const eB = new Set(ANGLE_EMOTIONS[b] ?? []);
  if (eA.size === 0 || eB.size === 0) return 0.50;

  // Jaccard similarity of emotion sets
  const union        = new Set([...eA, ...eB]);
  const intersection = [...eA].filter(e => eB.has(e));

  return intersection.length / union.size;
}

function reinforcementEffect(primary: string, secondary: string): number {
  // Reinforcement: secondary should EXTEND or VALIDATE, not repeat
  const pGroups = new Set(ANGLE_GROUPS[primary]  ?? []);
  const sGroups = new Set(ANGLE_GROUPS[secondary] ?? []);

  const overlap = [...pGroups].filter(g => sGroups.has(g)).length;
  const total   = new Set([...pGroups, ...sGroups]).size;

  // Zero overlap = full diversity (potentially diluting)
  // Full overlap = redundant (no reinforcement gain)
  // Optimal = 1 shared group out of 3–4 total = complementary
  if (total === 0) return 0.50;

  const overlapRatio = overlap / total;
  // Peak reinforcement at ~25–40% overlap (complementary without redundancy)
  const reinforcement =
    overlapRatio <= 0.35 ? 0.50 + overlapRatio * 1.00  // diversity angle, growing
    : overlapRatio <= 0.60 ? 0.85 - (overlapRatio - 0.35) * 0.40  // near-optimal zone
    : 0.75 - (overlapRatio - 0.60) * 1.20;             // too much overlap → diminishing

  return Math.max(0.20, Math.min(0.95, reinforcement));
}

function synergyLabel(score: number): SynergyResult['label'] {
  if (score >= 0.82) return 'optimal';
  if (score >= 0.68) return 'strong';
  if (score >= 0.50) return 'moderate';
  if (score >= 0.30) return 'weak';
  return 'weak';
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function computeSynergy(
  primaryAngle:   string,
  secondaryAngle?: string,
): SynergyResult {
  if (!secondaryAngle) {
    return {
      score:                 null,
      semanticCompatibility: null,
      emotionalAlignment:    null,
      reinforcementEffect:   null,
      label:                 'none',
    };
  }

  const key = `${primaryAngle}:${secondaryAngle}`;

  // ── Use validated combo score if available ─────────────────────────────────
  if (VALIDATED_COMBO_SCORES[key] !== undefined) {
    const s = VALIDATED_COMBO_SCORES[key];
    return {
      score:                 r3(s),
      semanticCompatibility: r3(groupCompatibility(primaryAngle, secondaryAngle)),
      emotionalAlignment:    r3(emotionalAlignment(primaryAngle, secondaryAngle)),
      reinforcementEffect:   r3(reinforcementEffect(primaryAngle, secondaryAngle)),
      label:                 synergyLabel(s),
    };
  }

  // ── Anti-conflict check ────────────────────────────────────────────────────
  if (CONFLICT_PAIRS.has(key) || CONFLICT_PAIRS.has(`${secondaryAngle}:${primaryAngle}`)) {
    const semComp = r3(groupCompatibility(primaryAngle, secondaryAngle));
    const emoAlign = r3(emotionalAlignment(primaryAngle, secondaryAngle));
    const reinf   = r3(reinforcementEffect(primaryAngle, secondaryAngle));
    // Hard cap for conflicting pairs
    const score   = r3(Math.min(semComp * 0.40 + emoAlign * 0.30 + reinf * 0.30, 0.32));
    return {
      score,
      semanticCompatibility: semComp,
      emotionalAlignment:    emoAlign,
      reinforcementEffect:   reinf,
      label:                 synergyLabel(score),
    };
  }

  // ── General case: weighted combination of three components ─────────────────
  const semComp  = groupCompatibility(primaryAngle, secondaryAngle);
  const emoAlign = emotionalAlignment(primaryAngle, secondaryAngle);
  const reinf    = reinforcementEffect(primaryAngle, secondaryAngle);

  // Weights: semantic compat is most important, then emotional alignment
  const score = clamp(semComp * 0.50 + emoAlign * 0.28 + reinf * 0.22);

  return {
    score:                 r3(score),
    semanticCompatibility: r3(semComp),
    emotionalAlignment:    r3(emoAlign),
    reinforcementEffect:   r3(reinf),
    label:                 synergyLabel(score),
  };
}

function clamp(v: number): number { return Math.min(1, Math.max(0, v)); }
function r3(n: number): number { return Math.round(n * 1000) / 1000; }
