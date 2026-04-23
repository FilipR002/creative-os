// ─── Phase 9.1 — Emergence & Drift Tracking Layer ────────────────────────────
//
// READ-ONLY analytics layer. Zero side effects on scoring, selection, or learning.
// Computes 5 system-health signals from existing DB tables:
//
//   1. driftScore       — system improving or degrading? (−1 → +1)
//   2. learningVelocity — how fast weights are shifting  (0 → 1)
//   3. explorationRatio — % of selections outside top-3  (0 → 1)
//   4. diversityIndex   — Shannon entropy of angle usage (0 → 1)
//   5. systemStatus     — IMPROVING | STAGNATING | OVERFITTING
//
// Data sources used:
//   campaign_outcomes         → driftScore (performanceScore window comparison)
//   angle_performance_stats   → learningVelocity (report count rate + score spread)
//   creative_memory           → explorationRatio + diversityIndex (angle usage history)
//   autonomous_loop_cycles    → learningVelocity supplement (entropy over cycles)
//
// Cache: 1-hour TTL (recomputed at most once per hour to avoid heavy scans).

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService }      from '../prisma/prisma.service';

export interface SystemEmergenceState {
  driftScore:          number;   // [-1, +1]
  learningVelocity:    number;   // [0, 1]
  explorationRatioAvg: number;   // [0, 1]
  diversityIndex:      number;   // [0, 1]
  systemStatus:        'IMPROVING' | 'STAGNATING' | 'OVERFITTING';
  computedAt:          string;
  dataPoints: {
    recentOutcomes:  number;
    previousOutcomes: number;
    anglesTracked:   number;
    selectionsLast7d: number;
  };
}

const CACHE_TTL_MS = 60 * 60 * 1000;  // 1 hour

@Injectable()
export class EmergenceService {
  private readonly logger = new Logger(EmergenceService.name);
  private cached:    SystemEmergenceState | null = null;
  private cacheTime: number = 0;

  constructor(private readonly prisma: PrismaService) {}

  // ── Public API ─────────────────────────────────────────────────────────────

  async getState(): Promise<SystemEmergenceState> {
    if (this.cached && Date.now() - this.cacheTime < CACHE_TTL_MS) {
      this.logger.debug('[9.1] Cache hit');
      return this.cached;
    }
    const state = await this.compute();
    this.cached    = state;
    this.cacheTime = Date.now();
    this.logger.log(
      `[9.1] status=${state.systemStatus} drift=${state.driftScore.toFixed(3)} ` +
      `velocity=${state.learningVelocity.toFixed(3)} diversity=${state.diversityIndex.toFixed(3)}`
    );
    return state;
  }

  /** Force recomputation regardless of cache. */
  async refresh(): Promise<SystemEmergenceState> {
    this.cacheTime = 0;
    return this.getState();
  }

  // ── Core computation ───────────────────────────────────────────────────────

  private async compute(): Promise<SystemEmergenceState> {
    const now   = new Date();
    const d7    = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000);
    const d14   = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const [drift, velocity, exploration, diversity] = await Promise.all([
      this.computeDriftScore(d7, d14),
      this.computeLearningVelocity(d7),
      this.computeExplorationRatio(d7),
      this.computeDiversityIndex(d7),
    ]);

