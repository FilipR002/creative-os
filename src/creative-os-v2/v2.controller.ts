/**
 * v2.controller.ts
 *
 * Creative OS v2 — Unified HTTP API
 *
 * Routes:
 *   POST /api/v2/run      — full pipeline: brain → dispatch → score → output
 *   POST /api/v2/preview  — brain-only dry-run (no generation, instant response)
 */

import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

import { V2OrchestratorService } from './v2.orchestrator.service';
import { V2BrainService }        from './v2.brain.service';
import { UserId }                from '../common/decorators/user-id.decorator';
import type { V2InputSchema, V2OutputSchema, V2BrainOutput } from './types/v2.schema.types';

@ApiTags('Creative OS v2')
@Controller('api/v2')
export class V2Controller {

  constructor(
    private readonly orchestrator: V2OrchestratorService,
    private readonly brain:        V2BrainService,
  ) {}

  // ─── Full run ──────────────────────────────────────────────────────────────

  @Post('run')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary:     'Creative OS v2 — full unified run',
    description: [
      'ONE INPUT → ONE MASTER PROCESS → ONE OUTPUT.',
      'Runs: Brain (funnel detection + routing) → UGC A/B/C Test → Carousel → Banner',
      '→ Scoring → Learning. Returns the complete V2OutputSchema.',
    ].join(' '),
  })
  @ApiResponse({ status: 202, description: 'Full campaign dispatched — unified schema returned' })
  async run(
    @Body()   input:  V2InputSchema,
    @UserId() userId: string,
  ): Promise<V2OutputSchema> {
    return this.orchestrator.run(input, userId);
  }

  // ─── Brain preview ────────────────────────────────────────────────────────

  @Post('preview')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:     'Creative OS v2 — brain preview (no generation)',
    description: 'Returns funnel stage + format routing + variant allocation instantly. No creative generation is triggered.',
  })
  @ApiResponse({ status: 200, description: 'Brain decision returned' })
  async preview(
    @Body()   input:  V2InputSchema,
    @UserId() userId: string,
  ): Promise<V2BrainOutput> {
    return this.brain.decide(input);
  }
}
