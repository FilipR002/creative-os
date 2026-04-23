// ─── Angle Evolution Engine — Service ────────────────────────────────────────
// Monitors angle performance over time and applies two operations:
//
//   MUTATION  — underperforming angle → creates a shifted variant
//   PRUNING   — chronically weak angle → marks as inactive, stops selection
//
// Rules (non-negotiable):
//   • Min reportCount=3 before any evolution decision
//   • Thresholds are in WEIGHT space (post-mapPerformanceToWeight), range [0.50–1.50]
//   • Mutation threshold: avgPerformanceScore maps to weight < MUTATE_THRESHOLD_WEIGHT (0.85)
//   • Prune threshold:    avgPerformanceScore maps to weight < PRUNE_THRESHOLD_WEIGHT  (0.70), count ≥ 5
//   • Promote threshold:  avgPerformanceScore maps to weight > PROMOTE_THRESHOLD_WEIGHT (1.15), count ≥ 5
//   • Cycle runs are idempotent — already-mutated angles are not re-mutated
//   • mutateAngle() writes to BOTH angle_mutations AND the angles table so selection picks it up

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService }      from '../prisma/prisma.service';
import type {
  MutationVector,
  EvolutionCycleResult,
  EvolutionStatus,
} from './evolution.types';

// Thresholds in weight-space [0.50–1.50] — aligned with mapPerformanceToWeight().
// Raw score comparisons would use the score range (~0.05–0.40) which is compressed
// and asymmetric; weight-space comparisons are intuitive and evenly spaced.
const MUTATE_THRESHOLD_WEIGHT  = 0.85;  // weight < 0.85 → below-median performer → mutate
const PRUNE_THRESHOLD_WEIGHT   = 0.70;  // weight < 0.70 → chronically weak → prune mutants
const PROMOTE_THRESHOLD_WEIGHT = 1.15;  // weight > 1.15 → above-median winner → champion
const MIN_REPORTS       = 3;
const MIN_PRUNE_REPORTS = 5;
const MIN_PROMOTE_REPORTS = 5;

// Map raw performanceScore → weight space for threshold comparisons.
// Mirrors outcomes.mapper.ts mapPerformanceToWeight().
function scoreToWeight(score: number): number {
  const normalized = (score - 0.05) / (0.40 - 0.05);
  return 0.50 + Math.max(0, Math.min(1, normalized)) * 1.00;
}

// Predefined mutation vectors for each scenario
const MUTATION_VECTORS: MutationVector[] = [
  { hookStyle: 'question',    audienceFocus: 'pain-point',  emotionalTrigger: 'fear'      },
  { hookStyle: 'bold-claim',  audienceFocus: 'aspiration',  emotionalTrigger: 'pride'     },
  { hookStyle: 'story',       audienceFocus: 'social',      emotionalTrigger: 'curiosity' },
  { hookStyle: 'data-led',    audienceFocus: 'pain-point',  emotionalTrigger: 'trust'     },
  { hookStyle: 'contrast',    audienceFocus: 'aspiration',  emotionalTrigger: 'urgency'   },
  { toneShift: 'more-direct', formatBias: 'video'                                         },
  { toneShift: 'softer',      formatBias: 'carousel'                                      },
  { toneShift: 'humorous',    audienceFocus: 'social',      emotionalTrigger: 'joy'       },
];

