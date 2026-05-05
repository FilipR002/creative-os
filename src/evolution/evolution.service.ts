// ─── Angle Evolution Engine — Service ────────────────────────────────────────
// Monitors angle performance over time and applies two operations:
//
//   MUTATION  — underperforming angle → creates a shifted variant
//   PRUNING   — chronically weak angle → marks as inactive, stops selection
//
// Mutations come in two dimensions:
//   'copy'   — shift hook style, audience focus, tone (original behaviour)
//   'visual' — swap colour palette, font pairing, layout style
//
// Rules (non-negotiable):
//   • Min reportCount=3 before any evolution decision
//   • Thresholds are in WEIGHT space (post-mapPerformanceToWeight), range [0.50–1.50]
//   • Mutation threshold: avgPerformanceScore maps to weight < MUTATE_THRESHOLD_WEIGHT (0.85)
//   • Prune threshold:    avgPerformanceScore maps to weight < PRUNE_THRESHOLD_WEIGHT  (0.70), count ≥ 5
//   • Promote threshold:  avgPerformanceScore maps to weight > PROMOTE_THRESHOLD_WEIGHT (1.15), count ≥ 5
//   • Cycle runs are idempotent — already-mutated angles are not re-mutated
//   • mutateAngle() writes to BOTH angle_mutations AND the angles table so selection picks it up
//   • Visual mutations additionally write Angle.visualOverrides so compositor can read them

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService }      from '../prisma/prisma.service';
import type {
  MutationVector,
  AngleVisualOverrides,
  EvolutionCycleResult,
  EvolutionStatus,
} from './evolution.types';

// Thresholds in weight-space [0.50–1.50] — aligned with mapPerformanceToWeight().
const MUTATE_THRESHOLD_WEIGHT  = 0.85;
const PRUNE_THRESHOLD_WEIGHT   = 0.70;
const PROMOTE_THRESHOLD_WEIGHT = 1.15;
const MIN_REPORTS        = 3;
const MIN_PRUNE_REPORTS  = 5;
const MIN_PROMOTE_REPORTS = 5;

// Map raw performanceScore → weight space for threshold comparisons.
function scoreToWeight(score: number): number {
  const normalized = (score - 0.05) / (0.40 - 0.05);
  return 0.50 + Math.max(0, Math.min(1, normalized)) * 1.00;
}

// ─── Copy mutation vectors (original set) ────────────────────────────────────

const COPY_MUTATION_VECTORS: MutationVector[] = [
  { mutationType: 'copy', hookStyle: 'question',    audienceFocus: 'pain-point',  emotionalTrigger: 'fear'      },
  { mutationType: 'copy', hookStyle: 'bold-claim',  audienceFocus: 'aspiration',  emotionalTrigger: 'pride'     },
  { mutationType: 'copy', hookStyle: 'story',       audienceFocus: 'social',      emotionalTrigger: 'curiosity' },
  { mutationType: 'copy', hookStyle: 'data-led',    audienceFocus: 'pain-point',  emotionalTrigger: 'trust'     },
  { mutationType: 'copy', hookStyle: 'contrast',    audienceFocus: 'aspiration',  emotionalTrigger: 'urgency'   },
  { mutationType: 'copy', toneShift: 'more-direct', formatBias: 'video'                                         },
  { mutationType: 'copy', toneShift: 'softer',      formatBias: 'carousel'                                      },
  { mutationType: 'copy', toneShift: 'humorous',    audienceFocus: 'social',      emotionalTrigger: 'joy'       },
];

// ─── Visual mutation vectors (new) ───────────────────────────────────────────
// Each entry maps to an AngleVisualOverrides payload stored on the mutant Angle.
// Compositor reads these via StyleTranslatorService when the angle is selected.

const VISUAL_MUTATION_VECTORS: MutationVector[] = [
  // Palette swaps
  { mutationType: 'visual', visualTone: 'bold',      visualColorMood: 'vibrant',    visualLayout: 'rich'     },
  { mutationType: 'visual', visualTone: 'minimal',   visualColorMood: 'monochrome', visualLayout: 'minimal'  },
  { mutationType: 'visual', visualTone: 'premium',   visualColorMood: 'muted',      visualFont: 'editorial'  },
  { mutationType: 'visual', visualTone: 'friendly',  visualColorMood: 'warm',       visualComposition: 'centered'         },
  { mutationType: 'visual', visualTone: 'energetic', visualColorMood: 'vibrant',    visualComposition: 'rule-of-thirds'   },
  // Typography + layout shifts
  { mutationType: 'visual', visualFont: 'display-serif',   visualLayout: 'rich',    visualComposition: 'editorial'        },
  { mutationType: 'visual', visualFont: 'modern-sans',     visualLayout: 'minimal', visualColorMood: 'cool'               },
  { mutationType: 'visual', visualFont: 'geometric-bold',  visualTone: 'urgent',    visualComposition: 'asymmetric'       },
];

