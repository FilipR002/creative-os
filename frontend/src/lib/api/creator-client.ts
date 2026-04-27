// ─── Creator API Client — UserContext-Aware ───────────────────────────────────
// All engine calls (concept, angles, orchestrator) REQUIRE a UserContext.
// Missing context → ENGINE_BLOCKED error thrown before any network request.

import type {
  Campaign, Concept, AngleSelectResult,
  VideoCreative, CarouselCreative, BannerCreative,
} from '../types/creator';
import { requireUserContext, deriveEngineParams, type UserContext } from '../user-context';

// In production (Vercel), NEXT_PUBLIC_API_URL = Railway URL → call directly.
// In development, rewrites proxy relative /api/* calls to localhost:4000.
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';
const BASE = API_URL && !API_URL.includes('localhost') ? API_URL : '';

// ── Supabase JWT helpers ──────────────────────────────────────────────────────

async function getAuthHeaders(): Promise<Record<string, string>> {
  // Dynamically import to avoid SSR issues
  const { getSupabase } = await import('../supabase');
  const { data: { session } } = await getSupabase().auth.getSession();

  if (session?.access_token) {
    return { 'Authorization': `Bearer ${session.access_token}` };
  }

  // No session — return empty headers; backend will reject with 401
  return {};
}

// Idempotent user registration — syncs Supabase user to Prisma on first call.
let _ensuredId = '';
export async function ensureUser(): Promise<void> {
  const { getSupabase } = await import('../supabase');
  const { data: { session } } = await getSupabase().auth.getSession();
  const userId = session?.user?.id ?? '';
  if (!userId || _ensuredId === userId) return;
  try {
    const headers = await getAuthHeaders();
    await fetch(`${BASE}/api/users`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body:    JSON.stringify({ id: userId, email: session?.user?.email }),
    });
  } catch { return; }
  _ensuredId = userId;
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const authHeaders = await getAuthHeaders();
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...(init?.headers ?? {}),
    },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let message = `HTTP ${res.status}`;
    try {
      const json = JSON.parse(text);
      message = (json.message ?? json.error ?? text) || message;
    } catch { message = text || message; }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

// ── Campaigns ─────────────────────────────────────────────────────────────────

export interface CampaignCreativeSummary {
  id:        string;
  format:    string;
  isWinner:  boolean;
  score?:    { totalScore: number } | null;
}

export interface CampaignWithConcept extends Campaign {
  concept?:   import('../types/creator').Concept | null;
  creatives?: CampaignCreativeSummary[];
  groupCampaignId?: string | null;
}

export function listCampaigns(): Promise<CampaignWithConcept[]> {
  return req<CampaignWithConcept[]>('/api/campaign');
}

export function createCampaign(data: {
  mode:    string;
  formats: string[];
  name?:   string;
  goal?:   string;
  angle?:  string;
  tone?:   string;
  persona?: string;
}): Promise<Campaign> {
  return req<Campaign>('/api/campaign', {
    method: 'POST',
    body:   JSON.stringify(data),
  });
}

export function getCampaign(id: string): Promise<CampaignWithConcept> {
  return req<CampaignWithConcept>(`/api/campaign/${id}`);
}

export function patchCampaign(id: string, data: {
  name?:     string;
  goal?:     string;
  angle?:    string;
  tone?:     string;
  persona?:  string;
  isActive?: boolean;
}): Promise<Campaign> {
  return req<Campaign>(`/api/campaign/${id}`, {
    method: 'PATCH',
    body:   JSON.stringify(data),
  });
}

export function activateCampaign(id: string): Promise<Campaign> {
  return req<Campaign>(`/api/campaign/${id}/activate`, { method: 'PATCH' });
}

export function deleteCampaign(id: string): Promise<{ deleted: boolean }> {
  return req<{ deleted: boolean }>(`/api/campaign/${id}`, { method: 'DELETE' });
}

export function groupAdsIntoCampaign(name: string, adIds: string[]): Promise<{ groupId: string; name: string | null; adCount: number }> {
  return req('/api/campaign/from-ads', {
    method: 'POST',
    body:   JSON.stringify({ name, adIds }),
  });
}

// ── Current user / role ───────────────────────────────────────────────────────

export interface MeResult {
  id:    string;
  email: string | null;
  name:  string | null;
  role:  'admin' | 'user';
}

export function getMe(): Promise<MeResult> {
  return req<MeResult>('/api/users/me');
}

// ── Ad Groups ─────────────────────────────────────────────────────────────────

export interface AdGroupCreative {
  id:        string;
  format:    string;
  variant:   string;
  isWinner:  boolean;
  position:  number;
  adGroupId: string | null;
  content:   Record<string, unknown>;
  angle?:    { slug: string; label: string } | null;
  score?:    { totalScore: number; ctrScore: number; engagement: number; conversion: number } | null;
  createdAt: string;
}

export interface AdGroup {
  id:        string;
  name:      string;
  position:  number;
  creatives: AdGroupCreative[];
  createdAt: string;
}

export interface CampaignGroups {
  groups:    AdGroup[];
  ungrouped: AdGroupCreative[];
}

export function listAdGroups(campaignId: string): Promise<CampaignGroups> {
  return req<CampaignGroups>(`/api/campaign/${campaignId}/groups`);
}

export function createAdGroup(campaignId: string, name: string): Promise<AdGroup> {
  return req<AdGroup>(`/api/campaign/${campaignId}/groups`, {
    method: 'POST',
    body:   JSON.stringify({ name }),
  });
}

export function renameAdGroup(groupId: string, name: string): Promise<AdGroup> {
  return req<AdGroup>(`/api/ad-groups/${groupId}`, {
    method: 'PATCH',
    body:   JSON.stringify({ name }),
  });
}

export function deleteAdGroup(groupId: string): Promise<{ deleted: boolean }> {
  return req<{ deleted: boolean }>(`/api/ad-groups/${groupId}`, { method: 'DELETE' });
}

export function moveCreative(creativeId: string, targetGroupId: string | null): Promise<AdGroupCreative> {
  return req<AdGroupCreative>('/api/ad-groups/move', {
    method: 'POST',
    body:   JSON.stringify({ creativeId, targetGroupId }),
  });
}

export function reorderCreatives(campaignId: string, groupId: string | null, orderedIds: string[]): Promise<{ reordered: number }> {
  return req<{ reordered: number }>('/api/ad-groups/reorder', {
    method: 'POST',
    body:   JSON.stringify({ campaignId, groupId, orderedIds }),
  });
}

// ── Generations (Phase 4 API contract) ───────────────────────────────────────

export interface GenerationResult {
  id:              string;
  campaignId:      string;
  inputBrief:      string;
  intentSnapshot:  { goal: string; angle?: string; tone?: string; persona?: string; format: string };
  hook:            string;
  body:            string;
  cta:             string;
  variations:      Array<{ id: string; label: string; content: { hook: string; body: string; cta: string } }>;
  reasoning:       string | null;
  createdAt:       string;
}

export function createGeneration(data: {
  campaign_id:       string;
  brief:             string;
  override_settings?: { goal?: string; angle?: string; tone?: string; persona?: string; format?: string };
}): Promise<GenerationResult> {
  return req<GenerationResult>('/api/generations', {
    method: 'POST',
    body:   JSON.stringify(data),
  });
}

export function getGeneration(id: string): Promise<GenerationResult> {
  return req<GenerationResult>(`/api/generations/${id}`);
}

export function updateGenerationBlock(id: string, data: {
  block: 'hook' | 'body' | 'cta';
  value: string;
}): Promise<GenerationResult> {
  return req<GenerationResult>(`/api/generations/${id}/block`, {
    method: 'PATCH',
    body:   JSON.stringify(data),
  });
}

export function improveGenerationBlock(id: string, data: {
  block:       'hook' | 'body' | 'cta';
  instruction: string;
  context?:    { campaign_id?: string; keyObjection?: string; valueProposition?: string };
}): Promise<{ updated_block: string; version_id: string | null }> {
  return req(`/api/generations/${id}/improve`, {
    method: 'POST',
    body:   JSON.stringify(data),
  });
}

export function sendFeedback(data: {
  generation_id?: string;
  signal_type:    'edit' | 'accept' | 'reject' | 'regenerate' | 'copy';
  block?:         string;
  change_type?:   string;
}): Promise<{ id: string }> {
  return req('/api/feedback', {
    method: 'POST',
    body:   JSON.stringify(data),
  });
}

// ── Concepts — requires UserContext ───────────────────────────────────────────

export function generateConcept(data: {
  campaignId:   string;
  brief:        string;
  audience?:    string;
  angleHint?:   string;
  toneHint?:    string;
  userContext:  UserContext;
}): Promise<{ concept: Concept; raw: unknown }> {
  // Block execution if UserContext is incomplete
  requireUserContext(data.userContext);

  const ep = deriveEngineParams(data.userContext);

  return req('/api/concept/generate', {
    method: 'POST',
    body: JSON.stringify({
      campaignId:   data.campaignId,
      brief:        data.brief,
      goal:         ep.goal,
      platform:     ep.platform,
      audience:     data.audience,
      durationTier: ep.durationTier,
      angleHint:    data.angleHint,
      toneHint:     data.toneHint,
      // Extended context passed for future engine use
      industry:     ep.industry,
      emotion:      ep.emotion,
      offerType:    data.userContext.offerType,
      contentStyle: data.userContext.contentStyle,
      riskLevel:    data.userContext.riskLevel,
    }),
  });
}

export function getConceptForCampaign(campaignId: string): Promise<Concept> {
  return req<Concept>(`/api/concept/campaign/${campaignId}`);
}

// ── Angles — requires UserContext ─────────────────────────────────────────────

export function selectAngles(data: {
  conceptId:   string;
  userContext: UserContext;
}): Promise<AngleSelectResult> {
  requireUserContext(data.userContext);

  const ep = deriveEngineParams(data.userContext);

  return req<AngleSelectResult>('/api/angles/select', {
    method: 'POST',
    body: JSON.stringify({
      conceptId:      data.conceptId,
      format:         ep.format,
      clientIndustry: ep.industry,
      // riskLevel controls exploration mode in angle selection
      explorationMode: data.userContext.riskLevel,
    }),
  });
}

// ── Creatives ─────────────────────────────────────────────────────────────────

export function generateVideo(data: {
  campaignId:       string;
  conceptId:        string;
  angleSlug?:       string;
  durationTier:     string;
  variant?:         string;
  styleContext?:    string;
  keyObjection?:    string;
  valueProposition?: string;
}): Promise<VideoCreative> {
  return req<VideoCreative>('/api/video/generate', {
    method: 'POST',
    body:   JSON.stringify(data),
  });
}

export function generateCarousel(data: {
  campaignId:       string;
  conceptId:        string;
  angleSlug?:       string;
  slideCount:       number;
  platform?:        string;
  variant?:         string;
  styleContext?:    string;
  keyObjection?:    string;
  valueProposition?: string;
}): Promise<CarouselCreative> {
  return req<CarouselCreative>('/api/carousel/generate', {
    method: 'POST',
    body:   JSON.stringify(data),
  });
}

export function generateBanner(data: {
  campaignId:       string;
  conceptId:        string;
  angleSlug?:       string;
  sizes:            string[];
  variant?:         string;
  styleContext?:    string;
  keyObjection?:    string;
  valueProposition?: string;
}): Promise<BannerCreative> {
  return req<BannerCreative>('/api/banner/generate', {
    method: 'POST',
    body:   JSON.stringify(data),
  });
}

// ── Outcome Learning Weights ──────────────────────────────────────────────────

/** Fetch per-user outcome weights from the backend (Phase 8 Outcome Learning Layer). */
export function getOutcomeWeights(): Promise<Record<string, number>> {
  return req<Record<string, number>>('/api/outcomes/weights').catch(() => ({}));
}

