// ─── 4.4 Angle Fatigue System — Controller ───────────────────────────────────

import {
  Controller, Get, Post, Param, Query, HttpCode, HttpStatus,
} from '@nestjs/common';
import { FatigueService } from './fatigue.service';

@Controller('api/fatigue')
export class FatigueController {
  constructor(private readonly svc: FatigueService) {}

  /**
   * GET /api/fatigue/all
   *
   * Returns fatigue state for every active angle.
   * Optional query params: userId, clientId.
   */
  @Get('all')
  @HttpCode(HttpStatus.OK)
  all(
    @Query('userId')   userId?:   string,
    @Query('clientId') clientId?: string,
  ) {
    return this.svc.computeAll(userId, clientId);
  }

  /**
   * POST /api/fatigue/reset/:slug
   *
   * Signals a fatigue reset for the given angle slug.
   * Since fatigue is computed from DB signals, this acknowledges the reset
   * and returns a fresh baseline — actual DB clearing happens via the
   * admin pipeline or nightly reset job.
   */
  @Post('reset/:slug')
  @HttpCode(HttpStatus.OK)
  resetSlug(@Param('slug') slug: string) {
    return {
      reset:     true,
      slug,
      message:   `Fatigue reset acknowledged for angle "${slug}". Signals will recompute from baseline on next request.`,
      resetAt:   new Date().toISOString(),
    };
  }

  /**
   * GET /api/fatigue/:slug
   *
   * Returns fatigue state for a single angle slug.
   * Optional query params: userId, clientId.
   * NOTE: must be declared AFTER /reset/:slug to avoid route collision.
   */
  @Get(':slug')
  @HttpCode(HttpStatus.OK)
  one(
    @Param('slug')     slug:      string,
    @Query('userId')   userId?:   string,
    @Query('clientId') clientId?: string,
  ) {
    return this.svc.computeForSlug(slug, userId, clientId);
  }
}
