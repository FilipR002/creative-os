import { Injectable, OnModuleInit, Optional } from '@nestjs/common';
import { PrismaService }             from '../prisma/prisma.service';
import { LearningService }           from '../learning/learning.service';
import { MirofishLearningService, MirofishFatigueSignal } from '../mirofish/mirofish.learning.service';
import { FatigueService }            from '../fatigue/fatigue.service';
import { AngleFatigueResult }        from '../fatigue/fatigue.types';
import { ExplorationService }        from '../exploration/exploration.service';
import { OutcomesService }           from '../outcomes/outcomes.service';
import { InsightPatternService }     from '../angle-insights/insight-pattern.service';
import { AutonomousLoopService }     from '../autonomous-loop/autonomous-loop.service';
import { ANGLE_SEEDS }               from './angle.seed';
import { SelectAngleDto }            from './angle.dto';

// ─── Slug → display tag ───────────────────────────────────────────────────────

const ANGLE_TAGS: Record<string, string> = {
  before_after:       'BEFORE_AFTER',
  show_off:           'SHOW_OFF',
  proof:              'SOCIAL_PROOF',
  storytelling:       'STORY',
  curiosity:          'CURIOSITY',
  unpopular_opinion:  'OPINION',
  spark_conversation: 'CONVERSATION',
  tips_tricks:        'TIPS',
  hot_take:           'HOT_TAKE',
  teach:              'TEACH',
  data_stats:         'DATA',
  do_this_not_that:   'DO_VS_DONT',
  problem_solution:   'PROBLEM_SOLUTION',
  mistake_avoidance:  'MISTAKE',
};

// ─── Slot → UI labels ─────────────────────────────────────────────────────────

const SLOT_META = {
  exploit:   { section: 'SELECTED ANGLE',    status: 'USED IN GENERATION' },
  secondary: { section: 'SECONDARY ANGLE',   status: 'NOT USED'           },
  explore:   { section: 'EXPLORATION ANGLE', status: 'NOT USED'           },
} as const;

// ─── Blend combos (hardcoded validated pairs) ─────────────────────────────────

interface BlendCombo {
  primary:        string;
  secondary:      string;
  primaryRole:    string;
  secondaryRole:  string;
  strategy:       string;
}

const BLEND_COMBOS: BlendCombo[] = [
  {
    primary:       'before_after',
    secondary:     'proof',
    primaryRole:   'hook + transformation story',
    secondaryRole: 'trust validation layer',
    strategy:      'Show the change, prove it happened',
  },
  {
    primary:       'problem_solution',
    secondary:     'teach',
    primaryRole:   'problem framing + solution reveal',
    secondaryRole: 'educational reinforcement',
    strategy:      'Name the pain, teach the fix',
  },
  {
    primary:       'storytelling',
    secondary:     'proof',
    primaryRole:   'narrative arc + emotional hook',
    secondaryRole: 'social validation',
    strategy:      'Story first, proof seals the deal',
  },
  {
    primary:       'show_off',
    secondary:     'proof',
    primaryRole:   'product hero moment',
    secondaryRole: 'credibility reinforcement',
    strategy:      'Show the goods, let results do the talking',
  },
];

// ─── 4.3 Blend thresholds ─────────────────────────────────────────────────────

const BLEND_MAX_GAP            = 0.35;  // confidence gap above which primary is too dominant → SINGLE
const BLEND_MIN_SECONDARY      = 0.38;  // absolute floor for secondary eligibility
const BLEND_EXPLOIT_MIN        = 0.65;  // both angles need this for EXPLOITATION mode
const BLEND_DOMINANT_THRESHOLD = 0.80;  // primary alone is near-certain → no blend needed

// ─── 4.3 Anti-conflict pairs ──────────────────────────────────────────────────
// Semantically or emotionally incompatible angle combinations.
// Stored as 'a:b' (checked both directions via hasAngleConflict).

const ANGLE_CONFLICTS = new Set<string>([
  'hot_take:teach',
  'unpopular_opinion:proof',
  'spark_conversation:teach',
  'humor:mistake_avoidance',
  'hot_take:data_stats',
  'curiosity:do_this_not_that',
  'humor:before_after',
]);

// ─── 4.3 Blend mode + result types ───────────────────────────────────────────

type BlendMode     = 'EXPLOITATION' | 'BALANCED' | 'EXPLORATION';
type SecondaryRole = 'reinforcement' | 'diversity' | 'exploration';

interface SmartBlendResult {
  partner:       ScoredAngle;
  combo:         BlendCombo | null;
  blendMode:     BlendMode;
  blendRatio:    string;           // e.g. '70/30'
  secondaryRole: SecondaryRole;
  probGap:       number;
  primaryConf:   number;
  secondaryConf: number;
}

// ─── Fatigue detection ────────────────────────────────────────────────────────

type FatigueLevel = 'HEALTHY' | 'WARMING' | 'FATIGUED' | 'BLOCKED';

const FATIGUE_PENALTY: Record<FatigueLevel, number> = {
  HEALTHY:   0,
  WARMING:  -0.05,
  FATIGUED: -0.20,  // ~50–70% effective probability reduction after normalisation
  BLOCKED:  -1.00,  // fully excluded from selection
};

