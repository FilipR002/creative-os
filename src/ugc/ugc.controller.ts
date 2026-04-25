/**
 * ugc.controller.ts
 *
 * UGC Engine HTTP API.
 *
 * Routes:
 *   POST /api/ugc/generate           — launch UGC generation pipeline
 *   GET  /api/ugc/jobs/:jobId        — get single job status
 *   GET  /api/ugc/queue/depth        — queue depth (ops/monitoring)
 */

import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

import { UGCService }      from './ugc.service';
import { UGCQueueService } from './queue/queue.service';
import { UserId }          from '../common/decorators/user-id.decorator';
import type {
  GenerateUGCDto,
  GenerateUGCResponse,
  UGCJobStatusResponse,
} from './types/ugc.types';

@ApiTags('UGC Engine')
@Controller('api/ugc')
export class UGCController {

  constructor(
    private readonly ugcService: UGCService,
    private readonly queue:      UGCQueueService,
  ) {}

  // ─── Generate ─────────────────────────────────────────────────────────────

  @Post('generate')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary:     'Launch UGC generation pipeline',
    description: 'Runs Brain → Variant → Compile → Queue. Returns jobIds for polling.',
  })
  @ApiResponse({ status: 202, description: 'Jobs queued successfully' })
  async generate(
    @Body()   dto:    GenerateUGCDto,
    @UserId() userId: string,
  ): Promise<GenerateUGCResponse> {
    return this.ugcService.generate(dto, userId);
  }

  // ─── Job status ───────────────────────────────────────────────────────────

  @Get('jobs/:jobId')
  @ApiOperation({ summary: 'Get UGC job status' })
  @ApiResponse({ status: 200, description: 'Job record returned' })
  @ApiResponse({ status: 404, description: 'Job not found' })
  async getJobStatus(
    @Param('jobId') jobId: string,
  ): Promise<UGCJobStatusResponse> {
    return this.ugcService.getJobStatus(jobId);
  }

  // ─── Queue depth (monitoring) ─────────────────────────────────────────────

  @Get('queue/depth')
  @ApiOperation({ summary: 'Current UGC queue depth' })
  async getQueueDepth(): Promise<{ depth: number }> {
    const depth = await this.queue.getQueueDepth();
    return { depth };
  }
}
