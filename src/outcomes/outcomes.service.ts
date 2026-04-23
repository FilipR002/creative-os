// ─── Outcome Learning Layer — Service ────────────────────────────────────────
// Ingests real-world ad performance data and updates per-user angle weights.
//
// Learning rules (non-negotiable):
//   1. Ignore reports with < MIN_IMPRESSIONS (low-volume noise gate)
//   2. EWMA smoothing — no sudden jumps
//   3. Weights clamped [0.50, 1.50] — no angle fully killed or inflated
//   4. Global stats updated independently of user-specific weights
//   5. Backward compatible — missing weights return 1.0 (neutral)

import { Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService }               from '../prisma/prisma.service';
import { AutonomousLoopService }       from '../autonomous-loop/autonomous-loop.service';
import { CreativeDNAService }          from '../creative-dna/creative-dna.service';
import { CausalAttributionService }    from '../causal-attribution/causal-attribution.service';
import { UserInsightService }          from '../user-insight/user-insight.service';
import { RealityAggregatorService }    from '../reality/reality.service';
import { normalizeMetrics, mapPerformanceToWeight } from './outcomes.mapper';
import type {
  ReportOutcomeDto,
  ReportOutcomeResponse,
  AngleWeightMap,
  OutcomeLearningUpdate,
} from './outcomes.types';

const MIN_IMPRESSIONS  = 100;   // noise gate — reject under-sampled data
const EWMA_ALPHA_MIN   = 0.05;  // floor — stable convergence for well-sampled angles
const EWMA_ALPHA_MAX   = 0.20;  // ceiling — fast learning for new/unseen angles
const WEIGHT_MIN       = 0.50;
const WEIGHT_MAX       = 1.50;
const DEFAULT_WEIGHT   = 1.00;

@Injectable()
export class OutcomesService {
  private readonly logger = new Logger(OutcomesService.name);

  constructor(
    private readonly prisma:  PrismaService,
    @Optional() private readonly alc:              AutonomousLoopService,
    @Optional() private readonly creativeDna:       CreativeDNAService,
    @Optional() private readonly causalAttribution: CausalAttributionService,
    @Optional() private readonly userInsight:       UserInsightService,
    @Optional() private readonly realityAggregator: RealityAggregatorService,
  ) {}

  // ── Report ingestion ──────────────────────────────────────────────────────

