// ─── 4.10 Global Creative Memory — Engine (pure functions, no DI, no Prisma) ──
// Computes 4-layer memory updates from aggregated DB rows.
// The service feeds pre-fetched data; this file does all the math + insights.

import {
  AngleAggregateRow,
  AngleMemoryUpdate,
  CampaignMemoryUpdate,
  GlobalMemoryIngestInput,
  GlobalMemoryOutput,
  HookBoosterIngestRef,
  HookMemoryUpdate,
  LearningTrend,
  MirofishAccuracyRow,
  SystemMemoryUpdate,
  VariantIngestRecord,
} from './global-memory.types';

// ─── Constants ────────────────────────────────────────────────────────────────

const HALF_LIFE_DAYS          = 14;   // decay half-life for angle freshness
const REPEAT_USE_REUSE_WINDOW = 5;    // runs within which same structure = reuse
const HEALTH_SCORE_WEIGHTS    = { angle: 0.40, learning: 0.35, mirofish: 0.25 };

// ─── Helpers ─────────────────────────────────────────────────────────────────

function clamp(v: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, v));
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

// ─── Layer 1: Angle Memory ────────────────────────────────────────────────────

export function computeAngleMemoryUpdates(
  rows: AngleAggregateRow[],
): AngleMemoryUpdate[] {
  return rows.map(row => {
    // Strength score: win rate (40%) + avg CTR (30%) + avg conversion (30%).
    const winRate       = row.uses > 0 ? row.wins / row.uses : 0;
    const strength_score = round2(clamp(winRate * 0.40 + row.avgCtr * 0.30 + row.avgConversion * 0.30));

    // Decay rate: exponential decay based on days since last use.
    const days      = row.daysSinceUsed ?? HALF_LIFE_DAYS;
    const decay_raw = 1 - Math.exp(-days / HALF_LIFE_DAYS);
    const decay_rate = round2(clamp(decay_raw));

    return {
      angle:          row.slug,
      ctr:            round2(row.avgCtr),
      conversion:     round2(row.avgConversion),
      retention:      round2(row.avgRetention),
      strength_score,
      decay_rate,
    };
  });
}

// ─── Layer 2: Hook Memory ─────────────────────────────────────────────────────

export interface HookPerfRow {
  structure:    string;
  format:       string;
  scores:       number[];   // 0–1 per run
  wins:         number;
  recentUses:   number;     // uses within REPEAT_USE_REUSE_WINDOW
}

export function computeHookMemoryUpdates(rows: HookPerfRow[]): HookMemoryUpdate[] {
  return rows.map(row => {
    const sample_count = row.scores.length;
    const avg_score    = sample_count > 0
      ? round2(row.scores.reduce((s, v) => s + v, 0) / sample_count)
      : 0;
    const win_rate    = sample_count > 0 ? round2(row.wins / sample_count) : 0;
    // Reuse penalty: linear from 0 at 1 use to 1 at REPEAT_USE_REUSE_WINDOW uses.
    const reuse_penalty = round2(clamp((row.recentUses - 1) / (REPEAT_USE_REUSE_WINDOW - 1)));

    return { structure: row.structure, format: row.format, avg_score, win_rate, sample_count, reuse_penalty };
  });
}

// ─── Layer 3: Campaign Memory ─────────────────────────────────────────────────

export function computeCampaignMemoryUpdates(
  input: GlobalMemoryIngestInput,
  variants: VariantIngestRecord[],
  mirofishAccuracy: number,
): CampaignMemoryUpdate[] {
  const winner      = variants.find(v => v.is_winner) ?? variants[0];
  const total_score = winner ? round2(winner.final_score / 100) : 0;
  const hasSecondary = !!input.secondary_angle;
  // Blending success: secondary angle was used AND total_score above 0.65.
  const blending_success = hasSecondary && total_score > 0.65;
  const angle_combination = hasSecondary
    ? `${input.primary_angle}|${input.secondary_angle}`
    : input.primary_angle;

  return [{
    campaign_id:       input.campaign_id,
    angle_combination,
    total_score,
    blending_success,
    mirofish_accuracy: round2(mirofishAccuracy),
  }];
}

// ─── Layer 4: System Memory ───────────────────────────────────────────────────

