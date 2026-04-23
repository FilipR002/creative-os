import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// ─── Time window helpers ──────────────────────────────────────────────────────
function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

function round(n: number | null | undefined, places = 4): number {
  if (n == null || isNaN(n)) return 0;
  return Math.round(n * 10 ** places) / 10 ** places;
}

function mae(errors: number[]): number {
  if (!errors.length) return 0;
  return errors.reduce((s, e) => s + Math.abs(e), 0) / errors.length;
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class AdminAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── 1. OVERVIEW ─────────────────────────────────────────────────────────────
  async getOverview() {
    const [
      totalUsers,
      totalCampaigns,
      totalCreatives,
      totalWins,
      totalLosses,
      scoreAgg,
      predErrors,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.campaign.count(),
      this.prisma.creative.count(),
      this.prisma.creativeScore.count({ where: { isWinner: true } }),
      this.prisma.creativeScore.count({ where: { isWinner: false } }),
      this.prisma.creativeScore.aggregate({
        _avg: { ctrScore: true, conversion: true, totalScore: true },
      }),
      this.prisma.predictionError.findMany({
        select: { ctrError: true, retentionError: true, conversionError: true },
      }),
    ]);

    const avgPredictionError = predErrors.length
      ? round(
          (mae(predErrors.map(e => e.ctrError)) +
           mae(predErrors.map(e => e.retentionError)) +
           mae(predErrors.map(e => e.conversionError))) / 3,
        )
      : 0;

    return {
      totalUsers,
      totalCampaigns,
      totalCreatives,
      totalWins,
      totalLosses,
      globalCTR:            round(scoreAgg._avg.ctrScore),
      globalConversionRate: round(scoreAgg._avg.conversion),
      avgPredictionError,
    };
  }

  // ── 2. LEARNING STATE ───────────────────────────────────────────────────────
  async getLearningState() {
    const [angleStats, formatStats, recentErrors, allErrors] = await Promise.all([
      this.prisma.angleStats.findMany({
        include: { angle: { select: { slug: true, label: true } } },
      }),
      this.prisma.formatStats.findMany(),
      this.prisma.predictionError.findMany({
        where:  { createdAt: { gte: daysAgo(7) } },
        select: { ctrError: true, retentionError: true, conversionError: true },
      }),
      this.prisma.predictionError.findMany({
        select: { ctrError: true, retentionError: true, conversionError: true },
      }),
    ]);

    // Map angles → enriched objects with trend
    const mappedAngles = angleStats.map(s => {
      const winRate = s.uses > 0 ? round(s.wins / s.uses) : 0;
      // Composite score mirrors scoring.service weights
      const avgScore = round(s.avgCtr * 0.30 + s.avgRetention * 0.30 + s.avgConversion * 0.25 + 0.15);
      const trend: 'up' | 'down' | 'stable' =
        s.weight > 1.05 ? 'up' : s.weight < 0.95 ? 'down' : 'stable';
      return { angle: s.angle.slug, label: s.angle.label, winRate, avgScore, trend, weight: round(s.weight), uses: s.uses };
    });

    const topAngles   = [...mappedAngles].sort((a, b) => b.avgScore - a.avgScore).slice(0, 5);
    const worstAngles = [...mappedAngles].sort((a, b) => a.weight - b.weight).slice(0, 5);

    // Format trends — weight as proxy for momentum
    const fmtMap: Record<string, number> = {};
    for (const f of formatStats) fmtMap[f.format] = round(f.weight);

    const formatTrends = {
      video:    fmtMap['video']    ?? 1,
      carousel: fmtMap['carousel'] ?? 1,
      banner:   fmtMap['banner']   ?? 1,
    };

    // Calibration health
    const recentMAE  = recentErrors.length ? mae([
      ...recentErrors.map(e => e.ctrError),
      ...recentErrors.map(e => e.retentionError),
      ...recentErrors.map(e => e.conversionError),
    ]) : null;

    const overallMAE = allErrors.length ? mae([
      ...allErrors.map(e => e.ctrError),
      ...allErrors.map(e => e.retentionError),
      ...allErrors.map(e => e.conversionError),
    ]) : null;

    // Positive errorTrend = errors growing (bad). Negative = shrinking (good).
    const errorTrend = recentMAE !== null && overallMAE !== null && overallMAE > 0
      ? round((recentMAE - overallMAE) / overallMAE)
      : 0;

    // Overfitting risk: high if error trend positive AND many angle_stats updates
    const overfittingRisk = errorTrend > 0.10 ? round(Math.min(errorTrend * 5, 1)) : 0;

    return {
      topAngles,
      worstAngles,
      formatTrends,
      calibrationHealth: {
        errorTrend:       round(errorTrend),
        overfittingRisk:  round(overfittingRisk),
        recentMAE:        recentMAE !== null ? round(recentMAE) : null,
        overallMAE:       overallMAE !== null ? round(overallMAE) : null,
        samples:          allErrors.length,
        recentSamples:    recentErrors.length,
      },
    };
  }

  // ── 3. REALTIME FEED ─────────────────────────────────────────────────────────
  async getRealtimeFeed(limit = 20) {
    const take = Math.min(limit, 100);

    const [recentCreatives, recentImprovements, recentMemory] = await Promise.all([
      this.prisma.creative.findMany({
        orderBy: { createdAt: 'desc' },
        take,
        include: {
          campaign: { select: { userId: true } },
          angle:    { select: { slug: true } },
          score:    { select: { totalScore: true, createdAt: true } },
        },
      }),
      this.prisma.creativeImprovement.findMany({
        orderBy: { createdAt: 'desc' },
        take: Math.ceil(take / 2),
        include: {
          originalCreative: {
            include: {
              campaign: { select: { userId: true } },
              angle:    { select: { slug: true } },
            },
          },
        },
      }),
      this.prisma.creativeMemory.findMany({
        orderBy: { createdAt: 'desc' },
        take: Math.ceil(take / 2),
        select: {
          id: true, createdAt: true, userId: true,
          format: true, angle: true, totalScore: true,
        },
      }),
    ]);

    // Map creatives → events (prefer SCORED if score exists)
    const creativeEvents = recentCreatives.map(c => ({
      type:      c.score ? 'SCORED' : 'CREATIVE_GENERATED',
      timestamp: c.score ? c.score.createdAt.toISOString() : c.createdAt.toISOString(),
      userId:    c.campaign?.userId ?? null,
      format:    c.format.toLowerCase(),
      angle:     c.angle?.slug ?? null,
      score:     c.score ? round(c.score.totalScore) : null,
    }));

    // Map improvements → events
    const improvementEvents = recentImprovements.map(imp => ({
      type:      'IMPROVED',
      timestamp: imp.createdAt.toISOString(),
      userId:    imp.originalCreative?.campaign?.userId ?? null,
      format:    imp.originalCreative?.format?.toLowerCase() ?? null,
      angle:     imp.originalCreative?.angle?.slug ?? null,
      score:     imp.scoreAfter !== null ? round(imp.scoreAfter) : null,
      accepted:  imp.accepted,
      delta:     imp.improvementDelta !== null ? round(imp.improvementDelta) : null,
    }));

    // Map memory writes → events
    const memoryEvents = recentMemory.map(m => ({
      type:      'MEMORY_WRITTEN',
      timestamp: m.createdAt.toISOString(),
      userId:    m.userId ?? null,
      format:    m.format,
      angle:     m.angle,
      score:     round(m.totalScore),
    }));

    // Merge, sort desc, cap at limit
    const events = [...creativeEvents, ...improvementEvents, ...memoryEvents]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, take);

    return { events, total: events.length };
  }

  // ── 4. SYSTEM HEALTH ────────────────────────────────────────────────────────
  async getSystemHealth() {
    const [
      recentFeedback,
      totalMemory,
      memoryLast24h,
      memoryPrev24h,
      acceptedImprovements,
      totalScored,
      angleStatsCount,
    ] = await Promise.all([
      this.prisma.predictionError.count({ where: { createdAt: { gte: daysAgo(7) } } }),
      this.prisma.creativeMemory.count(),
      this.prisma.creativeMemory.count({ where: { createdAt: { gte: daysAgo(1) } } }),
      this.prisma.creativeMemory.count({
        where: { createdAt: { gte: daysAgo(2), lt: daysAgo(1) } },
      }),
      this.prisma.creativeImprovement.aggregate({
        where: { accepted: true },
        _avg:  { improvementDelta: true },
        _count: { id: true },
      }),
      this.prisma.creativeScore.count(),
      this.prisma.angleStats.count(),
    ]);

    const learningActive    = recentFeedback > 0;
    const dataFlowHealthy   = totalMemory > 0 && totalScored > 0;

    const memoryGrowthRate  = memoryPrev24h > 0
      ? round(memoryLast24h / memoryPrev24h)
      : memoryLast24h > 0 ? 2.0 : 0;

    const avgImprovementGain = round(acceptedImprovements._avg.improvementDelta);
    const acceptedCount      = acceptedImprovements._count.id;

    // Rule-based recommendation
    let recommendation: string;
    if (!dataFlowHealthy) {
      recommendation = 'Generate creatives and run scoring to start the data pipeline.';
    } else if (!learningActive) {
      recommendation = 'Submit real metrics via POST /api/feedback/real-metrics to activate learning.';
    } else if (acceptedCount === 0) {
      recommendation = 'Improvement engine has no accepted improvements yet — try running POST /api/improvement/run.';
    } else if (avgImprovementGain < 0) {
      recommendation = 'Improvement engine is regressing — check content quality and scoring thresholds.';
    } else if (memoryGrowthRate > 1.5) {
      recommendation = 'System is growing fast. Learning is active and accelerating.';
    } else {
      recommendation = 'System is healthy and self-optimizing. Continue collecting real-world feedback.';
    }

    return {
      learningActive,
      dataFlowHealthy,
      memoryGrowthRate,
      avgImprovementGain,
      acceptedImprovements: acceptedCount,
      totalMemoryEntries:   totalMemory,
      totalScoredCreatives: totalScored,
      anglesTracked:        angleStatsCount,
      recommendation,
    };
  }
}
