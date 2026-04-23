// ─── Phase 5.2 — pure aggregation engine (no NestJS, no I/O) ─────────────────

import {
  AnonymousSignal,
  AggregatedPattern,
  GlobalInsights,
  MIN_COHORT_SIZE,
} from './cross-client.interfaces';

// ── Internal accumulator ──────────────────────────────────────────────────────

interface Bucket {
  ctr:        number[];
  conversion: number[];
  retention:  number[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  const sum = values.reduce((acc, v) => acc + (isFinite(v) ? v : 0), 0);
  return Math.round((sum / values.length) * 10_000) / 10_000;
}

function patternKey(signal: AnonymousSignal): string {
  return `${signal.industry}:${signal.angle}:${signal.format}`;
}

// ── Engine ────────────────────────────────────────────────────────────────────

export class CrossClientPatternEngine {
  /**
   * Aggregate a batch of anonymous signals into industry-level patterns.
   * Patterns below MIN_COHORT_SIZE are dropped — k-anonymity guard.
   */
  aggregate(signals: AnonymousSignal[]): AggregatedPattern[] {
    const buckets = new Map<string, Bucket>();

    for (const s of signals) {
      const key = patternKey(s);
      if (!buckets.has(key)) {
        buckets.set(key, { ctr: [], conversion: [], retention: [] });
      }
      const b = buckets.get(key)!;
      b.ctr.push(s.ctr);
      b.conversion.push(s.conversion);
      b.retention.push(s.retention);
    }

    const patterns: AggregatedPattern[] = [];

    for (const [key, b] of buckets) {
      if (b.ctr.length < MIN_COHORT_SIZE) continue;  // k-anonymity guard

      const [industry, angle, format] = key.split(':');

      patterns.push({
        industry,
        angle,
        format,
        metrics: {
          avgCTR:        avg(b.ctr),
          avgConversion: avg(b.conversion),
          avgRetention:  avg(b.retention),
        },
        sampleSize: b.ctr.length,
        // Confidence grows linearly; saturates at 10× cohort minimum
        confidence: Math.min(1, b.ctr.length / (MIN_COHORT_SIZE * 10)),
      });
    }

    return patterns;
  }
}

// ── Global insight builder ────────────────────────────────────────────────────

export function buildGlobalInsights(patterns: AggregatedPattern[]): GlobalInsights {
  const byIndustry = new Map<string, AggregatedPattern[]>();

  for (const p of patterns) {
    if (!byIndustry.has(p.industry)) byIndustry.set(p.industry, []);
    byIndustry.get(p.industry)!.push(p);
  }

  const topAnglesByIndustry:  Record<string, string[]> = {};
  const topFormatsByIndustry: Record<string, string[]> = {};

  for (const [industry, list] of byIndustry) {
    topAnglesByIndustry[industry] = [...list]
      .sort((a, b) => b.metrics.avgCTR - a.metrics.avgCTR || a.angle.localeCompare(b.angle))
      .slice(0, 3)
      .map(p => p.angle);

    // Deduplicate formats, rank by avg conversion within each format
    const formatMap = new Map<string, number[]>();
    for (const p of list) {
      if (!formatMap.has(p.format)) formatMap.set(p.format, []);
      formatMap.get(p.format)!.push(p.metrics.avgConversion);
    }
    topFormatsByIndustry[industry] = [...formatMap.entries()]
      .map(([fmt, convs]) => ({ fmt, avgConv: avg(convs) }))
      .sort((a, b) => b.avgConv - a.avgConv || a.fmt.localeCompare(b.fmt))
      .slice(0, 3)
      .map(e => e.fmt);
  }

  const fatiguePronePatterns = patterns
    .filter(p => p.metrics.avgRetention < 0.30)
    .map(p => `${p.angle}:${p.format}`);

  const highConversionPatterns = patterns
    .filter(p => p.metrics.avgConversion > 0.70)
    .map(p => `${p.angle}:${p.format}`);

  return {
    topAnglesByIndustry,
    topFormatsByIndustry,
    fatiguePronePatterns,
    highConversionPatterns,
  };
}
