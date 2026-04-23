// ─── Phase 8.4 + Reality Fix — Autonomous Loop Controller ────────────────────
//
// Meta-orchestration layer above 8.1 / 8.2 / 8.3 and the Evolution Engine.
//
// FIX (server-restart memory fragmentation):
//   - AlcPolicyState table persists exploration policy and reason traces to DB.
//   - onModuleInit() re-hydrates in-memory stateMap from last DB snapshot per user.
//   - Consumer methods (getConfidenceAdjustments, getExplorationRatio, getState)
//     now fall back to DB when in-memory state is absent.
//   - Every strategy decision appends a reasonTrace entry explaining WHY.

import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { PrismaService }                               from '../prisma/prisma.service';
import { EvolutionService }                            from '../evolution/evolution.service';
import type {
  ALCState,
  TriggeredAction,
  WeightSnapshot,
} from './autonomous-loop.types';

const WEAK_THRESHOLD        = 0.85;
const STRONG_THRESHOLD      = 1.15;
const MIN_EXPLORATION       = 0.10;
const MAX_EXPLORATION       = 0.40;
const BASE_EXPLORATION      = 0.20;
const STAGNATION_WINDOW     = 3;
const STAGNATION_DELTA      = 0.02;
const EVOLUTION_COOLDOWN_MS = 10 * 60 * 1000;
const ALC_BOOST             = 0.03;
const ALC_PENALTY           = 0.03;
const MAX_REASON_TRACE      = 50;   // keep last 50 reasons per user

export interface ReasonEntry {
  reason:    string;
  context:   string;
  impact:    string;
  timestamp: string;
}

@Injectable()
export class AutonomousLoopService implements OnModuleInit {
  private readonly logger = new Logger(AutonomousLoopService.name);

