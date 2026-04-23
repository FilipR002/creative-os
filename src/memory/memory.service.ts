import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MemoryRepository } from './memory.repository';
import {
  MemoryWriteInput,
  MemoryQueryInput,
  MemoryQueryResult,
} from './memory.types';
import { CreativeScoreResult } from '../scoring/scoring.types';

// Angles with weight < this threshold are considered "rejected" (underperforming)
const REJECTION_WEIGHT_THRESHOLD = 0.60;

// Minimum runs before an angle is considered "established enough" for rejection
const MIN_RUNS_FOR_REJECTION = 3;

@Injectable()
export class MemoryService {
  constructor(
    private readonly repo: MemoryRepository,
    private readonly prisma: PrismaService,
  ) {}

  // ─── Called by ScoringService after evaluate() ───────────────────────────
  async storeFromScoringResult(
    results: CreativeScoreResult[],
    clientId?: string,
    industry?: string,
    userId?: string,
  ): Promise<void> {
    for (const result of results) {
      const creative = await this.prisma.creative.findUnique({
        where:   { id: result.creativeId },
        include: { concept: true, angle: true, campaign: true },
      });
      if (!creative) continue;

      const input: MemoryWriteInput = {
        userId:     userId || (creative as any).campaign?.userId || undefined,
        clientId:   clientId   || creative.campaignId || 'unknown',
        industry:   industry   || 'general',
        campaignId: creative.campaignId,
        creativeId: creative.id,
        format:     creative.format.toLowerCase(),
        angle:      creative.angle?.slug || 'unknown',
        concept:    (creative.concept?.rawJson as Record<string, any>) || {},
        scores: {
          ctr:        result.ctrScore,
          engagement: result.engagement,
          conversion: result.conversion,
          clarity:    result.clarity,
          total:      result.totalScore,
        },
        totalScore: result.totalScore,
        isWinner:   result.isWinner,
      };

      await this.repo.store(input);
    }
  }

  // ─── Manual store ────────────────────────────────────────────────────────
  async store(input: MemoryWriteInput) {
    return this.repo.store(input);
  }

  // ─── Enhanced query (Phase 4) ────────────────────────────────────────────
  /**
   * Returns top creatives, best angles, avg scores + Phase 4 intelligence:
   *   - rejected_angles: underperforming angles below weight threshold
   *   - reasoning: plain-text explanation of why angles were rejected/accepted
   *
   * Before returning, filters out creatives from low-weight angles.
   */
  async query(filters: MemoryQueryInput): Promise<MemoryQueryResult & {
    rejectedAngles: { slug: string; weight: number; reason: string }[];
    reasoning: string;
  }> {
    // 1. Fetch raw data in parallel
    const [allTopCreatives, bestAngles, avgScores, angleStatsRows] = await Promise.all([
      this.repo.findTopCreatives({ ...filters, limit: (filters.limit || 10) * 2 }),
      this.repo.getAnglePerformance({ userId: filters.userId, clientId: filters.clientId, industry: filters.industry }),
      this.repo.getAverageScores(filters),
      this.prisma.angleStats.findMany({
        include: { angle: { select: { slug: true } } },
        orderBy: { weight: 'desc' },
      }),
    ]);

    // 2. Identify rejected angles (enough data + below threshold)
    const rejectedAngles = angleStatsRows
      .filter(s => s.uses >= MIN_RUNS_FOR_REJECTION && s.weight < REJECTION_WEIGHT_THRESHOLD)
      .map(s => ({
        slug:   s.angle.slug,
        weight: round(s.weight),
        reason: `${s.uses} runs, ${s.wins} wins (${Math.round((s.wins / s.uses) * 100)}% win rate), weight dropped to ${round(s.weight)}`,
      }));

    const rejectedSlugs = new Set(rejectedAngles.map(r => r.slug));

    // 3. Filter top creatives — exclude those from rejected angles
    const topCreatives = allTopCreatives
      .filter(c => !rejectedSlugs.has(c.angle))
      .slice(0, filters.limit || 10);

    // 4. Filter best angles — rank by composite: win rate + avg CTR + conversion
    const rankedAngles = bestAngles
      .map(a => {
        const stat = angleStatsRows.find(s => s.angle.slug === a.angle);
        const weight = stat?.weight ?? 1.0;
        const isRejected = rejectedSlugs.has(a.angle);
        // Composite rank score
        const rankScore = (a.winRate * 0.40) + (a.avgScore * 0.40) + (weight > 1 ? 0.20 : 0);
        return { ...a, weight: round(weight), isRejected, rankScore };
      })
      .filter(a => !a.isRejected)
      .sort((a, b) => b.rankScore - a.rankScore);

    // 5. Build reasoning string
    const topAngle    = rankedAngles[0];
    const numRejected = rejectedAngles.length;
    const reasoning   = [
      `Memory contains ${allTopCreatives.length} creatives across ${bestAngles.length} angles.`,
      topAngle
        ? `Best performing angle: "${topAngle.angle}" (win rate: ${Math.round(topAngle.winRate * 100)}%, avg score: ${topAngle.avgScore}).`
        : 'Not enough data to determine best angle.',
      numRejected > 0
        ? `${numRejected} angle(s) rejected due to consistent underperformance: ${rejectedAngles.map(r => r.slug).join(', ')}.`
        : 'No angles rejected — all have acceptable performance.',
      'Results ranked by: win rate (40%) + avg score (40%) + weight bonus (20%).',
    ].join(' ');

    return {
      topCreatives,
      bestAngles:    rankedAngles,
      avgScores,
      rejectedAngles,
      reasoning,
    };
  }

  // ─── Best angles ─────────────────────────────────────────────────────────
  async getBestAngles(clientId?: string, industry?: string, userId?: string) {
    const [angles, stats] = await Promise.all([
      this.repo.getAnglePerformance({ userId, clientId, industry }),
      this.prisma.angleStats.findMany({
        include: { angle: { select: { slug: true } } },
      }),
    ]);

    return {
      angles: angles.map(a => {
        const stat = stats.find(s => s.angle.slug === a.angle);
        return { ...a, weight: round(stat?.weight ?? 1.0), uses: stat?.uses ?? 0 };
      }),
    };
  }

  // ─── Format stats ─────────────────────────────────────────────────────────
  async getFormatStats(clientId?: string, industry?: string, userId?: string) {
    const [stats, formatWeights] = await Promise.all([
      this.repo.getFormatPerformance({ userId, clientId, industry }),
      this.prisma.formatStats.findMany(),
    ]);

    return {
      stats: stats.map(s => {
        const fw = formatWeights.find(f => f.format === s.format);
        return { ...s, weight: round(fw?.weight ?? 1.0) };
      }),
    };
  }

  // ─── Win rates ────────────────────────────────────────────────────────────
  async getWinRates(userId?: string) {
    return this.repo.getWinRateByAngle(userId);
  }
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
