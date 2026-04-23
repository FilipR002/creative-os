/**
 * Profit Intelligence Service — AI SaaS Unit Economics Engine
 *
 * Maps AI operation costs to product features, attributes revenue heuristically
 * from real DB usage signals, and computes feature-level profitability.
 *
 * Revenue attribution philosophy:
 *  - NOT fake precision. Uses usage-weight distribution of estimated MRR.
 *  - Attribution confidence scores are explicit.
 *  - The system tracks REAL costs and ESTIMATED revenue attribution separately.
 */

import { Injectable } from '@nestjs/common';
import { PrismaService }       from '../prisma/prisma.service';
import { CostTrackingService } from './cost-tracking.service';

// ─── Feature Registry ────────────────────────────────────────────────────────

/**
 * Each product feature maps to one or more cost operation types
 * and has a base attribution weight for revenue distribution.
 */
const FEATURE_REGISTRY: Record<string, {
  label:          string;
  opsTypes:       string[];      // matches CostTrackingService operationType keys
  baseWeight:     number;        // relative value to user (higher = more MRR attributed)
  icon:           string;
}> = {
  campaign_generation: {
    label:      'Campaign Generator',
    opsTypes:   ['generation', 'ai_call'],
    baseWeight: 0.30,
    icon:       '🎯',
  },
  ad_builder: {
    label:      'Ad Builder (Quick Ads)',
    opsTypes:   ['banner', 'carousel'],
    baseWeight: 0.20,
    icon:       '🛠',
  },
  video_generation: {
    label:      'Video Generation',
    opsTypes:   ['video'],
    baseWeight: 0.25,
    icon:       '🎬',
  },
  creative_scoring: {
    label:      'Creative Scoring AI',
    opsTypes:   ['scoring'],
    baseWeight: 0.08,
    icon:       '📊',
  },
  improvement_engine: {
    label:      'Improvement Engine',
    opsTypes:   ['improvement'],
    baseWeight: 0.07,
    icon:       '⚡',
  },
  competitor_intel: {
    label:      'Competitor Intelligence',
    opsTypes:   [],              // no cost events yet, tracked via DB queries
    baseWeight: 0.05,
    icon:       '🕵️',
  },
  trend_prediction: {
    label:      'Trend Prediction Engine',
    opsTypes:   [],              // no cost events yet
    baseWeight: 0.05,
    icon:       '🔮',
  },
};

// ─── Monthly Revenue Assumption ───────────────────────────────────────────────
// This is the only hardcoded number. Set to your actual MRR when known.
// All revenue attribution is a percentage of this value.
const ASSUMED_MONTHLY_REVENUE_USD = 99;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FeatureProfitEntry {
  feature:            string;
  label:              string;
  icon:               string;
  cost:               number;
  revenueAttributed:  number;
  profit:             number;
  roi:                number;             // (revenue - cost) / cost
  profitMargin:       number;             // profit / revenue
  usageCount:         number;
  attributionConfidence: number;          // 0–1, be honest
  status:             'profitable' | 'break-even' | 'loss';
}

export interface ProfitSummary {
  totalRevenueAttributed: number;
  totalCost:              number;
  totalProfit:            number;
  profitMargin:           number;
  roi:                    number;
  attributionNote:        string;
}

export interface UnitEconomicsEntry {
  feature:           string;
  label:             string;
  icon:              string;
  avgCostPerUse:     number;
  avgRevenuePerUse:  number;
  profitPerUse:      number;
  usageCount:        number;
}

