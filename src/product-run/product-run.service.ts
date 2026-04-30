// ─── Product Run Service — Full Campaign Pipeline Orchestrator ────────────────
//
// Single entry point that sequences all existing subsystems in the correct
// order. Zero business logic lives here — every decision is delegated.
//
// VIDEO format (async):
//   1. Resolve/create campaign
//   2. Generate concept (Claude)
//   3. Select angles
//   4. Enqueue VideoQueueService.addVideoJob() → return jobId immediately
//   Worker handles: Kling render + Stitch + Scoring + Memory + Learning
//
// CAROUSEL / BANNER (sync — fast, Claude-only, no external video API):
//   1–9 unchanged (ExecutionGateway → scoring → memory → learning → response)

import { Injectable, Logger, ForbiddenException, BadRequestException } from '@nestjs/common';
import { randomUUID }               from 'crypto';
import { CampaignService }          from '../campaign/campaign.service';
import { ConceptService }           from '../concept/concept.service';
import { AngleService }             from '../angle/angle.service';
import { ScoringService }           from '../scoring/scoring.service';
import { MemoryService }            from '../memory/memory.service';
import { LearningService }          from '../learning/learning.service';
import { EvolutionService }         from '../evolution/evolution.service';
import { UsersService }             from '../users/users.service';
import { ExecutionGatewayService }  from '../creative-os/lib/execution-gateway';
// W3: Real routing signals
import { SmartRoutingService }      from '../routing/smart/routing.service';
import { FatigueService }           from '../fatigue/fatigue.service';
import { MirofishService }          from '../mirofish/mirofish.service';
import { decideMode }               from '../creative-os/lib/model-router';
import { buildAngleBlock }          from '../creative-os/lib/angle-definitions';
import { buildGoalBlock }           from '../creative-os/lib/goal-definitions';
import { CampaignMode }             from '../campaign/campaign.dto';
import { ConceptGoal }              from '../concept/concept.dto';
import type { CreativeScoreResult } from '../scoring/scoring.types';
import type { RoutingContext }       from '../routing/smart/routing.types';
import type {
  RunDto,
  RunAngleItem,
  RunCreativeItem,
  RunScoringItem,
  RunResponse,
} from './product-run.types';
import type { CreativePlan }        from '../creative-director/creative-director-orchestrator';
import { VideoQueueService }        from '../video-queue/video-queue.service';
import type { RunQueuedResponse }   from '../video-queue/video-job.types';
import { ResourcesService }        from '../resources/resources.service';
import type { ResourceContext }    from '../resources/resources.service';

// ─── Synthetic plan builder ───────────────────────────────────────────────────
// Fix 4: product-run builds a minimal CreativePlan from RunDto + angle so the
// gateway always receives a structured plan at execution time.

// Kling hard cap per scene (pro tier). Standard tier caps at 5s.
const KLING_MAX_SCENE_SECS = 10;

const DURATION_TIER_SECS: Record<string, number> = {
  SHORT:    15,
  MEDIUM:   30,
  LONG:     60,
  EXTENDED: 90,
};

