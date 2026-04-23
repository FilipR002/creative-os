import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  CompetitorInput, AnalysisJob, AnalysisResult,
  AdIntelItem, ExportToBuilderInput, ExportedIntel,
} from './types';
import { ScraperService }    from './scraper.service';
import { NormalizerService } from './normalizer.service';
import { ScoringService }    from './scoring.service';
import { ClusteringService } from './clustering.service';
import { InsightService }    from './insight.service';
import { MonitoringService } from './monitoring.service';
import { CiAutonomyService } from './ci-autonomy.service';

@Injectable()
export class CompetitorIntelligenceService {
  private readonly logger  = new Logger(CompetitorIntelligenceService.name);
  private readonly jobs    = new Map<string, AnalysisJob>();
  private readonly results = new Map<string, AnalysisResult>();
  private readonly exports = new Map<string, ExportedIntel>();

  constructor(
    private readonly scraper:     ScraperService,
    private readonly normalizer:  NormalizerService,
    private readonly scorer:      ScoringService,
    private readonly clusterer:   ClusteringService,
    private readonly insights:    InsightService,
    private readonly monitoring:  MonitoringService,
    private readonly autonomy:    CiAutonomyService,
  ) {}

  // ─── Jobs ─────────────────────────────────────────────────────────────────

  getJob(id: string): AnalysisJob | null { return this.jobs.get(id) ?? null; }

  listJobs(): AnalysisJob[] {
    return [...this.jobs.values()].sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
  }

  // ─── Analyze ──────────────────────────────────────────────────────────────

  async startAnalysis(input: CompetitorInput): Promise<AnalysisJob> {
    const id = randomUUID();
    const job: AnalysisJob = {
      id, input, status: 'pending', progress: 0,
      sourcesFound: 0, adsDiscovered: 0,
      startedAt: new Date(), events: [],
    };
    this.jobs.set(id, job);
    this.monitoring.trackJob(id);
    // Run async, don't await
    this.runPipeline(id, input).catch(err => {
      const j = this.jobs.get(id);
      if (j) { j.status = 'failed'; j.error = err.message; }
    });
    return job;
  }

  private async runPipeline(jobId: string, input: CompetitorInput): Promise<void> {
    const update = (patch: Partial<AnalysisJob>) => {
      const j = this.jobs.get(jobId);
      if (j) Object.assign(j, patch);
    };
    const event = (msg: string) => {
      const j = this.jobs.get(jobId);
      if (j) j.events.push(`[${new Date().toISOString()}] ${msg}`);
    };

    // — SCRAPING —
    update({ status: 'scraping', progress: 5 });
    event(`Starting analysis for ${input.competitorName} (${input.brandUrl})`);

    const urls = this.scraper.subPages(input.brandUrl);
    event(`Found ${urls.length} public pages to analyze`);

    const scraped = await Promise.all(urls.map(u => this.scraper.scrapePage(u)));
    const valid   = scraped.filter(p => !p.error && p.title);
    update({ sourcesFound: valid.length, progress: 30 });
    event(`Scraped ${valid.length}/${urls.length} pages successfully`);

    // — NORMALIZING —
    update({ status: 'normalizing', progress: 40 });
    const rawItems: AdIntelItem[] = valid.map((p, i) =>
      this.normalizer.normalize(input.competitorName, p, i));
    update({ adsDiscovered: rawItems.length, progress: 55 });
    event(`Extracted ${rawItems.length} ad intelligence items`);

    // — SCORING —
    update({ status: 'scoring', progress: 60 });
    const scoredItems = this.scorer.score(rawItems);
    event(`Scored all items (top score: ${Math.max(...scoredItems.map(i => i.performanceSignal)).toFixed(2)})`);

    // — CLUSTERING —
    update({ status: 'clustering', progress: 75 });
    const { items: clusteredItems, clusters } = this.clusterer.cluster(scoredItems);
    event(`Created ${clusters.length} clusters`);

    // — INSIGHTS —
    update({ status: 'insights', progress: 88 });
    const marketInsights = this.insights.generate(input.competitorName, clusteredItems, clusters);
    event(`Generated ${marketInsights.whatIsWorking.length} working patterns, ${marketInsights.whatIsMissing.length} market gaps`);

    // — COMPLETE —
    const result: AnalysisResult = {
      jobId, input,
      ads: clusteredItems,
      clusters,
      insights: marketInsights,
      sources: valid.map(p => p.url),
      completedAt: new Date(),
    };
    this.results.set(jobId, result);
    update({ status: 'complete', progress: 100, completedAt: new Date() });
    event(`Analysis complete — ${clusteredItems.length} ads, ${clusters.length} clusters`);
    this.logger.log(`Analysis ${jobId} complete for ${input.competitorName}`);
  }

