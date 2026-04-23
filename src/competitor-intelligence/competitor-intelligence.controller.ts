import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags }                      from '@nestjs/swagger';
import { CompetitorIntelligenceService }              from './competitor-intelligence.service';
import { CompetitorInput, ExportToBuilderInput }      from './types';

@ApiTags('Competitor Intelligence')
@Controller('api/competitor')
export class CompetitorIntelligenceController {
  constructor(private readonly svc: CompetitorIntelligenceService) {}

  // ─── Autonomy ─────────────────────────────────────────────────────────────

  @Get('autonomy')
  @ApiOperation({ summary: 'Get current CI autonomy level' })
  getAutonomy() { return this.svc.getAutonomy(); }

  @Post('autonomy')
  @ApiOperation({ summary: 'Set CI autonomy level (0-3)' })
  setAutonomy(@Body() body: { level: 0 | 1 | 2 | 3 }) {
    return this.svc.setAutonomy(body.level);
  }

  // ─── Analysis ─────────────────────────────────────────────────────────────

  @Post('analyze')
  @ApiOperation({ summary: 'Start competitor analysis (async job)' })
  analyze(@Body() body: CompetitorInput) {
    return this.svc.startAnalysis(body);
  }

  @Get('jobs')
  @ApiOperation({ summary: 'List all analysis jobs' })
  listJobs() { return { jobs: this.svc.listJobs() }; }

  @Get('results/:jobId')
  @ApiOperation({ summary: 'Get full analysis result' })
  getResult(@Param('jobId') jobId: string) {
    const result = this.svc.getResult(jobId);
    const job    = this.svc.getJob(jobId);
    return { job, result };
  }

  @Get('insights/:jobId')
  @ApiOperation({ summary: 'Get structured insights and clusters for a job' })
  getInsights(@Param('jobId') jobId: string) {
    const job = this.svc.getJob(jobId);
    return { job, ...this.svc.getInsights(jobId) };
  }

  // ─── Export ───────────────────────────────────────────────────────────────

  @Post('export-to-builder')
  @ApiOperation({ summary: 'Export selected intel clusters to builder (user-initiated only)' })
  exportToBuilder(@Body() body: ExportToBuilderInput) {
    return this.svc.exportToBuilder(body);
  }

  @Get('exports')
  @ApiOperation({ summary: 'List all previous exports to builder' })
  getExports() { return { exports: this.svc.getExports() }; }

  // ─── Monitoring ───────────────────────────────────────────────────────────

  @Post('monitoring/enable')
  @ApiOperation({ summary: 'Enable real-time monitoring (periodic re-scan)' })
  enableMonitoring(@Body() body: { intervalMs?: number }) {
    return this.svc.enableMonitoring(body.intervalMs);
  }

  @Post('monitoring/disable')
  @ApiOperation({ summary: 'Immediately stop all background monitoring' })
  disableMonitoring() { return this.svc.disableMonitoring(); }

  @Get('monitoring/status')
  @ApiOperation({ summary: 'Get monitoring engine state' })
  getMonitoringState() { return this.svc.getMonitoringState(); }
}
