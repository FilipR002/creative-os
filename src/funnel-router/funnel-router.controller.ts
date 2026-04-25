/**
 * funnel-router.controller.ts
 *
 * Full Funnel Creative OS Router — HTTP API (Phase 1.2)
 *
 * Routes:
 *   POST /api/funnel-router/run      — full funnel routing run
 *   POST /api/funnel-router/preview  — dry-run: returns decision without dispatch
 */

import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';

import { FunnelRouterService } from './funnel-router.service';
import { UserId }              from '../common/decorators/user-id.decorator';
import {
  detectFunnelIntent }         from './funnel-intent.detector';
import { decideFormats }       from './format-decision.engine';
import { allocateVariants }    from './creative-allocation.brain';
import type {
  RunFunnelRouterDto,
  FunnelRouterResult,
} from './funnel-router.types';

// ─── Preview response shape ───────────────────────────────────────────────────

interface FunnelRouterPreview {
  funnelIntent:    ReturnType<typeof detectFunnelIntent>;
  formatDecision:  ReturnType<typeof decideFormats>;
  allocation:      ReturnType<typeof allocateVariants>;
}

// ─── Controller ───────────────────────────────────────────────────────────────

@ApiTags('Funnel Router')
@Controller('api/funnel-router')
export class FunnelRouterController {

  constructor(private readonly router: FunnelRouterService) {}

  // ─── Run ──────────────────────────────────────────────────────────────────

  @Post('run')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary:     'Run full funnel creative router',
    description: [
      'Full pipeline: Funnel Intent → Format Decision → Allocation',
      '→ Cross-Format Sync → Dispatch (UGC + Carousel + Banner) → Scoring → Learning',
    ].join(' '),
  })
  @ApiQuery({ name: 'clientId', required: false, type: String })
  @ApiQuery({ name: 'industry', required: false, type: String })
  @ApiResponse({ status: 202, description: 'All formats dispatched' })
  async run(
    @Body()              dto:      RunFunnelRouterDto,
    @UserId()            userId:   string,
    @Query('clientId')   clientId: string = 'default',
    @Query('industry')   industry: string = 'general',
  ): Promise<FunnelRouterResult> {
    return this.router.run(dto, userId, clientId, industry);
  }

  // ─── Preview (dry-run) ────────────────────────────────────────────────────

  @Post('preview')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:     'Preview funnel routing decision (no dispatch)',
    description: 'Returns intent detection + format decision + variant allocation without executing any generation.',
  })
  @ApiResponse({ status: 200, description: 'Routing decision preview returned' })
  preview(
    @Body() dto: RunFunnelRouterDto,
  ): FunnelRouterPreview {
    const funnelIntent   = detectFunnelIntent({
      goal:        dto.goal,
      budgetLevel: dto.budgetLevel,
      funnelStage: dto.funnelStage,
      intentType:  dto.intentType,
    });

    const formatDecision = decideFormats({
      intent: funnelIntent,
      budget: dto.budgetLevel,
    });

    const allocation = allocateVariants({
      decision: formatDecision,
      budget:   dto.budgetLevel,
    });

    return { funnelIntent, formatDecision, allocation };
  }
}
