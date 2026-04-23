// ─── UserContext — Single Source of Truth for Engine ─────────────────────────
// Every engine call (concept generation, angle selection, orchestrator)
// MUST receive a fully-populated UserContext. Missing fields = blocked.

// ── Types ─────────────────────────────────────────────────────────────────────

export type GoalType      = 'lead_generation' | 'sales' | 'branding' | 'growth';
export type OfferType     = 'product' | 'service' | 'saas';
export type PlatformType  = 'TikTok' | 'Meta' | 'YouTube' | 'Google Ads';
export type ContentStyle  = 'viral' | 'educational' | 'direct_response' | 'storytelling';
export type RiskLevel     = 'safe' | 'balanced' | 'aggressive';

export interface UserContext {
  goalType:     GoalType;
  industry:     string;
  offerType:    OfferType;
  platform:     PlatformType;
  contentStyle: ContentStyle;
  riskLevel:    RiskLevel;
}

export interface UserSessionState {
  userId:        string;
  userContext:   UserContext;
  executionState: 'idle' | 'running' | 'completed' | 'failed';
  lastDecisionId?: string;
  uiState: {
    currentPage:    string;
    lastCampaignId?: string;
    lastConceptId?:  string;
  };
}

// Partial draft saved after each onboarding step
export type OnboardingDraft = Partial<UserContext>;

// ── Engine Parameter Derivation ───────────────────────────────────────────────
// Maps UserContext → backend-compatible field names

export interface EngineParams {
  goal:            string;   // 'conversions' | 'awareness' | 'engagement'
  industry:        string;   // passed through as-is
  platform:        string;   // lowercase engine format
  emotion:         string;   // derived from contentStyle
  format:          string;   // 'video' | 'banner' etc.
  explorationMode: RiskLevel;
  durationTier:    string;   // default based on platform
}

export function deriveEngineParams(ctx: UserContext): EngineParams {
  return {
    goal:            goalTypeToGoal(ctx.goalType),
    industry:        ctx.industry,
    platform:        platformToKey(ctx.platform),
    emotion:         styleToEmotion(ctx.contentStyle),
    format:          platformToFormat(ctx.platform),
    explorationMode: ctx.riskLevel,
    durationTier:    platformToDuration(ctx.platform),
  };
}

function goalTypeToGoal(g: GoalType): string {
  const map: Record<GoalType, string> = {
    lead_generation: 'conversions',
    sales:           'conversions',
    branding:        'awareness',
    growth:          'engagement',
  };
  return map[g];
}

function platformToKey(p: PlatformType): string {
  const map: Record<PlatformType, string> = {
    TikTok:      'tiktok',
    Meta:        'instagram',
    YouTube:     'youtube',
    'Google Ads':'google',
  };
  return map[p];
}

function styleToEmotion(s: ContentStyle): string {
  const map: Record<ContentStyle, string> = {
    viral:           'excitement',
    educational:     'trust',
    direct_response: 'urgency',
    storytelling:    'empathy',
  };
  return map[s];
}

function platformToFormat(p: PlatformType): string {
  const map: Record<PlatformType, string> = {
    TikTok:      'video',
    Meta:        'video',
    YouTube:     'video',
    'Google Ads':'banner',
  };
  return map[p];
}

function platformToDuration(p: PlatformType): string {
  const map: Record<PlatformType, string> = {
    TikTok:      '45s',
    Meta:        '60s',
    YouTube:     '75s',
    'Google Ads':'30s',
  };
  return map[p];
}

// ── Guard ─────────────────────────────────────────────────────────────────────

const REQUIRED_FIELDS: (keyof UserContext)[] = [
  'goalType', 'industry', 'offerType', 'platform', 'contentStyle', 'riskLevel',
];

export function isUserContextComplete(ctx: Partial<UserContext> | null | undefined): ctx is UserContext {
  if (!ctx) return false;
  return REQUIRED_FIELDS.every(k => !!ctx[k]);
}

/** Throws ENGINE_BLOCKED if context is incomplete. Call before every engine request. */
export function requireUserContext(ctx: Partial<UserContext> | null | undefined): asserts ctx is UserContext {
  if (!ctx) {
    throw new Error('ENGINE_BLOCKED: UserContext is missing. Complete onboarding first.');
  }
  const missing = REQUIRED_FIELDS.filter(k => !ctx[k]);
  if (missing.length > 0) {
    throw new Error(
      `ENGINE_BLOCKED: Incomplete UserContext — missing [${missing.join(', ')}]. Complete onboarding.`
    );
  }
}

// ── Storage ───────────────────────────────────────────────────────────────────

const DRAFT_KEY   = 'cos_onboarding_draft';
const SESSION_KEY = 'cos_session_state';

/** Read UserContext from the logged-in user's localStorage record. */
export function getUserContext(): UserContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('cos_auth_user');
    if (!raw) return null;
    const user = JSON.parse(raw);
    const ctx: Partial<UserContext> = {
      goalType:     user.goalType,
      industry:     user.industry,
      offerType:    user.offerType,
      platform:     user.platform,
      contentStyle: user.contentStyle,
      riskLevel:    user.riskLevel,
    };
    return isUserContextComplete(ctx) ? ctx : null;
  } catch { return null; }
}

/** Save partial onboarding draft (called after each step). */
export function saveOnboardingDraft(draft: OnboardingDraft) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

/** Load partial onboarding draft for resume support. */
export function loadOnboardingDraft(): OnboardingDraft {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

export function clearOnboardingDraft() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(DRAFT_KEY);
}

/** UserSessionState — shared across engine + UI. */
export function getUserSessionState(): UserSessionState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function setUserSessionState(patch: Partial<UserSessionState>) {
  if (typeof window === 'undefined') return;
  const current = getUserSessionState() ?? {} as UserSessionState;
  localStorage.setItem(SESSION_KEY, JSON.stringify({ ...current, ...patch }));
}

export function initSessionState(userId: string, ctx: UserContext): UserSessionState {
  const state: UserSessionState = {
    userId,
    userContext: ctx,
    executionState: 'idle',
    uiState: { currentPage: '/dashboard' },
  };
  setUserSessionState(state);
  return state;
}
