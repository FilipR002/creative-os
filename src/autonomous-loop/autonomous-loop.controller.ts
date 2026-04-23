// ─── Phase 8.4 + Reality Fix — Autonomous Loop Controller ────────────────────

import { Controller, Get, Post, Param, Body, Req } from '@nestjs/common';
import { ApiOperation, ApiTags }                   from '@nestjs/swagger';
import { AutonomousLoopService }                   from './autonomous-loop.service';
import { randomUUID }                              from 'crypto';

type AutonomousLoopMode = 'MANUAL' | 'HYBRID' | 'AUTONOMOUS';

@ApiTags('autonomous-loop')
@Controller('autonomous-loop')
export class AutonomousLoopController {
  constructor(private readonly alc: AutonomousLoopService) {}

  // In-memory mode store — persists for server process lifetime
  private currentMode: AutonomousLoopMode = 'HYBRID';
  private isStopped = false;

  @Get('state')
  @ApiOperation({ summary: 'ALC state for calling user (in-memory + DB fallback)' })
  async state(@Req() req: { context?: { userId?: string } }) {
    const userId = req?.context?.userId ?? '';
    return (await this.alc.getStateFromDb(userId)) ?? { message: 'No ALC cycle run yet for this user' };
  }

  @Get('states')
  @ApiOperation({ summary: 'All ALC states (admin view — in-memory)' })
  allStates() {
    return this.alc.getAllStates();
  }

  @Get('policy/:userId')
  @ApiOperation({ summary: 'Full ALC policy record including reason trace (admin/audit)' })
  async policy(@Param('userId') userId: string) {
    return (await this.alc.getPolicyRecord(userId)) ?? { message: 'No policy record found' };
  }

  @Post('evaluate/:userId')
  @ApiOperation({ summary: 'Manually trigger ALC evaluation for a user (admin)' })
  evaluate(@Param('userId') userId: string) {
    return this.alc.evaluateCycle(userId);
  }

  @Post('trigger')
  @ApiOperation({ summary: 'Manually kick off an ALC evaluation cycle (admin)' })
  async trigger(@Body() body: { mode?: AutonomousLoopMode } = {}) {
    this.isStopped = false;
    if (body.mode) this.currentMode = body.mode;
    const cycleId = randomUUID();
    // Fire-and-forget evaluation — no specific userId needed for admin trigger
    this.alc.evaluateCycle('system').catch(() => { /* background */ });
    return { triggered: true, cycleId, mode: this.currentMode, timestamp: new Date().toISOString() };
  }

  @Post('stop')
  @ApiOperation({ summary: 'Pause the autonomous loop (admin)' })
  stop() {
    this.isStopped = true;
    return { stopped: true, mode: this.currentMode, timestamp: new Date().toISOString() };
  }

  @Post('mode')
  @ApiOperation({ summary: 'Set MANUAL / HYBRID / AUTONOMOUS operating mode (admin)' })
  setMode(@Body() body: { mode: AutonomousLoopMode }) {
    if (body.mode && ['MANUAL', 'HYBRID', 'AUTONOMOUS'].includes(body.mode)) {
      this.currentMode = body.mode;
    }
    return { mode: this.currentMode, updated: true, timestamp: new Date().toISOString() };
  }
}
