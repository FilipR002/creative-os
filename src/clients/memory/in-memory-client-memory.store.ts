import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { ClientContext }         from '../../platform/context/client-context.interface';
import { assertClientScope }     from '../../common/guards/client-scope';
import {
  ClientMemoryStore,
  ClientMemoryFilter,
} from './client-memory-store.interface';

// ── Memory safety constants ───────────────────────────────────────────────────

/** Maximum entries per client bucket before FIFO eviction kicks in. */
const MAX_KEYS_PER_CLIENT = 1_000;

/** TTL for each entry — entries older than 24 h are pruned by cleanup(). */
const ENTRY_TTL_MS = 24 * 60 * 60 * 1_000;

interface Entry {
  value:     unknown;
  createdAt: number;
}

/** Cleanup runs every hour — prunes entries older than ENTRY_TTL_MS. */
const CLEANUP_INTERVAL_MS = 60 * 60 * 1_000;

@Injectable()
export class InMemoryClientMemoryStore
  implements ClientMemoryStore, OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger  = new Logger(InMemoryClientMemoryStore.name);
  // Outer key = clientId; inner key = full namespaced memory key.
  // Clients are never iterated together — O(1) per-client bucket access.
  private readonly store   = new Map<string, Map<string, Entry>>();
  private cleanupTimer?: ReturnType<typeof setInterval>;

  onApplicationBootstrap(): void {
    this.cleanupTimer = setInterval(() => {
      const evicted = this.cleanup();
      if (evicted > 0) this.logger.debug(`[ClientMemory] Pruned ${evicted} expired entries`);
    }, CLEANUP_INTERVAL_MS);
  }

  onApplicationShutdown(): void {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
  }

  private bucket(ctx: ClientContext): Map<string, Entry> {
    // Hard scope enforcement — every memory operation MUST have a valid clientId.
    assertClientScope(ctx.clientId);

    let b = this.store.get(ctx.clientId);
    if (!b) {
      b = new Map();
      this.store.set(ctx.clientId, b);
    }
    return b;
  }

  async get(ctx: ClientContext, key: string): Promise<unknown | null> {
    const entry = this.bucket(ctx).get(key);
    return entry ? entry.value : null;
  }

  async set(ctx: ClientContext, key: string, value: unknown): Promise<void> {
    const b = this.bucket(ctx);

    // FIFO eviction: remove the oldest insertion when cap is reached and
    // the key is not already present (update in-place never evicts).
    if (!b.has(key) && b.size >= MAX_KEYS_PER_CLIENT) {
      const oldest = b.keys().next().value;
      if (oldest !== undefined) b.delete(oldest);
    }

    b.set(key, { value, createdAt: Date.now() });
  }

  async increment(ctx: ClientContext, key: string, delta: number): Promise<void> {
    const b       = this.bucket(ctx);
    const current = b.get(key);
    const prev    = typeof current?.value === 'number' && isFinite(current.value)
      ? current.value
      : 0;

    // increment re-uses set() so eviction path runs when key is new
    await this.set(ctx, key, prev + delta);
  }

  async query(ctx: ClientContext, filter: ClientMemoryFilter): Promise<unknown[]> {
    const b       = this.bucket(ctx);
    const results: unknown[] = [];

    for (const [key, entry] of b) {
      if (filter.type || filter.slug) {
        // Key format: memory:{clientId}:{type}:{...slug}
        const parts = key.split(':');        // ['memory', clientId, type, ...slug_parts]
        if (filter.type && parts[2] !== filter.type) continue;
        if (filter.slug && parts.slice(3).join(':') !== filter.slug) continue;
      }
      results.push(entry.value);
      if (filter.limit && results.length >= filter.limit) break;
    }

    return results;
  }

  /**
   * Prune entries older than ENTRY_TTL_MS across all client buckets.
   * Call periodically (e.g. every hour via setInterval in the module).
   * Returns the total number of entries evicted.
   */
  cleanup(): number {
    const cutoff = Date.now() - ENTRY_TTL_MS;
    let evicted  = 0;

    for (const [clientId, bucket] of this.store) {
      for (const [key, entry] of bucket) {
        if (entry.createdAt < cutoff) {
          bucket.delete(key);
          evicted++;
        }
      }
      // Remove empty client buckets to free the outer Map slot.
      if (bucket.size === 0) this.store.delete(clientId);
    }

    return evicted;
  }

  /** Stats helper — useful for health-check endpoints. */
  stats(): { clients: number; totalEntries: number } {
    let totalEntries = 0;
    for (const b of this.store.values()) totalEntries += b.size;
    return { clients: this.store.size, totalEntries };
  }
}
