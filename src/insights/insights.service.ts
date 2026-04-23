/**
 * WHY IT WINS ENGINE
 * Pure rule-based explainability — no LLM calls.
 * Generates structured explanations from scoring data + learned stats.
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Dimension thresholds for factor sentences
const HIGH = 0.75;
const MED  = 0.50;

@Injectable()
export class InsightsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── GET OR GENERATE insight for a creative ──────────────────────────────────
  async getInsight(creativeId: string) {
    // Return cached if exists
    const cached = await this.prisma.creativeInsight.findUnique({
      where: { creativeId },
    });
    if (cached) return this.format(cached);

    // Generate fresh
    return this.generate(creativeId);
  }

  // ─── FORCE REGENERATE ────────────────────────────────────────────────────────
  async generate(creativeId: string) {
    const [creative, score, angleStats, formatStats] = await Promise.all([
      this.prisma.creative.findUnique({
        where:   { id: creativeId },
        include: { angle: true, concept: true },
      }),
      this.prisma.creativeScore.findUnique({ where: { creativeId } }),
      this.prisma.creative.findUnique({ where: { id: creativeId }, include: { angle: { include: { angleStats: true } } } })
        .then(c => c?.angle?.angleStats ?? null),
      null as any,
    ]);

    if (!creative) throw new NotFoundException(`Creative ${creativeId} not found`);
    if (!score) throw new NotFoundException(`No score for creative ${creativeId} — run scoring first`);

    const fmtStats = await this.prisma.formatStats.findUnique({
      where: { format: creative.format.toLowerCase() },
    });

    // ── Build explanation ──────────────────────────────────────────────────
    const { keyFactors, improvementSuggestions, summary } = this.buildExplanation({
      format:     creative.format.toLowerCase(),
      isWinner:   score.isWinner,
      ctr:        score.ctrScore,
      engagement: score.engagement,
      conversion: score.conversion,
      clarity:    score.clarity,
      total:      score.totalScore,
      angleSlug:  creative.angle?.slug ?? null,
      angleWeight:  angleStats?.weight  ?? 1.0,
      angleWinRate: angleStats && angleStats.uses > 0 ? angleStats.wins / angleStats.uses : null,
      formatWeight: fmtStats?.weight ?? 1.0,
      formatCalibration: fmtStats?.calibrationFactor ?? 1.0,
    });

    // ── Upsert to DB ───────────────────────────────────────────────────────
    const insight = await this.prisma.creativeInsight.upsert({
      where:  { creativeId },
      update: { summary, keyFactors, improvementSuggestions, winnerScore: score.totalScore },
      create: { creativeId, summary, keyFactors, improvementSuggestions, winnerScore: score.totalScore },
    });

    return this.format(insight);
  }

  // ─── RULE ENGINE: build structured explanation ────────────────────────────────
  private buildExplanation(data: {
    format: string;
    isWinner: boolean;
    ctr: number;
    engagement: number;
    conversion: number;
    clarity: number;
    total: number;
    angleSlug: string | null;
    angleWeight: number;
    angleWinRate: number | null;
    formatWeight: number;
    formatCalibration: number;
  }): { summary: string; keyFactors: string[]; improvementSuggestions: string[] } {
    const { ctr, engagement, conversion, clarity, isWinner, total, angleSlug, angleWeight, angleWinRate, formatWeight, formatCalibration } = data;

    const factors: string[] = [];
    const suggestions: string[] = [];

    // ── CTR analysis ───────────────────────────────────────────────────────
    if (ctr >= HIGH) {
      factors.push(`Strong hook power — CTR score ${pct(ctr)} signals high scroll-stop potential`);
    } else if (ctr >= MED) {
      factors.push(`Moderate hook strength (CTR score ${pct(ctr)}) — room to improve first 3 seconds`);
      suggestions.push('Run Hook Booster to strengthen the first 3 seconds — add curiosity gap or pattern interrupt');
    } else {
      suggestions.push('Hook is weak — consider adding a bold claim, question, or unexpected statistic at the very start');
    }

    // ── Engagement analysis ────────────────────────────────────────────────
    if (engagement >= HIGH) {
      factors.push(`High emotional intensity (${pct(engagement)}) — content resonates with target emotion`);
    } else if (engagement < MED) {
      suggestions.push('Add more emotion-charged language throughout — mirror the audience\'s frustration or aspiration explicitly');
    }

    // ── Conversion analysis ────────────────────────────────────────────────
    if (conversion >= HIGH) {
      factors.push(`Effective CTA structure (${pct(conversion)}) — clear action with urgency signals`);
    } else if (conversion >= MED) {
      factors.push(`Moderate CTA effectiveness (${pct(conversion)}) — call-to-action present but could be stronger`);
      suggestions.push('Strengthen CTA: add urgency word ("now", "today", "limited") and make the action verb specific');
    } else {
      suggestions.push('CTA is too weak — replace with a direct, short, verb-first command (e.g. "Get it free", "Start today")');
    }

    // ── Clarity analysis ──────────────────────────────────────────────────
    if (clarity >= HIGH) {
      factors.push(`Excellent message clarity (${pct(clarity)}) — audience understands the offer immediately`);
    } else if (clarity < MED) {
      suggestions.push('Simplify the message — aim for one clear promise per scene. Remove jargon and reduce sentence length');
    }

    // ── Angle analysis ─────────────────────────────────────────────────────
    if (angleSlug && angleWeight >= 1.1) {
      factors.push(`High-weight angle "${angleSlug}" (weight: ${angleWeight.toFixed(2)}) — proven top performer in memory`);
    } else if (angleSlug && angleWinRate !== null && angleWinRate >= 0.5) {
      factors.push(`Angle "${angleSlug}" has ${Math.round(angleWinRate * 100)}% win rate in historical data`);
    } else if (angleSlug && angleWeight < 0.8) {
      suggestions.push(`Angle "${angleSlug}" is currently underperforming (weight: ${angleWeight.toFixed(2)}). Test a higher-weight angle like "before_after" or "storytelling"`);
    }

    // ── Format analysis ────────────────────────────────────────────────────
    if (formatWeight >= 1.1) {
      factors.push(`${data.format.toUpperCase()} format is a proven strong performer (format weight: ${formatWeight.toFixed(2)})`);
    }
    if (formatCalibration < 0.90) {
      suggestions.push(`Note: ${data.format} format has historically been over-predicted (calibration: ${formatCalibration.toFixed(2)}). Real performance may be lower than score suggests`);
    } else if (formatCalibration > 1.10) {
      factors.push(`${data.format.toUpperCase()} format is consistently under-predicted — real performance tends to exceed the score`);
    }

    // ── Composite winner/loser analysis ───────────────────────────────────
    const winnerStatus = isWinner ? 'won against all creatives in this campaign' : 'did not win this round';
    const scoreLabel = total >= 0.80 ? 'exceptional' : total >= 0.60 ? 'good' : total >= 0.40 ? 'average' : 'below average';

    // ── Build summary ──────────────────────────────────────────────────────
    const topFactor = factors[0]?.split(' — ')[0] || 'balanced performance across dimensions';
    const summary = isWinner
      ? `This ${data.format} creative ${winnerStatus} with a ${scoreLabel} total score of ${pct(total)}. Primary driver: ${topFactor.toLowerCase()}.`
      : `This ${data.format} creative scored ${pct(total)} (${scoreLabel}). ${suggestions.length > 0 ? 'Main improvement area: ' + suggestions[0].split(' — ')[0].toLowerCase() + '.' : 'Performance was close to the winner.'}`;

    // Ensure at least one of each
    if (factors.length === 0) factors.push('Score is within expected range for this format and angle combination');
    if (suggestions.length === 0) suggestions.push('Consider A/B testing a different angle to validate performance further');

    return { summary, keyFactors: factors, improvementSuggestions: suggestions };
  }

  private format(insight: any) {
    return {
      creativeId:            insight.creativeId,
      summary:               insight.summary,
      keyFactors:            insight.keyFactors as string[],
      improvementSuggestions:insight.improvementSuggestions as string[],
      winnerScore:           insight.winnerScore,
      generatedAt:           insight.createdAt,
    };
  }
}

function pct(v: number): string {
  return `${Math.round(v * 100)}%`;
}
