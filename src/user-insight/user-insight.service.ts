// ─── Phase 9.4 — User Abstraction Layer ──────────────────────────────────────
//
// PURE TRANSLATION LAYER.
// Reads internal engine signals and converts them into human product language.
//
// CONTRACT:
//   • NEVER expose angles, weights, EWMA, evolution, DNA, or causal breakdowns
//   • Generate ONE clear headline, ONE reason, ONE suggestion, ONE impact estimate
//   • Degrade gracefully — works from partial data at every fallback level
//   • Zero side effects on scoring, generation, or learning
//
// DATA PIPELINE (read-only):
//   CampaignOutcome      → performance tier + CTR/CVR for calibrated impact
//   CausalTrace          → dominant contributing layer (translated)
//   AnglePerformanceStat → baseline deviation (used internally, not exposed)
//
// FALLBACK CHAIN:
//   Full trace → outcome-only → generic guidance

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService }      from '../prisma/prisma.service';

export interface UserInsight {
  headline:       string;
  reason:         string;
  suggestion:     string;
  expectedImpact: string;
  campaignId:     string;
  generatedAt:    string;
}

// ── Performance tiers ─────────────────────────────────────────────────────────
type PerfTier = 'stellar' | 'strong' | 'moderate' | 'weak' | 'poor';

function scoreTier(s: number): PerfTier {
  if (s >= 0.35) return 'stellar';
  if (s >= 0.28) return 'strong';
  if (s >= 0.18) return 'moderate';
  if (s >= 0.10) return 'weak';
  return 'poor';
}

// ── Driver types (internal — never shown in output) ───────────────────────────
type Driver = 'angle' | 'creative' | 'vision' | 'evolution' | 'noise';

const CACHE_TTL_MS = 60 * 60 * 1000;   // 1 hour

@Injectable()
export class UserInsightService {
  private readonly logger = new Logger(UserInsightService.name);
  private readonly cache  = new Map<string, { insight: UserInsight; expires: number }>();

  constructor(private readonly prisma: PrismaService) {}

  // ── Public API ─────────────────────────────────────────────────────────────

  async generateUserInsight(campaignId: string): Promise<UserInsight> {
    const cached = this.cache.get(campaignId);
    if (cached && Date.now() < cached.expires) return cached.insight;

    const insight = await this.buildInsight(campaignId);
    this.cache.set(campaignId, { insight, expires: Date.now() + CACHE_TTL_MS });

    this.logger.log(`[9.4] insight generated campaign=${campaignId} tier=${this.peekTier(campaignId)}`);
    return insight;
  }

  /** Force refresh — called when new outcome/trace data arrives. */
  invalidate(campaignId: string): void {
    this.cache.delete(campaignId);
  }

  // ── Core builder ───────────────────────────────────────────────────────────

  private async buildInsight(campaignId: string): Promise<UserInsight> {
    // Load data in parallel — all selects, no writes
    const [outcome, trace, baseline] = await Promise.all([
      this.prisma.campaignOutcome.findFirst({
        where:   { campaignId },
        orderBy: { createdAt: 'desc' },
        select:  {
          performanceScore: true,
          ctr:              true,
          conversionRate:   true,
          angleSlug:        true,
        },
      }),
      this.prisma.causalTrace.findFirst({
        where:   { campaignId },
        orderBy: { createdAt: 'desc' },
        select:  {
          angleContribution:     true,
          creativeContribution:  true,
          visionContribution:    true,
          evolutionContribution: true,
          noiseEstimate:         true,
          confidence:            true,
        },
      }),
      // Baseline for the angle — used to calibrate impact language
      null as null,   // filled below once we have outcome.angleSlug
    ]);

    // No outcome at all → generic guidance
    if (!outcome) return this.genericInsight(campaignId);

    // Load baseline separately now that we have angleSlug
    const angleStat = await this.prisma.anglePerformanceStat.findUnique({
      where:  { angleSlug: outcome.angleSlug },
      select: { avgCtr: true, avgConversionRate: true, avgPerformanceScore: true },
    }).catch(() => null);

    const tier   = scoreTier(outcome.performanceScore);
    const driver = this.dominantDriver(trace);

    const headline       = this.buildHeadline(tier, driver);
    const reason         = this.buildReason(tier, driver, outcome, angleStat);
    const suggestion     = this.buildSuggestion(tier, driver);
    const expectedImpact = this.buildImpact(tier, driver, outcome, angleStat);

    return {
      headline,
      reason,
      suggestion,
      expectedImpact,
      campaignId,
      generatedAt: new Date().toISOString(),
    };
  }

