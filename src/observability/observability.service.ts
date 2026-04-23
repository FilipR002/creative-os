import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { randomUUID }     from 'crypto';
import Redis              from 'ioredis';
import { REDIS_CLIENT }   from '../redis/redis.module';
import { BuiltTrace, StoredTrace } from './models/decision-trace-builder';
import { isClientScoped } from '../common/guards/client-scope';

// Redis is a hot buffer only. Long-term trace export must be handled via a DB
// pipeline in Phase 5 — do not treat Redis TTL as durable storage.
const REDIS_TRACE_NOTE = 'hot-buffer-only';

const TRACE_TTL       = 60 * 60 * 24 * 30;   // 30 days
const KEY_TRACE       = (id: string)       => `obs:trace:${id}`;
const KEY_BY_CAMPAIGN = (id: string)       => `obs:by-campaign:${id}`;
const KEY_BY_USER     = (id: string)       => `obs:by-user:${id}`;
// Phase 5.7 — client-scoped index for per-tenant trace queries
const KEY_BY_CLIENT   = (clientId: string) => `obs:by-client:${clientId}`;

@Injectable()
export class ObservabilityService {
  private readonly logger = new Logger(ObservabilityService.name);

  constructor(
    @Optional() @Inject(REDIS_CLIENT) private readonly redis: Redis | null,
  ) {}

  // ── Write ──────────────────────────────────────────────────────────────────

  async createTrace(input: BuiltTrace): Promise<string> {
    // Phase 5.7 — every trace MUST be client-scoped in SaaS context.
    // Traces without a clientId are logged as a scope violation and skipped.
    // This is fire-and-forget so the caller's response is never affected.
    if (!isClientScoped(input.clientId)) {
      this.logger.warn('[OBSERVABILITY] TRACE_MISSING_CLIENT_SCOPE — trace dropped (no clientId)');
      throw new Error('TRACE_MISSING_CLIENT_SCOPE');
    }

    const traceId: string = randomUUID();
    const stored: StoredTrace = { traceId, ...input };

    if (!this.redis) return traceId;

    const score = Date.now();
    const json  = JSON.stringify({ ...stored, _buffer: REDIS_TRACE_NOTE });

    // Primary trace storage — canonical key by UUID
    try {
      await this.redis.set(KEY_TRACE(traceId), json, 'EX', TRACE_TTL);
    } catch (err) {
      this.logger.error(`[OBSERVABILITY ERROR] trace SET failed: ${(err as Error).message}`);
    }

    // Phase 5.7 — per-client index (enables tenant-scoped trace queries)
    try {
      await this.redis.zadd(KEY_BY_CLIENT(input.clientId), score, traceId);
      await this.redis.expire(KEY_BY_CLIENT(input.clientId), TRACE_TTL);
    } catch (err) {
      this.logger.error(`[OBSERVABILITY ERROR] client index failed: ${(err as Error).message}`);
    }

    if (input.campaignId) {
      try {
        await this.redis.zadd(KEY_BY_CAMPAIGN(input.campaignId), score, traceId);
        await this.redis.expire(KEY_BY_CAMPAIGN(input.campaignId), TRACE_TTL);
      } catch (err) {
        this.logger.error(`[OBSERVABILITY ERROR] campaign index failed: ${(err as Error).message}`);
      }
    }

    if (input.userId) {
      try {
        await this.redis.zadd(KEY_BY_USER(input.userId), score, traceId);
        await this.redis.expire(KEY_BY_USER(input.userId), TRACE_TTL);
      } catch (err) {
        this.logger.error(`[OBSERVABILITY ERROR] user index failed: ${(err as Error).message}`);
      }
    }

    return traceId;
  }

  // ── Read ───────────────────────────────────────────────────────────────────

  async getTrace(traceId: string): Promise<StoredTrace | null> {
    if (!this.redis) return null;
    try {
      const raw = await this.redis.get(KEY_TRACE(traceId));
      if (!raw) return null;
      try { return JSON.parse(raw) as StoredTrace; } catch { return null; }
    } catch {
      return null;
    }
  }

  async getTracesByCreative(campaignId: string, limit = 20): Promise<StoredTrace[]> {
    return this.getIndexedTraces(KEY_BY_CAMPAIGN(campaignId), limit);
  }

  async getTracesByUser(userId: string, limit = 20): Promise<StoredTrace[]> {
    return this.getIndexedTraces(KEY_BY_USER(userId), limit);
  }

  /** Phase 5.7 — tenant-scoped trace queries. */
  async getTracesByClient(clientId: string, limit = 20): Promise<StoredTrace[]> {
    return this.getIndexedTraces(KEY_BY_CLIENT(clientId), limit);
  }

  // ── Internal ───────────────────────────────────────────────────────────────

  private async getIndexedTraces(indexKey: string, limit: number): Promise<StoredTrace[]> {
    if (!this.redis) return [];
    try {
      const ids = await this.redis.zrevrange(indexKey, 0, limit - 1);
      if (!ids.length) return [];

      const raws = await Promise.all(ids.map(id => this.redis!.get(KEY_TRACE(id))));
      return raws
        .filter((r): r is string => r !== null)
        .map(r => { try { return JSON.parse(r) as StoredTrace; } catch { return null; } })
        .filter((t): t is StoredTrace => t !== null);
    } catch {
      return [];
    }
  }
}