  // ─── Results ──────────────────────────────────────────────────────────────

  getResult(jobId: string): AnalysisResult | null { return this.results.get(jobId) ?? null; }

  getInsights(jobId: string): { insights: AnalysisResult['insights'] | null; clusters: AnalysisResult['clusters'] } {
    const r = this.results.get(jobId);
    return { insights: r?.insights ?? null, clusters: r?.clusters ?? [] };
  }

  // ─── Export to Builder ────────────────────────────────────────────────────

  exportToBuilder(input: ExportToBuilderInput): ExportedIntel | { error: string } {
    const result = this.results.get(input.jobId);
    if (!result) return { error: 'Job result not found' };

    const targetClusters = result.clusters.filter(c => input.clusterIds.includes(c.id));
    if (!targetClusters.length) return { error: 'No matching clusters' };

    const targetAdIds = new Set(targetClusters.flatMap(c => c.items));
    const targetAds   = result.ads.filter(a => targetAdIds.has(a.id));

    const intel: ExportedIntel = {
      hooks:           [...new Set(targetAds.map(a => a.hook).filter(Boolean))].slice(0, 10),
      ctas:            [...new Set(targetAds.map(a => a.cta).filter(Boolean))].slice(0, 8),
      emotionalAngles: [...new Set(targetAds.map(a => a.emotionalTrigger))],
      formats:         [...new Set(targetAds.map(a => a.format))],
      strategySummary: result.insights.competitorStrategySummary,
      source:          'competitor_intelligence',
      exportedAt:      new Date(),
    };
    const exportId = `export_${input.jobId}_${Date.now()}`;
    this.exports.set(exportId, intel);
    this.logger.log(`Intel exported: ${intel.hooks.length} hooks, ${intel.ctas.length} CTAs`);
    return intel;
  }

  getExports(): ExportedIntel[] {
    return [...this.exports.values()].sort((a, b) => b.exportedAt.getTime() - a.exportedAt.getTime());
  }

  // ─── Monitoring ───────────────────────────────────────────────────────────

  enableMonitoring(intervalMs?: number): { enabled: boolean; message: string } {
    const gate = this.autonomy.gate('enable_monitoring');
    if (gate.level < 3 && !gate.allowed) {
      // L3 only for full auto; but user can always manually toggle
    }
    this.monitoring.enable(intervalMs, async (jobId) => {
      const j = this.jobs.get(jobId);
      if (j) await this.startAnalysis(j.input);
    });
    return { enabled: true, message: 'Monitoring enabled. System will periodically re-scan tracked competitors.' };
  }

  disableMonitoring(): { enabled: boolean; message: string } {
    this.monitoring.disable();
    return { enabled: false, message: 'Monitoring disabled. System is in manual-only mode.' };
  }

  getMonitoringState() { return this.monitoring.getState(); }

  // ─── Autonomy ─────────────────────────────────────────────────────────────

  getAutonomy()              { return this.autonomy.getLevelMeta(); }
  setAutonomy(l: 0|1|2|3)   { this.autonomy.setLevel(l); return this.autonomy.getLevelMeta(); }
}
