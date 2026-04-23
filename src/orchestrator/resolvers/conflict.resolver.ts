// ─── Conflict Resolver ────────────────────────────────────────────────────────
//
// Deterministic 5-case conflict resolution engine for the Decision Orchestration
// Layer. All mutations are applied to a mutable copy of the AngleSignalBundle
// array. Returns a log of every resolution that fired.
//
// Priority hierarchy (hard):
//   4.2 Memory  >  4.1 Goal/Emotion  >  MIROFISH advisory  >  Exploration
//
// Case 1 — MIROFISH vs MEMORY
// Case 2 — High-ranked angle vs Fatigue (soft suppression)
// Case 3 — Blending vs Fatigue
// Case 4 — 4.1 vs 4.2 conflict (memory always overrides)
// Case 5 — Exploration vs Stability
// ─────────────────────────────────────────────────────────────────────────────

import { AngleSignalBundle, ConflictEntry } from '../orchestrator.types';

// ─── Tuning constants ─────────────────────────────────────────────────────────

/** MIROFISH signal reduction when memory overrules it (Case 1). */
const MIROFISH_OVERRULE_DAMPEN = 0.50;

/** Fatigue-based soft suppression multiplier applied to finalWeight (Case 2). */
const FATIGUE_SUPPRESSION_WARMING   = 0.85;
const FATIGUE_SUPPRESSION_FATIGUED  = 0.60;
const FATIGUE_SUPPRESSION_BLOCKED   = 0.00;   // hard block

/** Blending penalty when one partner is fatigued (Case 3). */
const BLEND_ONE_FATIGUED_PENALTY    = 0.75;

/** Exploration cap relative to the top memory anchor (Case 5). */
const EXPLORE_MAX_RELATIVE_TO_TOP   = 0.70;   // exploration score ≤ 70% of top memory score

// ─── Public API ───────────────────────────────────────────────────────────────

export interface ConflictResolutionResult {
  bundles: AngleSignalBundle[];
  log:     ConflictEntry[];
}

/**
 * Run all 5 conflict resolution passes over the signal bundle array.
 * Bundles are sorted by finalWeight (desc) before being returned.
 */
export function resolveConflicts(
  bundles: AngleSignalBundle[],
): ConflictResolutionResult {
  const log: ConflictEntry[] = [];

  // Work on a mutable shallow copy so callers keep their originals.
  const bs = bundles.map(b => ({ ...b }));

  resolveCase1_MirofishVsMemory(bs, log);
  resolveCase4_Signal41VsMemory(bs, log);   // 4 before 2/3 so memory scores are final first
  resolveCase2_HighRankedVsFatigue(bs, log);
  resolveCase3_BlendingVsFatigue(bs, log);
  resolveCase5_ExplorationVsStability(bs, log);

  // Re-sort after all mutations — stable tie-breaker on slug prevents non-deterministic ordering
  bs.sort((a, b) => b.finalWeight - a.finalWeight || a.slug.localeCompare(b.slug));

  // Re-assign rankPosition after sorting
  bs.forEach((b, i) => { b.rankPosition = i + 1; });

  return { bundles: bs, log };
}

// ─── Case 1 — MIROFISH vs MEMORY ─────────────────────────────────────────────
//
// If the MIROFISH signal would push an angle above its memory-derived position
// (memoryScore), memory wins.  The MIROFISH contribution is dampened and the
// angle is flagged mirofishOverruled.