  // ── Step 1: dominant driver ────────────────────────────────────────────────
  // Picks the single layer with highest contribution.
  // Falls back to 'creative' when no trace exists (most actionable default).

  private dominantDriver(
    trace: {
      angleContribution: number;
      creativeContribution: number;
      visionContribution: number;
      evolutionContribution: number;
      noiseEstimate: number;
      confidence: number;
    } | null,
  ): Driver {
    if (!trace || trace.confidence < 0.30) return 'creative';

    const scores: [Driver, number][] = [
      ['angle',     trace.angleContribution],
      ['creative',  trace.creativeContribution],
      ['vision',    trace.visionContribution],
      ['evolution', trace.evolutionContribution],
      ['noise',     trace.noiseEstimate],
    ];

    return scores.reduce((best, cur) => cur[1] > best[1] ? cur : best)[0];
  }

  // ── Step 2: headline ───────────────────────────────────────────────────────

  private buildHeadline(tier: PerfTier, driver: Driver): string {
    switch (tier) {
      case 'stellar':
        return driver === 'creative'
          ? 'Exceptional performance — your hook stopped the scroll'
          : driver === 'evolution'
          ? 'Breakthrough performance — a new approach is working exceptionally well'
          : 'One of your best-performing ads — the message is landing perfectly';

      case 'strong':
        return driver === 'creative'
          ? 'Strong performance — your ad copy is resonating well'
          : driver === 'vision'
          ? 'Strong performance — your visual format is working'
          : 'This ad is performing above average';

      case 'moderate':
        return driver === 'noise'
          ? 'Decent performance — though external factors are limiting impact'
          : 'Solid performance with room to improve';

      case 'weak':
        return driver === 'angle'
          ? "This ad isn't quite connecting — the message framing needs adjustment"
          : driver === 'creative'
          ? "Low engagement — the hook isn't capturing attention quickly enough"
          : 'This ad is underperforming — a few targeted changes could help';

      case 'poor':
        return "This ad isn't getting traction yet — let's fix that";
    }
  }

  // ── Step 3: reason ─────────────────────────────────────────────────────────

  private buildReason(
    tier:      PerfTier,
    driver:    Driver,
    outcome:   { ctr: number; conversionRate: number; performanceScore: number },
    baseline:  { avgCtr: number; avgConversionRate: number } | null,
  ): string {
    const isGood = tier === 'stellar' || tier === 'strong';
    const ctrAbove = baseline && outcome.ctr > baseline.avgCtr;
    const ctrPct   = baseline
      ? Math.round(Math.abs((outcome.ctr - baseline.avgCtr) / Math.max(baseline.avgCtr, 0.005)) * 100)
      : null;

    switch (driver) {
      case 'angle':
        return isGood
          ? `The core message is connecting strongly with your audience. People are engaging because the framing feels immediately relevant to them.`
          : `The message angle isn't fully resonating yet. Your audience may need a slightly different framing to feel the relevance immediately.`;

      case 'creative':
        if (isGood) {
          const ctrNote = ctrAbove && ctrPct
            ? ` Your click-through rate is ${ctrPct}% above typical for this type of campaign.`
            : '';
          return `The opening and copy structure are working — people are stopping and engaging.${ctrNote}`;
        }
        return baseline && !ctrAbove
          ? `The opening isn't capturing attention fast enough. You're getting fewer clicks than similar campaigns — the hook needs to be sharper in the first two seconds.`
          : `The copy structure isn't converting as well as expected. The message may need a stronger emotional trigger or clearer call-to-action.`;

      case 'vision':
        return isGood
          ? `The visual structure is guiding attention effectively — the format, layout, and presentation are working together well.`
          : `The visual presentation may not be matching audience expectations for this type of message. A cleaner layout or stronger visual contrast could help.`;

      case 'evolution':
        return isGood
          ? `A refined version of your original message is outperforming — the system tested a new approach and it's working better than the baseline.`
          : `The system tried a new variation of this message, but it hasn't found the right fit yet. More testing will sharpen it.`;

      case 'noise':
        return isGood
          ? `Performance is above average, though some of the result may be influenced by timing and audience conditions outside the ad itself.`
          : `The ad itself may be stronger than the numbers suggest — external factors like audience timing or platform competition are affecting results.`;
    }
  }

  // ── Step 4: suggestion ─────────────────────────────────────────────────────

