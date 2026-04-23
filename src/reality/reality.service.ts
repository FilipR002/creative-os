// ─── Reality Feedback Layer — Service ────────────────────────────────────────
//
// Aggregates real-world events (meta/google/manual) into the same metric shape
// that OutcomesService already understands.
//
// LEARNING INPUT REPLACEMENT RULE:
//   If ≥ MIN_REAL_IMPRESSIONS exist for a campaign → use real aggregated metrics
//   Otherwise → caller falls back to manually-reported metrics
//
// This makes learning grounded in real-world truth rather than self-scored simulations.

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService }      from '../prisma/prisma.service';
import { RealEventSource }    from '@prisma/client';

const MIN_REAL_IMPRESSIONS = 100;   // same gate as OutcomesService noise filter

export interface RealAggregatedMetrics {
  impressions:     number;
  clicks:          number;
  conversions:     number;
  retention24hRate: number;   // [0,1]
  revenue?:        number;
  source:          RealEventSource;
  hasSufficientData: boolean;
}

export interface IngestEventDto {
  campaignId: string;
  angleSlug:  string;
  eventType:  'impression' | 'click' | 'conversion' | 'retention_24h';
  source:     'meta' | 'google' | 'manual' | 'simulated';
  value?:     number;
  occurredAt?: string;
}

@Injectable()
export class RealityAggregatorService {
  private readonly logger = new Logger(RealityAggregatorService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Ingest a single real-world event ──────────────────────────────────────

  async ingestEvent(dto: IngestEventDto): Promise<void> {
    await this.prisma.realWorldEvent.create({
      data: {
        campaignId: dto.campaignId,
        angleSlug:  dto.angleSlug,
        eventType:  dto.eventType as any,
        source:     dto.source as any,
        value:      dto.value ?? 1,
        occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : new Date(),
      },
    });
  }

  // ── Batch ingest ───────────────────────────────────────────────────────────

  async ingestBatch(events: IngestEventDto[]): Promise<{ ingested: number }> {
    await this.prisma.realWorldEvent.createMany({
      data: events.map(e => ({
        campaignId: e.campaignId,
        angleSlug:  e.angleSlug,
        eventType:  e.eventType as any,
        source:     e.source as any,
        value:      e.value ?? 1,
        occurredAt: e.occurredAt ? new Date(e.occurredAt) : new Date(),
      })),
    });
    this.logger.log(`[Reality] Batch ingested ${events.length} events`);
    return { ingested: events.length };
  }

  // ── Aggregate events → metric shape ───────────────────────────────────────
  // Returns null when no real events exist for this campaign yet.

  async aggregate(campaignId: string): Promise<RealAggregatedMetrics | null> {
    const rows = await this.prisma.realWorldEvent.findMany({
      where:  { campaignId },
      select: { eventType: true, value: true, source: true },
    });

    if (!rows.length) return null;

    let impressions   = 0;
    let clicks        = 0;
    let conversions   = 0;
    let retention24h  = 0;
    let retentionSeen = 0;

    for (const r of rows) {
      switch (r.eventType) {
        case 'impression':    impressions  += r.value; break;
        case 'click':         clicks       += r.value; break;
        case 'conversion':    conversions  += r.value; break;
        case 'retention_24h': retention24h += r.value; retentionSeen++; break;
      }
    }

    const hasSufficientData = impressions >= MIN_REAL_IMPRESSIONS;

    // Dominant source (most events)
    const sourceCounts = new Map<string, number>();
    for (const r of rows) sourceCounts.set(r.source, (sourceCounts.get(r.source) ?? 0) + 1);
    const source = [...sourceCounts.entries()].sort((a, b) => b[1] - a[1])[0][0] as RealEventSource;

    this.logger.debug(
      `[Reality] campaign=${campaignId} imp=${impressions} clk=${clicks} ` +
      `conv=${conversions} source=${source} sufficient=${hasSufficientData}`
    );

    return {
      impressions:      Math.round(impressions),
      clicks:           Math.round(clicks),
      conversions:      Math.round(conversions),
      retention24hRate: retentionSeen > 0 ? retention24h / retentionSeen : 0,
      source,
      hasSufficientData,
    };
  }

  // ── Raw event list for a campaign (audit/debug) ────────────────────────────

  async getEventsForCampaign(campaignId: string) {
    return this.prisma.realWorldEvent.findMany({
      where:   { campaignId },
      orderBy: { occurredAt: 'desc' },
      take:    200,
    });
  }
}
