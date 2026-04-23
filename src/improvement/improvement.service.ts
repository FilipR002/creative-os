import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ScoringService } from '../scoring/scoring.service';
import { HookBoosterService } from '../video/hook-booster.service';
import {
  WeaknessFlags, ImprovementType, AppliedChange, ImprovementResult,
} from './improvement.types';
import { patchVideoCTA, patchCarouselCTA, patchBannerCTA } from './patchers/cta.patcher';
import { patchVideoClarity, patchCarouselClarity, patchBannerClarity } from './patchers/clarity.patcher';
import { patchVideoStructure, patchCarouselStructure } from './patchers/structure.patcher';

// ─── Score thresholds that trigger improvement ────────────────────────────────
const THRESH = {
  hook:      0.60,   // ctrScore below this → hook improvement
  cta:       0.70,   // conversion below this → CTA improvement
  clarity:   0.70,   // clarity below this → clarity improvement
} as const;

@Injectable()
export class ImprovementService {
  constructor(
    private readonly prisma:      PrismaService,
    private readonly scoring:     ScoringService,
    private readonly hookBooster: HookBoosterService,
  ) {}

  // ─── RUN IMPROVEMENT PASS FOR AN ENTIRE CAMPAIGN ──────────────────────────
  async runForCampaign(campaignId: string): Promise<{
    campaignId:   string;
    totalCreatives: number;
    improved:     number;
    rejected:     number;
    skipped:      number;
    results:      ImprovementResult[];
    finalWinner:  { creativeId: string; score: number; format: string } | null;
  }> {
    // Load all scored creatives for this campaign
    const creatives = await this.prisma.creative.findMany({
      where:   { campaignId },
      include: { score: true, concept: true, angle: true },
    });

    if (!creatives.length) throw new NotFoundException(`No creatives found for campaign ${campaignId}`);

    const scored = creatives.filter(c => c.score);
    if (!scored.length) throw new NotFoundException(`No scored creatives found. Run scoring first.`);

    const results: ImprovementResult[] = [];

    // Process each creative (can be winner or non-winner — improvement is beneficial either way)
    for (const creative of scored) {
      const score = creative.score!;
      const result = await this.improveOne(
        creative.id,
        creative.format.toLowerCase() as 'video' | 'carousel' | 'banner',
        {
          needsHook:      score.ctrScore   < THRESH.hook    && creative.format === 'VIDEO',
          needsCTA:       score.conversion < THRESH.cta,
          needsClarity:   score.clarity    < THRESH.clarity,
          needsStructure: this.detectStructureIssue(creative.content, creative.format.toLowerCase()),
        },
        score.totalScore,
        creative.content as any,
        creative.concept,
        creative.angle?.slug || 'teach',
        creative.concept?.goal || 'conversion',
        campaignId,
        creative.conceptId,
        creative.angleId,
      );
      results.push(result);
    }

    // Re-run winner selection across ALL creatives (original + accepted improvements)
    await this.reSelectWinner(campaignId);

    // Fetch final winner
    const winner = await this.prisma.creative.findFirst({
      where:   { campaignId, isWinner: true },
      include: { score: true },
    });

    const improved = results.filter(r => r.accepted).length;
    const rejected = results.filter(r => !r.accepted && r.improvedCreativeId).length;
    const skipped  = results.filter(r => !r.improvedCreativeId).length;

    return {
      campaignId,
      totalCreatives: scored.length,
      improved,
      rejected,
      skipped,
      results,
      finalWinner: winner
        ? { creativeId: winner.id, score: winner.score?.totalScore ?? 0, format: winner.format.toLowerCase() }
        : null,
    };
  }