// Round-robin between copy and visual so successive mutations alternate dimensions.
// Determined deterministically by slug hash so the same slug always gets the same mutation.
function pickMutationVector(slug: string, depth: number): MutationVector {
  const hash  = fnv1a(slug);
  // Even depth → copy, odd depth → visual (alternates as the angle mutates further)
  const useCopy = depth % 2 === 0;
  if (useCopy) {
    return COPY_MUTATION_VECTORS[hash % COPY_MUTATION_VECTORS.length];
  }
  return VISUAL_MUTATION_VECTORS[hash % VISUAL_MUTATION_VECTORS.length];
}

/** Extract compositor overrides from a visual mutation vector. */
function toVisualOverrides(vector: MutationVector): AngleVisualOverrides {
  return {
    tone:             vector.visualTone        || undefined,
    colorMood:        vector.visualColorMood   || undefined,
    typographyStyle:  vector.visualFont        || undefined,   // font ID maps in StyleTranslator
    compositionStyle: vector.visualComposition || undefined,
    layoutComplexity: vector.visualLayout      || undefined,
  };
}

/** Human-readable label suffix for a visual vector. */
function describeVisualVector(v: MutationVector): string {
  return [v.visualTone, v.visualColorMood, v.visualFont, v.visualLayout, v.visualComposition]
    .filter(Boolean).join(' + ');
}

/** Human-readable label suffix for a copy vector. */
function describeCopyVector(v: MutationVector): string {
  return Object.values(v)
    .filter(val => val && val !== 'copy' && val !== 'visual')
    .join(' + ');
}

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
      const weight = scoreToWeight(score);
      const count  = stat.reportCount;

      // ── PROMOTE ────────────────────────────────────────────────────────────
      if (weight >= PROMOTE_THRESHOLD_WEIGHT && count >= MIN_PROMOTE_REPORTS) {
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
    const mutantSlug      = `${parentSlug}_v${Date.now().toString(36)}`;
    const mutationReason  = `Parent score ${parentScore.toFixed(3)} below weight threshold ${MUTATE_THRESHOLD_WEIGHT}`;

    try {
      const parentAngle   = await this.prisma.angle.findUnique({ where: { slug: parentSlug } });
      const mutationDepth = (parentAngle?.mutationDepth ?? 0) + 1;

      // Pick vector (alternates copy ↔ visual with depth)
      const vector      = pickMutationVector(parentSlug, mutationDepth);
      const isVisual    = vector.mutationType === 'visual';
      const vectorDesc  = isVisual ? describeVisualVector(vector) : describeCopyVector(vector);
      const mutantLabel = `${parentAngle?.label ?? parentSlug} (${vectorDesc})`;

      // For visual mutations build the visualOverrides blob
      const visualOverrides: AngleVisualOverrides | null = isVisual
        ? toVisualOverrides(vector)
        : null;

      // 1. Record in angle_mutations audit trail
      await this.prisma.angleMutation.create({
        data: {
          parentSlug,
          mutantSlug,
          mutationReason,
          mutationVector: vector as object,
          status:         'active',
          avgPerfScore:   parentScore,
        },
      });

      // 2. Write into angles table so AngleService.selectAngles() picks it up.
      //    For visual mutations, persist visualOverrides so compositor can apply them.
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
          ...(visualOverrides ? { visualOverrides: visualOverrides as object } : {}),
        },
        update: {
          isActive: true,
          ...(visualOverrides ? { visualOverrides: visualOverrides as object } : {}),
        },
      });

      await this.logEvent('mutated', mutantSlug, mutationReason, {
        parentSlug, vector, parentScore, mutantLabel, mutationDepth,
        mutationType: vector.mutationType ?? 'copy',
        ...(visualOverrides ? { visualOverrides } : {}),
      });

      this.logger.log(
        `Mutated ${parentSlug} → ${mutantSlug} | type=${vector.mutationType ?? 'copy'} depth=${mutationDepth} | ${vectorDesc}`,
      );
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
      select: { parentSlug: true, mutantSlug: true, status: true, mutationVector: true },
    });
    const mutantOf    = Object.fromEntries(mutations.map(m => [m.mutantSlug, m.parentSlug]));
    const hasMutation = new Set(mutations.map(m => m.parentSlug));

    return stats.map(s => {
      const w = scoreToWeight(s.avgPerformanceScore);
      const myMutation = mutations.find(m => m.mutantSlug === s.angleSlug);
      const mutVec     = myMutation?.mutationVector as MutationVector | undefined;
      return {
        angleSlug:    s.angleSlug,
        reportCount:  s.reportCount,
        avgScore:     s.avgPerformanceScore,
        avgCtr:       s.avgCtr,
        avgConvRate:  s.avgConversionRate,
        avgRoas:      s.avgRoas,
        status:       w >= PROMOTE_THRESHOLD_WEIGHT ? 'champion'
                    : w <  PRUNE_THRESHOLD_WEIGHT   ? 'at-risk'
                    : w <  MUTATE_THRESHOLD_WEIGHT  ? 'weak'
                    : 'healthy',
        hasMutation:  hasMutation.has(s.angleSlug),
        isMutantOf:   mutantOf[s.angleSlug] ?? null,
        mutationType: mutVec?.mutationType ?? null,
      };
    });
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
