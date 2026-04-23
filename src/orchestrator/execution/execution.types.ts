// ─── Phase 6.1 — Unified Execution Types ─────────────────────────────────────
// DecisionExecution is the single output of executeDecision().
// Explanation is generated inside the execution pipeline — never externally.

import type { OrchestratorDecision, AngleSignalBundle } from '../orchestrator.types';
import type { DecisionExplanation }   from '../../product/view-models/decision.view-model';
import type { DecisionPageViewModel } from '../../product/view-models/decision.view-model';

// ── Execution lifecycle ───────────────────────────────────────────────────────

export type ExecutionPhase =
  | 'started'
  | 'signals'
  | 'decision'
  | 'explanation'
  | 'completed'
  | 'failed';

export interface ExecutionEvent {
  phase:     ExecutionPhase;
  timestamp: number;
  data?:     unknown;
}

// ── Explained bundle — bundle + explanation from same snapshot ────────────────
// Explanation is attached during Phase 3 of executeDecision(), never later.

export interface ExplainedBundle extends AngleSignalBundle {
  explanation: DecisionExplanation;
}

// ── Unified execution result ──────────────────────────────────────────────────

export interface DecisionExecution {
  executionId:  string;
  phase:        ExecutionPhase;
  startedAt:    number;
  completedAt?: number;
  durationMs?:  number;
  events:       ExecutionEvent[];
  // Set after phase 'decision'
  decision?:    OrchestratorDecision;
  // Set after phase 'explanation' — bundles carry pre-computed explanations
  bundles?:     ExplainedBundle[];
  // Set after phase 'completed' — ViewModel built from the same snapshot
  viewModel?:   DecisionPageViewModel;
  error?:       string;
}
