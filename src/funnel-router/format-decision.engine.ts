/**
 * format-decision.engine.ts
 *
 * Format Decision Engine — Phase 1.2
 *
 * Given a funnel intent, computes the exact allocation ratio per format
 * and declares primary + secondary formats.
 *
 * Allocation rules (by funnel stage):
 *
 *   TOFU  → ugc:0.60 carousel:0.30 banner:0.10  (awareness-first, UGC dominates)
 *   MOFU  → carousel:0.50 ugc:0.35 banner:0.15  (carousel educates warm audiences)
 *   BOFU  → banner:0.45 ugc:0.40 carousel:0.15  (retargeting CTA push)
 *
 * Budget modifier:
 *   low    → only activeFormats = [primaryFormat]
 *   medium → activeFormats = [primary, secondary]
 *   high   → activeFormats = all recommendedFormats
 *
 * Pure functions — no DI, no side effects.
 */

import type {
  FunnelStage,
  BudgetLevel,
  CreativeFormat,
  FormatAllocation,
  FormatDecision,
  FunnelIntentResult,
} from './funnel-router.types';

// ─── Stage → allocation table ─────────────────────────────────────────────────

const STAGE_ALLOCATION: Record<FunnelStage, FormatAllocation> = {
  TOFU: { ugc: 0.60, carousel: 0.30, banner: 0.10 },
  MOFU: { ugc: 0.35, carousel: 0.50, banner: 0.15 },
  BOFU: { ugc: 0.40, carousel: 0.15, banner: 0.45 },
};

// ─── Allocation → ranked formats ─────────────────────────────────────────────

function rankFormats(alloc: FormatAllocation): CreativeFormat[] {
  return (Object.entries(alloc) as [CreativeFormat, number][])
    .sort((a, b) => b[1] - a[1])
    .map(([fmt]) => fmt);
}

// ─── Budget → active format count ────────────────────────────────────────────

const BUDGET_ACTIVE_COUNT: Record<BudgetLevel, number> = {
  low:    1,
  medium: 2,
  high:   3,
};

// ─── Public engine function ───────────────────────────────────────────────────

export function decideFormats(opts: {
  intent:      FunnelIntentResult;
  budget:      BudgetLevel;
}): FormatDecision {
  const { intent, budget } = opts;
  const stage      = intent.funnelStage;
  const allocation = STAGE_ALLOCATION[stage];
  const ranked     = rankFormats(allocation);

  const activeCount   = Math.min(BUDGET_ACTIVE_COUNT[budget], intent.recommendedFormats.length);
  const activeFormats = ranked.slice(0, activeCount) as CreativeFormat[];

  return {
    allocation,
    primaryFormat:   ranked[0],
    secondaryFormat: ranked[1] ?? ranked[0],
    activeFormats,
  };
}
