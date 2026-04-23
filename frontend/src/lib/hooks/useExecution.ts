'use client';

// ─── Phase 6.2 — useExecution hook ───────────────────────────────────────────
// Manages full lifecycle: start → SSE events → final poll → sealed state.
// Components read ExecutionStreamState; they never call API directly.

import { useState, useRef, useCallback } from 'react';
import { startExecution, streamExecution, pollExecution } from '../api/client';
import type { DecisionRequest } from '../api/client';
import type { ExecutionStreamState, TimelineEntry } from '../types/execution-stream';
import type { ExecutionPhase } from '../types/execution';
import { buildStepLabel } from '../types/execution-stream';

const BLANK: Omit<ExecutionStreamState, 'executionId' | 'startedAt'> = {
  status:       'started',
  currentStep:  'Initialising AI engine…',
  signalCount:  null,
  leadingAngle: null,
  viewModel:    null,
  timeline:     [],
  completedAt:  null,
  durationMs:   null,
  error:        null,
};

export function useExecution() {
  const [state,   setState]   = useState<ExecutionStreamState | null>(null);
  const [running, setRunning] = useState(false);
  const esRef                 = useRef<EventSource | null>(null);

  const run = useCallback(async (request: DecisionRequest) => {
    // Close any in-flight stream
    esRef.current?.close();
    setRunning(true);

    const startedAt = Date.now();
    let executionId: string;

    try {
      executionId = await startExecution(request);
    } catch (err) {
      setState({
        executionId:  '',
        ...BLANK,
        startedAt,
        status:      'failed',
        currentStep: 'Failed to start',
        error:       (err as Error).message,
      });
      setRunning(false);
      return;
    }

    setState({ executionId, ...BLANK, startedAt });

    esRef.current = streamExecution(
      executionId,
      // onEvent — update stream state on each SSE message
      (raw) => {
        const event = raw as { phase: ExecutionPhase; timestamp: number; data?: unknown };
        const entry: TimelineEntry = {
          phase:     event.phase,
          timestamp: event.timestamp,
          label:     buildStepLabel(event.phase, event.data),
          data:      event.data,
        };

        setState(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            status:      event.phase,
            currentStep: buildStepLabel(event.phase, event.data),
            signalCount: event.phase === 'signals'
              ? (event.data as { count?: number })?.count ?? prev.signalCount
              : prev.signalCount,
            leadingAngle: event.phase === 'decision'
              ? (event.data as { primary?: string })?.primary ?? prev.leadingAngle
              : prev.leadingAngle,
            timeline: [...prev.timeline, entry],
          };
        });
      },
      // onDone — SSE closed; fetch final sealed state once
      async () => {
        try {
          const exec = await pollExecution(executionId);
          setState(prev => prev ? {
            ...prev,
            status:      exec.phase,
            currentStep: buildStepLabel(exec.phase),
            viewModel:   exec.viewModel ?? null,
            completedAt: exec.completedAt ?? null,
            durationMs:  exec.durationMs  ?? null,
            error:       exec.error       ?? null,
          } : prev);
        } catch { /* best effort */ }
        finally    { setRunning(false); }
      },
    );
  }, []);

  return { state, running, run };
}
