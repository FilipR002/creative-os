// ─── Phase 9.3 — Causal Attribution Engine ───────────────────────────────────
//
// Decomposes every campaign outcome into contributing factors:
//
//   angleContribution    — how much the angle selection system explains performance
//   creativeContribution — hook/copy quality deviation from angle baseline (8.3)
//   visionContribution   — visual tag presence and insight coverage (8.2)
//   evolutionContribution— mutation lineage + ALC classification signal (8.4)
//   noiseEstimate        — unexplained residual = 1 − Σ contributions
//
// All attribution is deterministic heuristic decomposition — no ML, no heavy
// computation. Each sub-method degrades gracefully when data is missing.
//
// ZERO side effects on scoring, generation, or weight updates.

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService }      from '../prisma/prisma.service';
import { CausalTrace }        from '@prisma/client';

export interface CausalSummary {
  tracesAnalyzed:       number;
  windowDays:           number;
  avgContributions: {
    angle:      number;
    creative:   number;
    vision:     number;
    evolution:  number;
    noise:      number;
  };
  primaryDriver:        string;
  rankedDrivers:        { layer: string; contribution: number }[];
  attributionStability: number;   // [0,1]: 1 = very stable attribution over time
  avgConfidence:        number;
}

type AngleWeightMap = Record<string, number>;

