// ─── Phase 6.1 — Execution Store ─────────────────────────────────────────────
// Holds in-flight and recently completed DecisionExecution entries.
// Bridges async orchestration with SSE polling consumers.

import {
  Injectable,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { EventEmitter }  from 'events';
import { Observable }    from 'rxjs';
import type { MessageEvent } from '@nestjs/common';
import {
  DecisionExecution,
  ExecutionEvent,
  ExecutionPhase,
  ExplainedBundle,
} from './execution.types';
import type { OrchestratorDecision } from '../orchestrator.types';
import type { DecisionPageViewModel } from '../../product/view-models/decision.view-model';

const TTL_MS             = 30 * 60 * 1_000;   // retain executions for 30 min
const CLEANUP_INTERVAL   = 5  * 60 * 1_000;   // prune every 5 min
const MAX_LISTENERS      = 200;               // concurrent SSE subscribers

@Injectable()
export class ExecutionStoreService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly store   = new Map<string, DecisionExecution>();
  private readonly emitter = new EventEmitter();
  private cleanupTimer?: ReturnType<typeof setInterval>;

  onApplicationBootstrap(): void {
    this.emitter.setMaxListeners(MAX_LISTENERS);
    this.cleanupTimer = setInterval(() => this.cleanup(), CLEANUP_INTERVAL);
  }

  onApplicationShutdown(): void {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    this.emitter.removeAllListeners();
  }

  // ── Lifecycle mutators ────────────────────────────────────────────────────

  init(executionId: string): DecisionExecution {
    const exec: DecisionExecution = {
      executionId,
      phase:     'started',
      startedAt: Date.now(),
      events:    [],
    };
    this.store.set(executionId, exec);
    this.push(executionId, exec, { phase: 'started', timestamp: Date.now() });
    return exec;
  }

  advance(executionId: string, phase: ExecutionPhase, data?: unknown): void {
    const exec = this.store.get(executionId);
    if (!exec) return;
    exec.phase = phase;
    this.push(executionId, exec, { phase, timestamp: Date.now(), data });
  }

  complete(
    executionId: string,
    result: {
      decision:  OrchestratorDecision;
      bundles:   ExplainedBundle[];
      viewModel: DecisionPageViewModel;
    },
  ): void {
    const exec = this.store.get(executionId);
    if (!exec) return;

    exec.decision    = result.decision;
    exec.bundles     = result.bundles;
    exec.viewModel   = result.viewModel;
    exec.phase       = 'completed';
    exec.completedAt = Date.now();
    exec.durationMs  = exec.completedAt - exec.startedAt;

    this.push(executionId, exec, { phase: 'completed', timestamp: exec.completedAt });
    this.emitter.removeAllListeners(executionId);
  }

  fail(executionId: string, error: string): void {
    const exec = this.store.get(executionId);
    if (!exec) return;

    exec.phase       = 'failed';
    exec.error       = error;
    exec.completedAt = Date.now();
    exec.durationMs  = exec.completedAt - exec.startedAt;

    this.push(executionId, exec, { phase: 'failed', timestamp: exec.completedAt, data: { error } });
    this.emitter.removeAllListeners(executionId);
  }

  // ── Read ──────────────────────────────────────────────────────────────────

  get(executionId: string): DecisionExecution | null {
    return this.store.get(executionId) ?? null;
  }

  // ── SSE stream ────────────────────────────────────────────────────────────
  // Replays all past events immediately, then emits live events until terminal.

  stream(executionId: string): Observable<MessageEvent> {
    return new Observable(subscriber => {
      const existing = this.store.get(executionId);

      if (!existing) {
        subscriber.error(new Error(`execution ${executionId} not found`));
        return;
      }

      // Replay events that already happened before the subscriber connected.
      for (const event of existing.events) {
        subscriber.next({ data: event } as MessageEvent);
      }

      if (existing.phase === 'completed' || existing.phase === 'failed') {
        subscriber.complete();
        return;
      }

      const handler = (event: ExecutionEvent) => {
        subscriber.next({ data: event } as MessageEvent);
        if (event.phase === 'completed' || event.phase === 'failed') {
          subscriber.complete();
        }
      };

      this.emitter.on(executionId, handler);
      return () => this.emitter.off(executionId, handler);
    });
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  private push(executionId: string, exec: DecisionExecution, event: ExecutionEvent): void {
    exec.events.push(event);
    this.emitter.emit(executionId, event);
  }

  private cleanup(): void {
    const cutoff = Date.now() - TTL_MS;
    for (const [id, exec] of this.store) {
      if (exec.startedAt < cutoff) this.store.delete(id);
    }
  }
}