/** Scene templates — cycled/trimmed to match the required scene count */
function buildSceneTemplates(
  hook:      string,
  cta:       string,
  platform:  string,
  angleSlug: string,
  count:     number,
): Array<{ kling_prompt: string; overlay_text: string; transition: any; pacing: string }> {
  const slug = angleSlug.replace(/_/g, ' ');
  // Phase 3: kling_prompt no longer asks the model to render text in the frame.
  // overlay_text is preserved for FFmpeg drawtext burn-in after stitching.
  const pool = [
    { kling_prompt: `Hook scene | authentic UGC energy | ${platform} | no on-screen text`,                     overlay_text: hook.slice(0, 60),           transition: 'cut'  as const, pacing: 'aggressive' as any },
    { kling_prompt: `Problem moment | relatable tension | close-up | ${platform} | no on-screen text`,         overlay_text: 'Does this feel familiar?',  transition: 'zoom' as any, pacing: 'moderate'   as any },
    { kling_prompt: `Solution reveal | confident body language | ${platform} | no on-screen text`,             overlay_text: `${slug} works.`,            transition: 'cut'  as any, pacing: 'moderate'   as any },
    { kling_prompt: `Social proof moment | testimonial energy | ${platform} | no on-screen text`,              overlay_text: 'Others are seeing it too.', transition: 'zoom' as any, pacing: 'moderate'   as any },
    { kling_prompt: `Before vs after transformation | lifestyle visual | ${platform} | no on-screen text`,     overlay_text: 'See the difference.',       transition: 'cut'  as any, pacing: 'aggressive' as any },
    { kling_prompt: `Feature highlight | detailed close-up shot | ${platform} | no on-screen text`,            overlay_text: `Why ${slug} works.`,        transition: 'cut'  as any, pacing: 'moderate'   as any },
    { kling_prompt: `Emotional aspirational moment | lifestyle peak | ${platform} | no on-screen text`,        overlay_text: 'This could be you.',        transition: 'zoom' as any, pacing: 'moderate'   as any },
    { kling_prompt: `Objection handling | calm reassurance | direct camera | ${platform} | no on-screen text`, overlay_text: 'No catch. Just results.',   transition: 'cut'  as any, pacing: 'moderate'   as any },
    { kling_prompt: `Call to action | direct to camera | urgency | ${platform} | no on-screen text`,           overlay_text: cta,                         transition: 'cut'  as any, pacing: 'moderate'   as any },
  ];

  // Always end with CTA, fill middle from pool, start with hook
  if (count === 1) return [pool[0]];
  if (count === 2) return [pool[0], pool[8]];

  const middle = pool.slice(1, 8);
  const needed = count - 2; // slots between hook and CTA
  const middleSlots: typeof pool = [];
  for (let i = 0; i < needed; i++) {
    middleSlots.push(middle[i % middle.length]);
  }
  return [pool[0], ...middleSlots, pool[8]];
}

function buildMinimalPlan(
  dto:        RunDto,
  angleSlug:  string,
  campaignId: string,
  conceptId:  string,
): CreativePlan {
  const hook     = dto.styleContext?.split('|')[0].trim().slice(0, 80) ?? `Discover ${angleSlug}`;
  const cta      = dto.goal === 'conversion' || dto.goal === 'sales' ? 'Get started now →'
                 : dto.goal === 'awareness'  ? 'Learn more →'
                 : dto.goal === 'engagement' ? 'Join the conversation →'
                 : dto.goal === 'retention'  ? 'See what\'s new →'
                 : dto.goal === 'install'    ? 'Download free →'
                 : 'See how it works →';
  const platform = dto.platform ?? 'tiktok';
  const now      = new Date().toISOString();

  // Derive scene count from duration: each scene = up to KLING_MAX_SCENE_SECS
  const totalSecs  = DURATION_TIER_SECS[dto.durationTier ?? 'SHORT'] ?? 15;
  const sceneCount = Math.max(1, Math.ceil(totalSecs / KLING_MAX_SCENE_SECS));

  return {
    core_story: {
      hook,
      problem:  'The gap between where you are and where you want to be is wider than it needs to be.',
      solution: `${angleSlug.replace(/_/g, ' ')} closes that gap — built for real results.`,
      cta,
    },
    video: {
      scenes: buildSceneTemplates(hook, cta, platform, angleSlug, sceneCount) as any,
    },
    carousel: {
      // Build slide stubs matching the user's requested slide count.
      // Extra slides beyond the 5-slide base get "value" intent placeholders.
      slides: (() => {
        const count  = dto.slideCount ?? 5;
        const base = [
          { headline: hook,                                           intent: 'hook'     as const, visual_direction: `Bold typography, high-energy, ${platform}` },
          { headline: 'The problem most people miss.',               intent: 'problem'  as const, visual_direction: 'Pain point visual, contrast', subtext: 'Sound familiar?' },
          { headline: `${angleSlug.replace(/_/g, ' ')} solves it.`, intent: 'solution' as const, visual_direction: 'Product hero, clean composition' },
          { headline: 'Here is why it works.',                       intent: 'solution' as const, visual_direction: 'Feature highlight, minimal layout' },
          { headline: cta,                                           intent: 'cta'      as const, visual_direction: 'Strong CTA, brand colors' },
        ];
        if (count <= 5) return base.slice(0, count);
        // Pad with value slides, keeping CTA always last
        const extras = Array.from({ length: count - 5 }, (_, i) => ({
          headline: `Why it matters — point ${i + 2}`,
          intent:   'solution' as const,
          visual_direction: 'Value highlight, clean layout',
        }));
        return [...base.slice(0, 4), ...extras, base[4]];
      })(),
    },
    banner: {
      headline:           hook.slice(0, 50),
      subtext:            `${angleSlug.replace(/_/g, ' ')} — built for results.`.slice(0, 80),
      cta,
      visual_composition: `High-impact visual, ${platform} optimized`,
    },
    _meta: {
      generated_at:  now,
      model:         'product-run-synthetic',
      campaign_id:   campaignId,
      concept_id:    conceptId,
      duration_tier: dto.durationTier ?? 'SHORT',
      version:       '2.0',
    },
  };
}

