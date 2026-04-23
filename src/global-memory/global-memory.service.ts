// ─── 4.10 Global Creative Memory — Service ───────────────────────────────────
// Orchestrates Prisma reads/writes and calls the pure engine for computation.
// Writes: CreativeMemory (per variant), LearningCycle (audit), MirofishSignal.
// Reads:  AngleStats, AngleWeight, LearningCycle, MirofishSignal, PerformanceBaseline.

import { Injectable, Optional } from '@nestjs/common';
import { PrismaService }        from '../prisma/prisma.service';
import { MemoryEventService }   from '../optimization/cost/memory-event.service';
import { assertClientScope }    from '../common/guards/client-scope';
import {
  AngleAggregateRow,
  GlobalMemoryIngestInput,
  GlobalMemoryOutput,
  LearningTrend,
  MirofishAccuracyRow,
} from './global-memory.types';
import {
  computeAngleMemoryUpdates,
  computeCampaignMemoryUpdates,
  computeHookMemoryUpdates,
  computeSystemMemoryUpdates,
  extractHookPerfRows,
  generateInsights,
} from './global-memory.engine';

// ─── Query window ─────────────────────────────────────────────────────────────

const LOOKBACK_CYCLES    = 30;  // recent learning cycles for trend analysis
const MIROFISH_LOOKBACK  = 20;  // recent MIROFISH signals for accuracy
const SCORE_SCALE        = 100; // 4.9 scores are 0–100, convert to 0–1

@Injectable()
export class GlobalMemoryService {
  // Incremented on every successful ingest() — used by cost-optimizer fingerprinting.
  private version = 0;

  constructor(
    private readonly prisma:       PrismaService,
    @Optional() private readonly memoryEvent: MemoryEventService,
  ) {}

  /** System-generated version token. Never changes between ingest() calls so fingerprints remain stable. */
  getVersion(): string {
    return `mem-v${this.version}`;
  }

  // ─── INGEST ───────────────────────────────────────────────────────────────
  // Primary entry point: called once per campaign run.

  async ingest(input: GlobalMemoryIngestInput): Promise<GlobalMemoryOutput> {
    this.version++;
    this.memoryEvent?.notify('MEMORY_UPDATE');

    // 1. Persist each variant to CreativeMemory.
    await this.writeCreativeMemory(input);

    // 2. Write MIROFISH signals (if provided).
    await this.writeMirofishSignals(input);

    // 3. Write LearningCycle audit entry for the winning variant.
    await this.writeLearningCycle(input);

    // 4. Read everything needed for the 4-layer computation.
    const [angleRows, learningTrend, mirofishAccuracy] = await Promise.all([
      this.fetchAngleAggregates(input.primary_angle, input.client_id, input.industry),
      this.fetchLearningTrend(input.primary_angle),
      this.fetchMirofishAccuracy(input.primary_angle),
    ]);

    // 5. Compute 4-layer memory updates.
    const angle_memory_updates = computeAngleMemoryUpdates(angleRows);

    const winningHooks = new Set(
      (input.hook_booster_refs ?? [])
        .filter((_, i) => input.variant_results[i]?.is_winner)
        .map(r => r.hook),
    );
    const hookRows = extractHookPerfRows(input.hook_booster_refs ?? [], winningHooks);
    const hook_memory_updates = computeHookMemoryUpdates(hookRows);

    const mirofishAccuracyScore = mirofishAccuracy.sampleCount > 0
      ? 1 - mirofishAccuracy.avgAbsError
      : 0.70; // neutral prior when no data
    const campaign_memory_updates = computeCampaignMemoryUpdates(
      input, input.variant_results, mirofishAccuracyScore,
    );

    const system_memory_updates = computeSystemMemoryUpdates(
      angleRows, learningTrend, mirofishAccuracy,
    );

    const partial: Omit<GlobalMemoryOutput, 'insights'> = {
      angle_memory_updates,
      hook_memory_updates,
      campaign_memory_updates,
      system_memory_updates,
    };

    return { ...partial, insights: generateInsights(partial) };
  }

  // ─── QUERY ────────────────────────────────────────────────────────────────
  // Read-only: returns current 4-layer memory state without ingesting.

