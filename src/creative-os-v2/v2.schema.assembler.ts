/**
 * v2.schema.assembler.ts
 *
 * Creative OS v2 Schema Assembler
 *
 * Takes raw results from each engine and assembles the unified V2OutputSchema.
 *
 * This is a pure transformation layer — no external calls, no DI.
 * Every field in V2OutputSchema is derived here from typed inputs.
 */

import type {
  V2BrainOutput,
  V2OutputSchema,
  V2UGCBlock,
  V2UGCVariant,
  V2CarouselBlock,
  V2CarouselCreative,
  V2BannerBlock,
  V2BannerCreative,
  V2ExecutionBlock,
  V2ScoringBlock,
  V2LearningBlock,
  V2VariantScore,
  V2JobEntry,
  V2Status,
  V2Format,
} from './types/v2.schema.types';
import type { LaunchViralTestResponse } from '../ugc/types/viral-test.types';
import type { FormatDispatchResult }    from '../funnel-router/funnel-router.types';

// ─── Input bag for the assembler ─────────────────────────────────────────────

export interface AssemblerInput {
  campaignId:   string;
  executionId:  string;
  brain:        V2BrainOutput;
  platform:     string;
  /** Raw result from ViralTestService.launch() — null if UGC was skipped */
  ugcLaunch:    LaunchViralTestResponse | null;
  /** Raw carousel dispatch results (one per variant) */
  carouselIds:  string[];
  /** Raw banner dispatch results (one per variant) */
  bannerIds:    string[];
  /** All FormatDispatchResults for cross-format scoring fallback */
  dispatches:   FormatDispatchResult[];
  startedAt:    number;   // Date.now() at run start
}

// ─── UGC block ────────────────────────────────────────────────────────────────

function buildUGCBlock(
  launch:   LaunchViralTestResponse,
  platform: string,
  brain:    V2BrainOutput,
): V2UGCBlock {
  const variants: V2UGCVariant[] = launch.variants.map((v, i) => ({
    variant_id:    v.variantId,
    persona:       v.persona,
    hook_id:       v.hookId,
    hook:          v.hook,
    emotion_arc:   brain.shared_emotion,
    tone:          'authentic',
    pacing:        'medium',
    script:        '',         // script resides in queue payload; not repeated here
    scenes:        [],         // populated by Kling compiler; available via job status
    kling_jobs:    [launch.jobIds[i] ?? ''].filter(Boolean),
    score_estimate: v.ugcScoreEstimate,
  }));

  return {
    type:     'ugc',
    platform,
    test_id:  launch.testId,
    variants,
    job_ids:  launch.jobIds,
    status:   'dispatched',
  };
}

// ─── Carousel block ───────────────────────────────────────────────────────────

function buildCarouselBlock(creativeIds: string[], brain: V2BrainOutput): V2CarouselBlock {
  const creatives: V2CarouselCreative[] = creativeIds.map((id, i) => ({
    creative_id: id,
    variant:     String.fromCharCode(65 + i),
    slides:      [],     // slide content is in DB via creative record
    status:      'dispatched',
  }));

  return {
    type:      'carousel',
    engine:    'imagen + layout engine',
    creatives,
    status:    creativeIds.length > 0 ? 'dispatched' : 'failed',
  };
}

// ─── Banner block ─────────────────────────────────────────────────────────────

function buildBannerBlock(creativeIds: string[], brain: V2BrainOutput): V2BannerBlock {
  const creatives: V2BannerCreative[] = creativeIds.map((id, i) => ({
    creative_id:   id,
    variant:       String.fromCharCode(65 + i),
    headline:      brain.shared_hook.slice(0, 60),
    subtext:       '',
    visual_prompt: `${brain.shared_angle} style, ${brain.shared_emotion} emotion`,
    sizes:         ['1080x1080', '1080x1920', '1200x628'],
    status:        'dispatched',
  }));

  return {
    type:      'banner',
    creatives,
    status:    creativeIds.length > 0 ? 'dispatched' : 'failed',
  };
}

