/**
 * execution-gateway.ts
 *
 * Single execution gateway for ALL creative generation in Creative OS.
 *
 * ─── Architectural contract ───────────────────────────────────────────────────
 * RULE: No other service in the system may call VideoService,
 *       CarouselService, or BannerService directly.
 *       ALL generation MUST route through this gateway.
 *
 * ─── Mode routing enforcement (FIX 2) ────────────────────────────────────────
 * executionMode is a FIRST-CLASS INPUT — not a label.
 *
 * Mode DIRECTLY controls the render engine called:
 *
 *   ugc      → Kling API    (KlingApiService)  — authentic UGC style
 *   cinematic → Veo API     (VeoApiService)    — premium cinematic production
 *   hybrid   → Split:       even variants → Kling, odd variants → Veo
 *
 * ─── Scene rendering (FIX 3) ─────────────────────────────────────────────────
 * When creativePlan.video.scenes has more than 1 scene:
 *   → Render each scene individually via the correct engine
 *   → Stitch scenes via StitcherService
 *   → Persist Creative record in DB
 *
 * Single-render path (no scenes / scenes.length === 1):
 *   → Existing VideoService.generate() for backward compatibility
 *
 * ─── Variant count (FIX 4) ───────────────────────────────────────────────────
 * MAX_VARIANTS hard cap removed. Brain decision is respected.
 * Upper safety bound is 10 (throws above that).
 *
 * ─── Guarantees ───────────────────────────────────────────────────────────────
 *   1. Every variant carries its own mode + engine context overlay
 *   2. hybrid variants are genuinely split across both engines
 *   3. GatewayExecutionResult.modeApplied is true IFF branching was enforced
 *   4. Every returned variant records modeApplied + engineApplied
 *   5. Video creativePlan scenes are rendered scene-by-scene, not as context strings
 */

import { Injectable, Logger, Inject, forwardRef, BadRequestException, ForbiddenException } from '@nestjs/common';

import { VideoService }         from '../../video/video.service';
import { CarouselService }      from '../../carousel/carousel.service';
import { BannerService }        from '../../banner/banner.service';
import { KlingApiService }      from '../../ugc/kling-api.service';
import { VeoApiService }        from '../../veo/veo-api.service';
import { StitcherService }      from '../../ugc/stitcher/stitcher.service';
import { PrismaService }        from '../../prisma/prisma.service';
import { SubscriptionService }  from '../../billing/subscription.service';

import type {
  ExecutionMode,
  RenderEngine,
  ModelDecision,
} from './model-router';
import type { RoutingDecision } from '../../routing/smart/routing.types';
import type { CreativePlan }   from '../../creative-director/creative-director-orchestrator';
import type { KlingScene, SceneRenderResult } from '../../ugc/types/ugc.types';

// ─── Public types ──────────────────────────────────────────────────────────────

export interface GatewayExecutionInput {
  // ── Core identity ──────────────────────────────────────────────────────────
  format:      'video' | 'carousel' | 'banner';
  campaignId:  string;
  conceptId:   string;
  angleSlug:   string;

  // ── Enriched creative context ──────────────────────────────────────────────
  /** Pre-enriched by scene-optimizer (tone, pacing, emotion, hook, cta, DNA) */
  styleContext:      string;
  keyObjection?:     string;
  valueProposition?: string;

  // ── Mode routing — MUST be present; gateway validates and rejects if missing ─
  /** Execution mode — DIRECTLY controls render engine, not just a label */
  executionMode:   ExecutionMode;
  /** Primary render engine from model-router */
  renderEngine:    RenderEngine;
  /** Human-readable reasoning from decideMode() */
  modeReasoning:   string;
  /** Full routing decision — ALL fields are used, none are decorative */
  routingDecision: RoutingDecision;
  /** Per-scene mode decisions for per-variant context derivation */
  modelDecisions:  ModelDecision[];

  // ── Creative Director plan (REQUIRED — first-class input) ─────────────────
  // Fix 4: Gateway rejects requests without a plan. Callers must generate one
  // (via CreativeDirectorService or V2 synthetic builder) before dispatching.
  creativePlan: CreativePlan;

  // ── Format-specific ────────────────────────────────────────────────────────
  durationTier?: string;
  slideCount?:   number;
  platform?:     string;
  sizes?:        string[];

