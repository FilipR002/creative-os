/**
 * creative-director.service.ts
 *
 * Orchestrates POST /api/creative-director/generate.
 *
 * Flow:
 *   1. Validate campaign ownership
 *   2. Fetch campaign
 *   3. Fetch concept (required — must exist before calling this endpoint)
 *   4. Call Creative Director Brain (Sonnet) → CreativePlan
 *   5. Return the full plan: core_story + video scenes + carousel slides + banner spec
 *
 * This does NOT execute generation through VideoService / CarouselService / BannerService.
 * It returns the structured creative plan — a conversion-optimised multi-format brief.
 * Execution is a separate step.
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
import { ConfigService } from '@nestjs/config';

import { CampaignService } from '../campaign/campaign.service';
import { ConceptService }  from '../concept/concept.service';

import {
  generateCreativePlan,
  type CreativePlan,
} from './creative-director-orchestrator';

// ─── DTO types ────────────────────────────────────────────────────────────────

export interface CreativeDirectorGenerateDto {
  campaignId: string;
}

export interface CreativeDirectorGenerateResponse {
  plan: CreativePlan;
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class CreativeDirectorService {
  private readonly logger = new Logger(CreativeDirectorService.name);

  constructor(
    private readonly config:    ConfigService,
    @Inject(forwardRef(() => CampaignService))
    private readonly campaigns: CampaignService,
    @Inject(forwardRef(() => ConceptService))
    private readonly concepts:  ConceptService,
  ) {}

  async generate(
    dto:    CreativeDirectorGenerateDto,
    userId: string,
  ): Promise<CreativeDirectorGenerateResponse> {

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

    // ── 4. Generate creative plan ──────────────────────────────────────────
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
    if (!apiKey) {
      throw new InternalServerErrorException('ANTHROPIC_API_KEY is not configured');
    }

    let plan: CreativePlan;
    try {
      plan = await generateCreativePlan({
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
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Creative Director generation failed: ${msg}`);
      throw new InternalServerErrorException(`Creative plan generation failed: ${msg}`);
    }

    this.logger.log(
      `Creative plan generated | campaign=${dto.campaignId} ` +
      `scenes=${plan.video.scenes.length} slides=${plan.carousel.slides.length}`,
    );

    return { plan };
  }
}
