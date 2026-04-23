// ─── Decision Orchestration Layer — Controller ────────────────────────────────

import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { OrchestratorService } from './orchestrator.service';
import { DecideInput }         from './orchestrator.types';

@Controller('api/orchestrator')
export class OrchestratorController {
  constructor(private readonly svc: OrchestratorService) {}

  /**
   * POST /api/orchestrator/decide
   *
   * Runs the full Decision Orchestration pipeline for the given context.
   * Returns an OrchestratorDecision with:
   *  - selected_angles (primary, secondary, exploration slots)
   *  - decision_breakdown (per-subsystem influence %)
   *  - conflict_resolution_log
   *  - system_stability_state
   *  - _meta (timing, conflict counts)
   */
  @Post('decide')
  @HttpCode(HttpStatus.OK)
  decide(@Body() body: DecideInput) {
    return this.svc.decide(body);
  }

  /**
   * GET /api/orchestrator/status
   *
   * Lightweight health snapshot — active angle count, stability state, and
   * subsystem availability flags.  No DB scoring; < 5ms.
   */
  @Get('status')
  status() {
    return this.svc.status();
  }
}
