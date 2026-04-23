import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SystemAuditService, ResolveInput, AuditReport, ResolveResult, GeneratedToolConfig } from './system-audit.service';

@ApiTags('System Audit')
@Controller('api/system-audit')
export class SystemAuditController {

  constructor(private readonly auditService: SystemAuditService) {}

  // ── GET /api/system-audit/run ─────────────────────────────────────────────
  @Get('run')
  @ApiOperation({ summary: 'Run self-healing audit — returns orphans, suggestions, stats' })
  runAudit(): AuditReport {
    return this.auditService.runAudit();
  }

  // ── POST /api/system-audit/resolve ────────────────────────────────────────
  @Post('resolve')
  @ApiOperation({ summary: 'Resolve a single orphan endpoint with the given strategy' })
  async resolveEndpoint(@Body() body: ResolveInput): Promise<ResolveResult> {
    return this.auditService.resolveEndpoint(body);
  }

  // ── POST /api/system-audit/resolve-all ───────────────────────────────────
  @Post('resolve-all')
  @ApiOperation({ summary: 'Apply intelligent defaults to ALL orphan endpoints in one batch' })
  async resolveAllOrphans(): Promise<{ results: ResolveResult[]; summary: { resolved: number; skipped: number; failed: number } }> {
    const results = await this.auditService.resolveAllOrphans();
    return {
      results,
      summary: {
        resolved: results.filter(r => r.success).length,
        skipped:  results.filter(r => r.alreadyResolved).length,
        failed:   results.filter(r => !r.success && !r.alreadyResolved).length,
      },
    };
  }

  // ── GET /api/system-audit/generated ──────────────────────────────────────
  @Get('generated')
  @ApiOperation({ summary: 'List all auto-generated UI tool configs' })
  getAllGenerated(): { tools: GeneratedToolConfig[] } {
    return { tools: this.auditService.getAllGeneratedTools() };
  }

  // ── GET /api/system-audit/generated/:name ────────────────────────────────
  @Get('generated/:name')
  @ApiOperation({ summary: 'Get a single generated tool config by slug name' })
  getGenerated(@Param('name') name: string): GeneratedToolConfig | { error: string } {
    const tool = this.auditService.getGeneratedTool(name);
    return tool ?? { error: `No generated tool found for: ${name}` };
  }
}
