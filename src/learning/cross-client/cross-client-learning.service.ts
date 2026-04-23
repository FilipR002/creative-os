// ─── Phase 5.2 — NestJS service wrapper ──────────────────────────────────────

import { Injectable, Logger }     from '@nestjs/common';
import { createHash }             from 'crypto';
import {
  AnonymousSignal,
  AggregatedPattern,
  GlobalInsights,
}                                 from './cross-client.interfaces';
import {
  CrossClientPatternEngine,
  buildGlobalInsights,
}                                 from './cross-client-pattern.engine';

// Industry-level cache entry with TTL
interface CacheEntry {
  patterns:  AggregatedPattern[];
  builtAt:   number;
}

const CACHE_TTL_MS = 5 * 60 * 1000;   // 5 minutes — eventually consistent

@Injectable()
export class CrossClientLearningService {
  private readonly logger  = new Logger(CrossClientLearningService.name);
  private readonly engine  = new CrossClientPatternEngine();

  // Aggregated results cached per industry key
  private readonly cache   = new Map<string, CacheEntry>();

  // Signal inbox — flushed on each aggregation run
  private pending: AnonymousSignal[] = [];

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Submit signals for async aggregation.
   * Caller MUST hash clientId before calling — never pass raw ids here.
   */
  ingest(signals: AnonymousSignal[]): void {
    this.pending.push(...signals);
    if (this.pending.length >= 100) this.flush();
  }

  /**
   * Hash a raw clientId into a one-way identifier safe for cross-client use.
   * Uses SHA-256; truncated to 16 hex chars for storage efficiency.
   */
  hashClientId(rawClientId: string): string {
    return createHash('sha256').update(rawClientId).digest('hex').slice(0, 16);
  }

  /**
   * Retrieve cached patterns for an industry.
   * Returns empty array when cache is cold or TTL expired.
   */
  getPatternsForIndustry(industry: string): AggregatedPattern[] {
    const entry = this.cache.get(industry);
    if (!entry) return [];
    if (Date.now() - entry.builtAt > CACHE_TTL_MS) {
      this.cache.delete(industry);
      return [];
    }
    return entry.patterns;
  }

  /**
   * Build a GlobalInsights snapshot from all currently cached patterns.
   * Returns empty insight structure when no patterns are available.
   */
  getGlobalInsights(): GlobalInsights {
    const all: AggregatedPattern[] = [];
    for (const entry of this.cache.values()) {
      if (Date.now() - entry.builtAt <= CACHE_TTL_MS) {
        all.push(...entry.patterns);
      }
    }
    return buildGlobalInsights(all);
  }

  /**
   * Small prior boost for orchestrator use.
   * Returns +0.05 if this angle is in the industry's top-3; 0 otherwise.
   * MUST be additive only — never replaces client-scoped signal.
   */
  getAnglePriorBoost(industry: string, angleSlug: string): number {
    const insights = this.getGlobalInsights();
    const top      = insights.topAnglesByIndustry[industry] ?? [];
    return top.includes(angleSlug) ? 0.05 : 0;
  }

  // ── Admin snapshot (anonymized only — no raw client data) ────────────────────

  /**
   * Returns a fully anonymized system-wide snapshot for the admin dashboard.
   * Derives everything from aggregated patterns — no GlobalMemoryService call,
   * no per-client data.
   */
  getAggregatedAdminSnapshot(): {
    angles:                  { slug: string; industry: string; avgCtr: number; avgConversion: number; avgRetention: number; confidence: number; sampleSize: number }[];
    systemHealthScore:       number;
    learningEfficiencyIndex: number;
    driftFlags:              string[];
  } {
    const all      = this.getAllCachedPatterns();
    const insights = buildGlobalInsights(all);

    const angles = [...all]
      .sort((a, b) => b.metrics.avgCTR - a.metrics.avgCTR)
      .slice(0, 50)
      .map(p => ({
        slug:          p.angle,
        industry:      p.industry,
        avgCtr:        p.metrics.avgCTR,
        avgConversion: p.metrics.avgConversion,
        avgRetention:  p.metrics.avgRetention,
        confidence:    p.confidence,
        sampleSize:    p.sampleSize,
      }));

    const systemHealthScore = all.length > 0
      ? Math.round((all.reduce((s, p) => s + p.confidence, 0) / all.length) * 100) / 100
      : 0.5;

    return {
      angles,
      systemHealthScore,
      learningEfficiencyIndex: systemHealthScore,
      driftFlags:              insights.fatiguePronePatterns.slice(0, 10),
    };
  }

  private getAllCachedPatterns(): AggregatedPattern[] {
    const all: AggregatedPattern[] = [];
    const now = Date.now();
    for (const entry of this.cache.values()) {
      if (now - entry.builtAt <= CACHE_TTL_MS) all.push(...entry.patterns);
    }
    return all;
  }

  // ── Aggregation ─────────────────────────────────────────────────────────────

  /** Drain the pending inbox, aggregate, and refresh per-industry cache. */
  flush(): void {
    if (this.pending.length === 0) return;

    const batch   = this.pending.splice(0);
    const all     = this.engine.aggregate(batch);

    const byIndustry = new Map<string, AggregatedPattern[]>();
    for (const p of all) {
      if (!byIndustry.has(p.industry)) byIndustry.set(p.industry, []);
      byIndustry.get(p.industry)!.push(p);
    }

    for (const [industry, patterns] of byIndustry) {
      this.cache.set(industry, { patterns, builtAt: Date.now() });
      this.logger.debug(
        `Cross-client cache refreshed — industry="${industry}" patterns=${patterns.length}`,
      );
    }
  }
}