// ─── Goal → angle pool ────────────────────────────────────────────────────────

const GOAL_POOLS: Record<string, string[]> = {
  conversion:  ['before_after', 'show_off', 'proof'],
  awareness:   ['storytelling', 'curiosity', 'unpopular_opinion'],
  engagement:  ['spark_conversation', 'tips_tricks', 'hot_take'],
};

// ─── Emotion → angle boost ────────────────────────────────────────────────────

const EMOTION_BOOSTS: Record<string, string[]> = {
  curiosity:   ['curiosity', 'unpopular_opinion', 'storytelling'],
  trust:       ['proof', 'before_after', 'show_off'],
  excitement:  ['show_off', 'before_after', 'storytelling'],
  fear:        ['before_after', 'problem_solution', 'mistake_avoidance'],
  hope:        ['storytelling', 'before_after', 'show_off'],
  anxiety:     ['mistake_avoidance', 'problem_solution', 'before_after'],
  pride:       ['show_off', 'storytelling', 'before_after'],
  urgency:     ['problem_solution', 'before_after', 'proof'],
  humor:       ['hot_take', 'unpopular_opinion', 'spark_conversation'],
  empathy:     ['storytelling', 'problem_solution', 'before_after'],
  inspiration: ['storytelling', 'before_after', 'proof'],
  nostalgia:   ['storytelling', 'before_after', 'teach'],
};

// ─── Confidence weights ───────────────────────────────────────────────────────

const W = {
  historical:    0.40,
  win_freq:      0.25,
  recency:       0.15,
  goal_match:    0.10,
  emotion_match: 0.10,
};

// ─── Exploration rate presets (explore % = min 10%, normal 20%, high 35–45%) ──

