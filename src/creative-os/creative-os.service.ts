/**
 * creative-os.service.ts
 *
 * Orchestration service for POST /api/creative-os/generate.
 *
 * Phase 3 flow (Execution Gateway Fix):
 *   1. Validate campaignId ownership
 *   2. Fetch campaign (CampaignService)
 *   3. Fetch concept (ConceptService)
 *   4. Generate in PARALLEL:
 *        a. MasterBlueprint via Sonnet (sonnet-orchestrator)
 *        b. CreativePlan via Creative Director Brain (creative-director-orchestrator)
 *   5. Validate + auto-fix blueprint (blueprint-validator)
 *   6. Hand off to ProductionPipelineService:
 *        a. Fetch Creative DNA
 *        b. Resolve real routing signals (FatigueService, MirofishService)
 *        c. Compute routing decision (SmartRoutingService)
 *        d. Extract virtual scenes → optimise (hook-boost + rewrite + DNA inject)
 *        e. Route each scene → ugc | cinematic | hybrid + kling | veo | mixed
 *        f. Execute via ExecutionGatewayService (injects mode + CreativePlan into generation)
 *        g. Score all variants (ScoringService)
 *        h. Select winner (AutoWinnerService)
 *        i. Report outcomes + trigger learning (fire-and-forget)
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

import { generateBlueprint, type MasterBlueprint }   from './sonnet-orchestrator';
import { validateAndFix }                             from './blueprint-validator';
import { diagnoseBlueprint }                          from './execution-mapper';
import {
  ProductionPipelineService,
  type PipelineResult,
} from './lib/production-pipeline';

import {
  generateCreativePlan,
  type CreativePlan,
} from '../creative-director/creative-director-orchestrator';

// ─── Request / Response types ─────────────────────────────────────────────────

export interface CreativeOSGenerateDto {
  campaignId:          string;
  preferredFormat?:    'video' | 'carousel' | 'banner';
  preferredAngleSlug?: string;
}

export type CreativeOSGenerateResponse = PipelineResult;

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class CreativeOSService {
  private readonly logger = new Logger(CreativeOSService.name);

  constructor(
    private readonly config:    ConfigService,
    @Inject(forwardRef(() => CampaignService))
    private readonly campaigns: CampaignService,
    @Inject(forwardRef(() => ConceptService))
    private readonly concepts:  ConceptService,
    private readonly pipeline:  ProductionPipelineService,
  ) {}

  async generate(
    dto:    CreativeOSGenerateDto,
    userId: string,
  ): Promise<CreativeOSGenerateResponse> {

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

    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
    if (!apiKey) {
      throw new InternalServerErrorException('ANTHROPIC_API_KEY is not configured');
    }

    // ── 4. Generate MasterBlueprint + CreativePlan IN PARALLEL ─────────────
    //    Previously: only blueprint was generated; CreativePlan was missing.
    //    Now: both run concurrently — CreativePlan becomes first-class pipeline input.

    const blueprintInput = {
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
    };

    const creativePlanInput = {
      apiKey,
      campaignId: dto.campaignId,
      conceptId:  concept.id,
      campaign: {
        name:    campaign.name,
        goal:    campaign.goal,
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
        keyObjection:     concept.keyObjection,
        valueProposition: concept.valueProposition,
      },
    };

    let rawBlueprint: MasterBlueprint;
    let creativePlan: CreativePlan | undefined;

    try {
      // Run both Claude calls in parallel — CreativePlan failure is non-blocking
      const [blueprintResult, planResult] = await Promise.allSettled([
        generateBlueprint(blueprintInput),
        generateCreativePlan(creativePlanInput),
      ]);

      if (blueprintResult.status === 'rejected') {
        const msg = (blueprintResult.reason as Error)?.message ?? String(blueprintResult.reason);
        this.logger.error(`Sonnet blueprint generation failed: ${msg}`);
        throw new InternalServerErrorException(`Blueprint generation failed: ${msg}`);
      }

      rawBlueprint = blueprintResult.value;

      if (planResult.status === 'fulfilled') {
        creativePlan = planResult.value;
        this.logger.log(
          `Creative plan generated | campaign=${dto.campaignId} ` +
          `scenes=${creativePlan.video.scenes.length} slides=${creativePlan.carousel.slides.length}`,
        );
      } else {
        const msg = (planResult.reason as Error)?.message ?? String(planResult.reason);
        this.logger.warn(
          `Creative Director plan failed (non-blocking) — pipeline proceeds without it: ${msg}`,
        );
      }
    } catch (err) {
      if (err instanceof InternalServerErrorException) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      throw new InternalServerErrorException(`Blueprint generation failed: ${msg}`);
    }

    this.logger.log(
      `Blueprint generated | campaign=${dto.campaignId} ` +
      `format=${rawBlueprint.format} angle=${rawBlueprint.angle_slug} ` +
      `creativePlan=${creativePlan ? 'yes' : 'no'}`,
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

    // ── 6. Run production pipeline ─────────────────────────────────────────
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
        // CreativePlan is now first-class — no longer ignored
        creativePlan,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Production pipeline failed: ${msg}`);
      throw new InternalServerErrorException(`Creative generation failed: ${msg}`);
    }
  }
}