  async reportOutcome(dto: ReportOutcomeDto): Promise<ReportOutcomeResponse> {
    const { userId, campaignId, angleSlug } = dto;
    let metrics = dto.metrics;

    // Reality override — if real platform events exist with sufficient volume,
    // replace the caller-supplied metrics with aggregated real data.
    if (this.realityAggregator) {
      const realMetrics = await this.realityAggregator.aggregate(campaignId).catch(() => null);
      if (realMetrics?.hasSufficientData) {
        metrics = {
          impressions:  realMetrics.impressions,
          clicks:       realMetrics.clicks,
          conversions:  realMetrics.conversions,
          revenue:      realMetrics.revenue,
          spend:        metrics.spend,   // keep caller spend (not tracked in reality layer)
        };
        this.logger.log(
          `[Outcomes] Reality override for campaign=${campaignId}: ` +
          `imp=${realMetrics.impressions} clk=${realMetrics.clicks} source=${realMetrics.source}`
        );
      }
    }

    // 1. Noise gate
    if (metrics.impressions < MIN_IMPRESSIONS) {
      return {
        status: 'skipped_low_volume',
        reason: `Minimum ${MIN_IMPRESSIONS} impressions required (got ${metrics.impressions})`,
      };
    }

    // 2. Normalize
    const normalized = normalizeMetrics(metrics);
    const { ctr, conversionRate, roas, performanceScore } = normalized;

    // 3. Persist raw outcome
    await this.prisma.campaignOutcome.create({
      data: {
        userId,
        campaignId,
        angleSlug,
        impressions:      metrics.impressions,
        clicks:           metrics.clicks,
        conversions:      metrics.conversions,
        spend:            metrics.spend ?? null,
        revenue:          metrics.revenue ?? null,
        ctr,
        conversionRate,
        roas:             metrics.spend && metrics.spend > 0 ? roas : null,
        performanceScore,
      },
    });

    // 4. Update global angle stats (EWMA on aggregates)
    await this.updateGlobalStats(angleSlug, metrics, normalized);

    // 5. Update per-user learning weights
    const learningUpdate = await this.updateUserWeights(userId, angleSlug, performanceScore);

    this.logger.log(
      `Outcome ingested: user=${userId.slice(0, 8)} angle=${angleSlug} ` +
      `score=${performanceScore.toFixed(3)} weight ${learningUpdate.previousWeight.toFixed(3)}→${learningUpdate.newWeight.toFixed(3)}`
    );

    // 8.4 ALC — re-evaluate system state after every weight update (fire-and-forget)
    if (this.alc) {
      this.alc.evaluateCycle(userId).catch(err =>
        this.logger.warn(`[ALC] Evaluation failed: ${err.message}`)
      );
    }

    // 9.2 Creative DNA — persist pattern if top-20% performer (fire-and-forget)
    if (this.creativeDna) {
      this.creativeDna.maybePersistDNA(userId, angleSlug, performanceScore).catch(err =>
        this.logger.warn(`[DNA] Persist failed: ${err.message}`)
      );
    }

    // 9.3 Causal Attribution — decompose this outcome into system contributions (fire-and-forget)
    // 9.4 User Insight — invalidate cache then regenerate after causal analysis settles
    if (this.causalAttribution) {
      this.causalAttribution.analyzeOutcome(campaignId)
        .then(() => this.userInsight?.invalidate(campaignId))
        .catch(() => {});
    } else if (this.userInsight) {
      this.userInsight.invalidate(campaignId);
    }

    return {
      status: 'accepted',
      normalized,
      learningUpdate,
    };
  }

  // ── Global stats aggregation ──────────────────────────────────────────────

  private async updateGlobalStats(
    angleSlug:  string,
    metrics:    ReportOutcomeDto['metrics'],
    normalized: ReturnType<typeof normalizeMetrics>,
  ): Promise<void> {
    const existing = await this.prisma.anglePerformanceStat.findUnique({
      where: { angleSlug },
    });

    if (!existing) {
      await this.prisma.anglePerformanceStat.create({
        data: {
          angleSlug,
          totalImpressions:  metrics.impressions,
          totalClicks:       metrics.clicks,
          totalConversions:  metrics.conversions,
          totalSpend:        metrics.spend ?? 0,
          totalRevenue:      metrics.revenue ?? 0,
          reportCount:       1,
          avgCtr:            normalized.ctr,
          avgConversionRate: normalized.conversionRate,
          avgRoas:           normalized.roas,
          avgPerformanceScore: normalized.performanceScore,
        },
      });
      return;
    }

    // EWMA update on running averages — global stats use the stable floor rate
    const alpha = EWMA_ALPHA_MIN;
    await this.prisma.anglePerformanceStat.update({
      where: { angleSlug },
      data: {
        totalImpressions:    existing.totalImpressions + metrics.impressions,
        totalClicks:         existing.totalClicks + metrics.clicks,
        totalConversions:    existing.totalConversions + metrics.conversions,
        totalSpend:          existing.totalSpend + (metrics.spend ?? 0),
        totalRevenue:        existing.totalRevenue + (metrics.revenue ?? 0),
        reportCount:         existing.reportCount + 1,
        avgCtr:              ewma(normalized.ctr,             existing.avgCtr,            alpha),
        avgConversionRate:   ewma(normalized.conversionRate,  existing.avgConversionRate, alpha),
        avgRoas:             ewma(normalized.roas,            existing.avgRoas,           alpha),
        avgPerformanceScore: ewma(normalized.performanceScore, existing.avgPerformanceScore, alpha),
      },
    });
  }

