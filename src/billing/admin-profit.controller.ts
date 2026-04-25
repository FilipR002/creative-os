import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags }         from '@nestjs/swagger';
import { AdminGuard }                              from '../common/guards/admin.guard';
import { ApiLogService }                           from './api-log.service';
import { RevenueLogService }                       from './revenue-log.service';
import { ProfitService }                           from './profit.service';

/**
 * AdminProfitController
 *
 * All endpoints behind AdminGuard — 403 for non-admin.
 * Read-only financial metrics: API costs, Stripe revenue, profit.
 */
@ApiTags('Admin — Profit')
@UseGuards(AdminGuard)
@Controller('api/admin/profit')
export class AdminProfitController {
  constructor(
    private readonly apiLog:  ApiLogService,
    private readonly revenue: RevenueLogService,
    private readonly profit:  ProfitService,
  ) {}

  /**
   * GET /api/admin/profit/dashboard?days=30
   * Full P&L dashboard: costs + revenue + margin for the given period.
   */
  @Get('dashboard')
  @ApiOperation({ summary: 'Admin P&L dashboard (admin only)' })
  @ApiQuery({ name: 'days', required: false, type: Number })
  getDashboard(@Query('days') days?: string) {
    return this.profit.getDashboard(days ? parseInt(days, 10) : 30);
  }

  /**
   * GET /api/admin/profit/api-costs?days=30
   * API call totals, breakdown by provider + operation, failure rate.
   */
  @Get('api-costs')
  @ApiOperation({ summary: 'API cost breakdown by provider (admin only)' })
  @ApiQuery({ name: 'days', required: false, type: Number })
  getApiCosts(@Query('days') days?: string) {
    return this.apiLog.getTotals(days ? parseInt(days, 10) : 30);
  }

  /**
   * GET /api/admin/profit/api-logs?limit=50
   * Recent individual API log entries.
   */
  @Get('api-logs')
  @ApiOperation({ summary: 'Recent API call log entries (admin only)' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getApiLogs(@Query('limit') limit?: string) {
    return this.apiLog.getRecentLogs(limit ? parseInt(limit, 10) : 50);
  }

  /**
   * GET /api/admin/profit/api-trend?days=14
   * Daily API cost trend for charting.
   */
  @Get('api-trend')
  @ApiOperation({ summary: 'Daily API cost trend (admin only)' })
  @ApiQuery({ name: 'days', required: false, type: Number })
  getApiTrend(@Query('days') days?: string) {
    return this.apiLog.getDailyTrend(days ? parseInt(days, 10) : 14);
  }

  /**
   * GET /api/admin/profit/revenue?days=30
   * Stripe revenue totals and breakdown by event type.
   */
  @Get('revenue')
  @ApiOperation({ summary: 'Stripe revenue totals (admin only)' })
  @ApiQuery({ name: 'days', required: false, type: Number })
  getRevenue(@Query('days') days?: string) {
    return this.revenue.getTotals(days ? parseInt(days, 10) : 30);
  }

  /**
   * GET /api/admin/profit/revenue-logs?limit=50
   * Recent Stripe payment log entries.
   */
  @Get('revenue-logs')
  @ApiOperation({ summary: 'Recent Stripe revenue log entries (admin only)' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getRevenueLogs(@Query('limit') limit?: string) {
    return this.revenue.getRecentLogs(limit ? parseInt(limit, 10) : 50);
  }

  /**
   * GET /api/admin/profit/revenue-trend?days=14
   * Daily revenue trend for charting.
   */
  @Get('revenue-trend')
  @ApiOperation({ summary: 'Daily revenue trend (admin only)' })
  @ApiQuery({ name: 'days', required: false, type: Number })
  getRevenueTrend(@Query('days') days?: string) {
    return this.revenue.getDailyTrend(days ? parseInt(days, 10) : 14);
  }

  /**
   * POST /api/admin/profit/snapshot
   * Persist today's P&L snapshot to profit_snapshots table.
   */
  @Post('snapshot')
  @ApiOperation({ summary: 'Compute and persist today\'s profit snapshot (admin only)' })
  async takeSnapshot() {
    await this.profit.snapshotToday();
    return { ok: true, message: 'Snapshot saved for today.' };
  }
}
