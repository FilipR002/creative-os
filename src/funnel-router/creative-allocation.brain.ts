/**
 * creative-allocation.brain.ts
 *
 * Creative Allocation Brain — Phase 1.2
 *
 * Determines how many variants to generate per format based on:
 *   - Format allocation ratios (from FormatDecision)
 *   - Budget level (sets total variant budget)
 *   - Active formats (only allocated formats get variants)
 *
 * Budget → total variant pool:
 *   low:    3 total  (all go to primary format)
 *   medium: 6 total  (split primary 4 + secondary 2)
 *   high:   10 total (full persona × hook matrix possible)
 *
 * Allocation: floor(ratio × pool) per format, remainder goes to primary.
 *
 * Pure function — no DI.
 */

import type {
  BudgetLevel,
  CreativeFormat,
  FormatDecision,
  VariantAllocation,
} from './funnel-router.types';

// ─── Budget → variant pool ────────────────────────────────────────────────────

const BUDGET_VARIANT_POOL: Record<BudgetLevel, number> = {
  low:    3,
  medium: 6,
  high:   10,
};

// ─── Allocator ────────────────────────────────────────────────────────────────

export function allocateVariants(opts: {
  decision: FormatDecision;
  budget:   BudgetLevel;
}): VariantAllocation {
  const { decision, budget } = opts;
  const pool     = BUDGET_VARIANT_POOL[budget];
  const active   = decision.activeFormats;
  const alloc    = decision.allocation;

  // Compute raw variants per active format
  const raw: Partial<Record<CreativeFormat, number>> = {};
  let assigned = 0;

  for (const fmt of active) {
    const share = alloc[fmt];
    const count = Math.max(1, Math.floor(share * pool));
    raw[fmt]    = count;
    assigned   += count;
  }

  // Distribute remainder to primary format
  const remainder = pool - assigned;
  const primary   = decision.primaryFormat;
  if (remainder > 0 && raw[primary] !== undefined) {
    raw[primary] = (raw[primary] ?? 0) + remainder;
  }

  const ugcVariants      = raw['ugc']      ?? 0;
  const carouselVariants = raw['carousel'] ?? 0;
  const bannerVariants   = raw['banner']   ?? 0;

  // Priority order: active formats sorted by allocation weight
  const priority = [...active].sort(
    (a, b) => (alloc[b] ?? 0) - (alloc[a] ?? 0),
  );

  return {
    ugcVariants,
    carouselVariants,
    bannerVariants,
    priority,
    totalVariants: ugcVariants + carouselVariants + bannerVariants,
  };
}
