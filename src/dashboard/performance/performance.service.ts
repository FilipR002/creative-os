// ─── Phase 5.4 — read-only aggregator service ────────────────────────────────
// NEVER modifies runtime state. NEVER recomputes scores.
// Reads pre-computed data from existing services and projects views.

import { Injectable, Logger, Optional }  from '@nestjs/common';
import { GlobalMemoryService }           from '../../global-memory/global-memory.service';
import { FatigueService }                from '../../fatigue/fatigue.service';
import { CrossClientLearningService }    from '../../learning/cross-client/cross-client-learning.service';
import { TrendStore }                    from '../../trends/trend-store.service';
import {
  PerformanceSnapshot,
  DashboardTimeframe,
  FormatPerformance,
} from './performance.snapshot';
import { UserDashboardView, buildUserView }   from './user-dashboard.view';
import { AdminDashboardView, buildAdminView } from './admin-dashboard.view';
import { decayFactor }                        from '../../trends/trend-signal.interface';

interface CacheEntry {
  snapshot:  PerformanceSnapshot;
  expiresAt: number;
}

const CACHE_TTL_MS   = 5 * 60 * 1000;   // 5 minutes
const ADMIN_CACHE_KEY = '__admin__';

@Injectable()
export class PerformanceService {
  private readonly logger = new Logger(PerformanceService.name);
  private readonly cache  = new Map<string, CacheEntry>();

  constructor(
    @Optional() private readonly globalMemory: GlobalMemoryService,
    @Optional() private readonly fatigue:      FatigueService,
    private readonly crossClient: CrossClientLearningService,
    private readonly trendStore:  TrendStore,
  ) {}

  // ── Public API ──────────────────────────────────────────────────────────────

  async getSnapshot(
    clientId:  string,
    timeframe: DashboardTimeframe = '7d',
  ): Promise<PerformanceSnapshot> {
    const cacheKey = `${clientId}:${timeframe}`;
    const cached   = this.cache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) return cached.snapshot;

