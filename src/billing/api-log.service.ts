import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface ApiCallMeta {
  provider:    'kling' | 'veo' | 'claude' | 'gemini' | string;
  operation:   string;
  userId?:     string;
  campaignId?: string;
  costUsd:     number;
  latencyMs?:  number;
  statusCode?: number;
  success:     boolean;
  errorMessage?: string;
}

// Best-effort USD cost estimates per provider + operation
export const API_COST_TABLE: Record<string, Record<string, number>> = {
  kling:  { video_generate: 0.14, status_poll: 0.001 },
  veo:    { video_generate: 0.20, status_poll: 0.001 },
  claude: { score: 0.008, improve: 0.012, concept: 0.010, copy: 0.005, default: 0.008 },
  gemini: { vision: 0.004, text: 0.002, default: 0.003 },
};

export function estimateCost(provider: string, operation: string): number {
  const providerTable = API_COST_TABLE[provider] ?? {};
  return providerTable[operation] ?? providerTable['default'] ?? 0.01;
}

@Injectable()
export class ApiLogService {
  private readonly logger = new Logger(ApiLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Fire-and-forget — never throws, never awaited by callers.
   * Logs an API call to the api_logs table.
   */
  log(meta: ApiCallMeta): void {
    this.prisma.apiLog
      .create({
        data: {
          provider:     meta.provider,
          operation:    meta.operation,
          userId:       meta.userId ?? null,
          campaignId:   meta.campaignId ?? null,
          costUsd:      meta.costUsd,
          latencyMs:    meta.latencyMs ?? null,
          statusCode:   meta.statusCode ?? null,
          success:      meta.success,
          errorMessage: meta.errorMessage ?? null,
        },
      })
      .catch(err => {
        this.logger.warn(`[ApiLog] Failed to persist log: ${err?.message ?? err}`);
      });
  }

  // ── Aggregation queries (admin endpoints) ──────────────────────────────────

  async getTotals(days = 30) {
    const since = new Date(Date.now() - days * 86_400_000);

    const rows = await this.prisma.apiLog.findMany({
      where:   { createdAt: { gte: since } },
      select:  { provider: true, operation: true, costUsd: true, success: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take:    5000,
    });

    const total = rows.reduce((s, r) => s + r.costUsd, 0);

    const byProvider: Record<string, number> = {};
    const byOperation: Record<string, number> = {};
    for (const r of rows) {
      byProvider[r.provider]   = (byProvider[r.provider]   ?? 0) + r.costUsd;
      byOperation[r.operation] = (byOperation[r.operation] ?? 0) + r.costUsd;
    }

    const failureCount = rows.filter(r => !r.success).length;

    return {
      totalCostUsd:  +total.toFixed(4),
      callCount:     rows.length,
      failureCount,
      successRate:   rows.length > 0 ? +((rows.length - failureCount) / rows.length * 100).toFixed(1) : 100,
      byProvider:    mapRound(byProvider),
      byOperation:   mapRound(byOperation),
    };
  }

  async getRecentLogs(limit = 50) {
    return this.prisma.apiLog.findMany({
      orderBy: { createdAt: 'desc' },
      take:    limit,
    });
  }

  async getDailyTrend(days = 14) {
    const rows = await this.prisma.apiLog.findMany({
      where:   { createdAt: { gte: new Date(Date.now() - days * 86_400_000) } },
      select:  { costUsd: true, createdAt: true },
    });

    const buckets: Record<string, number> = {};
    for (const r of rows) {
      const day = r.createdAt.toISOString().slice(0, 10);
      buckets[day] = (buckets[day] ?? 0) + r.costUsd;
    }
    return Object.entries(buckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, cost]) => ({ date, cost: +cost.toFixed(4) }));
  }
}

function mapRound(obj: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(obj)) out[k] = +v.toFixed(4);
  return out;
}
