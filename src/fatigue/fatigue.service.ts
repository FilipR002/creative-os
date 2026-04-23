// ─── 4.4 Angle Fatigue Service ────────────────────────────────────────────────
//
// Loads all signal data in a single batch pass (no N+1 queries), then
// delegates computation to the pure engine.
//
// Data sources:
//   signal 1  usage_frequency      → CreativeMemory (recent usage count)
//   signal 2  performance_decay    → CreativeMemory + AngleStats (score trend)
//   signal 3  mirofish_neg_delta   → MirofishSignal (prediction errors)
//   signal 4  blending_repetition  → MirofishSignal (secondarySlug appearances)
//   signal 5  ranking_drop_velocity→ AngleWeight global (EWMA smoothedScore)
//
// Usage:
//   const result = await fatigueService.computeForSlug('before_after', userId);
//   const batch  = await fatigueService.computeBatch({ slugs: [...], userId });
//   const all    = await fatigueService.computeAll(userId);
// ─────────────────────────────────────────────────────────────────────────────

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  computeAngleFatigue,
  normalizeUsageFrequency,
  normalizePerformanceDecay,
  normalizeMirofishNegativeDelta,
  normalizeBlendingRepetition,
  normalizeRankingDropVelocity,
} from './fatigue.engine';
import { AngleFatigueResult, FatigueBatchInput, FatigueSignals } from './fatigue.types';

// ─── Default lookback window ──────────────────────────────────────────────────