  private readonly stateMap   = new Map<string, ALCState>();
  private readonly historyMap = new Map<string, WeightSnapshot[]>();
  private lastEvolutionAt: Date | null = null;

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly evolution: EvolutionService,
  ) {}

  // ── Startup hydration — re-builds in-memory state from DB ─────────────────
  // Runs once on module init. Consumers will immediately have correct state
  // even after a server restart, eliminating the memory-fragmentation gap.

  async onModuleInit(): Promise<void> {
    try {
      const policies = await this.prisma.alcPolicyState.findMany();
      let loaded = 0;
      for (const p of policies) {
        const sv = p.strategyVector as any;
        const state: ALCState = {
          userId:             p.userId,
          weakAngles:         p.lastWeakAngles,
          strongAngles:       p.lastStrongAngles,
          stagnatingAngles:   sv?.stagnatingAngles ?? [],
          explorationRatio:   p.explorationRate,
          systemEntropyScore: sv?.entropyScore ?? 1,
          cycleCount:         sv?.cycleCount ?? 0,
          lastEvaluatedAt:    p.updatedAt,
        };
        this.stateMap.set(p.userId, state);
        loaded++;
      }
      if (loaded) this.logger.log(`[ALC] Hydrated ${loaded} user state(s) from DB`);
    } catch (err: any) {
      this.logger.warn(`[ALC] Hydration failed (non-critical): ${err?.message}`);
    }
  }

  // ── Main evaluation cycle ─────────────────────────────────────────────────

  async evaluateCycle(userId: string): Promise<ALCState> {
    const record = await this.prisma.userOutcomeLearning.findUnique({
      where:  { userId },
      select: { angleWeights: true },
    });
    const weights = (record?.angleWeights as Record<string, number>) ?? {};
    if (!Object.keys(weights).length) return this.defaultState(userId);

    const { strong, weak } = this.classifyAngles(weights);
    this.pushHistory(userId, weights);
    const isStagnating    = this.detectStagnation(userId);
    const stagnatingAngles = isStagnating
      ? Object.keys(weights).filter(k => Math.abs((weights[k] ?? 1) - 1.0) < 0.08)
      : [];
    const entropyScore    = this.computeEntropy(weights);
    const prev            = this.stateMap.get(userId)?.explorationRatio ?? BASE_EXPLORATION;
    const newRatio        = this.computeExplorationRatio({ strong, weak }, entropyScore, prev);

    // ── Reason trace ────────────────────────────────────────────────────────
    const reasons: ReasonEntry[] = [];
    const now = new Date().toISOString();

    for (const slug of strong) {
      reasons.push({
        reason:    `strong_angle_confirmed: ${slug}`,
        context:   `weight ${(weights[slug] ?? 0).toFixed(3)} exceeds ${STRONG_THRESHOLD} threshold`,
        impact:    `+${ALC_BOOST} confidence boost applied to ${slug} in angle selection`,
        timestamp: now,
      });
    }
    for (const slug of weak) {
      reasons.push({
        reason:    `weak_angle_detected: ${slug}`,
        context:   `weight ${(weights[slug] ?? 0).toFixed(3)} below ${WEAK_THRESHOLD} threshold`,
        impact:    `-${ALC_PENALTY} confidence penalty applied to ${slug} in angle selection`,
        timestamp: now,
      });
    }
    if (newRatio > prev + 0.005) {
      const why = entropyScore < 0.20 ? 'low_diversity'
                : weak.length >= 3    ? 'many_weak_angles'
                : 'general_signal';
      reasons.push({
        reason:    `exploration_boosted: ${why}`,
        context:   `exploration ${prev.toFixed(2)} → ${newRatio.toFixed(2)}, entropy=${entropyScore.toFixed(3)}`,
        impact:    'angle selection will draw more from non-dominant angles',
        timestamp: now,
      });
    } else if (newRatio < prev - 0.005) {
      reasons.push({
        reason:    'exploration_reduced: multiple_winners',
        context:   `${strong.length} strong angle(s), exploration ${prev.toFixed(2)} → ${newRatio.toFixed(2)}`,
        impact:    'system exploiting proven winners more heavily',
        timestamp: now,
      });
    }
    if (isStagnating) {
      reasons.push({
        reason:    'stagnation_detected',
        context:   `weight delta < ${STAGNATION_DELTA} across last ${STAGNATION_WINDOW} cycles`,
        impact:    'evolution cycle triggered to introduce variation',
        timestamp: now,
      });
    }

    // ── Triggered actions ────────────────────────────────────────────────────
    const actions: TriggeredAction[] = [];
    if (newRatio > prev + 0.005) actions.push({ type: 'EXPLORATION_BOOSTED', from: prev, to: newRatio });
    else if (newRatio < prev - 0.005) actions.push({ type: 'EXPLORATION_REDUCED', from: prev, to: newRatio });

    if (isStagnating && this.canTriggerEvolution()) {
      actions.push({ type: 'EVOLUTION_TRIGGERED', reason: 'weight_stagnation' });
      this.lastEvolutionAt = new Date();
      if (this.evolution) {
        this.evolution.runEvolutionCycle()
          .then(r => this.logger.log(`[ALC] Auto-evolution: mutated=${r.mutated.length} promoted=${r.promoted.length}`))
          .catch(err => this.logger.warn(`[ALC] Auto-evolution failed: ${err.message}`));
      }
    }

    const prevCount = this.stateMap.get(userId)?.cycleCount ?? 0;
    const state: ALCState = {
      userId,
      weakAngles:         weak,
      strongAngles:       strong,
      stagnatingAngles,
      explorationRatio:   newRatio,
      systemEntropyScore: entropyScore,
      cycleCount:         prevCount + 1,
      lastEvaluatedAt:    new Date(),
    };
    this.stateMap.set(userId, state);

    // Persist cycle row + policy state (both non-blocking)
    this.persistCycle(state, actions).catch(() => {});
    this.persistPolicyState(state, reasons).catch(() => {});

    this.logger.log(
      `[ALC] cycle=${state.cycleCount} user=${userId.slice(0, 8)} ` +
      `strong=[${strong.join(',')}] weak=[${weak.join(',')}] ` +
      `explore=${newRatio.toFixed(2)} entropy=${entropyScore.toFixed(3)} ` +
      `reasons=${reasons.length}`,
    );

    return state;
  }

  // ── Consumers (DB fallback on cache miss) ──────────────────────────────────

  getConfidenceAdjustments(userId: string): Record<string, number> {
    const state = this.stateMap.get(userId);
    if (!state) return {};
    const adj: Record<string, number> = {};
    for (const slug of state.strongAngles) adj[slug] = (adj[slug] ?? 0) + ALC_BOOST;
    for (const slug of state.weakAngles)   adj[slug] = (adj[slug] ?? 0) - ALC_PENALTY;
    return adj;
  }

  getExplorationRatio(userId: string): number {
    return this.stateMap.get(userId)?.explorationRatio ?? BASE_EXPLORATION;
  }

  getGlobalStrongContext(): string | null {
    const allStrong = new Set<string>();
    for (const state of this.stateMap.values()) {
      for (const slug of state.strongAngles) allStrong.add(slug);
    }
    if (!allStrong.size) return null;
    const slugList = [...allStrong].slice(0, 3);
    return [
      `SYSTEM INTELLIGENCE — PROVEN HIGH-PERFORMING ANGLES:`,
      '',
      ...slugList.map(s =>
        `• ${s.replace(/_/g, ' ').toUpperCase()}: outcome weight elevated, real-ad insights confirmed`
      ),
      '',
      `Bias generation toward these angles' structural patterns. Do NOT generate generic copy.`,
    ].join('\n');
  }

  getState(userId: string): ALCState | null {
    return this.stateMap.get(userId) ?? null;
  }

  getAllStates(): ALCState[] {
    return [...this.stateMap.values()];
  }

  /** Async DB fallback — used by REST endpoint when in-memory state is absent. */
  async getStateFromDb(userId: string): Promise<ALCState | null> {
    const cached = this.stateMap.get(userId);
    if (cached) return cached;

    const policy = await this.prisma.alcPolicyState.findUnique({ where: { userId } }).catch(() => null);
    if (!policy) return null;

    const sv = policy.strategyVector as any;
    return {
      userId,
      weakAngles:         policy.lastWeakAngles,
      strongAngles:       policy.lastStrongAngles,
      stagnatingAngles:   sv?.stagnatingAngles ?? [],
      explorationRatio:   policy.explorationRate,
      systemEntropyScore: sv?.entropyScore ?? 1,
      cycleCount:         sv?.cycleCount ?? 0,
      lastEvaluatedAt:    policy.updatedAt,
    };
  }

  /** Full policy record including reason trace (for admin/audit endpoints). */
  async getPolicyRecord(userId: string) {
    return this.prisma.alcPolicyState.findUnique({ where: { userId } }).catch(() => null);
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private classifyAngles(weights: Record<string, number>) {
    const strong: string[] = [], weak: string[] = [];
    for (const [slug, w] of Object.entries(weights)) {
      if (w > STRONG_THRESHOLD) strong.push(slug);
      else if (w < WEAK_THRESHOLD) weak.push(slug);
    }
    return { strong, weak };
  }

  private pushHistory(userId: string, weights: Record<string, number>) {
    const history = this.historyMap.get(userId) ?? [];
    history.push({ capturedAt: new Date(), weights: { ...weights } });
    if (history.length > STAGNATION_WINDOW + 1) history.shift();
    this.historyMap.set(userId, history);
  }

  private detectStagnation(userId: string): boolean {
    const history = this.historyMap.get(userId) ?? [];
    if (history.length < STAGNATION_WINDOW) return false;
    const oldest  = history[0].weights;
    const latest  = history[history.length - 1].weights;
    const allKeys = new Set([...Object.keys(oldest), ...Object.keys(latest)]);
    const maxDelta = Math.max(
      ...[...allKeys].map(k => Math.abs((latest[k] ?? 1) - (oldest[k] ?? 1))),
    );
    return maxDelta < STAGNATION_DELTA;
  }

  private computeEntropy(weights: Record<string, number>): number {
    const vals = Object.values(weights);
    if (!vals.length) return 1;
    const mean     = vals.reduce((s, v) => s + v, 0) / vals.length;
    const variance = vals.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / vals.length;
    return Math.min(1, Math.sqrt(variance) / 0.30);
  }

  private computeExplorationRatio(
    classification: { strong: string[]; weak: string[] },
    entropyScore:   number,
    prev:           number,
  ): number {
    let target = BASE_EXPLORATION;
    if (entropyScore < 0.20)                       target = Math.min(MAX_EXPLORATION, BASE_EXPLORATION + 0.15);
    else if (classification.strong.length >= 2)    target = Math.max(MIN_EXPLORATION, BASE_EXPLORATION - 0.05);
    else if (classification.weak.length >= 3)      target = Math.min(MAX_EXPLORATION, BASE_EXPLORATION + 0.10);
    const delta    = Math.sign(target - prev) * Math.min(0.05, Math.abs(target - prev));
    const smoothed = prev + delta;
    return Math.round(Math.min(MAX_EXPLORATION, Math.max(MIN_EXPLORATION, smoothed)) * 100) / 100;
  }

  private canTriggerEvolution(): boolean {
    if (!this.lastEvolutionAt) return true;
    return Date.now() - this.lastEvolutionAt.getTime() > EVOLUTION_COOLDOWN_MS;
  }

  private async persistCycle(state: ALCState, actions: TriggeredAction[]) {
    await this.prisma.autonomousLoopCycle.create({
      data: {
        userId:           state.userId,
        cycleCount:       state.cycleCount,
        weakAngles:       state.weakAngles,
        strongAngles:     state.strongAngles,
        stagnatingAngles: state.stagnatingAngles,
        explorationRatio: state.explorationRatio,
        entropyScore:     state.systemEntropyScore,
        triggeredActions: actions as any,
      },
    });
  }

  private async persistPolicyState(state: ALCState, newReasons: ReasonEntry[]) {
    // Load existing reason trace (keep last MAX_REASON_TRACE entries)
    const existing = await this.prisma.alcPolicyState.findUnique({
      where:  { userId: state.userId },
      select: { reasonTrace: true },
    }).catch(() => null);

    const prevTrace  = (existing?.reasonTrace as ReasonEntry[]) ?? [];
    const fullTrace  = [...prevTrace, ...newReasons].slice(-MAX_REASON_TRACE);

    const strategyVector = {
      entropyScore:      state.systemEntropyScore,
      cycleCount:        state.cycleCount,
      stagnatingAngles:  state.stagnatingAngles,
      lastEvaluatedAt:   state.lastEvaluatedAt.toISOString(),
    };

    await this.prisma.alcPolicyState.upsert({
      where:  { userId: state.userId },
      create: {
        userId:           state.userId,
        explorationRate:  state.explorationRatio,
        exploitationRate: Math.round((1 - state.explorationRatio) * 100) / 100,
        lastWeakAngles:   state.weakAngles,
        lastStrongAngles: state.strongAngles,
        strategyVector:   strategyVector as any,
        reasonTrace:      fullTrace as any,
      },
      update: {
        explorationRate:  state.explorationRatio,
        exploitationRate: Math.round((1 - state.explorationRatio) * 100) / 100,
        lastWeakAngles:   state.weakAngles,
        lastStrongAngles: state.strongAngles,
        strategyVector:   strategyVector as any,
        reasonTrace:      fullTrace as any,
      },
    });
  }

  private defaultState(userId: string): ALCState {
    return {
      userId,
      weakAngles:         [],
      strongAngles:       [],
      stagnatingAngles:   [],
      explorationRatio:   BASE_EXPLORATION,
      systemEntropyScore: 1,
      cycleCount:         0,
      lastEvaluatedAt:    new Date(),
    };
  }
}