// Minimum winner score required to fire an evolution cycle
const EVOLUTION_THRESHOLD = 0.70;

// Maximum angles to generate creatives for (keeps parallelism bounded)
const MAX_PARALLEL_ANGLES = 3;

@Injectable()
export class ProductRunService {
  private readonly logger = new Logger(ProductRunService.name);

  constructor(
    private readonly campaigns:    CampaignService,
    private readonly concepts:     ConceptService,
    private readonly angles:       AngleService,
    private readonly scoring:      ScoringService,
    private readonly memory:       MemoryService,
    private readonly learning:     LearningService,
    private readonly evolution:    EvolutionService,
    private readonly users:        UsersService,
    private readonly gateway:      ExecutionGatewayService,
    // W3: Real routing — SmartRouting is @Global, no module import needed
    private readonly smartRouting: SmartRoutingService,
    private readonly fatigue:      FatigueService,
    private readonly mirofish:     MirofishService,
    // Async video queue
    private readonly videoQueue:   VideoQueueService,
    // Resources + persona context
    private readonly resourcesSvc: ResourcesService,
  ) {}

  async run(dto: RunDto, userId: string): Promise<RunResponse | RunQueuedResponse> {
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

    // ── videoMode validation — required when format === video ────────────────
    if (dto.format === 'video' && !dto.videoMode) {
      throw new BadRequestException(
        'videoMode is required when format is "video". Pass "ugc" or "classic".',
      );
    }

    // ── Step 0: Fetch ResourceContext (persona + product + brand) ────────────
    // Validates that personaId exists; throws 400 if provided but not found.
    const resourceCtx: ResourceContext = await this.resourcesSvc.getContext(
      userId,
      dto.personaId,
    );

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
    // Expand the user-selected angle into a full definition for the concept AI
    const angleBlock = buildAngleBlock(dto.styleContext);
    const { concept } = await this.concepts.generate(
      {
        campaignId,
        brief:       dto.brief,
        goal:        dto.goal ?? ConceptGoal.CONVERSION,
        platform:    dto.platform,
        resourceCtx,
        angleHint:   dto.styleContext || undefined,
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

    const pickedAngles = angleResult.selected_angles.slice(0, MAX_PARALLEL_ANGLES);

    // ── Honour user-selected angle ───────────────────────────────────────────
    // If the user explicitly chose an angle (styleContext is set), ensure it
    // is always the primary/first angle used for creative generation.
    // The memory engine may have picked different angles — we override here.
    if (dto.styleContext) {
      const forcedSlug = dto.styleContext.trim().toLowerCase().replace(/\s+/g, '_');
      const idx = pickedAngles.findIndex(
        (a: any) => a.angle === forcedSlug || a.angle === dto.styleContext!.trim(),
      );
      if (idx > 0) {
        // Already in list but not first — promote to primary slot
        const [forced] = pickedAngles.splice(idx, 1);
        pickedAngles.unshift(forced);
      } else if (idx === -1) {
        // Not picked by memory engine — inject as primary, drop the last slot
        pickedAngles.unshift({ angle: forcedSlug, type: 'exploit', reason: 'User-selected angle' } as any);
        if (pickedAngles.length > MAX_PARALLEL_ANGLES) pickedAngles.pop();
      }
      // idx === 0: already first — nothing to do
      this.logger.log(`[Run:${executionId}] User-selected angle locked: ${forcedSlug}`);
    }

    const angleItems: RunAngleItem[] = pickedAngles.map(a => ({
      slug:   a.angle,
      role:   a.type === 'exploit' ? 'exploit'
            : a.type === 'explore' ? 'explore'
            : 'secondary',
      reason: a.reason,
    }));
    this.logger.log(
      `[Run:${executionId}] Angles: ${angleItems.map(a => `${a.slug}(${a.role})`).join(', ')}`
    );

    // ── Step 4a: VIDEO — enqueue async job, return immediately ──────────────
    // Kling rendering + Stitch can take 5–15 minutes per angle.
    // The worker (VideoWorkerService) handles everything from here.
    if (dto.format === 'video') {
      const jobId = await this.videoQueue.addVideoJob({
        executionId,
        campaignId:  campaignId!,
        userId,
        dto,
        concept: {
          id:                concept.id,
          brief:             dto.brief,
          goal:              dto.goal ?? ConceptGoal.CONVERSION,
          keyObjection:      (concept as any).keyObjection     ?? null,
          valueProposition:  (concept as any).valueProposition ?? null,
        },
        angles: angleItems,
      });

      this.logger.log(
        `[Run:${executionId}] Video job enqueued — jobId=${jobId} ` +
        `angles=${angleItems.length} campaignId=${campaignId}`,
      );

      return {
        executionId,
        campaignId:  campaignId!,
        jobId,
        status:      'queued',
        concept: {
          id:    concept.id,
          brief: dto.brief,
          goal:  dto.goal ?? ConceptGoal.CONVERSION,
        },
        angles:  angleItems,
        message: `Video rendering started. Poll GET /api/jobs/${jobId} every 3s for progress and results.`,
      } as RunQueuedResponse;
    }

    // ── Step 4b: CAROUSEL / BANNER — execute synchronously ───────────────────
    // These formats hit Claude only (~5–15s total) — no need for async queue.
    const creativeResults = await Promise.all(
      pickedAngles.map(a =>
        this.generateCreative(dto, campaignId!, concept.id, a.angle, userId, {
          keyObjection:     (concept as any).keyObjection     || undefined,
          valueProposition: (concept as any).valueProposition || undefined,
          resourceCtx,
        })
      ),
    );
    this.logger.log(
      `[Run:${executionId}] ${creativeResults.length} creatives via gateway in ${Date.now() - t0}ms`
    );

    // ── Step 4c: Stamp imagesReady=false for carousel/banner ─────────────────
    // Images are generated asynchronously in ExecutionGateway (fire-and-forget).
    // Frontend must poll GET /api/creatives/:id until imageUrl fields are populated.
    const creativeItems: RunCreativeItem[] = creativeResults.map(c => ({
      ...c,
      imagesReady: dto.format === 'video' ? undefined : false,
    }));

    // ── Step 5: Score creatives (synchronous) ────────────────────────────────
    const creativeIds = creativeResults.map(c => c.creativeId);
    const scores      = await this.scoring.evaluate(creativeIds);

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
      creatives:            creativeItems,
      scoring:              scoringItems,
      winner,
      learningUpdateStatus,
      evolutionTriggered,
      explanation: buildExplanation(dto.format, angleItems, winner, evolutionTriggered),
    };
  }

  // ── Creative generation via ExecutionGateway ──────────────────────────────
  // W3: Real routing — SmartRoutingService + FatigueService + MirofishService.
  // No static routing stubs. Every angle gets its own routing decision.

  private async generateCreative(
    dto:        RunDto,
    campaignId: string,
    conceptId:  string,
    angleSlug:  string,
    userId:     string,
    enrichment: { keyObjection?: string; valueProposition?: string; resourceCtx?: ResourceContext } = {},
  ): Promise<RunCreativeItem> {

    // ── Signal 1: Angle fatigue (W4: fallback is WARMING, never HEALTHY) ──────
    let fatigueState: 'HEALTHY' | 'WARMING' | 'FATIGUED' | 'BLOCKED' = 'WARMING';
    let fatigueScore = 0.30;
    try {
      const fr  = await this.fatigue.computeForSlug(angleSlug, userId);
      fatigueState = fr.fatigue_state;
      fatigueScore  = fr.fatigue_score;
    } catch (err) {
      this.logger.warn(
        `[ProductRun] FatigueService failed for angle=${angleSlug} — using WARMING (neutral). ` +
        `Reason: ${(err as Error).message}`,
      );
    }

    // ── Signal 2: MIROFISH prediction confidence ──────────────────────────────
    let mirofishConfidence = 0;
    try {
      const mr = this.mirofish.simulateInline({
        primaryAngle: angleSlug,
        goal:         dto.goal ?? 'conversion',
        emotion:      'confident',
        format:       dto.format,
      });
      mirofishConfidence = mr.learning_signal_strength;
    } catch {
      // 0 is the safe fallback — routing degrades gracefully without mirofish
    }

    // ── Build RoutingContext from real signals ─────────────────────────────────
    const memoryStability    = Math.max(0.10, 0.85 - fatigueScore * 0.60);
    const explorationEntropy = (
      fatigueState === 'HEALTHY'  ? 0.20 :
      fatigueState === 'WARMING'  ? 0.40 :
      fatigueState === 'FATIGUED' ? 0.65 : 0.82
    );

    const routingCtx: RoutingContext = {
      clientId:           campaignId,
      goal:               (dto.goal as RoutingContext['goal']) ?? 'conversion',
      fatigueState,
      memoryStability,
      explorationEntropy,
      trendPressure:      0,   // not available at product-run layer
      mirofishConfidence,
    };

    const routingDecision = this.smartRouting.decide(routingCtx);

    // ── Derive executionMode + renderEngine from routing decision ─────────────
    let modeDecision = decideMode(
      {
        scene_type: 'hook',
        pacing:     'moderate',
        platform:   dto.platform,
        emotion:    'confident',
      },
      routingDecision,
    );

    // ── videoMode USER OVERRIDE — always beats SmartRouting for video ─────────
    // User explicitly chose UGC or Classic — honour that choice unconditionally.
    if (dto.format === 'video' && dto.videoMode) {
      const forcedMode:   'ugc' | 'cinematic' = dto.videoMode === 'ugc' ? 'ugc' : 'cinematic';
      const forcedEngine: 'kling' | 'veo'     = dto.videoMode === 'ugc' ? 'kling' : 'veo';
      modeDecision = {
        mode:       forcedMode,
        model:      forcedEngine,
        confidence: 1.0,
        reasoning:  `User-selected videoMode="${dto.videoMode}" overrides SmartRouting (was: ${modeDecision.mode})`,
      };
    }

    this.logger.log(
      `[ProductRun] Routing for angle=${angleSlug}: ` +
      `fatigue=${fatigueState} mode=${routingDecision.mode} ` +
      `→ executionMode=${modeDecision.mode} engine=${modeDecision.model} ` +
      `(${modeDecision.reasoning})`,
    );

    // Fix 4: Build synthetic CreativePlan — gateway requires a plan at execution time
    const creativePlan = buildMinimalPlan(dto, angleSlug, campaignId, conceptId);

    const goalBlock  = buildGoalBlock(dto.goal);
    const angleBlock = buildAngleBlock(dto.styleContext);
    const combinedStyleContext = [goalBlock, angleBlock].filter(Boolean).join('\n\n');

    const result = await this.gateway.execute(
      {
        format:            dto.format as 'video' | 'carousel' | 'banner',
        campaignId,
        conceptId,
        angleSlug,
        styleContext:      combinedStyleContext,
        keyObjection:      enrichment.keyObjection,
        valueProposition:  enrichment.valueProposition,
        resourceCtx:       enrichment.resourceCtx,
        videoMode:         dto.videoMode,
        executionMode:     modeDecision.mode,
        renderEngine:      modeDecision.model,
        modeReasoning:     modeDecision.reasoning,
        routingDecision,
        modelDecisions:    [modeDecision],
        creativePlan,     // Fix 4: required plan
        durationTier:      dto.durationTier ?? 'SHORT',
        slideCount:        dto.slideCount   ?? 5,
        platform:          dto.platform,
        sizes:             dto.sizes        ?? ['1080x1080'],
        variantCount:      routingDecision.variantCount,
        // Phase 5: ElevenLabs voiceover
        voiceoverEnabled:  dto.voiceoverEnabled,
        voiceId:           dto.voiceId,
        // Phase 6: Template override
        templateId:        dto.templateId,
        // Brand color
        primaryColor:      dto.primaryColor,
      },
      userId,
    );

    return {
      creativeId: result.primaryCreativeId,
      angleSlug,
      format:     dto.format,
    };
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
