/**
 * jobs.controller.ts
 *
 * GET /api/jobs/:jobId
 *
 * Returns the current state of a BullMQ video-render job.
 * Used by the frontend to poll until status = "completed" | "failed".
 *
 * Response shape:
 * {
 *   jobId:    string
 *   status:   "waiting" | "active" | "completed" | "failed" | "delayed" | "unknown"
 *   progress: number          // 0–100
 *   result:   VideoJobResult | null   // set when status = "completed"
 *   error:    string | null   // set when status = "failed"
 *   createdAt: number         // unix ms
 *   startedAt: number | null
 *   finishedAt: number | null
 * }
 */

import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags }            from '@nestjs/swagger';
import { VideoQueueService }                           from './video-queue.service';

@ApiTags('Jobs')
@Controller('api/jobs')
export class JobsController {
  constructor(private readonly queue: VideoQueueService) {}

  @Get(':jobId')
  @ApiOperation({ summary: 'Poll the status of an async video-render job' })
  @ApiParam({ name: 'jobId', description: 'BullMQ job ID returned by POST /api/run for video format' })
  async getJobStatus(@Param('jobId') jobId: string) {
    const job = await this.queue.getJob(jobId);

    if (!job) {
      throw new NotFoundException(
        `Job "${jobId}" not found. It may have expired or the ID is incorrect.`,
      );
    }

    const state    = await job.getState();        // waiting | active | completed | failed | delayed
    const progress = job.progress as number ?? 0;
    const result   = state === 'completed' ? (job.returnvalue ?? null) : null;
    const error    = state === 'failed'
      ? (job.failedReason ?? 'Unknown error')
      : null;

    return {
      jobId:      job.id,
      status:     state,
      progress,
      result,
      error,
      // Timestamps (unix ms)
      createdAt:  job.timestamp,
      startedAt:  job.processedOn  ?? null,
      finishedAt: job.finishedOn   ?? null,
      // Metadata for debugging
      attempts:   job.attemptsMade,
      maxAttempts: job.opts.attempts ?? 3,
    };
  }
}
