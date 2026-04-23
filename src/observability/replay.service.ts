import { Injectable } from '@nestjs/common';
import { ObservabilityService } from './observability.service';
import { StoredTrace } from './models/decision-trace-builder';
import { DriftAnalysis, TraceDiff } from './models/decision-trace.model';

@Injectable()
export class ReplayService {
  constructor(private readonly obs: ObservabilityService) {}

  // ── Replay ─────────────────────────────────────────────────────────────────

  async replay(
    traceId: string,
  ): Promise<{ trace: StoredTrace; explanation: string } | null> {
    const trace = await this.obs.getTrace(traceId);
    if (!trace) return null;
    return { trace, explanation: buildExplanation(trace) };
  }

  // ── Compare ────────────────────────────────────────────────────────────────

  async compareTraces(traceId1: string, traceId2: string): Promise<TraceDiff | null> {
    const [t1, t2] = await Promise.all([
      this.obs.getTrace(traceId1),
      this.obs.getTrace(traceId2),
    ]);
    if (!t1 || !t2) return null;

    const flags1 = new Set([...t1.meta.blockedAngles, ...t1.meta.overrides]);
    const flags2 = new Set([...t2.meta.blockedAngles, ...t2.meta.overrides]);

    return {
      traceId1,
      traceId2,
      primaryChanged:   t1.decision.primaryAngle !== t2.decision.primaryAngle,
      primaryBefore:    t1.decision.primaryAngle,
      primaryAfter:     t2.decision.primaryAngle,
      weightDelta:      round2(t2.meta.confidence - t1.meta.confidence),
      conflictsDelta:   t2.meta.resolvedConflicts.length - t1.meta.resolvedConflicts.length,
      stabilityChanged: t1.meta.stability !== t2.meta.stability,
      newFlags:         [...flags2].filter(f => !flags1.has(f)),
      droppedFlags:     [...flags1].filter(f => !flags2.has(f)),
    };
  }

  // ── Drift analysis ─────────────────────────────────────────────────────────

  async analyzeDrift(campaignId: string): Promise<DriftAnalysis> {
    const traces = await this.obs.getTracesByCreative(campaignId, 20);

    if (traces.length < 3) {
      return {
        creativeId:  campaignId,
        status:      'stable',
        score:        0,
        flags:        ['INSUFFICIENT_DATA'],
        sampleCount:  traces.length,
        breakdown: { angleVolatility: 0, mirofishTrend: 0, fatigueEscalation: 0, explorationVolatility: 0 },
      };
    }

    // 1. Angle volatility
    const primaries       = traces.map(t => t.decision.primaryAngle);
    const angleVolatility = round2(new Set(primaries).size / primaries.length);

    // 2. MIROFISH signal trend (oldest → newest, positive slope = improving)
    const mirofishAvgs = [...traces].reverse().map(t =>
      t.signals.mirofish.length > 0
        ? t.signals.mirofish.reduce((s, m) => s + m.score, 0) / t.signals.mirofish.length
        : 0.5,
    );
    const mirofishTrend = round2(linearSlope(mirofishAvgs));

    // 3. Fatigue escalation: mean ratio of FATIGUED/BLOCKED angles
    const fatigueRatios = traces.map(t => {
      if (!t.signals.fatigue.length) return 0;
      const bad = t.signals.fatigue.filter(f => f.state === 'FATIGUED' || f.state === 'BLOCKED').length;
      return bad / t.signals.fatigue.length;
    });
    const fatigueEscalation = round2(avg(fatigueRatios));

    // 4. Exploration rate volatility
    const explorationRates      = traces.map(t => t.signals.exploration);
    const explorationVolatility = round2(stdDev(explorationRates));

    // Composite score
    const mirofishContrib = mirofishTrend < -0.02 ? 0.30 : 0;
    const driftScore = clamp(
      angleVolatility     * 0.30 +
      mirofishContrib             +
      fatigueEscalation   * 0.25 +
      explorationVolatility * 0.15,
    );

    const status: DriftAnalysis['status'] =
      driftScore >= 0.60 ? 'unstable'
      : driftScore >= 0.35 ? 'drifting'
      : 'stable';

    const flags: string[] = [];
    if (angleVolatility      > 0.60)  flags.push('HIGH_ANGLE_VOLATILITY');
    if (mirofishTrend        < -0.02) flags.push('MIROFISH_DEGRADING');
    if (fatigueEscalation    > 0.40)  flags.push('FATIGUE_ESCALATING');
    if (explorationVolatility > 0.15) flags.push('EXPLORATION_UNSTABLE');

    return {
      creativeId:  campaignId,
      status,
      score:        round2(driftScore),
      flags,
      sampleCount:  traces.length,
      breakdown:   { angleVolatility, mirofishTrend, fatigueEscalation, explorationVolatility },
    };
  }
}

// ─── Explanation builder ──────────────────────────────────────────────────────

function buildExplanation(t: StoredTrace): string {
  const parts: string[] = [
    `Decision at ${new Date(t.timestamp).toISOString()}: primary="${t.decision.primaryAngle}" ` +
    `(confidence=${(t.meta.confidence * 100).toFixed(1)}%)`,
    `Goal: ${t.meta.goal}${t.meta.emotion ? `, emotion: ${t.meta.emotion}` : ''}`,
  ];

  if (t.decision.secondaryAngle) {
    parts.push(`Secondary blend: "${t.decision.secondaryAngle}"`);
  }

  // Exploration angles from the stable contract (Patch 3 type boundary)
  const selected = t.decision.exploration as Array<{ slug: string; confidence: number }>;
  if (selected.length > 0) {
    parts.push(`Explore: ${selected.map(e => e.slug).join(', ')}`);
  }

  const topMemory = t.signals.memory
    .slice()
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(m => `${m.slug}(${m.score.toFixed(3)})`)
    .join(', ');
  if (topMemory) parts.push(`Top memory: ${topMemory}`);

  if (t.meta.resolvedConflicts.length > 0) {
    parts.push(`${t.meta.resolvedConflicts.length} conflict(s) resolved`);
  }
  if (t.meta.blockedAngles.length > 0) {
    parts.push(`Blocked: ${t.meta.blockedAngles.join(', ')}`);
  }

  parts.push(`System stability: ${t.meta.stability}`);

  return parts.join(' | ');
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function avg(arr: number[]): number {
  return arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
}

function stdDev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const mean = avg(arr);
  const variance = arr.reduce((s, v) => s + (v - mean) ** 2, 0) / arr.length;
  return Math.sqrt(variance);
}

function linearSlope(arr: number[]): number {
  const n = arr.length;
  if (n < 2) return 0;
  const meanX = (n - 1) / 2;
  const meanY = avg(arr);
  let num = 0, den = 0;
  arr.forEach((y, x) => { num += (x - meanX) * (y - meanY); den += (x - meanX) ** 2; });
  return den !== 0 ? num / den : 0;
}

function clamp(v: number, lo = 0, hi = 1): number { return Math.min(hi, Math.max(lo, v)); }
function round2(v: number): number { return Math.round(v * 100) / 100; }
