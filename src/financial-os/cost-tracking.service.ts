import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Cost per operation type (realistic AI API estimates in USD)
const COST_TABLE: Record<string, number> = {
  video:        0.15,
  carousel:     0.08,
  banner:       0.05,
  scoring:      0.02,
  improvement:  0.03,
  ai_call:      0.02,
  generation:   0.04,
};

export interface CostEvent {
  id:          string;
  campaignId:  string;
  operationType: string;
  cost:        number;
  timestamp:   string;
  metadata?:   Record<string, unknown>;
}

export interface CostSummary {
  totalToday:       number;
  totalThisMonth:   number;
  totalAllTime:     number;
  byCampaign:       Record<string, number>;
  byOperationType:  Record<string, number>;
  avgCostPerCampaign: number;
  costTrend:        Array<{ date: string; cost: number }>;
  recentEvents:     CostEvent[];
}

@Injectable()
export class CostTrackingService {
  // In-memory ring buffer of cost events
  private readonly events: CostEvent[] = [];
  private readonly MAX_EVENTS = 1000;

  constructor(private readonly prisma: PrismaService) {}

  // ── Ingest a cost event (called from generation services) ─────────────────
  trackCost(campaignId: string, operationType: string, overrideCost?: number): CostEvent {
    const cost = overrideCost ?? (COST_TABLE[operationType] ?? 0.01);
    const event: CostEvent = {
      id:            `ce-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      campaignId,
      operationType,
      cost,
      timestamp:     new Date().toISOString(),
    };
    this.events.unshift(event);
    if (this.events.length > this.MAX_EVENTS) this.events.pop();
    return event;
  }

  // ── Build full cost summary ────────────────────────────────────────────────
  async getSummary(): Promise<CostSummary> {
    // Pull real spend data from CampaignOutcome
    const outcomes = await this.prisma.campaignOutcome.findMany({
      select: { campaignId: true, spend: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 500,
    }).catch(() => []);

    const now        = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Aggregate real spend from outcomes
    let totalAllTime = 0;
    let totalToday   = 0;
    let totalMonth   = 0;
    const byCampaign: Record<string, number> = {};

    outcomes.forEach(o => {
      const spend    = o.spend ?? 0;
      const date     = new Date(o.createdAt);
      totalAllTime  += spend;
      if (date >= todayStart) totalToday  += spend;
      if (date >= monthStart) totalMonth  += spend;
      byCampaign[o.campaignId] = (byCampaign[o.campaignId] ?? 0) + spend;
    });

    // Add in-memory tracked API costs
    this.events.forEach(e => {
      const date = new Date(e.timestamp);
      totalAllTime += e.cost;
      if (date >= todayStart) totalToday  += e.cost;
      if (date >= monthStart) totalMonth  += e.cost;
      byCampaign[e.campaignId] = (byCampaign[e.campaignId] ?? 0) + e.cost;
    });

    // By operation type (in-memory events only)
    const byOperationType: Record<string, number> = {};
    this.events.forEach(e => {
      byOperationType[e.operationType] = (byOperationType[e.operationType] ?? 0) + e.cost;
    });

    // Cost trend (last 7 days)
    const costTrend = this.buildCostTrend(outcomes, 7);

    const campaignCount = Object.keys(byCampaign).length;

    return {
      totalToday:           +totalToday.toFixed(4),
      totalThisMonth:       +totalMonth.toFixed(4),
      totalAllTime:         +totalAllTime.toFixed(4),
      byCampaign,
      byOperationType,
      avgCostPerCampaign:   campaignCount > 0 ? +(totalAllTime / campaignCount).toFixed(4) : 0,
      costTrend,
      recentEvents:         this.events.slice(0, 50),
    };
  }

  getRecentEvents(limit = 100): CostEvent[] {
    return this.events.slice(0, limit);
  }

  getCostTable(): Record<string, number> {
    return { ...COST_TABLE };
  }

  private buildCostTrend(
    outcomes: Array<{ spend: number | null; createdAt: Date }>,
    days: number,
  ): Array<{ date: string; cost: number }> {
    const trend: Array<{ date: string; cost: number }> = [];
    for (let i = days - 1; i >= 0; i--) {
      const d     = new Date();
      d.setDate(d.getDate() - i);
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const end   = new Date(start.getTime() + 86_400_000);
      const cost  = outcomes
        .filter(o => { const t = new Date(o.createdAt); return t >= start && t < end; })
        .reduce((s, o) => s + (o.spend ?? 0), 0);
      trend.push({ date: start.toISOString().slice(0, 10), cost: +cost.toFixed(4) });
    }
    return trend;
  }
}
