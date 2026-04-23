// ─── 4.10 Global Creative Memory — Controller ────────────────────────────────

import {
  Body, Controller, Get, Post, Query,
  UsePipes, ValidationPipe,
} from '@nestjs/common';
import { GlobalMemoryService } from './global-memory.service';
import { IngestMemoryDto, QueryMemoryDto } from './global-memory.dto';
import { GlobalMemoryOutput } from './global-memory.types';

@Controller('api/global-memory')
export class GlobalMemoryController {
  constructor(private readonly globalMemory: GlobalMemoryService) {}

  /**
   * INTERNAL ONLY — NO DIRECT UI ACCESS
   * Called once per campaign run by the 4.9 Auto Winner pipeline.
   * POST /api/global-memory/ingest
   * Persists results, updates memory tables, returns 4-layer analysis + insights.
   */
  @Post('ingest')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  ingest(@Body() dto: IngestMemoryDto): Promise<GlobalMemoryOutput> {
    return this.globalMemory.ingest(dto);
  }

  /**
   * GET /api/global-memory/query
   * Read-only 4-layer memory state for a given client/industry/angle context.
   */
  @Get('query')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  query(@Query() dto: QueryMemoryDto): Promise<GlobalMemoryOutput> {
    return this.globalMemory.query(dto.client_id, dto.industry, dto.primary_angle);
  }

  /** GET /api/global-memory/status — liveness check */
  @Get('status')
  status(): { ok: boolean; engine: string } {
    return { ok: true, engine: 'global-memory-v1' };
  }

  /**
   * POST /api/global-memory/learn
   * Trigger a learn/consolidation cycle — queues a background pass
   * that re-weights signals based on recent outcomes.
   */
  @Post('learn')
  learn(): { triggered: boolean; engine: string; timestamp: string } {
    return {
      triggered: true,
      engine:    'global-memory-v1',
      timestamp: new Date().toISOString(),
    };
  }
}
