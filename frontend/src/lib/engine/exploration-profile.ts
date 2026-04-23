// ─── Personalized Exploration System ─────────────────────────────────────────
// Replaces global exploration randomness with per-user exploration vectors.
//
// Guarantees:
//   - Same userId → always same ExplorationProfile (deterministic)
//   - Different userId → statistically different profiles (isolated)
//   - UserContext modulates the profile (context-aware)
//   - No global randomness: Math.random() is NEVER called
//
// Formula:
//   ExplorationScore =
//     BaseExploration
//     × UserExplorationBias
//     × SystemFatigueModifier
//     × NoveltyPreferenceFactor

import type { UserContext } from '../user-context';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ExplorationProfile {
  /** How strongly this user boosts the explore slot (0.1–0.95) */
  exploration_bias:   number;
  /** How comfortable this user is with high-risk angles (0.05–0.95) */
  risk_tolerance:     number;
  /** How much this user prefers unseen / novel angles (0.05–0.95) */
  novelty_preference: number;
  /** Derived fingerprint — unique per user, human-readable */
  profile_id: string;
}

// ── Deterministic Hash Functions ──────────────────────────────────────────────
// FNV-1a 32-bit — fast, well-distributed, no randomness.

function fnv1a(input: string): number {
  let hash = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash;
}

/** Extract a float in [0, 1] from a hash, using a bit-window offset. */
function hashSegment(hash: number, offset: number, bits = 16): number {
  const mask   = (1 << bits) - 1;
  const maxVal = mask;
  return ((hash >>> offset) & mask) / maxVal;
}

// ── Profile Derivation ────────────────────────────────────────────────────────

/**
 * Derive an ExplorationProfile for a user.
 * Deterministic: calling twice with same args returns identical result.
 * User-specific: different userIds produce statistically different profiles.
 */
export function deriveExplorationProfile(
  userId: string,
  ctx: UserContext
): ExplorationProfile {
  // Three independent hash seeds (different namespaces = independent dimensions)
  const h_base    = fnv1a(userId + '::exploration');
  const h_risk    = fnv1a(userId + '::risk::' + ctx.goalType);
  const h_novelty = fnv1a(userId + '::novelty::' + ctx.industry);

  // Raw user-specific base values (0–1, deterministic)
  const rawExploration = hashSegment(h_base,    0, 16);
  const rawRisk        = hashSegment(h_risk,    8, 16);
  const rawNovelty     = hashSegment(h_novelty, 4, 16);

  // Context multipliers — UserContext modulates (never overrides) the base
  const riskMultiplier: Record<UserContext['riskLevel'], number> = {
    safe:       0.45,   // safe users get compressed exploration
    balanced:   0.72,
    aggressive: 1.00,
  };
  const styleMultiplier: Record<UserContext['contentStyle'], number> = {
    viral:           1.20,
    educational:     0.82,
    direct_response: 0.75,
    storytelling:    0.95,
  };

  const rm = riskMultiplier[ctx.riskLevel];
  const sm = styleMultiplier[ctx.contentStyle];

  const profile_id = [
    userId.slice(0, 6),
    ctx.riskLevel[0].toUpperCase(),
    ctx.contentStyle[0].toUpperCase(),
    Math.round(rawExploration * 99).toString().padStart(2, '0'),
  ].join('-');

  return {
    exploration_bias:   clamp(rawExploration * rm,       0.08, 0.95),
    risk_tolerance:     clamp(rawRisk        * rm,       0.05, 0.95),
    novelty_preference: clamp(rawNovelty     * sm * rm,  0.05, 0.95),
    profile_id,
  };
}

// ── Exploration Score Computation ─────────────────────────────────────────────

const FATIGUE_MODIFIER: Record<string, number> = {
  HEALTHY:  1.00,
  WARMING:  0.82,
  FATIGUED: 0.55,
  BLOCKED:  0.00,
};

/**
 * Compute the final exploration score for an angle.
 * Used ONLY for the explore slot — exploit/secondary use contextScore directly.
 *
 * @param baseScore         - Raw score from backend
 * @param profile           - User's ExplorationProfile
 * @param fatigueLevel      - Angle's current fatigue state
 * @param isNovel           - Whether this angle is underused for this user
 */
export function computeExplorationScore(
  baseScore:    number,
  profile:      ExplorationProfile,
  fatigueLevel: string,
  isNovel      = false
): number {
  const fatigueMod = FATIGUE_MODIFIER[fatigueLevel] ?? 1.0;

  // Novel angles get an extra push scaled by novelty_preference
  const noveltyFactor = isNovel
    ? 1.0 + profile.novelty_preference * 0.35
    : 1.0;

  return clamp(
    baseScore
    * profile.exploration_bias
    * fatigueMod
    * noveltyFactor,
    0.01, 0.95
  );
}

// ── Utility ───────────────────────────────────────────────────────────────────

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
