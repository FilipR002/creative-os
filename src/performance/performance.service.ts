import { Injectable } from '@nestjs/common';
import { PrismaService }   from '../prisma/prisma.service';
import { FeedbackService } from '../feedback/feedback.service';
import { CsvParserService, extractTrackingId, type ParsedRow } from './csv-parser.service';
import { randomUUID } from 'crypto';

// ── Public types ──────────────────────────────────────────────────────────────

export interface PerformanceRowMetrics {
  impressions: number;
  clicks:      number;
  ctr:         number;
  conversions: number;
  revenue:     number;
}

export interface PerformanceRow {
  id:                  string;
  adName:              string;
  campaignName:        string;
  url:                 string | null;
  metrics:             PerformanceRowMetrics;
  extractedTrackingId: string | null;
  status:              'matched' | 'unmatched';
  matchedCreative:     { id: string; label: string } | null;
  confidence:          number;
}

export interface ImportResult {
  rows:  PerformanceRow[];
  stats: {
    total:     number;
    matched:   number;
    unmatched: number;
    confidence: number;
  };
}

export interface ConfirmPayload {
  rows: Array<{
    creativeId: string;
    metrics:    PerformanceRowMetrics;
  }>;
}

export interface InsightResult {
  topPerformer:  { id: string; label: string; ctr: number; conversions: number; totalScore: number } | null;
  weakPerformer: { id: string; label: string; ctr: number; conversions: number; totalScore: number } | null;
  insight:       string | null;
  performers:    Array<{ id: string; label: string; ctr: number; conversions: number; totalScore: number }>;
}

// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class PerformanceService {
  constructor(
    private readonly prisma:    PrismaService,
    private readonly feedback:  FeedbackService,
    private readonly csvParser: CsvParserService,
  ) {}

  // ── Step 1: Parse CSV and return match preview (no side-effects) ─────────────

  async importCsv(buffer: Buffer): Promise<ImportResult> {
    const parsed = this.csvParser.parse(buffer);

    if (parsed.length === 0) {
      return { rows: [], stats: { total: 0, matched: 0, unmatched: 0, confidence: 0 } };
    }

    // Group by co_id
    const grouped   = new Map<string, ParsedRow[]>();
    const noIdRows: ParsedRow[] = [];

    for (const row of parsed) {
      const coId = extractTrackingId(row.url);
      if (coId) {
        if (!grouped.has(coId)) grouped.set(coId, []);
        grouped.get(coId)!.push(row);
      } else {
        noIdRows.push(row);
      }
    }

    const rows: PerformanceRow[] = [];

    // ── Resolve grouped (co_id) rows ─────────────────────────────────────────
    for (const [coId, rowGroup] of grouped) {
      const creative = await this.prisma.creative.findUnique({
        where:  { id: coId },
        select: { id: true, format: true, variant: true },
      });

      const agg       = this.aggregate(rowGroup);
      const trackId   = coId;
      const first     = rowGroup[0];

      if (creative) {
        rows.push({
          id:                  randomUUID(),
          adName:              first.adName,
          campaignName:        first.campaignName,
          url:                 first.url || null,
          metrics:             agg,
          extractedTrackingId: trackId,
          status:              'matched',
          matchedCreative: {
            id:    creative.id,
            label: `${creative.format} – Variant ${creative.variant}`,
          },
          confidence: 1,
        });
      } else {
        rows.push({
          id:                  randomUUID(),
          adName:              first.adName,
          campaignName:        first.campaignName,
          url:                 first.url || null,
          metrics:             agg,
          extractedTrackingId: trackId,
          status:              'unmatched',
          matchedCreative:     null,
          confidence:          0,
        });
      }
    }

    // ── No-ID rows → unmatched ────────────────────────────────────────────────
    for (const row of noIdRows) {
      const agg = this.aggregate([row]);
      rows.push({
        id:                  randomUUID(),
        adName:              row.adName,
        campaignName:        row.campaignName,
        url:                 row.url || null,
        metrics:             agg,
        extractedTrackingId: null,
        status:              'unmatched',
        matchedCreative:     null,
        confidence:          0,
      });
    }

    const matchedCount   = rows.filter(r => r.status === 'matched').length;
    const unmatchedCount = rows.filter(r => r.status === 'unmatched').length;
    const confidence     = rows.length > 0 ? matchedCount / rows.length : 0;

    return {
      rows,
      stats: {
        total:     rows.length,
        matched:   matchedCount,
        unmatched: unmatchedCount,
        confidence,
      },
    };
  }

  // ── Step 2: Confirm import — submit real metrics to the learning engine ───────

  async confirmImport(payload: ConfirmPayload): Promise<{ submitted: number; failed: number }> {
    let submitted = 0;
    let failed    = 0;

    for (const { creativeId, metrics } of payload.rows) {
      try {
        await this.feedback.submitRealMetrics({
          creativeId,
          ctr:        Math.min(metrics.ctr,        1),
          retention:  0.5,
          conversion: Math.min(metrics.conversions, 1),
        });
        submitted++;
      } catch {
        failed++;
      }
    }

    return { submitted, failed };
  }

  // ── Manual match (legacy — kept for backward compat) ─────────────────────────

  async manualMatch(rows: Array<{ creativeId: string; metrics: Omit<ParsedRow, 'adName' | 'campaignName' | 'url'> }>): Promise<{ submitted: number; failed: number }> {
    return this.confirmImport({ rows: rows.map(r => ({ creativeId: r.creativeId, metrics: r.metrics as PerformanceRowMetrics })) });
  }

  // ── Insights ──────────────────────────────────────────────────────────────────

  async getInsights(campaignId: string | null): Promise<InsightResult> {
    // Fetch creative scores (with creative → for campaignId filter)
    const scores = await this.prisma.creativeScore.findMany({
      where: campaignId
        ? { creative: { campaignId } }
        : {},
      include: {
        creative: { select: { id: true, format: true, variant: true, campaignId: true } },
      },
      orderBy: { totalScore: 'desc' },
      take:    50,
    });

    if (scores.length === 0) {
      return { topPerformer: null, weakPerformer: null, insight: null, performers: [] };
    }

    const performers = scores.map(s => ({
      id:         s.creative.id,
      label:      `${s.creative.format} – Variant ${s.creative.variant}`,
      ctr:        s.ctrScore,
      conversions: s.conversion,
      totalScore: s.totalScore,
    }));

    const top  = performers[0]  ?? null;
    const weak = performers[performers.length - 1] ?? null;

    let insight: string | null = null;
    if (top && weak && top.id !== weak.id) {
      const delta = top.totalScore - weak.totalScore;
      if (delta > 0.1) {
        const pct = Math.round(delta * 100);
        insight = `${top.label} outperforms ${weak.label} by +${pct}%`;
      }
    }

    return {
      topPerformer:  top,
      weakPerformer: weak,
      insight,
      performers,
    };
  }

  // ── Helpers ────────────────────────────────────────────────────────────────────

  private aggregate(rows: ParsedRow[]): PerformanceRowMetrics {
    const impressions = rows.reduce((s, r) => s + r.impressions, 0);
    const clicks      = rows.reduce((s, r) => s + r.clicks,      0);
    const conversions = rows.reduce((s, r) => s + r.conversions,  0);
    const revenue     = rows.reduce((s, r) => s + r.revenue,      0);
    const ctr         = impressions > 0 ? clicks / impressions : rows.reduce((s, r) => s + r.ctr, 0) / rows.length;

    return { impressions, clicks, ctr, conversions, revenue };
  }
}
