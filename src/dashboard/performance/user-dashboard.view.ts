// ─── Phase 5.4 — client-facing projection ─────────────────────────────────────
// MUST NOT expose system internals, raw scores, or MIROFISH diagnostics.
// Output is actionable only.

import { PerformanceSnapshot } from './performance.snapshot';
import { decayFactor }         from '../../trends/trend-signal.interface';
import { TrendStore }          from '../../trends/trend-store.service';

export interface UserDashboardView {
  /** Top 5 angles by composite strength score. */
  topAngles: string[];

  /** Top 3 hooks by effective win rate (adjusted for reuse penalty). */
  bestHooks: string[];

  /** Top 3 formats by avg score. */
  bestFormats: string[];

  /** Plain-English recommendations derived from snapshot state. */
  recommendedActions: string[];

  /**
   * Delta from system learning efficiency baseline.
   * Positive = improving, negative = degrading.
   */
  performanceDelta: number;
}

export function buildUserView(
  snapshot: PerformanceSnapshot,
  industry: string,
  trendStore: TrendStore,
): UserDashboardView {
  const topAngles = [...snapshot.angles]
    .sort((a, b) => b.strengthScore - a.strengthScore || a.slug.localeCompare(b.slug))
    .slice(0, 5)
    .map(a => a.slug);

  const bestHooks = [...snapshot.hooks]
    .sort((a, b) => {
      const scoreA = a.winRate * (1 - a.reusePenalty);
      const scoreB = b.winRate * (1 - b.reusePenalty);
      return scoreB - scoreA || a.structure.localeCompare(b.structure);
    })
    .slice(0, 3)
    .map(h => h.structure);

  const bestFormats = [...snapshot.formats]
    .sort((a, b) => b.avgScore - a.avgScore || a.format.localeCompare(b.format))
    .slice(0, 3)
    .map(f => f.format);

  const recommendedActions = deriveActions(snapshot, industry, trendStore);

  // Normalise efficiency to a -1…+1 delta (baseline = 0.5)
  const performanceDelta = Math.round(
    (snapshot.system.learningEfficiencyIndex - 0.5) * 100,
  ) / 100;

  return { topAngles, bestHooks, bestFormats, recommendedActions, performanceDelta };
}

function deriveActions(
  snapshot: PerformanceSnapshot,
  industry: string,
  trendStore: TrendStore,
): string[] {
  const actions: string[] = [];
  const dist = snapshot.system.fatigueDistribution;

  if ((dist['BLOCKED'] ?? 0) > 0) {
    actions.push('Blocked angles detected — introduce new angle variants');
  }
  if ((dist['FATIGUED'] ?? 0) > 0) {
    actions.push('Fatigued angles present — rotate to fresher creatives');
  }
  if (snapshot.trends.rising.length > 0) {
    actions.push(`Rising trend detected: "${snapshot.trends.rising[0]}" — consider testing`);
  }
  if (snapshot.system.systemHealthScore < 0.5) {
    actions.push('Learning velocity is low — run a new performance cycle');
  }
  if (snapshot.system.driftFlags.length > 0) {
    actions.push('Model drift detected — review recent decision patterns');
  }

  const topHookTrend = trendStore.getTop('hook', industry)[0];
  if (topHookTrend && decayFactor(topHookTrend.timestamp) > 0.5) {
    actions.push(`Current hook trend: "${topHookTrend.value}" — high relevance`);
  }

  if (actions.length === 0) {
    actions.push('Performance is stable — continue current strategy');
  }

  return actions;
}
