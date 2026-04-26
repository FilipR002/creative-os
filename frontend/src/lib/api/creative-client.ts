// ─── Creative Studio API Client ───────────────────────────────────────────────
// Fetches creative content (video URLs, slides, banners) and UGC job status.

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';
const BASE = API_URL && !API_URL.includes('localhost') ? API_URL : '';

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { getSupabase } = await import('../supabase');
  const { data: { session } } = await getSupabase().auth.getSession();
  if (session?.access_token) {
    return { 'Authorization': `Bearer ${session.access_token}` };
  }
  return {};
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type CreativeFormat = 'video' | 'carousel' | 'banner';

// Re-export Platform so page components don't need two separate imports
export type { Platform } from '@/components/studio/PlatformSelector';

export type JobStatus = 'queued' | 'processing' | 'done' | 'failed';

export interface CarouselSlide {
  index:    number;
  headline: string;
  subtext?: string;
  cta?:     string;
  imageUrl?: string;
}

export interface BannerVariant {
  size:     string;   // e.g. '1080x1080'
  imageUrl: string;
  headline: string;
}

export interface CreativeContent {
  id:      string;
  format:  CreativeFormat;
  angleSlug: string;
  score?:  number;
  isWinner: boolean;

  // Video
  videoUrl?:        string;
  stitchedVideoUrl?: string;
  sceneCount?:      number;
  duration?:        number;

  // Carousel
  slides?: CarouselSlide[];

  // Banner
  banners?: BannerVariant[];

  // Copy — platform-ready
  copy: {
    headline: string;
    caption:  string;
    cta:      string;
    hashtags: string;
  };

  // Engine metadata
  engine?:        string;
  executionMode?: string;
}

export interface UGCJobState {
  jobId:    string;
  status:   JobStatus;
  progress: number;   // 0–100
  videoUrl?: string;
  error?:    string;
}

// ─── Fetch creative content by ID ─────────────────────────────────────────────

export async function fetchCreativeContent(
  creativeId: string,
): Promise<CreativeContent | null> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${BASE}/api/creatives/${creativeId}`, { headers });
    if (!res.ok) return null;
    return res.json() as Promise<CreativeContent>;
  } catch {
    return null;
  }
}

// ─── Fetch UGC job status ─────────────────────────────────────────────────────

export async function fetchUGCJobStatus(
  jobId: string,
): Promise<UGCJobState | null> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${BASE}/api/ugc/jobs/${jobId}`, { headers });
    if (!res.ok) return null;
    return res.json() as Promise<UGCJobState>;
  } catch {
    return null;
  }
}

// ─── Poll UGC job until done ──────────────────────────────────────────────────

export async function pollUGCJob(
  jobId:      string,
  onUpdate:   (state: UGCJobState) => void,
  intervalMs: number = 3_000,
  timeoutMs:  number = 300_000,
): Promise<UGCJobState | null> {
  const deadline = Date.now() + timeoutMs;

  return new Promise(resolve => {
    async function tick() {
      if (Date.now() > deadline) { resolve(null); return; }

      const state = await fetchUGCJobStatus(jobId);
      if (!state) { resolve(null); return; }

      onUpdate(state);

      if (state.status === 'done' || state.status === 'failed') {
        resolve(state);
      } else {
        setTimeout(tick, intervalMs);
      }
    }
    tick();
  });
}

// ─── Build synthetic copy from RunResult metadata ────────────────────────────
// Used when backend doesn't return copy — derives it from angle + brief.

export function buildSyntheticCopy(params: {
  brief:     string;
  angleSlug: string;
  format:    CreativeFormat;
  platform?: string;
}): CreativeContent['copy'] {
  const angle = params.angleSlug.replace(/_/g, ' ');
  return {
    headline: params.brief.slice(0, 80),
    caption:  `${params.brief} — ${angle}`,
    cta:      'Learn More',
    hashtags: `#${params.format} #creative #ad`,
  };
}