  // ─── IMPROVE ONE CREATIVE ──────────────────────────────────────────────────
  private async improveOne(
    creativeId: string,
    format: 'video' | 'carousel' | 'banner',
    flags: WeaknessFlags,
    scoreBefore: number,
    content: any,
    concept: any,
    angleSlug: string,
    goal: string,
    campaignId: string,
    conceptId: string | null,
    angleId: string | null,
  ): Promise<ImprovementResult> {

    const noWeakness = !flags.needsHook && !flags.needsCTA && !flags.needsClarity && !flags.needsStructure;
    if (noWeakness) {
      return {
        originalCreativeId: creativeId,
        improvedCreativeId: null,
        improvementTypes:   [],
        scoreBefore,
        scoreAfter:         null,
        delta:              null,
        accepted:           false,
        changesApplied:     [],
        message:            `Creative scored ${pct(scoreBefore)} — no weaknesses detected, no improvement needed.`,
      };
    }

    // ── Apply patches in priority order ───────────────────────────────────
    const types: ImprovementType[] = [];
    let allChanges: AppliedChange[] = [];
    let patched = deepClone(content);

    // 1. Structure (must come first — adds missing scenes/slides)
    if (flags.needsStructure) {
      if (format === 'video') {
        const r = patchVideoStructure(patched.scenes || [], concept);
        patched.scenes = r.scenes;
        allChanges = [...allChanges, ...r.changes];
        if (r.changes.length) types.push('structure');
      } else if (format === 'carousel') {
        const r = patchCarouselStructure(patched.slides || [], concept);
        patched.slides = r.slides;
        allChanges = [...allChanges, ...r.changes];
        if (r.changes.length) types.push('structure');
      }
    }

    // 2. Hook (video only) — mutates patched.scenes
    if (flags.needsHook && format === 'video') {
      const boosted = await this.hookBooster.autoBoostIfWeak(
        '', patched.scenes || [], concept, angleSlug,
      );
      if (JSON.stringify(boosted) !== JSON.stringify(patched.scenes)) {
        allChanges.push({
          field:  'scenes[hook]',
          before: (patched.scenes || []).find((s: any) => s.type === 'hook')?.voiceover || '',
          after:  (boosted).find((s: any) => s.type === 'hook')?.voiceover || '',
          reason: `Hook CTR score was below ${pct(THRESH.hook)} — curiosity gap and pattern interrupt added`,
        });
        patched.scenes = boosted;
        types.push('hook');
      }
    }

    // 3. CTA
    if (flags.needsCTA) {
      if (format === 'video') {
        const r = patchVideoCTA(patched.scenes || [], concept, goal);
        patched.scenes = r.scenes;
        allChanges = [...allChanges, ...r.changes];
        if (r.changes.length) types.push('cta');
      } else if (format === 'carousel') {
        const r = patchCarouselCTA(patched.slides || [], goal);
        patched.slides = r.slides;
        allChanges = [...allChanges, ...r.changes];
        if (r.changes.length) types.push('cta');
      } else if (format === 'banner') {
        const r = patchBannerCTA(patched.banners || [], goal);
        patched.banners = r.banners;
        allChanges = [...allChanges, ...r.changes];
        if (r.changes.length) types.push('cta');
      }
    }

    // 4. Clarity
    if (flags.needsClarity) {
      if (format === 'video') {
        const r = patchVideoClarity(patched.scenes || []);
        patched.scenes = r.scenes;
        allChanges = [...allChanges, ...r.changes];
        if (r.changes.length) types.push('clarity');
      } else if (format === 'carousel') {
        const r = patchCarouselClarity(patched.slides || []);
        patched.slides = r.slides;
        allChanges = [...allChanges, ...r.changes];
        if (r.changes.length) types.push('clarity');
      } else if (format === 'banner') {
        const r = patchBannerClarity(patched.banners || []);
        patched.banners = r.banners;
        allChanges = [...allChanges, ...r.changes];
        if (r.changes.length) types.push('clarity');
      }
    }

    // If nothing actually changed — skip
    if (!allChanges.length) {
      return {
        originalCreativeId: creativeId,
        improvedCreativeId: null,
        improvementTypes:   types,
        scoreBefore,
        scoreAfter:         null,
        delta:              null,
        accepted:           false,
        changesApplied:     [],
        message:            'Weaknesses detected but no patches applied (content already optimal for detected patterns).',
      };
    }

    // ── Create improved creative in DB ─────────────────────────────────────
    const improved = await this.prisma.creative.create({
      data: {
        campaignId,
        conceptId,
        angleId,
        format:  format.toUpperCase() as any,
        variant: 'improved',
        content: patched,
      },
    });

    // ── Re-score improved version ──────────────────────────────────────────
    let scoreAfter: number | null = null;
    let accepted = false;

    try {
      const scored = await this.scoring.evaluate([improved.id]);
      scoreAfter = scored[0]?.totalScore ?? null;
      accepted = scoreAfter !== null && scoreAfter > scoreBefore;
    } catch {
      // Scoring failed — keep improved creative for manual review
    }

    const delta = scoreAfter !== null ? round(scoreAfter - scoreBefore) : null;

    // ── Persist improvement record ─────────────────────────────────────────
    await this.prisma.creativeImprovement.create({
      data: {
        originalCreativeId:  creativeId,
        improvedCreativeId:  improved.id,
        improvementType:     types.join('+'),
        improvementReason:   allChanges.map(c => c.reason).join('; '),
        changesApplied:      allChanges as any,
        scoreBefore,
        scoreAfter,
        improvementDelta:    delta,
        accepted,
      },
    });

    // ── If not better, mark improved as non-winner to avoid confusion ─────
    if (!accepted && scoreAfter !== null) {
      await this.prisma.creative.update({
        where: { id: improved.id },
        data:  { isWinner: false },
      });
    }

    return {
      originalCreativeId: creativeId,
      improvedCreativeId: improved.id,
      improvementTypes:   types,
      scoreBefore,
      scoreAfter,
      delta,
      accepted,
      changesApplied:     allChanges,
      message: accepted
        ? `Improvement accepted ✓ — score ${pct(scoreBefore)} → ${pct(scoreAfter!)} (Δ+${pct(delta!)}). Types: ${types.join(', ')}`
        : `Improvement rejected — improved score ${pct(scoreAfter ?? 0)} did not beat original ${pct(scoreBefore)}.`,
    };
  }

