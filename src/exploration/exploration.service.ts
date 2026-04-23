// ─── 4.5 Adaptive Exploration Engine — Service ───────────────────────────────
//
// Data loader and orchestration wrapper for the pure exploration engine.
//
// Data sources (each read once per request, no N+1):
//   memory   signal → CreativeMemory (recent angle performance history)
//   fatigue  signal → FatigueService.computeBatch() OR pre-loaded Map from caller
//   mirofish signal → MirofishSignal.learningSignalStrength (NOT predictionError)
//
// Anti-double-counting guarantees:
//   • Memory: stagnation only — no MIROFISH data re-used here
//   • Fatigue: consumes 4.4 exploration_signal (which already absorbed mirofishNegativeDelta)
//              BLOCKED angles excluded per spec
//   • MIROFISH: learningSignalStrength only — never predictionError
//
// When `preloadedFatigue` is provided by the caller, the FatigueService DB call
// is skipped entirely — the caller's already-loaded Map is used directly.
// ─────────────────────────────────────────────────────────────────────────────

import { Injectable, Optional } from '@nestjs/common';
import { PrismaService }        from '../prisma/prisma.service';
import { FatigueService }       from '../fatigue/fatigue.service';
import { ExplorationDeltaStore } from './exploration-delta.store';

import {
  computeMemorySignal,
  computeFatigueSignal,
  computeMirofishSignal,
  computeExplorationPressure,
} from './exploration.engine';

import {
  ExplorationPressureInput,
  ExplorationPressureResult,
  ExplorationRawSignals,
} from './exploration.types';

const DEFAULT_LOOKBACK = 30;
const EWMA_ALPHA       = 0.30;  // weight for current observation; prev gets 0.70

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class ExplorationService {
  constructor(
    private readonly prisma:      PrismaService,
    private readonly deltaStore:  ExplorationDeltaStore,
    @Optional() private readonly fatigueSvc: FatigueService,
  ) {}

  // ── Public API ────────────────────────────────────────────────────────────

  async computePressure(
    input: ExplorationPressureInput,
  ): Promise<ExplorationPressureResult> {
    const { userId, clientId, goal, lookback = DEFAULT_LOOKBACK, preloadedFatigue } = input;

    // ── Load all data in parallel ─────────────────────────────────────────

    const [memRecords, mirofishStrengths, fatigueResults] = await Promise.all([
      this.loadMemoryRecords(userId, clientId, lookback),
      this.loadMirofishStrengths(),
      this.loadFatigueSignals(preloadedFatigue, userId, clientId),
    ]);

    // ── Build raw signals ─────────────────────────────────────────────────

    // Memory signal — stagnation / diversity / winner stability from recent memory
    const memorySignal = computeMemorySignal(memRecords);

    // Fatigue signal — average exploration_signal from non-BLOCKED angles (4.4 output)
    // BLOCKED angles excluded per spec: "BLOCKED → NO direct impact (handled upstream)"
    const nonBlockedSignals = fatigueResults
      .filter(r => r.fatigue_state !== 'BLOCKED')
      .map(r => r.exploration_signal);
    const fatigueSignal = computeFatigueSignal(nonBlockedSignals);

    // MIROFISH signal — uncertainty from learningSignalStrength only (not predictionError)
    const mirofishSignal = computeMirofishSignal(mirofishStrengths);

    // ── Assemble raw signals object ───────────────────────────────────────

    const raw: ExplorationRawSignals = {
      memorySignal,
      fatigueSignal,
      mirofishSignal,
      memoryRecordCount:   memRecords.length,
      mirofishRecordCount: mirofishStrengths.filter(s => s !== null).length,
      fatigueAngleCount:   fatigueResults.length,
    };

    const result = computeExplorationPressure(raw);

    // EWMA smoothing: blends current delta with the previous result for this context.
    // Prevents sharp swings between consecutive requests from the same user/client.
    // State is persisted via ExplorationDeltaStore — swap to Redis/DB for multi-instance.
    const ctxKey  = `${userId ?? ''}:${clientId ?? ''}`;
    const prev    = (await this.deltaStore.get(ctxKey)) ?? undefined;
    if (prev !== undefined && isFinite(prev)) {
      const smoothed = prev * (1 - EWMA_ALPHA) + result.exploration_pressure_delta * EWMA_ALPHA;
      const clamped  = Math.min(0.25, Math.max(-0.10, Math.round(smoothed * 10000) / 10000));
      await this.deltaStore.set(ctxKey, clamped);
      return { ...result, exploration_pressure_delta: clamped };
    }
    await this.deltaStore.set(ctxKey, result.exploration_pressure_delta);
    return result;
  }

  // ── Data loaders ──────────────────────────────────────────────────────────

  private async loadMemoryRecords(
    userId?:   string,
    clientId?: string,
    lookback = DEFAULT_LOOKBACK,
  ): Promise<{ angle: string; totalScore: number; isWinner: boolean }[]> {
    return this.prisma.creativeMemory.findMany({
      where: {
        ...(userId   ? { userId }   : {}),
        ...(clientId ? { clientId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take:    lookback,
      select:  { angle: true, totalScore: true, isWinner: true },
    });
  }

  /**
   * Load recent learningSignalStrength values from MirofishSignal.
   * ONLY this field is read — NOT predictionError (which 4.4 fatigue already uses).
   * This is the single point of MIROFISH access for the 4.5 exploration engine.
   */
  private async loadMirofishStrengths(): Promise<(number | null)[]> {
    const records = await this.prisma.mirofishSignal.findMany({
      orderBy: { createdAt: 'desc' },
      take:    20,
      select:  { learningSignalStrength: true },
    });
    return records.map(r => r.learningSignalStrength);
  }

  /**
   * Load 4.4 fatigue results.
   * If the caller already has a fatigue Map (preloadedFatigue), use it directly —
   * this prevents redundant DB queries and eliminates any risk of data re-use that
   * could constitute double-counting between the fatigue and exploration layers.
   */
  private async loadFatigueSignals(
    preloaded?: Map<string, import('../fatigue/fatigue.types').AngleFatigueResult>,
    userId?:   string,
    clientId?: string,
  ): Promise<import('../fatigue/fatigue.types').AngleFatigueResult[]> {
    // Prefer pre-loaded data from the calling context
    if (preloaded && preloaded.size > 0) {
      return [...preloaded.values()];
    }

    // FatigueService not available → return empty (engine handles gracefully)
    if (!this.fatigueSvc) return [];

    return this.fatigueSvc.computeAll(userId, clientId).catch(() => []);
  }
}