// ── Feedback Weights + Calibration ───────────────────────────────────────────

export function getFeedbackWeights(): Promise<Record<string, number>> {
  return req<Record<string, number>>('/api/feedback/weights').catch(() => ({}));
}

export interface CalibrationFactor { dimension: string; adjustment: number; reason?: string; }
export function getCalibrationFactors(): Promise<CalibrationFactor[]> {
  return req<CalibrationFactor[]>('/api/feedback/calibration').catch(() => []);
}

// ── Angles ────────────────────────────────────────────────────────────────────

export interface AngleDefinition { slug: string; label: string; description?: string; tag?: string; }
export function listAngles(): Promise<AngleDefinition[]> {
  return req<AngleDefinition[]>('/api/angles');
}
export function getAngleBySlug(slug: string): Promise<AngleDefinition> {
  return req<AngleDefinition>(`/api/angles/${slug}`);
}

// ── Creative Retrieval by Campaign ────────────────────────────────────────────

export function getVideosByCampaign(campaignId: string): Promise<VideoCreative[]> {
  return req<VideoCreative[]>(`/api/video/campaign/${campaignId}`);
}
export function getCarouselsByCampaign(campaignId: string): Promise<CarouselCreative[]> {
  return req<CarouselCreative[]>(`/api/carousel/campaign/${campaignId}`);
}
export function getBannersByCampaign(campaignId: string): Promise<BannerCreative[]> {
  return req<BannerCreative[]>(`/api/banner/campaign/${campaignId}`);
}

// ── Per-creative Improvement ──────────────────────────────────────────────────

export function getSingleImprovement(creativeId: string): Promise<ImprovementResult | null> {
  return req<ImprovementResult>(`/api/improvement/${creativeId}`).catch(() => null);
}

// ── Angle Evolution Engine ────────────────────────────────────────────────────
// Typed versions defined below at getEvolutionStatusTyped / getEvolutionLogTyped / getAngleHealthTyped.
// These untyped aliases are kept for backward compat with existing callers.

/** @deprecated Use getEvolutionStatusTyped() — fully typed return shape */
export function getEvolutionStatus(): Promise<EvolutionStatusResult> {
  return req<EvolutionStatusResult>('/api/evolution/status');
}
/** @deprecated Use getAngleHealthTyped() — fully typed return shape */
export function getEvolutionHealth(): Promise<AngleHealthEntry[]> {
  return req<AngleHealthEntry[]>('/api/evolution/health');
}
export function getEvolutionMutations(status?: string): Promise<unknown[]> {
  return req<unknown[]>(`/api/evolution/mutations${status ? `?status=${status}` : ''}`);
}
/** @deprecated Use getEvolutionLogTyped() — fully typed return shape */
export function getEvolutionLog(limit = 50): Promise<EvolutionLogEntry[]> {
  return req<EvolutionLogEntry[]>(`/api/evolution/log?limit=${limit}`);
}
export function runEvolutionCycle(): Promise<unknown> {
  return req('/api/evolution/cycle', { method: 'POST' });
}
export function forceMutateAngle(slug: string, score?: number): Promise<unknown> {
  return req(`/api/evolution/mutate/${slug}`, {
    method: 'POST',
    body:   JSON.stringify({ score: score ?? 0.30 }),
  });
}

// ── AI Creative Generation ────────────────────────────────────────────────────

export interface AdCopyInput {
  campaignId: string; conceptId?: string; angleSlug: string;
  coreMessage: string; platform: string; format: string;
  audience?: string; tone?: string; charLimit?: number;
}
export interface HooksInput {
  coreMessage: string; angleSlug: string; platform: string;
  audience?: string; count?: number;
}
export interface VideoScriptInput {
  campaignId: string; conceptId?: string; angleSlug: string;
  coreMessage: string; platform: string; durationSec: number;
  audience?: string; hook?: string;
}
export interface ImagePromptsInput {
  coreMessage: string; angleSlug: string; platform: string;
  format: string; emotion?: string; count?: number;
}

export function generateAdCopy(data: AdCopyInput) {
  return req('/api/creative-ai/copy', { method: 'POST', body: JSON.stringify(data) });
}
export function generateHooks(data: HooksInput) {
  return req('/api/creative-ai/hooks', { method: 'POST', body: JSON.stringify(data) });
}
export function generateVideoScript(data: VideoScriptInput) {
  return req('/api/creative-ai/script', { method: 'POST', body: JSON.stringify(data) });
}
export function generateImagePrompts(data: ImagePromptsInput) {
  return req('/api/creative-ai/image-prompts', { method: 'POST', body: JSON.stringify(data) });
}

// ── Images ────────────────────────────────────────────────────────────────────

export interface SceneImage  { sceneNumber: number; imageUrl: string | null; error: string | null; }
export interface SlideImage  { slideNumber: number; imageUrl: string | null; error: string | null; }
export interface BannerImage { bannerIndex: number; size: string; imageUrl: string | null; error: string | null; }

export function generateVideoImages(creativeId: string): Promise<{ images: SceneImage[] }> {
  return req(`/api/video/${creativeId}/images`, { method: 'POST' });
}

export function generateCarouselImages(creativeId: string): Promise<{ images: SlideImage[] }> {
  return req(`/api/carousel/${creativeId}/images`, { method: 'POST' });
}

export function generateBannerImages(creativeId: string): Promise<{ images: BannerImage[] }> {
  return req(`/api/banner/${creativeId}/images`, { method: 'POST' });
}

// ── Generation Versions ───────────────────────────────────────────────────────

export interface GenerationVersion {
  id:           string;
  generationId: string;
  hook:         string;
  body:         string;
  cta:          string;
  createdFrom:  'edit' | 'improve' | 'regenerate' | 'manual';
  createdAt:    string;
}

export function listGenerationVersions(generationId: string): Promise<GenerationVersion[]> {
  return req<GenerationVersion[]>(`/api/generations/${generationId}/versions`);
}

export function restoreGenerationVersion(versionId: string): Promise<GenerationResult> {
  return req<GenerationResult>(`/api/versions/${versionId}/restore`, { method: 'POST' });
}

export function saveManualSnapshot(generationId: string, data: {
  hook: string; body: string; cta: string;
}): Promise<GenerationVersion> {
  return req<GenerationVersion>(`/api/generations/${generationId}/versions`, {
    method: 'POST',
    body:   JSON.stringify({ ...data, createdFrom: 'manual' }),
  });
}

// ── Boost Hook ────────────────────────────────────────────────────────────────

export interface BoostHookResult {
  originalHook: string;
  boostedHook:  string;
  improvement:  string;
}

export function boostHook(data: {
  creativeId?: string;
  hook:        string;
  angle?:      string;
  platform?:   string;
}): Promise<BoostHookResult> {
  return req<BoostHookResult>('/api/video/boost-hook', {
    method: 'POST',
    body:   JSON.stringify(data),
  });
}

// ── Learning Cycle ────────────────────────────────────────────────────────────

export function runLearningCycle(campaignId: string): Promise<{ ok: boolean; [k: string]: unknown }> {
  return req(`/api/angles/learning/cycle/${campaignId}`, { method: 'POST' });
}

// ── Per-creative Score ────────────────────────────────────────────────────────

export function getCreativeScore(creativeId: string): Promise<CreativeScoreResult> {
  return req<CreativeScoreResult>(`/api/scoring/${creativeId}`);
}

// ── Style Profile (backend) ───────────────────────────────────────────────────

export interface BackendStyleProfile {
  hookShort:      number;
  toneEmotional:  number;
  tonePremium:    number;
  toneAggressive: number;
  toneCasual:     number;
  ctaUrgency:     number;
  ctaDirect:      number;
  copyShort:      number;
  totalSignals:   number;
  dominantTone:   string;
  adaptations:    string[];
}

export function fetchStyleProfile(): Promise<BackendStyleProfile> {
  return req<BackendStyleProfile>('/api/style/profile');
}

// ── Scoring ───────────────────────────────────────────────────────────────────

export interface CreativeScoreResult {
  creativeId:  string;
  format:      string;
  dimensions?: Record<string, number>;
  ctrScore:    number;
  engagement:  number;
  conversion:  number;
  clarity:     number;
  totalScore:  number;
  isWinner:    boolean;
}

export function evaluateCreatives(creativeIds: string[]): Promise<CreativeScoreResult[]> {
  return req<CreativeScoreResult[]>('/api/scoring/evaluate', {
    method: 'POST',
    body:   JSON.stringify({ creativeIds }),
  });
}

export function getCampaignScores(campaignId: string): Promise<CreativeScoreResult[]> {
  return req<CreativeScoreResult[]>(`/api/scoring/campaign/${campaignId}`);
}

// ── Improvement ───────────────────────────────────────────────────────────────

export interface ImprovementResult {
  originalCreativeId: string;
  improvedCreativeId: string;
  improvementTypes:   string[];
  scoreBefore:        number;
  scoreAfter:         number;
  delta:              number;
  changesApplied:     { hook?: string; body?: string; cta?: string } | null;
}

export function runImprovement(campaignId: string): Promise<ImprovementResult[]> {
  return req<ImprovementResult[]>('/api/improvement/run', {
    method: 'POST',
    body:   JSON.stringify({ campaignId }),
  });
}

export function getCampaignImprovements(campaignId: string): Promise<ImprovementResult[]> {
  return req<ImprovementResult[]>(`/api/improvement/campaign/${campaignId}`);
}

// ── Learning Status ───────────────────────────────────────────────────────────

export interface RankedAngleStatus {
  slug:          string;
  label:         string;
  weight:        number;
  smoothedScore: number;
  winRate:       number;
  sampleCount:   number;
  status:        string;
}

export interface LearningStatus {
  system: {
    totalLearningCycles: number;
    anglesTracked:       number;
    learningHealth:      string;
    dominanceAngle:      string;
    explorationSignal:   number;
  };
  rankedAngles: RankedAngleStatus[];
}

export function getLearningStatus(): Promise<LearningStatus> {
  return req<LearningStatus>('/api/angles/learning/status');
}

// ── Global Stats ──────────────────────────────────────────────────────────────

export interface GlobalStats {
  topAngles?: { slug: string; label?: string; avgScore: number; totalUsage?: number }[];
  globalWinner?: string;
  [key: string]: unknown;
}

export function getGlobalStats(): Promise<GlobalStats> {
  return req<GlobalStats>('/api/outcomes/global-stats');
}

// ── Scoreboard (correctly-typed, backend returns scores:{ctr,…} nested) ─────────

export interface ScoreboardEntry {
  creativeId: string;
  format:     string;
  angle:      string | null;
  isWinner:   boolean;
  scores: {
    ctr:        number;
    engagement: number;
    conversion: number;
    clarity:    number;
    total:      number;
  };
}

export function getCampaignScoreBoard(campaignId: string): Promise<ScoreboardEntry[]> {
  return req<ScoreboardEntry[]>(`/api/scoring/campaign/${campaignId}`);
}

// ── Improvement (correctly-typed response shapes) ─────────────────────────────

export interface ImprovementRecord {
  originalCreativeId: string;
  improvedCreativeId: string | null;
  types:              string[];
  accepted:           boolean;
  scoreBefore:        number;
  scoreAfter:         number | null;
  delta:              number | null;
  message?:           string;
}

export interface ImprovementHistoryResult {
  campaignId: string;
  total:      number;
  accepted:   number;
  records:    ImprovementRecord[];
}

export interface ImprovementRunResult {
  campaignId:     string;
  totalCreatives: number;
  improved:       number;
  rejected:       number;
  skipped:        number;
  finalWinner:    { creativeId: string; score: number; format: string } | null;
  results:        ImprovementRecord[];
}

export function getImprovementHistory(campaignId: string): Promise<ImprovementHistoryResult> {
  return req<ImprovementHistoryResult>(`/api/improvement/campaign/${campaignId}`);
}

