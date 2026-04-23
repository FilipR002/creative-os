// ─── Phase 5.4 — admin/system intelligence projection ────────────────────────
// MAY include system internals.
// MUST NOT expose raw client-level identifiers — use hashed or aggregated data.

import { PerformanceSnapshot }  from './performance.snapshot';
import { AggregatedPattern }    from '../../learning/cross-client/cross-client.interfaces';
import { GlobalInsights }       from '../../learning/cross-client/cross-client.interfaces';

export interface GlobalAngleEntry {
  angle:      string;
  industry:   string;
  avgCtr:     number;
  confidence: number;
  sampleSize: number;
}

export interface AdminDashboardView {
  globalAngleRanking: GlobalAngleEntry[];

  crossClientTrends: {
    industry:         string;
    topAngles:        string[];
    topFormats:       string[];
    fatigueProneKeys: string[];
  }[];

  systemHealth: {
    /** 0–1; derived from system_health_score avg across active clients. */
    memoryStability:    number;
    /** 0–1; entropy proxy from exploration rate distribution. */
    explorationEntropy: number;
    /** 0–1; ratio of FATIGUED+BLOCKED angles to total. */
    fatigueLoad:        number;
  };

  mirofishDiagnostics: {
    accuracyScore: number;
    driftFlags:    string[];
  };
}

export function buildAdminView(
  snapshot:   PerformanceSnapshot,
  patterns:   AggregatedPattern[],
  insights:   GlobalInsights,
): AdminDashboardView {
  // Angle ranking from aggregated cross-client patterns — no raw client data
  const globalAngleRanking: GlobalAngleEntry[] = [...patterns]
    .sort((a, b) => b.metrics.avgCTR - a.metrics.avgCTR || a.angle.localeCompare(b.angle))
    .slice(0, 20)
    .map(p => ({
      angle:      p.angle,
      industry:   p.industry,
      avgCtr:     p.metrics.avgCTR,
      confidence: p.confidence,
      sampleSize: p.sampleSize,
    }));

  // Cross-client trend summary by industry
  const crossClientTrends = Object.entries(insights.topAnglesByIndustry).map(
    ([industry, topAngles]) => ({
      industry,
      topAngles,
      topFormats:       insights.topFormatsByIndustry[industry] ?? [],
      fatigueProneKeys: insights.fatiguePronePatterns.filter(k => k.startsWith(industry)),
    }),
  );

  // System health from snapshot
  const dist            = snapshot.system.fatigueDistribution;
  const totalAngles     = snapshot.angles.length || 1;
  const unhealthyCount  = (dist['FATIGUED'] ?? 0) + (dist['BLOCKED'] ?? 0);

  const systemHealth = {
    memoryStability:    snapshot.system.systemHealthScore,
    explorationEntropy: snapshot.system.explorationRate,
    fatigueLoad:        Math.round((unhealthyCount / totalAngles) * 100) / 100,
  };

  const mirofishDiagnostics = {
    accuracyScore: snapshot.system.mirofishAccuracy,
    driftFlags:    snapshot.system.driftFlags,
  };

  return { globalAngleRanking, crossClientTrends, systemHealth, mirofishDiagnostics };
}