  // ── Variant generation ─────────────────────────────────────────────────────
  /** Respected exactly — brain decision is honoured (safety bound: max 10) */
  variantCount: number;
}

export interface GatewayCreativeVariant {
  creativeId:    string;
  variantIndex:  number;
  format:        string;
  /** Actual mode applied to this variant (ugc | cinematic) */
  modeApplied:   string;
  /** Actual engine applied to this variant (kling | veo) */
  engineApplied: string;
}

export interface GatewayExecutionResult {
  creatives:         GatewayCreativeVariant[];
  primaryCreativeId: string;
  /** True IFF mode-based branching was enforced for every variant */
  modeApplied:  boolean;
  /** True IFF engine was determined by routing decision for every variant */
  modelApplied: boolean;
  /** Deduplicated list of engines actually used (e.g. ['kling'] or ['kling','veo']) */
  enginesUsed:  string[];
}

// ─── Mode-specific context overlays ───────────────────────────────────────────

interface ModeOverlay {
  mode:    string;
  engine:  string;
  context: string;
}

function ugcOverlay(aggressiveness: string): ModeOverlay {
  return {
    mode:   'ugc',
    engine: 'kling',
    context: [
      'engine:kling',
      'style:ugc',
      'authenticity:high',
      'production_value:authentic',
      `hooks:${aggressiveness}`,
      'pacing:aggressive',
    ].join(' | '),
  };
}

function cinematicOverlay(): ModeOverlay {
  return {
    mode:   'cinematic',
    engine: 'veo',
    context: [
      'engine:veo',
      'style:cinematic',
      'production_value:premium',
      'camera_language:advanced',
      'lighting:professional',
      'pacing:moderate',
    ].join(' | '),
  };
}

function resolveVariantOverlay(
  mode:           ExecutionMode,
  variantIndex:   number,
  aggressiveness: string,
): ModeOverlay {
  switch (mode) {
    case 'ugc':
      return ugcOverlay(aggressiveness);
    case 'cinematic':
      return cinematicOverlay();
    case 'hybrid':
      return variantIndex % 2 === 0
        ? ugcOverlay(aggressiveness)
        : cinematicOverlay();
  }
}

// ─── Constants ────────────────────────────────────────────────────────────────

const VALID_MODES      = new Set<string>(['ugc', 'cinematic', 'hybrid']);
const MAX_SAFE_VARIANTS = 10;

