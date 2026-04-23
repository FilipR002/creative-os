import {
  Controller,
  Get,
  Param,
  Query,
  ParseEnumPipe,
  DefaultValuePipe,
  Optional,
}                            from '@nestjs/common';
import { PerformanceService } from './performance.service';
import { DashboardTimeframe } from './performance.snapshot';

@Controller('api/dashboard')
export class PerformanceController {
  constructor(private readonly performance: PerformanceService) {}

  /**
   * Client-facing view — actionable intelligence only.
   * GET /api/dashboard/user/:clientId?industry=ecommerce&timeframe=7d
   */
  @Get('user/:clientId')
  getUserDashboard(
    @Param('clientId')                              clientId:  string,
    @Query('industry', new DefaultValuePipe('general')) industry:  string,
    @Query('timeframe', new DefaultValuePipe('7d'),
      new ParseEnumPipe(['24h', '7d', '30d'], { optional: true }))
    timeframe: DashboardTimeframe,
  ) {
    return this.performance.getUserView(clientId, industry, timeframe);
  }

  /**
   * Admin system-intelligence view — aggregated only, no raw client ids.
   * GET /api/dashboard/admin?industry=ecommerce
   */
  @Get('admin')
  getAdminDashboard(
    @Query('industry', new DefaultValuePipe('general')) industry: string,
  ) {
    return this.performance.getAdminView(industry);
  }

  /**
   * Raw snapshot — internal tooling / debugging.
   * GET /api/dashboard/snapshot/:clientId?timeframe=30d
   */
  @Get('snapshot/:clientId')
  getSnapshot(
    @Param('clientId')                              clientId:  string,
    @Query('timeframe', new DefaultValuePipe('7d'),
      new ParseEnumPipe(['24h', '7d', '30d'], { optional: true }))
    timeframe: DashboardTimeframe,
  ) {
    return this.performance.getSnapshot(clientId, timeframe);
  }
}