function resolveCase1_MirofishVsMemory(
  bs: AngleSignalBundle[],
  log: ConflictEntry[],
): void {
  for (const b of bs) {
    // Conflict exists when MIROFISH signal is meaningfully higher than memory
    // score AND the angle owes its ranking to MIROFISH more than to memory.
    const mirofishLift  = b.mirofishSignal - b.memoryScore;
    const isConflicting = mirofishLift > 0.15;   // MIROFISH is at least 15 pts above memory

    if (!isConflicting) continue;

    const before = b.mirofishSignal;
    // Dampen MIROFISH toward the memory anchor
    b.mirofishSignal = b.memoryScore + mirofishLift * (1 - MIROFISH_OVERRULE_DAMPEN);
    // Recompute finalWeight inline (avoids import cycle with weight.resolver)
    b.finalWeight = clamp(
      b.memoryScore          * 0.45 +
      b.scoringAlignment     * 0.30 +
      b.mirofishSignal       * 0.15 +
      b.blendingCompatibility * 0.07 +
      b.explorationFactor    * 0.03,
    );
    b.mirofishOverruled = true;

    log.push({
      conflict:   `MIROFISH(${fmt(before)}) > MEMORY(${fmt(b.memoryScore)}) for "${b.slug}"`,
      resolution: 'MEMORY_PRIORITY — MIROFISH dampened to memory anchor',
      winner:     'memory',
    });
  }
}

// ─── Case 2 — High-ranked angle vs Fatigue ────────────────────────────────────
//
// A fatigued angle is not hard-blocked (unless BLOCKED), only suppressed.
// Soft suppression multiplies finalWeight so it naturally falls in ranking.

function resolveCase2_HighRankedVsFatigue(
  bs: AngleSignalBundle[],
  log: ConflictEntry[],
): void {
  for (const b of bs) {
    let multiplier = 1.0;

    switch (b.fatigueLevel) {
      case 'WARMING':  multiplier = FATIGUE_SUPPRESSION_WARMING;  break;
      case 'FATIGUED': multiplier = FATIGUE_SUPPRESSION_FATIGUED; break;
      case 'BLOCKED':  multiplier = FATIGUE_SUPPRESSION_BLOCKED;  break;
      default:         continue;  // HEALTHY — no action needed
    }

    if (multiplier === 1.0) continue;

    const before = b.finalWeight;
    b.finalWeight = clamp(b.finalWeight * multiplier);

    log.push({
      conflict:   `"${b.slug}" is ${b.fatigueLevel} with weight ${fmt(before)}`,
      resolution: multiplier === 0
        ? 'FATIGUE_BLOCK — angle zeroed out (BLOCKED state)'
        : `FATIGUE_SUPPRESS — finalWeight reduced ×${multiplier} → ${fmt(b.finalWeight)}`,
      winner:     multiplier === 0 ? 'fatigue_block' : 'soft_suppression',
    });
  }
}

// ─── Case 3 — Blending vs Fatigue ─────────────────────────────────────────────
//
// If the primary angle's blend partner is fatigued, blendingCompatibility is
// penalised. If both are fatigued, blending is blocked for this angle (compat → 0).

function resolveCase3_BlendingVsFatigue(
  bs: AngleSignalBundle[],
  log: ConflictEntry[],
): void {
  // Build a slug→fatigueLevel lookup
  const fatigueMap = new Map(bs.map(b => [b.slug, b.fatigueLevel]));

  for (const b of bs) {
    // Only angles that actually have a blend partner carry meaningful compat scores.
    // We identify "has a partner" as blendingCompatibility != 0.5 (baseline).
    // We can't know the partner slug here directly (it lives in the angle service),
    // so we apply a conservative rule: if the primary itself is fatigued, penalise
    // its blending score too — a fatigued angle shouldn't be a primary blending anchor.
    if (b.fatigueLevel === 'HEALTHY') continue;

    const isBothFatigued =
      b.fatigueLevel === 'FATIGUED' || b.fatigueLevel === 'BLOCKED';

    const before = b.blendingCompatibility;

    if (isBothFatigued) {
      b.blendingCompatibility = 0;
      b.finalWeight = clamp(
        b.memoryScore          * 0.45 +
        b.scoringAlignment     * 0.30 +
        b.mirofishSignal       * 0.15 +
        b.blendingCompatibility * 0.07 +
        b.explorationFactor    * 0.03,
      );
      log.push({
        conflict:   `"${b.slug}" is ${b.fatigueLevel} — blend disqualified`,
        resolution: 'BLEND_BLOCK — blendingCompatibility zeroed (angle too fatigued to blend)',
        winner:     'fatigue_block',
      });
    } else if (b.fatigueLevel === 'WARMING') {
      b.blendingCompatibility = clamp(b.blendingCompatibility * BLEND_ONE_FATIGUED_PENALTY);
      b.finalWeight = clamp(
        b.memoryScore          * 0.45 +
        b.scoringAlignment     * 0.30 +
        b.mirofishSignal       * 0.15 +
        b.blendingCompatibility * 0.07 +
        b.explorationFactor    * 0.03,
      );
      log.push({
        conflict:   `"${b.slug}" is WARMING — blend penalised (compat ${fmt(before)} → ${fmt(b.blendingCompatibility)})`,
        resolution: `BLEND_PENALTY ×${BLEND_ONE_FATIGUED_PENALTY}`,
        winner:     'soft_suppression',
      });
    }
  }
}

