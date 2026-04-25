import { Injectable, Logger } from '@nestjs/common';
import { Prisma }            from '@prisma/client';
import { PrismaService }     from '../prisma/prisma.service';

export interface RevenueEvent {
  stripeEventId:    string;
  stripeCustomerId?: string;
  userId?:          string;
  eventType:        string;
  amountUsd:        number;
  currency?:        string;
  metadata?:        Record<string, unknown>;
}

@Injectable()
export class RevenueLogService {
  private readonly logger = new Logger(RevenueLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(event: RevenueEvent): Promise<void> {
    await this.prisma.revenueLog.upsert({
      where:  { stripeEventId: event.stripeEventId },
      update: {},
      create: {
        stripeEventId:    event.stripeEventId,
        stripeCustomerId: event.stripeCustomerId ?? null,
        userId:           event.userId ?? null,
        eventType:        event.eventType,
        amountUsd:        event.amountUsd,
        currency:         event.currency ?? 'usd',
        metadata:         (event.metadata ?? {}) as Prisma.InputJsonValue,
      },
    }).catch(err => {
      this.logger.warn(`[Revenue] Failed to persist event: ${err?.message ?? err}`);
    });
  }

  async getTotals(days = 30) {
    const since = new Date(Date.now() - days * 86_400_000);
    const rows  = await this.prisma.revenueLog.findMany({
      where:   { createdAt: { gte: since } },
      select:  { amountUsd: true, eventType: true, userId: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });

    const total = rows.reduce((s, r) => s + r.amountUsd, 0);
    const byType: Record<string, number> = {};
    for (const r of rows) {
      byType[r.eventType] = (byType[r.eventType] ?? 0) + r.amountUsd;
    }

    return {
      totalRevenueUsd: +total.toFixed(2),
      eventCount:      rows.length,
      byType,
    };
  }

  async getDailyTrend(days = 14) {
    const rows = await this.prisma.revenueLog.findMany({
      where:   { createdAt: { gte: new Date(Date.now() - days * 86_400_000) } },
      select:  { amountUsd: true, createdAt: true },
    });

    const buckets: Record<string, number> = {};
    for (const r of rows) {
      const day = r.createdAt.toISOString().slice(0, 10);
      buckets[day] = (buckets[day] ?? 0) + r.amountUsd;
    }
    return Object.entries(buckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, revenue]) => ({ date, revenue: +revenue.toFixed(2) }));
  }

  async getRecentLogs(limit = 50) {
    return this.prisma.revenueLog.findMany({
      orderBy: { createdAt: 'desc' },
      take:    limit,
    });
  }
}
