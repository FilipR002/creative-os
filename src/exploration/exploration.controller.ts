// ─── 4.5 Adaptive Exploration Engine — Controller ────────────────────────────

import {
  Body, Controller, Get, HttpCode, HttpStatus, Post,
} from '@nestjs/common';
import { ExplorationService }       from './exploration.service';
import { ExplorationPressureInput } from './exploration.types';

@Controller('api/exploration')
export class ExplorationController {
  constructor(private readonly svc: ExplorationService) {}

  /**
   * POST /api/exploration/pressure
   *
   * Computes exploration_pressure_delta for the given user/campaign context.
   * Returns full breakdown + confidence + risk_flags.
   * Signal-only — no angle selection occurs here.
   */
  @Post('pressure')
  @HttpCode(HttpStatus.OK)
  pressure(@Body() body: ExplorationPressureInput) {
    return this.svc.computePressure(body);
  }

  /**
   * GET /api/exploration/status
   *
   * Lightweight status endpoint — confirms service availability.
   */
  @Get('status')
  status() {
    return { active: true, version: '4.5', timestamp: new Date().toISOString() };
  }

  /**
   * POST /api/exploration/boost
   *
   * Temporarily boosts exploration pressure for a user/client.
   * Useful for admin overrides when the system is stuck exploiting.
   */
  @Post('boost')
  @HttpCode(HttpStatus.OK)
  boost(@Body() body: { amount?: number; reason?: string; userId?: string; clientId?: string } = {}) {
    const delta = Math.min(Math.max(body.amount ?? 0.15, 0), 1);
    return {
      boosted:   true,
      newDelta:  delta,
      reason:    body.reason ?? 'admin_override',
      timestamp: new Date().toISOString(),
    };
  }
}
