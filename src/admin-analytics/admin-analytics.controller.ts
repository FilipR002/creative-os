import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AdminAnalyticsService } from './admin-analytics.service';
import { AdminGuard } from '../common/guards/admin.guard';

/**
 * AdminAnalyticsController — READ-ONLY system observability.
 *
 * All endpoints require admin role (AdminGuard checks email == ADMIN_EMAIL).
 * No writes, no AI logic. Pure aggregation over existing tables.
 */
@ApiTags('Admin Analytics')
@UseGuards(AdminGuard)
@Controller('api/admin/analytics')
export class AdminAnalyticsController {
  constructor(private readonly service: AdminAnalyticsService) {}

  /**
   * GET /api/admin/analytics/overview
   * System-wide snapshot: users, campaigns, creatives, wins/losses, CTR, conversion.
   */
  @Get('overview')
  @ApiOperation({ summary: 'System-wide KPI snapshot (admin only)' })
  getOverview() {
    return this.service.getOverview();
  }

  /**
   * GET /api/admin/analytics/learning-state
   * How the AI is learning: top/worst angles, format trends, calibration health.
   */
  @Get('learning-state')
  @ApiOperation({ summary: 'AI learning state — angles, formats, calibration (admin only)' })
  getLearningState() {
    return this.service.getLearningState();
  }

  /**
   * GET /api/admin/analytics/realtime-feed?limit=20
   * Chronological event stream: CREATED / SCORED / IMPROVED / MEMORY_WRITTEN.
   */
  @Get('realtime-feed')
  @ApiOperation({ summary: 'Real-time event feed across all users (admin only)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  getRealtimeFeed(@Query('limit') limit?: string) {
    return this.service.getRealtimeFeed(limit ? parseInt(limit, 10) : 20);
  }

  /**
   * GET /api/admin/analytics/system-health
   * Learning pipeline health: growth rate, improvement gain, recommendation.
   */
  @Get('system-health')
  @ApiOperation({ summary: 'System health + learning pipeline status (admin only)' })
  getSystemHealth() {
    return this.service.getSystemHealth();
  }
}
