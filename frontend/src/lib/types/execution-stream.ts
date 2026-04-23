// ─── Phase 6.2 — Execution Stream State ──────────────────────────────────────
// Frontend state machine derived from SSE events.
// This is what components read — never raw API shapes.

import type { DecisionPageViewModel } from './view-models';
import type { ExecutionPhase }        from './execution';

export interface TimelineEntry {
  phase:     ExecutionPhase;
  timestamp: number;
  label:     string;
  data?:     unknown;
}

export interface ExecutionStreamState {
  executionId:   string;
  status:        ExecutionPhase;
  currentStep:   string;       // human-readable in-progress label
  signalCount:   number | null;
  leadingAngle:  string | null; // from 'decision' event payload
  viewModel:     DecisionPageViewModel | null;
  timeline:      TimelineEntry[];
  startedAt:     number;
  completedAt:   number | null;
  durationMs:    number | null;
  error:         string | null;
}

// ── Step label builder ────────────────────────────────────────────────────────

export function buildStepLabel(phase: ExecutionPhase, data?: unknown): string {
  switch (phase) {
    case 'started':     return 'Initialising AI engine…';
    case 'signals': {
      const d = data as { count?: number } | undefined;
      return `Computing signals for ${d?.count ?? '?'} angles`;
    }
    case 'decision': {
      const d = data as { primary?: string } | undefined;
      return d?.primary ? `Decision resolved — primary: ${d.primary}` : 'Resolving decision';
    }
    case 'explanation': {
      const d = data as { count?: number } | undefined;
      return `Generating explanations for ${d?.count ?? '?'} angles`;
    }
    case 'completed':   return 'Execution complete';
    case 'failed':      return 'Execution failed';
  }
}
