// ─── MIROFISH Service ─────────────────────────────────────────────────────────
//
// Orchestrator for the MIROFISH simulation pipeline.
// Coordinates all 5 engines and produces the final MirofishResult.
//
// Two simulation paths:
//   simulateInline() — pure sync, <1ms, no DB. Used in scoring pipeline.
//   simulate()       — async, enriches from DB + learning history. Used by API.
//
// Engines called in order:
//   1. extractSignals      (simulation.engine)  — map angle + context → signals
//   2. simulate            (simulation.engine)  — run cluster responses
//   3. computeVariance     (variance.engine)    — distribution analysis
//   4. computeSynergy      (synergy.engine)     — angle compatibility
//   5. computeRisk         (risk.engine)        — failure pattern detection
//   6. aggregate           (aggregation.engine) — final score + learning signals
// ─────────────────────────────────────────────────────────────────────────────

import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import Redis from 'ioredis';
import { PrismaService }                from '../prisma/prisma.service';
import { MirofishLearningService }      from './mirofish.learning.service';
import { REDIS_CLIENT }                 from '../redis/redis.module';
import { extractSignals, simulate }     from './engines/simulation.engine';
import { computeVariance }              from './engines/variance.engine';
import { computeSynergy }               from './engines/synergy.engine';
import { computeRisk }                  from './engines/risk.engine';
import { aggregate, MirofishResult }    from './engines/aggregation.engine';

// ─── Input contracts ──────────────────────────────────────────────────────────

export interface SimulateInput {
  creative_id?:  string;
  campaign_id?:  string;
  concept_id?:   string;
  angles: {
    primary:    string;
    secondary?: string;
  };
  mode?: 'v1' | 'v2';
}

export interface InlineSimulateInput {
  primaryAngle:    string;
  secondaryAngle?: string;
  goal?:           string;
  emotion?:        string;
  format?:         string;
  mode?:           'v1' | 'v2';
}

const CACHE_TTL    = 21_600;   // 6 h
const CACHE_PREFIX = 'mirofish:result';

function buildCacheKey(
  creativeId:     string,
  primary:        string,
  secondary?:     string,
  goal?:          string,
  format?:        string,
): string {
  const seg = (v?: string) => (v ?? 'none').toLowerCase().replace(/\s+/g, '_');
  return `${CACHE_PREFIX}:${creativeId}:${seg(primary)}:${seg(secondary)}:${seg(goal)}:${seg(format)}`;
}

@Injectable()
export class MirofishService {
  private readonly logger = new Logger(MirofishService.name);

  constructor(
    @Optional() private readonly prisma:    PrismaService,
    @Optional() private readonly learning:  MirofishLearningService,
    @Optional() @Inject(REDIS_CLIENT) private readonly redis: Redis | null,
  ) {}

  // ── Public: DB-enriched simulate (used by API endpoint) ──────────────────

  async simulate(input: SimulateInput): Promise<MirofishResult> {
    const mode = input.mode ?? 'v1';

    // Enrich from concept
    let goal:    string | undefined;
    let emotion: string | undefined;
    let format:  string | undefined;

    if (input.concept_id && this.prisma) {
      try {
        const concept = await this.prisma.concept.findUnique({ where: { id: input.concept_id } });
        if (concept) {
          goal    = concept.goal    ?? undefined;
          emotion = concept.emotion ?? undefined;
        }
      } catch { /* non-blocking */ }
    }

    if (input.creative_id && this.prisma) {
      try {
        const creative = await this.prisma.creative.findUnique({
          where:  { id: input.creative_id },
          select: { format: true },
        });
        if (creative) format = creative.format.toLowerCase();
      } catch { /* non-blocking */ }
    }

    // Build cache key only after all inputs are resolved.
    // Skip cache entirely if any required dimension is missing.
    const cacheKey = (input.creative_id && goal && format)
      ? buildCacheKey(
          input.creative_id,
          input.angles.primary,
          input.angles.secondary,
          goal,
          format,
        )
      : null;

    if (cacheKey) {
      const hit = await this.cacheGet(cacheKey);
      if (hit) return hit;
    }

    // Enrich with learning history signals (async DB reads)
    let explorationAdjSignal  = 0;
    let anglePerformanceDelta: number | null = null;

    if (this.learning) {
      try {
        const [adj, delta] = await Promise.all([
          this.learning.getAdaptiveExplorationAdjustment({ goal: goal ?? null }),
          this.learning.getAnglePerformanceDelta(input.angles.primary),
        ]);
        explorationAdjSignal  = adj;
        anglePerformanceDelta = delta;
      } catch { /* non-blocking */ }
    }

    const result = this.runEngines({
      primaryAngle:   input.angles.primary,
      secondaryAngle: input.angles.secondary,
      goal,
      emotion,
      format,
      mode,
      learningSignals: {
        exploration_adjustment_signal: explorationAdjSignal,
        angle_performance_delta:       anglePerformanceDelta,
      },
    });

    if (cacheKey) {
      await this.cacheSet(cacheKey, result);
    }

    return result;
  }