  // ── Per-user weight update ────────────────────────────────────────────────

  private async updateUserWeights(
    userId:           string,
    angleSlug:        string,
    performanceScore: number,
  ): Promise<OutcomeLearningUpdate> {
    const [record, perfStat] = await Promise.all([
      this.prisma.userOutcomeLearning.findUnique({ where: { userId } }),
      this.prisma.anglePerformanceStat.findUnique({
        where:  { angleSlug },
        select: { reportCount: true },
      }),
    ]);

    const weights: AngleWeightMap = (record?.angleWeights as AngleWeightMap) ?? {};
    const previousWeight = weights[angleSlug] ?? DEFAULT_WEIGHT;

    // Adaptive α: fast for new angles, slows as evidence accumulates.
    //   sampleCount=0  → α=0.20 (users see learning after 3–5 reports)
    //   sampleCount=14 → α=0.10
    //   sampleCount=60 → α≈0.05 (converged, stable)
    const sampleCount = perfStat?.reportCount ?? 0;
    const alpha = Math.max(EWMA_ALPHA_MIN, EWMA_ALPHA_MAX * Math.exp(-0.05 * sampleCount));

    // Remap performanceScore [0.05–0.40] → weight space [0.50–1.50] BEFORE EWMA.
    // Without remapping, EWMA(performanceScore, previousWeight) always pulls toward
    // a sub-1.0 value, meaning weights can only ever decrease. The remap ensures
    // above-median performance actually raises the weight.
    const weightTarget = mapPerformanceToWeight(performanceScore);
    const rawNew       = ewma(weightTarget, previousWeight, alpha);
    const newWeight    = clamp(rawNew, WEIGHT_MIN, WEIGHT_MAX);

    weights[angleSlug] = newWeight;

    if (!record) {
      await this.prisma.userOutcomeLearning.create({
        data: { userId, angleWeights: weights, reportCount: 1 },
      });
    } else {
      await this.prisma.userOutcomeLearning.update({
        where: { userId },
        data:  { angleWeights: weights, reportCount: record.reportCount + 1 },
      });
    }

    return {
      angleSlug,
      previousWeight,
      newWeight,
      performanceScore,
      impressions: 0, // caller fills if needed
      skipped: false,
    };
  }

  // ── Weight retrieval (used by scoring engine) ─────────────────────────────

  /**
   * Returns per-angle outcome weights for a user.
   * Missing angles default to 1.0 (neutral — no outcome data changes nothing).
   */
  async getOutcomeWeights(userId: string): Promise<AngleWeightMap> {
    if (!userId) return {};
    try {
      const record = await this.prisma.userOutcomeLearning.findUnique({
        where: { userId },
        select: { angleWeights: true },
      });
      return (record?.angleWeights as AngleWeightMap) ?? {};
    } catch {
      return {};
    }
  }

  // ── Recent outcomes (for UI table) ───────────────────────────────────────

  async getRecentOutcomes(userId: string, limit = 20) {
    return this.prisma.campaignOutcome.findMany({
      where:   { userId },
      orderBy: { createdAt: 'desc' },
      take:    limit,
      select: {
        id:               true,
        campaignId:       true,
        angleSlug:        true,
        impressions:      true,
        clicks:           true,
        conversions:      true,
        ctr:              true,
        conversionRate:   true,
        roas:             true,
        performanceScore: true,
        createdAt:        true,
      },
    });
  }

  // ── Global angle stats (for UI) ───────────────────────────────────────────

  async getGlobalStats() {
    return this.prisma.anglePerformanceStat.findMany({
      orderBy: { avgPerformanceScore: 'desc' },
    });
  }
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function ewma(newObs: number, historical: number, alpha: number): number {
  return alpha * newObs + (1 - alpha) * historical;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