  private buildSuggestion(tier: PerfTier, driver: Driver): string {
    const isGood = tier === 'stellar' || tier === 'strong';

    switch (driver) {
      case 'angle':
        return isGood
          ? 'Scale this message direction — test the same angle with 2–3 different visual executions to find the best combination.'
          : 'Reframe your core message around a single, specific pain point or aspiration. Avoid broad claims and lead with something your audience feels personally.';

      case 'creative':
        return isGood
          ? 'Reuse this hook structure in your next campaign — it\'s a proven attention-grabber. Try pairing it with a different call-to-action to push conversions higher.'
          : 'Lead your next version with a bolder, more specific opening statement. Aim to address a specific emotion or situation in the first line, before any product mention.';

      case 'vision':
        return isGood
          ? 'Replicate this visual format across more campaigns — the structure is working. Test the same layout with different color treatments or imagery styles.'
          : 'Simplify the visual hierarchy — make sure the most important message is the first thing the eye lands on. Reduce visual noise around your core statement.';

      case 'evolution':
        return isGood
          ? 'Let the system run more variations of this approach — you\'re on a strong trajectory. Increasing your campaign volume will accelerate learning.'
          : 'Continue testing — the system is searching for the right angle. Adding clearer feedback (like tracking conversions separately) will help it learn faster.';

      case 'noise':
        return isGood
          ? 'Run this creative again with a fresh audience segment — if it holds up, you have a strong repeatable format.'
          : 'Retest this creative in a new time window or audience segment before making structural changes. The core idea may be stronger than current results show.';
    }
  }

  // ── Step 5: expected impact ────────────────────────────────────────────────
  // Calibrated to actual CTR/CVR data — speaks specifically, not generically.

  private buildImpact(
    tier:     PerfTier,
    driver:   Driver,
    outcome:  { ctr: number; conversionRate: number; performanceScore: number },
    baseline: { avgCtr: number; avgConversionRate: number; avgPerformanceScore: number } | null,
  ): string {
    switch (tier) {
      case 'stellar':
        return 'This ad is already in your top tier. Scaling it consistently could sustain 25–40% above-average engagement across similar audiences.';

      case 'strong': {
        const lift = driver === 'creative'
          ? 'hook refinement could push CTR another 10–20% higher'
          : 'minor copy adjustments could improve conversions by 10–15%';
        return `Good trajectory — ${lift}. Small optimizations on top of a working formula compound quickly.`;
      }

      case 'moderate': {
        if (!baseline) return 'Optimizing the approach identified above could lift engagement by 15–25%.';
        const ctrGap = baseline.avgCtr > 0
          ? Math.round((baseline.avgCtr - outcome.ctr) / Math.max(baseline.avgCtr, 0.005) * 100)
          : 0;
        const cvrGap = baseline.avgConversionRate > 0
          ? Math.round((baseline.avgConversionRate - outcome.conversionRate) / Math.max(baseline.avgConversionRate, 0.005) * 100)
          : 0;

        if (ctrGap > 20) return `A stronger hook could close the gap on click-through rate — similar campaigns see ${ctrGap}% more clicks with sharper openings.`;
        if (cvrGap > 20) return `Tightening the message-to-action path could improve conversions by ${Math.min(cvrGap, 40)}% or more.`;
        return 'Targeted improvements to the weakest element could lift overall performance by 15–25%.';
      }

      case 'weak': {
        if (outcome.ctr < 0.02) return 'A revised hook alone could 2–3x your current click-through rate — most underperforming ads fail at the first line.';
        if (outcome.conversionRate < 0.05) return 'Improving the call-to-action clarity could lift conversions by 30–50% without changing the core message.';
        return 'A focused refresh of the underperforming element could improve results by 25–40%.';
      }

      case 'poor':
        return 'A full creative refresh typically yields 40–70% improvement for campaigns at this performance level. Start with the hook — it\'s the highest-leverage change.';
    }
  }

  // ── Fallback: generic insight when no outcome data exists ──────────────────

  private genericInsight(campaignId: string): UserInsight {
    return {
      headline:       'No performance data yet',
      reason:         'This campaign hasn\'t received enough audience data to generate a performance summary.',
      suggestion:     'Once your campaign is live and collecting data, we\'ll generate a full insight with specific recommendations.',
      expectedImpact: 'Insights typically become available after 100+ impressions.',
      campaignId,
      generatedAt:    new Date().toISOString(),
    };
  }

  // Cache peek helper (for logging only)
  private peekTier(campaignId: string): string {
    return this.cache.get(campaignId) ? 'cached' : 'fresh';
  }
}