  async query(clientId?: string, industry?: string, primaryAngle?: string): Promise<GlobalMemoryOutput> {
    // Phase 5.7 — global memory queries are always client-scoped.
    // Cross-client / system-wide aggregates live exclusively in CrossClientLearningService.
    assertClientScope(clientId);

    const angleSlug = primaryAngle ?? '';

    const [angleRows, learningTrend, mirofishAccuracy] = await Promise.all([
      this.fetchAngleAggregates(angleSlug, clientId, industry),
      this.fetchLearningTrend(angleSlug),
      this.fetchMirofishAccuracy(angleSlug),
    ]);

    const angle_memory_updates    = computeAngleMemoryUpdates(angleRows);
    const hook_memory_updates     = computeHookMemoryUpdates([]);
    const campaign_memory_updates = [];

    const mirofishAccuracyScore = mirofishAccuracy.sampleCount > 0
      ? 1 - mirofishAccuracy.avgAbsError
      : 0.70;

    const system_memory_updates = computeSystemMemoryUpdates(
      angleRows, learningTrend, mirofishAccuracy,
    );

    const partial: Omit<GlobalMemoryOutput, 'insights'> = {
      angle_memory_updates,
      hook_memory_updates,
      campaign_memory_updates,
      system_memory_updates,
    };

    return { ...partial, insights: generateInsights(partial) };
  }

  // ─── Prisma writes ────────────────────────────────────────────────────────

  private async writeCreativeMemory(input: GlobalMemoryIngestInput): Promise<void> {
    const rows = input.variant_results.map(v => ({
      clientId:   input.client_id,
      industry:   input.industry,
      campaignId: input.campaign_id,
      creativeId: v.id,
      format:     input.format,
      angle:      input.primary_angle,
      userId:     input.user_id ?? null,
      concept: {
        goal:    input.goal    ?? null,
        emotion: input.emotion ?? null,
        secondary_angle: input.secondary_angle ?? null,
      },
      scores: {
        ctr:        v.breakdown.ctr        / SCORE_SCALE,
        engagement: v.breakdown.retention  / SCORE_SCALE,
        conversion: v.breakdown.conversion / SCORE_SCALE,
        clarity:    v.breakdown.clarity    / SCORE_SCALE,
        total:      v.final_score          / SCORE_SCALE,
      },
      totalScore: v.final_score / SCORE_SCALE,
      isWinner:   v.is_winner,
    }));

    // Single round-trip batch insert — skipDuplicates guards against any
    // creativeId collision on a retry without changing stored semantics.
    await this.prisma.creativeMemory.createMany({ data: rows, skipDuplicates: true });
  }

  private async writeMirofishSignals(input: GlobalMemoryIngestInput): Promise<void> {
    const signals = input.mirofish_signals ?? [];
    if (!signals.length) return;

    const winner = input.variant_results.find(v => v.is_winner);

    for (const sig of signals) {
      // Only write if a creativeId is provided or we can derive one.
      const creativeId = sig.creative_id ?? winner?.id;
      if (!creativeId) continue;

      await this.prisma.mirofishSignal.create({
        data: {
          creativeId,
          campaignId:           input.campaign_id,
          angleSlug:            input.primary_angle,
          secondarySlug:        input.secondary_angle ?? null,
          goal:                 input.goal ?? null,
          predictedScore:       sig.predicted_score,
          predictedConversion:  sig.predicted_score * 0.85, // proxy if not broken out
          predictedAttention:   sig.predicted_score * 0.90,
          predictedTrust:       sig.predicted_score * 0.80,
          actualScore:          sig.actual_score ?? null,
          isWinner:             winner?.id === creativeId ? true : null,
          predictionError:      sig.prediction_error ?? null,
        },
      });
    }
  }

