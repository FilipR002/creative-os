/**
 * v2.brain.service.ts
 *
 * Creative OS v2 Brain — unified decision layer.
 *
 * Maps V2InputSchema → V2BrainOutput by orchestrating:
 *   1. detectFunnelIntent  (goal + budget → stage + intent)
 *   2. decideFormats       (stage → allocation ratios)
 *   3. allocateVariants    (ratios + budget → variant counts)
 *   4. CrossFormatSyncService (DB lookup → shared hook/angle/emotion)
 *
 * Also derives:
 *   - mode_selection per format (ugc→ugc, carousel→cinematic, banner→static)
 *   - tone injection into shared style context
 *   - primary/secondary format
 *
 * All pure/fast except CrossFormatSyncService (one Prisma query).
 */

import { Injectable, Logger } from '@nestjs/common';

import { detectFunnelIntent } from '../funnel-router/funnel-intent.detector';
import { decideFormats }      from '../funnel-router/format-decision.engine';
import { allocateVariants }   from '../funnel-router/creative-allocation.brain';
import { CrossFormatSyncService } from '../funnel-router/cross-format-sync.service';

import type { V2InputSchema, V2BrainOutput, V2Format, V2ModeType, V2ModeSelection } from './types/v2.schema.types';
import type { CampaignGoal, BudgetLevel } from '../funnel-router/funnel-router.types';

// ─── Goal + tone mapping ──────────────────────────────────────────────────────

const GOAL_MAP: Record<string, CampaignGoal> = {
  conversion: 'conversion',
  awareness:  'awareness',
  retention:  'retargeting',    // v2 "retention" → router "retargeting"
};

// ─── Mode selection per format ────────────────────────────────────────────────

function resolveMode(fmt: V2Format): V2ModeType {
  if (fmt === 'ugc')      return 'ugc';
  if (fmt === 'carousel') return 'cinematic';
  return 'static';
}

// ─── Tone → style signal string ───────────────────────────────────────────────

const TONE_STYLE: Record<string, string> = {
  aggressive: 'tone:aggressive | energy:high | directness:maximum | urgency:present',
  friendly:   'tone:friendly | energy:medium | directness:moderate | warmth:high',
  premium:    'tone:premium | energy:low | directness:measured | production_value:high',
};

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class V2BrainService {
  private readonly logger = new Logger(V2BrainService.name);

  constructor(private readonly sync: CrossFormatSyncService) {}

  async decide(input: V2InputSchema): Promise<V2BrainOutput> {
    const goal        = GOAL_MAP[input.goal] ?? 'conversion';
    const budget      = input.budget_level as BudgetLevel;
    const platform    = input.platforms[0] ?? 'tiktok';

    // 1. Funnel intent
    const funnelIntent = detectFunnelIntent({ goal, budgetLevel: budget });

    // 2. Format decision (respect format constraints)
    const rawDecision = decideFormats({ intent: funnelIntent, budget });
    // Filter to only allowed formats from constraints
    const allowed     = new Set(input.constraints.formats);
    const activeFormats = rawDecision.activeFormats.filter(f => allowed.has(f)) as V2Format[];
    const formatDecision = { ...rawDecision, activeFormats };

    // 3. Variant allocation
    const alloc = allocateVariants({ decision: formatDecision, budget });

    // 4. Shared creative core (DB lookup)
    const sharedCore = await this.sync.buildSharedCore({
      campaignId: input.campaign_id,
      conceptId:  input.concept_id,
      intent:     funnelIntent,
      product:    input.product,
      audience:   input.audience,
    });

    // 5. Tone injection — prepend to style context
    const toneTag    = TONE_STYLE[input.tone] ?? TONE_STYLE['friendly'];
    const styleCtx   = `${toneTag} | ${sharedCore.styleContext}`;

    // 6. Mode selection
    const modeSelection: V2ModeSelection = {
      ugc:      resolveMode('ugc'),
      carousel: resolveMode('carousel'),
      banner:   resolveMode('banner'),
    };

    // 7. Routing ratios (from format decision allocation)
    const routing = {
      ugc:      formatDecision.allocation.ugc,
      carousel: formatDecision.allocation.carousel,
      banner:   formatDecision.allocation.banner,
    };

    const primary   = (activeFormats[0] ?? formatDecision.primaryFormat) as V2Format;
    const secondary = (activeFormats[1] ?? formatDecision.secondaryFormat) as V2Format;

    this.logger.log(
      `[V2Brain] stage=${funnelIntent.funnelStage} intent=${funnelIntent.intentType} ` +
      `primary=${primary} secondary=${secondary} tone=${input.tone}`,
    );

    return {
      funnel_stage:     funnelIntent.funnelStage as any,
      intent:           funnelIntent.intentType as any,
      priority_signal:  funnelIntent.prioritySignal,
      routing,
      mode_selection:   modeSelection,
      primary_format:   primary,
      secondary_format: secondary,
      variant_allocation: {
        ugc:      alloc.ugcVariants,
        carousel: alloc.carouselVariants,
        banner:   alloc.bannerVariants,
        total:    alloc.totalVariants,
      },
      shared_hook:   sharedCore.hook,
      shared_angle:  sharedCore.angle,
      shared_emotion: sharedCore.emotion,
      reasoning:     funnelIntent.reasoning,
    };
  }
}