export function runCampaignImprovement(campaignId: string): Promise<ImprovementRunResult> {
  return req<ImprovementRunResult>('/api/improvement/run', {
    method: 'POST',
    body:   JSON.stringify({ campaignId }),
  });
}

// ── Evolution (correctly-typed) ───────────────────────────────────────────────

export interface EvolutionStatusResult {
  totalMutations:  number;
  activeMutations: number;
  prunedAngles:    number;
  champions:       number;
  lastCycleAt:     string | null;
}

export interface EvolutionLogEntry {
  id:        string;
  event:     string;
  angleSlug: string;
  details?:  unknown;
  createdAt: string;
}

export interface AngleHealthEntry {
  angleSlug:   string;
  reportCount: number;
  avgScore:    number;
  avgCtr:      number;
  status:      string;
  hasMutation: boolean;
  isMutantOf:  string | null;
}

export function getEvolutionStatusTyped(): Promise<EvolutionStatusResult> {
  return req<EvolutionStatusResult>('/api/evolution/status');
}

export function getEvolutionLogTyped(limit = 10): Promise<EvolutionLogEntry[]> {
  return req<EvolutionLogEntry[]>(`/api/evolution/log?limit=${limit}`);
}

export function getAngleHealthTyped(): Promise<AngleHealthEntry[]> {
  return req<AngleHealthEntry[]>('/api/evolution/health');
}

// ── Memory System ─────────────────────────────────────────────────────────────

export interface MemoryAngle {
  slug:   string;
  weight: number;
  uses:   number;
  [key: string]: unknown;
}

export interface MemoryFormatStat {
  format: string;
  weight: number;
  [key: string]: unknown;
}

export interface MemoryWinRate {
  angleSlug: string;
  winRate:   number;
  total:     number;
  wins:      number;
}

/** Best performing angles ranked by avg score, scoped to user. */
export function getMemoryBestAngles(clientId?: string, industry?: string): Promise<{ angles: MemoryAngle[] }> {
  const qs = new URLSearchParams();
  if (clientId) qs.set('clientId', clientId);
  if (industry) qs.set('industry', industry);
  const q = qs.toString();
  return req<{ angles: MemoryAngle[] }>(`/api/memory/best-angles${q ? `?${q}` : ''}`);
}

/** Format performance stats (video vs carousel vs banner). */
export function getMemoryFormatStats(clientId?: string, industry?: string): Promise<{ stats: MemoryFormatStat[] }> {
  const qs = new URLSearchParams();
  if (clientId) qs.set('clientId', clientId);
  if (industry) qs.set('industry', industry);
  const q = qs.toString();
  return req<{ stats: MemoryFormatStat[] }>(`/api/memory/format-stats${q ? `?${q}` : ''}`);
}

/** Win-rate per angle, scoped to user. */
export function getMemoryWinRates(): Promise<MemoryWinRate[]> {
  return req<MemoryWinRate[]>('/api/memory/win-rates');
}

// ── Campaign Insight ──────────────────────────────────────────────────────────

export interface CampaignInsight {
  headline:       string;
  reason:         string;
  suggestion:     string;
  expectedImpact: string;
  campaignId:     string;
  generatedAt:    string;
}

/** Human-readable performance insight for a campaign. */
export function getCampaignInsight(campaignId: string): Promise<CampaignInsight> {
  return req<CampaignInsight>(`/api/insights/${campaignId}`);
}

// ── Campaign Generations ──────────────────────────────────────────────────────

export interface GenerationSummary {
  id:         string;
  campaignId: string;
  inputBrief: string;
  hook:       string;
  body:       string;
  cta:        string;
  createdAt:  string;
}

/** List all generations for a campaign (newest first). */
export function getCampaignGenerations(campaignId: string): Promise<GenerationSummary[]> {
  return req<GenerationSummary[]>(`/api/generations/by-campaign?campaignId=${campaignId}`);
}

// ── Real Metrics Feedback ─────────────────────────────────────────────────────

export function submitRealMetrics(data: {
  creativeId: string;
  ctr:        number;
  retention:  number;
  conversion: number;
  industry?:  string;
}): Promise<{ ok?: boolean; [key: string]: unknown }> {
  return req('/api/feedback/real-metrics', {
    method: 'POST',
    body:   JSON.stringify(data),
  });
}

// ── Performance Import ────────────────────────────────────────────────────────

export interface PerformanceRowMetrics {
  impressions: number;
  clicks:      number;
  ctr:         number;
  conversions: number;
  revenue:     number;
}

export interface PerformanceRow {
  id:                  string;
  adName:              string;
  campaignName:        string;
  url:                 string | null;
  metrics:             PerformanceRowMetrics;
  extractedTrackingId: string | null;
  status:              'matched' | 'unmatched';
  matchedCreative:     { id: string; label: string } | null;
  confidence:          number;
}

export interface ImportResult {
  rows:  PerformanceRow[];
  stats: {
    total:      number;
    matched:    number;
    unmatched:  number;
    confidence: number;
  };
}

export interface PerformanceInsights {
  topPerformer:  { id: string; label: string; ctr: number; conversions: number; totalScore: number } | null;
  weakPerformer: { id: string; label: string; ctr: number; conversions: number; totalScore: number } | null;
  insight:       string | null;
  performers:    Array<{ id: string; label: string; ctr: number; conversions: number; totalScore: number }>;
}

/** Upload a CSV file from Meta/Google/TikTok. Returns parsed + matched row data for review. */
export async function importPerformanceCsv(file: File): Promise<ImportResult> {
  const formData = new FormData();
  formData.append('file', file);
  const authHeaders = await getAuthHeaders();
  const res = await fetch(`${BASE}/api/performance/import`, {
    method:  'POST',
    headers: authHeaders,   // no Content-Type — browser sets multipart boundary
    body:    formData,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText);
    throw new Error(body || `HTTP ${res.status}`);
  }
  return res.json() as Promise<ImportResult>;
}

/** Confirm import — submit reviewed rows to the learning engine. */
export function confirmImport(rows: Array<{ creativeId: string; metrics: PerformanceRowMetrics }>): Promise<{ submitted: number; failed: number }> {
  return req('/api/performance/confirm-import', {
    method: 'POST',
    body:   JSON.stringify({ rows }),
  });
}

/** Submit manually-matched rows (legacy). */
export function submitManualMatch(rows: Array<{
  creativeId: string;
  metrics: PerformanceRowMetrics;
}>): Promise<{ submitted: number; failed: number }> {
  return req('/api/performance/manual-match', {
    method: 'POST',
    body:   JSON.stringify({ rows }),
  });
}

/** Get performance insights for a campaign (or all campaigns). */
export function getPerformanceInsights(campaignId?: string): Promise<PerformanceInsights> {
  const qs = campaignId ? `?campaignId=${campaignId}` : '';
  return req<PerformanceInsights>(`/api/performance/insights${qs}`);
}

// ── MIROFISH — Audience Simulation Engine ────────────────────────────────────

export interface MirofishSimulateInput {
  creative_id?:  string;
  campaign_id?:  string;
  concept_id?:   string;
  angles:        { primary: string; secondary?: string };
  mode?:         'v1' | 'v2';
}

export interface MirofishResult {
  overall_score:           number;
  conversion_probability:  number;
  attention:               number;
  trust:                   number;
  virality:                number;
  risk?:                   string;
  angle_synergy?:          number;
  [key: string]:           unknown;
}

export interface MirofishLearningStatus {
  overall_accuracy:         number;
  avg_absolute_error:       number;
  exploration_adjustment:   number;
  top_underestimated?:      string[];
  top_overestimated?:       string[];
  [key: string]:            unknown;
}

export function mirofishSimulate(input: MirofishSimulateInput): Promise<MirofishResult> {
  return req<MirofishResult>('/api/mirofish/simulate', {
    method: 'POST',
    body:   JSON.stringify(input),
  });
}

export function mirofishLearningStatus(): Promise<MirofishLearningStatus> {
  return req<MirofishLearningStatus>('/api/mirofish/learning/status');
}

export function mirofishRunLearningLoop(campaignId: string): Promise<unknown> {
  return req(`/api/mirofish/learning/loop/${campaignId}`, { method: 'POST' });
}

// ── AUTO-WINNER — Weighted Creative Comparison ────────────────────────────────

export interface AutoWinnerVariant {
  id:               string;
  content:          unknown;
  performance_data?: { ctr?: number; retention?: number; conversion?: number; clarity?: number };
}

export interface AutoWinnerInput {
  format:              'video' | 'carousel' | 'banner';
  creative_variants:   AutoWinnerVariant[];
  angle_context:       { primary: string; secondary?: string };
  exploration_signal?: number;
}

export interface AutoWinnerScoredVariant {
  id:                string;
  final_score:       number;
  breakdown:         { ctr: number; retention: number; conversion: number; clarity: number };
  angle_alignment:   number;
  fatigue_penalty:   number;
  exploration_bonus: number;
}

export interface AutoWinnerResult {
  format:   string;
  variants: AutoWinnerScoredVariant[];
  winner:   { id: string; final_score: number };
  reasoning: string;
}

export function autoWinnerEvaluate(input: AutoWinnerInput): Promise<AutoWinnerResult> {
  return req<AutoWinnerResult>('/api/auto-winner/evaluate', {
    method: 'POST',
    body:   JSON.stringify(input),
  });
}

// ── ORCHESTRATOR — Decision Pipeline ─────────────────────────────────────────

export interface OrchestratorDecideInput {
  concept_id?:  string;
  campaign_id?: string;
  user_id?:     string;
  goal?:        string;
  emotion?:     string;
}

export interface OrchestratorDecision {
  primary_angle:             string;
  secondary_angle:           string | null;
  decision_breakdown: {
    memory_influence:      string;
    scoring_influence:     string;
    mirofish_influence:    string;
    blending_influence:    string;
    exploration_influence: string;
  };
  conflict_resolution_log:  { conflict: string; resolution: string; winner: string }[];
  final_decision_reasoning:  string;
  system_stability_state:    'stable' | 'warming' | 'unstable';
  _meta: {
    angles_evaluated:   number;
    conflicts_detected: number;
    mirofish_overruled: number;
    computation_ms:     number;
  };
}

export function orchestratorDecide(input: OrchestratorDecideInput): Promise<OrchestratorDecision> {
  return req<OrchestratorDecision>('/api/orchestrator/decide', {
    method: 'POST',
    body:   JSON.stringify(input),
  });
}

export function orchestratorStatus(): Promise<{ active: boolean; stability: string }> {
  return req<{ active: boolean; stability: string }>('/api/orchestrator/status');
}

// ── SCENE REWRITER — Micro-Rewriting Engine ───────────────────────────────────

export interface SceneRewriteInput {
  format:                  'video' | 'carousel' | 'banner';
  creative_segment:        string;
  original_hook_or_scene:  string;
  performance_signal:      { ctr?: number; retention?: number; conversion?: number; drop_off_point?: string };
  angle_context:           { primary: string; secondary?: string };
  emotion_context:         string;
  memory_signal?:          number;
  fatigue_signal?:         number;
}

export interface SceneRewriteVariant {
  original_segment:   string;
  rewritten_segment:  string;
  improvement_type:   'CLARITY' | 'EMOTIONAL' | 'PERFORMANCE';
  reason:             string;
  impact_score:       number;
}

export interface SceneRewriteResult {
  format:             string;
  rewrites:           SceneRewriteVariant[];
  best_rewrite_index: number;
  reasoning:          string;
}

export function sceneRewrite(input: SceneRewriteInput): Promise<SceneRewriteResult> {
  return req<SceneRewriteResult>('/api/scene-rewriter/rewrite', {
    method: 'POST',
    body:   JSON.stringify(input),
  });
}

// ── HOOK BOOSTER v1 / v2 ─────────────────────────────────────────────────────

