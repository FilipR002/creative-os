/**
 * govolo.service.ts
 *
 * Orchestration service for POST /api/govolo/generate.
 *
 * Phase 2 flow:
 *   1. Validate campaignId ownership
 *   2. Fetch campaign (CampaignService)
 *   3. Fetch concept (ConceptService)
 *   4. Generate MasterBlueprint via Sonnet (sonnet-orchestrator)
 *   5. Validate + auto-fix blueprint (blueprint-validator)
 *   6. Hand off to ProductionPipelineService:
 *        a. Fetch Creative DNA
 *        b. Compute routing decision (SmartRoutingService)
 *        c. Extract virtual scenes → optimise (hook-boost + rewrite + DNA inject)
 *        d. Route each scene → kling / veo
 *        e. Execute via VideoService / CarouselService / BannerService
 *        f. Score result (ScoringService)
 *        g. Select winner (AutoWinnerService)
 *        h. Report outcomes + trigger learning (fire-and-forget)
 *   7. Return PipelineResult
 */

import {
  Injectable,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { ConfigService }    from '@nestjs/config';

import { CampaignService }  from '../campaign/campaign.service';
import { ConceptService }   from '../concept/concept.service';

import { generateBlueprint, type MasterBlueprint } from './sonnet-orchestrator';
import { validateAndFix }                           from './blueprint-validator';
import { diagnoseBlueprint }                        from './execution-mapper';
import {
  ProductionPipelineService,
  type PipelineResult,
} from './lib/production-pipeline';

// ─── Request / Response types ─────────────────────────────────────────────────

export interface GovoloGenerateDto {
  campaignId:          string;
  preferredFormat?:    'video' | 'carousel' | 'banner';
  preferredAngleSlug?: string;
}

export type GovoloGenerateResponse = PipelineResult;

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class GovoloService {
  private readonly logger = new Logger(GovoloService.name);

  constructor(
    private readonly config:    ConfigService,
    @Inject(forwardRef(() => CampaignService))
    private readonly campaigns: CampaignService,
    @Inject(forwardRef(() => ConceptService))
    private readonly concepts:  ConceptService,
    private readonly pipeline:  ProductionPipelineService,
  ) {}

  async generate(
    dto:    GovoloGenerateDto,
    userId: string,
  ): Promise<GovoloGenerateResponse> {

    // ── 1. Ownership check ─────────────────────────────────────────────────
    await this.campaigns.assertOwnership(dto.campaignId, userId);

    // ── 2. Fetch campaign ──────────────────────────────────────────────────
    const campaign = await this.campaigns.findOne(dto.campaignId, userId);
    if (!campaign) {
      throw new NotFoundException(`Campaign ${dto.campaignId} not found`);
    }

    // ── 3. Fetch concept ───────────────────────────────────────────────────
    let concept: Awaited<ReturnType<ConceptService['findByCampaign']>>;
    try {
      concept = await this.concepts.findByCampaign(dto.campaignId, userId);
    } catch {
      throw new BadRequestException(
        `No concept found for campaign ${dto.campaignId}. ` +
        `Generate a concept via POST /api/concept/generate first.`,
      );
    }
    if (!concept) {
      throw new BadRequestException(
        `Campaign ${dto.campaignId} has no concept. ` +
        `Run POST /api/concept/generate first.`,
      );
    }

    // ── 4. Generate blueprint via Sonnet ───────────────────────────────────
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
    if (!apiKey) {
      throw new InternalServerErrorException('ANTHROPIC_API_KEY is not configured');
    }

    let rawBlueprint: MasterBlueprint;
    try {
      rawBlueprint = await generateBlueprint({
        apiKey,
        campaignId:          dto.campaignId,
        conceptId:           concept.id,
        campaign: {
          name:    campaign.name,
          goal:    campaign.goal,
          formats: campaign.formats,
          tone:    campaign.tone,
          persona: campaign.persona,
        },
        concept: {
          goal:             concept.goal,
          audience:         concept.audience,
          emotion:          concept.emotion,
          coreMessage:      concept.coreMessage,
          offer:            concept.offer,
          style:            concept.style,
          platform:         concept.platform,
          durationTier:     concept.durationTier,
          angleHint:        concept.angleHint,
          toneHint:         concept.toneHint,
          keyObjection:     concept.keyObjection,
          valueProposition: concept.valueProposition,
        },
        preferredFormat:    dto.preferredFormat,
        preferredAngleSlug: dto.preferredAngleSlug,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Sonnet blueprint generation failed: ${msg}`);
      throw new InternalServerErrorException(`Blueprint generation failed: ${msg}`);
    }

    this.logger.log(
      `Blueprint generated | campaign=${dto.campaignId} ` +
      `format=${rawBlueprint.format} angle=${rawBlueprint.angle_slug}`,
    );

    // ── 5. Validate + auto-fix ─────────────────────────────────────────────
    const { valid, fixes, errors, blueprint } = validateAndFix(rawBlueprint);

    if (fixes.length > 0) {
      this.logger.warn(`Blueprint auto-fixed (${fixes.length}): ${fixes.join('; ')}`);
    }
    if (!valid) {
      throw new BadRequestException({
        message: 'Blueprint validation failed with unrecoverable errors',
        errors,
        fixes,
      });
    }

    // ── 6. Run production pipeline (route → optimise → execute → score → learn)
    const diagnostics = diagnoseBlueprint(blueprint);

    try {
      return await this.pipeline.run({
        blueprint,
        campaignId:      dto.campaignId,
        conceptId:       concept.id,
        userId,
        angleSlug:       blueprint.angle_slug,
        diagnostics,
        validationFixes: fixes,
        concept: {
          emotion:  concept.emotion,
          platform: concept.platform,
          audience: concept.audience,
          goal:     concept.goal,
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Production pipeline failed: ${msg}`);
      throw new InternalServerErrorException(`Creative generation failed: ${msg}`);
    }
  }
}
