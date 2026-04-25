import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ApiLogService } from './api-log.service';
import { RevenueLogService } from './revenue-log.service';

@Injectable()
export class ProfitService {
  constructor(
    private readonly prisma:   PrismaService,
    private readonly apiLog:   ApiLogService,
    private readonly revenue:  RevenueLogService,
  ) {}

  async getDashboard(days = 30) {
    const [costs, rev, snapshots] = await Promise.all([
      this.apiLog.getTotals(days),
      this.revenue.getTotals(days),
      this.getSnapshots(7),
    ]);

    const profitUsd  = rev.totalRevenueUsd - costs.totalCostUsd;
    const marginPct  = rev.totalRevenueUsd > 0
      ? +((profitUsd / rev.totalRevenueUsd) * 100).toFixed(1)
      : 0;

    return {
      period:          `last_${days}_days`,
      totalCostUsd:    costs.totalCostUsd,
      totalRevenueUsd: rev.totalRevenueUsd,
      profitUsd:       +profitUsd.toFixed(2),
      marginPct,
      apiCallCount:    costs.callCount,
      revenueEventCount: rev.eventCount,
      costBreakdown: {
        byProvider:  costs.byProvider,
        byOperation: costs.byOperation,
        failureCount: costs.failureCount,
        successRate:  costs.successRate,
      },
      revenueBreakdown: {
        byType: rev.byType,
      },
      snapshots,
    };
  }

  async snapshotToday(): Promise<void> {
    const today  = new Date().toISOString().slice(0, 10);
    const [c, r] = await Promise.all([
      this.apiLog.getTotals(1),
      this.revenue.getTotals(1),
    ]);

    const profitUsd  = r.totalRevenueUsd - c.totalCostUsd;
    const marginPct  = r.totalRevenueUsd > 0
      ? +((profitUsd / r.totalRevenueUsd) * 100).toFixed(1)
      : 0;

    await this.prisma.profitSnapshot.upsert({
      where:  { date: today },
      update: {
        totalCostUsd:       c.totalCostUsd,
        totalRevenueUsd:    r.totalRevenueUsd,
        profitUsd,
        marginPct,
        apiCallCount:       c.callCount,
        revenueEventCount:  r.eventCount,
      },
      create: {
        date:               today,
        totalCostUsd:       c.totalCostUsd,
        totalRevenueUsd:    r.totalRevenueUsd,
        profitUsd,
        marginPct,
        apiCallCount:       c.callCount,
        revenueEventCount:  r.eventCount,
      },
    });
  }

  private async getSnapshots(days: number) {
    return this.prisma.profitSnapshot.findMany({
      orderBy: { date: 'desc' },
      take:    days,
    });
  }
}
