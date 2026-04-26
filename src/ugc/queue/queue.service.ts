/**
 * queue.service.ts
 *
 * UGC Redis Queue — job dispatch and state management.
 *
 * Pattern: Redis LIST (LPUSH / BRPOP)
 *   - Enqueue: LPUSH ugc:queue:pending <JSON payload>
 *   - Dequeue: RPOP ugc:queue:pending (non-blocking; processor uses interval)
 *   - State:   HSET ugc:job:<jobId> <fields…>
 *
 * Job records are stored as Redis hashes with a 7-day TTL.
 */

import { Injectable, Logger, Inject } from '@nestjs/common';
import type Redis                      from 'ioredis';
import { randomUUID }                  from 'crypto';

import { REDIS_CLIENT }                from '../../redis/redis.module';
import type { UGCVariant }             from '../types/ugc.types';
import type { KlingCompilerOutput }    from '../types/ugc.types';
import {
  UGC_QUEUE_KEY,
  ugcJobKey,
  type UGCJobPayload,
  type UGCJobRecord,
  type UGCJobState,
} from './job.types';

// ─── TTL ──────────────────────────────────────────────────────────────────────

const JOB_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class UGCQueueService {
  private readonly logger = new Logger(UGCQueueService.name);

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  // ─── Enqueue ──────────────────────────────────────────────────────────────

  /**
   * Enqueue a compiled UGC variant for rendering.
   * Returns the jobId so callers can track status.
   */
  async enqueue(opts: {
    campaignId:      string;
    conceptId?:      string;
    platform:        string;
    durationSeconds: number;
    variant:         UGCVariant;
    compiledPlan:    KlingCompilerOutput;
    // Phase 1.1 viral test fields
    testId?:         string;
    variantId?:      string;
    hookId?:         string;
    // FIX 6: Full variant data for non-lossy winner reconstruction
    emotionalStrategy?: string;
    ugcScoreEstimate?:  number;
  }): Promise<string> {
    const jobId      = randomUUID();
    const enqueuedAt = new Date().toISOString();

    const payload: UGCJobPayload = {
      jobId,
      campaignId:      opts.campaignId,
      conceptId:       opts.conceptId,
      platform:        opts.platform,
      durationSeconds: opts.durationSeconds,
      variant:         opts.variant,
      compiledPlan:    opts.compiledPlan,
      enqueuedAt,
      testId:          opts.testId,
      variantId:       opts.variantId,
      hookId:          opts.hookId as any,
    };

    // FIX 6: Write initial job record with full variant data (no lossy reconstruction)
    await this.setJobRecord({
      jobId,
      campaignId:        opts.campaignId,
      conceptId:         opts.conceptId,
      platform:          opts.platform,
      state:             'queued',
      persona:           opts.variant.persona,
      hook:              opts.variant.hook,
      fullScript:        opts.variant.script,
      emotionalStrategy: opts.emotionalStrategy ?? opts.variant.hookStrategy ?? '',
      ugcScoreEstimate:  opts.ugcScoreEstimate  ?? opts.variant.conversionStrength ?? 0,
      enqueuedAt,
      testId:            opts.testId,
      variantId:         opts.variantId,
      hookId:            opts.hookId,
    });

    // Push payload to queue
    await this.redis.lpush(UGC_QUEUE_KEY, JSON.stringify(payload));

    this.logger.log(
      `[UGCQueue] Enqueued jobId=${jobId} persona=${opts.variant.persona}` +
      (opts.variantId ? ` variantId=${opts.variantId}` : ''),
    );
    return jobId;
  }

  // ─── Dequeue ──────────────────────────────────────────────────────────────

  /**
   * Non-blocking pop — returns the next job payload or null if queue is empty.
   */
  async dequeue(): Promise<UGCJobPayload | null> {
    const raw = await this.redis.rpop(UGC_QUEUE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as UGCJobPayload;
    } catch (err) {
      this.logger.error(`[UGCQueue] Failed to parse job payload: ${err}`);
      return null;
    }
  }

  // ─── State management ─────────────────────────────────────────────────────

  async markProcessing(jobId: string): Promise<void> {
    await this.patchJobRecord(jobId, {
      state:     'processing',
      startedAt: new Date().toISOString(),
    });
  }

  async markDone(jobId: string, opts: {
    stitchedVideoUrl: string;
    sceneVideoUrls:   string[];
    score?:           number;
  }): Promise<void> {
    await this.patchJobRecord(jobId, {
      state:            'done',
      stitchedVideoUrl: opts.stitchedVideoUrl,
      sceneVideoUrls:   opts.sceneVideoUrls,
      score:            opts.score,
      completedAt:      new Date().toISOString(),
    });
  }

  async markFailed(jobId: string, error: string): Promise<void> {
    await this.patchJobRecord(jobId, {
      state:       'failed',
      error,
      completedAt: new Date().toISOString(),
    });
  }

  // ─── Retry ────────────────────────────────────────────────────────────────

  /**
   * Fix 5: Re-enqueue a failed job with incremented retryCount.
   * The processor calls this instead of markFailed when retryCount < MAX_RETRIES.
   * The job record is reset to 'queued' and the full payload is pushed back onto
   * the queue with an incremented retry counter.
   */
  async requeue(job: UGCJobPayload, error: string): Promise<void> {
    const retryCount = (job.retryCount ?? 0) + 1;
    const requeuedPayload: UGCJobPayload = { ...job, retryCount };

    // Reset state to queued on the existing record so status polling shows it's retrying
    await this.patchJobRecord(job.jobId, {
      state: 'queued',
      error: `[retry ${retryCount}] ${error}`,
    });

    // Push back onto queue
    await this.redis.lpush(UGC_QUEUE_KEY, JSON.stringify(requeuedPayload));

    this.logger.log(
      `[UGCQueue] Requeued jobId=${job.jobId} retryCount=${retryCount} reason="${error.slice(0, 80)}"`,
    );
  }

  // ─── Status read ──────────────────────────────────────────────────────────

  async getJob(jobId: string): Promise<UGCJobRecord | null> {
    const data = await this.redis.hgetall(ugcJobKey(jobId));
    if (!data || !data['jobId']) return null;

    return {
      jobId:             data['jobId'],
      campaignId:        data['campaignId'],
      conceptId:         data['conceptId'] || undefined,
      platform:          data['platform'],
      state:             data['state'] as UGCJobState,
      persona:           data['persona'],
      hook:              data['hook'],
      // FIX 6: Full variant data returned — no reconstruction needed
      fullScript:        data['fullScript']        || undefined,
      emotionalStrategy: data['emotionalStrategy'] || undefined,
      ugcScoreEstimate:  data['ugcScoreEstimate']  ? Number(data['ugcScoreEstimate']) : undefined,
      stitchedVideoUrl:  data['stitchedVideoUrl'] || undefined,
      sceneVideoUrls:    data['sceneVideoUrls']
        ? JSON.parse(data['sceneVideoUrls'])
        : undefined,
      score:             data['score'] ? Number(data['score']) : undefined,
      error:             data['error'] || undefined,
      enqueuedAt:        data['enqueuedAt'],
      startedAt:         data['startedAt'] || undefined,
      completedAt:       data['completedAt'] || undefined,
      testId:            data['testId'] || undefined,
      variantId:         data['variantId'] || undefined,
      hookId:            data['hookId'] || undefined,
    };
  }

  async getQueueDepth(): Promise<number> {
    return this.redis.llen(UGC_QUEUE_KEY);
  }

  // ─── Test-scoped lookups (Phase 1.1) ────────────────────────────────────

  /** Store a mapping from testId → [jobId, …] for fast test-scoped queries. */
  async registerTestJob(testId: string, jobId: string): Promise<void> {
    const key = `ugc:test:${testId}:jobs`;
    await this.redis.lpush(key, jobId);
    await this.redis.expire(key, JOB_TTL_SECONDS);
  }

  /** Return all job IDs registered under a test. */
  async getTestJobIds(testId: string): Promise<string[]> {
    return this.redis.lrange(`ugc:test:${testId}:jobs`, 0, -1);
  }

  /** Return all job records for a test (resolved from jobIds). */
  async getTestJobs(testId: string): Promise<UGCJobRecord[]> {
    const ids     = await this.getTestJobIds(testId);
    const records = await Promise.all(ids.map(id => this.getJob(id)));
    return records.filter((r): r is UGCJobRecord => r !== null);
  }

  // ─── Internal helpers ─────────────────────────────────────────────────────

  private async setJobRecord(record: Omit<UGCJobRecord, 'stitchedVideoUrl' | 'sceneVideoUrls' | 'score' | 'error' | 'startedAt' | 'completedAt'> & { testId?: string; variantId?: string; hookId?: string; fullScript?: string; emotionalStrategy?: string; ugcScoreEstimate?: number }): Promise<void> {
    const key    = ugcJobKey(record.jobId);
    const fields = this.flattenRecord(record);
    await this.redis.hset(key, fields);
    await this.redis.expire(key, JOB_TTL_SECONDS);
  }

  private async patchJobRecord(jobId: string, patch: Partial<UGCJobRecord> & { sceneVideoUrls?: string[] }): Promise<void> {
    const key = ugcJobKey(jobId);
    const { sceneVideoUrls, ...rest } = patch;
    const fields = this.flattenRecord(rest);
    if (sceneVideoUrls !== undefined) {
      fields['sceneVideoUrls'] = JSON.stringify(sceneVideoUrls);
    }
    if (Object.keys(fields).length > 0) {
      await this.redis.hset(key, fields);
    }
  }

  private flattenRecord(obj: Record<string, unknown>): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v !== undefined && v !== null) {
        out[k] = typeof v === 'object' ? JSON.stringify(v) : String(v);
      }
    }
    return out;
  }
}
