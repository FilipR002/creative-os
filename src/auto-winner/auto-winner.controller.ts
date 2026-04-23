// ─── 4.9 Auto Winner System — Controller ─────────────────────────────────────

import { Body, Controller, Get, Post, UsePipes, ValidationPipe } from '@nestjs/common';
import { AutoWinnerService } from './auto-winner.service';
import { EvaluateVariantsDto } from './auto-winner.dto';
import { AutoWinnerOutput } from './auto-winner.types';

@Controller('api/auto-winner')
export class AutoWinnerController {
  constructor(private readonly autoWinner: AutoWinnerService) {}

  /**
   * POST /api/auto-winner/evaluate
   * Accepts 2–20 creative variants + optional context signals.
   * Returns per-variant scores (0–100), winner, and reasoning.
   * Weights: CTR 30% | Retention 30% | Conversion 25% | Clarity 15%.
   */
  @Post('evaluate')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  evaluate(@Body() dto: EvaluateVariantsDto): AutoWinnerOutput {
    return this.autoWinner.evaluate(dto);
  }

  /** GET /api/auto-winner/status — liveness check */
  @Get('status')
  status(): { ok: boolean; engine: string } {
    return { ok: true, engine: 'auto-winner-v1' };
  }
}
