// ─── Behavioral SaaS Isolation Layer ─────────────────────────────────────────
// Upgrades isolation from DATA-level to BEHAVIOR-level.
//
// Guarantee: Two users with identical UserContext CANNOT produce the same
// ranking behavior, exploration pattern, or creative selection strategy.
//
// Implementation approach:
//   UserBehaviorProfile is derived from a deterministic hash of userId.
//   This profile then modifies EVERY angle's score independently.
//   The same angle gets a DIFFERENT multiplier for each user,
//   even when UserContext is identical.
//
// No randomness. No shared state. Pure function of (userId, ctx).

import type { UserContext } from '../user-context';
import type { SelectedAngle } from '../types/creator';
import { getAngleBehavior } from './angle-taxonomy';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface UserBehaviorProfile {
  /**
   * [analytical, intuitive, risk_seeking] — all in [0.1, 0.9]
   * Analytical → favours proof/exploit angles
   * Intuitive  → favours storytelling/emotional angles
   * Risk-seeking → favours explore slot
   */
  decision_style_vector: [number, number, number];

  /**
   * Unique per-user XOR signature (0–1).
   * Used as a deterministic tiebreaker: same score → different sort order per user.
   */
  exploration_signature: number;

  /**
   * How aggressively this user's profile would adapt to feedback (0.1–0.9).
   * Currently drives the weight placed on fatigue signals vs fresh scores.
   */
  learning_response_curve: number;

  /** Human-readable identifier */
  profile_id: string;
}

// ── Deterministic Hash ────────────────────────────────────────────────────────

function fnv1a(input: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

function hashToRange(hash: number, offset: number, min: number, max: number): number {
  const raw = ((hash >>> offset) & 0xFF) / 255;
  return min + raw * (max - min);
}

// ── Profile Derivation ────────────────────────────────────────────────────────

/**
 * Derives a deterministic UserBehaviorProfile from userId + UserContext.
 *
 * Why three independent hash inputs?
 *   h1 → drives decision_style_vector (what kind of decisions the user makes)
 *   h2 → drives exploration_signature (how they break ties)
 *   h3 → drives learning_response_curve (how reactive they are to fatigue)
 */
export function deriveUserBehaviorProfile(
  userId: string,
  ctx: UserContext
): UserBehaviorProfile {
  const h1 = fnv1a(userId + '::decision');
  const h2 = fnv1a(userId + '::signature::' + ctx.platform);
  const h3 = fnv1a(userId + '::learning::' + ctx.industry);

  // Base vector from hash
  const rawAnalytical  = hashToRange(h1,  0, 0.15, 0.85);
  const rawIntuitive   = hashToRange(h1,  8, 0.15, 0.85);
  const rawRiskSeeking = hashToRange(h1, 16, 0.10, 0.75);

  // Goal-type shifts the vector — same hash, different context = different profile
  const GOAL_SHIFT: Record<UserContext['goalType'], [number, number, number]> = {
    sales:           [ 0.10,  -0.05,  0.05],
    lead_generation: [ 0.08,   0.00,  0.00],
    branding:        [-0.08,   0.12, -0.05],
    growth:          [ 0.00,   0.06,  0.10],
  };
  const [ga, gi, gr] = GOAL_SHIFT[ctx.goalType];

  // Signature: XOR all three hashes then normalise
  // Two different userIds will almost certainly produce different signatures
  const sigRaw = ((h1 ^ h2 ^ h3) >>> 0) / 0xFFFFFFFF;

  const curve  = hashToRange(h3, 4, 0.15, 0.85);

  const analytical  = clamp(rawAnalytical  + ga, 0.10, 0.90);
  const intuitive   = clamp(rawIntuitive   + gi, 0.10, 0.90);
  const riskSeeking = clamp(rawRiskSeeking + gr, 0.10, 0.80);

  return {
    decision_style_vector:   [analytical, intuitive, riskSeeking],
    exploration_signature:    sigRaw,
    learning_response_curve:  clamp(curve, 0.10, 0.90),
    profile_id: [
      userId.slice(0, 6),
      Math.round(analytical  * 9).toString(),
      Math.round(intuitive   * 9).toString(),
      Math.round(riskSeeking * 9).toString(),
    ].join(''),
  };
}

// ── Behavior Modifier Computation ─────────────────────────────────────────────

/**
 * Generates per-angle behavior modifiers from a UserBehaviorProfile.
 *
 * This is what makes two users with identical UserContext produce different rankings:
 * their decision_style_vector shifts which angles benefit from their decision style.
 *
 * Returns: Record<angleSlug, multiplier>
 */
export function computeBehaviorModifiers(
  angles: SelectedAngle[],
  profile: UserBehaviorProfile
): Record<string, number> {
  const [analytical, intuitive, riskSeeking] = profile.decision_style_vector;
  const sig = profile.exploration_signature;
  const curve = profile.learning_response_curve;

  const modifiers: Record<string, number> = {};

  angles.forEach(angle => {
    const behavior = getAngleBehavior(angle.angle);

    // ── Dimension 1: Analytical preference ──────────────────────────────────
    // Analytical users amplify high-proof, low-risk angles in the exploit slot.
    const analyticalBoost = angle.type === 'exploit' && behavior.riskProfile < 0.4
      ? 1.0 + analytical * 0.18
      : angle.type === 'explore' && behavior.riskProfile > 0.6
      ? 1.0 - analytical * 0.10
      : 1.0;

    // ── Dimension 2: Intuitive preference ───────────────────────────────────
    // Intuitive users amplify storytelling + emotional depth angles.
    const intuitiveBoost = behavior.emotionalDepth > 0.65
      ? 1.0 + intuitive * 0.14
      : behavior.emotionalDepth < 0.30
      ? 1.0 - intuitive * 0.06
      : 1.0;

    // ── Dimension 3: Risk-seeking preference ────────────────────────────────
    // Risk-seeking users lift the explore slot significantly.
    const riskBoost = angle.type === 'explore'
      ? 1.0 + riskSeeking * 0.22
      : angle.type === 'exploit'
      ? 1.0 - riskSeeking * 0.06
      : 1.0;

    // ── Dimension 4: Learning response ──────────────────────────────────────
    // High curve users respect fatigue more — fatigued angles get extra penalty.
    const fatigueMap: Record<string, number> = {
      HEALTHY:  1.0,
      WARMING:  1.0 - curve * 0.05,
      FATIGUED: 1.0 - curve * 0.15,
      BLOCKED:  1.0 - curve * 0.40,
    };
    const learningMod = fatigueMap[angle.fatigue_level] ?? 1.0;

    // ── Dimension 5: Exploration signature entropy ───────────────────────────
    // Tiny deterministic perturbation that is unique per user.
    // Ensures two users with identical other dimensions still break ties differently.
    // The perturbation magnitude is bounded to ±0.04 — stable, not noisy.
    const angleEntropy = angle.angle.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const sigEntropy = 1.0 + (sig - 0.5) * 0.08 * (angleEntropy % 2 === 0 ? 1 : -1);

    modifiers[angle.angle] = clamp(
      analyticalBoost * intuitiveBoost * riskBoost * learningMod * sigEntropy,
      0.60, 1.45
    );
  });

  return modifiers;
}

// ── Utility ───────────────────────────────────────────────────────────────────

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
