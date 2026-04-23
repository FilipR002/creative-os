import { Injectable, Logger, Optional } from '@nestjs/common';
import { TrendSignal, decayFactor }      from './trend-signal.interface';
import { MemoryEventService }            from '../optimization/cost/memory-event.service';

@Injectable()
export class TrendStore {
  private readonly logger = new Logger(TrendStore.name);
  private readonly trends = new Map<string, TrendSignal>();
  private version = 0;

  constructor(@Optional() private readonly memoryEvent: MemoryEventService) {}

  /** System-generated version token — increments on every add() or remove(). */
  getCurrentVersion(): string {
    return `trend-v${this.version}`;
  }

  add(trend: TrendSignal): void {
    if (!trend.id || !trend.industry || !trend.type || !trend.value) {
      this.logger.warn(`add() rejected malformed trend (id=${trend.id})`);
      return;
    }
    // Last-write-wins for the same id — allows external systems to update a trend
    this.trends.set(trend.id, trend);
    this.version++;
    this.memoryEvent?.notify('TREND_INGEST');
  }

  getAll(): TrendSignal[] {
    return Array.from(this.trends.values());
  }

  getByIndustry(industry: string): TrendSignal[] {
    return this.getAll().filter(t => t.industry === industry);
  }

  /**
   * Top 5 live trends for a type, ranked by decayed composite score.
   * Trends with negligible decay factor (< 0.01) are omitted.
   */
  getTop(type: TrendSignal['type'], industry?: string): TrendSignal[] {
    return this.getAll()
      .filter(t => t.type === type)
      .filter(t => !industry || t.industry === industry)
      .filter(t => decayFactor(t.timestamp) >= 0.01)
      .sort((a, b) => {
        const da = decayFactor(a.timestamp);
        const db = decayFactor(b.timestamp);
        const scoreA = (a.strength + a.velocity) * da;
        const scoreB = (b.strength + b.velocity) * db;
        return scoreB - scoreA || a.id.localeCompare(b.id);
      })
      .slice(0, 5);
  }

  remove(id: string): void {
    this.trends.delete(id);
    this.version++;
    this.memoryEvent?.notify('TREND_INGEST');
  }
}
