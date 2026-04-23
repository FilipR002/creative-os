// ─── Product Run API Client ───────────────────────────────────────────────────

// In production (Vercel), NEXT_PUBLIC_API_URL = Railway URL → call directly.
// In development, rewrites proxy relative /api/* calls to localhost:4000.
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';
const BASE = API_URL && !API_URL.includes('localhost') ? API_URL : '';

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { getSupabase } = await import('../supabase');
  const { data: { session } } = await getSupabase().auth.getSession();
  if (session?.access_token) {
    return { 'Authorization': `Bearer ${session.access_token}` };
  }
  // No session — return empty; backend will reject with 401
  return {};
}

export type RunFormat = 'video' | 'carousel' | 'banner';
export type RunGoal   = 'conversion' | 'awareness' | 'engagement';

export interface RunRequest {
  brief:      string;
  format:     RunFormat;
  campaignId?: string;
  goal?:      RunGoal;
  clientId?:  string;
  industry?:  string;
  platform?:  string;
  // format-specific
  durationTier?: string;
  slideCount?:   number;
  sizes?:        string[];
  // Phase 3: personalization
  styleContext?: string;
  // Unified creation system
  mode?:   'quick' | 'campaign';
  assets?: string[];
}

export interface RunAngle {
  slug:   string;
  role:   'exploit' | 'explore' | 'secondary';
  reason: string;
}

export interface RunCreative {
  creativeId: string;
  angleSlug:  string;
  format:     string;
}

export interface RunScore {
  creativeId:  string;
  angleSlug:   string;
  totalScore:  number;
  ctrScore:    number;
  engagement:  number;
  conversion:  number;
  isWinner:    boolean;
}

export interface RunResult {
  executionId:          string;
  campaignId:           string;
  concept:              { id: string; brief: string; goal: string };
  angles:               RunAngle[];
  creatives:            RunCreative[];
  scoring:              RunScore[];
  winner:               RunScore | null;
  learningUpdateStatus: string;
  evolutionTriggered:   boolean;
  explanation:          string;
}

let _ensuredId = '';
async function ensureUser(): Promise<void> {
  const { getSupabase } = await import('../supabase');
  const { data: { session } } = await getSupabase().auth.getSession();
  const userId = session?.user?.id ?? '';
  if (!userId || _ensuredId === userId) return;
  try {
    await fetch(`${BASE}/api/users`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body:    JSON.stringify({ id: userId }),
    });
  } catch { return; }
  _ensuredId = userId;
}

export async function runCampaign(body: RunRequest): Promise<RunResult> {
  await ensureUser();
  const headers = await getAuthHeaders();
  const res = await fetch(`${BASE}/api/run`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body:    JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => 'Unknown error');
    throw new Error(`Generation failed: ${text}`);
  }
  return res.json() as Promise<RunResult>;
}

// ── Memory — derives personalized insights ────────────────────────────────────

export interface MemorySnapshot {
  bestAngles?:  { angle: string; winRate: number; avgScore: number }[];
  formatStats?: { format: string; avgCtr: number }[];
  [key: string]: unknown;
}

export async function fetchMemory(clientId = 'default'): Promise<MemorySnapshot | null> {
  try {
    const res = await fetch(
      `${BASE}/product/memory?client_id=${encodeURIComponent(clientId)}`,
    );
    if (!res.ok) return null;
    return res.json() as Promise<MemorySnapshot>;
  } catch {
    return null;
  }
}

// ── Storage helpers (session + history) ──────────────────────────────────────

const HISTORY_KEY = 'cos_run_history';

export interface HistoryEntry {
  executionId: string;
  brief:       string;
  format:      RunFormat;
  goal:        string;
  score:       number | null;
  createdAt:   string;
}

export function saveRunResult(result: RunResult, brief: string, format: RunFormat): void {
  if (typeof window === 'undefined') return;

  // Full result in sessionStorage (for result page)
  sessionStorage.setItem(`cos_run_${result.executionId}`, JSON.stringify(result));

  // Summary in localStorage history
  const entry: HistoryEntry = {
    executionId: result.executionId,
    brief,
    format,
    goal:      result.concept.goal,
    score:     result.winner?.totalScore ?? null,
    createdAt: new Date().toISOString(),
  };

  const raw     = localStorage.getItem(HISTORY_KEY);
  const history: HistoryEntry[] = raw ? JSON.parse(raw) : [];
  history.unshift(entry);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 50)));
}

export function loadRunResult(executionId: string): RunResult | null {
  if (typeof window === 'undefined') return null;
  const raw = sessionStorage.getItem(`cos_run_${executionId}`);
  if (!raw) return null;
  try { return JSON.parse(raw) as RunResult; } catch { return null; }
}

export function saveGenerationId(executionId: string, generationId: string): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(`cos_gen_${executionId}`, generationId);
}

export function loadGenerationId(executionId: string): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(`cos_gen_${executionId}`);
}

export function loadHistory(): HistoryEntry[] {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(HISTORY_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw) as HistoryEntry[]; } catch { return []; }
}

export async function refineBlock(params: {
  blockType:    string;
  currentValue: string;
  instruction:  string;
  brief?:       string;
  angleSlug?:   string;
}): Promise<string> {
  const res = await fetch(`${BASE}/api/creative-ai/refine-block`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(params),
  });
  if (!res.ok) throw new Error('Refine request failed');
  const data = await res.json();
  return data.value ?? params.currentValue;
}
