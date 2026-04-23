// ─── Frontend execution types — mirrors orchestrator/execution/execution.types.ts ─

import type { DecisionPageViewModel, DecisionExplanation, FatigueLevel } from './view-models';

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

export interface DecisionExecution {
  executionId:  string;
  phase:        ExecutionPhase;
  startedAt:    number;
  completedAt?: number;
  durationMs?:  number;
  events:       ExecutionEvent[];
  viewModel?:   DecisionPageViewModel;
  error?:       string;
}

export const PHASE_LABELS: Record<ExecutionPhase, string> = {
  started:     'Initialising',
  signals:     'Computing signals',
  decision:    'Resolving decision',
  explanation: 'Generating explanations',
  completed:   'Complete',
  failed:      'Failed',
};

export const PHASE_ORDER: ExecutionPhase[] = [
  'started', 'signals', 'decision', 'explanation', 'completed',
];
