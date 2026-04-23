// ─── Autonomous Intelligence Controller ──────────────────────────────────────
// Unified control + event streaming for the Autonomous Intelligence Cockpit.
// Routes:
//   GET  /api/autonomous/dashboard   → aggregate status
//   GET  /api/autonomous/decisions   → recent decision log
//   GET  /api/autonomous/stream      → SSE brain event stream
//   GET  /api/autonomous/mode        → current mode
//   POST /api/autonomous/pause       → pause
//   POST /api/autonomous/resume      → resume
//   POST /api/autonomous/step        → single step
//   POST /api/autonomous/lock        → lock campaigns
//   POST /api/autonomous/mode        → set mode

import {
  Controller, Get, Post, Body, Sse, Query, MessageEvent,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Observable, from }      from 'rxjs';
import { map }                   from 'rxjs/operators';
import {
  AutonomousIntelligenceService,
  type AutonomousMode,
} from './autonomous-intelligence.service';

@ApiTags('autonomous-intelligence')
@Controller('api/autonomous')
export class AutonomousIntelligenceController {
  constructor(private readonly svc: AutonomousIntelligenceService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Aggregate autonomous system dashboard' })
  getDashboard() {
    return this.svc.getDashboard();
  }

  @Get('decisions')
  @ApiOperation({ summary: 'Recent decision log (last N events)' })
  getDecisions(@Query('limit') limit?: string) {
    return this.svc.getDecisionLog(limit ? Number(limit) : 20);
  }

  @Get('mode')
  @ApiOperation({ summary: 'Current autonomous mode + status' })
  getMode() {
    return this.svc.getMode();
  }

  /**
   * GET /api/autonomous/stream
   * Server-Sent Events stream of live AI brain events.
   * Client connects once and receives a continuous stream of typed events.
   */
  @Sse('stream')
  @ApiOperation({ summary: 'SSE: live AI brain event stream' })
  stream(): Observable<MessageEvent> {
    const gen = this.svc.eventStream();
    return from({
      [Symbol.asyncIterator]: () => gen,
    }).pipe(
      map(event => ({
        data: JSON.stringify(event),
        type: event.type,
        id:   event.id,
      }) as MessageEvent),
    );
  }

  @Post('pause')
  @ApiOperation({ summary: 'Pause autonomous system' })
  pause() { return this.svc.pause(); }

  @Post('resume')
  @ApiOperation({ summary: 'Resume autonomous system' })
  resume() { return this.svc.resume(); }

  @Post('step')
  @ApiOperation({ summary: 'Execute a single autonomous step' })
  step() { return this.svc.step(); }

  @Post('lock')
  @ApiOperation({ summary: 'Lock all campaigns (prevent auto-deploy)' })
  lock() { return this.svc.lock(); }

  @Post('mode')
  @ApiOperation({ summary: 'Set autonomous mode: MANUAL | SUGGEST | AUTONOMOUS | AUTO_DEPLOY' })
  setMode(@Body() body: { mode: AutonomousMode }) {
    return this.svc.setMode(body.mode);
  }
}
