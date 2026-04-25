/**
 * funnel-intent.detector.ts
 *
 * Funnel Intent Detector — Phase 1.2
 *
 * Maps campaign goal + budget level → funnel stage + intent signals.
 *
 * Decision logic:
 *   goal + budget → FunnelStage (TOFU / MOFU / BOFU)
 *   FunnelStage   → IntentType (cold / warm / hot)
 *   IntentType    → PrioritySignal (trust / emotion / conversion)
 *   FunnelStage   → ranked RecommendedFormats
 *
 * Pure functions — no DI, no external dependencies.
 * Injectable wrapper is FunnelIntentService.
 */

import type {
  CampaignGoal,
  BudgetLevel,
  FunnelStage,
  IntentType,
  PrioritySignal,
  CreativeFormat,
  FunnelIntentResult,
} from './funnel-router.types';

// ─── Goal → funnel stage ──────────────────────────────────────────────────────

const GOAL_TO_STAGE: Record<CampaignGoal, FunnelStage> = {
  awareness:   'TOFU',
  engagement:  'TOFU',
  leads:       'MOFU',
  retargeting: 'MOFU',
  conversion:  'BOFU',
};

// ─── Budget modifier ──────────────────────────────────────────────────────────
// Low budget = stay at stage; high budget = can push one stage deeper
// i.e. awareness + high → MOFU (can afford both stages)

const BUDGET_STAGE_SHIFT: Record<BudgetLevel, number> = {
  low:    0,
  medium: 0,
  high:   1,   // advance one stage when budget allows
};

const STAGES: FunnelStage[] = ['TOFU', 'MOFU', 'BOFU'];

function shiftStage(base: FunnelStage, shift: number): FunnelStage {
  const idx = STAGES.indexOf(base);
  return STAGES[Math.min(idx + shift, STAGES.length - 1)];
}

// ─── Stage → intent ───────────────────────────────────────────────────────────

const STAGE_INTENT: Record<FunnelStage, IntentType> = {
  TOFU: 'cold',
  MOFU: 'warm',
  BOFU: 'hot',
};

// ─── Intent → priority signal ─────────────────────────────────────────────────

const INTENT_PRIORITY: Record<IntentType, PrioritySignal> = {
  cold: 'trust',
  warm: 'emotion',
  hot:  'conversion',
};

// ─── Stage → recommended formats ─────────────────────────────────────────────

const STAGE_FORMATS: Record<FunnelStage, CreativeFormat[]> = {
  TOFU: ['ugc', 'carousel', 'banner'],
  MOFU: ['carousel', 'ugc', 'banner'],
  BOFU: ['banner', 'ugc', 'carousel'],
};

// ─── Budget → format filter ───────────────────────────────────────────────────
// Low budget: only top 1–2 formats. Medium: top 2. High: all 3.

const BUDGET_FORMAT_LIMIT: Record<BudgetLevel, number> = {
  low:    1,
  medium: 2,
  high:   3,
};

// ─── Reasoning builder ────────────────────────────────────────────────────────

function buildReasoning(
  goal:    CampaignGoal,
  budget:  BudgetLevel,
  stage:   FunnelStage,
  intent:  IntentType,
  signal:  PrioritySignal,
): string {
  return (
    `Goal "${goal}" → base stage ${GOAL_TO_STAGE[goal]}` +
    (BUDGET_STAGE_SHIFT[budget] > 0 ? ` shifted to ${stage} (${budget} budget)` : '') +
    ` | intent=${intent} | priority_signal=${signal}`
  );
}

// ─── Public detector function ─────────────────────────────────────────────────

export function detectFunnelIntent(opts: {
  goal:          CampaignGoal;
  budgetLevel:   BudgetLevel;
  /** User override — skips detection if provided */
  funnelStage?:  FunnelStage;
  intentType?:   IntentType;
}): FunnelIntentResult {
  const baseStage = opts.funnelStage ?? GOAL_TO_STAGE[opts.goal] ?? 'TOFU';
  const stage     = opts.funnelStage ?? shiftStage(baseStage, BUDGET_STAGE_SHIFT[opts.budgetLevel]);
  const intent    = opts.intentType  ?? STAGE_INTENT[stage];
  const signal    = INTENT_PRIORITY[intent];
  const allFmts   = STAGE_FORMATS[stage];
  const limit     = BUDGET_FORMAT_LIMIT[opts.budgetLevel];
  const recommendedFormats = allFmts.slice(0, limit) as CreativeFormat[];

  return {
    funnelStage:        stage,
    intentType:         intent,
    prioritySignal:     signal,
    recommendedFormats,
    reasoning:          buildReasoning(opts.goal, opts.budgetLevel, stage, intent, signal),
  };
}
