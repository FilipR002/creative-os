// ─── Phase 5.6 — TTL-aware generic execution cache ───────────────────────────

import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
}                         from '@nestjs/common';
import { createHash }     from 'crypto';
import { CacheEntry, FingerprintInput } from './cost.types';

/** Hot cache TTL — identical request in the same session window. */
export const HOT_TTL_MS    = 15 * 60 * 1000;   // 15 min

/** Stable cache TTL — same creative context with stable memory. */
export const STABLE_TTL_MS = 6 * 60 * 60 * 1000; // 6 h

/** Maximum live entries before FIFO eviction kicks in (memory ceiling). */
const MAX_SIZE = 10_000;

/** Periodic expired-entry sweep interval. */
const EVICTION_INTERVAL_MS = 60_000; // 1 min

@Injectable()
export class ExecutionCacheService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(ExecutionCacheService.name);
  private readonly store  = new Map<string, CacheEntry<unknown>>();
  private evictionTimer?: ReturnType<typeof setInterval>;

  // ── Lifecycle ────────────────────────────────────────────────────────────────

  onApplicationBootstrap(): void {
    this.evictionTimer = setInterval(() => this.evict(), EVICTION_INTERVAL_MS);
  }

  onApplicationShutdown(): void {
    if (this.evictionTimer) clearInterval(this.evictionTimer);
  }

  // ── Fingerprint ─────────────────────────────────────────────────────────────
  // Note: trendState and memorySnapshotVersion are added by CostOptimizerService
  // before calling this method — callers never supply them directly.

  buildFingerprintFromResolved(input: FingerprintInput & {
    trendVersion:  string;
    memoryVersion: string;
  }): string {
    const payload = JSON.stringify({
      c:   input.clientId,
      co:  input.conceptId  ?? '',
      g:   input.goal,
      a:   [...input.angles].sort(),
      r:   input.routingDecision,
      tv:  input.trendVersion,
      mv:  input.memoryVersion,
    });
    return createHash('sha256').update(payload).digest('hex').slice(0, 32);
  }

  // ── Generic get / set ────────────────────────────────────────────────────────

  get<T>(key: string): T | null {
    if (!key || typeof key !== 'string') return null;   // defensive guard

    const entry = this.store.get(key) as CacheEntry<T> | undefined;
    if (!entry)                       return null;
    if (Date.now() > entry.expiresAt) { this.store.delete(key); return null; }
    entry.hitCount++;
    return entry.value;
  }

  set<T>(key: string, value: T, ttlMs: number = HOT_TTL_MS): void {
    if (!key || typeof key !== 'string') return;

    // Size cap — evict oldest entry (Map preserves insertion order) before adding.
    if (this.store.size >= MAX_SIZE) {
      const oldest = this.store.keys().next().value;
      if (oldest) {
        this.store.delete(oldest);
        this.logger.debug(`Cache size cap reached — evicted oldest entry "${oldest}"`);
      }
    }

    this.store.set(key, { value, expiresAt: Date.now() + ttlMs, hitCount: 0 });
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  // ── Eviction ─────────────────────────────────────────────────────────────────

  /** Remove all expired entries. Called automatically every 60 s. */
  evict(): number {
    let evicted = 0;
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now > entry.expiresAt) { this.store.delete(key); evicted++; }
    }
    if (evicted > 0) this.logger.debug(`Auto-evicted ${evicted} expired cache entries`);
    return evicted;
  }

  stats(): { size: number; totalHits: number } {
    let totalHits = 0;
    for (const entry of this.store.values()) totalHits += entry.hitCount;
    return { size: this.store.size, totalHits };
  }
}