  private async writeLearningCycle(input: GlobalMemoryIngestInput): Promise<void> {
    const winner = input.variant_results.find(v => v.is_winner);
    if (!winner) return;

    // Look up current angle weight for before/after tracking.
    const angleWeight = await this.prisma.angleWeight.findFirst({
      where: { angle: { slug: input.primary_angle }, contextType: 'global' },
    });
    const weightBefore = angleWeight?.weight ?? 1.0;
    const actualScore  = winner.final_score / SCORE_SCALE;

    // Simple learning rate: 0.10 constant (conservative).
    const learningRate = 0.10;
    const weightAfter  = weightBefore + learningRate * (actualScore - 0.50);

    await this.prisma.learningCycle.create({
      data: {
        campaignId:     input.campaign_id,
        creativeId:     winner.id,
        angleSlug:      input.primary_angle,
        format:         input.format,
        goal:           input.goal ?? null,
        clientId:       input.client_id,
        industry:       input.industry,
        predictedScore: 0.50, // neutral prior when no MIROFISH prediction available
        actualScore,
        delta:          actualScore - 0.50,
        weightBefore,
        weightAfter:    Math.max(0.10, weightAfter),
        learningRate,
        confidenceLevel: Math.min(1, winner.final_score / 100),
        isWinner:        true,
      },
    });
  }

  // ─── Prisma reads ─────────────────────────────────────────────────────────

  private async fetchAngleAggregates(
    primaryAngle: string,
    clientId?:    string,
    industry?:    string,
  ): Promise<AngleAggregateRow[]> {
    // Fetch all AngleStats (joined with AngleWeight for decay calculation).
    const stats = await this.prisma.angleStats.findMany({
      include: {
        angle: {
          select: { slug: true },
          include: {
            angleWeights: {
              where: { contextType: 'global' },
              take: 1,
              orderBy: { updatedAt: 'desc' },
            },
          },
        },
      },
    });

    const now = Date.now();

    return stats.map(s => {
      const weight = s.angle.angleWeights[0];
      const lastUsed = weight?.lastUsedAt ?? null;
      const daysSinceUsed = lastUsed
        ? Math.floor((now - lastUsed.getTime()) / 86_400_000)
        : null;

      return {
        slug:          s.angle.slug,
        uses:          s.uses,
        wins:          s.wins,
        avgCtr:        s.avgCtr,
        avgRetention:  s.avgRetention,
        avgConversion: s.avgConversion,
        weight:        s.weight,
        daysSinceUsed,
      };
    });
  }

  private async fetchLearningTrend(angleSlug: string): Promise<LearningTrend> {
    const cycles = await this.prisma.learningCycle.findMany({
      where:   angleSlug ? { angleSlug } : undefined,
      orderBy: { cycleAt: 'desc' },
      take:    LOOKBACK_CYCLES,
    });

    if (cycles.length < 2) {
      return { slope: 0, sampleCount: cycles.length, avgDelta: 0 };
    }

    // Simple linear trend on actualScore (oldest first for positive slope = improving).
    const ordered = [...cycles].reverse();
    const n = ordered.length;
    const meanX = (n - 1) / 2;
    const meanY = ordered.reduce((s, c) => s + c.actualScore, 0) / n;

    let num = 0, den = 0;
    ordered.forEach((c, i) => {
      num += (i - meanX) * (c.actualScore - meanY);
      den += (i - meanX) ** 2;
    });

    const slope  = den !== 0 ? num / den : 0;
    const avgDelta = cycles.reduce((s, c) => s + c.delta, 0) / cycles.length;

    return { slope, sampleCount: n, avgDelta };
  }

  private async fetchMirofishAccuracy(angleSlug: string): Promise<MirofishAccuracyRow> {
    const signals = await this.prisma.mirofishSignal.findMany({
      where: {
        ...(angleSlug ? { angleSlug } : {}),
        actualScore:      { not: null },
        predictionError:  { not: null },
      },
      orderBy: { createdAt: 'desc' },
      take:    MIROFISH_LOOKBACK,
    });

    if (!signals.length) {
      return { avgAbsError: 0.10, sampleCount: 0, isGrowing: false };
    }

    const errors = signals.map(s => Math.abs(s.predictionError ?? 0));
    const avgAbsError = errors.reduce((s, e) => s + e, 0) / errors.length;

    // Detect growing error trend: compare first half vs second half (recent = second half).
    const mid   = Math.floor(errors.length / 2);
    const older = errors.slice(0, mid);
    const newer = errors.slice(mid);
    const avgOlder = older.length > 0 ? older.reduce((s, e) => s + e, 0) / older.length : 0;
    const avgNewer = newer.length > 0 ? newer.reduce((s, e) => s + e, 0) / newer.length : 0;
    const isGrowing = avgNewer > avgOlder + 0.02;

    return { avgAbsError, sampleCount: signals.length, isGrowing };
  }
}
