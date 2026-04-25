/**
 * queue.processor.ts
 *
 * UGC Queue Processor — background worker that drains the UGC render queue.
 *
 * Lifecycle:
 *   onModuleInit  → starts polling interval
 *   onModuleDestroy → stops gracefully
 *
 * Per-job pipeline:
 *   1. Dequeue job payload
 *   2. Mark job → processing
 *   3. Render all scenes via KlingApiService
 *   4. Stitch scenes via StitcherService
 *   5. Score stitched video via ScoringService
 *   6. Mark job → done | failed
 *   7. Trigger learning cycle
 */

import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';

import { UGCQueueService }   from './queue.service';
import { KlingApiService }   from '../kling-api.service';
import { StitcherService }   from '../stitcher/stitcher.service';
import { ScoringService }    from '../../scoring/scoring.service';
import { LearningService }   from '../../learning/learning.service';
import type { UGCJobPayload } from './job.types';

// ─── Constants ────────────────────────────────────────────────────────────────

/** How often to poll the queue in milliseconds */
const POLL_INTERVAL_MS = 5_000;

// ─── Processor ────────────────────────────────────────────────────────────────

@Injectable()
export class UGCQueueProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger   = new Logger(UGCQueueProcessor.name);
  private timer:            NodeJS.Timeout | null = null;
  private isProcessing      = false;

  constructor(
    private readonly queue:    UGCQueueService,
    private readonly klingApi: KlingApiService,
    private readonly stitcher: StitcherService,
    private readonly scoring:  ScoringService,
    private readonly learning: LearningService,
  ) {}

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  onModuleInit(): void {
    this.logger.log(`[UGCProcessor] Starting queue polling every ${POLL_INTERVAL_MS}ms`);
    this.timer = setInterval(() => {
      if (!this.isProcessing) {
        this.processNext().catch(err =>
          this.logger.error(`[UGCProcessor] Uncaught error: ${err?.message ?? err}`)
        );
      }
    }, POLL_INTERVAL_MS);
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      this.logger.log('[UGCProcessor] Queue polling stopped');
    }
  }

  // ─── Core processing loop ─────────────────────────────────────────────────

  private async processNext(): Promise<void> {
    const job = await this.queue.dequeue();
    if (!job) return;

    this.isProcessing = true;
    try {
      await this.processJob(job);
    } finally {
      this.isProcessing = false;
    }
  }

  private async processJob(job: UGCJobPayload): Promise<void> {
    const { jobId, campaignId, platform, compiledPlan } = job;
    this.logger.log(`[UGCProcessor] Processing jobId=${jobId} persona=${job.variant.persona}`);

    await this.queue.markProcessing(jobId);

    try {
      // 1. Render all scenes via Kling API
      const sceneResults = await this.klingApi.renderScenes(
        compiledPlan.scenes,
        platform,
      );

      // 2. Stitch into final video
      const stitchResult = await this.stitcher.stitch(sceneResults);

      // 3. Score the creative (non-blocking — scoring uses creativeId, use jobId as proxy)
      let score: number | undefined;
      try {
        const scoreResults = await this.scoring.evaluate([jobId]);
        score = scoreResults[0]?.totalScore;
      } catch (err) {
        this.logger.warn(`[UGCProcessor] Scoring skipped for jobId=${jobId}: ${err}`);
      }

      // 4. Mark done
      await this.queue.markDone(jobId, {
        stitchedVideoUrl: stitchResult.stitchedVideoUrl,
        sceneVideoUrls:   sceneResults.map(r => r.videoUrl),
        score,
      });

      this.logger.log(
        `[UGCProcessor] Done jobId=${jobId} url=${stitchResult.stitchedVideoUrl} ` +
        `duration=${stitchResult.totalDuration}s score=${score?.toFixed(2) ?? 'n/a'}`,
      );

      // 5. Trigger learning cycle (non-blocking, fire-and-forget)
      this.learning.runCycle(campaignId).catch(err =>
        this.logger.warn(`[UGCProcessor] Learning cycle failed for ${campaignId}: ${err}`),
      );

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`[UGCProcessor] Failed jobId=${jobId}: ${message}`);
      await this.queue.markFailed(jobId, message);
    }
  }
}
