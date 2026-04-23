// ─── Context-Aware Ranking Engine ────────────────────────────────────────────
// Transforms generic backend scores into user-specific rankings.
//
// Formula:
//   FinalWeight(angle) =
//     BaseEngineScore
//     × GoalModifier(userCtx.goalType)
//     × PlatformModifier(userCtx.platform)
//     × StyleModifier(userCtx.contentStyle)
//     × RiskAlignmentModifier(userCtx.riskLevel)
//     × BehaviorModifier(userBehaviorProfile)
//
// NO static scoring. NO global weights. NO universal behavior.
// Every output is a function of UserContext + SystemState.

import type { UserContext } from '../user-context';
import type { SelectedAngle } from '../types/creator';
import { getAngleBehavior } from './angle-taxonomy';

// ── Individual Modifier Functions ─────────────────────────────────────────────

/**
 * Goal modifier — amplifies angles that serve the user's declared goal.
 * Penalises misaligned angles instead of treating all goals equally.
 */
export function goalModifier(
  goalType: UserContext['goalType'],
  slug: string
): number {
  const { goalAffinity, conversionWeight } = getAngleBehavior(slug);

  if (goalAffinity.length === 0) return 1.0; // unknown angle: neutral

  if (goalAffinity.includes(goalType)) {
    // Strong match: scale boost by conversion weight (sales → rewards high-conversion angles more)
    const conversionBonus = goalType === 'sales' || goalType === 'lead_generation'
      ? conversionWeight * 0.20
      : 0.12;
    return 1.0 + conversionBonus;
  }

  // Misalignment penalty — branding angles on a sales goal, etc.
  return 0.87;
}

/**
 * Platform modifier — platforms have different format norms.
 * TikTok rewards novelty; Google Ads rewards proven direct-response.
 */
export function platformModifier(
  platform: UserContext['platform'],
  slug: string
): number {
  const { platformAffinity, noveltyScore } = getAngleBehavior(slug);

  if (platformAffinity.length === 0) return 1.0;

  if (platformAffinity.includes(platform)) {
    // Platform-native bonus: TikTok rewards fresh angles harder
    const platformBonus = platform === 'TikTok'
      ? 0.10 + noveltyScore * 0.08
      : platform === 'YouTube'
      ? 0.08
      : 0.10;
    return 1.0 + platformBonus;
  }

  return 0.91; // off-platform penalty
}

/**
 * Content style modifier — matches the user's declared creative style.
 * Direct response ≠ storytelling: wrong style gets penalised.
 */
export function styleModifier(
  contentStyle: UserContext['contentStyle'],
  slug: string
): number {
  const { styleAffinity, emotionalDepth } = getAngleBehavior(slug);

  if (styleAffinity.length === 0) return 1.0;

  if (styleAffinity.includes(contentStyle)) {
    const depthBonus = contentStyle === 'storytelling'
      ? emotionalDepth * 0.18
      : contentStyle === 'viral'
      ? 0.14
      : 0.12;
    return 1.0 + depthBonus;
  }

  return 0.89;
}

/**
 * Risk alignment modifier — angles with matching risk profiles score higher.
 * Safe users are penalised on hot_take; aggressive users are penalised on proof.
 * This is what makes "same inputs, same goals" produce DIFFERENT rankings per risk level.
 */
export function riskAlignmentModifier(
  riskLevel: UserContext['riskLevel'],
  slug: string
): number {
  const { riskProfile } = getAngleBehavior(slug);
  const targetRisk = { safe: 0.20, balanced: 0.50, aggressive: 0.80 }[riskLevel];

  // Distance from ideal risk: 0 = perfect match, 1 = complete mismatch
  const delta = Math.abs(targetRisk - riskProfile);

  // Reward alignment; penalise distance
  // delta 0.0 → +0.20 | delta 0.3 → +0.06 | delta 0.6+ → penalty
  return 1.0 + (0.20 * (1 - delta * 1.5));
}

// ── Context Modifier Layer (combines all modifiers) ───────────────────────────

export interface ContextModifierBreakdown {
  goal:         number;
  platform:     number;
  style:        number;
  riskAlignment: number;
  combined:     number; // geometric mean
}

export function computeContextModifier(
  slug: string,
  ctx: UserContext
): ContextModifierBreakdown {
  const goal         = goalModifier(ctx.goalType, slug);
  const platform     = platformModifier(ctx.platform, slug);
  const style        = styleModifier(ctx.contentStyle, slug);
  const riskAlignment = riskAlignmentModifier(ctx.riskLevel, slug);

  // Geometric mean: no single modifier dominates the outcome
  const combined = Math.pow(goal * platform * style * riskAlignment, 0.25);

  return { goal, platform, style, riskAlignment, combined };
}

// ── Ranked Angle Output ───────────────────────────────────────────────────────

export interface ContextRankedAngle extends SelectedAngle {
  contextModifiers: ContextModifierBreakdown;
  contextScore: number; // baseScore × combined modifier × behaviorMod
}

/**
 * Apply context-aware ranking to backend angles.
 * Preserves slot structure (exploit → secondary → explore) but re-ranks within slots.
 * behaviorModifiers: per-angle floats from UserBehaviorProfile (user-specific isolation).
 */
export function applyContextRanking(
  angles: SelectedAngle[],
  ctx: UserContext,
  behaviorModifiers: Record<string, number>
): ContextRankedAngle[] {
  const ranked = angles.map<ContextRankedAngle>(angle => {
    const modBreakdown = computeContextModifier(angle.angle, ctx);
    const behaviorMod  = behaviorModifiers[angle.angle] ?? 1.0;

    const contextScore = clamp(
      angle.confidence_score * modBreakdown.combined * behaviorMod,
      0.01, 0.99
    );

    return {
      ...angle,
      confidence_score: contextScore,   // ← updated score drives downstream display
      contextModifiers:  modBreakdown,
      contextScore,
    };
  });

  // Sort: preserve slot order, re-rank by contextScore within each slot
  const SLOT_ORDER: Record<string, number> = { exploit: 0, secondary: 1, explore: 2 };
  ranked.sort((a, b) => {
    const slotDiff = (SLOT_ORDER[a.type] ?? 3) - (SLOT_ORDER[b.type] ?? 3);
    if (slotDiff !== 0) return slotDiff;
    return b.contextScore - a.contextScore;
  });

  // Re-assign slot labels after re-ranking within slots
  // (the top exploit after re-ranking is THE exploit)
  return ranked;
}

// ── Utility ───────────────────────────────────────────────────────────────────

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
