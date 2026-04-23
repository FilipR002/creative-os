import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  MemoryWriteInput,
  MemoryQueryInput,
  AnglePerformance,
  FormatPerformance,
  TopCreative,
} from './memory.types';

@Injectable()
export class MemoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ─── WRITE ────────────────────────────────────────────────────────────────

  async store(input: MemoryWriteInput) {
    return this.prisma.creativeMemory.create({
      data: {
        userId:     input.userId    || null,
        clientId:   input.clientId,
        industry:   input.industry,
        campaignId: input.campaignId,
        creativeId: input.creativeId,
        format:     input.format,
        angle:      input.angle,
        concept:    input.concept,
        scores:     input.scores,
        totalScore: input.totalScore,
        isWinner:   input.isWinner,
      },
    });
  }

  // ─── READ — top creatives ─────────────────────────────────────────────────

  async findTopCreatives(filters: MemoryQueryInput): Promise<TopCreative[]> {
    const where: any = {};
    if (filters.userId)   where.userId   = filters.userId;
    if (filters.clientId) where.clientId = filters.clientId;
    if (filters.industry) where.industry  = { contains: filters.industry, mode: 'insensitive' };
    if (filters.format)   where.format    = filters.format;
    if (filters.angle)    where.angle     = filters.angle;

    const rows = await this.prisma.creativeMemory.findMany({
      where,
      orderBy: { totalScore: 'desc' },
      take: filters.limit || 10,
      select: {
        id: true, creativeId: true, format: true,
        angle: true, totalScore: true, isWinner: true, createdAt: true,
      },
    });

    return rows.map(r => ({
      memoryId:   r.id,
      creativeId: r.creativeId,
      format:     r.format,
      angle:      r.angle,
      totalScore: round(r.totalScore),
      isWinner:   r.isWinner,
      createdAt:  r.createdAt,
    }));
  }

  // ─── READ — angle performance per industry ────────────────────────────────

  async getAnglePerformance(filters: {
    userId?: string;
    clientId?: string;
    industry?: string;
  }): Promise<AnglePerformance[]> {
    const where: any = {};
    if (filters.userId)   where.userId   = filters.userId;
    if (filters.clientId) where.clientId = filters.clientId;
    if (filters.industry) where.industry = { contains: filters.industry, mode: 'insensitive' };

    const rows = await this.prisma.creativeMemory.findMany({
      where,
      select: { angle: true, totalScore: true, isWinner: true },
    });

    // Group by angle
    const grouped: Record<string, { scores: number[]; wins: number }> = {};
    for (const r of rows) {
      if (!grouped[r.angle]) grouped[r.angle] = { scores: [], wins: 0 };
      grouped[r.angle].scores.push(r.totalScore);
      if (r.isWinner) grouped[r.angle].wins++;
    }

    return Object.entries(grouped)
      .map(([angle, data]) => ({
        angle,
        avgScore:   round(avg(data.scores)),
        winRate:    round(data.wins / data.scores.length),
        totalRuns:  data.scores.length,
      }))
      .sort((a, b) => b.avgScore - a.avgScore);
  }

  // ─── READ — format performance ────────────────────────────────────────────

  async getFormatPerformance(filters: {
    userId?: string;
    clientId?: string;
    industry?: string;
  }): Promise<FormatPerformance[]> {
    const where: any = {};
    if (filters.userId)   where.userId   = filters.userId;
    if (filters.clientId) where.clientId = filters.clientId;
    if (filters.industry) where.industry = { contains: filters.industry, mode: 'insensitive' };

    const rows = await this.prisma.creativeMemory.findMany({
      where,
      select: { format: true, totalScore: true, scores: true },
    });

    const grouped: Record<string, {
      totals: number[];
      ctrs: number[];
      engagements: number[];
      conversions: number[];
    }> = {};

    for (const r of rows) {
      const s = r.scores as any;
      if (!grouped[r.format]) {
        grouped[r.format] = { totals: [], ctrs: [], engagements: [], conversions: [] };
      }
      grouped[r.format].totals.push(r.totalScore);
      grouped[r.format].ctrs.push(s?.ctr || 0);
      grouped[r.format].engagements.push(s?.engagement || 0);
      grouped[r.format].conversions.push(s?.conversion || 0);
    }

    return Object.entries(grouped)
      .map(([format, data]) => ({
        format,
        avgScore:      round(avg(data.totals)),
        avgCtr:        round(avg(data.ctrs)),
        avgEngagement: round(avg(data.engagements)),
        avgConversion: round(avg(data.conversions)),
        totalRuns:     data.totals.length,
      }))
      .sort((a, b) => b.avgScore - a.avgScore);
  }

  // ─── READ — average scores across a filter set ────────────────────────────

  async getAverageScores(filters: MemoryQueryInput): Promise<{
    ctr: number; engagement: number; conversion: number; clarity: number; total: number;
  }> {
    const where: any = {};
    if (filters.userId)   where.userId   = filters.userId;
    if (filters.clientId) where.clientId = filters.clientId;
    if (filters.industry) where.industry = { contains: filters.industry, mode: 'insensitive' };
    if (filters.format)   where.format   = filters.format;
    if (filters.angle)    where.angle    = filters.angle;

    const rows = await this.prisma.creativeMemory.findMany({
      where,
      select: { scores: true, totalScore: true },
    });

    if (!rows.length) {
      return { ctr: 0, engagement: 0, conversion: 0, clarity: 0, total: 0 };
    }

    const extract = (key: string) =>
      rows.map(r => ((r.scores as any)?.[key] ?? 0));

    return {
      ctr:        round(avg(extract('ctr'))),
      engagement: round(avg(extract('engagement'))),
      conversion: round(avg(extract('conversion'))),
      clarity:    round(avg(extract('clarity'))),
      total:      round(avg(rows.map(r => r.totalScore))),
    };
  }

  // ─── READ — win rate per angle (global) ──────────────────────────────────

  async getWinRateByAngle(userId?: string): Promise<{ angle: string; winRate: number; totalRuns: number }[]> {
    const where: any = {};
    if (userId) where.userId = userId;
    const rows = await this.prisma.creativeMemory.findMany({
      where,
      select: { angle: true, isWinner: true },
    });

    const grouped: Record<string, { total: number; wins: number }> = {};
    for (const r of rows) {
      if (!grouped[r.angle]) grouped[r.angle] = { total: 0, wins: 0 };
      grouped[r.angle].total++;
      if (r.isWinner) grouped[r.angle].wins++;
    }

    return Object.entries(grouped)
      .map(([angle, d]) => ({
        angle,
        winRate:   round(d.wins / d.total),
        totalRuns: d.total,
      }))
      .sort((a, b) => b.winRate - a.winRate);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function avg(nums: number[]): number {
  if (!nums.length) return 0;
  return nums.reduce((s, n) => s + n, 0) / nums.length;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
