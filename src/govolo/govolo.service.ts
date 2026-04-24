/**
 * govolo.service.ts
 *
 * Orchestration service for POST /api/govolo/generate.
 *
 * Full flow:
 *   1. Validate campaignId ownership
 *   2. Fetch campaign (CampaignService)
 *   3. Fetch or generate concept (ConceptService)
 *   4. Call Sonnet → MasterBlueprint (sonnet-orchestrator)
 *   5. Validate + auto-fix blueprint (blueprint-validator)
 *   6. Map blueprint → generation payload (execution-mapper)
 *   7. Execute via existing VideoService / CarouselService / BannerService
 *   8. Return { executionId, blueprintMeta, diagnostics }
 *
 * No new queues. No new DB tables. Everything routes through existing services.
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
import { VideoService }     from '../video/video.service';
import { CarouselService }  from '../carousel/carousel.service';
import { BannerService }    from '../banner/banner.service';

import { generateBlueprint, type MasterBlueprint } from './sonnet-orchestrator';
import { validateAndFix }                           from './blueprint-validator';
import {
  mapBlueprintToGenerationPayload,
  diagnoseBlueprint,
  type ExecutionDiagnostics,
} from './execution-mapper';

// ─── Request / Response types ─────────────────────────────────────────────────

export interface GovoloGenerateDto {
  campaignId:          string;
  preferredFormat?:    'video' | 'carousel' | 'banner';
  preferredAngleSlug?: string;
}

export interface GovoloGenerateResponse {
  /** creativeId returned by the generator (video/carousel/banner service) */
  executionId:   string;
  creativeId:    string;
  format:        string;
  angleSlug:     string;
  diagnostics:   ExecutionDiagnostics;
  blueprintMeta: MasterBlueprint['_meta'];
  validationFixes: string[];
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class GovoloService {
  private readonly logger = new Logger(GovoloService.name);

  constructor(
    private readonly config:   ConfigService,
    @Inject(forwardRef(() => CampaignService))
    private readonly campaigns: CampaignService,
    @Inject(forwardRef(() => ConceptService))
    private readonly concepts:  ConceptService,
    @Inject(forwardRef(() => VideoService))
    private readonly videos:    VideoService,
    @Inject(forwardRef(() => CarouselService))
    private readonly carousels: CarouselService,
    @Inject(forwardRef(() => BannerService))
    private readonly banners:   BannerService,
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
      `Blueprint generated | campaign=${dto.campaignId} format=${rawBlueprint.format} angle=${rawBlueprint.angle_slug}`,
    );

    // ── 5. Validate + auto-fix ─────────────────────────────────────────────
    const { valid, fixes, errors, blueprint } = validateAndFix(rawBlueprint);

    if (fixes.length > 0) {
      this.logger.warn(`Blueprint auto-fixed (${fixes.length} changes): ${fixes.join('; ')}`);
    }

    if (!valid) {
      throw new BadRequestException({
        message: 'Blueprint validation failed with unrecoverable errors',
        errors,
        fixes,
      });
    }

    // ── 6. Map blueprint → generation payload ──────────────────────────────
    const mapped      = mapBlueprintToGenerationPayload(blueprint);
    const diagnostics = diagnoseBlueprint(blueprint);

    if (diagnostics.warnings.length > 0) {
      this.logger.warn(`Execution diagnostics warnings: ${diagnostics.warnings.join('; ')}`);
    }

    // ── 7. Execute via existing generator ─────────────────────────────────
    let creativeId: string;

    try {
      switch (mapped.format) {
        case 'video': {
          const res = await this.videos.generate(
            {
              campaignId:       mapped.payload.campaignId,
              conceptId:        mapped.payload.conceptId,
              angleSlug:        mapped.payload.angleSlug,
              durationTier:     mapped.payload.durationTier as any,
              styleContext:     mapped.payload.styleContext,
              keyObjection:     mapped.payload.keyObjection,
              valueProposition: mapped.payload.valueProposition,
            },
            userId,
          );
          creativeId = res.creativeId;
          break;
        }

        case 'carousel': {
          const res = await this.carousels.generate(
            {
              campaignId:       mapped.payload.campaignId,
              conceptId:        mapped.payload.conceptId,
              angleSlug:        mapped.payload.angleSlug,
              slideCount:       (mapped.payload as any).slideCount,
              platform:         (mapped.payload as any).platform,
              styleContext:     mapped.payload.styleContext,
              keyObjection:     mapped.payload.keyObjection,
              valueProposition: mapped.payload.valueProposition,
            },
            userId,
          );
          creativeId = res.creativeId;
          break;
        }

        case 'banner': {
          const res = await this.banners.generate(
            {
              campaignId:       mapped.payload.campaignId,
              conceptId:        mapped.payload.conceptId,
              angleSlug:        mapped.payload.angleSlug,
              sizes:            (mapped.payload as any).sizes,
              styleContext:     mapped.payload.styleContext,
              keyObjection:     mapped.payload.keyObjection,
              valueProposition: mapped.payload.valueProposition,
            },
            userId,
          );
          creativeId = res.creativeId;
          break;
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Generation failed for format=${mapped.format}: ${msg}`);
      throw new InternalServerErrorException(`Creative generation failed: ${msg}`);
    }

    this.logger.log(
      `Govolo execution complete | creativeId=${creativeId!} format=${blueprint.format}`,
    );

    // ── 8. Return ──────────────────────────────────────────────────────────
    return {
      executionId:     creativeId!,   // creativeId IS the execution handle
      creativeId:      creativeId!,
      format:          blueprint.format,
      angleSlug:       blueprint.angle_slug,
      diagnostics,
      blueprintMeta:   blueprint._meta,
      validationFixes: fixes,
    };
  }
}