const DEFAULT_LOOKBACK = 30;

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class FatigueService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Public API ────────────────────────────────────────────────────────────

  async computeForSlug(
    slug:      string,
    userId?:   string,
    clientId?: string,
  ): Promise<AngleFatigueResult> {
    const batch = await this.computeBatch({
      slugs: [slug], userId, clientId,
    });
    return batch.get(slug) ?? this.healthyDefault(slug);
  }

  async computeBatch(input: FatigueBatchInput): Promise<Map<string, AngleFatigueResult>> {
    const { slugs, userId, clientId, lookback = DEFAULT_LOOKBACK } = input;
    if (slugs.length === 0) return new Map();

    // ── Load all data sources in parallel ─────────────────────────────────

    const [
      memRecords,
      mirofishRecords,
      angleWeights,
      angleStats,
    ] = await Promise.all([
      this.loadMemory(userId, clientId, lookback),
      this.loadMirofishSignals(slugs),
      this.loadAngleWeights(slugs),
      this.loadAngleStats(slugs),
    ]);

    // ── Pre-process: index by slug ────────────────────────────────────────

    // CreativeMemory → recent entries per angle (sorted newest first)
    const memBySlug = new Map<string, typeof memRecords>();
    for (const slug of slugs) {
      memBySlug.set(slug, memRecords.filter(m => m.angle === slug));
    }

    // MirofishSignal → records per primary slug
    const mirofishBySlug = new Map<string, typeof mirofishRecords>();
    for (const slug of slugs) {
      mirofishBySlug.set(slug, mirofishRecords.filter(r => r.angleSlug === slug));
    }

    // MirofishSignal → count of secondary appearances per slug
    const secondaryCountBySlug = new Map<string, number>();
    for (const slug of slugs) {
      secondaryCountBySlug.set(
        slug,
        mirofishRecords.filter(r => r.secondarySlug === slug).length,
      );
    }

    // AngleWeight → global smoothedScore per angleId → we need slug→angleId mapping
    // We'll use the angleStats for the slug→angleId mapping (both share slug reference via Angle)
    const weightBySlug = new Map<string, { smoothedScore: number; sampleCount: number; uncertaintyScore: number }>();
    for (const w of angleWeights) {
      // contextKey 'global' is the primary EWMA anchor
      if (w.contextKey === 'global') {
        // Match via angle relation — angleStats already gives us slug→angleId
        const stat = angleStats.find(s => s.angleId === w.angleId);
        if (stat) {
          weightBySlug.set(stat.slug, {
            smoothedScore:    w.smoothedScore,
            sampleCount:      w.sampleCount,
            uncertaintyScore: w.uncertaintyScore,
          });
        }
      }
    }

    const statBySlug = new Map(angleStats.map(s => [s.slug, s]));

    // ── Compute per slug ──────────────────────────────────────────────────

    const results = new Map<string, AngleFatigueResult>();

    for (const slug of slugs) {
      const mem         = memBySlug.get(slug) ?? [];
      const miroRecords = mirofishBySlug.get(slug) ?? [];
      const secCount    = secondaryCountBySlug.get(slug) ?? 0;
      const weight      = weightBySlug.get(slug);
      const stat        = statBySlug.get(slug);

      const signals = this.buildSignals(slug, mem, miroRecords, secCount, weight, stat);
      results.set(slug, computeAngleFatigue(slug, signals));
    }

    return results;
  }

  async computeAll(userId?: string, clientId?: string): Promise<AngleFatigueResult[]> {
    const angles = await this.prisma.angle.findMany({
      where:  { isActive: true },
      select: { slug: true },
    });
    const slugs = angles.map(a => a.slug);
    const batch = await this.computeBatch({ slugs, userId, clientId });
    return [...batch.values()];
  }

  // ── Signal builder ────────────────────────────────────────────────────────

  private buildSignals(
    slug:        string,
    mem:         { totalScore: number; isWinner: boolean; createdAt: Date }[],
    miro:        { predictionError: number | null; angleSlug: string }[],
    secCount:    number,
    weight:      { smoothedScore: number; sampleCount: number; uncertaintyScore: number } | undefined,
    stat:        { uses: number; avgCtr: number; avgConversion: number; angleId: string; slug: string } | undefined,
  ): FatigueSignals {
    // ── Signal 1: Usage frequency ─────────────────────────────────────────
    // Count appearances in the last 20 CreativeMemory records
    const usageIn20 = mem.slice(0, 20).length;
    const usageFrequency = normalizeUsageFrequency(usageIn20);

    // ── Signal 2: Performance decay ───────────────────────────────────────
    let performanceDecay = 0;
    const scores = mem.map(m => m.totalScore);
    if (scores.length >= 4) {
      const recentAvg = avg(scores.slice(0, 3));
      const priorAvg  = avg(scores.slice(3, 6));
      performanceDecay = normalizePerformanceDecay(recentAvg, priorAvg);
    } else if (stat && stat.uses >= 3) {
      // Fallback: global CTR + conversion as proxy (lower than 0.35 combined → some decay)
      const globalScore = stat.avgCtr * 0.5 + stat.avgConversion * 0.5;
      performanceDecay = normalizePerformanceDecay(globalScore, 0.50);
    }

    // ── Signal 3: MIROFISH negative delta ─────────────────────────────────
    // Take last 10 MIROFISH signals; filter those with negative prediction errors
    const negErrors = miro
      .slice(0, 10)
      .map(r => r.predictionError)
      .filter((e): e is number => e !== null && e < 0);

    const avgNegError = negErrors.length > 0 ? avg(negErrors) : 0;
    const mirofishNegativeDelta = normalizeMirofishNegativeDelta(avgNegError);

    // ── Signal 4: Blending repetition ─────────────────────────────────────
    // How many times the angle appeared as secondary blend partner
    const blendingRepetition = normalizeBlendingRepetition(secCount);

    // ── Signal 5: Ranking drop velocity ───────────────────────────────────
    const rankingDropVelocity = weight
      ? normalizeRankingDropVelocity(
          weight.smoothedScore,
          weight.sampleCount,
          weight.uncertaintyScore,
        )
      : 0;   // no weight record = no velocity data = no penalty

    return {
      usageFrequency,
      performanceDecay,
      mirofishNegativeDelta,
      blendingRepetition,
      rankingDropVelocity,
    };
  }

  // ── Data loaders ─────────────────────────────────────────────────────────

  private async loadMemory(
    userId?:   string,
    clientId?: string,
    lookback = DEFAULT_LOOKBACK,
  ) {
    return this.prisma.creativeMemory.findMany({
      where: {
        ...(userId   ? { userId }   : {}),
        ...(clientId ? { clientId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take:    lookback,
      select:  { angle: true, totalScore: true, isWinner: true, createdAt: true },
    });
  }

  private async loadMirofishSignals(slugs: string[]) {
    return this.prisma.mirofishSignal.findMany({
      where: {
        OR: [
          { angleSlug:     { in: slugs } },
          { secondarySlug: { in: slugs } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take:    200,
      select: {
        angleSlug:      true,
        secondarySlug:  true,
        predictionError: true,
      },
    });
  }

  private async loadAngleWeights(slugs: string[]) {
    // Load global context weights for the specified angles.
    // We need the angle.slug → we'll join via the angle relation.
    const angles = await this.prisma.angle.findMany({
      where:   { slug: { in: slugs } },
      select:  { id: true, slug: true },
    });
    const angleIds = angles.map(a => a.id);

    const weights = await this.prisma.angleWeight.findMany({
      where:   { angleId: { in: angleIds }, contextKey: 'global' },
      select:  {
        angleId:          true,
        contextKey:       true,
        smoothedScore:    true,
        sampleCount:      true,
        uncertaintyScore: true,
      },
    });

    // Attach slug to each weight record
    const idToSlug = new Map(angles.map(a => [a.id, a.slug]));
    return weights.map(w => ({ ...w, slug: idToSlug.get(w.angleId) ?? '' }));
  }

  private async loadAngleStats(slugs: string[]) {
    const angles = await this.prisma.angle.findMany({
      where:   { slug: { in: slugs } },
      include: { angleStats: true },
    });
    return angles
      .filter(a => a.angleStats)
      .map(a => ({
        angleId:       a.id,
        slug:          a.slug,
        uses:          a.angleStats!.uses,
        avgCtr:        a.angleStats!.avgCtr,
        avgConversion: a.angleStats!.avgConversion,
      }));
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private healthyDefault(slug: string): AngleFatigueResult {
    return {
      angle_name:           slug,
      fatigue_state:        'HEALTHY',
      fatigue_score:        0,
      probability_modifier: 0,
      exploration_signal:   0,
      reasoning:            `${slug} → HEALTHY (no data; safe default)`,
      _signals: {
        usageFrequency:       0,
        performanceDecay:     0,
        mirofishNegativeDelta: 0,
        blendingRepetition:   0,
        rankingDropVelocity:  0,
      },
    };
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function avg(arr: number[]): number {
  return arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
}
