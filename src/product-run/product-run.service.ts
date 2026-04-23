// ─── Product Run Service — Full Campaign Pipeline Orchestrator ────────────────
//
// Single entry point that sequences all existing subsystems in the correct
// order. Zero business logic lives here — every decision is delegated.
//
// Execution order:
//   1. Resolve (or create) campaign
//   2. Generate concept
//   3. Select angles  (exploit + explore + secondary)
//   4. Generate creatives in parallel (one per angle)
//   5. Score creatives (synchronous)
//   6. Store memory   (fire-and-forget)
//   7. Run learning cycle (fire-and-forget)
//   8. Trigger evolution  (conditional, fire-and-forget)
//   9. Return structured RunResponse

import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { randomUUID }          from 'crypto';
import { CampaignService }     from '../campaign/campaign.service';
import { ConceptService }      from '../concept/concept.service';
import { AngleService }        from '../angle/angle.service';
import { VideoService }        from '../video/video.service';
import { CarouselService }     from '../carousel/carousel.service';
import { BannerService }       from '../banner/banner.service';
import { ScoringService }      from '../scoring/scoring.service';
import { MemoryService }       from '../memory/memory.service';
import { LearningService }     from '../learning/learning.service';
import { EvolutionService }    from '../evolution/evolution.service';
import { UsersService }        from '../users/users.service';
import { CampaignMode }        from '../campaign/campaign.dto';
import { ConceptGoal }         from '../concept/concept.dto';
import type { CreativeScoreResult } from '../scoring/scoring.types';
import type {
  RunDto,
  RunAngleItem,
  RunCreativeItem,
  RunScoringItem,
  RunResponse,
} from './product-run.types';

// Minimum winner score required to fire an evolution cycle
const EVOLUTION_THRESHOLD = 0.70;

// Maximum angles to generate creatives for (keeps parallelism bounded)
const MAX_PARALLEL_ANGLES = 3;

@Injectable()
export class ProductRunService {
  private readonly logger = new Logger(ProductRunService.name);

  constructor(
    private readonly campaigns: CampaignService,
    private readonly concepts:  ConceptService,
    private readonly angles:    AngleService,
    private readonly video:     VideoService,
    private readonly carousel:  CarouselService,
    private readonly banner:    BannerService,
    private readonly scoring:   ScoringService,
    private readonly memory:    MemoryService,
    private readonly learning:  LearningService,
    private readonly evolution: EvolutionService,
    private readonly users:     UsersService,
  ) {}

