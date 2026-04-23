import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { CompetitorIntelligenceService } from '../competitor-intelligence/competitor-intelligence.service';
import { VelocityService }               from './velocity.service';
import { PredictedTrend, TrendStage, TrendHistory, TrendSummary } from './types';

const STAGE_THRESHOLDS = {
  early:      { min: 0,    max: 0.35 },
  emerging:   { min: 0.35, max: 0.55 },
  rising:     { min: 0.55, max: 0.72 },
  peak:       { min: 0.72, max: 0.85 },
  saturating: { min: 0.85, max: 1.01 },
};

function computeStage(viralityScore: number, repetitionFrequency: number): TrendStage {
  if (repetitionFrequency > 0.7) return 'saturating';
  for (const [stage, bounds] of Object.entries(STAGE_THRESHOLDS)) {
    if (viralityScore >= bounds.min && viralityScore < bounds.max) {
      return stage as TrendStage;
    }
  }
  return 'early';
}

function predictedPeakTime(velocity: number, stage: TrendStage): string {
  if (stage === 'peak' || stage === 'saturating') return 'At or past peak';
  if (velocity > 0.7) return '1-2 days';
  if (velocity > 0.5) return '3-5 days';
  if (velocity > 0.3) return '1-2 weeks';
  return '2-4 weeks';
}

@Injectable()
export class TrendPredictorService implements OnModuleInit {
  private readonly logger   = new Logger(TrendPredictorService.name);
  private readonly trends   = new Map<string, PredictedTrend>();
  private readonly history  = new Map<string, TrendHistory>();
  private lastUpdated: Date = new Date();

  constructor(
    private readonly ci:       CompetitorIntelligenceService,
    private readonly velocity: VelocityService,
  ) {}

  onModuleInit() {
    // Initial prediction pass
    this.runPrediction().catch(() => {});
  }

  async runPrediction(): Promise<PredictedTrend[]> {
    this.logger.log('Running trend prediction pass');

    // Gather all completed CI results
    const jobs = this.ci.listJobs().filter(j => j.status === 'complete');
    if (!jobs.length) {
      this.logger.log('No completed CI jobs — predictions unavailable');
      return [];
    }

    // Build ad snapshot pool
    const snapshots: Parameters<VelocityService['computeSignals']>[0] = [];
    for (const job of jobs) {
      const result = this.ci.getResult(job.id);
      if (!result) continue;
      for (const ad of result.ads) {
        snapshots.push({
          hook:                 ad.hook,
          format:               ad.format,
          emotionalTrigger:     ad.emotionalTrigger,
          performanceSignal:    ad.performanceSignal,
          engagementLikelihood: ad.scores.engagementLikelihood,
          noveltyScore:         ad.scores.noveltyScore,
          repetitionFrequency:  ad.scores.repetitionFrequency,
          brand:                ad.brand,
          source:               ad.source,
          recordedAt:           result.completedAt,
        });
      }
    }

    const signals = this.velocity.computeSignals(snapshots);
    const newTrends: PredictedTrend[] = [];

    for (const signal of signals.slice(0, 20)) {
      // Virality formula from spec
      const engagementVelocity  = signal.velocity;
      const replicationRate     = Math.min(1, signal.competitors.length / 5);
      const noveltyIndex        = 1 - (snapshots.find(s => s.emotionalTrigger === signal.emotionalTrigger)?.repetitionFrequency ?? 0.3);
      const crossPlatformSpread = Math.min(1, signal.occurrences / 10);

      const viralityScore = +(
        engagementVelocity  * 0.4 +
        replicationRate     * 0.3 +
        noveltyIndex        * 0.2 +
        crossPlatformSpread * 0.1
      ).toFixed(3);

      const avgRepetition = snapshots
        .filter(s => s.emotionalTrigger === signal.emotionalTrigger)
        .reduce((acc, s) => acc + s.repetitionFrequency, 0) /
        Math.max(snapshots.filter(s => s.emotionalTrigger === signal.emotionalTrigger).length, 1);

      const stage      = computeStage(viralityScore, avgRepetition);
      const confidence = +Math.min(0.95, (signal.occurrences / 20 + signal.competitors.length / 10) * 0.7).toFixed(3);

      const trendName = `${signal.emotionalTrigger.replace('_', ' ')} + ${signal.format.replace('_', ' ')}`;
      const existingId = [...this.trends.entries()].find(([, t]) => t.trendName === trendName)?.[0];
      const id = existingId ?? randomUUID();

      const trend: PredictedTrend = {
        id,
        trendName,
        hookPattern:        signal.hooks[0] ?? `${signal.emotionalTrigger} hook`,
        creativeFormat:     signal.format,
        emotionalDriver:    signal.emotionalTrigger,
        predictedPeakTime:  predictedPeakTime(signal.velocity, stage),
        viralityScore,
        confidence,
        currentStage:       stage,
        supportingExamples: signal.hooks.slice(0, 3),
        riskOfSaturation:   +avgRepetition.toFixed(3),
        detectedAt:         existingId ? this.trends.get(id)!.detectedAt : new Date(),
        updatedAt:          new Date(),
        competitors:        signal.competitors.length,
      };

      this.trends.set(id, trend);

      // Update history
      if (!this.history.has(id)) {
        this.history.set(id, { trend, snapshots: [] });
      }
      const hist = this.history.get(id)!;
      hist.trend = trend;
      hist.snapshots.push({ timestamp: new Date(), viralityScore, stage });
      if (hist.snapshots.length > 50) hist.snapshots.shift();

      newTrends.push(trend);
    }

    this.lastUpdated = new Date();
    this.logger.log(`Prediction pass complete — ${newTrends.length} trends`);
    return newTrends;
  }

  getTrends(stage?: TrendStage): PredictedTrend[] {
    const all = [...this.trends.values()]
      .sort((a, b) => b.viralityScore - a.viralityScore);
    return stage ? all.filter(t => t.currentStage === stage) : all;
  }

  getTrendById(id: string): PredictedTrend | null {
    return this.trends.get(id) ?? null;
  }

  getTrendHistory(id: string): TrendHistory | null {
    return this.history.get(id) ?? null;
  }

  getAllHistory(): TrendHistory[] {
    return [...this.history.values()];
  }

  getSummary(): TrendSummary {
    const all = [...this.trends.values()];
    return {
      total:        all.length,
      earlySignals: all.filter(t => t.currentStage === 'early').length,
      emerging:     all.filter(t => t.currentStage === 'emerging').length,
      rising:       all.filter(t => t.currentStage === 'rising').length,
      saturating:   all.filter(t => t.currentStage === 'saturating').length,
      topTrend:     all[0] ?? null,
      lastUpdated:  this.lastUpdated,
    };
  }
}
