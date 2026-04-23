// ─── Phase 6.1 — Product Controller ──────────────────────────────────────────
// Single execution engine. All decision paths go through executeDecision().
// Supports: synchronous decide, async start + poll, and SSE event stream.

import {
  Body, Controller, Get, Logger, NotFoundException,
  Param, Post, Query, Sse,
} from '@nestjs/common';
import { ApiOperation, ApiTags }      from '@nestjs/swagger';
import { randomUUID }                 from 'crypto';
import type { Observable }            from 'rxjs';
import type { MessageEvent }          from '@nestjs/common';
import { OrchestratorService }        from '../orchestrator/orchestrator.service';
import { ExecutionStoreService }      from '../orchestrator/execution/execution-store.service';
import { GlobalMemoryService }        from '../global-memory/global-memory.service';
import { ProductOrchestratorService } from './user/product-orchestrator.service';
import { Public }                     from '../common/decorators/public.decorator';
import { assertClientScope }          from '../common/guards/client-scope';
import type { DecideInput }           from '../orchestrator/orchestrator.types';
import type { DecisionExecution }     from '../orchestrator/execution/execution.types';
import type { ProductOutput }         from './user/product.types';

// ── Request shape ─────────────────────────────────────────────────────────────

class DecisionRequestDto implements DecideInput {
  client_id?:   string;
  campaign_id?: string;
  user_id?:     string;
  goal?:        string;
  emotion?:     string;
  format?:      string;
  industry?:    string;
}

// ── Controller ────────────────────────────────────────────────────────────────

@ApiTags('product')
@Controller('product')
export class ProductController {
  private readonly logger = new Logger(ProductController.name);

  constructor(
    private readonly orchestrator:       OrchestratorService,
    private readonly executionStore:     ExecutionStoreService,
    private readonly globalMemory:       GlobalMemoryService,
    private readonly productOrchestrator: ProductOrchestratorService,
  ) {}

  // ── Synchronous decide — returns complete DecisionExecution ───────────────
  // Use this for one-shot requests where the caller can wait for the result.

  @Post('decision')
  @ApiOperation({ summary: 'Run full orchestration and return complete DecisionExecution' })
  async decision(@Body() dto: DecisionRequestDto): Promise<DecisionExecution> {
    assertClientScope(dto.client_id);
    return this.orchestrator.executeDecision(dto);
  }

  // ── Async start — returns executionId immediately ─────────────────────────
  // Use this with polling or SSE when you need immediate response + progressive UI.

  @Post('execution/start')
  @ApiOperation({ summary: 'Start async execution, return executionId for polling/SSE' })
  startExecution(@Body() dto: DecisionRequestDto): { executionId: string } {
    assertClientScope(dto.client_id);
    const executionId = randomUUID();
    // Fire execution in background; store tracks all state transitions
    this.orchestrator.executeDecision(dto, executionId).catch(err =>
      this.logger.error(`background execution ${executionId} rejected: ${(err as Error).message}`),
    );
    return { executionId };
  }

  // ── Poll — returns current execution state ────────────────────────────────

  @Get('execution/:id')
  @ApiOperation({ summary: 'Poll execution state by executionId' })
  getExecution(@Param('id') id: string): DecisionExecution {
    const exec = this.executionStore.get(id);
    if (!exec) throw new NotFoundException(`execution ${id} not found`);
    return exec;
  }

  // ── SSE stream — pushes events as execution progresses ───────────────────
  // Replays past events on connect; completes when phase = completed | failed.

  @Sse('execution/:id/stream')
  @ApiOperation({ summary: 'SSE stream of execution lifecycle events' })
  streamExecution(@Param('id') id: string): Observable<MessageEvent> {
    const exec = this.executionStore.get(id);
    if (!exec) throw new NotFoundException(`execution ${id} not found`);
    return this.executionStore.stream(id);
  }

  // ── Memory snapshot ───────────────────────────────────────────────────────

  @Get('memory')
  @ApiOperation({ summary: 'Current global + client memory snapshot' })
  async memory(
    @Query('client_id')  clientId:  string,
    @Query('industry')   industry?: string,
    @Query('angle')      angle?:    string,
  ) {
    assertClientScope(clientId);
    return this.globalMemory.query(clientId, industry, angle);
  }

  // ── System status ─────────────────────────────────────────────────────────

  @Get('status')
  @ApiOperation({ summary: 'Lightweight system health and stability state' })
  async status() {
    return this.orchestrator.status();
  }

  // ── Quick concept generation — no project required ────────────────────────
  // Public endpoint for the creator UI. Takes goal + context, returns a
  // ProductOutput (human language only — no engine internals).

  @Public()
  @Post('generate/concepts')
  @ApiOperation({ summary: 'Generate ad concepts without a project (anonymous quick mode)' })
  async generateConcepts(
    @Body() dto: { goal?: string; context?: string },
  ): Promise<ProductOutput> {
    return this.productOrchestrator.generate(
      {
        id:        'anon',
        name:      'Quick Generate',
        goal:      dto.goal    ?? '',
        context:   dto.context ?? '',
        clientId:  'anonymous',
        createdAt: new Date().toISOString(),
      },
    );
  }
}