  // ── Public: inline simulate (sync, <1ms, no DB — used in scoring pipeline) ─

  simulateInline(input: InlineSimulateInput): MirofishResult {
    return this.runEngines(input);
  }

  // ── Core engine pipeline ──────────────────────────────────────────────────

  private runEngines(input: InlineSimulateInput & {
    learningSignals?: {
      exploration_adjustment_signal?: number;
      angle_performance_delta?:       number | null;
    };
  }): MirofishResult {
    const t0   = Date.now();
    const mode = input.mode ?? 'v1';

    // 1. Creative signal profile from angle + context
    const signals = extractSignals({
      primaryAngle:   input.primaryAngle,
      secondaryAngle: input.secondaryAngle,
      goal:           input.goal,
      emotion:        input.emotion,
      format:         input.format,
    });

    // 2. 200-persona cluster simulation
    const clusters = simulate(signals, mode, input.primaryAngle);

    // 3. Variance analysis (safe / moderate / polarizing / viral potential)
    const variance = computeVariance(clusters);

    // 4. Angle synergy (semantic + emotional + reinforcement)
    const synergy = computeSynergy(input.primaryAngle, input.secondaryAngle);

    // 5. Risk detection (4 failure patterns)
    const risk = computeRisk(clusters);

    // 6. Aggregate → final result with learning signals
    const simulationMs = Date.now() - t0;
    const result = aggregate({
      clusters,
      variance,
      synergy,
      risk,
      primaryAngle:    input.primaryAngle,
      secondaryAngle:  input.secondaryAngle,
      mode,
      simulationMs,
      learningSignals: input.learningSignals
        ? {
            prediction_error:              null,  // unknown until after scoring
            angle_performance_delta:       input.learningSignals.angle_performance_delta ?? null,
            exploration_adjustment_signal: input.learningSignals.exploration_adjustment_signal ?? 0,
          }
        : undefined,
    });

    if (simulationMs > 10) {
      this.logger.warn(
        `[MIROFISH] Simulation took ${simulationMs}ms — exceeded 10ms target ` +
        `(mode=${mode}, angle=${input.primaryAngle})`,
      );
    }

    return result;
  }

  // ── Redis cache helpers ────────────────────────────────────────────────────

  private async cacheGet(key: string): Promise<MirofishResult | null> {
    if (!this.redis) return null;
    try {
      const raw = await this.redis.get(key);
      if (!raw) return null;
      try {
        return JSON.parse(raw) as MirofishResult;
      } catch {
        return null;  // corrupted payload — recompute
      }
    } catch {
      return null;
    }
  }

  private async cacheSet(key: string, result: MirofishResult): Promise<void> {
    if (!this.redis) return;
    try {
      // NX = only write if key does not yet exist — prevents redundant overwrites
      // on high-frequency identical requests within the same TTL window.
      await this.redis.set(key, JSON.stringify(result), 'EX', CACHE_TTL, 'NX');
    } catch {
      // Non-fatal — next call recomputes
    }
  }
}
