import { Injectable, Logger }              from '@nestjs/common';
import { randomUUID }                      from 'crypto';
import { CompetitorIntelligenceService }   from '../competitor-intelligence/competitor-intelligence.service';
import { TrendPredictorService }           from '../trend-prediction/trend-predictor.service';
import { PlatformNormalizerService }       from './platform-normalizer.service';
import { CrossPlatformMatcherService }     from './cross-platform-matcher.service';
import {
  NormalizedAd, PlatformAnalysis, UnifiedInsight,
  AggregationJob, AdPlatform,
} from './types';

@Injectable()
export class AdIntelligenceService {
  private readonly logger = new Logger(AdIntelligenceService.name);
  private readonly ads    = new Map<string, NormalizedAd>();
  private readonly jobs   = new Map<string, AggregationJob>();

  constructor(
    private readonly ci:        CompetitorIntelligenceService,
    private readonly trends:    TrendPredictorService,
    private readonly normalizer: PlatformNormalizerService,
    private readonly matcher:    CrossPlatformMatcherService,
  ) {}

  /** Start an aggregation job — ingests all CI results and normalizes them */
  async aggregate(urls?: string[]): Promise<AggregationJob> {
    const id = randomUUID();
    const job: AggregationJob = {
      id, urls: urls ?? [], status: 'pending', progress: 0,
      adsFound: 0, startedAt: new Date(),
    };
    this.jobs.set(id, job);
    this.runAggregation(id).catch(err => {
      const j = this.jobs.get(id);
      if (j) { j.status = 'failed'; }
      this.logger.error(`Aggregation ${id} failed: ${err.message}`);
    });
    return job;
  }

  private async runAggregation(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId)!;
    job.status = 'processing';

    // Pull from all completed CI results
    const ciJobs = this.ci.listJobs().filter(j => j.status === 'complete');
    job.progress = 20;

    for (const ciJob of ciJobs) {
      const result = this.ci.getResult(ciJob.id);
      if (!result) continue;
      for (const ad of result.ads) {
        const platform = this.normalizer.detectPlatform(ad.source);
        const normalized = this.normalizer.normalize(platform, {
          brand:                ad.brand,
          hook:                 ad.hook,
          copy:                 ad.copy,
          cta:                  ad.cta,
          emotionalTrigger:     ad.emotionalTrigger,
          performanceSignal:    ad.performanceSignal,
          landingPageStructure: ad.landingPageStructure,
          sourceUrl:            ad.source,
        });
        this.ads.set(normalized.id, normalized);
      }
    }

    job.adsFound = this.ads.size;
    job.progress = 100;
    job.status   = 'complete';
    job.completedAt = new Date();
    this.logger.log(`Aggregation ${jobId} complete — ${job.adsFound} normalized ads`);
  }

  getAllAds(): NormalizedAd[] {
    return [...this.ads.values()].sort((a, b) => b.estimatedPerformance - a.estimatedPerformance);
  }

  getPlatformAnalysis(): PlatformAnalysis[] {
    const all = this.getAllAds();
    const platforms: AdPlatform[] = ['meta', 'tiktok', 'google', 'youtube', 'web'];

    return platforms.map(platform => {
      const platAds = all.filter(a => a.platform === platform);
      if (!platAds.length) return {
        platform, totalAds: 0, avgPerformance: 0,
        topEmotions: [], topFormats: [], topHooks: [], saturationIndex: 0,
      };

      const avgPerformance = platAds.reduce((s, a) => s + a.estimatedPerformance, 0) / platAds.length;

      // Count emotions
      const emotionCounts: Record<string, number> = {};
      platAds.forEach(a => { emotionCounts[a.emotionalTrigger] = (emotionCounts[a.emotionalTrigger] ?? 0) + 1; });
      const topEmotions = Object.entries(emotionCounts)
        .map(([emotion, count]) => ({ emotion, count }))
        .sort((a, b) => b.count - a.count).slice(0, 5);

      // Count formats
      const formatCounts: Record<string, number> = {};
      platAds.forEach(a => { formatCounts[a.creativeFormat] = (formatCounts[a.creativeFormat] ?? 0) + 1; });
      const topFormats = Object.entries(formatCounts)
        .map(([format, count]) => ({ format, count }))
        .sort((a, b) => b.count - a.count).slice(0, 5);

      const topHooks = platAds
        .sort((a, b) => b.estimatedPerformance - a.estimatedPerformance)
        .slice(0, 5).map(a => a.hook);

      // Saturation: if top 3 emotions account for >80% it's saturated
      const topThreeCount = topEmotions.slice(0, 3).reduce((s, e) => s + e.count, 0);
      const saturationIndex = +Math.min(1, topThreeCount / Math.max(platAds.length, 1)).toFixed(3);

      return { platform, totalAds: platAds.length, avgPerformance: +avgPerformance.toFixed(3), topEmotions, topFormats, topHooks, saturationIndex };
    }).filter(p => p.totalAds > 0);
  }

  getUnifiedInsights(): UnifiedInsight {
    const all     = this.getAllAds();
    const matches = this.matcher.findMatches(all);
    const globalScore = this.matcher.computeGlobalScore(all);
    const analysis  = this.getPlatformAnalysis();

    const topUniversalHooks = matches
      .filter(m => m.platforms.length >= 2)
      .slice(0, 8)
      .map(m => m.hookPattern);

    const platformLeaders = analysis.map(pa => ({
      platform: pa.platform,
      bestHook: pa.topHooks[0] ?? '',
      avgScore: pa.avgPerformance,
    })).sort((a, b) => b.avgScore - a.avgScore);

    const recommendedPlatforms = analysis
      .filter(pa => pa.saturationIndex < 0.6)
      .map(pa => ({
        platform: pa.platform,
        reason:   `Low saturation (${(pa.saturationIndex * 100).toFixed(0)}%) — room for new creatives`,
      }));

    return {
      topUniversalHooks,
      crossPlatformPatterns: matches.slice(0, 10),
      platformLeaders,
      globalPerformanceScore: globalScore,
      recommendedPlatforms,
    };
  }

  generateMultiPlatformAd(hook: string, emotionalTrigger: string, brand: string): Record<AdPlatform, string> {
    const hooks: Record<AdPlatform, string> = {
      meta:    `🔥 ${hook} — See how ${brand} is changing everything.`,
      tiktok:  `POV: You just discovered ${hook.toLowerCase()} 👀 #${brand.replace(/\s/g, '')}`,
      google:  `${hook} | ${brand} — Get Started Free`,
      youtube: `${hook}... but here's what no one tells you about ${brand}.`,
      web:     hook,
    };
    return hooks;
  }

  getJobs(): AggregationJob[] {
    return [...this.jobs.values()].sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
  }
}
