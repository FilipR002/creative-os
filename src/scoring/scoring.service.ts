import { Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreativeInput,
  CreativeScoreResult,
} from './scoring.types';
import {
  scoreVideo,
  scoreCarousel,
  scoreBanner,
} from './scoring.utils';
import { MemoryService }              from '../memory/memory.service';
import { LearningService }            from '../learning/learning.service';
import { EvolutionService }           from '../evolution/evolution.service';
import { MirofishService }            from '../mirofish/mirofish.service';
import { MirofishLearningService }    from '../mirofish/mirofish.learning.service';
import { CausalAttributionService }   from '../causal-attribution/causal-attribution.service';
import { UserInsightService }         from '../user-insight/user-insight.service';

// Run evolution when a campaign scores at least this many creatives.
// Keeps evolution from firing on tiny test runs while still being automatic.
const EVOLUTION_MIN_CREATIVES = 3;

// ─── Base scoring weights (when no history exists) ────────────────────────────
const BASE_W = { ctr: 0.30, engagement: 0.30, conversion: 0.25, clarity: 0.15 };

// ─── How much history data we need before trusting dynamic weights ─────────────
const MIN_SAMPLES_FOR_DYNAMIC = 3;

@Injectable()
export class ScoringService {
  private readonly logger = new Logger(ScoringService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly memoryService:           MemoryService,
    @Optional() private readonly learningService:         LearningService,
    @Optional() private readonly evolutionService:        EvolutionService,
    @Optional() private readonly mirofishService:         MirofishService,
    @Optional() private readonly mirofishLearningService: MirofishLearningService,
    @Optional() private readonly causalAttribution:       CausalAttributionService,
    @Optional() private readonly userInsight:             UserInsightService,
  ) {}

  // ─── Load learned weights for an angle + format combo ──────────────────────
  private async loadDynamicWeights(
    angleId: string | null,
    format: string,
  ): Promise<{
    w_ctr: number; w_eng: number; w_conv: number; w_clar: number;
    calibration: number;
  }> {
    const [angleStats, formatStats] = await Promise.all([
      angleId
        ? this.prisma.angleStats.findUnique({ where: { angleId } })
        : Promise.resolve(null),
      this.prisma.formatStats.findUnique({ where: { format } }),
    ]);

    let w_ctr  = BASE_W.ctr;
    let w_eng  = BASE_W.engagement;
    let w_conv = BASE_W.conversion;
    let w_clar = BASE_W.clarity;

    // ── Angle bias ─────────────────────────────────────────────────────────
    if (angleStats && angleStats.uses >= MIN_SAMPLES_FOR_DYNAMIC) {
      const histTotal = angleStats.avgCtr + angleStats.avgRetention + angleStats.avgConversion;
      if (histTotal > 0) {
        const ctrShare  = angleStats.avgCtr        / histTotal;
        const retShare  = angleStats.avgRetention  / histTotal;
        const convShare = angleStats.avgConversion / histTotal;
        w_ctr  = w_ctr  * 0.60 + ctrShare  * 0.40;
        w_eng  = w_eng  * 0.60 + retShare  * 0.40;
        w_conv = w_conv * 0.60 + convShare * 0.40;
      }
      const angleMultiplier = clamp(angleStats.weight, 0.50, 1.50);
      w_ctr  *= angleMultiplier;
      w_eng  *= angleMultiplier;
      w_conv *= angleMultiplier;
    }

    // ── Format bias ────────────────────────────────────────────────────────
    if (formatStats && formatStats.total >= MIN_SAMPLES_FOR_DYNAMIC) {
      const histTotal = formatStats.avgCtr + formatStats.avgRetention + formatStats.avgConversion;
      if (histTotal > 0) {
        const convShare = formatStats.avgConversion / histTotal;
        const convBias  = (convShare - 0.33) * 0.30;
        w_conv = clamp(w_conv + convBias, 0.05, 0.60);
      }
      const formatMultiplier = clamp(formatStats.weight, 0.50, 1.50);
      w_conv *= formatMultiplier;
    }

    // ── Calibration factor: geometric mean of angle + format calibrations ──
    const angleCal  = clamp(angleStats?.calibrationFactor  ?? 1.0, 0.70, 1.30);
    const formatCal = clamp(formatStats?.calibrationFactor ?? 1.0, 0.70, 1.30);
    const calibration = Math.sqrt(angleCal * formatCal); // geometric mean keeps in [0.7, 1.3]

    // Normalize weights
    const total = w_ctr + w_eng + w_conv + w_clar;
    return {
      w_ctr:  w_ctr  / total,
      w_eng:  w_eng  / total,
      w_conv: w_conv / total,
      w_clar: w_clar / total,
      calibration,
    };
  }

