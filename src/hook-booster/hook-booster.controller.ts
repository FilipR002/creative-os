// ─── 4.6 Hook Booster v1 / 4.7 Hook Booster v2 — Controller ─────────────────

import { Body, Controller, Get, Post, UsePipes, ValidationPipe } from '@nestjs/common';
import { HookBoosterService } from './hook-booster.service';
import { BoostHooksDto, GenerateHooksDto } from './hook-booster.dto';
import { HookBoosterOutput, HookV2Output } from './hook-booster.types';

@Controller('api/hook-booster')
export class HookBoosterController {
  constructor(private readonly hookBooster: HookBoosterService) {}

  /**
   * POST /api/hook-booster/generate
   * v1: angle + format + emotion → 3 hook variants.
   */
  @Post('generate')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  generate(@Body() dto: GenerateHooksDto): HookBoosterOutput {
    return this.hookBooster.generate(dto);
  }

  /**
   * POST /api/hook-booster/boost
   * v2: v1 output + memory_signal + fatigue_signal + exploration_pressure_delta
   * → 3 optimised EXPLOIT / HYBRID / EXPLORE hook variants.
   */
  @Post('boost')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  boost(@Body() dto: BoostHooksDto): HookV2Output {
    return this.hookBooster.boost(dto);
  }

  /** GET /api/hook-booster/status — liveness check */
  @Get('status')
  status(): { ok: boolean; engines: string[] } {
    return { ok: true, engines: ['hook-booster-v1', 'hook-booster-v2'] };
  }
}