export function computeSystemMemoryUpdates(
  angleRows:          AngleAggregateRow[],
  learningTrend:      LearningTrend,
  mirofishAccuracy:   MirofishAccuracyRow,
): SystemMemoryUpdate {
  const drift_flags: string[] = [];

  // Angle health: penalise if many angles have high decay (not used recently).
  const highDecayCount = angleRows.filter(r => {
    const days = r.daysSinceUsed ?? HALF_LIFE_DAYS;
    return days > HALF_LIFE_DAYS;
  }).length;
  const angleHealthRaw = angleRows.length > 0
    ? 1 - (highDecayCount / angleRows.length) * 0.60
    : 0.50;

  // Overfitting check: if any single angle dominates (> 60% of recent wins).
  const totalWins = angleRows.reduce((s, r) => s + r.wins, 0);
  if (totalWins > 0) {
    const dominated = angleRows.find(r => r.wins / totalWins > 0.60);
    if (dominated) drift_flags.push(`ANGLE_OVERFITTING:${dominated.slug}`);
  }

  // Learning trend.
  const learningHealthRaw = clamp(0.50 + learningTrend.slope * 5 + (learningTrend.avgDelta > 0 ? 0.15 : -0.10));
  if (learningTrend.slope < -0.01 && learningTrend.sampleCount > 5) {
    drift_flags.push('LEARNING_REGRESSION_DETECTED');
  }

  // MIROFISH accuracy.
  const mirofishHealthRaw = clamp(1 - mirofishAccuracy.avgAbsError);
  if (mirofishAccuracy.isGrowing) {
    drift_flags.push('MIROFISH_DRIFT_DETECTED');
  }
  if (mirofishAccuracy.avgAbsError > 0.20) {
    drift_flags.push(`MIROFISH_HIGH_ERROR:${(mirofishAccuracy.avgAbsError * 100).toFixed(0)}pp`);
  }

  const system_health_score = round2(clamp(
    angleHealthRaw    * HEALTH_SCORE_WEIGHTS.angle +
    learningHealthRaw * HEALTH_SCORE_WEIGHTS.learning +
    mirofishHealthRaw * HEALTH_SCORE_WEIGHTS.mirofish,
  ));

  const learning_efficiency_index = round2(clamp(learningHealthRaw));

  return { system_health_score, learning_efficiency_index, drift_flags };
}

// ─── Insight generation ───────────────────────────────────────────────────────

export function generateInsights(output: Omit<GlobalMemoryOutput, 'insights'>): string[] {
  const insights: string[] = [];

  // Angle insights.
  if (output.angle_memory_updates.length > 0) {
    const sorted = [...output.angle_memory_updates].sort((a, b) => b.strength_score - a.strength_score);
    const best   = sorted[0];
    const worst  = sorted[sorted.length - 1];
    if (best) {
      insights.push(
        `Strongest angle: "${best.angle}" (strength ${(best.strength_score * 100).toFixed(0)}%, CTR ${(best.ctr * 100).toFixed(1)}%).`,
      );
    }
    if (worst && worst.angle !== best?.angle) {
      insights.push(
        `Weakest angle: "${worst.angle}" (strength ${(worst.strength_score * 100).toFixed(0)}%, decay rate ${(worst.decay_rate * 100).toFixed(0)}%).`,
      );
    }
    const decaying = sorted.filter(a => a.decay_rate > 0.60);
    if (decaying.length > 0) {
      insights.push(`${decaying.length} angle(s) showing high decay — consider refreshing: ${decaying.map(a => a.angle).join(', ')}.`);
    }
  }

  // Hook insights.
  const topHooks = [...output.hook_memory_updates].sort((a, b) => b.win_rate - a.win_rate);
  if (topHooks.length > 0) {
    const best = topHooks[0];
    insights.push(`Top hook structure: "${best.structure}" on ${best.format} (${(best.win_rate * 100).toFixed(0)}% win rate, ${best.sample_count} samples).`);
    const penalised = topHooks.filter(h => h.reuse_penalty > 0.60);
    if (penalised.length > 0) {
      insights.push(`${penalised.length} hook structure(s) flagged for overuse: ${penalised.map(h => h.structure).join(', ')}.`);
    }
  }

  // Campaign insights.
  const campaigns = output.campaign_memory_updates;
  if (campaigns.length > 0) {
    const blendSuccesses = campaigns.filter(c => c.blending_success).length;
    if (blendSuccesses > 0) {
      insights.push(`${blendSuccesses}/${campaigns.length} campaign(s) achieved successful angle blending.`);
    }
    const avgMirofish = campaigns.reduce((s, c) => s + c.mirofish_accuracy, 0) / campaigns.length;
    insights.push(`MIROFISH accuracy this batch: ${(avgMirofish * 100).toFixed(0)}%.`);
  }

  // System insights.
  const sys = output.system_memory_updates;
  insights.push(`System health: ${(sys.system_health_score * 100).toFixed(0)}% | Learning efficiency: ${(sys.learning_efficiency_index * 100).toFixed(0)}%.`);
  if (sys.drift_flags.length > 0) {
    insights.push(`⚠ Drift flags raised: ${sys.drift_flags.join(', ')}.`);
  }

  return insights;
}

// ─── Hook structure extraction ────────────────────────────────────────────────
// Derives hook patterns from hook-booster references for Layer 2.

export function extractHookPerfRows(
  refs:    HookBoosterIngestRef[],
  winners: Set<string>,  // winning hook texts
): HookPerfRow[] {
  const map = new Map<string, HookPerfRow>();

  for (const ref of refs) {
    const key = `${ref.strategy ?? 'unknown'}::${ref.format}`;
    const existing = map.get(key) ?? {
      structure: ref.strategy ?? 'unknown',
      format:    ref.format,
      scores:    [],
      wins:      0,
      recentUses: 0,
    };
    existing.scores.push(ref.strength_score ?? 0.50);
    existing.recentUses++;
    if (winners.has(ref.hook)) existing.wins++;
    map.set(key, existing);
  }

  return [...map.values()];
}
