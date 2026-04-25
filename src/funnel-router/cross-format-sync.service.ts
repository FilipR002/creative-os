/**
 * cross-format-sync.service.ts
 *
 * Cross-Format Synchronization — Phase 1.2
 *
 * Ensures all formats generated in a funnel run share:
 *   hook         — same opening line across UGC, carousel cover, banner headline
 *   angle        — same angle slug (drives tone + framing)
 *   emotion      — same emotional driver (frustration / excitement / etc.)
 *   ctaLogic     — same CTA intent (urgency / scarcity / direct / soft)
 *   styleContext — serialized style tag string injected into all generators
 *
 * Source of truth resolution:
 *   1. Concept record (if conceptId provided) — highest priority
 *   2. Campaign fields (angle, tone, persona)
 *   3. Funnel intent signals (derived from goal + budget)
 *
 * Outputs SharedCreativeCore injected into every dispatch call.
 * Pure service — no external API calls.
 */

import { Injectable, Logger } from '@nestjs/common';

import { PrismaService }  from '../prisma/prisma.service';
import type {
  FunnelIntentResult,
  PrioritySignal,
  SharedCreativeCore,
} from './funnel-router.types';

// ─── Priority signal → CTA logic ──────────────────────────────────────────────

const SIGNAL_CTA: Record<PrioritySignal, string> = {
  trust:      'social_proof_cta | learn_more | trust_builder',
  emotion:    'feel_the_change | relatable_cta | aspiration_driven',
  conversion: 'urgency_cta | limited_offer | direct_buy_now',
};

// ─── Priority signal → emotion label ─────────────────────────────────────────

const SIGNAL_EMOTION: Record<PrioritySignal, string> = {
  trust:      'curious',
  emotion:    'hopeful',
  conversion: 'motivated',
};

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class CrossFormatSyncService {
  private readonly logger = new Logger(CrossFormatSyncService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Build the SharedCreativeCore from campaign/concept data + funnel intent.
   *
   * All formats generated in the same router run MUST use these values.
   * Never override hook/angle/emotion per-format — that breaks cross-format consistency.
   */
  async buildSharedCore(opts: {
    campaignId: string;
    conceptId?: string;
    intent:     FunnelIntentResult;
    product:    string;
    audience:   string;
  }): Promise<SharedCreativeCore> {
    const { campaignId, conceptId, intent, product, audience } = opts;

    // Load campaign
    const campaign = await this.prisma.campaign.findUnique({
      where:  { id: campaignId },
      select: { name: true, goal: true, angle: true, tone: true, persona: true },
    });

    // Load concept (try by conceptId first, fall back to campaignId linkage)
    const conceptQuery = conceptId
      ? this.prisma.concept.findUnique({ where: { id: conceptId } })
      : this.prisma.concept.findUnique({ where: { campaignId } });

    const concept = await conceptQuery.catch(() => null);

    // ── Hook ── concept.keyObjection → compelling opener; fallback to product+pain
    const rawHook = concept?.keyObjection
      ? `The #1 thing stopping ${audience} from ${campaign?.goal ?? 'their goal'}: ${concept.keyObjection}`
      : `${product} solves what ${audience} struggle with most`;

    const hook = rawHook.slice(0, 120);

    // ── Angle ──
    const angle = concept?.angleHint
      ?? campaign?.angle
      ?? this.intentToAngle(intent);

    // ── Emotion ──
    const emotion = concept?.emotion
      ?? SIGNAL_EMOTION[intent.prioritySignal];

    // ── CTA logic ──
    const ctaLogic = SIGNAL_CTA[intent.prioritySignal];

    // ── Style context (serialized tag string for all generators) ──
    const styleContext = [
      `funnel:${intent.funnelStage}`,
      `intent:${intent.intentType}`,
      `priority:${intent.prioritySignal}`,
      `angle:${angle}`,
      `emotion:${emotion}`,
      `tone:${campaign?.tone ?? 'authentic'}`,
      `hook:"${hook.slice(0, 80)}"`,
      `cta:${ctaLogic.split('|')[0].trim()}`,
    ].join(' | ');

    this.logger.debug(
      `[CrossFormatSync] campaign=${campaignId} angle=${angle} ` +
      `emotion=${emotion} signal=${intent.prioritySignal}`,
    );

    return { hook, angle, emotion, ctaLogic, styleContext };
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private intentToAngle(intent: FunnelIntentResult): string {
    const map: Record<string, string> = {
      cold: 'social_proof',
      warm: 'storytelling',
      hot:  'urgency',
    };
    return map[intent.intentType] ?? 'direct_benefit';
  }
}