  // ─── Score a single creative with dynamic weights ──────────────────────────
  private async scoreOne(
    input: CreativeInput,
  ): Promise<Omit<CreativeScoreResult, 'isWinner'>> {
    // 1. Get raw dimension scores from heuristics
    let result: ReturnType<typeof scoreVideo>;
    switch (input.format) {
      case 'video':    result = scoreVideo(input.content);    break;
      case 'carousel': result = scoreCarousel(input.content); break;
      case 'banner':   result = scoreBanner(input.content);   break;
      default:         result = scoreVideo(input.content);
    }

    // 2. Load dynamic weights (falls back to base weights if no history)
    const w = await this.loadDynamicWeights(
      (input as any).angleId ?? null,
      input.format,
    );

    // 3. Apply dynamic weights + calibration to compute final total
    const baseScore = (
      result.ctrProxy        * w.w_ctr  +
      result.engagementProxy * w.w_eng  +
      result.conversionProxy * w.w_conv +
      result.clarity         * w.w_clar
    );
    const totalScore = clamp(baseScore * w.calibration);

    return {
      creativeId: input.id,
      format:     input.format,
      dimensions: {
        ...result.dimensions,
        dynamicWeights: {
          ctr:  round(w.w_ctr),
          eng:  round(w.w_eng),
          conv: round(w.w_conv),
          clar: round(w.w_clar),
          calibration: round(w.calibration),
        },
      },
      proxies: {
        ctrProxy:        result.ctrProxy,
        engagementProxy: result.engagementProxy,
        conversionProxy: result.conversionProxy,
        clarity:         result.clarity,
      },
      ctrScore:   result.ctrProxy,
      engagement: result.engagementProxy,
      conversion: result.conversionProxy,
      clarity:    result.clarity,
      totalScore,
    };
  }