  // ─── RE-SELECT WINNER across all creatives + their improved versions ───────
  private async reSelectWinner(campaignId: string): Promise<void> {
    const allScored = await this.prisma.creativeScore.findMany({
      where:   { creative: { campaignId } },
      orderBy: { totalScore: 'desc' },
    });
    if (!allScored.length) return;

    const winnerId = allScored[0].creativeId;

    // Reset all isWinner flags, set new winner
    await this.prisma.creative.updateMany({
      where: { campaignId },
      data:  { isWinner: false },
    });
    await this.prisma.creative.update({
      where: { id: winnerId },
      data:  { isWinner: true },
    });
    await this.prisma.creativeScore.updateMany({
      where: { creative: { campaignId } },
      data:  { isWinner: false },
    });
    await this.prisma.creativeScore.update({
      where: { creativeId: winnerId },
      data:  { isWinner: true },
    });
  }

  // ─── DETECT STRUCTURE ISSUES ───────────────────────────────────────────────
  private detectStructureIssue(content: any, format: string): boolean {
    if (format === 'video') {
      const scenes: any[] = (content as any)?.scenes || [];
      const types = scenes.map(s => s.type);
      return !types.includes('hook') || !types.includes('cta');
    }
    if (format === 'carousel') {
      const slides: any[] = (content as any)?.slides || [];
      const types = slides.map(s => s.type);
      return !types.includes('cover') || !types.includes('cta');
    }
    return false;
  }

  // ─── GET IMPROVEMENT RECORD FOR A CREATIVE ────────────────────────────────
  async getImprovement(creativeId: string) {
    // Check if this was an original that was improved
    const asOriginal = await this.prisma.creativeImprovement.findFirst({
      where:   { originalCreativeId: creativeId },
      orderBy: { createdAt: 'desc' },
    });

    // Check if this was itself an improvement of something else
    const asImproved = await this.prisma.creativeImprovement.findFirst({
      where:   { improvedCreativeId: creativeId },
      orderBy: { createdAt: 'desc' },
    });

    if (!asOriginal && !asImproved) {
      return { creativeId, status: 'no_improvement_record', message: 'No improvement has been run for this creative.' };
    }

    const record = asOriginal || asImproved!;

    return {
      creativeId,
      role:                asOriginal ? 'original' : 'improved_version',
      originalCreativeId:  record.originalCreativeId,
      improvedCreativeId:  record.improvedCreativeId,
      improvementTypes:    record.improvementType.split('+'),
      accepted:            record.accepted,
      scoreBefore:         round(record.scoreBefore),
      scoreAfter:          record.scoreAfter !== null ? round(record.scoreAfter) : null,
      delta:               record.improvementDelta !== null ? round(record.improvementDelta) : null,
      changesApplied:      record.changesApplied,
      createdAt:           record.createdAt,
      summary: record.accepted
        ? `Score improved from ${pct(record.scoreBefore)} → ${pct(record.scoreAfter!)} (+${pct(record.improvementDelta!)})`
        : record.scoreAfter !== null
          ? `Improvement attempted but rejected — ${pct(record.scoreAfter)} did not beat ${pct(record.scoreBefore)}`
          : 'Improvement created but could not be scored',
    };
  }

  // ─── GET ALL IMPROVEMENTS FOR A CAMPAIGN ──────────────────────────────────
  async getCampaignImprovements(campaignId: string) {
    const records = await this.prisma.creativeImprovement.findMany({
      where:   { originalCreative: { campaignId } },
      orderBy: { createdAt: 'desc' },
    });

    return {
      campaignId,
      total:    records.length,
      accepted: records.filter(r => r.accepted).length,
      records:  records.map(r => ({
        originalCreativeId: r.originalCreativeId,
        improvedCreativeId: r.improvedCreativeId,
        types:              r.improvementType.split('+'),
        accepted:           r.accepted,
        scoreBefore:        round(r.scoreBefore),
        scoreAfter:         r.scoreAfter !== null ? round(r.scoreAfter) : null,
        delta:              r.improvementDelta !== null ? round(r.improvementDelta) : null,
      })),
    };
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function pct(v: number): string { return `${Math.round(v * 100)}%`; }
function round(n: number): number { return Math.round(n * 100) / 100; }
function deepClone<T>(obj: T): T { return JSON.parse(JSON.stringify(obj)); }