  async run(dto: RunDto, userId: string): Promise<RunResponse> {
    const executionId = randomUUID();
    const t0 = Date.now();

    // ── Video is admin-only while in early access ────────────────────────────
    if (dto.format === 'video') {
      const me = await this.users.me(userId).catch(() => null);
      if (!me || me.role !== 'admin') {
        throw new ForbiddenException(
          'Video generation is coming soon — stay tuned!',
        );
      }
    }

    // ── Step 1: Resolve campaign ─────────────────────────────────────────────
    let campaignId = dto.campaignId;
    if (!campaignId) {
      const campaignMode = dto.mode === 'quick' ? CampaignMode.SINGLE : CampaignMode.FULL;
      const campaign = await this.campaigns.create(
        { mode: campaignMode, formats: [dto.format], clientId: dto.clientId },
        userId,
      );
      campaignId = campaign.id;
      this.logger.log(`[Run:${executionId}] Created ${campaignMode} campaign ${campaignId}`);
    }

    // ── Step 2: Generate concept ─────────────────────────────────────────────
    const { concept } = await this.concepts.generate(
      {
        campaignId,
        brief:    dto.brief,
        goal:     dto.goal ?? ConceptGoal.CONVERSION,
        platform: dto.platform,
      },
      userId,
    );
    this.logger.log(`[Run:${executionId}] Concept ${concept.id} generated`);

    // ── Step 3: Select angles ────────────────────────────────────────────────
    const angleResult = await this.angles.selectForConcept({
      conceptId:      concept.id,
      format:         dto.format,
      clientIndustry: dto.industry,
    });

    // Take up to MAX_PARALLEL_ANGLES — the selector already orders by type priority
    // (exploit → secondary → explore), so slicing preserves strategic intent.
    const pickedAngles = angleResult.selected_angles.slice(0, MAX_PARALLEL_ANGLES);
    const angleItems: RunAngleItem[] = pickedAngles.map(a => ({
      slug:   a.angle,
      role:   a.type === 'exploit' ? 'exploit'
            : a.type === 'explore' ? 'explore'
            : 'secondary',
      reason: a.reason,
    }));
    this.logger.log(
      `[Run:${executionId}] Angles selected: ${angleItems.map(a => `${a.slug}(${a.role})`).join(', ')}`
    );

    // ── Step 4: Generate creatives in parallel ───────────────────────────────
    const creativeResults = await Promise.all(
      pickedAngles.map(a =>
        this.generateCreative(dto, campaignId!, concept.id, a.angle, userId, {
          keyObjection:     (concept as any).keyObjection     || undefined,
          valueProposition: (concept as any).valueProposition || undefined,
        })
      ),
    );
    this.logger.log(
      `[Run:${executionId}] ${creativeResults.length} creatives generated in ${Date.now() - t0}ms`
    );

    // ── Step 5: Score creatives (synchronous) ────────────────────────────────
    const creativeIds = creativeResults.map(c => c.creativeId);
    const scores      = await this.scoring.evaluate(creativeIds);

    // Build angle lookup for response enrichment
    const angleByCreative = new Map<string, string>(
      creativeResults.map(c => [c.creativeId, c.angleSlug]),
    );

    const scoringItems: RunScoringItem[] = scores.map(s => ({
      creativeId:  s.creativeId,
      angleSlug:   angleByCreative.get(s.creativeId) ?? '',
      totalScore:  round2(s.totalScore),
      ctrScore:    round2(s.ctrScore),
      engagement:  round2(s.engagement),
      conversion:  round2(s.conversion),
      isWinner:    s.isWinner,
    }));

    const winnerScore = scores.find(s => s.isWinner) ?? null;
    const winner      = winnerScore
      ? scoringItems.find(s => s.creativeId === winnerScore.creativeId) ?? null
      : null;

    this.logger.log(
      `[Run:${executionId}] Scoring done — winner: ${winner?.creativeId ?? 'none'} (${winner?.totalScore ?? '—'})`
    );

    // ── Step 6: Store memory (fire-and-forget) ───────────────────────────────
    this.memory
      .storeFromScoringResult(scores, dto.clientId, dto.industry, userId)
      .catch(err => this.logger.warn(`[Run:${executionId}] Memory store failed: ${err?.message}`));

    // ── Step 7: Learning cycle (fire-and-forget) ─────────────────────────────
    this.learning.runCycle(campaignId).catch(err =>
      this.logger.warn(`[Run:${executionId}] Learning cycle failed: ${err?.message}`)
    );
    const learningUpdateStatus = 'triggered' as const;

    // ── Step 8: Evolution trigger (conditional, fire-and-forget) ─────────────
    const evolutionTriggered = !!winner && winner.totalScore >= EVOLUTION_THRESHOLD;
    if (evolutionTriggered) {
      this.evolution.runEvolutionCycle().catch(err =>
        this.logger.warn(`[Run:${executionId}] Evolution failed: ${err?.message}`)
      );
      this.logger.log(
        `[Run:${executionId}] Evolution triggered (winner score ${winner!.totalScore} ≥ ${EVOLUTION_THRESHOLD})`
      );
    }

    // ── Step 9: Compose response ─────────────────────────────────────────────
    return {
      executionId,
      campaignId,
      concept: {
        id:    concept.id,
        brief: dto.brief,
        goal:  dto.goal ?? ConceptGoal.CONVERSION,
      },
      angles:               angleItems,
      creatives:            creativeResults,
      scoring:              scoringItems,
      winner,
      learningUpdateStatus,
      evolutionTriggered,
      explanation: buildExplanation(dto.format, angleItems, winner, evolutionTriggered),
    };
  }

  // ── Creative generation dispatch ──────────────────────────────────────────

  private async generateCreative(
    dto:        RunDto,
    campaignId: string,
    conceptId:  string,
    angleSlug:  string,
    userId:     string,
    enrichment: { keyObjection?: string; valueProposition?: string } = {},
  ): Promise<RunCreativeItem> {
    if (dto.format === 'video') {
      const r = await this.video.generate(
        {
          campaignId,
          conceptId,
          angleSlug,
          durationTier:    (dto.durationTier ?? 'SHORT') as any,
          styleContext:    dto.styleContext,
          keyObjection:    enrichment.keyObjection,
          valueProposition: enrichment.valueProposition,
        },
        userId,
      );
      return { creativeId: r.creativeId, angleSlug, format: 'video' };
    }

    if (dto.format === 'carousel') {
      const r = await this.carousel.generate(
        {
          campaignId,
          conceptId,
          angleSlug,
          slideCount:      dto.slideCount ?? 5,
          platform:        dto.platform,
          styleContext:    dto.styleContext,
          keyObjection:    enrichment.keyObjection,
          valueProposition: enrichment.valueProposition,
        },
        userId,
      );
      return { creativeId: r.creativeId, angleSlug, format: 'carousel' };
    }

    // banner
    const r = await this.banner.generate(
      {
        campaignId,
        conceptId,
        angleSlug,
        sizes:           dto.sizes ?? ['1080x1080'],
        styleContext:    dto.styleContext,
        keyObjection:    enrichment.keyObjection,
        valueProposition: enrichment.valueProposition,
      },
      userId,
    );
    return { creativeId: r.creativeId, angleSlug, format: 'banner' };
  }
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function buildExplanation(
  format:             string,
  angles:             RunAngleItem[],
  winner:             RunScoringItem | null,
  evolutionTriggered: boolean,
): string {
  const roleList  = angles.map(a => a.role).join(', ');
  const count     = angles.length;
  const creative  = count === 1 ? 'creative' : 'creatives';

  const winPart = winner
    ? `Winner: ${winner.angleSlug} angle (score ${winner.totalScore}).`
    : 'No winner determined yet.';

  const evoNote = evolutionTriggered
    ? ' Evolution cycle triggered to explore new angle variants.'
    : '';

  return (
    `Generated ${count} ${format} ${creative} across ${roleList} strategies. ` +
    `${winPart} Learning update queued.${evoNote}`
  );
}
