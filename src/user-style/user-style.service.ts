// ─── User Style Profile — Service ────────────────────────────────────────────
// Ingests edit signals via EWMA and builds prompt context strings for generation.

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService }      from '../prisma/prisma.service';
import type { SignalType, StyleProfileResponse } from './user-style.types';

// EWMA learning rate — how fast each signal moves the score
const RATES: Record<SignalType, Partial<Record<keyof Dims, number>>> = {
  shorter:              { hookShort: 0.12, copyShort: 0.08 },
  more_emotional:       { toneEmotional: 0.15 },
  add_urgency:          { ctaUrgency: 0.15, toneAggressive: 0.08 },
  more_premium:         { tonePremium: 0.15 },
  simpler:              { toneCasual: 0.15, copyShort: 0.08 },
  stronger_cta:         { ctaDirect: 0.12, ctaUrgency: 0.08 },
  bolder:               { toneAggressive: 0.15 },
  conversational:       { toneCasual: 0.15 },
  manual_shorten_hook:  { hookShort: 0.08 },
  manual_shorten_copy:  { copyShort: 0.08 },
  manual_lengthen_hook: { hookShort: -0.06 },
  manual_lengthen_copy: { copyShort: -0.06 },
  feedback_worked:      { toneEmotional: 0.04, ctaUrgency: 0.04, hookShort: 0.02 },
  feedback_didnt_work:  { toneEmotional: -0.04, ctaUrgency: -0.04 },
};

type Dims = {
  hookShort: number; toneEmotional: number; tonePremium: number;
  toneAggressive: number; toneCasual: number; ctaUrgency: number;
  ctaDirect: number; copyShort: number;
};

const THRESHOLD = 0.63; // score above which a preference is considered "active"

@Injectable()
export class UserStyleService {
  private readonly logger = new Logger(UserStyleService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Ingest a signal ────────────────────────────────────────────────────────

  async ingestSignal(userId: string, signalType: SignalType, weight = 1.0): Promise<void> {
    if (!userId) return;

    const rates = RATES[signalType];
    if (!rates) return;

    // Upsert — create profile on first signal
    let profile = await this.prisma.userStyleProfile.findUnique({ where: { userId } });
    if (!profile) {
      profile = await this.prisma.userStyleProfile.create({
        data: { userId },
      });
    }

    // Apply EWMA updates
    const updates: Partial<Dims & { totalSignals: number; workedCount?: number; didntWorkCount?: number }> = {
      totalSignals: profile.totalSignals + 1,
    };

    for (const [dim, rate] of Object.entries(rates) as [keyof Dims, number][]) {
      const current = (profile as any)[dim] as number;
      const effective = rate * weight;
      if (effective > 0) {
        (updates as any)[dim] = clamp(current + effective * (1.0 - current));
      } else {
        (updates as any)[dim] = clamp(current + effective * current);
      }
    }

    if (signalType === 'feedback_worked')     updates.workedCount     = profile.workedCount + 1;
    if (signalType === 'feedback_didnt_work') updates.didntWorkCount  = profile.didntWorkCount + 1;

    await this.prisma.userStyleProfile.update({ where: { userId }, data: updates });
    this.logger.debug(`[${userId}] signal=${signalType} totalSignals=${updates.totalSignals}`);
  }

  // ── Get profile with derived labels ───────────────────────────────────────

  async getProfile(userId: string): Promise<StyleProfileResponse> {
    const raw = userId
      ? await this.prisma.userStyleProfile.findUnique({ where: { userId } }).catch(() => null)
      : null;

    const p: Dims & { totalSignals: number } = raw ?? {
      hookShort: 0.5, toneEmotional: 0.5, tonePremium: 0.5,
      toneAggressive: 0.5, toneCasual: 0.5, ctaUrgency: 0.5,
      ctaDirect: 0.5, copyShort: 0.5, totalSignals: 0,
    };

    return {
      ...p,
      dominantTone:  deriveDominantTone(p),
      hookLabel:     p.hookShort > THRESHOLD ? 'Short & Punchy' : 'Standard',
      ctaLabel:      p.ctaUrgency > THRESHOLD ? 'Urgent' : p.ctaDirect > THRESHOLD ? 'Direct' : 'Balanced',
      copyLabel:     p.copyShort > THRESHOLD ? 'Concise' : 'Detailed',
      styleContext:  buildStyleContext(p),
      adaptations:   buildAdaptations(p),
    };
  }

  // ── Get just the prompt context string ────────────────────────────────────

  async getStyleContext(userId: string): Promise<string | null> {
    if (!userId) return null;
    try {
      const profile = await this.getProfile(userId);
      return profile.styleContext || null;
    } catch {
      return null;
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function clamp(v: number): number {
  return Math.max(0.1, Math.min(0.95, v));
}

function deriveDominantTone(p: Dims): string {
  const tones = [
    { label: 'Emotional',      score: p.toneEmotional  },
    { label: 'Premium',        score: p.tonePremium    },
    { label: 'Bold & Direct',  score: p.toneAggressive },
    { label: 'Conversational', score: p.toneCasual     },
  ];
  const best = tones.reduce((a, b) => (b.score > a.score ? b : a));
  return best.score > THRESHOLD ? best.label : 'Balanced';
}

function buildStyleContext(p: Dims & { totalSignals: number }): string {
  if (p.totalSignals < 3) return '';

  const hints: string[] = [];
  if (p.hookShort      > THRESHOLD) hints.push('HOOK: Short and punchy — keep hooks under 10 words');
  if (p.toneEmotional  > THRESHOLD) hints.push('TONE: Emotionally resonant — use feeling-driven language');
  if (p.tonePremium    > THRESHOLD) hints.push('TONE: Premium — sophisticated, elevated language');
  if (p.toneAggressive > THRESHOLD) hints.push('TONE: Bold and direct — confident, no hedging');
  if (p.toneCasual     > THRESHOLD) hints.push('TONE: Conversational — casual, natural speech patterns');
  if (p.ctaUrgency     > THRESHOLD) hints.push('CTA: Urgent — time-sensitive action triggers');
  if (p.ctaDirect      > THRESHOLD) hints.push('CTA: Direct command — strong verb, no soft language');
  if (p.copyShort      > THRESHOLD) hints.push('COPY: Concise — max 20 words per paragraph, cut filler');

  if (hints.length === 0) return '';
  return `PERSONALIZATION (apply to this output):\n${hints.map(h => `• ${h}`).join('\n')}`;
}

function buildAdaptations(p: Dims & { totalSignals: number }): string[] {
  if (p.totalSignals < 3) return [];
  const reasons: string[] = [];
  if (p.hookShort      > THRESHOLD) reasons.push('Hook kept short — you tend to shorten openings');
  if (p.toneEmotional  > THRESHOLD) reasons.push('Emotional language prioritized — based on your past refinements');
  if (p.tonePremium    > THRESHOLD) reasons.push('Premium tone applied — matches your brand style');
  if (p.toneAggressive > THRESHOLD) reasons.push('Bold, direct voice used — based on your edits');
  if (p.ctaUrgency     > THRESHOLD) reasons.push('Urgency built into CTA — reflects your CTA preferences');
  if (p.copyShort      > THRESHOLD) reasons.push('Copy kept concise — you prefer shorter paragraphs');
  return reasons;
}
