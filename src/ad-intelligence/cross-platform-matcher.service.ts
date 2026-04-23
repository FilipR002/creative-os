import { Injectable } from '@nestjs/common';
import { NormalizedAd, CrossPlatformMatch, AdPlatform } from './types';

@Injectable()
export class CrossPlatformMatcherService {
  findMatches(ads: NormalizedAd[]): CrossPlatformMatch[] {
    // Group by emotional trigger (primary) and detect platform overlap
    const groups = new Map<string, NormalizedAd[]>();
    for (const ad of ads) {
      const key = ad.emotionalTrigger;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(ad);
    }

    const matches: CrossPlatformMatch[] = [];
    const PLATFORM_ORDER: AdPlatform[] = ['tiktok', 'meta', 'youtube', 'google', 'web'];

    groups.forEach((group, emotionalTrigger) => {
      const platforms = [...new Set(group.map(a => a.platform))] as AdPlatform[];
      if (platforms.length < 2) return; // Need 2+ platforms for cross-platform match

      const avgScore = group.reduce((s, a) => s + a.estimatedPerformance, 0) / group.length;
      const hooks = group
        .sort((a, b) => b.estimatedPerformance - a.estimatedPerformance)
        .map(a => a.hook)
        .slice(0, 3);

      // Determine migration chain (order by first appearance per platform)
      const platformOrder = PLATFORM_ORDER.filter(p => platforms.includes(p));
      const migrationChain = platformOrder.join(' → ');

      matches.push({
        hookPattern:      hooks[0] || `${emotionalTrigger} hook`,
        emotionalTrigger,
        platforms,
        occurrences:      group.length,
        migrationChain,
        universalScore:   +avgScore.toFixed(3),
        firstPlatform:    platformOrder[0] ?? platforms[0],
      });
    });

    return matches.sort((a, b) => b.universalScore - a.universalScore);
  }

  computeGlobalScore(ads: NormalizedAd[]): number {
    const byPlatform: Record<AdPlatform, number[]> = {
      meta: [], tiktok: [], google: [], youtube: [], web: [],
    };
    for (const ad of ads) byPlatform[ad.platform].push(ad.estimatedPerformance);

    const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    const metaScore    = avg(byPlatform.meta);
    const tiktokScore  = avg(byPlatform.tiktok);
    const googleScore  = avg(byPlatform.google);
    const youtubeScore = avg(byPlatform.youtube);

    return +((metaScore + tiktokScore + googleScore + youtubeScore) / 4).toFixed(3);
  }
}