    return {
      driftScore:          drift.score,
      learningVelocity:    velocity.score,
      explorationRatioAvg: exploration.score,
      diversityIndex:      diversity.score,
      systemStatus:        this.classify(drift.score, exploration.score, diversity.score),
      computedAt:          now.toISOString(),
      dataPoints: {
        recentOutcomes:   drift.recentCount,
        previousOutcomes: drift.prevCount,
        anglesTracked:    velocity.anglesTracked,
        selectionsLast7d: exploration.total,
      },
    };
  }

  // ── 1. DRIFT SCORE ─────────────────────────────────────────────────────────
  // Compares average performanceScore in the last 7 days vs the 7 days before.
  // driftScore = delta / max(pooledVariance, 0.01), clamped [-1, +1].
  // Returns 0 when there is insufficient data (< 3 outcomes in either window).

  private async computeDriftScore(from7: Date, from14: Date): Promise<{
    score: number; recentCount: number; prevCount: number;
  }> {
    const [recent, previous] = await Promise.all([
      this.prisma.campaignOutcome.aggregate({
        where: { createdAt: { gte: from7 } },
        _avg:  { performanceScore: true },
        _count: { id: true },
        _min:  { performanceScore: true },
        _max:  { performanceScore: true },
      }),
      this.prisma.campaignOutcome.aggregate({
        where: { createdAt: { gte: from14, lt: from7 } },
        _avg:  { performanceScore: true },
        _count: { id: true },
        _min:  { performanceScore: true },
        _max:  { performanceScore: true },
      }),
    ]);

    const recentCount = recent._count.id;
    const prevCount   = previous._count.id;

    if (recentCount < 3 || prevCount < 3) {
      return { score: 0, recentCount, prevCount };
    }

    const recentAvg = recent._avg.performanceScore   ?? 0.25;
    const prevAvg   = previous._avg.performanceScore ?? 0.25;
    const delta     = recentAvg - prevAvg;

    // Pooled range-based variance proxy — avoids needing stddev support from Prisma
    const recentRange = (recent._max.performanceScore  ?? 0.35) - (recent._min.performanceScore  ?? 0.05);
    const prevRange   = (previous._max.performanceScore ?? 0.35) - (previous._min.performanceScore ?? 0.05);
    const pooledRange = Math.max((recentRange + prevRange) / 2, 0.01);

    const raw = delta / pooledRange;
    return {
      score:        Math.max(-1, Math.min(1, raw)),
      recentCount,
      prevCount,
    };
  }

  // ── 2. LEARNING VELOCITY ───────────────────────────────────────────────────
  // Measures how actively the system is adapting.
  // Two signals combined:
  //   A) Outcome ingestion rate — reports per day in last 7 days vs baseline
  //   B) Weight spread — how far avg(|weight − 1.0|) has moved from neutral
  // Returns [0, 1] where 1 = maximum observed adaptation.

  private async computeLearningVelocity(from7: Date): Promise<{
    score: number; anglesTracked: number;
  }> {
    const [recentCount, allStats, alcCycles] = await Promise.all([
      this.prisma.campaignOutcome.count({ where: { createdAt: { gte: from7 } } }),
      this.prisma.anglePerformanceStat.findMany({
        select: { avgPerformanceScore: true, reportCount: true },
      }),
      this.prisma.autonomousLoopCycle.findMany({
        orderBy: { evaluatedAt: 'desc' },
        take:    20,
        select:  { entropyScore: true, explorationRatio: true },
      }),
    ]);

    // Signal A: ingestion rate (normalize: 7 reports/day = max velocity)
    const rateScore = Math.min(1, recentCount / (7 * 7));   // 49 outcomes/week = score 1.0

    // Signal B: weight spread across tracked angles
    const spreadScore = allStats.length === 0 ? 0
      : Math.min(1, allStats.reduce((s, r) => s + Math.abs(r.avgPerformanceScore - 0.25), 0) /
          (allStats.length * 0.25));

    // Signal C: ALC entropy change rate (optional — 0 if not enough data)
    let entropyVelocity = 0;
    if (alcCycles.length >= 2) {
      const latest   = alcCycles[0].entropyScore;
      const earliest = alcCycles[alcCycles.length - 1].entropyScore;
      entropyVelocity = Math.min(1, Math.abs(latest - earliest) / 0.5);
    }

    const score = (rateScore * 0.45) + (spreadScore * 0.35) + (entropyVelocity * 0.20);
    return { score: Math.min(1, score), anglesTracked: allStats.length };
  }

  // ── 3. EXPLORATION RATIO ───────────────────────────────────────────────────
  // Fraction of angle selections that fall OUTSIDE the top-3 most-used angles.
  // Uses CreativeMemory which records every angle selection with its totalScore.

  private async computeExplorationRatio(from7: Date): Promise<{
    score: number; total: number;
  }> {
    const rows = await this.prisma.creativeMemory.groupBy({
      by:      ['angle'],
      where:   { createdAt: { gte: from7 } },
      _count:  { angle: true },
      orderBy: { _count: { angle: 'desc' } },
    });

    if (!rows.length) return { score: 0.20, total: 0 };  // default to baseline when no data

    const total    = rows.reduce((s, r) => s + r._count.angle, 0);
    const top3sum  = rows.slice(0, 3).reduce((s, r) => s + r._count.angle, 0);
    const exploredCount = total - top3sum;

    return {
      score: total > 0 ? exploredCount / total : 0.20,
      total,
    };
  }

  // ── 4. DIVERSITY INDEX ─────────────────────────────────────────────────────
  // Shannon entropy H of angle selection distribution, normalized to [0, 1].
  // H = -Σ p_i * ln(p_i) / ln(n)
  // Returns 0 when one angle monopolizes, 1 when perfectly uniform.

  private async computeDiversityIndex(from7: Date): Promise<{ score: number }> {
    const rows = await this.prisma.creativeMemory.groupBy({
      by:     ['angle'],
      where:  { createdAt: { gte: from7 } },
      _count: { angle: true },
    });

    if (rows.length < 2) return { score: 0 };

    const total = rows.reduce((s, r) => s + r._count.angle, 0);
    const n     = rows.length;

    const entropy = rows.reduce((h, r) => {
      const p = r._count.angle / total;
      return h - (p > 0 ? p * Math.log(p) : 0);
    }, 0);

    const maxEntropy = Math.log(n);           // H_max = ln(n) (uniform distribution)
    const normalized = maxEntropy > 0 ? entropy / maxEntropy : 0;

    return { score: Math.max(0, Math.min(1, normalized)) };
  }

  // ── 5. STATUS CLASSIFICATION ───────────────────────────────────────────────
  // IMPROVING   — drift trending positive AND healthy diversity
  // STAGNATING  — drift flat AND low velocity
  // OVERFITTING — low exploration AND one angle dominating selection

  private classify(
    driftScore:   number,
    exploRatio:   number,
    diversityIdx: number,
  ): 'IMPROVING' | 'STAGNATING' | 'OVERFITTING' {
    if (exploRatio < 0.10 && diversityIdx < 0.35) return 'OVERFITTING';
    if (driftScore > 0.05 && diversityIdx >= 0.30)  return 'IMPROVING';
    return 'STAGNATING';
  }
}
