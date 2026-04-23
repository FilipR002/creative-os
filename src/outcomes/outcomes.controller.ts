// ─── Outcome Learning Layer — Controller ─────────────────────────────────────

import { Body, Controller, Get, Post, Req, BadRequestException } from '@nestjs/common';
import { ApiOperation, ApiTags }            from '@nestjs/swagger';
import { OutcomesService }                  from './outcomes.service';
import type { ReportOutcomeDto }            from './outcomes.types';

@ApiTags('Outcomes')
@Controller('api/outcomes')
export class OutcomesController {
  constructor(private readonly service: OutcomesService) {}

  /**
   * Ingest real-world ad performance data.
   * Triggers learning weight update for the reporting user.
   */
  @Post('report')
  @ApiOperation({ summary: 'Report ad outcome — triggers learning weight update' })
  report(
    @Req() req: { context?: { userId?: string } },
    @Body() dto: ReportOutcomeDto,
  ) {
    // userId always comes from the authenticated request context (x-user-id header).
    // If the body also includes userId, the context takes precedence.
    const userId = req?.context?.userId ?? dto.userId;
    if (!userId) throw new BadRequestException('x-user-id header is required');
    return this.service.reportOutcome({ ...dto, userId });
  }

  /**
   * Last 20 outcomes for the calling user.
   */
  @Get('recent')
  @ApiOperation({ summary: 'Fetch recent reported outcomes for user' })
  recent(@Req() req: { context?: { userId?: string } }) {
    const userId = req?.context?.userId ?? '';
    return this.service.getRecentOutcomes(userId);
  }

  /**
   * Global angle performance stats (aggregated, all users).
   */
  @Get('global-stats')
  @ApiOperation({ summary: 'Global angle performance aggregates' })
  globalStats() {
    return this.service.getGlobalStats();
  }

  /**
   * Per-user outcome weights (used by the scoring engine internally).
   * Exposed for debugging and UI transparency.
   */
  @Get('weights')
  @ApiOperation({ summary: 'Outcome weights for calling user' })
  weights(@Req() req: { context?: { userId?: string } }) {
    const userId = req?.context?.userId ?? '';
    return this.service.getOutcomeWeights(userId);
  }
}
