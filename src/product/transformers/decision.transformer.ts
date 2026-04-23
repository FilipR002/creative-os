// ─── Phase 6.1 — Decision Transformer ────────────────────────────────────────
// Maps pre-explained bundles → DecisionPageViewModel.
// Explanation is NOT recomputed here — it comes from the execution snapshot.

import { OrchestratorDecision }   from '../../orchestrator/orchestrator.types';
import { ExplainedBundle }         from '../../orchestrator/execution/execution.types';
import {
  ConflictSummary,
  DecisionPageViewModel,
  DecisionViewModel,
  SignalBreakdown,
} from '../view-models/decision.view-model';

function toBreakdown(b: ExplainedBundle): SignalBreakdown {
  return {
    memory:      b.memoryScore,
    scoring:     b.scoringAlignment,
    mirofish:    b.mirofishSignal,
    blending:    b.blendingCompatibility,
    exploration: b.explorationFactor,
  };
}

function toDecisionViewModel(bundle: ExplainedBundle): DecisionViewModel {
  return {
    angle:        bundle.slug,
    score:        Math.round(bundle.finalWeight * 100),
    confidence:   Math.min(1, bundle.sampleCount / 10),
    fatigueLevel: bundle.fatigueLevel,
    rankPosition: bundle.rankPosition,
    explanation:  bundle.explanation,   // pre-computed in execution pipeline
    breakdown:    toBreakdown(bundle),
  };
}

export function toDecisionPageViewModel(
  decision: OrchestratorDecision,
  bundles:  ExplainedBundle[],
): DecisionPageViewModel {
  return {
    primaryAngle:    decision.primary_angle,
    secondaryAngle:  decision.secondary_angle,
    stabilityState:  decision.system_stability_state,
    angles:          bundles.map(toDecisionViewModel),
    conflicts:       decision.conflict_resolution_log.map(c => ({
      description: c.conflict,
      resolution:  c.resolution,
      winner:      c.winner,
    } satisfies ConflictSummary)),
    systemReasoning: decision.final_decision_reasoning,
    meta: {
      anglesEvaluated:   decision._meta.angles_evaluated,
      conflictsDetected: decision._meta.conflicts_detected,
      mirofishOverruled: decision._meta.mirofish_overruled,
      computationMs:     decision._meta.computation_ms,
    },
  };
}
