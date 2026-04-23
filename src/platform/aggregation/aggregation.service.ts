import { Injectable, Logger } from '@nestjs/common';
import { PrismaService }      from '../../prisma/prisma.service';
import {
  AggregatedSignal,
  AggregationResult,
  InsufficientCohort,
  MIN_COHORT_SIZE,
} from './aggregated-signal.interface';

@Injectable()
export class AggregationService {
  private readonly logger = new Logger(AggregationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Return industry-level percentile for a given angle.
   * Reads ONLY aggregated stats (AngleStats) — never raw CreativeMemory rows.
   * Returns InsufficientCohort when sample is too small to protect client privacy.
   */
  async getAnglePercentile(industry: string, angleSlug: string): Promise<AggregationResult> {
    try {
      // AngleStats is pre-aggregated — no raw per-client row exposure.
      const stats = await this.prisma.angleStats.findMany({
        where: { angle: { slug: angleSlug } },
        select: { uses: true, wins: true, avgCtr: true, avgConversion: true, weight: true },
      });

      if (stats.length < MIN_COHORT_SIZE) {
        return {
          industry,
          angle:       angleSlug,
          reason:      'INSUFFICIENT_COHORT',
          minRequired: MIN_COHORT_SIZE,
        } satisfies InsufficientCohort;
      }

      const scores = stats.map(s => {
        const winRate = s.uses > 0 ? s.wins / s.uses : 0;
        return winRate * 0.40 + s.avgCtr * 0.30 + s.avgConversion * 0.30;
      });

      scores.sort((a, b) => a - b);
      const avg    = scores.reduce((s, v) => s + v, 0) / scores.length;
      const median = scores[Math.floor(scores.length / 2)] ?? avg;

      // Percentile rank of the median within the distribution
      const below        = scores.filter(s => s <= median).length;
      const percentile   = Math.round((below / scores.length) * 100);

      return {
        industry,
        angle:                 angleSlug,
        percentileScore:       percentile,
        normalizedPerformance: Math.round(avg * 1000) / 1000,
        sampleSize:            stats.length,
      } satisfies AggregatedSignal;
    } catch (err) {
      this.logger.warn(`getAnglePercentile(${industry}, ${angleSlug}): ${(err as Error).message}`);
      return { industry, angle: angleSlug, reason: 'INSUFFICIENT_COHORT', minRequired: MIN_COHORT_SIZE };
    }
  }

  /**
   * Batch version — returns only sufficient cohorts, silently drops the rest.
   */
  async getBatchPercentiles(
    industry:   string,
    angleSlugs: string[],
  ): Promise<AggregatedSignal[]> {
    const results = await Promise.all(
      angleSlugs.map(slug => this.getAnglePercentile(industry, slug)),
    );
    return results.filter(
      (r): r is AggregatedSignal => !('reason' in r),
    );
  }
}