// ─── Execution block ──────────────────────────────────────────────────────────

function buildExecutionBlock(
  ugcJobIds:    string[],
  carouselIds:  string[],
  bannerIds:    string[],
): V2ExecutionBlock {
  const ugcJobs:      V2JobEntry[] = ugcJobIds.map(id => ({ job_id: id, format: 'ugc',      status: 'queued' }));
  const carouselJobs: V2JobEntry[] = carouselIds.map(id => ({ job_id: id, format: 'carousel', status: 'queued' }));
  const bannerJobs:   V2JobEntry[] = bannerIds.map(id => ({ job_id: id, format: 'banner',    status: 'queued' }));

  return {
    ugc_jobs:      ugcJobs,
    carousel_jobs: carouselJobs,
    banner_jobs:   bannerJobs,
    total_jobs:    ugcJobs.length + carouselJobs.length + bannerJobs.length,
    dispatched_at: new Date().toISOString(),
  };
}

// ─── Scoring block ────────────────────────────────────────────────────────────

function buildScoringBlock(
  brain:     V2BrainOutput,
  ugcLaunch: LaunchViralTestResponse | null,
  dispatches: FormatDispatchResult[],
): V2ScoringBlock {
  // UGC variant scores — derived from pre-render estimates
  const ugcScores: V2VariantScore[] = (ugcLaunch?.variants ?? [])
    .map((v, i) => ({
      variant_id:      v.variantId,
      hook_score:      Math.min(1, v.ugcScoreEstimate + 0.08),
      retention:       Math.min(1, v.ugcScoreEstimate + 0.04),
      conversion_prob: Math.min(1, v.ugcScoreEstimate - 0.02),
      composite:       v.ugcScoreEstimate,
      rank:            i + 1,
    }))
    .sort((a, b) => b.composite - a.composite)
    .map((s, i) => ({ ...s, rank: i + 1 }));

  // Format-level scores from dispatch results (success = base score, failed = 0)
  const fmt = (f: V2Format) => dispatches.find(d => d.format === f);
  const fmtScore = (f: V2Format, base: number) => {
    const d = fmt(f);
    return d?.status === 'dispatched' ? { format: f, score: base } : { format: f, score: 0 };
  };

  const carouselScores = brain.variant_allocation.carousel > 0
    ? [fmtScore('carousel', 0.74)]
    : [];

  const bannerScores = brain.variant_allocation.banner > 0
    ? [fmtScore('banner', 0.68)]
    : [];

  // Winner: top UGC variant vs. format scores
  const ugcBest = ugcScores[0];
  const carouselBest = carouselScores[0];
  const bannerBest   = bannerScores[0];

  type Candidate = { format: V2Format; score: number; variantId: string };
  const candidates: Candidate[] = [];
  if (ugcBest)      candidates.push({ format: 'ugc',      score: ugcBest.composite,    variantId: ugcBest.variant_id });
  if (carouselBest) candidates.push({ format: 'carousel', score: carouselBest.score,   variantId: 'carousel-A' });
  if (bannerBest)   candidates.push({ format: 'banner',   score: bannerBest.score,     variantId: 'banner-A' });

  candidates.sort((a, b) => b.score - a.score);
  const winner = candidates[0] ?? { format: brain.primary_format, score: 0.70, variantId: 'n/a' };
  const runnerUp = candidates[1];
  const gap      = runnerUp ? winner.score - runnerUp.score : winner.score;
  const confidence = runnerUp
    ? Math.min(1, Math.round((gap / Math.max(winner.score, 0.001)) * 1000) / 1000)
    : 1.0;

  return {
    ugc:      ugcScores,
    carousel: carouselScores,
    banner:   bannerScores,
    winner: {
      format:     winner.format,
      variant_id: winner.variantId,
      score:      winner.score,
      confidence,
    },
  };
}

// ─── Learning block ───────────────────────────────────────────────────────────