export interface ProfitTrendPoint {
  date:         string;
  totalCost:    number;
  totalRevenue: number;
  profit:       number;
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class ProfitIntelligenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly costSvc: CostTrackingService,
  ) {}

  // ── Internal: build feature usage counts from DB ──────────────────────────

  private async getDbUsageCounts(): Promise<Record<string, number>> {
    const [
      campaignCount,
      quickAdCount,
      videoCount,
      carouselCount,
      bannerCount,
      scoreCount,
      improvCount,
    ] = await Promise.all([
      // Full campaigns (FULL mode)
      this.prisma.campaign.count({ where: { mode: 'FULL' } }).catch(() => 0),
      // Quick ads (SINGLE mode)
      this.prisma.campaign.count({ where: { mode: 'SINGLE' } }).catch(() => 0),
      // Video creatives
      this.prisma.creative.count({ where: { format: 'VIDEO' } }).catch(() => 0),
      // Carousel creatives
      this.prisma.creative.count({ where: { format: 'CAROUSEL' } }).catch(() => 0),
      // Banner creatives
      this.prisma.creative.count({ where: { format: 'BANNER' } }).catch(() => 0),
      // Scores
      this.prisma.creativeScore.count().catch(() => 0),
      // Improvements
      this.prisma.creativeImprovement.count().catch(() => 0),
    ]);

    return {
      campaign_generation: campaignCount,
      ad_builder:          quickAdCount + carouselCount + bannerCount,
      video_generation:    videoCount,
      creative_scoring:    scoreCount,
      improvement_engine:  improvCount,
      competitor_intel:    0,   // no DB model yet for CI jobs
      trend_prediction:    0,   // no persistent trend jobs
    };
  }

  // ── Internal: aggregate in-memory costs by feature ───────────────────────

  private getCostsByFeature(): Record<string, number> {
    const events     = this.costSvc.getRecentEvents(1000);
    const costByType: Record<string, number> = {};

    events.forEach(e => {
      costByType[e.operationType] = (costByType[e.operationType] ?? 0) + e.cost;
    });

    const result: Record<string, number> = {};
    for (const [featureKey, meta] of Object.entries(FEATURE_REGISTRY)) {
      result[featureKey] = meta.opsTypes.reduce(
        (sum, op) => sum + (costByType[op] ?? 0), 0,
      );
    }
    return result;
  }

  // ── Internal: attribute monthly revenue by usage weight + actual usage ────
  //
  // Formula:
  //   featureRevenue = MRR * (featureWeight * usageShare)
  //   where usageShare = featureUsage / totalUsage (normalised)
  //   confidence = 0.55 for most features (heuristic, not measured)

  private attributeRevenue(
    usageCounts: Record<string, number>,
  ): Record<string, { revenue: number; confidence: number }> {
    const totalUsage = Object.values(usageCounts).reduce((s, v) => s + v, 1);
    const result: Record<string, { revenue: number; confidence: number }> = {};

    // Compute weighted pool (baseWeight × normalised usage)
    const weightedShares: Record<string, number> = {};
    let totalWeightedShare = 0;

    for (const [featureKey, meta] of Object.entries(FEATURE_REGISTRY)) {
      const usageShare    = (usageCounts[featureKey] ?? 0) / totalUsage;
      const weighted      = meta.baseWeight * 0.5 + usageShare * 0.5;  // blend static weight + dynamic usage
      weightedShares[featureKey] = weighted;
      totalWeightedShare += weighted;
    }

    for (const featureKey of Object.keys(FEATURE_REGISTRY)) {
      const share   = (weightedShares[featureKey] ?? 0) / Math.max(totalWeightedShare, 1);
      const revenue = ASSUMED_MONTHLY_REVENUE_USD * share;
      const usage   = usageCounts[featureKey] ?? 0;
      // Confidence is higher when actual usage data is available
      const confidence = usage > 10 ? 0.65 : usage > 0 ? 0.50 : 0.30;
      result[featureKey] = { revenue: +revenue.toFixed(4), confidence };
    }

    return result;
  }

  // ── Public: profit per feature ────────────────────────────────────────────

  async getFeatureProfits(): Promise<FeatureProfitEntry[]> {
    const [usageCounts, costsByFeature] = await Promise.all([
      this.getDbUsageCounts(),
      Promise.resolve(this.getCostsByFeature()),
    ]);

    const revenueMap = this.attributeRevenue(usageCounts);

    return Object.entries(FEATURE_REGISTRY).map(([key, meta]) => {
      const cost     = +(costsByFeature[key] ?? 0).toFixed(4);
      const { revenue, confidence } = revenueMap[key] ?? { revenue: 0, confidence: 0.3 };
      const profit   = +(revenue - cost).toFixed(4);
      const roi      = cost > 0 ? +((revenue - cost) / cost).toFixed(4) : revenue > 0 ? 999 : 0;
      const margin   = revenue > 0 ? +(profit / revenue).toFixed(4) : 0;
      const usage    = usageCounts[key] ?? 0;
      const status: FeatureProfitEntry['status'] =
        profit > 0.5 ? 'profitable' :
        profit > -0.5 ? 'break-even' : 'loss';

      return {
        feature:               key,
        label:                 meta.label,
        icon:                  meta.icon,
        cost,
        revenueAttributed:     revenue,
        profit,
        roi,
        profitMargin:          margin,
        usageCount:            usage,
        attributionConfidence: confidence,
        status,
      };
    }).sort((a, b) => b.profit - a.profit);   // most profitable first
  }

  // ── Public: overall profit summary ───────────────────────────────────────

  async getSummary(): Promise<ProfitSummary> {
    const features     = await this.getFeatureProfits();
    const totalCost    = +features.reduce((s, f) => s + f.cost, 0).toFixed(4);
    const totalRevenue = +features.reduce((s, f) => s + f.revenueAttributed, 0).toFixed(4);
    const totalProfit  = +(totalRevenue - totalCost).toFixed(4);
    const margin       = totalRevenue > 0 ? +(totalProfit / totalRevenue).toFixed(4) : 0;
    const roi          = totalCost > 0 ? +((totalRevenue - totalCost) / totalCost).toFixed(4) : 0;

    return {
      totalRevenueAttributed: totalRevenue,
      totalCost,
      totalProfit,
      profitMargin:  margin,
      roi,
      attributionNote:
        `Revenue of $${ASSUMED_MONTHLY_REVENUE_USD}/mo is heuristically distributed across features ` +
        `by blended usage weight. Confidence: 50–65% depending on feature activity. ` +
        `Replace ASSUMED_MONTHLY_REVENUE_USD with actual MRR when billing is connected.`,
    };
  }

  // ── Public: unit economics ────────────────────────────────────────────────

  async getUnitEconomics(): Promise<UnitEconomicsEntry[]> {
    const features = await this.getFeatureProfits();
    return features.map(f => ({
      feature:          f.feature,
      label:            f.label,
      icon:             f.icon,
      avgCostPerUse:    f.usageCount > 0 ? +(f.cost / f.usageCount).toFixed(6)    : 0,
      avgRevenuePerUse: f.usageCount > 0 ? +(f.revenueAttributed / f.usageCount).toFixed(6) : 0,
      profitPerUse:     f.usageCount > 0 ? +(f.profit / f.usageCount).toFixed(6)  : 0,
      usageCount:       f.usageCount,
    }));
  }

  // ── Public: profit trends (last N days) ──────────────────────────────────

  async getTrends(range: '7d' | '30d' = '7d'): Promise<ProfitTrendPoint[]> {
    const days         = range === '30d' ? 30 : 7;
    const costSummary  = await this.costSvc.getSummary();
    const trendCosts   = costSummary.costTrend;  // already 7-day from CostTrackingService

    // Daily revenue = MRR / 30
    const dailyRevenue = +(ASSUMED_MONTHLY_REVENUE_USD / 30).toFixed(4);

    const points: ProfitTrendPoint[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d    = new Date();
      d.setDate(d.getDate() - i);
      const date = d.toISOString().slice(0, 10);

      const matchedCost = trendCosts.find(t => t.date === date);
      const cost        = matchedCost?.cost ?? 0;
      const revenue     = dailyRevenue;
      const profit      = +(revenue - cost).toFixed(4);

      points.push({ date, totalCost: cost, totalRevenue: revenue, profit });
    }
    return points;
  }
}