@Injectable()
export class EvolutionService {
  private readonly logger = new Logger(EvolutionService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Full evolution cycle ──────────────────────────────────────────────────

  async runEvolutionCycle(): Promise<EvolutionCycleResult> {
    const cycleId = crypto.randomUUID();
    const ranAt   = new Date().toISOString();
    const mutated:   string[] = [];
    const pruned:    string[] = [];
    const promoted:  string[] = [];
    let   skipped = 0;

    // Load all angles with enough data
    const stats = await this.prisma.anglePerformanceStat.findMany({
      where: { reportCount: { gte: MIN_REPORTS } },
    });

    // Load existing mutations to avoid re-mutating already-mutated slugs
    const existingMutations = await this.prisma.angleMutation.findMany({
      select: { parentSlug: true, mutantSlug: true },
    });
    const mutatedParents = new Set(existingMutations.map(m => m.parentSlug));
    const allMutantSlugs = new Set(existingMutations.map(m => m.mutantSlug));

    for (const stat of stats) {
      const slug   = stat.angleSlug;
      const score  = stat.avgPerformanceScore;
      const weight = scoreToWeight(score);   // convert to weight-space for threshold checks
      const count  = stat.reportCount;

      // ── PROMOTE ────────────────────────────────────────────────────────────
      if (weight >= PROMOTE_THRESHOLD_WEIGHT && count >= MIN_PROMOTE_REPORTS) {
        // Check if already a champion
        const existingMut = existingMutations.find(m => m.mutantSlug === slug);
        if (existingMut) {
          await this.prisma.angleMutation.updateMany({
            where: { mutantSlug: slug },
            data:  { status: 'champion' },
          });
        }
        await this.logEvent('promoted', slug, `Weight ${weight.toFixed(3)} (score ${score.toFixed(3)}) exceeds champion threshold`, { score, weight, count });
        promoted.push(slug);
        continue;
      }

      // ── PRUNE ──────────────────────────────────────────────────────────────
      if (weight < PRUNE_THRESHOLD_WEIGHT && count >= MIN_PRUNE_REPORTS) {
        // Only prune mutant slugs (never prune core angles from the base set)
        if (allMutantSlugs.has(slug)) {
          await this.prisma.angleMutation.updateMany({
            where: { mutantSlug: slug },
            data:  { status: 'pruned' },
          });
          await this.logEvent('pruned', slug, `Weight ${weight.toFixed(3)} (score ${score.toFixed(3)}) below prune threshold after ${count} reports`, { score, weight, count });
          pruned.push(slug);
          continue;
        }
      }

      // ── MUTATE ─────────────────────────────────────────────────────────────
      if (weight < MUTATE_THRESHOLD_WEIGHT && count >= MIN_REPORTS) {
        // Skip if already has an active mutation pending
        if (mutatedParents.has(slug)) {
          skipped++;
          continue;
        }

        const mutation = await this.mutateAngle(slug, score);
        if (mutation) {
          mutated.push(slug);
          mutatedParents.add(slug);
        } else {
          skipped++;
        }
        continue;
      }

      skipped++;
    }

    // Log cycle completion
    await this.logEvent('cycle_complete', '_system', `Cycle ${cycleId.slice(0, 8)} complete`, {
      cycleId, evaluated: stats.length, mutated, pruned, promoted, skipped,
    });

    this.logger.log(
      `Evolution cycle done — evaluated:${stats.length} mutated:${mutated.length} pruned:${pruned.length} promoted:${promoted.length}`,
    );

    return { cycleId, evaluated: stats.length, mutated, pruned, promoted, skipped, ranAt };
  }

  // ── Single angle mutation ─────────────────────────────────────────────────

  async mutateAngle(parentSlug: string, parentScore: number): Promise<{ mutantSlug: string } | null> {
    // Pick a mutation vector deterministically from the slug hash
    const vectorIndex  = fnv1a(parentSlug) % MUTATION_VECTORS.length;
    const vector       = MUTATION_VECTORS[vectorIndex];
    const mutantSlug   = `${parentSlug}_v${Date.now().toString(36)}`;
    const mutationReason = `Parent score ${parentScore.toFixed(3)} below weight threshold ${MUTATE_THRESHOLD_WEIGHT}`;

    try {
      // Look up parent angle to inherit label and get mutation depth
      const parentAngle = await this.prisma.angle.findUnique({ where: { slug: parentSlug } });
      const mutationDepth = (parentAngle?.mutationDepth ?? 0) + 1;

      // Build a human-readable label for the evolved angle
      const vectorDesc = Object.entries(vector)
        .map(([k, v]) => `${v}`)
        .join(' + ');
      const mutantLabel = `${parentAngle?.label ?? parentSlug} (${vectorDesc})`;

      // 1. Record in angle_mutations (existing audit trail)
      await this.prisma.angleMutation.create({
        data: {
          parentSlug,
          mutantSlug,
          mutationReason,
          mutationVector: vector as object,
          status:         'active',
          avgPerfScore:   parentScore,   // inherit parent score as starting baseline
        },
      });

      // 2. BRIDGE: write into the angles table so AngleService.selectAngles() can pick it up.
      //    source='evolved' + parentSlug + mutationDepth give the full lineage.
      //    isActive=true means it enters selection immediately on the next cycle.
      await this.prisma.angle.upsert({
        where:  { slug: mutantSlug },
        create: {
          slug:          mutantSlug,
          label:         mutantLabel,
          description:   `Evolved from ${parentSlug}: ${vectorDesc}. ${mutationReason}`,
          source:        'evolved',
          isActive:      true,
          parentSlug,
          mutationDepth,
        },
        update: {
          // If somehow already exists, just ensure it's active
          isActive: true,
        },
      });

      await this.logEvent('mutated', mutantSlug,
        mutationReason,
        { parentSlug, vector, parentScore, mutantLabel, mutationDepth },
      );

      this.logger.log(`Mutated ${parentSlug} → ${mutantSlug} depth=${mutationDepth} (vector: ${JSON.stringify(vector)})`);
      return { mutantSlug };
    } catch (err) {
      this.logger.warn(`Mutation failed for ${parentSlug}: ${err}`);
      return null;
    }
  }

  // ── Query methods ─────────────────────────────────────────────────────────

  async getMutations(status?: string) {
    return this.prisma.angleMutation.findMany({
      where:   status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  async getEvolutionLog(limit = 50) {
    return this.prisma.angleEvolutionLog.findMany({
      orderBy: { createdAt: 'desc' },
      take:    limit,
    });
  }

  async getStatus(): Promise<EvolutionStatus> {
    const [total, active, pruned, champions, lastLog] = await Promise.all([
      this.prisma.angleMutation.count(),
      this.prisma.angleMutation.count({ where: { status: 'active' } }),
      this.prisma.angleMutation.count({ where: { status: 'pruned' } }),
      this.prisma.angleMutation.count({ where: { status: 'champion' } }),
      this.prisma.angleEvolutionLog.findFirst({
        where:   { event: 'cycle_complete' },
        orderBy: { createdAt: 'desc' },
        select:  { createdAt: true },
      }),
    ]);

    return {
      totalMutations:  total,
      activeMutations: active,
      prunedAngles:    pruned,
      champions,
      lastCycleAt:     lastLog?.createdAt?.toISOString() ?? null,
    };
  }

  async getAngleHealth() {
    const stats = await this.prisma.anglePerformanceStat.findMany({
      orderBy: { avgPerformanceScore: 'desc' },
    });

    const mutations = await this.prisma.angleMutation.findMany({
      select: { parentSlug: true, mutantSlug: true, status: true },
    });
    const mutantOf = Object.fromEntries(mutations.map(m => [m.mutantSlug, m.parentSlug]));
    const hasMutation = new Set(mutations.map(m => m.parentSlug));

    return stats.map(s => ({
      angleSlug:    s.angleSlug,
      reportCount:  s.reportCount,
      avgScore:     s.avgPerformanceScore,
      avgCtr:       s.avgCtr,
      avgConvRate:  s.avgConversionRate,
      avgRoas:      s.avgRoas,
      status:       scoreToWeight(s.avgPerformanceScore) >= PROMOTE_THRESHOLD_WEIGHT ? 'champion'
                  : scoreToWeight(s.avgPerformanceScore) < PRUNE_THRESHOLD_WEIGHT    ? 'at-risk'
                  : scoreToWeight(s.avgPerformanceScore) < MUTATE_THRESHOLD_WEIGHT   ? 'weak'
                  : 'healthy',
      hasMutation:  hasMutation.has(s.angleSlug),
      isMutantOf:   mutantOf[s.angleSlug] ?? null,
    }));
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async logEvent(
    event:     string,
    angleSlug: string,
    reason:    string,
    metadata:  Record<string, unknown> = {},
  ): Promise<void> {
    await this.prisma.angleEvolutionLog.create({
      data: { event, angleSlug, reason, metadata: metadata as object },
    });
  }
}

// FNV-1a 32-bit — deterministic hash, no Math.random()
function fnv1a(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h;
}