export interface HookBoosterGenerateInput {
  format:            'video' | 'carousel' | 'banner';
  primary_angle:     string;
  secondary_angle?:  string | null;
  emotion:           string;
  goal:              string;
  product_context?:  string | null;
  audience_context?: string | null;
}

export interface HookVariant {
  hook:         string;
  strategy:     string;
  angle_usage:  { primary: string; secondary: string | null };
  emotion:      string;
  strength_score: number;
}

export interface HookBoosterOutput {
  format:          string;
  hooks:           HookVariant[];
  best_hook_index: number;
  reasoning:       string;
}

export function hookBoosterGenerate(input: HookBoosterGenerateInput): Promise<HookBoosterOutput> {
  return req<HookBoosterOutput>('/api/hook-booster/generate', {
    method: 'POST',
    body:   JSON.stringify(input),
  });
}

export interface HookV2Variant {
  hook:                  string;
  strategy:              'EXPLOIT' | 'EXPLORE' | 'HYBRID';
  improved_from:         string;
  angle_usage:           { primary: string; secondary: string | null };
  emotion:               string;
  memory_bias_applied:   boolean;
  fatigue_adjusted:      boolean;
  exploration_weight:    number;
  strength_score:        number;
}

export interface HookBoosterV2Output {
  format:          string;
  hooks:           HookV2Variant[];
  best_hook_index: number;
  reasoning:       string;
}

export function hookBoosterBoost(input: HookBoosterGenerateInput & {
  hook_v1_outputs:            HookBoosterOutput;
  memory_signal:              number;
  fatigue_signal:             number;
  exploration_pressure_delta: number;
}): Promise<HookBoosterV2Output> {
  return req<HookBoosterV2Output>('/api/hook-booster/boost', {
    method: 'POST',
    body:   JSON.stringify(input),
  });
}

// ── CAUSAL ATTRIBUTION ────────────────────────────────────────────────────────

export interface CausalTrace {
  angle_contribution:    number;
  hook_contribution:     number;
  audience_contribution: number;
  noise_contribution:    number;
  confidence:            number;
  [key: string]:         unknown;
}

export function causalAttributionAnalyze(campaignId: string): Promise<CausalTrace> {
  return req<CausalTrace>(`/api/causal-attribution/analyze/${campaignId}`, { method: 'POST' });
}

export function causalAttributionForCampaign(campaignId: string): Promise<CausalTrace[]> {
  return req<CausalTrace[]>(`/api/causal-attribution/campaign/${campaignId}`);
}

// ── FATIGUE SYSTEM ────────────────────────────────────────────────────────────

export interface AngleFatigueEntry {
  slug:           string;
  fatigueLevel:   'HEALTHY' | 'WARMING' | 'FATIGUED' | 'BLOCKED';
  fatigueScore:   number;
  recentUses?:    number;
  recommendation?: string;
  [key: string]:  unknown;
}

export function getFatigueAll(userId?: string, clientId?: string): Promise<AngleFatigueEntry[]> {
  const qs = new URLSearchParams();
  if (userId)   qs.set('userId',   userId);
  if (clientId) qs.set('clientId', clientId);
  const q = qs.toString();
  return req<AngleFatigueEntry[]>(`/api/fatigue/all${q ? `?${q}` : ''}`);
}

export function getFatigueForSlug(slug: string, userId?: string): Promise<AngleFatigueEntry> {
  const qs = userId ? `?userId=${userId}` : '';
  return req<AngleFatigueEntry>(`/api/fatigue/${slug}${qs}`);
}

// ── EMERGENCE SYSTEM ──────────────────────────────────────────────────────────

export interface EmergenceState {
  status:          string;
  driftScore?:     number;
  dominantPattern?: string | null;
  warning?:        string | null;
  confidence?:     number;
  [key: string]:   unknown;
}

export function getEmergenceState(): Promise<EmergenceState> {
  return req<EmergenceState>('/api/emergence/state');
}

export function refreshEmergenceState(): Promise<EmergenceState> {
  return req<EmergenceState>('/api/emergence/refresh', { method: 'POST' });
}

// ── EXPLORATION PRESSURE ENGINE ───────────────────────────────────────────────

export interface ExplorationPressureResult {
  exploration_pressure_delta: number;
  breakdown:                  { memory: number; fatigue: number; mirofish: number; base: number };
  confidence:                 number;
  risk_flags:                 string[];
}

export function getExplorationPressure(userId?: string, clientId?: string): Promise<ExplorationPressureResult> {
  const body: Record<string, string> = {};
  if (userId)   body.userId   = userId;
  if (clientId) body.clientId = clientId;
  return req<ExplorationPressureResult>('/api/exploration/pressure', {
    method: 'POST',
    body:   JSON.stringify(body),
  });
}

// ── INSIGHT REGENERATION ──────────────────────────────────────────────────────

export function regenerateCampaignInsight(campaignId: string): Promise<CampaignInsight> {
  return req<CampaignInsight>(`/api/insights/${campaignId}/regenerate`, { method: 'POST' });
}

// ── MEMORY STORE / QUERY ──────────────────────────────────────────────────────

export interface MemoryStoreInput {
  key:      string;
  value:    unknown;
  ttl?:     number;
  scope?:   'campaign' | 'user' | 'global';
  scopeId?: string;
}

export function storeMemory(input: MemoryStoreInput): Promise<{ stored: boolean }> {
  return req('/api/memory/store', { method: 'POST', body: JSON.stringify(input) });
}

export interface MemoryQueryInput {
  key:      string;
  scope?:   'campaign' | 'user' | 'global';
  scopeId?: string;
}

export function queryMemory(input: MemoryQueryInput): Promise<{ key: string; value: unknown; found: boolean }> {
  return req('/api/memory/query', { method: 'POST', body: JSON.stringify(input) });
}

// ── RECENT OUTCOMES ──────────────────────────────────────────────────────────

export interface RecentOutcome {
  id:          string;
  creativeId:  string;
  campaignId?: string;
  ctr?:        number;
  conversions?:number;
  revenue?:    number;
  recordedAt:  string;
}

export function getRecentOutcomes(limit = 20): Promise<RecentOutcome[]> {
  return req<RecentOutcome[]>(`/api/outcomes/recent?limit=${limit}`);
}

// ── CREATIVE AI — REFINE BLOCK ────────────────────────────────────────────────

export interface RefineBlockInput {
  conceptId?:     string;
  generationId?:  string;
  block:          'hook' | 'body' | 'cta';
  currentText:    string;
  instruction:    string;
  angle?:         string;
  tone?:          string;
}

export interface RefinedBlock {
  block:       string;
  original:    string;
  refined:     string;
  reasoning?:  string;
}

export function refineCreativeBlock(input: RefineBlockInput): Promise<RefinedBlock> {
  return req<RefinedBlock>('/api/creative-ai/refine-block', { method: 'POST', body: JSON.stringify(input) });
}

// ── STYLE SIGNAL ─────────────────────────────────────────────────────────────

export interface StyleSignalInput {
  signalType: 'edit' | 'accept' | 'reject' | 'copy';
  block?:     string;
  tone?:      string;
  angle?:     string;
  context?:   string;
}

export function sendStyleSignal(input: StyleSignalInput): Promise<{ recorded: boolean }> {
  return req('/api/style/signal', { method: 'POST', body: JSON.stringify(input) });
}

// ── FATIGUE RESET ─────────────────────────────────────────────────────────────

export function resetFatigue(slug: string): Promise<{ reset: boolean; slug: string }> {
  return req(`/api/fatigue/reset/${slug}`, { method: 'POST' });
}

// ── EXPLORATION BOOST ─────────────────────────────────────────────────────────

export interface ExplorationBoostInput {
  amount?:  number;
  reason?:  string;
  userId?:  string;
  clientId?:string;
}

export function boostExploration(input?: ExplorationBoostInput): Promise<{ boosted: boolean; newDelta: number }> {
  return req('/api/exploration/boost', { method: 'POST', body: JSON.stringify(input ?? {}) });
}

// ── REGISTRY ──────────────────────────────────────────────────────────────────

export interface RegistryEndpoint {
  method:      string;
  path:        string;
  label:       string;
  module:      string;
  uiExposure:  'VISIBLE_UI' | 'ADMIN_UI' | 'HIDDEN_INTERNAL';
  uiType:      string;
  clientFn?:   string;
  uiLocation?: string;
  connected:   boolean;
  notes?:      string;
}

export interface RegistryResponse {
  total:        number;
  connected:    number;
  disconnected: number;
  byExposure:   Record<string, RegistryEndpoint[]>;
  endpoints:    RegistryEndpoint[];
}

export function getRegistryEndpoints(): Promise<RegistryResponse> {
  return req<RegistryResponse>('/api/registry/endpoints');
}

// ── AUTONOMOUS LOOP ───────────────────────────────────────────────────────────

export type AutonomousLoopMode = 'MANUAL' | 'HYBRID' | 'AUTONOMOUS';

export interface AutonomousLoopStatus {
  mode:           AutonomousLoopMode;
  running:        boolean;
  cycleCount:     number;
  lastRunAt?:     string;
  nextRunAt?:     string;
  stabilityScore: number;
  safetyLock:     boolean;
  pendingActions: number;
}

export interface AutonomousLoopAuditEntry {
  id:         string;
  timestamp:  string;
  action:     string;
  trigger:    string;
  outcome:    'success' | 'failure' | 'skipped' | 'rolled_back';
  delta?:     Record<string, number>;
  rollbackId?:string;
  notes?:     string;
}

// NOTE: AutonomousLoopController uses @Controller('autonomous-loop') — NO /api/ prefix.
// getAutonomousLoopStatus() is kept as an alias for getAutonomousLoopState() for backward compat.
export function getAutonomousLoopStatus(): Promise<AutonomousLoopStatus> {
  // Maps to GET /autonomous-loop/state — the actual backend path (no /api/ prefix)
  return req<AutonomousLoopStatus>('/autonomous-loop/state');
}

// POST /autonomous-loop/trigger — manually kick off an ALC cycle
export function triggerAutonomousLoop(mode?: AutonomousLoopMode): Promise<{ triggered: boolean; cycleId: string }> {
  return req('/autonomous-loop/trigger', { method: 'POST', body: JSON.stringify({ mode }) });
}

// POST /autonomous-loop/stop — pause the autonomous loop
export function stopAutonomousLoop(): Promise<{ stopped: boolean }> {
  return req('/autonomous-loop/stop', { method: 'POST' });
}

// POST /autonomous-loop/mode — set MANUAL / HYBRID / AUTONOMOUS mode
export function setAutonomousLoopMode(mode: AutonomousLoopMode): Promise<{ mode: AutonomousLoopMode; updated: boolean }> {
  return req('/autonomous-loop/mode', { method: 'POST', body: JSON.stringify({ mode }) });
}

// Audit is served by AdminToolsController at /api/admin-tools/autonomous/audit
export function getAutonomousLoopAudit(limit = 50): Promise<AutonomousLoopAuditEntry[]> {
  return req<AutonomousLoopAuditEntry[]>(`/api/admin-tools/autonomous/audit?limit=${limit}`);
}

// Rollback via AdminToolsController
export function rollbackAutonomousAction(auditEntryId: string): Promise<{ rolledBack: boolean; entryId: string }> {
  return req(`/api/admin-tools/autonomous/audit/${auditEntryId}/rollback`, { method: 'POST' }).then(
    (r: unknown) => ({ rolledBack: true, entryId: auditEntryId, ...(r as object) })
  );
}

// ── ANGLE DETAIL PAGE HELPERS ─────────────────────────────────────────────────

export interface AngleDetailMetrics {
  slug:            string;
  label:           string;
  description?:    string;
  winRate?:        number;
  avgCtr?:         number;
  totalDeployments:number;
  recentTrend?:    'up' | 'down' | 'stable';
  topCampaigns?:   { id: string; name: string; ctr: number }[];
}

