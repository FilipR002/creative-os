// ─── Phase 9.1 — Emergence Controller ────────────────────────────────────────

import { Controller, Get, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { EmergenceService }      from './emergence.service';

@ApiTags('emergence')
@Controller('api/emergence')
export class EmergenceController {
  constructor(private readonly service: EmergenceService) {}

  @Get('state')
  @ApiOperation({ summary: 'Current system emergence / drift state (cached 1h)' })
  state() {
    return this.service.getState();
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Force recompute emergence state (bypass cache)' })
  refresh() {
    return this.service.refresh();
  }
}
