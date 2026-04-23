import { Injectable } from '@nestjs/common';
import { AdIntelItem, ScoreBreakdown } from './types';

const POWER_WORDS = /free|save|boost|grow|instantly|proven|secret|new|best|easy|fast|guarantee/gi;
const CLARITY_PENALTY = /therefore|furthermore|subsequently|notwithstanding|nevertheless/gi;

@Injectable()
export class ScoringService {
  score(items: AdIntelItem[]): AdIntelItem[] {
    const hooks = items.map(i => i.hook);
    return items.map(item => {
      const scores = this.computeScores(item, hooks);
      return {
        ...item,
        scores,
        performanceSignal: this.aggregate(scores),
      };
    });
  }

  private computeScores(item: AdIntelItem, allHooks: string[]): ScoreBreakdown {
    const text = `${item.hook} ${item.copy} ${item.cta}`;

    // Engagement: power words + CTA presence
    const powerCount = (text.match(POWER_WORDS) ?? []).length;
    const engagementLikelihood = Math.min(1, (powerCount * 0.15) + (item.cta !== 'Learn More' ? 0.2 : 0) + 0.3);

    // Clarity: shorter hooks with simple words score higher
    const wordCount = item.hook.split(' ').length;
    const clarityScore = Math.max(0, 1 - Math.max(0, wordCount - 8) * 0.05)
                       - Math.min(0.3, (text.match(CLARITY_PENALTY) ?? []).length * 0.1);

    // Emotional intensity
    const INTENSE_WORDS = /urgent|free|secret|proven|guaranteed|instantly|exclusive|limited/gi;
    const intenseCount = (text.match(INTENSE_WORDS) ?? []).length;
    const emotionalIntensity = Math.min(1, intenseCount * 0.2);

    // Novelty: inverse of how similar this hook is to others
    const similar = allHooks.filter(h => h !== item.hook && this.similarity(h, item.hook) > 0.6).length;
    const noveltyScore = Math.max(0, 1 - similar * 0.25);

    // Repetition frequency (how many times this pattern appears)
    const repetitionFrequency = Math.min(1, similar * 0.2);

    return {
      engagementLikelihood: +engagementLikelihood.toFixed(3),
      clarityScore:         +Math.max(0, clarityScore).toFixed(3),
      emotionalIntensity:   +emotionalIntensity.toFixed(3),
      noveltyScore:         +noveltyScore.toFixed(3),
      repetitionFrequency:  +repetitionFrequency.toFixed(3),
    };
  }

  private aggregate(s: ScoreBreakdown): number {
    return +(
      s.engagementLikelihood * 0.3 +
      s.clarityScore         * 0.25 +
      s.emotionalIntensity   * 0.2 +
      s.noveltyScore         * 0.15 +
      (1 - s.repetitionFrequency) * 0.1
    ).toFixed(3);
  }

  private similarity(a: string, b: string): number {
    const wa = new Set(a.toLowerCase().split(/\s+/));
    const wb = new Set(b.toLowerCase().split(/\s+/));
    let common = 0;
    wa.forEach(w => { if (wb.has(w)) common++; });
    return common / Math.max(wa.size, wb.size, 1);
  }
}