export function getAngleDetail(slug: string): Promise<AngleDetailMetrics> {
  return req<AngleDetailMetrics>(`/api/angles/${slug}`);
}

export function getAngleMemorySignals(slug: string): Promise<{ signals: { type: string; value: number; at: string }[] }> {
  // Uses POST /api/memory/query — the only memory read endpoint
  return req('/api/memory/query', {
    method: 'POST',
    body:   JSON.stringify({ key: `angle:${slug}`, scope: 'global' }),
  }).then((r: unknown) => {
    // Normalize: backend returns { key, value, found } — reshape to { signals }
    const result = r as { value?: { signals?: { type: string; value: number; at: string }[] } };
    return { signals: result?.value?.signals ?? [] };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN TOOLS — debug replay, simulation, memory weights, orchestrator rules,
// hook strategy, self-learning injection, autonomous audit
// ─────────────────────────────────────────────────────────────────────────────

// ── Debug Replay ──────────────────────────────────────────────────────────────

export interface ReplayStep {
  step:       number;
  name:       string;
  label:      string;
  data:       Record<string, unknown>;
  durationMs: number;
}

export interface ReplayResult {
  generationId:          string;
  found:                 boolean;
  steps:                 ReplayStep[];
  totalMs:               number;
  memoryWeightsApplied:  MemoryWeights;
}

export interface RecentGeneration {
  id:          string;
  format:      string;
  angle:       string | null;
  createdAt:   string;
  campaignId:  string | null;
}

export function getDebugGenerations(limit = 20): Promise<RecentGeneration[]> {
  return req<RecentGeneration[]>(`/api/admin-tools/debug/generations?limit=${limit}`);
}

export function replayGeneration(generationId: string): Promise<ReplayResult> {
  return req<ReplayResult>(`/api/admin-tools/debug/replay/${generationId}`);
}

// ── Simulation ────────────────────────────────────────────────────────────────

export interface SimulationInput {
  angle:          string;
  hookStrategy?:  Partial<HookStrategyConfig>;
  persona?:       string;
  campaignId?:    string;
}

export interface SimulationOutput {
  simulation:             boolean;
  input:                  SimulationInput;
  output: {
    predicted_ctr:        number;
    predicted_conversion: number;
    predicted_engagement: number;
    delta_vs_current:     number;
    confidence:           number;
    risk_flags:           string[];
  };
  weights_applied:        MemoryWeights;
  hook_strategy_applied:  HookStrategyConfig;
  generatedAt:            string;
}

export function runSimulation(input: SimulationInput): Promise<SimulationOutput> {
  return req<SimulationOutput>('/api/admin-tools/debug/simulate', {
    method: 'POST',
    body:   JSON.stringify(input),
  });
}

// ── Memory Weights ────────────────────────────────────────────────────────────

export interface MemoryWeights {
  ctr:        number;
  conversion: number;
  engagement: number;
  clarity:    number;
  updatedAt:  string;
}

export function getMemoryWeights(): Promise<MemoryWeights> {
  return req<MemoryWeights>('/api/admin-tools/memory/weights');
}

export function updateMemoryWeights(w: Partial<Omit<MemoryWeights, 'updatedAt'>>): Promise<MemoryWeights> {
  return req<MemoryWeights>('/api/admin-tools/memory/weights', {
    method: 'POST',
    body:   JSON.stringify(w),
  });
}

// ── Orchestrator Rules ────────────────────────────────────────────────────────

export interface OrchestratorRule {
  id:        string;
  condition: string;
  action:    string;
  priority:  number;
  enabled:   boolean;
}

export function getOrchestratorRules(): Promise<OrchestratorRule[]> {
  return req<OrchestratorRule[]>('/api/admin-tools/orchestrator/rules');
}

export function updateOrchestratorRules(rules: OrchestratorRule[]): Promise<OrchestratorRule[]> {
  return req<OrchestratorRule[]>('/api/admin-tools/orchestrator/rules', {
    method: 'POST',
    body:   JSON.stringify({ rules }),
  });
}

export function upsertOrchestratorRule(rule: OrchestratorRule): Promise<OrchestratorRule[]> {
  return req<OrchestratorRule[]>('/api/admin-tools/orchestrator/rules/upsert', {
    method: 'POST',
    body:   JSON.stringify(rule),
  });
}

// ── Hook Strategy ─────────────────────────────────────────────────────────────

export interface HookStrategyConfig {
  emotional:  number;
  urgency:    number;
  rational:   number;
  curiosity:  number;
  updatedAt:  string;
}

export function getHookStrategy(): Promise<HookStrategyConfig> {
  return req<HookStrategyConfig>('/api/admin-tools/hook-strategy');
}

export function updateHookStrategy(cfg: Partial<Omit<HookStrategyConfig, 'updatedAt'>>): Promise<HookStrategyConfig> {
  return req<HookStrategyConfig>('/api/admin-tools/hook-strategy', {
    method: 'POST',
    body:   JSON.stringify(cfg),
  });
}

// ── Self-Learning Injection ────────────────────────────────────────────────────

export interface SelfLearningEntry {
  id:          string;
  timestamp:   string;
  instruction: string;
  applied:     boolean;
  result?:     string;
}

export function injectLearning(instruction: string): Promise<SelfLearningEntry> {
  return req<SelfLearningEntry>('/api/admin-tools/self-learning/inject', {
    method: 'POST',
    body:   JSON.stringify({ instruction }),
  });
}

export function getSelfLearningLog(): Promise<SelfLearningEntry[]> {
  return req<SelfLearningEntry[]>('/api/admin-tools/self-learning/log');
}

// ── Admin-Tools Autonomous Audit ──────────────────────────────────────────────

export interface AdminAuditEntry {
  id:              string;
  timestamp:       string;
  triggerSource:   string;
  decision:        string;
  riskLevel:       'LOW' | 'MEDIUM' | 'HIGH';
  predictedImpact: string;
  applied:         boolean;
  rolledBack:      boolean;
  rollbackAt?:     string;
  mode:            string;
}

export function getAdminAuditLog(limit = 100): Promise<AdminAuditEntry[]> {
  return req<AdminAuditEntry[]>(`/api/admin-tools/autonomous/audit?limit=${limit}`);
}

export function appendAdminAudit(entry: Omit<AdminAuditEntry, 'id' | 'timestamp' | 'rolledBack' | 'rollbackAt'>): Promise<AdminAuditEntry> {
  return req<AdminAuditEntry>('/api/admin-tools/autonomous/audit', {
    method: 'POST',
    body:   JSON.stringify(entry),
  });
}

export function rollbackAdminAudit(id: string): Promise<AdminAuditEntry> {
  return req<AdminAuditEntry>(`/api/admin-tools/autonomous/audit/${id}/rollback`, { method: 'POST' });
}

// ── Admin Analytics ───────────────────────────────────────────────────────────

export interface AdminOverview {
  users?:        number;
  campaigns?:    number;
  creatives?:    number;
  wins?:         number;
  losses?:       number;
  avgCtr?:       number;
  avgConversion?:number;
  [key: string]: unknown;
}

export interface AdminLearningState {
  topAngles?:   { slug: string; avgScore: number }[];
  worstAngles?: { slug: string; avgScore: number }[];
  calibrationHealth?: string;
  [key: string]: unknown;
}

export interface AdminRealtimeFeedEntry {
  type:      string;
  userId?:   string;
  entityId?: string;
  detail?:   string;
  at:        string;
  [key: string]: unknown;
}

export interface AdminSystemHealth {
  status:            string;
  learningRate?:     number;
  improvementGain?:  number;
  recommendation?:   string;
  [key: string]: unknown;
}

export function getAdminOverview(): Promise<AdminOverview> {
  return req<AdminOverview>('/api/admin/analytics/overview');
}

export function getAdminLearningState(): Promise<AdminLearningState> {
  return req<AdminLearningState>('/api/admin/analytics/learning-state');
}

export function getAdminRealtimeFeed(limit = 20): Promise<AdminRealtimeFeedEntry[]> {
  return req<AdminRealtimeFeedEntry[]>(`/api/admin/analytics/realtime-feed?limit=${limit}`);
}

export function getAdminSystemHealth(): Promise<AdminSystemHealth> {
  return req<AdminSystemHealth>('/api/admin/analytics/system-health');
}

// ── Observability traces ──────────────────────────────────────────────────────

export interface ObsTrace {
  traceId:     string;
  campaignId?: string;
  steps?:      unknown[];
  createdAt?:  string;
  [key: string]: unknown;
}

export function getObsTrace(traceId: string): Promise<ObsTrace> {
  return req<ObsTrace>(`/api/observability/trace/${traceId}`);
}

export function getCampaignTraces(campaignId: string, limit = 20): Promise<ObsTrace[]> {
  return req<ObsTrace[]>(`/api/observability/campaign/${campaignId}/traces?limit=${limit}`);
}

export function analyzeDrift(campaignId: string): Promise<Record<string, unknown>> {
  return req(`/api/observability/campaign/${campaignId}/drift`);
}

export function compareTraces(t1: string, t2: string): Promise<Record<string, unknown>> {
  return req(`/api/observability/compare?t1=${t1}&t2=${t2}`);
}

// ── Memory — admin endpoints ──────────────────────────────────────────────────
// Typed interfaces and functions (getMemoryBestAngles, getMemoryFormatStats, getMemoryWinRates)
// are defined above at line ~686 using MemoryAngle / MemoryFormatStat / MemoryWinRate types.
// REMOVED: dead BestAngle / FormatStat / WinRate interfaces (superseded by typed versions).

// ── Global Memory ─────────────────────────────────────────────────────────────

// GET /api/global-memory/query — read-only 4-layer memory state
export function getGlobalMemory(clientId?: string, industry?: string, primaryAngle?: string): Promise<Record<string, unknown>> {
  const qs = new URLSearchParams();
  if (clientId)     qs.set('client_id',     clientId);
  if (industry)     qs.set('industry',      industry);
  if (primaryAngle) qs.set('primary_angle', primaryAngle);
  const q = qs.toString();
  return req<Record<string, unknown>>(`/api/global-memory/query${q ? `?${q}` : ''}`);
}

// POST /api/global-memory/learn — trigger a learn/sync cycle (admin only)
export function triggerGlobalMemoryLearn(): Promise<{ triggered: boolean }> {
  return req('/api/global-memory/learn', { method: 'POST' });
}

// ── Reality Engine ────────────────────────────────────────────────────────────

export interface RealityEvent {
  id?:         string;
  campaignId:  string;
  source:      string;
  metric:      string;
  value:       number;
  [key: string]: unknown;
}

export function getRealityEvents(campaignId: string): Promise<RealityEvent[]> {
  return req<RealityEvent[]>(`/api/reality/events/${campaignId}`);
}

export function getRealityAggregate(campaignId: string): Promise<Record<string, unknown>> {
  return req(`/api/reality/aggregate/${campaignId}`);
}

// ── Angle Insights ────────────────────────────────────────────────────────────

export interface AngleInsightSummary {
  angleSlug: string;
  count:     number;
  topThemes: string[];
  [key: string]: unknown;
}

export function getAngleInsightsSummary(): Promise<AngleInsightSummary[]> {
  return req<AngleInsightSummary[]>('/angle-insights/summary');
}

export function getAngleInsightsBySlug(slug: string, limit = 10): Promise<unknown[]> {
  return req<unknown[]>(`/angle-insights/${slug}?limit=${limit}`);
}

// ── Autonomous Loop — admin endpoints ─────────────────────────────────────────

export interface AutonomousLoopState {
  userId?:       string;
  status?:       string;
  lastRunAt?:    string;
  cycleCount?:   number;
  [key: string]: unknown;
}

// GET /autonomous-loop/state — ALC state for calling user
export function getAutonomousLoopState(): Promise<AutonomousLoopState> {
  return req<AutonomousLoopState>('/autonomous-loop/state');
}

// GET /autonomous-loop/states — all ALC states (admin view)
export function getAllAutonomousLoopStates(): Promise<AutonomousLoopState[]> {
  return req<AutonomousLoopState[]>('/autonomous-loop/states');
}

// POST /autonomous-loop/evaluate/:userId — manually trigger ALC evaluation (admin)
export function evaluateAutonomousLoop(userId: string): Promise<unknown> {
  return req(`/autonomous-loop/evaluate/${userId}`, { method: 'POST' });
}

// GET /autonomous-loop/policy/:userId — full ALC policy record (admin/audit)
export function getAutonomousLoopPolicy(userId: string): Promise<Record<string, unknown>> {
  return req<Record<string, unknown>>(`/autonomous-loop/policy/${userId}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// PREVIOUSLY ORPHAN ENDPOINTS — NOW WIRED
// All backend endpoints that previously had no client function.
// ─────────────────────────────────────────────────────────────────────────────

// ── Dashboard (Performance Dashboard Module) ──────────────────────────────────

export interface UserDashboard {
  clientId:    string;
  campaigns?:  number;
  creatives?:  number;
  topAngle?:   string;
  avgCtr?:     number;
  [key: string]: unknown;
}

export interface AdminDashboard {
  totalUsers?:    number;
  totalCampaigns?:number;
  systemHealth?:  string;
  [key: string]:  unknown;
}

/** GET /api/dashboard/user/:clientId — per-user performance dashboard */
export function getDashboardForUser(clientId: string): Promise<UserDashboard> {
  return req<UserDashboard>(`/api/dashboard/user/${clientId}`);
}

/** GET /api/dashboard/admin — admin-wide performance dashboard */
export function getAdminDashboard(): Promise<AdminDashboard> {
  return req<AdminDashboard>('/api/dashboard/admin');
}

/** GET /api/dashboard/snapshot/:clientId — point-in-time snapshot for a client */
export function getDashboardSnapshot(clientId: string): Promise<Record<string, unknown>> {
  return req<Record<string, unknown>>(`/api/dashboard/snapshot/${clientId}`);
}

// ── Product API Surface (Phase 9.5) ───────────────────────────────────────────

export interface ProductDashboard {
  campaigns?: number;
  topAngles?: string[];
  recentInsight?: string;
  [key: string]: unknown;
}

/** GET /api/product/dashboard — product-facing aggregate dashboard */
export function getProductDashboard(): Promise<ProductDashboard> {
  return req<ProductDashboard>('/api/product/dashboard');
}

/** GET /api/product/campaign/:campaignId — product view of a campaign */
export function getProductCampaign(campaignId: string): Promise<Record<string, unknown>> {
  return req<Record<string, unknown>>(`/api/product/campaign/${campaignId}`);
}

/** GET /api/product/insights/:campaignId — product-layer insights */
export function getProductInsights(campaignId: string): Promise<Record<string, unknown>> {
  return req<Record<string, unknown>>(`/api/product/insights/${campaignId}`);
}

/** GET /api/product/angles/:campaignId — product-layer angles view */
export function getProductAngles(campaignId: string): Promise<Record<string, unknown>> {
  return req<Record<string, unknown>>(`/api/product/angles/${campaignId}`);
}

/** GET /api/product/creatives/:campaignId — product-layer creatives */
export function getProductCreatives(campaignId: string): Promise<Record<string, unknown>> {
  return req<Record<string, unknown>>(`/api/product/creatives/${campaignId}`);
}

// ── Creative DNA ──────────────────────────────────────────────────────────────

export interface CreativeDnaEntry {
  angle:      string;
  avgScore:   number;
  dnaTraits?: string[];
  [key: string]: unknown;
}

/** GET /api/creative-dna/top — top-ranked creative DNA patterns */
export function getCreativeDnaTop(): Promise<CreativeDnaEntry[]> {
  return req<CreativeDnaEntry[]>('/api/creative-dna/top');
}

// INTERNAL ONLY — NO UI ACCESS (used internally by generation pipeline)
/** GET /api/creative-dna/prompt-context — prompt context builder for AI generation */
export function getCreativeDnaPromptContext(): Promise<Record<string, unknown>> {
  return req<Record<string, unknown>>('/api/creative-dna/prompt-context');
}

// ── System Status Endpoints (admin health checks) ─────────────────────────────

/** GET /api/auto-winner/status — auto-winner engine status */
export function getAutoWinnerStatus(): Promise<{ active: boolean; version?: string; [key: string]: unknown }> {
  return req('/api/auto-winner/status');
}

/** GET /api/hook-booster/status — hook booster engine status */
export function getHookBoosterStatus(): Promise<{ active: boolean; version?: string; [key: string]: unknown }> {
  return req('/api/hook-booster/status');
}

/** GET /api/scene-rewriter/status — scene rewriter engine status */
export function getSceneRewriterStatus(): Promise<{ active: boolean; version?: string; [key: string]: unknown }> {
  return req('/api/scene-rewriter/status');
}

/** GET /api/observability/status — observability engine status */
export function getObservabilityStatus(): Promise<{ active: boolean; version?: string; [key: string]: unknown }> {
  return req('/api/observability/status');
}

/** GET /api/exploration/status — exploration pressure engine status */
export function getExplorationStatus(): Promise<{ active: boolean; version?: string; [key: string]: unknown }> {
  return req('/api/exploration/status');
}

/** GET /api/observability/trace/:traceId/replay — replay a trace step-by-step */
export function replayObsTrace(traceId: string): Promise<Record<string, unknown>> {
  return req<Record<string, unknown>>(`/api/observability/trace/${traceId}/replay`);
}

// ── Causal Attribution Summary ────────────────────────────────────────────────

export interface CausalAttributionSummary {
  avgAngleContribution:    number;
  avgHookContribution:     number;
  avgAudienceContribution: number;
  topCampaign?:            string;
  [key: string]:           unknown;
}

/** GET /api/causal-attribution/summary — aggregate attribution summary */
export function getCausalAttributionSummary(): Promise<CausalAttributionSummary> {
  return req<CausalAttributionSummary>('/api/causal-attribution/summary');
}

// ── Outcomes — Report ─────────────────────────────────────────────────────────

export interface OutcomeReport {
  creativeId:   string;
  campaignId?:  string;
  ctr?:         number;
  conversions?: number;
  revenue?:     number;
  source?:      string;
}

/** POST /api/outcomes/report — ingest real outcome data */
export function reportOutcome(data: OutcomeReport): Promise<{ reported: boolean; id?: string }> {
  return req('/api/outcomes/report', { method: 'POST', body: JSON.stringify(data) });
}

// ── Cost Optimization ─────────────────────────────────────────────────────────

export interface CostMetrics {
  totalTokens?:     number;
  totalCost?:       number;
  cacheHitRate?:    number;
  savingsPercent?:  number;
  [key: string]:    unknown;
}

/** GET /api/optimization/metrics — cost optimization metrics (admin only) */
export function getCostOptimizationMetrics(): Promise<CostMetrics> {
  return req<CostMetrics>('/api/optimization/metrics');
}

// INTERNAL ONLY — NO UI ACCESS
/** POST /api/optimization/fingerprint — cache fingerprint lookup */
export function getCacheFingerprint(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  return req('/api/optimization/fingerprint', { method: 'POST', body: JSON.stringify(input) });
}

// INTERNAL ONLY — NO UI ACCESS
/** POST /api/optimization/evict — evict a cache entry */
export function evictCacheEntry(key: string): Promise<{ evicted: boolean }> {
  return req('/api/optimization/evict', { method: 'POST', body: JSON.stringify({ key }) });
}

// ── Global Memory — Status + Ingest ──────────────────────────────────────────

/** GET /api/global-memory/status — liveness check for global memory engine */
export function getGlobalMemoryStatus(): Promise<{ ok: boolean; engine: string }> {
  return req('/api/global-memory/status');
}

// INTERNAL ONLY — NO UI ACCESS (called by auto-winner pipeline)
/** POST /api/global-memory/ingest — ingest a campaign result into global memory */
export function ingestGlobalMemory(data: Record<string, unknown>): Promise<Record<string, unknown>> {
  return req('/api/global-memory/ingest', { method: 'POST', body: JSON.stringify(data) });
}

// ── Angle Insights — Full CRUD (admin) ────────────────────────────────────────

/** GET /angle-insights — all angle insights */
export function getAngleInsights(): Promise<unknown[]> {
  return req<unknown[]>('/angle-insights');
}

/** POST /angle-insights/synthesize/:angleSlug — AI-synthesize insights for an angle (admin) */
export function synthesizeAngleInsights(angleSlug: string): Promise<Record<string, unknown>> {
  return req(`/angle-insights/synthesize/${angleSlug}`, { method: 'POST' });
}

// ── Angle References (admin data management) ──────────────────────────────────

/** GET /angle-references — all angle references */
export function getAngleReferences(): Promise<unknown[]> {
  return req<unknown[]>('/angle-references');
}

/** GET /angle-references/:angleSlug — references for a specific angle */
export function getAngleReferencesBySlug(angleSlug: string): Promise<unknown[]> {
  return req<unknown[]>(`/angle-references/${angleSlug}`);
}

// INTERNAL ONLY — NO UI ACCESS (data ingestion pipeline)
/** POST /angle-references — create angle reference */
export function createAngleReference(data: Record<string, unknown>): Promise<Record<string, unknown>> {
  return req('/angle-references', { method: 'POST', body: JSON.stringify(data) });
}

// ── Routing (internal) ────────────────────────────────────────────────────────

// INTERNAL ONLY — NO UI ACCESS (used by generation pipeline smart routing)
/** POST /api/routing/decide — smart routing decision (pipeline internal) */
export function routingDecide(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  return req('/api/routing/decide', { method: 'POST', body: JSON.stringify(input) });
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTONOMOUS INTELLIGENCE COCKPIT
// Powers: /app/autonomous, /app/ai-stream, /app/pro-mode, /app/system-audit
// ─────────────────────────────────────────────────────────────────────────────

export type AutonomousMode   = 'MANUAL' | 'SUGGEST' | 'AUTONOMOUS' | 'AUTO_DEPLOY';
export type SystemStatus     = 'ACTIVE' | 'PAUSED' | 'LOCKED' | 'STEPPING';
export type AIBrainEventType =
  | 'ANGLE_SELECT' | 'MUTATION' | 'CREATIVE_EVAL' | 'FATIGUE_DETECT'
  | 'EXPLORATION_TRIGGER' | 'IMPROVEMENT' | 'LEARNING' | 'DECISION';

export interface AIBrainEvent {
  id:         string;
  timestamp:  string;
  type:       AIBrainEventType;
  title:      string;
  detail:     string;
  confidence: number;
  angleSlug?: string;
  campaignId?: string;
  meta?:      Record<string, unknown>;
}

export interface AutonomousDashboard {
  status:          SystemStatus;
  mode:            AutonomousMode;
  activeCampaigns: number;
  runningCycles:   number;
  queuedDecisions: number;
  confidence:      number;
  explorationRate: number;
  systemHealth:    'HEALTHY' | 'WARNING' | 'DEGRADED';
  lastCycleAt:     string | null;
  totalMutations:  number;
  champions:       number;
  recentEvents:    AIBrainEvent[];
}

/** GET /api/autonomous/dashboard — aggregate system status */
export function getAutonomousDashboard(): Promise<AutonomousDashboard> {
  return req<AutonomousDashboard>('/api/autonomous/dashboard');
}

/** GET /api/autonomous/decisions?limit — recent AI decision log */
export function getAutonomousDecisions(limit = 20): Promise<AIBrainEvent[]> {
  return req<AIBrainEvent[]>(`/api/autonomous/decisions?limit=${limit}`);
}

/** GET /api/autonomous/mode — current mode + status */
export function getAutonomousMode(): Promise<{ mode: AutonomousMode; status: SystemStatus; locked: boolean }> {
  return req<{ mode: AutonomousMode; status: SystemStatus; locked: boolean }>('/api/autonomous/mode');
}

/** POST /api/autonomous/pause */
export function pauseAutonomousSystem(): Promise<{ paused: boolean; status: SystemStatus }> {
  return req<{ paused: boolean; status: SystemStatus }>('/api/autonomous/pause', { method: 'POST' });
}

/** POST /api/autonomous/resume */
export function resumeAutonomousSystem(): Promise<{ resumed: boolean; status: SystemStatus }> {
  return req<{ resumed: boolean; status: SystemStatus }>('/api/autonomous/resume', { method: 'POST' });
}

/** POST /api/autonomous/step — execute a single autonomous step */
export function stepAutonomousSystem(): Promise<{ stepping: boolean; stepId: string; status: SystemStatus }> {
  return req<{ stepping: boolean; stepId: string; status: SystemStatus }>('/api/autonomous/step', { method: 'POST' });
}

/** POST /api/autonomous/lock — lock all campaigns */
export function lockAutonomousSystem(): Promise<{ locked: boolean; status: SystemStatus }> {
  return req<{ locked: boolean; status: SystemStatus }>('/api/autonomous/lock', { method: 'POST' });
}

/** POST /api/autonomous/mode — set autonomous mode */
export function setAutonomousMode(mode: AutonomousMode): Promise<{ mode: AutonomousMode; updated: boolean }> {
  return req<{ mode: AutonomousMode; updated: boolean }>('/api/autonomous/mode', {
    method: 'POST',
    body: JSON.stringify({ mode }),
  });
}

/**
 * Connect to the SSE AI Brain Stream at /api/autonomous/stream.
 * Returns a cleanup function — call it to close the EventSource.
 *
 * @param onEvent  Called for every incoming AIBrainEvent
 * @param onError  Called on connection errors
 */
export function connectAutonomousStream(
  onEvent: (event: AIBrainEvent) => void,
  onError?: (err: Event) => void,
): () => void {
  const es = new EventSource(`${BASE}/api/autonomous/stream`, { withCredentials: true });
  es.onmessage = (e) => {
    try { onEvent(JSON.parse(e.data) as AIBrainEvent); } catch { /* ignore parse errors */ }
  };
  if (onError) es.onerror = onError;
  return () => es.close();
}

// ─── System Audit — Self-Healing Engine ────────────────────────────────────

export type ResolveStrategy = 'wire_ui' | 'classify_admin' | 'mark_internal' | 'generate_ui';

export interface AuditEndpoint {
  method:      'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  path:        string;
  label:       string;
  module:      string;
  uiExposure:  'VISIBLE_UI' | 'ADMIN_UI' | 'HIDDEN_INTERNAL';
  uiType:      'action' | 'panel' | 'page' | 'toggle' | 'metric' | 'stream' | 'none';
  clientFn?:   string;
  uiLocation?: string;
  connected:   boolean;
  notes?:      string;
}

export interface AuditReport {
  orphanEndpoints:   AuditEndpoint[];
  missingUIBindings: AuditEndpoint[];
  duplicateRoutes:   string[];
  classificationSuggestions: {
    visible_ui: AuditEndpoint[];
    admin_ui:   AuditEndpoint[];
    internal:   AuditEndpoint[];
  };
  stats: {
    total:     number;
    connected: number;
    orphans:   number;
    adminOnly: number;
    internal:  number;
  };
  generatedTools: GeneratedToolConfig[];
}

export interface ResolveResult {
  success:          boolean;
  strategy:         ResolveStrategy;
  endpointPath:     string;
  method:           string;
  action:           string;
  uiLocation?:      string;
  previewUrl?:      string;
  alreadyResolved?: boolean;
}

export interface GeneratedToolConfig {
  name:         string;
  endpointPath: string;
  method:       string;
  label:        string;
  module:       string;
  uiType:       string;
  createdAt:    string;
}

export function runSystemAudit(): Promise<AuditReport> {
  return req<AuditReport>('/api/system-audit/run');
}

export function resolveEndpoint(endpointPath: string, method: string, strategy: ResolveStrategy): Promise<ResolveResult> {
  return req<ResolveResult>('/api/system-audit/resolve', { method: 'POST', body: JSON.stringify({ endpointPath, method, strategy }) });
}

export function resolveAllOrphans(): Promise<{ results: ResolveResult[]; summary: { resolved: number; skipped: number; failed: number } }> {
  return req<{ results: ResolveResult[]; summary: { resolved: number; skipped: number; failed: number } }>('/api/system-audit/resolve-all', { method: 'POST', body: JSON.stringify({}) });
}

export function getGeneratedTools(): Promise<{ tools: GeneratedToolConfig[] }> {
  return req<{ tools: GeneratedToolConfig[] }>('/api/system-audit/generated');
}

export function getGeneratedTool(name: string): Promise<GeneratedToolConfig> {
  return req<GeneratedToolConfig>(`/api/system-audit/generated/${name}`);
}

// ─── Financial OS ────────────────────────────────────────────────────────────

export type AutonomyLevelOS = 0 | 1 | 2 | 3;

export interface AutonomyInfo {
  level: AutonomyLevelOS;
  mode:  'ANALYST_ONLY' | 'ADVISOR_MODE' | 'HYBRID_APPROVAL' | 'AUTONOMOUS';
  label: string;
  desc:  string;
}

export interface CostSummary {
  totalToday:       number;
  totalThisMonth:   number;
  totalAllTime:     number;
  byCampaign:       Record<string, number>;
  byOperationType:  Record<string, number>;
  avgCostPerCampaign: number;
  costTrend:        Array<{ date: string; cost: number }>;
  recentEvents:     Array<{ id: string; campaignId: string; operationType: string; cost: number; timestamp: string }>;
}

export interface ProfitZonesResult {
  zones: {
    SCALE: ProfitProfile[];
    FIX:   ProfitProfile[];
    KILL:  ProfitProfile[];
  };
  summary: { totalWaste: number; scalePotential: number; totalCampaigns: number };
  executionGate: { level: number; message: string; requiresApproval: boolean };
}

export interface ProfitProfile {
  campaignId:       string;
  zone:             'SCALE' | 'FIX' | 'KILL';
  roas:             number;
  roi:              number;
  performanceScore: number;
  efficiencyScore:  number;
  spend:            number;
  revenue:          number;
  recommendation:   string;
  confidence:       number;
  riskScore:        number;
}

export interface CfoForecast {
  forecastPeriodDays: number;
  predictedRevenue:   number;
  predictedSpend:     number;
  predictedProfit:    number;
  predictedROI:       number;
  confidence:         number;
  trend:              'GROWING' | 'STABLE' | 'DECLINING';
  dailyForecast:      Array<{ date: string; revenue: number; spend: number; profit: number }>;
  riskFactors:        string[];
  opportunities:      string[];
}

export interface CfoInsight {
  id:          string;
  category:    'ROI' | 'COST' | 'SCALING' | 'RISK' | 'OPPORTUNITY';
  title:       string;
  body:        string;
  impact:      'HIGH' | 'MEDIUM' | 'LOW';
  confidence:  number;
  dataPoints:  number;
  generatedAt: string;
}

export interface BudgetStatus {
  currentAllocations: BudgetAllocation[];
  pendingProposals:   RebalanceProposal[];
  lastRebalancedAt:   string | null;
  autonomyGate:       { level: number; message: string };
}

export interface BudgetAllocation {
  campaignId:     string;
  currentBudget:  number;
  proposedBudget: number;
  delta:          number;
  deltaPercent:   number;
  reason:         string;
  roas:           number;
}

export interface RebalanceProposal {
  id:          string;
  allocations: BudgetAllocation[];
  totalBudget: number;
  expectedROIImprovement: number;
  confidence:  number;
  riskScore:   number;
  status:      'PENDING' | 'APPROVED' | 'REJECTED' | 'APPLIED';
  createdAt:   string;
}

export interface RevenueForecast {
  campaignId:       string;
  forecastDays:     number;
  predictedRevenue: number;
  roiEstimate:      number;
  confidence:       number;
  bestCase:         number;
  worstCase:        number;
  breakEvenDays:    number | null;
  dailyProjection:  Array<{ day: number; date: string; revenue: number; cumulative: number }>;
  drivers:          string[];
}

export interface ProfitModel {
  version:         number;
  scaleThreshold:  number;
  killThreshold:   number;
  confidenceFloor: number;
  totalCycles:     number;
  lastUpdatedAt:   string;
  accuracy:        number;
  learnedPatterns: Array<{ type: string; label: string; description: string; strength: number; sampleCount: number }>;
}

export interface CeoPortfolio {
  totalSpend:     number;
  totalRevenue:   number;
  portfolioROAS:  number;
  activeCount:    number;
  championCount:  number;
  decliningCount: number;
  campaigns:      Array<{ campaignId: string; name?: string; roas: number; status: string; rank: number; capitalSuggestion: string }>;
  topOpportunity: string | null;
  biggestRisk:    string | null;
}

export interface CeoStrategy {
  quarterGoal:    string;
  budgetPriority: string;
  topAngle:       string | null;
  riskAlert:      string | null;
  scalingTarget:  string | null;
  decisions:      Array<{ id: string; title: string; rationale: string; impact: string; urgency: string; expectedROI: number }>;
}

// ── Client functions ──────────────────────────────────────────────────────────

export function getAutonomyLevel(): Promise<AutonomyInfo> {
  return req<AutonomyInfo>('/api/financial-os/autonomy');
}
export function setAutonomyLevel(level: AutonomyLevelOS): Promise<AutonomyInfo> {
  return req<AutonomyInfo>('/api/financial-os/autonomy', { method: 'POST', body: JSON.stringify({ level }) });
}

export function getCostSummary(): Promise<CostSummary> {
  return req<CostSummary>('/api/financial-os/cost/summary');
}
export function getCostEvents(limit?: number): Promise<{ events: CostSummary['recentEvents'] }> {
  return req(`/api/financial-os/cost/events${limit ? `?limit=${limit}` : ''}`);
}

export function getProfitZones(): Promise<ProfitZonesResult> {
  return req<ProfitZonesResult>('/api/financial-os/profit/zones');
}
export function executeProfitAction(campaignId: string, action: 'scale' | 'fix' | 'kill'): Promise<unknown> {
  return req('/api/financial-os/profit/action', { method: 'POST', body: JSON.stringify({ campaignId, action }) });
}
export function approveProfitAction(id: string): Promise<unknown> {
  return req(`/api/financial-os/profit/approve/${id}`, { method: 'POST', body: '{}' });
}
export function rejectProfitAction(id: string): Promise<unknown> {
  return req(`/api/financial-os/profit/reject/${id}`, { method: 'POST', body: '{}' });
}

export function getCfoForecast(days?: number): Promise<CfoForecast> {
  return req<CfoForecast>(`/api/financial-os/cfo/forecast${days ? `?days=${days}` : ''}`);
}
export function getCfoInsights(): Promise<CfoInsight[]> {
  return req<CfoInsight[]>('/api/financial-os/cfo/insights');
}

export function getBudgetStatus(): Promise<BudgetStatus> {
  return req<BudgetStatus>('/api/financial-os/budget/status');
}
export function triggerRebalance(): Promise<{ gate: unknown; proposal?: RebalanceProposal }> {
  return req('/api/financial-os/budget/rebalance', { method: 'POST', body: '{}' });
}
export function approveRebalanceProposal(id: string): Promise<unknown> {
  return req(`/api/financial-os/budget/approve/${id}`, { method: 'POST', body: '{}' });
}
export function rejectRebalanceProposal(id: string): Promise<unknown> {
  return req(`/api/financial-os/budget/reject/${id}`, { method: 'POST', body: '{}' });
}

export function getCampaignRevenueForecast(campaignId: string, days?: number): Promise<RevenueForecast> {
  return req<RevenueForecast>(`/api/financial-os/revenue/forecast/${campaignId}${days ? `?days=${days}` : ''}`);
}
export function getPortfolioRevenueForecast(days?: number): Promise<unknown> {
  return req(`/api/financial-os/revenue/portfolio${days ? `?days=${days}` : ''}`);
}

export function getProfitModel(): Promise<ProfitModel> {
  return req<ProfitModel>('/api/financial-os/learning/profit/model');
}
export function triggerProfitLearning(): Promise<unknown> {
  return req('/api/financial-os/learning/profit/update', { method: 'POST', body: '{}' });
}
export function getLearningInsights(): Promise<unknown[]> {
  return req<unknown[]>('/api/financial-os/learning/profit/insights');
}
export function getLearningHistory(): Promise<{ cycles: unknown[] }> {
  return req('/api/financial-os/learning/profit/history');
}

export function getCeoPortfolio(): Promise<CeoPortfolio> {
  return req<CeoPortfolio>('/api/financial-os/ceo/portfolio');
}
export function getCeoStrategy(): Promise<CeoStrategy> {
  return req<CeoStrategy>('/api/financial-os/ceo/strategy');
}
export function getCapitalAllocation(): Promise<unknown[]> {
  return req<unknown[]>('/api/financial-os/ceo/allocation');
}

// ─── Competitor Intelligence ───────────────────────────────────────────────

export type CIJobStatus =
  | 'pending' | 'scraping' | 'normalizing'
  | 'scoring' | 'clustering' | 'insights'
  | 'complete' | 'failed';

export interface CIJob {
  id:            string;
  input:         { competitorName: string; brandUrl: string; industry: string; keywords?: string[] };
  status:        CIJobStatus;
  progress:      number;
  sourcesFound:  number;
  adsDiscovered: number;
  startedAt:     string;
  completedAt?:  string;
  error?:        string;
  events:        string[];
}

export interface CIScores {
  engagementLikelihood: number;
  clarityScore:         number;
  emotionalIntensity:   number;
  noveltyScore:         number;
  repetitionFrequency:  number;
}

export interface CIAdItem {
  id:                    string;
  brand:                 string;
  hook:                  string;
  copy:                  string;
  cta:                   string;
  format:                string;
  emotionalTrigger:      string;
  landingPageStructure:  string;
  performanceSignal:     number;
  clusterId:             string;
  source:                string;
  scores:                CIScores;
}

export interface CICluster {
  id:       string;
  type:     'winning_hooks' | 'winning_formats' | 'saturated_patterns' | 'emerging_trends';
  label:    string;
  items:    string[];
  avgScore: number;
}

export interface CIInsights {
  whatIsWorking:             string[];
  whatIsOverused:            string[];
  whatIsMissing:             string[];
  competitorStrategySummary: string;
}

export interface CIResult {
  jobId:       string;
  ads:         CIAdItem[];
  clusters:    CICluster[];
  insights:    CIInsights;
  sources:     string[];
  completedAt: string;
}

export interface CIExportedIntel {
  hooks:           string[];
  ctas:            string[];
  emotionalAngles: string[];
  formats:         string[];
  strategySummary: string;
  source:          'competitor_intelligence';
  exportedAt:      string;
}

export interface CIAutonomyMeta {
  current: number;
  meta: { level: number; label: string; desc: string }[];
}

export interface CIMonitoringState {
  enabled:      boolean;
  intervalMs:   number;
  jobIds:       string[];
  lastCheckAt?: string;
  checksRun:    number;
}

// ─── Competitor Intelligence ───────────────────────────────────────────────

export const getCIAutonomy = () =>
  req<CIAutonomyMeta>('/api/competitor/autonomy');

export const setCIAutonomy = (level: 0|1|2|3) =>
  req<CIAutonomyMeta>('/api/competitor/autonomy', {
    method: 'POST', body: JSON.stringify({ level }),
  });

export const startCompetitorAnalysis = (input: {
  competitorName: string; brandUrl: string; industry: string; keywords?: string[];
}) =>
  req<CIJob>('/api/competitor/analyze', {
    method: 'POST', body: JSON.stringify(input),
  });

export const listCompetitorJobs = () =>
  req<{ jobs: CIJob[] }>('/api/competitor/jobs');

export const getCompetitorResult = (jobId: string) =>
  req<{ job: CIJob; result: CIResult | null }>(`/api/competitor/results/${jobId}`);

export const getCompetitorInsights = (jobId: string) =>
  req<{ job: CIJob; insights: CIInsights | null; clusters: CICluster[] }>(`/api/competitor/insights/${jobId}`);

export const exportIntelToBuilder = (jobId: string, clusterIds: string[]) =>
  req<CIExportedIntel | { error: string }>('/api/competitor/export-to-builder', {
    method: 'POST', body: JSON.stringify({ jobId, clusterIds }),
  });

export const getCompetitorExports = () =>
  req<{ exports: CIExportedIntel[] }>('/api/competitor/exports');

export const enableCIMonitoring = (intervalMs?: number) =>
  req<{ enabled: boolean; message: string }>('/api/competitor/monitoring/enable', {
    method: 'POST', body: JSON.stringify({ intervalMs }),
  });

export const disableCIMonitoring = () =>
  req<{ enabled: boolean; message: string }>('/api/competitor/monitoring/disable', {
    method: 'POST', body: JSON.stringify({}),
  });

export const getCIMonitoringStatus = () =>
  req<CIMonitoringState>('/api/competitor/monitoring/status');

// ─── Trend Prediction ─────────────────────────────────────────────────────

export type TrendStage = 'early' | 'emerging' | 'rising' | 'peak' | 'saturating';

export interface PredictedTrend {
  id:                  string;
  trendName:           string;
  hookPattern:         string;
  creativeFormat:      string;
  emotionalDriver:     string;
  predictedPeakTime:   string;
  viralityScore:       number;
  confidence:          number;
  currentStage:        TrendStage;
  supportingExamples:  string[];
  riskOfSaturation:    number;
  detectedAt:          string;
  updatedAt:           string;
  competitors:         number;
}

export interface TrendSummary {
  total:        number;
  earlySignals: number;
  emerging:     number;
  rising:       number;
  saturating:   number;
  topTrend:     PredictedTrend | null;
  lastUpdated:  string;
}

export interface TrendHistoryEntry {
  trend:     PredictedTrend;
  snapshots: { timestamp: string; viralityScore: number; stage: TrendStage }[];
}

// ─── Ad Intelligence ──────────────────────────────────────────────────────

export type AdPlatform = 'meta' | 'tiktok' | 'google' | 'youtube' | 'web';

export interface NormalizedAd {
  id:                   string;
  platform:             AdPlatform;
  brand:                string;
  hook:                 string;
  creativeFormat:       string;
  emotionalTrigger:     string;
  cta:                  string;
  engagementSignal:     number;
  estimatedPerformance: number;
  landingPagePattern:   string;
  sourceUrl:            string;
  scrapedAt:            string;
  source:               'multi_platform_intelligence';
}

export interface PlatformAnalysis {
  platform:        AdPlatform;
  totalAds:        number;
  avgPerformance:  number;
  topEmotions:     { emotion: string; count: number }[];
  topFormats:      { format: string; count: number }[];
  topHooks:        string[];
  saturationIndex: number;
}

export interface CrossPlatformMatch {
  hookPattern:      string;
  emotionalTrigger: string;
  platforms:        AdPlatform[];
  occurrences:      number;
  migrationChain:   string;
  universalScore:   number;
  firstPlatform:    AdPlatform;
}

export interface UnifiedAdInsight {
  topUniversalHooks:      string[];
  crossPlatformPatterns:  CrossPlatformMatch[];
  platformLeaders:        { platform: AdPlatform; bestHook: string; avgScore: number }[];
  globalPerformanceScore: number;
  recommendedPlatforms:   { platform: AdPlatform; reason: string }[];
}

// ─── Trend API functions ──────────────────────────────────────────────────

export const runTrendPrediction = () =>
  req<{ trends: PredictedTrend[]; summary: TrendSummary }>('/api/trends/predict', {
    method: 'POST', body: JSON.stringify({}),
  });

export const getPredictedTrends = (stage?: TrendStage) =>
  req<{ trends: PredictedTrend[]; summary: TrendSummary }>(
    stage ? `/api/trends/predict?stage=${stage}` : '/api/trends/predict'
  );

export const getTrendSummary = () =>
  req<TrendSummary>('/api/trends/summary');

export const getTrendHistory = () =>
  req<{ history: TrendHistoryEntry[] }>('/api/trends/history');

// ─── Ad Intelligence API functions ───────────────────────────────────────

export const aggregateAdIntel = (urls?: string[]) =>
  req<{ id: string; status: string; adsFound: number }>('/api/ads/aggregate', {
    method: 'POST', body: JSON.stringify({ urls: urls ?? [] }),
  });

export const getAdPlatformAnalysis = () =>
  req<{ platforms: PlatformAnalysis[] }>('/api/ads/platform-analysis');

export const getUnifiedAdInsights = () =>
  req<UnifiedAdInsight>('/api/ads/unified-insights');

export const getAllNormalizedAds = () =>
  req<{ ads: NormalizedAd[] }>('/api/ads/all');

export const generateMultiPlatformAd = (hook: string, emotionalTrigger: string, brand: string) =>
  req<{ variants: Record<AdPlatform, string>; source: string }>('/api/ads/generate-multi-platform', {
    method: 'POST', body: JSON.stringify({ hook, emotionalTrigger, brand }),
  });

// ─── Profit Intelligence (Unit Economics) ────────────────────────────────────

export interface FeatureProfitEntry {
  feature:               string;
  label:                 string;
  icon:                  string;
  cost:                  number;
  revenueAttributed:     number;
  profit:                number;
  roi:                   number;
  profitMargin:          number;
  usageCount:            number;
  attributionConfidence: number;
  status:                'profitable' | 'break-even' | 'loss';
}

export interface ProfitIntelSummary {
  totalRevenueAttributed: number;
  totalCost:              number;
  totalProfit:            number;
  profitMargin:           number;
  roi:                    number;
  attributionNote:        string;
}

export interface UnitEconomicsEntry {
  feature:           string;
  label:             string;
  icon:              string;
  avgCostPerUse:     number;
  avgRevenuePerUse:  number;
  profitPerUse:      number;
  usageCount:        number;
}

export interface ProfitTrendPoint {
  date:         string;
  totalCost:    number;
  totalRevenue: number;
  profit:       number;
}

export const getFeatureProfits    = () => req<FeatureProfitEntry[]>('/api/financial-os/intelligence/features');
export const getProfitIntelSummary = () => req<ProfitIntelSummary>('/api/financial-os/intelligence/summary');
export const getUnitEconomics     = () => req<UnitEconomicsEntry[]>('/api/financial-os/intelligence/unit-economics');
export const getProfitTrends      = (range: '7d' | '30d' = '7d') =>
  req<ProfitTrendPoint[]>(`/api/financial-os/intelligence/trends?range=${range}`);


// ─── Creative content fetcher ─────────────────────────────────────────────────

export interface CreativeContent {
  id:               string;
  format:           string;
  angleSlug:        string;
  isWinner:         boolean;
  score?:           number;
  // video
  stitchedVideoUrl?: string;
  sceneVideoUrls?:   string[];
  // carousel
  slides?:          Array<{ slide_number: number; type: string; hook: string; headline: string; body: string; cta: string; imageUrl?: string }>;
  // banner
  banners?:         Array<{ size: string; headline: string; subtext: string; cta: string; visual_direction: string; imageUrl?: string }>;
}

export const getCreativeById = (id: string) =>
  req<CreativeContent>(`/api/creatives/${encodeURIComponent(id)}`);