function buildLearningBlock(
  brain:      V2BrainOutput,
  ugcLaunch:  LaunchViralTestResponse | null,
  scoring:    V2ScoringBlock,
): V2LearningBlock {
  // Best hooks: winner UGC variant hook + brain shared hook
  const bestHooks: string[] = [];
  const winnerVariant = ugcLaunch?.variants?.find(v => v.variantId === scoring.winner.variant_id);
  if (winnerVariant) bestHooks.push(winnerVariant.hook);
  if (brain.shared_hook && !bestHooks.includes(brain.shared_hook)) bestHooks.push(brain.shared_hook);

  // Best personas: from top-scoring UGC variants
  const bestPersonas = [...new Set(
    (scoring.ugc ?? [])
      .slice(0, 3)
      .map(s => {
        const v = ugcLaunch?.variants?.find(vv => vv.variantId === s.variant_id);
        return v?.persona ?? '';
      })
      .filter(Boolean),
  )];

  // Best formats: ordered by score
  type FmtScore = { fmt: V2Format; score: number };
  const fmtScoresAll: FmtScore[] = [
    { fmt: 'ugc'      as V2Format, score: scoring.ugc[0]?.composite      ?? 0 },
    { fmt: 'carousel' as V2Format, score: scoring.carousel[0]?.score     ?? 0 },
    { fmt: 'banner'   as V2Format, score: scoring.banner[0]?.score       ?? 0 },
  ];
  const fmtScores: FmtScore[] = fmtScoresAll
    .filter((f): f is FmtScore => f.score > 0)
    .sort((a, b) => b.score - a.score);

  const bestFormats = fmtScores.map(f => f.fmt) as V2Format[];

  // Trend weights: normalised from routing allocation + winner boost
  const base = { ...brain.routing };
  const winnerFmt = scoring.winner.format;
  const WINNER_BOOST = 0.08;
  base[winnerFmt] = Math.min(1, (base[winnerFmt] ?? 0) + WINNER_BOOST);
  const total = base.ugc + base.carousel + base.banner;
  const trendUpdate = {
    ugc_weight:      Math.round((base.ugc      / total) * 100) / 100,
    carousel_weight: Math.round((base.carousel / total) * 100) / 100,
    banner_weight:   Math.round((base.banner   / total) * 100) / 100,
  };

  return { best_hooks: bestHooks, best_personas: bestPersonas, best_formats: bestFormats, trend_update: trendUpdate };
}

// ─── Overall status ───────────────────────────────────────────────────────────

function deriveStatus(dispatches: FormatDispatchResult[]): V2Status {
  if (dispatches.length === 0)                          return 'failed';
  if (dispatches.every(d => d.status === 'dispatched')) return 'dispatched';
  if (dispatches.some(d => d.status === 'dispatched'))  return 'partial';
  return 'failed';
}

// ─── Public assembler ─────────────────────────────────────────────────────────

export function assembleV2Output(input: AssemblerInput): V2OutputSchema {
  const {
    campaignId, executionId, brain, platform,
    ugcLaunch, carouselIds, bannerIds, dispatches, startedAt,
  } = input;

  const ugcBlock      = ugcLaunch ? buildUGCBlock(ugcLaunch, platform, brain) : null;
  const carouselBlock = carouselIds.length > 0 ? buildCarouselBlock(carouselIds, brain) : null;
  const bannerBlock   = bannerIds.length   > 0 ? buildBannerBlock(bannerIds, brain)     : null;

  const execution = buildExecutionBlock(
    ugcLaunch?.jobIds ?? [],
    carouselIds,
    bannerIds,
  );

  const scoring  = buildScoringBlock(brain, ugcLaunch, dispatches);
  const learning = buildLearningBlock(brain, ugcLaunch, scoring);
  const status   = deriveStatus(dispatches);
  const durationMs = Date.now() - startedAt;

  return {
    campaign_id:  campaignId,
    execution_id: executionId,
    brain,
    ugc:          ugcBlock,
    carousel:     carouselBlock,
    banner:       bannerBlock,
    execution,
    scoring,
    learning,
    status,
    created_at:   new Date().toISOString(),
    duration_ms:  durationMs,
  };
}
