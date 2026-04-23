// ─── InteractionOutcome Schema ────────────────────────────────────────────────
// Every angle selection / skip / convert event writes one InteractionOutcome.
// This is the raw signal that feeds the self-learning loop.
//
// Storage: localStorage  key = cos_outcomes_{userId}
// Format:  ring-buffer capped at MAX_OUTCOMES (prevents unbounded growth)

import type { UserContext } from '../user-context';

// ── Types ─────────────────────────────────────────────────────────────────────

export type UserAction = 'select' | 'skip' | 'convert' | 'ignore' | 'explore';

export interface InteractionOutcome {
  id:               string;         // UUID
  userId:           string;
  angleSlug:        string;         // the angle this outcome is about
  presentedAngles:  string[];       // all angles shown in that session
  ignoredAngles:    string[];       // angles that were NOT selected
  userAction:       UserAction;
  engagementScore:  number;         // 0–1: time-weighted engagement proxy
  conversionSignal: boolean;        // did user proceed to generate creatives?
  timeToDecisionMs: number;         // ms from angles-displayed to selection
  contextSnapshot: {                // snapshot of UserContext at decision time
    goalType:     string;
    platform:     string;
    contentStyle: string;
    riskLevel:    string;
    industry:     string;
    offerType:    string;
  };
  timestamp: string;                // ISO 8601
}

// Compressed outcome stored in the ring-buffer (smaller footprint)
export interface StoredOutcome extends InteractionOutcome {
  version: 1;
}

// ── Storage ───────────────────────────────────────────────────────────────────

const MAX_OUTCOMES = 200;  // ring-buffer cap per user

function storageKey(userId: string): string {
  return `cos_outcomes_${userId.slice(0, 16)}`;
}

export function storeOutcome(outcome: InteractionOutcome): void {
  if (typeof window === 'undefined') return;
  const key  = storageKey(outcome.userId);
  const list = loadOutcomes(outcome.userId);
  list.push({ ...outcome, version: 1 });

  // Ring-buffer: drop oldest if over cap
  const trimmed = list.length > MAX_OUTCOMES
    ? list.slice(list.length - MAX_OUTCOMES)
    : list;

  try { localStorage.setItem(key, JSON.stringify(trimmed)); }
  catch { /* localStorage full — ignore */ }
}

export function loadOutcomes(userId: string): StoredOutcome[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(storageKey(userId));
    return raw ? (JSON.parse(raw) as StoredOutcome[]) : [];
  } catch { return []; }
}

// ── Outcome Builder ───────────────────────────────────────────────────────────

export function buildOutcome(params: {
  userId:          string;
  selectedSlug:    string;
  presentedSlugs:  string[];
  action:          UserAction;
  converted:       boolean;
  timeToDecisionMs: number;
  ctx:             UserContext;
}): InteractionOutcome {
  const ignored = params.presentedSlugs.filter(s => s !== params.selectedSlug);

  // Engagement proxy: fast but not instant = high engagement; instant or very slow = lower
  const t    = params.timeToDecisionMs;
  const engagement =
    t <= 0    ? 0.10 :
    t < 2000  ? 0.45 :
    t < 8000  ? 0.85 :  // sweet spot
    t < 20000 ? 0.70 :
                0.40;

  return {
    id:               crypto.randomUUID(),
    userId:           params.userId,
    angleSlug:        params.selectedSlug,
    presentedAngles:  params.presentedSlugs,
    ignoredAngles:    ignored,
    userAction:       params.action,
    engagementScore:  engagement,
    conversionSignal: params.converted,
    timeToDecisionMs: params.timeToDecisionMs,
    contextSnapshot: {
      goalType:     params.ctx.goalType,
      platform:     params.ctx.platform,
      contentStyle: params.ctx.contentStyle,
      riskLevel:    params.ctx.riskLevel,
      industry:     params.ctx.industry,
      offerType:    params.ctx.offerType,
    },
    timestamp: new Date().toISOString(),
  };
}

// ── Analytics helpers ─────────────────────────────────────────────────────────

/** Compute per-angle success metrics from stored outcomes. */
export function computeAngleMetrics(
  outcomes: StoredOutcome[],
  slug: string
): { successRate: number; skipRate: number; conversionRate: number; count: number } {
  const angleOutcomes = outcomes.filter(o => o.presentedAngles.includes(slug));
  if (angleOutcomes.length === 0) {
    return { successRate: 0.5, skipRate: 0.5, conversionRate: 0.5, count: 0 };
  }

  const selected   = angleOutcomes.filter(o => o.angleSlug === slug).length;
  const converted  = angleOutcomes.filter(o => o.angleSlug === slug && o.conversionSignal).length;
  const skipped    = angleOutcomes.filter(o => o.ignoredAngles.includes(slug)).length;

  return {
    successRate:    selected  / angleOutcomes.length,
    skipRate:       skipped   / angleOutcomes.length,
    conversionRate: converted / Math.max(selected, 1),
    count:          angleOutcomes.length,
  };
}

/** Compute overall skip and conversion rates for the user. */
export function computeUserRates(outcomes: StoredOutcome[]): {
  skipRate: number; conversionRate: number;
} {
  if (outcomes.length === 0) return { skipRate: 0.5, conversionRate: 0.5 };
  const converted = outcomes.filter(o => o.conversionSignal).length;
  const selected  = outcomes.filter(o => o.userAction === 'select' || o.userAction === 'convert').length;
  return {
    skipRate:       1 - selected / outcomes.length,
    conversionRate: converted   / Math.max(selected, 1),
  };
}