  // ─── Evaluate a batch of creative IDs ──────────────────────────────────────
  async evaluate(creativeIds: string[]): Promise<CreativeScoreResult[]> {
    const creatives = await this.prisma.creative.findMany({
      where: { id: { in: creativeIds } },
      include: { angle: true, concept: true },
    });
    if (!creatives.length) throw new NotFoundException('No creatives found');

    // Build inputs — include angleId for dynamic weight lookup
    const inputs = creatives.map(c => ({
      id:      c.id,
      format:  c.format.toLowerCase() as any,
      content: c.content,
      angle:   c.angle?.slug || '',
      concept: c.concept?.rawJson || {},
      angleId: c.angleId,        // Phase 4: pass angleId for weight lookup
    }));

    // Score each (async now — loads weights from DB)
    const scored = await Promise.all(inputs.map(i => this.scoreOne(i)));

    // Sort descending by totalScore
    scored.sort((a, b) => b.totalScore - a.totalScore);

    // ── MIROFISH: predictive simulation per creative (synchronous, <1ms each) ─
    // Runs inline as a pure prediction layer. Does NOT modify scores.
    // Attached as `mirofish` field on each result for pre-scoring intelligence.
    const mirofishMap: Record<string, import('../mirofish/engines/aggregation.engine').MirofishResult> = {};
    if (this.mirofishService) {
      for (const input of inputs) {
        try {
          const concept = input.concept as Record<string, any>;
          mirofishMap[input.id] = this.mirofishService.simulateInline({
            primaryAngle: input.angle || 'before_after',
            goal:         concept?.goal    as string | undefined,
            emotion:      concept?.emotion as string | undefined,
            format:       input.format,
            mode:         'v1',
          });
        } catch {
          // Non-blocking — MIROFISH failure must never break scoring
        }
      }
    }

    // Mark winner (top-scored) and attach MIROFISH signal
    const results: CreativeScoreResult[] = scored.map((s, idx) => ({
      ...s,
      isWinner: idx === 0,
      ...(mirofishMap[s.creativeId] ? { mirofish: mirofishMap[s.creativeId] } : {}),
    }));

    // Persist scores (upsert — re-scoring is safe)
    await Promise.all(
      results.map(r =>
        this.prisma.creativeScore.upsert({
          where:  { creativeId: r.creativeId },
          update: {
            ctrScore: r.ctrScore, engagement: r.engagement,
            conversion: r.conversion, clarity: r.clarity,
            totalScore: r.totalScore, isWinner: r.isWinner,
          },
          create: {
            creativeId: r.creativeId, ctrScore: r.ctrScore,
            engagement: r.engagement, conversion: r.conversion,
            clarity: r.clarity, totalScore: r.totalScore, isWinner: r.isWinner,
          },
        }),
      ),
    );

    // Update isWinner on creatives table
    await Promise.all(
      results.map(r =>
        this.prisma.creative.update({
          where: { id: r.creativeId },
          data:  { isWinner: r.isWinner },
        }),
      ),
    );

    // Update campaign status to SCORED
    if (creatives[0]?.campaignId) {
      await this.prisma.campaign.update({
        where: { id: creatives[0].campaignId },
        data:  { status: 'SCORED' },
      });
    }

    // Fire-and-forget memory write
    if (this.memoryService) {
      this.memoryService
        .storeFromScoringResult(results)
        .catch(() => {});
    }

    // ── MIROFISH feedback injection — compare predictions vs actuals ──────────
    // Fire-and-forget: writes MirofishSignal records per creative, then runs
    // the MIROFISH learning loop for this campaign.
    if (this.mirofishLearningService && creatives[0]?.campaignId) {
      const campaignId = creatives[0].campaignId;

      Promise.all(
        results.map(result => {
          const prediction = mirofishMap[result.creativeId];
          const creative   = creatives.find(c => c.id === result.creativeId);
          if (!prediction || !creative?.angle?.slug) return Promise.resolve();

          return this.mirofishLearningService!.injectFeedback({
            creativeId:    result.creativeId,
            campaignId,
            angleSlug:     creative.angle.slug,
            goal:          (creative.concept?.rawJson as any)?.goal as string | undefined,
            predicted:     prediction,
            actual: {
              score:    result.totalScore,
              isWinner: result.isWinner,
            },
          });
        }),
      )
      .then(() => this.mirofishLearningService!.runLearningLoop(campaignId))
      .then(report => {
        this.logger.log(
          `[MIROFISH-LL] Loop complete | campaign=${campaignId} | signals=${report.signalsProcessed} | ` +
          `accuracy=${report.systemAccuracy} | exploreAdj=${report.explorationAdjustment} | ` +
          `status=${report.calibrationStatus}`,
        );
      })
      .catch(() => {});
    }

    // Fire-and-forget learning cycle — updates contextual weights based on this campaign's outcomes
    if (this.learningService && creatives[0]?.campaignId) {
      this.learningService
        .runCycle(creatives[0].campaignId)
        .then(report => {
          if (report.updatedAngles.length) {
            this.logger.log(
              `[Learning] ${report.updatedAngles.length} angle weight(s) updated for campaign ${creatives[0].campaignId}. ` +
              `Exploration signal: ${report.explorationSignal.signal}`,
            );
          }
        })
        .catch(() => {});
    }

    // Fire-and-forget evolution cycle — mutates underperformers, promotes champions.
    // Guard: only trigger when a meaningful batch was scored (avoids noise from tiny test runs).
    if (this.evolutionService && results.length >= EVOLUTION_MIN_CREATIVES) {
      this.evolutionService
        .runEvolutionCycle()
        .then(report => {
          if (report.mutated.length || report.promoted.length) {
            this.logger.log(
              `[Evolution] Auto-cycle complete — mutated:${report.mutated.length} ` +
              `promoted:${report.promoted.length} pruned:${report.pruned.length}`,
            );
          }
        })
        .catch(() => {});
    }

    // 9.3 + 9.4 — Causal analysis then invalidate insight cache so next GET is fresh.
    if (this.causalAttribution && creatives[0]?.campaignId) {
      const cid = creatives[0].campaignId;
      this.causalAttribution.analyzeOutcome(cid)
        .then(() => this.userInsight?.invalidate(cid))
        .catch(() => {});
    } else if (this.userInsight && creatives[0]?.campaignId) {
      this.userInsight.invalidate(creatives[0].campaignId);
    }

    return results;
  }

  // ─── Get score for a single creative ───────────────────────────────────────
  async getScore(creativeId: string) {
    const score = await this.prisma.creativeScore.findUnique({
      where:   { creativeId },
      include: { creative: { include: { angle: true } } },
    });
    if (!score) throw new NotFoundException(`No score found for creative ${creativeId}`);

    return {
      creativeId: score.creativeId,
      format:     score.creative.format.toLowerCase(),
      angle:      score.creative.angle?.label || null,
      isWinner:   score.isWinner,
      scores: {
        ctr:        round(score.ctrScore),
        engagement: round(score.engagement),
        conversion: round(score.conversion),
        clarity:    round(score.clarity),
        total:      round(score.totalScore),
      },
      createdAt: score.createdAt,
    };
  }

  // ─── Get all scores for a campaign ─────────────────────────────────────────
  async getScoresByCampaign(campaignId: string) {
    const scores = await this.prisma.creativeScore.findMany({
      where:   { creative: { campaignId } },
      include: { creative: { include: { angle: true } } },
      orderBy: { totalScore: 'desc' },
    });

    return scores.map(s => ({
      creativeId: s.creativeId,
      format:     s.creative.format.toLowerCase(),
      angle:      s.creative.angle?.label || null,
      isWinner:   s.isWinner,
      scores: {
        ctr:        round(s.ctrScore),
        engagement: round(s.engagement),
        conversion: round(s.conversion),
        clarity:    round(s.clarity),
        total:      round(s.totalScore),
      },
    }));
  }
}

function clamp(v: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, v));
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
