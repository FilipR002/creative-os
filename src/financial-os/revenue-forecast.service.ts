import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface RevenueForecast {
  campaignId:      string;
  forecastDays:    number;
  predictedRevenue: number;
  roiEstimate:     number;
  confidence:      number;
  bestCase:        number;
  worstCase:       number;
  breakEvenDays:   number | null;
  dailyProjection: Array<{ day: number; date: string; revenue: number; cumulative: number }>;
  drivers:         string[];
}

export interface PortfolioForecast {
  totalPredictedRevenue: number;
  totalPredictedSpend:   number;
  portfolioROI:          number;
  confidence:            number;
  topCampaign:           string | null;
  riskExposure:          number;
  campaigns:             RevenueForecast[];
}

@Injectable()
export class RevenueForecastService {
  constructor(private readonly prisma: PrismaService) {}

  async forecastCampaign(campaignId: string, days = 30): Promise<RevenueForecast> {
    const outcomes = await this.prisma.campaignOutcome.findMany({
      where:   { campaignId },
      orderBy: { createdAt: 'desc' },
      take:    60,
    }).catch(() => []);

    if (outcomes.length === 0) {
      return this.emptyForecast(campaignId, days, 'No historical data for this campaign');
    }

    const avgDailyRev  = outcomes.reduce((s, o) => s + (o.revenue ?? 0), 0) / outcomes.length;
    const avgDailySpend = outcomes.reduce((s, o) => s + (o.spend ?? 0), 0) / outcomes.length;
    const avgRoas      = avgDailySpend > 0 ? avgDailyRev / avgDailySpend : 0;

    // Detect per-campaign trend (early vs late performance)
    const half1    = outcomes.slice(0, Math.ceil(outcomes.length / 2));
    const half2    = outcomes.slice(Math.ceil(outcomes.length / 2));
    const rev1     = half1.reduce((s, o) => s + (o.revenue ?? 0), 0) / half1.length;
    const rev2     = half2.reduce((s, o) => s + (o.revenue ?? 0), 0) / Math.max(half2.length, 1);
    const growthRate = rev2 > 0 ? (rev1 - rev2) / rev2 : 0; // positive = improving

    const confidence   = Math.min(0.45 + outcomes.length * 0.02, 0.91);
    const dailyGrowth  = 1 + growthRate * 0.05;

    const projection: RevenueForecast['dailyProjection'] = [];
    let cumulative = 0;
    for (let i = 1; i <= days; i++) {
      const d      = new Date();
      d.setDate(d.getDate() + i);
      const dayRev = +(avgDailyRev * Math.pow(dailyGrowth, i) * (0.85 + Math.random() * 0.3)).toFixed(2);
      cumulative   = +(cumulative + dayRev).toFixed(2);
      projection.push({ day: i, date: d.toISOString().slice(0, 10), revenue: dayRev, cumulative });
    }

    const predicted  = projection.reduce((s, d) => s + d.revenue, 0);
    const totalSpend = avgDailySpend * days;
    const breakEven  = avgDailySpend > 0
      ? projection.findIndex(d => d.cumulative >= totalSpend) + 1
      : null;

    return {
      campaignId,
      forecastDays:     days,
      predictedRevenue: +predicted.toFixed(2),
      roiEstimate:      totalSpend > 0 ? +((predicted - totalSpend) / totalSpend).toFixed(3) : 0,
      confidence:       +confidence.toFixed(2),
      bestCase:         +(predicted * 1.35).toFixed(2),
      worstCase:        +(predicted * 0.65).toFixed(2),
      breakEvenDays:    breakEven > 0 ? breakEven : null,
      dailyProjection:  projection,
      drivers:          this.buildDrivers(avgRoas, growthRate, outcomes.length),
    };
  }

  async portfolioForecast(days = 30): Promise<PortfolioForecast> {
    const outcomes = await this.prisma.campaignOutcome.findMany({
      orderBy: { createdAt: 'desc' },
      take: 500,
    }).catch(() => []);

    const campaignIds = [...new Set(outcomes.map(o => o.campaignId))];

    const forecasts = await Promise.all(
      campaignIds.slice(0, 10).map(id => this.forecastCampaign(id, days)),
    );

    const totalRev   = forecasts.reduce((s, f) => s + f.predictedRevenue, 0);
    const totalSpend = outcomes.reduce((s, o) => s + (o.spend ?? 0), 0);
    const avgConf    = forecasts.length > 0 ? forecasts.reduce((s, f) => s + f.confidence, 0) / forecasts.length : 0;

    const topCampaign = forecasts.sort((a, b) => b.predictedRevenue - a.predictedRevenue)[0]?.campaignId ?? null;

    return {
      totalPredictedRevenue: +totalRev.toFixed(2),
      totalPredictedSpend:   +totalSpend.toFixed(2),
      portfolioROI:          totalSpend > 0 ? +((totalRev - totalSpend) / totalSpend).toFixed(3) : 0,
      confidence:            +avgConf.toFixed(2),
      topCampaign,
      riskExposure:          +(Math.max(0, 1 - avgConf)).toFixed(2),
      campaigns:             forecasts,
    };
  }

  private emptyForecast(campaignId: string, days: number, _reason: string): RevenueForecast {
    return {
      campaignId, forecastDays: days, predictedRevenue: 0, roiEstimate: 0,
      confidence: 0, bestCase: 0, worstCase: 0, breakEvenDays: null,
      dailyProjection: [], drivers: ['Insufficient data — import campaign outcomes to enable forecasting'],
    };
  }

  private buildDrivers(roas: number, growthRate: number, samples: number): string[] {
    const d: string[] = [];
    if (roas > 3)          d.push(`Strong ROAS ${roas.toFixed(1)}x — positive revenue momentum`);
    else if (roas > 1.5)   d.push(`Moderate ROAS ${roas.toFixed(1)}x — room for optimization`);
    else                   d.push(`Low ROAS ${roas.toFixed(1)}x — cost pressure on revenue`);
    if (growthRate > 0.05) d.push(`Improving performance trend (+${(growthRate * 100).toFixed(1)}% trajectory)`);
    else if (growthRate < -0.05) d.push(`Declining trend (${(growthRate * 100).toFixed(1)}%) — fatigue risk`);
    d.push(`Based on ${samples} historical data points`);
    return d;
  }
}