/** Duration in seconds per durationTier label */
const DURATION_TIER_SECONDS: Record<string, number> = {
  SHORT:    15,
  MEDIUM:   30,
  LONG:     60,
  EXTENDED: 90,
};

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class ExecutionGatewayService {
  private readonly logger = new Logger(ExecutionGatewayService.name);

  constructor(
    @Inject(forwardRef(() => VideoService))
    private readonly videos:    VideoService,
    @Inject(forwardRef(() => CarouselService))
    private readonly carousels: CarouselService,
    @Inject(forwardRef(() => BannerService))
    private readonly banners:   BannerService,
    // FIX 2: Real Kling + Veo engines for scene-by-scene rendering
    private readonly klingApi:  KlingApiService,
    private readonly veoApi:    VeoApiService,
    // FIX 3: Stitcher for multi-scene video assembly
    private readonly stitcher:  StitcherService,
    // FIX 3: Prisma to persist Creative records after stitching
    private readonly prisma:    PrismaService,
    // Phase 7: token-based usage gating
    private readonly subs:      SubscriptionService,
  ) {}

  /**
   * Execute creative generation through the canonical gateway.
   *
   * Steps:
   *   1. Validate executionMode — reject if missing/invalid
   *   2. Validate variantCount — reject if exceeds safety bound
   *   3. Build base context (creative plan + scene-optimizer signals)
   *   4. For each variant: resolve mode overlay → render via correct engine → return
   */
  async execute(
    input:  GatewayExecutionInput,
    userId: string,
  ): Promise<GatewayExecutionResult> {

    // ── Phase 7: Token gate — check BEFORE any execution ─────────────────
    const tokenCheck = await this.subs.checkTokens(userId, input.format);
    if (!tokenCheck.allowed) {
      const reason = tokenCheck.reason ?? 'INSUFFICIENT_TOKENS';
      this.logger.warn(
        `[Gateway] Token gate blocked — userId=${userId} format=${input.format} ` +
        `required=${tokenCheck.required} remaining=${tokenCheck.remaining} reason=${reason}`,
      );
      throw new ForbiddenException(
        `${reason}: ${tokenCheck.remaining} tokens remaining, ${tokenCheck.required} required for ${input.format}`,
      );
    }

    // ── Guard: mode MUST be present and valid ──────────────────────────────
    if (!input.executionMode || !VALID_MODES.has(input.executionMode)) {
      throw new BadRequestException(
        `[ExecutionGateway] executionMode is required and must be ugc | cinematic | hybrid. ` +
        `Got: "${input.executionMode ?? 'undefined'}"`,
      );
    }

    // ── Guard: routingDecision MUST be fully present ───────────────────────
    if (!input.routingDecision || typeof input.routingDecision.mode !== 'string') {
      throw new BadRequestException(
        '[ExecutionGateway] routingDecision is required and must be a full RoutingDecision object.',
      );
    }

    // ── Fix 4: CreativePlan is required — reject if missing ───────────────────
    if (!input.creativePlan) {
      throw new BadRequestException(
        '[ExecutionGateway] creativePlan is required. ' +
        'Generate a plan via CreativeDirectorService or the V2 brain builder ' +
        'before dispatching to the gateway.',
      );
    }

    // ── Respect brain's variantCount — remove hard cap, add safety bound ──────
    const count = input.variantCount;
    if (count > MAX_SAFE_VARIANTS) {
      throw new BadRequestException(
        `[ExecutionGateway] variantCount ${count} exceeds safety bound of ${MAX_SAFE_VARIANTS}.`,
      );
    }
    if (count < 1) {
      throw new BadRequestException(
        `[ExecutionGateway] variantCount must be at least 1. Got: ${count}`,
      );
    }

    // ── Build base context ─────────────────────────────────────────────────
    const baseContext = this.buildBaseContext(input);

    this.logger.log(
      `[Gateway] Executing ${count} variant(s) | ` +
      `format=${input.format} executionMode=${input.executionMode} engine=${input.renderEngine} ` +
      `routing=${input.routingDecision.mode} hooks=${input.routingDecision.hookAggressiveness} ` +
      `risk=${input.routingDecision.riskTolerance.toFixed(2)}`,
    );

    // ── Generate variants — each gets its own mode-specific context ────────
    const variants = await Promise.all(
      Array.from({ length: count }, (_, i) =>
        this.executeVariant(input, baseContext, i, count, userId),
      ),
    );

    // ── Compute result metadata ────────────────────────────────────────────
    const enginesUsed = [...new Set(variants.map(v => v.engineApplied))];

    // ── Phase 7: Deduct tokens ONLY after all variants succeeded ──────────
    await this.subs.deductTokens(userId, input.format, input.campaignId).catch(err =>
      this.logger.warn(`[Gateway] Token deduction failed (non-fatal): ${err?.message}`),
    );

    return {
      creatives:         variants,
      primaryCreativeId: variants[0].creativeId,
      modeApplied:       true,
      modelApplied:      true,
      enginesUsed,
    };
  }

  // ─── Context builders ─────────────────────────────────────────────────────

  private buildBaseContext(input: GatewayExecutionInput): string {
    const parts: string[] = [];

    parts.push(`routing:${input.routingDecision.mode}`);
    parts.push(`variants:${input.routingDecision.variantCount}`);
    parts.push(`risk:${input.routingDecision.riskTolerance.toFixed(2)}`);
    parts.push(`exploration:${input.routingDecision.explorationRate.toFixed(2)}`);
    parts.push(`blending:${input.routingDecision.blendingEnabled}`);

    if (input.styleContext) {
      parts.push(input.styleContext);
    }

    if (input.creativePlan) {
      parts.push(...this.serializeCreativePlan(input.creativePlan, input.format));
    }

    return parts.join(' | ');
  }

  private serializeCreativePlan(plan: CreativePlan, format: string): string[] {
    const parts: string[] = [];
    const { core_story } = plan;

    parts.push(`story_hook:"${core_story.hook.slice(0, 80)}"`);
    parts.push(`story_problem:"${core_story.problem.slice(0, 80)}"`);
    parts.push(`story_solution:"${core_story.solution.slice(0, 80)}"`);
    parts.push(`story_cta:"${core_story.cta.slice(0, 60)}"`);

    if (format === 'video') {
      const scenes = plan.video.scenes;
      parts.push(`scene_count:${scenes.length}`);
      scenes.forEach((s, i) => {
        const pfx = `s${i + 1}`;
        parts.push(
          `${pfx}:[${s.transition}|${s.pacing}|overlay:"${s.overlay_text.slice(0, 60)}"|prompt:"${s.kling_prompt.slice(0, 120)}"]`,
        );
      });
    }

    if (format === 'carousel') {
      const slides = plan.carousel.slides;
      parts.push(`slide_count:${slides.length}`);
      slides.forEach((s, i) => {
        const sub = s.subtext ? `|sub:"${s.subtext.slice(0, 60)}"` : '';
        parts.push(
          `sl${i + 1}:[${s.intent}|headline:"${s.headline.slice(0, 80)}"${sub}|visual:"${s.visual_direction.slice(0, 80)}"]`,
        );
      });
    }

    if (format === 'banner') {
      const { banner } = plan;
      parts.push(`banner_headline:"${banner.headline.slice(0, 60)}"`);
      parts.push(`banner_subtext:"${banner.subtext.slice(0, 80)}"`);
      parts.push(`banner_cta:"${banner.cta.slice(0, 40)}"`);
      if (banner.visual_composition) {
        parts.push(`banner_composition:"${banner.visual_composition.slice(0, 100)}"`);
      }
    }

    return parts;
  }

  // ─── Variant dispatch ─────────────────────────────────────────────────────

  private async executeVariant(
    input:         GatewayExecutionInput,
    baseContext:   string,
    variantIndex:  number,
    totalVariants: number,
    userId:        string,
  ): Promise<GatewayCreativeVariant> {

    const overlay = resolveVariantOverlay(
      input.executionMode,
      variantIndex,
      input.routingDecision.hookAggressiveness,
    );

    const variantTag   = totalVariants > 1 ? ` | variant:${variantIndex + 1}` : '';
    const styleContext = `${overlay.context} | ${baseContext}${variantTag}`;

    this.logger.log(
      `[Gateway] Variant ${variantIndex + 1}/${totalVariants}: ` +
      `mode=${overlay.mode} engine=${overlay.engine}`,
    );

    switch (input.format) {

      // ── Video: FIX 2 + FIX 3 ─────────────────────────────────────────────
      case 'video': {
        const scenes = input.creativePlan?.video?.scenes;

        // W1 FIX: ALL scene-based renders (single or multi) go through the
        // engine-aware path so executionMode is ALWAYS respected.
        // executeVideoFromScenes handles 1-scene via stitcher single-scene shortcut.
        if (scenes && scenes.length >= 1) {
          return this.executeVideoFromScenes(
            input, overlay, styleContext, variantIndex, userId,
          );
        }

        // No-scene fallback (no creativePlan at all) — VideoService backward compat
        const res = await this.videos.generate(
          {
            campaignId:       input.campaignId,
            conceptId:        input.conceptId,
            angleSlug:        input.angleSlug,
            durationTier:     input.durationTier as any,
            styleContext,
            keyObjection:     input.keyObjection,
            valueProposition: input.valueProposition,
          },
          userId,
        );
        return {
          creativeId:    res.creativeId,
          variantIndex,
          format:        'video',
          modeApplied:   overlay.mode,
          engineApplied: overlay.engine,
        };
      }

      case 'carousel': {
        const res = await this.carousels.generate(
          {
            campaignId:       input.campaignId,
            conceptId:        input.conceptId,
            angleSlug:        input.angleSlug,
            slideCount:       input.slideCount ?? 5,
            platform:         input.platform,
            styleContext,
            keyObjection:     input.keyObjection,
            valueProposition: input.valueProposition,
          },
          userId,
        );
        return {
          creativeId:    res.creativeId,
          variantIndex,
          format:        'carousel',
          modeApplied:   overlay.mode,
          engineApplied: overlay.engine,
        };
      }

      case 'banner': {
        const res = await this.banners.generate(
          {
            campaignId:       input.campaignId,
            conceptId:        input.conceptId,
            angleSlug:        input.angleSlug,
            sizes:            input.sizes ?? ['1080x1080'],
            styleContext,
            keyObjection:     input.keyObjection,
            valueProposition: input.valueProposition,
          },
          userId,
        );
        return {
          creativeId:    res.creativeId,
          variantIndex,
          format:        'banner',
          modeApplied:   overlay.mode,
          engineApplied: overlay.engine,
        };
      }

      default:
        throw new Error(`[ExecutionGateway] Unsupported format: ${(input as any).format}`);
    }
  }

  // ─── FIX 2 + FIX 3: Scene-by-scene video rendering ───────────────────────

  /**
   * Renders each CreativePlan scene individually via the correct engine
   * (Kling for ugc, Veo for cinematic), stitches them, and persists
   * the result as a Creative record in the database.
   */
  private async executeVideoFromScenes(
    input:        GatewayExecutionInput,
    overlay:      ModeOverlay,
    styleContext: string,
    variantIndex: number,
    userId:       string,
  ): Promise<GatewayCreativeVariant> {
    const planScenes = input.creativePlan!.video.scenes;
    const platform   = input.platform ?? 'tiktok';
    const totalSecs  = DURATION_TIER_SECONDS[input.durationTier ?? 'SHORT'] ?? 15;
    const perScene   = Math.max(1, Math.round(totalSecs / planScenes.length));

    // Convert CreativePlan scenes → KlingScene[] (enforce engine-required fields)
    const VALID_TRANSITIONS = new Set(['cut', 'zoom', 'glitch', 'burst', 'fade']);
    const VALID_PACINGS     = new Set(['aggressive', 'moderate']);

    const klingScenes: KlingScene[] = planScenes.map((s, i) => ({
      scene_id:     i + 1,
      kling_prompt: s.kling_prompt,
      duration:     perScene,
      // Sanitize enum fields — fall back to safe defaults if CreativePlan value is invalid
      transition:   (VALID_TRANSITIONS.has(s.transition) ? s.transition : 'cut') as any,
      pacing:       (VALID_PACINGS.has(s.pacing)         ? s.pacing     : 'moderate') as any,
      // Map CreativePlan fields to KlingScene required fields
      visual:       s.overlay_text ?? s.kling_prompt.slice(0, 120),
      camera:       'front' as const,
      speech:       s.overlay_text ?? '',
      emotion:      (s as any).emotion ?? 'confident',
    }));

    this.logger.log(
      `[Gateway] Scene rendering: ${klingScenes.length} scenes via ${overlay.engine} ` +
      `| variant=${variantIndex + 1} platform=${platform}`,
    );

    // FIX 2: Route to correct render engine
    let sceneResults: SceneRenderResult[];
    if (overlay.engine === 'veo') {
      sceneResults = await this.veoApi.renderScenes(klingScenes, platform);
    } else {
      sceneResults = await this.klingApi.renderScenes(klingScenes, platform);
    }

    // FIX 3: Stitch scenes into final video
    const stitchResult = await this.stitcher.stitch(sceneResults);

    this.logger.log(
      `[Gateway] Stitched ${sceneResults.length} scenes → ` +
      `url=${stitchResult.stitchedVideoUrl} duration=${stitchResult.totalDuration}s`,
    );

    // Persist Creative record with full scene metadata
    const creative = await this.prisma.creative.create({
      data: {
        campaignId: input.campaignId,
        conceptId:  input.conceptId || undefined,
        format:     'VIDEO' as any,
        variant:    String.fromCharCode(65 + variantIndex),
        content:    {
          stitchedVideoUrl: stitchResult.stitchedVideoUrl,
          sceneVideoUrls:   sceneResults.map(r => r.videoUrl),
          engine:           overlay.engine,
          mode:             overlay.mode,
          sceneCount:       sceneResults.length,
          totalDuration:    stitchResult.totalDuration,
          styleContext,
        },
      },
    });

    return {
      creativeId:    creative.id,
      variantIndex,
      format:        'video',
      modeApplied:   overlay.mode,
      engineApplied: overlay.engine,
    };
  }
}
