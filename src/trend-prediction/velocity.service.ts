import { Injectable } from '@nestjs/common';
import { TrendSignal } from './types';

interface AdSnapshot {
  hook:            string;
  format:          string;
  emotionalTrigger: string;
  performanceSignal: number;
  engagementLikelihood: number;
  noveltyScore:    number;
  repetitionFrequency: number;
  brand:           string;
  source:          string;
  recordedAt:      Date;
}

@Injectable()
export class VelocityService {
  /** Convert raw ad snapshots into velocity-computed TrendSignals */
  computeSignals(snapshots: AdSnapshot[]): TrendSignal[] {
    // Group by emotional trigger + format (pattern key)
    const groups = new Map<string, AdSnapshot[]>();
    for (const snap of snapshots) {
      const key = `${snap.emotionalTrigger}::${snap.format}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(snap);
    }

    const signals: TrendSignal[] = [];
    const now = Date.now();
    const windowMs = 7 * 24 * 60 * 60 * 1000; // 7-day window

    groups.forEach((items, key) => {
      const [emotionalTrigger, format] = key.split('::');
      const sorted = [...items].sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime());
      const firstSeenAt = sorted[0].recordedAt;
      const lastSeenAt  = sorted[sorted.length - 1].recordedAt;

      // "Recent" = items recorded in last window
      const recent = items.filter(i => now - i.recordedAt.getTime() < windowMs);
      const older  = items.filter(i => now - i.recordedAt.getTime() >= windowMs);

      // Velocity: growth rate (how quickly occurrences are increasing)
      const velocity = older.length > 0
        ? Math.min(1, recent.length / Math.max(older.length, 1) - 1)
        : recent.length > 1 ? 0.5 : 0.2;

      const avgScore   = items.reduce((s, i) => s + i.performanceSignal, 0) / items.length;
      const competitors = [...new Set(items.map(i => i.brand))];
      const hooks       = [...new Set(items.map(i => i.hook).filter(h => h.length > 5))].slice(0, 5);

      signals.push({
        pattern:           key,
        emotionalTrigger,
        format,
        occurrences:       items.length,
        recentOccurrences: recent.length,
        velocity:          +Math.max(0, velocity).toFixed(3),
        avgScore:          +avgScore.toFixed(3),
        competitors,
        hooks,
        firstSeenAt,
        lastSeenAt,
      });
    });

    return signals.sort((a, b) => b.velocity - a.velocity);
  }
}