@Injectable()
export class CausalAttributionService {
  private readonly logger = new Logger(CausalAttributionService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Decomposes the most-recent outcome for a campaign into causal contributions.
   * Persists a CausalTrace row and returns it.
   * Safe to call fire-and-forget — never throws (degrades to empty trace).
   */
  async analyzeOutcome(campaignId: string): Promise<CausalTrace> {
    try {
      return await this._analyze(campaignId);
    } catch (err: any) {
      this.logger.warn(`[9.3] analyzeOutcome failed for campaign=${campaignId}: ${err?.message}`);
      // Return a neutral stub so callers never need to handle errors
      return this.neutralTrace(campaignId, 'unknown');
    }
  }

  /** Aggregate attribution stats over the last N days. */
  async getSystemCausalSummary(lastNDays = 30): Promise<CausalSummary> {
    const since = new Date(Date.now() - lastNDays * 24 * 60 * 60 * 1000);

    const traces = await this.prisma.causalTrace.findMany({
      where:  { createdAt: { gte: since } },
      select: {
        angleContribution:     true,
        creativeContribution:  true,
        visionContribution:    true,
        evolutionContribution: true,
        noiseEstimate:         true,
        confidence:            true,
        createdAt:             true,
      },
    });

    if (!traces.length) {
      return {
        tracesAnalyzed:       0,
        windowDays:           lastNDays,
        avgContributions:     { angle: 0, creative: 0, vision: 0, evolution: 0, noise: 1 },
        primaryDriver:        'noise',
        rankedDrivers:        [{ layer: 'noise', contribution: 1 }],
        attributionStability: 0,
        avgConfidence:        0,
      };
    }

    const avg = (key: keyof typeof traces[0]) =>
      (traces.reduce((s, t) => s + (t[key] as number), 0) / traces.length);

    const avgAngle      = avg('angleContribution');
    const avgCreative   = avg('creativeContribution');
    const avgVision     = avg('visionContribution');
    const avgEvolution  = avg('evolutionContribution');
    const avgNoise      = avg('noiseEstimate');
    const avgConfidence = avg('confidence');

    const rankedDrivers = [
      { layer: 'angle',     contribution: r2(avgAngle) },
      { layer: 'creative',  contribution: r2(avgCreative) },
      { layer: 'vision',    contribution: r2(avgVision) },
      { layer: 'evolution', contribution: r2(avgEvolution) },
    ].sort((a, b) => b.contribution - a.contribution);

    // Stability: how consistent is the primary-driver share over time?
    const primaryKey = rankedDrivers[0].layer + 'Contribution' as keyof typeof traces[0];
    const mean       = rankedDrivers[0].contribution;
    const variance   = traces.reduce((s, t) => s + ((t[primaryKey] as number) - mean) ** 2, 0) / traces.length;
    const stability  = Math.max(0, Math.min(1, 1 - Math.sqrt(variance) / 0.20));

    return {
      tracesAnalyzed:       traces.length,
      windowDays:           lastNDays,
      avgContributions: {
        angle:     r2(avgAngle),
        creative:  r2(avgCreative),
        vision:    r2(avgVision),
        evolution: r2(avgEvolution),
        noise:     r2(avgNoise),
      },
      primaryDriver:        rankedDrivers[0].layer,
      rankedDrivers,
      attributionStability: r2(stability),
      avgConfidence:        r2(avgConfidence),
    };
  }

  /** Fetch recent traces for a specific campaign. */
  async getTracesForCampaign(campaignId: string): Promise<CausalTrace[]> {
    return this.prisma.causalTrace.findMany({
      where:   { campaignId },
      orderBy: { createdAt: 'desc' },
      take:    10,
    });
  }

  // ── Core analysis ──────────────────────────────────────────────────────────

  private async _analyze(campaignId: string): Promise<CausalTrace> {
    // Load the most recent outcome for this campaign
    const outcome = await this.prisma.campaignOutcome.findFirst({
      where:   { campaignId },
      orderBy: { createdAt: 'desc' },
    });

    if (!outcome) {
      return this.neutralTrace(campaignId, 'unknown');
    }

    const slug = outcome.angleSlug;

    // Load all attribution inputs in parallel
    const [angleStat, angleRow, userWeights, insights, dna, alcCycle] = await Promise.all([
      this.prisma.anglePerformanceStat.findUnique({ where: { angleSlug: slug } }),
      this.prisma.angle.findFirst({ where: { slug } }),
      outcome.userId
        ? this.prisma.userOutcomeLearning.findUnique({ where: { userId: outcome.userId } })
        : Promise.resolve(null),
      this.prisma.angleCreativeInsight.findMany({
        where:  { angleSlug: slug },
        select: { visualElements: true, emotion: true },
      }),
      this.prisma.creativeDNA.findMany({
        where:   { angleSlug: slug },
        orderBy: { performanceScore: 'desc' },
        take:    3,
      }),
      outcome.userId
        ? this.prisma.autonomousLoopCycle.findFirst({
            where:   { userId: outcome.userId },
            orderBy: { evaluatedAt: 'desc' },
          })
        : Promise.resolve(null),
    ]);

    // ── 1–4: Compute each contribution ────────────────────────────────────
    const weights = (userWeights?.angleWeights ?? {}) as AngleWeightMap;

    const { value: angleC,     confidence: aC } = this.attributeAngle(outcome, angleStat, weights);
    const { value: creativeC,  confidence: crC } = this.attributeCreative(outcome, angleStat, dna.length);
    const { value: visionC,    confidence: vC } = this.attributeVision(insights);
    const { value: evolutionC, confidence: eC } = this.attributeEvolution(angleRow, alcCycle, slug);

    // ── 5: Noise = unexplained residual ───────────────────────────────────
    const attributed  = angleC + creativeC + visionC + evolutionC;
    const noiseEstimate = Math.max(0, Math.min(1, 1 - attributed));

    // ── Trace confidence = data-coverage weighted average ─────────────────
    const hasBaseline = (angleStat?.reportCount ?? 0) >= 5;
    const confidence  = clamp(
      (aC * 0.35 + crC * 0.25 + vC * 0.20 + eC * 0.20) * (hasBaseline ? 1.0 : 0.60),
    );

    const trace = await this.prisma.causalTrace.create({
      data: {
        campaignId,
        angleSlug:             slug,
        angleContribution:     r2(angleC),
        creativeContribution:  r2(creativeC),
        visionContribution:    r2(visionC),
        evolutionContribution: r2(evolutionC),
        noiseEstimate:         r2(noiseEstimate),
        confidence:            r2(confidence),
      },
    });

    this.logger.log(
      `[9.3] angle=${slug} ` +
      `A=${r2(angleC)} CR=${r2(creativeC)} V=${r2(visionC)} EV=${r2(evolutionC)} ` +
      `noise=${r2(noiseEstimate)} conf=${r2(confidence)}`
    );

    return trace;
  }

  // ── 1. ANGLE CONTRIBUTION ──────────────────────────────────────────────────
  // Measures how much the angle-selection + learning system explains performance.
  //
  // Signal A: weight distance from neutral — a weight far from 1.0 means the
  //           system has learned something about this angle (strong signal).
  // Signal B: performance vs baseline — if perf >> baseline AND weight is high,
  //           angle system is correctly predicting winners.
  // Signal C: data richness — more reports = more confident attribution.
  //
  // Range: [0.05, 0.45]

  private attributeAngle(
    outcome:     { ctr: number; performanceScore: number; angleSlug: string },
    angleStat:   { avgPerformanceScore: number; avgCtr: number; reportCount: number } | null,
    weights:     AngleWeightMap,
  ): { value: number; confidence: number } {
    const outcomeWeight  = weights[outcome.angleSlug] ?? 1.0;
    const baseline       = angleStat?.avgPerformanceScore ?? 0.20;
    const reportCount    = angleStat?.reportCount ?? 0;

    // Signal A: how far has the system learned (weight ≠ 1.0)?
    const weightSignal   = Math.abs(outcomeWeight - 1.0) / 0.5;          // [0, 1]

    // Signal B: does the weight correctly predict above/below baseline?
    //   High weight + above baseline → angle system working perfectly
    //   Low weight + below baseline → angle system correctly avoided this
    //   Misalignment → angle system less responsible
    const perfRelative   = (outcome.performanceScore - baseline) / Math.max(baseline, 0.05);
    const weightSign     = outcomeWeight >= 1.0 ? 1 : -1;
    const alignment      = clamp(weightSign * perfRelative * 0.5 + 0.5);  // [0, 1]

    const raw            = 0.25 + weightSignal * 0.12 + alignment * 0.08;
    const value          = clamp(raw, 0.05, 0.45);

    // Confidence: needs at least 5 reports to trust the weight
    const confidence     = clamp(0.40 + Math.min(reportCount, 20) / 20 * 0.50);

    return { value, confidence };
  }

  // ── 2. CREATIVE CONTRIBUTION ───────────────────────────────────────────────
  // Measures how much the creative/copy quality explains performance above angle
  // baseline — i.e., the portion of performance NOT explained by angle selection.
  //
  // Signal A: CTR deviation from angle baseline CTR (hook quality signal).
  // Signal B: CreativeDNA coverage — if DNA exists, the system has learned
  //           winning patterns for this angle.
  //
  // Range: [0.03, 0.28]

  private attributeCreative(
    outcome:   { ctr: number; performanceScore: number },
    angleStat: { avgCtr: number; avgPerformanceScore: number } | null,
    dnaCount:  number,
  ): { value: number; confidence: number } {
    const baselineCtr    = angleStat?.avgCtr ?? 0.03;

    // CTR lift vs baseline: CTR is primarily a hook/creative signal
    const ctrLift        = (outcome.ctr - baselineCtr) / Math.max(baselineCtr, 0.005);
    const ctrSignal      = clamp(ctrLift * 0.08 + 0.08, 0, 0.15);       // [0, 0.15]

    // DNA coverage bonus — each DNA record means the system has crystallized
    // patterns that a creative directly matched (or will match in future)
    const dnaBonus       = Math.min(dnaCount * 0.02, 0.06);              // max 0.06

    const value          = clamp(0.08 + ctrSignal + dnaBonus, 0.03, 0.28);

    // Confidence requires baseline CTR data
    const confidence     = angleStat ? 0.65 : 0.25;

    return { value, confidence };
  }

  // ── 3. VISION CONTRIBUTION ─────────────────────────────────────────────────
  // Measures how much the vision analysis system (8.2) has informed this angle.
  // A well-ingested angle with rich visual context will have stronger creative
  // output than one the system has never "seen."
  //
  // Signal: count of AngleCreativeInsight records for this angle.
  //         Each insight represents a visual pattern the system learned.
  //
  // Range: [0, 0.18]

  private attributeVision(
    insights: { visualElements: string[]; emotion: string }[],
  ): { value: number; confidence: number } {
    if (!insights.length) return { value: 0, confidence: 0.10 };

    // Each insight contributes ~2.5% up to a cap of 15%
    const insightSignal  = Math.min(insights.length * 0.025, 0.15);

    // Emotional richness bonus — varied emotions = richer signal
    const distinctEmotions = new Set(insights.map(i => i.emotion?.split(' ')[0]?.toLowerCase()).filter(Boolean)).size;
    const emotionBonus   = Math.min(distinctEmotions * 0.01, 0.03);

    const value          = clamp(insightSignal + emotionBonus, 0, 0.18);
    const confidence     = clamp(0.25 + insights.length * 0.08, 0.25, 0.85);

    return { value, confidence };
  }

  // ── 4. EVOLUTION CONTRIBUTION ─────────────────────────────────────────────
  // Measures how much the evolution engine has shaped this angle's performance.
  //
  // Signal A: evolved angles carry mutation lineage — deeper = more refinement
  //           pressure has been applied.
  // Signal B: ALC classification — if angle is in the strong pool, the meta-
  //           orchestration layer identified it as a winner.
  //
  // Seed angles still receive a small baseline (0.02) because the evolution
  // engine exerts selection pressure on all angles through pruning/promotion.
  //
  // Range: [0.02, 0.15]

  private attributeEvolution(
    angleRow: { source: string; mutationDepth: number } | null,
    alcCycle: { strongAngles: string[]; weakAngles: string[] } | null,
    slug:     string,
  ): { value: number; confidence: number } {
    const isEvolved       = angleRow?.source === 'evolved';
    const mutationDepth   = angleRow?.mutationDepth ?? 0;
    const inStrongPool    = alcCycle?.strongAngles?.includes(slug) ?? false;
    const inWeakPool      = alcCycle?.weakAngles?.includes(slug) ?? false;

    // Mutation depth signal: each generation of evolution adds ~2.5%
    const depthSignal     = isEvolved ? Math.min(mutationDepth * 0.025, 0.08) : 0;

    // ALC classification signal
    const alcSignal       = inStrongPool ? 0.04 : (inWeakPool ? -0.01 : 0);

    const value           = clamp(0.02 + depthSignal + alcSignal, 0.02, 0.15);
    const confidence      = angleRow ? (isEvolved ? 0.70 : 0.55) : 0.30;

    return { value, confidence };
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private neutralTrace(campaignId: string, angleSlug: string): CausalTrace {
    return {
      id:                    'neutral',
      campaignId,
      angleSlug,
      angleContribution:     0.30,
      creativeContribution:  0.10,
      visionContribution:    0,
      evolutionContribution: 0.02,
      noiseEstimate:         0.58,
      confidence:            0,
      createdAt:             new Date(),
    };
  }
}

// ── Pure utilities ─────────────────────────────────────────────────────────────

function clamp(v: number, lo = 0, hi = 1): number {
  return Math.max(lo, Math.min(hi, v));
}

function r2(v: number): number {
  return Math.round(v * 1000) / 1000;
}
