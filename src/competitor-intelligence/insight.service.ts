import { Injectable } from '@nestjs/common';
import { AdIntelItem, Cluster, MarketInsights } from './types';

@Injectable()
export class InsightService {
  generate(brand: string, items: AdIntelItem[], clusters: Cluster[]): MarketInsights {
    const sorted = [...items].sort((a, b) => b.performanceSignal - a.performanceSignal);
    const topItems = sorted.slice(0, Math.ceil(sorted.length * 0.3));
    const bottomItems = sorted.slice(Math.floor(sorted.length * 0.6));

    // What is working
    const whatIsWorking = [
      ...topItems.slice(0, 3).map(i => `Hook pattern: "${i.hook.slice(0, 70)}" (score ${i.performanceSignal})`),
      ...clusters.filter(c => c.type === 'winning_hooks').slice(0, 2).map(c => `Cluster: ${c.label}`),
    ].filter(Boolean).slice(0, 5);

    // What is overused (high repetition, low novelty)
    const saturated = items.filter(i => i.scores.repetitionFrequency > 0.5 || i.scores.noveltyScore < 0.3);
    const whatIsOverused = [
      ...saturated.slice(0, 3).map(i => `"${i.hook.slice(0, 60)}" — high repetition`),
      ...clusters.filter(c => c.type === 'saturated_patterns').map(c => c.label),
    ].slice(0, 5);

    // What is missing
    const EMOTIONAL_ALL = ['urgency', 'fear', 'desire', 'social_proof', 'curiosity', 'authority', 'value'];
    const usedEmotions = new Set(items.map(i => i.emotionalTrigger));
    const missingEmotions = EMOTIONAL_ALL.filter(e => !usedEmotions.has(e));
    const whatIsMissing = [
      ...missingEmotions.map(e => `Untapped emotion: ${e}`),
      bottomItems.length > 0 ? `Low-performance angles: ${bottomItems.map(i => i.emotionalTrigger).join(', ')}` : null,
    ].filter(Boolean) as string[];

    // Strategy summary
    const topEmotion = this.mostCommon(topItems.map(i => i.emotionalTrigger));
    const topFormat  = this.mostCommon(items.map(i => i.format));
    const avgSignal  = items.reduce((s, i) => s + i.performanceSignal, 0) / Math.max(items.length, 1);
    const competitorStrategySummary =
      `${brand} primarily uses ${topEmotion} emotional triggers in ${topFormat} format ads. ` +
      `Average ad performance signal: ${(avgSignal * 100).toFixed(0)}%. ` +
      `${clusters.length} distinct patterns identified across ${items.length} ad items. ` +
      (missingEmotions.length > 0
        ? `Market gap opportunity: ${missingEmotions.slice(0, 2).join(', ')} angles are underrepresented.`
        : 'Market appears well-covered across emotional angles.');

    return { whatIsWorking, whatIsOverused, whatIsMissing, competitorStrategySummary };
  }

  private mostCommon(arr: string[]): string {
    if (!arr.length) return 'unknown';
    const counts: Record<string, number> = {};
    arr.forEach(v => { counts[v] = (counts[v] ?? 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  }
}
