// ─── User Style Profile — Controller ─────────────────────────────────────────

import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags }            from '@nestjs/swagger';
import { UserStyleService }                 from './user-style.service';
import { IngestSignalDto }                  from './user-style.types';

@ApiTags('user-style')
@Controller('api/style')
export class UserStyleController {
  constructor(private readonly svc: UserStyleService) {}

  @Get('profile')
  @ApiOperation({ summary: 'Get the current user style profile with derived labels' })
  getProfile(@Req() req: { context?: { userId?: string } }) {
    const userId = req?.context?.userId ?? '';
    return this.svc.getProfile(userId);
  }

  @Post('signal')
  @ApiOperation({ summary: 'Ingest an edit signal to update the style profile' })
  async ingestSignal(
    @Body() dto: IngestSignalDto,
    @Req() req: { context?: { userId?: string } },
  ): Promise<{ ok: boolean }> {
    const userId = req?.context?.userId ?? '';
    await this.svc.ingestSignal(userId, dto.signalType, dto.weight);
    return { ok: true };
  }
}
