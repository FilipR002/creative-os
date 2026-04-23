// ─── Phase 9.2 — Creative DNA Memory Layer ───────────────────────────────────
//
// Extracts "Creative DNA" from high-performing campaigns (top 20% perf score),
// stores hookPattern / emotionalTone / structureType / visualContext per angle,
// merges similar patterns via Jaccard fuzzy matching (≥ 0.30),
// and injects top DNA into generateAdCopy() prompts.
//
// This evolves the system from "generate from scratch" → "recombine winning patterns."

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService }      from '../prisma/prisma.service';
import { CreativeDNA }        from '@prisma/client';

const TOP_PERCENTILE        = 0.80;   // top 20% threshold
const JACCARD_THRESHOLD     = 0.30;   // fuzzy merge threshold
const DNA_PROMPT_LIMIT      = 3;      // top DNA entries injected into prompts
const SCORE_WINDOW_DAYS     = 7;

@Injectable()
export class CreativeDNAService {
  private readonly logger = new Logger(CreativeDNAService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Public API ─────────────────────────────────────────────────────────────

  /** Called after every outcome report. Persists DNA only for top-20% scores. */
  async maybePersistDNA(
    userId:           string,
    angleSlug:        string,
    performanceScore: number,
  ): Promise<void> {
    const threshold = await this.getTop20Threshold();
    if (performanceScore < threshold) return;

    const dna = await this.extractDNA(angleSlug, performanceScore);
    if (!dna) return;

    await this.upsertDNA(dna);
    this.logger.log(`[9.2] DNA persisted: angle=${angleSlug} score=${performanceScore.toFixed(3)} threshold=${threshold.toFixed(3)}`);
  }

  /** Returns top DNA records sorted by performanceScore * survivalRate. */
  async getTopCreativeDNA(limit = DNA_PROMPT_LIMIT): Promise<CreativeDNA[]> {
    const all = await this.prisma.creativeDNA.findMany({
      orderBy: [{ performanceScore: 'desc' }, { survivalRate: 'desc' }],
      take:    limit * 3,  // fetch more, re-rank in JS
    });

    return all
      .sort((a, b) => (b.performanceScore * b.survivalRate) - (a.performanceScore * a.survivalRate))
      .slice(0, limit);
  }

  /** Formatted string for injection into creative generation prompts. */
  async getDNAPromptContext(limit = DNA_PROMPT_LIMIT): Promise<string | null> {
    const top = await this.getTopCreativeDNA(limit);
    if (!top.length) return null;

    const lines = top.map((d, i) =>
      `  ${i + 1}. Hook: "${d.hookPattern}" | Tone: ${d.emotionalTone} | Structure: ${d.structureType} | Visual: ${d.visualContext} (score: ${d.performanceScore.toFixed(2)}, angle: ${d.angleSlug})`
    );

    return [
      `PROVEN CREATIVE DNA — patterns extracted from top-performing ads:`,
      ...lines,
      `When generating new ad copy, bias toward these winning patterns while adapting them creatively.`,
    ].join('\n');
  }

  // ── Core logic ─────────────────────────────────────────────────────────────

  private async getTop20Threshold(): Promise<number> {
    const since = new Date(Date.now() - SCORE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const outcomes = await this.prisma.campaignOutcome.findMany({
      where:   { createdAt: { gte: since } },
      select:  { performanceScore: true },
      orderBy: { performanceScore: 'asc' },
    });

    if (outcomes.length < 5) return 0.30;  // fallback when data is sparse

    const idx = Math.floor(outcomes.length * TOP_PERCENTILE);
    return outcomes[idx]?.performanceScore ?? 0.30;
  }

  private async extractDNA(
    angleSlug:        string,
    performanceScore: number,
  ): Promise<Omit<CreativeDNA, 'id' | 'createdAt' | 'updatedAt'> | null> {
    const insights = await this.prisma.angleCreativeInsight.findMany({
      where:   { angleSlug },
      orderBy: { createdAt: 'desc' },
      take:    5,
    });

    if (!insights.length) return null;

    // Pick the most recent insight as DNA source
    const insight = insights[0];

    return {
      hookPattern:      insight.hook,
      emotionalTone:    this.classifyEmotion(insight.emotion),
      structureType:    this.classifyStructure(insight.layout),
      visualContext:    insight.visualElements.slice(0, 3).join(', ') || insight.layout,
      angleSlug,
      performanceScore,
      survivalRate:     0.5,
      usageCount:       1,
    };
  }

  private async upsertDNA(
    incoming: Omit<CreativeDNA, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<void> {
    const existing = await this.findMergeable(
      incoming.structureType,
      incoming.emotionalTone,
      incoming.hookPattern,
    );

    if (existing) {
      const newSurvivalRate = this.mergeSurvivalRate(
        existing.survivalRate,
        existing.usageCount,
        incoming.performanceScore,
      );
      await this.prisma.creativeDNA.update({
        where: { id: existing.id },
        data: {
          survivalRate:     newSurvivalRate,
          usageCount:       { increment: 1 },
          performanceScore: Math.max(existing.performanceScore, incoming.performanceScore),
        },
      });
      this.logger.debug(`[9.2] Merged DNA id=${existing.id} survivalRate=${newSurvivalRate.toFixed(3)}`);
    } else {
      await this.prisma.creativeDNA.create({ data: incoming });
    }
  }

  private async findMergeable(
    structureType: string,
    emotionalTone: string,
    hookPattern:   string,
  ): Promise<CreativeDNA | null> {
    // Fetch candidates with matching structure+tone (cheap DB filter)
    const candidates = await this.prisma.creativeDNA.findMany({
      where: { structureType, emotionalTone },
    });

    for (const c of candidates) {
      if (this.jaccardSimilarity(c.hookPattern, hookPattern) >= JACCARD_THRESHOLD) {
        return c;
      }
    }
    return null;
  }

  // ── Classifiers ────────────────────────────────────────────────────────────

  private classifyEmotion(emotion: string): string {
    const e = emotion.toLowerCase();
    if (e.includes('urgency') || e.includes('fear') || e.includes('danger'))   return 'urgency-fear';
    if (e.includes('curiosity') || e.includes('wonder'))                        return 'curiosity';
    if (e.includes('trust') || e.includes('authority') || e.includes('expert')) return 'trust-authority';
    if (e.includes('aspiration') || e.includes('pride') || e.includes('status'))return 'aspiration-pride';
    if (e.includes('empower') || e.includes('confidence') || e.includes('strength')) return 'empowerment';
    if (e.includes('pain') || e.includes('relief') || e.includes('problem'))   return 'pain-relief';
    if (e.includes('joy') || e.includes('humor') || e.includes('fun') || e.includes('happy')) return 'joy-humor';
    return 'general';
  }

  private classifyStructure(layout: string): string {
    const l = layout.toLowerCase();
    if (l.includes('comparison') || l.includes('vs') || l.includes('before'))  return 'comparison';
    if (l.includes('list') || l.includes('bullet') || l.includes('steps'))     return 'listicle';
    if (l.includes('story') || l.includes('narrative') || l.includes('journey')) return 'story';
    if (l.includes('problem') || l.includes('solution') || l.includes('solve')) return 'problem-solution';
    if (l.includes('data') || l.includes('stat') || l.includes('number') || l.includes('%')) return 'data-led';
    if (l.includes('product') || l.includes('showcase') || l.includes('feature')) return 'showcase';
    return 'showcase';
  }

  // ── Math helpers ───────────────────────────────────────────────────────────

  private jaccardSimilarity(a: string, b: string): number {
    const setA = new Set(a.toLowerCase().split(/\W+/).filter(Boolean));
    const setB = new Set(b.toLowerCase().split(/\W+/).filter(Boolean));
    const intersection = [...setA].filter(x => setB.has(x)).length;
    const union        = new Set([...setA, ...setB]).size;
    return union === 0 ? 0 : intersection / union;
  }

  private mergeSurvivalRate(
    prevRate:    number,
    usageCount:  number,
    newScore:    number,
  ): number {
    // Score > 0.30 = positive impact (max performanceScore is ~0.40)
    const impact = (newScore - 0.25) / 0.25;    // [-1, +1] centered on neutral
    const newRate = (prevRate * usageCount + (0.5 + impact * 0.3)) / (usageCount + 1);
    return Math.max(0.10, Math.min(1.0, newRate));
  }
}