// ─── Case 4 — 4.1 (signal41) vs 4.2 (memoryScore) ────────────────────────────
//
// 4.1 is a binary goal/emotion match signal (0 | 0.5 | 1.0).
// When 4.1 would promote an angle above a memory-backed incumbent, memory wins.
// Concretely: if signal41 is HIGH (1.0) but memoryScore is LOW (<0.35), the
// angle's explorationFactor is boosted slightly rather than overriding memory
// ranking directly. This preserves 4.1 intent without breaking 4.2 priority.

function resolveCase4_Signal41VsMemory(
  bs: AngleSignalBundle[],
  log: ConflictEntry[],
): void {
  for (const b of bs) {
    const signal41High   = b.signal41 >= 1.0;
    const memoryWeak     = b.memoryScore < 0.35;
    const conflict       = signal41High && memoryWeak;

    if (!conflict) continue;

    // Instead of overriding, convert the 4.1 boost into a modest explorationFactor bump.
    // This lets the angle be considered without dethroning memory anchors.
    const boost = Math.min(0.15, (1.0 - b.memoryScore) * 0.20);
    b.explorationFactor = clamp(b.explorationFactor + boost);
    b.finalWeight = clamp(
      b.memoryScore          * 0.45 +
      b.scoringAlignment     * 0.30 +
      b.mirofishSignal       * 0.15 +
      b.blendingCompatibility * 0.07 +
      b.explorationFactor    * 0.03,
    );

    log.push({
      conflict:   `4.1 signal HIGH for "${b.slug}" but memory weak (${fmt(b.memoryScore)}) — override risk`,
      resolution: `MEMORY_PRIORITY — 4.1 intent converted to exploration boost (+${fmt(boost)} explorationFactor)`,
      winner:     'memory',
    });
  }
}

// ─── Case 5 — Exploration vs Stability ────────────────────────────────────────
//
// Exploration angles must never outrank top-performing historical angles.
// Cap any angle with high explorationFactor relative to the top memory anchor.

function resolveCase5_ExplorationVsStability(
  bs: AngleSignalBundle[],
  log: ConflictEntry[],
): void {
  if (bs.length === 0) return;

  // Top memory anchor = highest memoryScore
  const topMemory = Math.max(...bs.map(b => b.memoryScore));
  if (topMemory <= 0) return;

  const maxAllowedWeight = topMemory * EXPLORE_MAX_RELATIVE_TO_TOP;

  for (const b of bs) {
    // Only apply to angles whose finalWeight is driven primarily by exploration
    const explorationDominant = b.explorationFactor > 0.60;
    const exceedsMemoryAnchor = b.finalWeight > maxAllowedWeight;

    if (!explorationDominant || !exceedsMemoryAnchor) continue;

    const before = b.finalWeight;
    b.finalWeight = clamp(maxAllowedWeight);

    log.push({
      conflict:   `Exploration angle "${b.slug}" (weight ${fmt(before)}) would outrank memory anchor (top=${fmt(topMemory)})`,
      resolution: `STABILITY_CAP — finalWeight capped at ${fmt(maxAllowedWeight)} (${EXPLORE_MAX_RELATIVE_TO_TOP * 100}% of top memory)`,
      winner:     'stability',
    });
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clamp(v: number): number {
  if (!isFinite(v)) return 0;
  return Math.min(1, Math.max(0, v));
}
function fmt(n: number): string   { return n.toFixed(3); }
