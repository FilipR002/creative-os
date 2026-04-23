// ─── Phase 5.6 — in-flight deduplication (coalesce identical concurrent calls) ─

import { Injectable, Logger } from '@nestjs/common';

type Resolver<T> = (value: T) => void;
type Rejecter    = (reason: unknown) => void;

@Injectable()
export class ComputeDeduplicatorService {
  private readonly logger  = new Logger(ComputeDeduplicatorService.name);
  private readonly inflight = new Map<string, Array<{ resolve: Resolver<unknown>; reject: Rejecter }>>();

  /**
   * Execute `fn()` at most once per `key` for concurrent callers.
   *
   * If a call for `key` is already in-flight when a second arrives,
   * the second caller awaits the same promise instead of launching a new computation.
   * This prevents N identical MIROFISH / fatigue calls during a traffic spike.
   */
  async deduplicate<T>(key: string, fn: () => Promise<T>): Promise<T> {
    if (this.inflight.has(key)) {
      this.logger.debug(`Dedup hit: "${key}" — coalescing with in-flight call`);
      return new Promise<T>((resolve, reject) => {
        this.inflight.get(key)!.push({ resolve: resolve as Resolver<unknown>, reject });
      });
    }

    this.inflight.set(key, []);

    try {
      const result = await fn();
      // Resolve all waiting callers
      for (const { resolve } of this.inflight.get(key) ?? []) resolve(result);
      return result;
    } catch (err) {
      for (const { reject } of this.inflight.get(key) ?? []) reject(err);
      throw err;
    } finally {
      this.inflight.delete(key);
    }
  }

  /** Key helper: stable hash for angle + context combination. */
  angleContextKey(angleSlug: string, contextHash: string): string {
    return `angle:${angleSlug}:${contextHash}`;
  }

  activeCount(): number {
    return this.inflight.size;
  }
}
