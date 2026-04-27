/**
 * video-queue.service.ts
 *
 * Wraps the BullMQ Queue for the `video-render` queue.
 *
 * Responsibilities:
 *   - Connect to Redis (REDIS_URL env var, same as existing RedisModule)
 *   - Expose addVideoJob() / getJob() / getJobState()
 *   - Clean up connection on shutdown
 *
 * BullMQ creates its own IORedis connections internally — we do NOT share
 * the global REDIS_CLIENT here because BullMQ uses blocking XREAD/XADD
 * commands that must not be mixed with the rest of the app's Redis usage.
 */

import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService }                                       from '@nestjs/config';
import { Queue, Job }                                          from 'bullmq';
import type { ConnectionOptions }                              from 'bullmq';

import { VIDEO_QUEUE_NAME, VideoJobPayload, VideoJobResult }  from './video-job.types';

// ─── Connection factory ────────────────────────────────────────────────────────

function buildConnection(config: ConfigService): ConnectionOptions {
  const url = config.get<string>('REDIS_URL');
  if (url) {
    // BullMQ accepts a full redis:// URL via the `url` option on the connection
    return { url } as unknown as ConnectionOptions;
  }
  // Fallback: individual host/port env vars (local dev)
  return {
    host: config.get<string>('REDIS_HOST', 'localhost'),
    port: config.get<number>('REDIS_PORT', 6379),
  };
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class VideoQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(VideoQueueService.name);
  private queue!: Queue<VideoJobPayload, VideoJobResult>;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const connection = buildConnection(this.config);

    this.queue = new Queue<VideoJobPayload, VideoJobResult>(VIDEO_QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts:           3,
        backoff:            { type: 'exponential', delay: 10_000 },
        removeOnComplete:   { count: 200, age: 60 * 60 * 24 * 7 }, // keep 7 days
        removeOnFail:       { count: 100, age: 60 * 60 * 24 * 3 }, // keep 3 days
      },
    });

    this.queue.on('error', (err) =>
      this.logger.error(`[VideoQueue] Queue error: ${err.message}`),
    );

    this.logger.log(`[VideoQueue] Queue "${VIDEO_QUEUE_NAME}" initialised`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue?.close();
    this.logger.log('[VideoQueue] Queue closed');
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  /**
   * Enqueue a full video render job.
   * Returns the BullMQ job ID (string).
   */
  async addVideoJob(payload: VideoJobPayload): Promise<string> {
    const job = await this.queue.add('render', payload, {
      jobId: `video-${payload.executionId}`, // deterministic — prevents duplicates on retry
    });

    this.logger.log(
      `[VideoQueue] Job enqueued — jobId=${job.id} executionId=${payload.executionId} ` +
      `campaignId=${payload.campaignId} angles=${payload.angles.length}`,
    );

    return job.id!;
  }

  /**
   * Retrieve a job by BullMQ job ID.
   * Returns null if the job has been removed (past TTL) or never existed.
   */
  async getJob(jobId: string): Promise<Job<VideoJobPayload, VideoJobResult> | null> {
    return this.queue.getJob(jobId);
  }
}
