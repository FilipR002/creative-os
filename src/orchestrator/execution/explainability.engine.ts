// ─── Phase 6.1 — Explainability Engine (execution-layer) ─────────────────────
// Called INSIDE executeDecision() on the live signal snapshot.
// Must never be called after the execution completes — explanation IS the snapshot.

import { AngleSignalBundle, OrchestratorDecision } from '../orchestrator.types';
import { DecisionExplanation }                      from '../../product/view-models/decision.view-model';

function parseInfluence(pct: string): number {
  return parseFloat(pct.replace('%', '')) / 100;
}

function describeMemory(score: number, wins: number, samples: number): string {
  if (samples < 3)   return 'limited historical data';
  if (score >= 0.75) return `strong memory signal (${wins}/${samples} wins)`;
  if (score >= 0.55) return `moderate memory signal (${wins}/${samples} wins)`;
  return `weak memory signal (${wins}/${samples} wins)`;
}

function describeFatigue(level: AngleSignalBundle['fatigueLevel']): string {
  switch (level) {
    case 'HEALTHY':  return 'healthy fatigue state';
    case 'WARMING':  return 'mild audience fatigue';
    case 'FATIGUED': return 'elevated audience fatigue';
    case 'BLOCKED':  return 'blocked due to fatigue';
  }
}

function describeMirofish(signal: number, overruled: boolean): string {
  if (overruled)      return 'MIROFISH was overruled by memory authority';
  if (signal >= 0.75) return 'high MIROFISH confidence';
  if (signal >= 0.55) return 'moderate MIROFISH confidence';
  return 'low MIROFISH signal';
}

function describeExploration(factor: number): string {
  if (factor >= 0.70) return 'strong exploration boost (low recent usage)';
  if (factor >= 0.55) return 'mild exploration boost';
  return 'no exploration pressure';
}

function buildFinalReasoning(bundle: AngleSignalBundle): string {
  const parts = [
    describeMemory(bundle.memoryScore, bundle.winCount, bundle.sampleCount),
    describeFatigue(bundle.fatigueLevel),
    describeMirofish(bundle.mirofishSignal, bundle.mirofishOverruled),
  ];
  if (bundle.explorationFactor >= 0.55) parts.push(describeExploration(bundle.explorationFactor));
  return `Selected because: ${parts.join(', ')}.`;
}

function buildConfidenceNote(bundle: AngleSignalBundle, decision: OrchestratorDecision): string {
  if (bundle.sampleCount < 5)                     return 'Low confidence — insufficient sample history.';
  if (decision.system_stability_state === 'unstable') return 'System in unstable state — predictions less reliable.';
  if (decision.system_stability_state === 'warming')  return 'System warming up — confidence improving.';
  return 'Stable system — high decision confidence.';
}

export function explainAngle(
  bundle:   AngleSignalBundle,
  decision: OrchestratorDecision,
): DecisionExplanation {
  const bd = decision.decision_breakdown;
  return {
    memoryInfluence:      parseInfluence(bd.memory_influence),
    scoringInfluence:     parseInfluence(bd.scoring_influence),
    mirofishInfluence:    parseInfluence(bd.mirofish_influence),
    blendingInfluence:    parseInfluence(bd.blending_influence),
    explorationInfluence: parseInfluence(bd.exploration_influence),
    finalReasoning:       buildFinalReasoning(bundle),
    confidenceNote:       buildConfidenceNote(bundle, decision),
  };
}
