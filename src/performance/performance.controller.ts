import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PerformanceService, type ConfirmPayload } from './performance.service';
import type { ParsedRow } from './csv-parser.service';

// Multer memory-storage: file.buffer available without disk I/O
import { memoryStorage } from 'multer';

@ApiTags('Performance')
@Controller('api/performance')
export class PerformanceController {
  constructor(private readonly service: PerformanceService) {}

  /**
   * POST /api/performance/import
   * Parse a CSV export from Meta, Google Ads, or TikTok.
   * Returns full PerformanceRow[] with match status — does NOT submit metrics.
   * Call /confirm-import after user reviews the results.
   */
  @Post('import')
  @ApiOperation({ summary: 'Parse CSV and return match preview (no side-effects)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  async importCsv(
    @UploadedFile() file: { buffer: Buffer; originalname: string; size: number },
  ) {
    if (!file?.buffer) throw new BadRequestException('No CSV file uploaded. Use field name "file".');
    return this.service.importCsv(file.buffer);
  }

  /**
   * POST /api/performance/confirm-import
   * Submit reviewed/matched rows to the learning engine.
   */
  @Post('confirm-import')
  @ApiOperation({ summary: 'Confirm import — submit real metrics to learning engine' })
  confirmImport(@Body() body: ConfirmPayload) {
    if (!Array.isArray(body?.rows) || body.rows.length === 0) {
      throw new BadRequestException('body.rows must be a non-empty array');
    }
    return this.service.confirmImport(body);
  }

  /**
   * POST /api/performance/manual-match
   * Legacy endpoint — kept for backward compatibility.
   */
  @Post('manual-match')
  @ApiOperation({ summary: 'Submit manually matched performance data (legacy)' })
  manualMatch(
    @Body() body: {
      rows: Array<{
        creativeId: string;
        metrics: Omit<ParsedRow, 'adName' | 'campaignName' | 'url'>;
      }>;
    },
  ) {
    if (!Array.isArray(body?.rows) || body.rows.length === 0) {
      throw new BadRequestException('body.rows must be a non-empty array');
    }
    return this.service.manualMatch(body.rows);
  }

  /**
   * GET /api/performance/insights?campaignId=
   * Aggregate creative scores into top/weak performer insights.
   */
  @Get('insights')
  @ApiOperation({ summary: 'Get performance insights for a campaign (or all campaigns)' })
  getInsights(@Query('campaignId') campaignId?: string) {
    return this.service.getInsights(campaignId ?? null);
  }
}