const RATES = {
  baseline:       { exploit: 0.70, secondary: 0.20, explore: 0.10 },
  new_user:       { exploit: 0.40, secondary: 0.30, explore: 0.30 },
  exploring:      { exploit: 0.55, secondary: 0.25, explore: 0.20 },
  high_exploring: { exploit: 0.35, secondary: 0.25, explore: 0.40 },
  exploiting:     { exploit: 0.75, secondary: 0.15, explore: 0.10 },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function avg(arr: number[]): number {
  return arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
}
function clamp(v: number, lo = 0, hi = 1): number {
  return Math.min(hi, Math.max(lo, v));
}
function r2(n: number): number {
  return Math.round(n * 100) / 100;
}
function freq(items: string[]): Record<string, number> {
  return items.reduce((a, x) => { a[x] = (a[x] || 0) + 1; return a; }, {} as Record<string, number>);
}

// ─── 4.3 Blend helper functions ───────────────────────────────────────────────

/** Check if two angle slugs are semantically/emotionally incompatible. */
function hasAngleConflict(a: string, b: string): boolean {
  return ANGLE_CONFLICTS.has(`${a}:${b}`) || ANGLE_CONFLICTS.has(`${b}:${a}`);
}

/**
 * Determine blend mode from confidence levels and exploration context.
 * EXPLOITATION → both high confidence, reinforcing known winners.
 * BALANCED     → primary strong, secondary solid — complementary composition.
 * EXPLORATION  → low certainty or forced by fatigue/exploration signal.
 */
function computeBlendMode(
  primaryConf:   number,
  secondaryConf: number,
  forceExplore:  boolean,
): BlendMode {
  if (forceExplore) return 'EXPLORATION';
  if (primaryConf >= BLEND_EXPLOIT_MIN && secondaryConf >= BLEND_EXPLOIT_MIN) return 'EXPLOITATION';
  if (primaryConf >= 0.55 && secondaryConf >= 0.40) return 'BALANCED';
  return 'EXPLORATION';
}

/**
 * Compute blend ratio as "primary/secondary" string.
 * EXPLOITATION: 70/30 — dominant primary, secondary as trust layer.
 * EXPLORATION:  60/40 — more equal, we're testing territory.
 * BALANCED:     65/35 if meaningful gap, 60/40 if near-equal.
 */
function computeBlendRatio(
  primaryConf:   number,
  secondaryConf: number,
  mode:          BlendMode,
): string {
  if (mode === 'EXPLOITATION') return '70/30';
  if (mode === 'EXPLORATION')  return '60/40';
  // BALANCED: scale by confidence gap
  const gap = primaryConf - secondaryConf;
  return gap > 0.12 ? '65/35' : '60/40';
}

/**
 * Determine what role the secondary angle plays in the blend.
 * reinforcement → secondary validates / amplifies primary (same goal pool, high conf)
 * diversity     → secondary introduces new dimension (low usage, different pool)
 * exploration   → we're testing; secondary is uncertain / under-explored
 */
function determineSecondaryRole(
  secondary: ScoredAngle,
  primary:   ScoredAngle,
  mode:      BlendMode,
): SecondaryRole {
  if (mode === 'EXPLORATION') return 'exploration';
  if (secondary.inGoalPool && secondary.confidence >= 0.55) return 'reinforcement';
  if (secondary.usageCount < 3 || !secondary.inGoalPool) return 'diversity';
  return 'reinforcement';
}

// ─── Typed rows ───────────────────────────────────────────────────────────────

interface AngleRow {
  id: string; slug: string; label: string; description: string | null;
  source: string; isActive: boolean;
  parentSlug:    string | null;
  mutationDepth: number;
  angleStats: { uses: number; wins: number; avgCtr: number; avgRetention: number; avgConversion: number } | null;
}

interface ScoredAngle extends AngleRow {
  confidence:     number;
  fatigueLevel:   FatigueLevel;
  inGoalPool:     boolean;
  inEmotionBoost: boolean;
  recentlyUsed:   boolean;
  usageCount:     number;
  rankPosition:   number;   // 4.3: 1-based rank within sorted selection pool
  outcomeMod:     number;   // per-user real-world performance multiplier [0.5–1.5]
  insightBoost:   number;   // vision-backed confidence lift [0–0.05] (Phase 8.3)
  alcAdj:         number;   // ALC strong/weak classification adjustment ±0.03 (Phase 8.4)
}

type MemRow = { angle: string; totalScore: number; isWinner: boolean; campaignId: string };

// ─── Entry context (passed from selectForConcept to entry builder) ────────────

interface EntryContext {
  explorationMode:      string;
  ctxMultipliers:       Record<string, number>;
  learningSystemActive: boolean;
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class AngleService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly learning:           LearningService,
    @Optional() private readonly mirofishLearning:   MirofishLearningService,
    @Optional() private readonly fatigueService:     FatigueService,
    @Optional() private readonly explorationEngine:  ExplorationService,
    @Optional() private readonly outcomesService:    OutcomesService,
    @Optional() private readonly insightPatterns:    InsightPatternService,
    @Optional() private readonly autonomousLoop:     AutonomousLoopService,
  ) {}

  async onModuleInit() {
    for (const seed of ANGLE_SEEDS) {
      await this.prisma.angle.upsert({
        where:  { slug: seed.slug },
        update: {},
        create: { ...seed, source: 'system' },
      });
    }
  }

  async findAll() {
    return this.prisma.angle.findMany({
      where:   { isActive: true },
      include: { angleStats: true },
      orderBy: { slug: 'asc' },
    });
  }

  async findBySlug(slug: string) {
    return this.prisma.angle.findUnique({ where: { slug } });
  }

  // ── Core intelligence ─────────────────────────────────────────────────────

  async selectForConcept(dto: SelectAngleDto) {

    // 1. Load concept
    const concept = await this.prisma.concept.findUnique({ where: { id: dto.conceptId } });
    if (!concept) return this.fallback();

    const raw     = concept.rawJson as any;
    const goal    = concept.goal || 'conversion';
    const emotion = ((concept.emotion || raw?.emotion || '') as string).toLowerCase().trim();

    // 2. All active angles with stats
    const angles = (await this.prisma.angle.findMany({
      where:   { isActive: true },
      include: { angleStats: true },
    })) as AngleRow[];

    // 3. Recent memory for this user
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: concept.campaignId }, select: { userId: true, clientId: true },
    });

    const mem: MemRow[] = campaign?.userId
      ? await this.prisma.creativeMemory.findMany({
          where:   { userId: campaign.userId },
          orderBy: { createdAt: 'desc' },
          take:    30,
          select:  { angle: true, totalScore: true, isWinner: true, campaignId: true },
        })
      : [];

    // 4. Situational analysis
    const isNewUser = mem.length < 3;

    const last3Campaigns = [...new Set(mem.map(m => m.campaignId))].slice(0, 3);
    const recentlyUsed   = new Set(mem.filter(m => last3Campaigns.includes(m.campaignId)).map(m => m.angle));

    const s5  = mem.slice(0, 5).map(m => m.totalScore);
    const s10 = mem.slice(5, 10).map(m => m.totalScore);
    const trend: 'declining' | 'stable' | 'improving' =
      s10.length < 3 ? 'stable'
      : avg(s5) < avg(s10) - 0.05 ? 'declining'
      : avg(s5) > avg(s10) + 0.05 ? 'improving'
      : 'stable';

    const angleFreq    = freq(mem.slice(0, 10).map(m => m.angle));
    const hasRepeated  = Object.values(angleFreq).some(c => c >= 5);
    const uniqueRecent = new Set(mem.slice(0, 8).map(m => m.angle)).size;
    const lowDiversity = !isNewUser && mem.length >= 4 && uniqueRecent <= 2;

    // 5. Goal + emotion context
    const goalPool  = GOAL_POOLS[goal]     ?? Object.values(GOAL_POOLS).flat();
    const emoBoosts = EMOTION_BOOSTS[emotion] ?? [];

    // 5b-i. 4.4 Fatigue System (preferred) — batch-load all signals via FatigueService.
    //       Falls back to MIROFISH-enriched computeFatigue() when FatigueService unavailable.
    const fatigue44Map: Map<string, AngleFatigueResult> = this.fatigueService
      ? await this.fatigueService.computeBatch({
          slugs:    angles.map(a => a.slug),
          userId:   campaign?.userId ?? undefined,
          clientId: campaign?.clientId ?? undefined,
        }).catch(() => new Map<string, AngleFatigueResult>())
      : new Map<string, AngleFatigueResult>();

    // Legacy MIROFISH fatigue signals — only used when 4.4 service is unavailable.
    const mirofishFatigueMap: Record<string, MirofishFatigueSignal> =
      fatigue44Map.size === 0 && this.mirofishLearning
        ? await this.mirofishLearning.getBatchFatigueSignals(angles.map(a => a.slug)).catch(() => ({}))
        : {};

    // 5b-ii. Contextual multipliers from the learning system (per goal / client / industry)
    //     Multiplier > 1.0 → angle beats expectations in this context → confidence boost
    //     Multiplier < 1.0 → underperforms in this context → confidence penalty
    //     Multiplier = 1.0 → no learning data yet → neutral
    const learningSystemActive = !!this.learning;
    const ctxMultipliers: Record<string, number> = this.learning
      ? await this.learning.getContextualMultipliers(
          angles.map(a => a.id),
          {
            goal,
            clientId: campaign?.clientId ?? null,
            industry: (concept.rawJson as any)?.industry ?? dto.clientIndustry ?? null,
          },
        )
      : {};

    // 5c. Outcome learning weights — per-user real-world performance signal.
    //     Loaded from user_outcome_learning table (Phase 8 Outcome Learning Layer).
    //     Missing weights default to 1.0 — no outcome data changes nothing.
    const outcomeWeights: Record<string, number> = this.outcomesService
      ? await this.outcomesService.getOutcomeWeights(campaign?.userId ?? '').catch(() => ({}))
      : {};

    // 5d. Insight boosts — angles with more vision data get a small confidence nudge.
    //     Range: 0.00 (no insights) → 0.05 max (5+ insights). One batched call, no N+1.
    const insightBoosts: Record<string, number> = this.insightPatterns
      ? await this.insightPatterns.getInsightBoosts(angles.map(a => a.slug)).catch(() => ({}))
      : {};

    // 5e. ALC confidence adjustments — +0.03 for strong angles, -0.03 for weak.
    //     Synchronous read from in-memory state — zero latency.
    const alcAdjustments: Record<string, number> = this.autonomousLoop
      ? this.autonomousLoop.getConfidenceAdjustments(campaign?.userId ?? '')
      : {};
    const alcExploreRatio: number = this.autonomousLoop && campaign?.userId
      ? this.autonomousLoop.getExplorationRatio(campaign.userId)
      : 0.20;

    // 6. Score every angle — fatigue + contextual learning applied as confidence modifiers
    const scored: ScoredAngle[] = angles.map(a => {
      const s = a.angleStats;

      // Historical performance (40%)
      const hp = s && s.uses > 0
        ? clamp(s.avgCtr * 0.40 + s.avgRetention * 0.30 + s.avgConversion * 0.30)
        : 0.50;

      // Win frequency (25%)
      const wf = s && s.uses > 0 ? clamp(s.wins / s.uses) : 0.50;

      // Recency success (15%)
      const recentRuns = mem.filter(m => m.angle === a.slug).slice(0, 5);
      const rs = recentRuns.length > 0
        ? recentRuns.filter(m => m.isWinner).length / recentRuns.length
        : 0.50;

      // Context match (20% total)
      const gm = goalPool.includes(a.slug)   ? 1.0 : 0.0;
      const em = emoBoosts.includes(a.slug)  ? 1.0 : 0.0;

      const base =
        hp * W.historical + wf * W.win_freq + rs * W.recency +
        gm * W.goal_match + em * W.emotion_match;

      const mods = (recentlyUsed.has(a.slug) ? -0.05 : 0) + (!s || s.uses < 2 ? +0.03 : 0);

      // Fatigue level — 4.4 FatigueService (preferred) or legacy computeFatigue() fallback.
      // 4.4 uses the 5-signal formula with probability_modifier in place of a flat penalty.
      const fatigue44Result = fatigue44Map.get(a.slug);
      const fatigueLevel   = (fatigue44Result?.fatigue_state as FatigueLevel)
                           ?? this.computeFatigue(a.slug, mem, mirofishFatigueMap[a.slug]);
      // probability_modifier from 4.4 is already calibrated (−0.60 to +0.10).
      // For the legacy path we keep the flat FATIGUE_PENALTY lookup.
      const fatiguePenalty = fatigue44Result
        ? fatigue44Result.probability_modifier   // 4.4 path
        : FATIGUE_PENALTY[fatigueLevel];          // legacy path

      // Contextual learning signal: convert multiplier to additive boost (capped ±15%)
      // weight=1.5 → +12.5% boost; weight=0.5 → -12.5% penalty; weight=1.0 → ±0%
      const ctxMult  = ctxMultipliers[a.id] ?? 1.0;
      const ctxBoost = clamp((ctxMult - 1.0) * 0.25, -0.15, 0.15);

      // OUTCOME_MOD — multiplicative real-world performance signal (Phase 8).
      // outcomeMod is a weight in [0.5, 1.5]; applied as a multiplier on base confidence.
      // No outcome data → 1.0 → completely neutral (backward compatible).
      const outcomeMod = outcomeWeights[a.slug] ?? 1.0;

      // EVOLUTION BOOST — evolved angles get a small exploration nudge so they have
      // a chance to accumulate performance data before being pruned.
      // Capped at +10% (mutationDepth=5+); decays naturally once outcome data arrives.
      const evolutionBoost = a.source === 'evolved'
        ? Math.min(0.10, (a.mutationDepth ?? 1) * 0.02)
        : 0;

      // INSIGHT BOOST — angles backed by real vision-analysed ads get a small lift.
      // Each stored insight adds +1% confidence, capped at +5% (Phase 8.3).
      const insightBoost = insightBoosts[a.slug] ?? 0;

      // ALC ADJUSTMENT — +0.03 for ALC-classified strong angles, -0.03 for weak (Phase 8.4).
      const alcAdj = alcAdjustments[a.slug] ?? 0;

      return {
        ...a,
        fatigueLevel,
        confidence:     clamp((base + mods + fatiguePenalty + ctxBoost + evolutionBoost + insightBoost + alcAdj) * outcomeMod),
        inGoalPool:     goalPool.includes(a.slug),
        inEmotionBoost: emoBoosts.includes(a.slug),
        recentlyUsed:   recentlyUsed.has(a.slug),
        usageCount:     s?.uses ?? 0,
        rankPosition:   0, // assigned after sorting
        outcomeMod,
        insightBoost,
        alcAdj,
      };
    });

    // 7. Dynamic exploration rate — fatigue-aware
    const fatiguedCount    = scored.filter(a => a.fatigueLevel === 'FATIGUED' || a.fatigueLevel === 'BLOCKED').length;
    const manyFatigued     = fatiguedCount >= 3;
    const recentWinners    = mem.filter(m => m.isWinner).slice(0, 5).map(m => m.angle);
    const winnerFreq       = freq(recentWinners);
    const repeatedWinner   = Object.values(winnerFreq).some(c => c >= 3);
    const isPlateauing     = mem.length >= 10 && Math.abs(avg(s5) - avg(s10)) < 0.02;

    const baseRates =
      isNewUser                                                           ? RATES.new_user
      : manyFatigued || isPlateauing || repeatedWinner                   ? RATES.high_exploring
      : trend === 'declining' || hasRepeated || lowDiversity             ? RATES.exploring
      : trend === 'improving' && !manyFatigued                           ? RATES.exploiting
      : RATES.baseline;

    // ── 4.5 Adaptive Exploration Engine (unified pressure signal) ─────────
    // Single source of truth for exploration rate adjustment.
    // Absorbs memory stagnation + fatigue pressure + MIROFISH uncertainty
    // into one anti-drift delta. Passes pre-loaded fatigue data to avoid
    // redundant DB queries (no double-counting risk).
    const pressure45Result = this.explorationEngine
      ? await this.explorationEngine.computePressure({
          userId:           campaign?.userId   ?? undefined,
          clientId:         campaign?.clientId ?? undefined,
          goal,
          preloadedFatigue: fatigue44Map.size > 0 ? fatigue44Map : undefined,
        }).catch(() => null)
      : null;

    // Fallback when 4.5 unavailable: legacy 4.4 fatigue adj OR MIROFISH adj (OR-gated).
    const legacyFatigue44Adj: number = !pressure45Result && fatigue44Map.size > 0
      ? Math.min(0.20, [...fatigue44Map.values()]
          .reduce((sum, r) => sum + r.exploration_signal, 0) / Math.max(1, fatigue44Map.size) * 2)
      : 0;

    const legacyMirofishAdj = (!pressure45Result && legacyFatigue44Adj === 0 && this.mirofishLearning)
      ? await this.mirofishLearning.getAdaptiveExplorationAdjustment({
          goal, clientId: campaign?.clientId ?? null,
        }).catch(() => 0)
      : 0;

    // 4.5 takes full priority; legacy path only fires when 4.5 is unavailable.
    const exploreAdj = pressure45Result?.exploration_pressure_delta
      ?? (legacyFatigue44Adj !== 0 ? legacyFatigue44Adj : legacyMirofishAdj);

    const rates4x = exploreAdj !== 0
      ? {
          ...baseRates,
          explore: Math.min(0.45, Math.max(0.10, baseRates.explore + exploreAdj)),
        }
      : baseRates;

    // 8.4 ALC exploration override — blends ALC ratio toward the 4.x computed rate.
    // Takes effect only when ALC has enough data (at least one cycle run).
    // Uses a 60/40 blend: 60% 4.x signal (fatigue/trend-aware) + 40% ALC signal.
    const alcActive = this.autonomousLoop &&
      this.autonomousLoop.getState(campaign?.userId ?? '') !== null;
    const rates = alcActive
      ? {
          ...rates4x,
          explore: Math.min(0.45, Math.max(0.10,
            rates4x.explore * 0.60 + alcExploreRatio * 0.40
          )),
        }
      : rates4x;

    const highExplore = rates.explore >= 0.25;

    // 7b. Resolve exploration mode string early — needed by 4.3 blend logic
    const explorationMode: string = isNewUser        ? 'new_user'
      : rates === RATES.high_exploring               ? 'high_exploring'
      : highExplore                                  ? 'exploring'
      : rates === RATES.exploiting                   ? 'exploiting'
      : 'baseline';

    // 8. Selection pool — all scored angles eligible; orchestrator decides exclusions.
    // Fatigue is expressed as confidence penalty only (probability_modifier).
    // BLOCKED angles have confidence ≈ 0 and naturally sort to last — no pre-filter needed.
    const selectable = scored;
    const sorted     = [...selectable].sort((a, b) => b.confidence - a.confidence);
    sorted.forEach((a, i) => { a.rankPosition = i + 1; });

    // EXPLOIT — highest confidence in goal/emotion pool
    const primary  = sorted.filter(a => a.inGoalPool || a.inEmotionBoost);
    const exploit  = primary[0] ?? sorted[0];

    // 9. 4.3 Learning-aware blend — operates on top of 4.2 confidence scores
    const blendResult = this.findSmartBlend(
      exploit,
      sorted.filter(a => a.id !== exploit.id),
      explorationMode,
      manyFatigued,
    );

    // If blended, the blend partner is consumed (excluded from secondary/explore)
    const blendPartnerId = blendResult?.partner.id;

    // SECONDARY — next highest, differs from exploit (+ blend partner if consumed)
    const rem1      = sorted.filter(a => a.id !== exploit.id && a.id !== blendPartnerId);
    const secPool   = rem1.filter(a => a.inGoalPool || a.inEmotionBoost || a.confidence >= 0.50);
    const secondary = secPool[0] ?? rem1[0];

    // EXPLORE — lowest usage from remaining pool
    const rem2 = sorted.filter(a => a.id !== exploit.id && a.id !== secondary?.id && a.id !== blendPartnerId);
    let explore: ScoredAngle;
    if (highExplore) {
      const outside = rem2.filter(a => !a.inGoalPool);
      explore = (outside.length > 0 ? outside : rem2).sort((a, b) => a.usageCount - b.usageCount)[0]
        ?? rem2[rem2.length - 1];
    } else {
      explore = [...rem2].sort((a, b) => a.usageCount - b.usageCount)[0]
        ?? rem2[rem2.length - 1];
    }

    // Safety: ensure explore is distinct
    if (!explore || explore.id === exploit.id || explore.id === secondary?.id) {
      explore = sorted.find(a => a.id !== exploit.id && a.id !== secondary?.id) ?? exploit;
    }

    // 10. Build entry context for blend dependency source
    const entryCtx: EntryContext = {
      explorationMode,
      ctxMultipliers,
      learningSystemActive,
    };

    return {
      selected_angles: [
        this.entry(exploit,   'exploit',   goal, emotion, blendResult, entryCtx),
        this.entry(secondary, 'secondary', goal, emotion, null,        entryCtx),
        this.entry(explore,   'explore',   goal, emotion, null,        entryCtx),
      ],
      exploration_mode:  explorationMode,
      exploration_rates: rates,
      performance_trend: trend,
      diagnostics: {
        goal,
        emotion,
        goal_pool:            goalPool,
        emotion_boosts:       emoBoosts,
        recently_used:        [...recentlyUsed],
        is_new_user:          isNewUser,
        has_repeated:         hasRepeated,
        low_diversity:        lowDiversity,
        many_fatigued:        manyFatigued,
        repeated_winner:      repeatedWinner,
        is_plateauing:        isPlateauing,
        fatigued_count:       fatiguedCount,
        high_explore:         highExplore,
        total_memory:         mem.length,
        blend_mode:                 blendResult?.blendMode ?? 'SINGLE',
        blend_prob_gap:             blendResult ? r2(blendResult.probGap) : null,
        learning_system_active:     learningSystemActive,
        // ── Phase 8: Outcome Learning Layer diagnostics ──────────────────────
        outcome_learning_active:    !!this.outcomesService,
        outcome_weights_applied:    Object.keys(outcomeWeights).length,
        mirofish_explore_adj:       legacyMirofishAdj !== 0 ? r2(legacyMirofishAdj) : null,
        mirofish_learning_active:   !!this.mirofishLearning,
        // ── 4.4 Fatigue System diagnostics ──────────────────────────────────
        fatigue_system_active:      fatigue44Map.size > 0,
        fatigue_states:             fatigue44Map.size > 0
          ? Object.fromEntries([...fatigue44Map.entries()].map(([s, r]) => [s, r.fatigue_state]))
          : null,
        // ── 4.5 Adaptive Exploration Engine diagnostics ──────────────────────
        exploration_engine_active:  !!pressure45Result,
        exploration_pressure_delta: pressure45Result ? r2(pressure45Result.exploration_pressure_delta) : null,
        exploration_confidence:     pressure45Result ? r2(pressure45Result.confidence) : null,
        exploration_risk_flags:     pressure45Result?.risk_flags ?? [],
        exploration_breakdown:      pressure45Result?.breakdown ?? null,
      },
    };
  }

  // ── Fatigue detection (frequency-based + MIROFISH signal) ────────────────

  private computeFatigue(
    slug:           string,
    mem:            MemRow[],
    mirofishSignal?: MirofishFatigueSignal,
  ): FatigueLevel {
    const last10    = mem.slice(0, 10);
    const usageIn10 = last10.filter(m => m.angle === slug).length;

    if (usageIn10 >= 5) return 'BLOCKED';

    // Performance trend for this angle specifically
    const angleRuns = mem.filter(m => m.angle === slug);
    let baseLevel: FatigueLevel = 'HEALTHY';

    if (angleRuns.length >= 4) {
      const recentAvg = avg(angleRuns.slice(0, 3).map(m => m.totalScore));
      const prevAvg   = avg(angleRuns.slice(3, 6).map(m => m.totalScore));
      if (prevAvg > 0 && recentAvg < prevAvg - 0.10) baseLevel = 'FATIGUED';
      else if (prevAvg > 0 && recentAvg < prevAvg - 0.05) {
        baseLevel = usageIn10 >= 3 ? 'FATIGUED' : 'WARMING';
      }
    }

    if (baseLevel === 'HEALTHY') {
      if (usageIn10 >= 3) baseLevel = 'FATIGUED';
      else if (usageIn10 >= 2) baseLevel = 'WARMING';
    }

    // ── MIROFISH fatigue escalation ───────────────────────────────────────
    // If MIROFISH detects declining predictions AND frequency is elevated,
    // escalate fatigue one level faster than frequency alone would trigger.
    if (mirofishSignal?.declining && mirofishSignal.signalStrength > 0.40) {
      if (baseLevel === 'WARMING' && usageIn10 >= 2) return 'FATIGUED';
      if (baseLevel === 'HEALTHY' && usageIn10 >= 2 && mirofishSignal.signalStrength > 0.65) return 'WARMING';
    }

    return baseLevel;
  }

  // ── 4.3 Learning-aware blend matching ────────────────────────────────────
  //
  // Operates as a COMPOSITION LAYER on top of 4.2 confidence scores.
  // 4.2 decided WHAT is good. 4.3 decides HOW to combine what is good.
  //
  // Decision tree:
  //   FATIGUED/BLOCKED primary        → null (SINGLE)
  //   Primary dominance ≥ 0.80        → null (no blend needed)
  //   Probability gap > BLEND_MAX_GAP → null (secondary too far behind)
  //   No eligible candidates          → null
  //   Hardcoded combo exists          → prefer it
  //   No combo + EXPLORATION mode     → allow dynamic pair
  //   Anti-conflict check             → skip conflicting pairs

  private findSmartBlend(
    primary:        ScoredAngle,
    candidates:     ScoredAngle[],
    explorationMode: string,
    manyFatigued:   boolean,
  ): SmartBlendResult | null {

    // 1. Primary must have sufficient confidence to lead a blend.
    // Fatigue penalty is already encoded in primary.confidence via probability_modifier —
    // no fatigueLevel state check needed here. Orchestrator decides exclusions.
    if (primary.confidence < BLEND_MIN_SECONDARY) return null;

    // 2. Primary dominance guard — no blend needed if primary is near-certain
    if (primary.confidence >= BLEND_DOMINANT_THRESHOLD) return null;

    // 3. Filter eligible secondary candidates by confidence only.
    // Fatigued/blocked angles already have low confidence via probability_modifier;
    // the BLEND_MIN_SECONDARY floor catches them without state-based filtering.
    const eligible = candidates.filter(c =>
      c.confidence >= BLEND_MIN_SECONDARY &&
      !hasAngleConflict(primary.slug, c.slug),
    );
    if (eligible.length === 0) return null;

    // 4. Best candidate (already sorted by confidence desc from selectForConcept)
    const bestCandidate = eligible[0];

    // 5. Probability gap check — secondary too weak relative to primary → SINGLE
    const probGap = primary.confidence - bestCandidate.confidence;
    if (probGap > BLEND_MAX_GAP) return null;

    // 6. Blend mode (uses 4.2 confidence scores + exploration state)
    const forceExplore =
      explorationMode === 'high_exploring' ||
      explorationMode === 'new_user' ||
      manyFatigued;

    const blendMode = computeBlendMode(
      primary.confidence,
      bestCandidate.confidence,
      forceExplore,
    );

    // 7. Prefer hardcoded validated combo for primary slug
    const hardCombos = BLEND_COMBOS.filter(c => c.primary === primary.slug);
    let selectedCombo: BlendCombo | null = null;
    let selectedPartner: ScoredAngle | null = null;

    for (const combo of hardCombos) {
      const partner = eligible.find(c => c.slug === combo.secondary);
      if (partner) {
        selectedCombo   = combo;
        selectedPartner = partner;
        break;
      }
    }

    // 8. Dynamic pair allowed ONLY in EXPLORATION mode (no validated combo found)
    if (!selectedPartner && blendMode === 'EXPLORATION') {
      // Pick least-used eligible candidate for maximum diversity signal
      const dynamic = [...eligible].sort((a, b) => a.usageCount - b.usageCount)[0];
      if (dynamic) {
        selectedPartner = dynamic;
        selectedCombo   = null;   // no predefined roles; entry() will use generic defaults
      }
    }

    if (!selectedPartner) return null;

    return {
      partner:       selectedPartner,
      combo:         selectedCombo,
      blendMode,
      blendRatio:    computeBlendRatio(primary.confidence, selectedPartner.confidence, blendMode),
      secondaryRole: determineSecondaryRole(selectedPartner, primary, blendMode),
      probGap,
      primaryConf:   primary.confidence,
      secondaryConf: selectedPartner.confidence,
    };
  }

  // ── Entry builder ─────────────────────────────────────────────────────────

  private entry(
    a:       ScoredAngle,
    type:    'exploit' | 'secondary' | 'explore',
    goal:    string,
    emotion: string,
    blend:   SmartBlendResult | null,
    ctx:     EntryContext,
  ) {
    const meta      = SLOT_META[type];
    const isBlended = blend !== null;

    return {
      angle:         a.slug,
      tag:           ANGLE_TAGS[a.slug] ?? a.slug.toUpperCase().replace(/-/g, '_'),
      section:       isBlended ? 'SELECTED ANGLES' : meta.section,
      status:        meta.status,
      fatigue_level: a.fatigueLevel,
      is_blended:    isBlended,
      blend: isBlended ? {
        primary: {
          angle: a.slug,
          tag:   ANGLE_TAGS[a.slug] ?? a.slug.toUpperCase(),
          label: a.label,
          role:  blend!.combo?.primaryRole ?? 'primary angle',
        },
        secondary: {
          angle:        blend!.partner.slug,
          tag:          ANGLE_TAGS[blend!.partner.slug] ?? blend!.partner.slug.toUpperCase(),
          label:        blend!.partner.label,
          role:         blend!.combo?.secondaryRole ?? 'secondary support',
          rankPosition: blend!.partner.rankPosition,
        },
        strategy:     blend!.combo?.strategy ?? `${a.label} leads, ${blend!.partner.label} supports`,
        mode:         blend!.blendMode,
        ratio:        blend!.blendRatio,
        dependencySource: {
          // 4.3 references the 4.2 learning state used to produce these confidence scores
          explorationMode:      ctx.explorationMode,
          ctxMultiplier:        r2(ctx.ctxMultipliers[a.id] ?? 1.0),
          probGap:              r2(blend!.probGap),
          learningSystemActive: ctx.learningSystemActive,
        },
      } : undefined,
      angleData: {
        id: a.id, slug: a.slug, label: a.label,
        description: a.description, source: a.source, isActive: a.isActive,
      },
      type,
      goal,
      emotion,
      confidence_score:       r2(a.confidence),
      outcome_learning_boost: r2(a.outcomeMod),
      insight_boost:          r2(a.insightBoost),
      alc_adjustment:         r2(a.alcAdj),
      reason:                 this.reason(type, a, goal, emotion, blend),
    };
  }

  private reason(
    type:     string,
    a:        ScoredAngle,
    goal:     string,
    emotion:  string,
    blend:    SmartBlendResult | null,
  ): string {
    if (type === 'exploit') {
      if (blend) {
        const modeDesc =
          blend.blendMode === 'EXPLOITATION' ? 'High-confidence reinforcing blend' :
          blend.blendMode === 'BALANCED'     ? 'Balanced complementary blend' :
                                               'Exploratory blend';
        return `${modeDesc} (${blend.blendRatio}): primary angle delivers the hook and core message, secondary adds ${blend.secondaryRole}.`;
      }
      const emo = a.inEmotionBoost ? ` Aligned with "${emotion}" emotion.` : '';
      return `Highest confidence for ${goal} goal.${emo} Best historical performance in goal pool.`;
    }
    if (type === 'secondary') {
      const emo = a.inEmotionBoost ? ` Emotion-aligned ("${emotion}").` : '';
      const fat = a.fatigueLevel === 'WARMING'  ? ' (warming — monitor frequency)' : '';
      const fat2= a.fatigueLevel === 'FATIGUED' ? ' ⚠️ fatigued — reduced priority'  : '';
      return `Diversification from primary selected angle.${emo}${fat}${fat2}`;
    }
    // explore
    const low = a.usageCount < 2
      ? `Low usage history (${a.usageCount} run${a.usageCount === 1 ? '' : 's'}), used for exploration and testing new patterns.`
      : `Tests outside the ${goal} pool for unexpected winners.`;
    const fat = a.fatigueLevel === 'WARMING' ? ' (usage warming — watch trend)' : '';
    return low + fat;
  }

  private fallback() {
    return {
      selected_angles:   [],
      exploration_mode:  'new_user',
      exploration_rates: RATES.new_user,
      performance_trend: 'stable',
      diagnostics:       { error: 'concept not found' },
    };
  }
}