    const snapshot = await this.buildSnapshot(clientId, timeframe);
    this.cache.set(cacheKey, { snapshot, expiresAt: Date.now() + CACHE_TTL_MS });
    return snapshot;
  }

  async getUserView(
    clientId:  string,
    industry:  string,
    timeframe: DashboardTimeframe = '7d',
  ): Promise<UserDashboardView> {
    const snapshot = await this.getSnapshot(clientId, timeframe);
    return buildUserView(snapshot, industry, this.trendStore);
  }

  async getAdminView(industry = 'general'): Promise<AdminDashboardView> {
    const cached = this.cache.get(ADMIN_CACHE_KEY);
    if (cached && Date.now() < cached.expiresAt) {
      return buildAdminView(
        cached.snapshot,
        this.crossClient.getPatternsForIndustry(industry),
        this.crossClient.getGlobalInsights(),
      );
    }
    // Admin snapshot uses only anonymized cross-client data — no raw per-client memory.
    const snapshot = this.buildAdminSnapshot();
    this.cache.set(ADMIN_CACHE_KEY, { snapshot, expiresAt: Date.now() + CACHE_TTL_MS });
    return buildAdminView(
      snapshot,
      this.crossClient.getPatternsForIndustry(industry),
      this.crossClient.getGlobalInsights(),
    );
  }

  // ── Snapshot builder ────────────────────────────────────────────────────────

  private async buildSnapshot(
    clientId:  string | null,
    timeframe: DashboardTimeframe,
  ): Promise<PerformanceSnapshot> {
    const [memoryOutput, fatigueResults] = await Promise.all([
      this.fetchMemory(clientId),
      this.fetchFatigue(clientId),
    ]);

    // ── Angles ────────────────────────────────────────────────────────────────
    const angles = (memoryOutput?.angle_memory_updates ?? []).map(a => ({
      slug:          a.angle,
      ctr:           a.ctr,
      conversion:    a.conversion,
      retention:     a.retention,
      strengthScore: a.strength_score,
      decayRate:     a.decay_rate,
    }));

    // ── Hooks ─────────────────────────────────────────────────────────────────
    const hooks = (memoryOutput?.hook_memory_updates ?? []).map(h => ({
      structure:    h.structure,
      format:       h.format,
      avgScore:     h.avg_score,
      winRate:      h.win_rate,
      sampleCount:  h.sample_count,
      reusePenalty: h.reuse_penalty,
    }));

    // ── Formats (derived from hooks) ──────────────────────────────────────────
    const formatMap = new Map<string, { total: number; count: number }>();
    for (const h of hooks) {
      const e = formatMap.get(h.format) ?? { total: 0, count: 0 };
      e.total += h.avgScore;
      e.count += 1;
      formatMap.set(h.format, e);
    }
    const formats: FormatPerformance[] = [...formatMap.entries()]
      .map(([fmt, e]) => ({ format: fmt, avgScore: Math.round((e.total / e.count) * 1000) / 1000, count: e.count }))
      .sort((a, b) => b.avgScore - a.avgScore || a.format.localeCompare(b.format));

    // ── Fatigue distribution ──────────────────────────────────────────────────
    const fatigueDistribution: Record<string, number> = {};
    let explorationRate = 0;
    for (const r of fatigueResults) {
      fatigueDistribution[r.fatigue_state] = (fatigueDistribution[r.fatigue_state] ?? 0) + 1;
      explorationRate += isFinite(r.exploration_signal) ? r.exploration_signal : 0;
    }
    if (fatigueResults.length > 0) explorationRate /= fatigueResults.length;

    // ── System health (from GlobalMemory) ─────────────────────────────────────
    const sys                    = memoryOutput?.system_memory_updates;
    const systemHealthScore      = sys?.system_health_score      ?? 0.5;
    const learningEfficiencyIndex = sys?.learning_efficiency_index ?? 0.5;
    const driftFlags              = sys?.drift_flags               ?? [];

    // MIROFISH accuracy: avg from campaign memory updates
    const campaignMemory    = memoryOutput?.campaign_memory_updates ?? [];
    const mirofishAccuracy  = campaignMemory.length > 0
      ? campaignMemory.reduce((s, c) => s + (isFinite(c.mirofish_accuracy) ? c.mirofish_accuracy : 0), 0) / campaignMemory.length
      : 0.5;

    return {
      clientId,
      timeframe,
      generatedAt: Date.now(),
      angles,
      hooks,
      formats,
      system: {
        fatigueDistribution,
        explorationRate:         Math.round(explorationRate * 10000) / 10000,
        mirofishAccuracy:        Math.round(mirofishAccuracy * 1000) / 1000,
        systemHealthScore,
        learningEfficiencyIndex,
        driftFlags,
      },
      trends: this.classifyTrends(),
    };
  }

  // ── Admin snapshot (anonymized, no raw client data) ────────────────────────

  private buildAdminSnapshot(): PerformanceSnapshot {
    const adminData = this.crossClient.getAggregatedAdminSnapshot();
    const trends    = this.classifyTrends();

    return {
      clientId:    null,
      timeframe:   '30d',
      generatedAt: Date.now(),
      angles: adminData.angles.map(a => ({
        slug:          a.slug,
        ctr:           a.avgCtr,
        conversion:    a.avgConversion,
        retention:     a.avgRetention,
        strengthScore: a.confidence,
        decayRate:     0,
      })),
      hooks:   [],
      formats: [],
      system: {
        fatigueDistribution:     {},
        explorationRate:         0,
        mirofishAccuracy:        adminData.systemHealthScore,
        systemHealthScore:       adminData.systemHealthScore,
        learningEfficiencyIndex: adminData.learningEfficiencyIndex,
        driftFlags:              adminData.driftFlags,
      },
      trends,
    };
  }

  private classifyTrends(): PerformanceSnapshot['trends'] {
    const allTrends = this.trendStore.getAll();
    const nowMs     = Date.now();
    const oneDayMs  = 86_400_000;
    return {
      active:  allTrends.filter(t => nowMs - t.timestamp < oneDayMs).map(t => t.value),
      rising:  allTrends.filter(t => t.velocity > 0.5).map(t => t.value),
      falling: allTrends.filter(t => t.velocity < -0.3 || decayFactor(t.timestamp) < 0.3).map(t => t.value),
    };
  }

  // ── Data fetchers (isolated try/catch per source) ──────────────────────────

  private async fetchMemory(clientId: string | null) {
    if (!this.globalMemory) return null;
    try {
      return await this.globalMemory.query(clientId ?? undefined);
    } catch (err) {
      this.logger.warn(`fetchMemory(${clientId}): ${(err as Error).message}`);
      return null;
    }
  }

  private async fetchFatigue(clientId: string | null) {
    if (!this.fatigue) return [];
    try {
      return await this.fatigue.computeAll(undefined, clientId ?? undefined);
    } catch (err) {
      this.logger.warn(`fetchFatigue(${clientId}): ${(err as Error).message}`);
      return [];
    }
  }
}
