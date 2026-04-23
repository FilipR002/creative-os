// ─── Angle Evolution Engine — Controller ─────────────────────────────────────

import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags }                     from '@nestjs/swagger';
import { EvolutionService }                          from './evolution.service';

@ApiTags('Evolution')
@Controller('api/evolution')
export class EvolutionController {
  constructor(private readonly service: EvolutionService) {}

  /**
   * Trigger a full evolution cycle.
   * Evaluates all angles with ≥3 reports and applies mutation/pruning/promotion.
   */
  @Post('cycle')
  @ApiOperation({ summary: 'Run a full evolution cycle (mutation + pruning + promotion)' })
  runCycle() {
    return this.service.runEvolutionCycle();
  }

  /**
   * Manually mutate a specific angle.
   * Used for targeted intervention or testing.
   */
  @Post('mutate/:slug')
  @ApiOperation({ summary: 'Force-mutate a specific angle' })
  mutate(@Param('slug') slug: string, @Body() body: { score?: number }) {
    return this.service.mutateAngle(slug, body.score ?? 0.30);
  }

  /**
   * All mutations, optionally filtered by status.
   */
  @Get('mutations')
  @ApiOperation({ summary: 'List angle mutations' })
  getMutations(@Query('status') status?: string) {
    return this.service.getMutations(status);
  }

  /**
   * Full angle health dashboard — score, status, mutation links.
   */
  @Get('health')
  @ApiOperation({ summary: 'Angle health report with evolution status' })
  getHealth() {
    return this.service.getAngleHealth();
  }

  /**
   * Recent evolution events (mutations, prunings, promotions).
   */
  @Get('log')
  @ApiOperation({ summary: 'Evolution event log' })
  getLog(@Query('limit') limit?: string) {
    return this.service.getEvolutionLog(limit ? parseInt(limit) : 50);
  }

  /**
   * High-level evolution stats (counts, last cycle time).
   */
  @Get('status')
  @ApiOperation({ summary: 'Evolution engine status' })
  getStatus() {
    return this.service.getStatus();
  }
}
