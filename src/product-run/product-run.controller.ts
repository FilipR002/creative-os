// ─── Product Run Controller ───────────────────────────────────────────────────
//
// Single endpoint: POST /api/run
//
// Replaces multi-step frontend orchestration. One call executes the full
// campaign pipeline and returns a deterministic, structured result.

import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags }                              from '@nestjs/swagger';
import { ProductRunService }                                  from './product-run.service';
import { RunDto }                                             from './product-run.types';

@ApiTags('run')
@Controller('api/run')
export class ProductRunController {
  constructor(private readonly svc: ProductRunService) {}

  /**
   * POST /api/run
   *
   * Executes the full creative campaign pipeline in a single call:
   * concept → angles → creatives → scoring → memory → learning → (evolution)
   *
   * Returns a structured RunResponse with every subsystem's output.
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Run full campaign pipeline (concept → creatives → scoring → learning)' })
  run(
    @Body() dto: RunDto,
    @Req()  req: { context?: { userId?: string } },
  ) {
    const userId = req?.context?.userId ?? '';
    return this.svc.run(dto, userId);
  }
}
