// ─── Admin Tools Controller ────────────────────────────────────────────────────
// All routes are /api/admin-tools/* — admin-only, never exposed to end users.

import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags }                     from '@nestjs/swagger';
import { AdminToolsService }                         from './admin-tools.service';

@ApiTags('Admin Tools')
@Controller('api/admin-tools')
export class AdminToolsController {
  constructor(private readonly svc: AdminToolsService) {}

  // ── DEBUG: GENERATION REPLAY ──────────────────────────────────────────────

  @Get('debug/generations')
  @ApiOperation({ summary: 'List recent generations available for replay' })
  recentGenerations(@Query('limit') limit?: string) {
    return this.svc.getRecentGenerations(limit ? +limit : 20);
  }

  @Get('debug/replay/:generationId')
  @ApiOperation({ summary: 'Step-by-step replay of a generation decision trace' })
  replay(@Param('generationId') id: string) {
    return this.svc.replayGeneration(id);
  }

  @Post('debug/simulate')
  @ApiOperation({ summary: 'Simulate alternate execution with different angle/hook/persona' })
  simulate(@Body() body: {
    angle:          string;
    hookStrategy?:  Record<string, number>;
    persona?:       string;
    campaignId?:    string;
  }) {
    return this.svc.simulate(body);
  }

  // ── MEMORY WEIGHTS ────────────────────────────────────────────────────────

  @Get('memory/weights')
  @ApiOperation({ summary: 'Get current memory scoring weights' })
  getWeights() {
    return this.svc.getMemoryWeights();
  }

  @Post('memory/weights')
  @ApiOperation({ summary: 'Update memory scoring weights (must sum to ~1.0)' })
  updateWeights(@Body() body: { ctr?: number; conversion?: number; engagement?: number; clarity?: number }) {
    return this.svc.updateMemoryWeights(body);
  }

  // ── ORCHESTRATOR RULES ────────────────────────────────────────────────────

  @Get('orchestrator/rules')
  @ApiOperation({ summary: 'Get current orchestrator decision rules' })
  getRules() {
    return this.svc.getOrchestratorRules();
  }

  @Post('orchestrator/rules')
  @ApiOperation({ summary: 'Replace entire rule set' })
  updateRules(@Body() body: { rules: { id: string; condition: string; action: string; priority: number; enabled: boolean }[] }) {
    return this.svc.updateOrchestratorRules(body.rules);
  }

  @Post('orchestrator/rules/upsert')
  @ApiOperation({ summary: 'Add or update a single rule' })
  upsertRule(@Body() rule: { id: string; condition: string; action: string; priority: number; enabled: boolean }) {
    return this.svc.upsertOrchestratorRule(rule);
  }

  // ── HOOK STRATEGY ─────────────────────────────────────────────────────────

  @Get('hook-strategy')
  @ApiOperation({ summary: 'Get current hook strategy weighting' })
  getHookStrategy() {
    return this.svc.getHookStrategy();
  }

  @Post('hook-strategy')
  @ApiOperation({ summary: 'Update hook strategy weights' })
  updateHookStrategy(@Body() body: { emotional?: number; urgency?: number; rational?: number; curiosity?: number }) {
    return this.svc.updateHookStrategy(body);
  }

  // ── SELF-LEARNING INJECTION ───────────────────────────────────────────────

  @Post('self-learning/inject')
  @ApiOperation({ summary: 'Inject a natural-language learning instruction into the next evolution cycle' })
  injectLearning(@Body() body: { instruction: string }) {
    return this.svc.injectLearning(body.instruction);
  }

  @Get('self-learning/log')
  @ApiOperation({ summary: 'Get self-learning injection history' })
  getLearningLog() {
    return this.svc.getSelfLearningLog();
  }

  // ── AUTONOMOUS AUDIT LOG ──────────────────────────────────────────────────

  @Get('autonomous/audit')
  @ApiOperation({ summary: 'Get full autonomous action audit log' })
  getAudit(@Query('limit') limit?: string) {
    return this.svc.getAuditLog(limit ? +limit : 100);
  }

  @Post('autonomous/audit')
  @ApiOperation({ summary: 'Append an autonomous action to the audit log' })
  appendAudit(@Body() body: {
    triggerSource:   string;
    decision:        string;
    riskLevel:       'LOW' | 'MEDIUM' | 'HIGH';
    predictedImpact: string;
    applied:         boolean;
    mode:            string;
  }) {
    return this.svc.appendAuditEntry(body);
  }

  @Post('autonomous/audit/:id/rollback')
  @ApiOperation({ summary: 'Mark an audit entry as rolled back' })
  rollbackAudit(@Param('id') id: string) {
    return this.svc.rollbackAuditEntry(id);
  }
}
