'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams }            from 'next/navigation';
import { Sidebar }                               from '@/components/Sidebar';
import { PreviewStage }                          from '@/components/PreviewStage';
import { TemplateGallery, type GalleryFormat }  from '@/components/TemplateGallery';
import type { PreviewStatus, PreviewFormat, PreviewResult } from '@/components/PreviewStage';
import {
  runCampaign,
  saveRunResult,
  getJobStatus,
  isQueued,
  type RunFormat,
  type RunGoal,
  type RunResult,
} from '@/lib/api/run-client';
import {
  getMe,
  getCreativeById,
  getElevenLabsVoices,
  getTemplateCatalog,
  type CreativeContent,
  type ElevenLabsVoice,
  type TemplateMetadata,
} from '@/lib/api/creator-client';
import type { SlideData, BannerData } from '@/components/PreviewStage';
import { getResource, type Persona } from '@/lib/api/resources-client';

// ─── Types ────────────────────────────────────────────────────────────────────

type Mode         = 'quick' | 'campaign';
type AdFormat     = 'video' | 'carousel' | 'image';
type AdPlatform   = 'meta' | 'tiktok' | 'google';
type DurationTier = 'SHORT' | 'MEDIUM' | 'LONG' | 'EXTENDED';

const DURATION_LABELS: Record<DurationTier, string> = {
  SHORT: '15s', MEDIUM: '30s', LONG: '60s', EXTENDED: '90s',
};

const GOAL_LABELS: Record<RunGoal, string> = {
  conversion: 'Sales',
  sales:      'Sales',
  awareness:  'Awareness',
  engagement: 'Engagement',
  retention:  'Retention',
  install:    'Install',
};

const GOALS: { value: RunGoal; label: string }[] = [
  { value: 'sales',      label: '🎯 Sales'      },
  { value: 'awareness',  label: '📡 Awareness'  },
  { value: 'engagement', label: '💬 Engagement' },
  { value: 'retention',  label: '🔄 Retention'  },
  { value: 'install',    label: '📲 Install'    },
];

const ANGLES = [
  { value: '',               label: '— Auto (AI picks) —' },
  { value: 'urgency',        label: '⚡ Urgency'          },
  { value: 'emotional',      label: '❤️ Emotional'        },
  { value: 'premium',        label: '💎 Premium'          },
  { value: 'price-focused',  label: '💰 Price-focused'    },
  { value: 'storytelling',   label: '📖 Storytelling'     },
  { value: 'pain-point',     label: '🎯 Pain Point'       },
  { value: 'social-proof',   label: '⭐ Social Proof'     },
  { value: 'educational',    label: '🧠 Educational'      },
];

const dropdownStyle: React.CSSProperties = {
  width: '100%', background: 'var(--surface-2)', border: '1px solid var(--border)',
  borderRadius: 8, padding: '9px 12px', color: 'var(--text)',
  fontSize: 13, outline: 'none', cursor: 'pointer', fontFamily: 'inherit',
  appearance: 'none' as const,
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M2 4l4 4 4-4' stroke='%23555' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 10px center',
  paddingRight: 32,
};

/** Map UI AdFormat → API RunFormat */
function apiFormat(f: AdFormat): RunFormat {
  return f === 'image' ? 'banner' : f;
}

// ─── Inner component (needs useSearchParams) ──────────────────────────────────

function CreatePageInner() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  // ── Mode ──────────────────────────────────────────────────────────────────
  const [mode, setMode] = useState<Mode>(() =>
    searchParams.get('mode') === 'campaign' ? 'campaign' : 'quick',
  );

  // ── Admin gate ────────────────────────────────────────────────────────────
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  useEffect(() => {
    getMe().then(me => setIsAdmin(me.role === 'admin')).catch(() => setIsAdmin(false));
  }, []);

  // ── Persona selection ─────────────────────────────────────────────────────
  const [personas,          setPersonas]          = useState<Persona[]>([]);
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>('');
  useEffect(() => {
    getResource().then(r => setPersonas(r.personas ?? [])).catch(() => {});
  }, []);

  // ── Gallery step — 'gallery' = template picker, 'brief' = form ──────────
  const [step, setStep] = useState<'gallery' | 'brief'>('gallery');

  // ── Quick-mode controls ───────────────────────────────────────────────────
  const [format,       setFormat]       = useState<AdFormat>('carousel');
  const [platform,     setPlatform]     = useState<AdPlatform>('meta');
  const [goal,         setGoal]         = useState<RunGoal>('sales');
  const [angle,        setAngle]        = useState('');
  const [durationTier, setDurationTier] = useState<DurationTier>('MEDIUM');
  const [slideCount,   setSlideCount]   = useState(5);
  const [brief,        setBrief]        = useState('');
  const [videoMode,    setVideoMode]    = useState<'ugc' | 'classic'>('ugc');

  // ── Phase 5: Voiceover ────────────────────────────────────────────────────
  const [voiceoverEnabled, setVoiceoverEnabled] = useState(false);
  const [voiceId,          setVoiceId]          = useState('');
  const [voices,           setVoices]           = useState<ElevenLabsVoice[]>([]);

  // Fetch voice list once when user enables voiceover or switches to video
  useEffect(() => {
    if (format !== 'video' || voices.length > 0) return;
    getElevenLabsVoices().then(setVoices).catch(() => {});
  }, [format, voices.length]);

  // ── Brand color ───────────────────────────────────────────────────────────
  const [primaryColor, setPrimaryColor] = useState('');

  // ── Phase 6: Template picker ──────────────────────────────────────────────
  const [templateId,       setTemplateId]       = useState('');
  const [templates,        setTemplates]         = useState<TemplateMetadata[]>([]);

  // ── Photo Reveal ──────────────────────────────────────────────────────────
  const [prHook,        setPrHook]        = useState('');           // slide 1 headline
  const [prItems,       setPrItems]       = useState<string[]>([]); // reveal labels
  const [prImages,      setPrImages]      = useState<Record<number, string>>({}); // index → dataUrl or unsplash url
  const [prAccent,      setPrAccent]      = useState('#f59e0b');    // yellow like @wealth
  const [prUnsplashQ,   setPrUnsplashQ]   = useState<Record<number, string>>({});
  const [prUnsplashLoading, setPrUnsplashLoading] = useState<Record<number, boolean>>({});
  const [mediaLibrary,  setMediaLibrary]  = useState<string[]>([]);
  const [prMediaOpen,   setPrMediaOpen]   = useState<number | null>(null); // which slide has picker open
  const [prBrief,       setPrBrief]       = useState('');           // AI generation brief
  const [prGenerating,  setPrGenerating]  = useState(false);        // AI generation loading

  // Load media library from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('cos_media_images');
      if (saved) setMediaLibrary(JSON.parse(saved));
    } catch { /* ignore */ }
  }, []);

  // Fetch template catalog immediately on mount (needed for gallery)
  useEffect(() => {
    if (templates.length > 0) return;
    getTemplateCatalog().then(r => setTemplates(r.templates)).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Preview state machine ─────────────────────────────────────────────────
  const [previewStatus,   setPreviewStatus]   = useState<PreviewStatus>('idle');
  const [previewProgress, setPreviewProgress] = useState(0);
  const [previewResult,   setPreviewResult]   = useState<PreviewResult | null>(null);
  const [previewError,    setPreviewError]    = useState<string | null>(null);
  const [lastRunResult,   setLastRunResult]   = useState<RunResult | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Persist / restore preview result across navigations ──────────────────
  // When the user navigates away and comes back, React state is gone.
  // We save to sessionStorage on every result update and restore on mount.
  const STORAGE_KEY     = 'cos_preview_result';
  const ACTIVE_JOB_KEY  = 'cos_active_job';

  // Restore completed result OR resume an active video job on mount.
  // Only restores when ?resume=1 is in the URL — a plain /create link always
  // starts at the gallery so the user isn't dropped into a stale session.
  useEffect(() => {
    const isResume = searchParams.get('resume') === '1';
    if (!isResume) return; // fresh navigation — stay at gallery

    try {
      // 1. Check for an in-progress video job first
      const activeJob = sessionStorage.getItem(ACTIVE_JOB_KEY);
      if (activeJob) {
        const { jobId, fmt, savedBrief } = JSON.parse(activeJob) as {
          jobId: string; fmt: AdFormat; savedBrief: string;
        };
        setStep('brief'); // skip gallery — resume in-flight job
        setPreviewStatus('processing');
        setPreviewProgress(5);
        if (savedBrief) setBrief(savedBrief);
        startVideoPolling(jobId, fmt, savedBrief);
        return; // don't also restore a stale result
      }

      // 2. Restore a completed/done result
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as { result: PreviewResult; status: PreviewStatus };
        setStep('brief'); // skip gallery — already have a result
        setPreviewResult(parsed.result);
        setPreviewStatus(parsed.status ?? 'done');
      }
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function persistPreviewResult(pr: PreviewResult | null, status: PreviewStatus) {
    try {
      if (pr) {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ result: pr, status }));
      } else {
        sessionStorage.removeItem(STORAGE_KEY);
      }
    } catch { /* ignore */ }
  }

  function saveActiveJob(jobId: string, fmt: AdFormat, savedBrief: string) {
    try {
      sessionStorage.setItem(ACTIVE_JOB_KEY, JSON.stringify({ jobId, fmt, savedBrief }));
      window.dispatchEvent(new CustomEvent('cos:generation:start'));
    } catch { /* ignore */ }
  }

  function clearActiveJob() {
    try {
      sessionStorage.removeItem(ACTIVE_JOB_KEY);
      window.dispatchEvent(new CustomEvent('cos:generation:end'));
    } catch { /* ignore */ }
  }

  // Reusable video polling — called both on first generate AND on remount resume
  function startVideoPolling(jobId: string, fmt: AdFormat, savedBrief: string) {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const job = await getJobStatus(jobId);
        setPreviewProgress(job.progress ?? 0);

        if (job.status === 'completed' && job.result) {
          stopPolling();
          clearActiveJob();
          saveRunResult(job.result, savedBrief, 'video');
          setLastRunResult(job.result);
          const pr = await fetchPreviewResult(job.result, fmt);
          setPreviewResult(pr);
          setPreviewStatus('done');
          persistPreviewResult(pr, 'done');
        } else if (job.status === 'failed') {
          stopPolling();
          clearActiveJob();
          setPreviewError(job.error ?? 'Video rendering failed. Check Railway logs.');
          setPreviewStatus('error');
        }
      } catch (pollErr) {
        stopPolling();
        clearActiveJob();
        setPreviewError(pollErr instanceof Error ? pollErr.message : 'Polling error');
        setPreviewStatus('error');
      }
    }, 3_000);
  }

  // Clean up polling on unmount (don't clear sessionStorage — job still running)
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  function stopPolling() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }

  // ── Campaign-mode state ───────────────────────────────────────────────────
  const [camBrief,      setCamBrief]      = useState('');
  const [camPlatform,   setCamPlatform]   = useState<AdPlatform>('meta');
  const [camGoal,       setCamGoal]       = useState<RunGoal>('sales');
  const [camAngle,      setCamAngle]      = useState('');
  const [camAssets,     setCamAssets]     = useState<AdFormat[]>(['carousel']);
  const [camDuration,   setCamDuration]   = useState<DurationTier>('MEDIUM');
  const [camSlides,     setCamSlides]     = useState(5);
  const [camLoading,    setCamLoading]    = useState(false);
  const [camStep,       setCamStep]       = useState('');
  const [camError,      setCamError]      = useState<string | null>(null);

  // ─────────────────────────────────────────────────────────────────────────
  // Quick-mode helpers
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Build a PreviewResult from a RunResult using GET /api/creatives/:id.
   * For carousel / image, imagesReady = false (images generating in background).
   * For video, imagesReady = true (stitchedVideoUrl is the final artefact).
   */
  async function fetchPreviewResult(result: RunResult, fmt: AdFormat): Promise<PreviewResult> {
    const { winner } = result;
    const base: PreviewResult = {
      angleSlug:   winner?.angleSlug,
      score:       winner?.totalScore,
      executionId: result.executionId,
      imagesReady: fmt === 'video' ? true : false,
      videoMode:   fmt === 'video' ? videoMode : undefined,
    };

    if (!winner?.creativeId) return base;

    const creative = await getCreativeById(winner.creativeId).catch(() => null);
    if (!creative) return base;

    if (fmt === 'video') {
      return {
        ...base,
        stitchedVideoUrl: creative.stitchedVideoUrl,
        sceneVideoUrls:   creative.sceneVideoUrls,
        srtContent:       creative.srtContent ?? undefined,
        imagesReady:      true,
      };
    }

    // carousel / image — text content ready, images generating in background
    return {
      ...base,
      slides:      (creative.slides  as SlideData[]  | undefined),
      banners:     (creative.banners as BannerData[] | undefined),
      imagesReady: false,
    };
  }

  /**
   * Returns true when all slides/banners have a valid imageUrl (> 50 chars).
   * That threshold matches the backend validation and rules out empty strings
   * or truncated placeholders.
   */
  function checkImagesReady(creative: CreativeContent, fmt: AdFormat): boolean {
    if (fmt === 'carousel') {
      const s = creative.slides;
      return Array.isArray(s) && s.length > 0 && s.every(x => x.imageUrl && x.imageUrl.length > 50);
    }
    if (fmt === 'image') {
      const b = creative.banners;
      return Array.isArray(b) && b.length > 0 && b.every(x => x.imageUrl && x.imageUrl.length > 50);
    }
    return true; // video — no images to check
  }

  /**
   * Polls GET /api/creatives/:id every 3 s until images are fully generated,
   * then merges the imageUrls into the existing PreviewResult (no status change —
   * the slides/banners are already visible with skeleton loaders).
   * Stops automatically after 90 s to avoid polling forever on Gemini quota errors.
   */
  function startImagePolling(creativeId: string, fmt: AdFormat) {
    stopPolling();
    let attempts = 0;
    const MAX_ATTEMPTS = 30; // 30 × 3 s = 90 s

    pollRef.current = setInterval(async () => {
      attempts++;
      if (attempts > MAX_ATTEMPTS) {
        stopPolling();
        // Timeout — mark ready so skeletons don't spin forever
        setPreviewResult(prev => {
          if (!prev) return prev;
          const updated = { ...prev, imagesReady: true };
          persistPreviewResult(updated, 'done');
          return updated;
        });
        return;
      }
      try {
        const creative = await getCreativeById(creativeId);
        if (checkImagesReady(creative, fmt)) {
          stopPolling();
          setPreviewResult(prev => {
            if (!prev) return prev;
            const updated = {
              ...prev,
              slides:      (creative.slides  as SlideData[]  | undefined) ?? prev.slides,
              banners:     (creative.banners as BannerData[] | undefined) ?? prev.banners,
              imagesReady: true,
            };
            persistPreviewResult(updated, 'done');
            return updated;
          });
        }
      } catch {
        // Transient error — keep polling
      }
    }, 3_000);
  }

  async function handleGenerate() {
    if (!brief.trim()) return;
    if (previewStatus === 'generating' || previewStatus === 'processing') return;

    stopPolling();
    clearActiveJob();
    setPreviewStatus('generating');
    setPreviewProgress(0);
    setPreviewResult(null);
    setPreviewError(null);
    persistPreviewResult(null, 'generating');

    try {
      const response = await runCampaign({
        mode:     'quick',
        brief:    brief.trim(),
        format:   apiFormat(format),
        platform,
        goal,
        ...(angle                            && { styleContext: angle }),
        ...(selectedPersonaId                && { personaId: selectedPersonaId }),
        ...(format === 'video'    && { durationTier, videoMode }),
        ...(format === 'video' && voiceoverEnabled && {
          voiceoverEnabled: true,
          ...(voiceId && { voiceId }),
        }),
        ...(format === 'carousel' && { slideCount }),
        ...(format === 'image'    && { sizes: ['1200x628', '1080x1080', '1080x1920'] }),
        ...((format === 'carousel' || format === 'image') && templateId && { templateId }),
        ...(primaryColor && { primaryColor }),
      });

      if (isQueued(response)) {
        // ── Async video path: poll job status ──────────────────────────────
        setPreviewStatus('processing');
        setPreviewProgress(5);
        const { jobId } = response;
        // Persist job so navigation away and back resumes polling
        saveActiveJob(jobId, format, brief.trim());
        startVideoPolling(jobId, format, brief.trim());

      } else {
        // ── Sync path (carousel / image) ─────────────────────────────────
        saveRunResult(response, brief.trim(), apiFormat(format));
        setLastRunResult(response);
        const pr = await fetchPreviewResult(response, format);
        setPreviewResult(pr);
        setPreviewStatus('done');
        persistPreviewResult(pr, 'done');

        // Images are rendering in background — start polling for them
        const winnerId = response.winner?.creativeId;
        if (winnerId && (format === 'carousel' || format === 'image')) {
          startImagePolling(winnerId, format);
        }
      }
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : 'Generation failed — check backend connection');
      setPreviewStatus('error');
    }
  }

  function handleDownload() {
    if (!previewResult) return;
    if (previewResult.stitchedVideoUrl) {
      window.open(previewResult.stitchedVideoUrl, '_blank');
    } else if (previewResult.executionId) {
      router.push(`/result/${previewResult.executionId}`);
    }
  }

  const generating = previewStatus === 'generating' || previewStatus === 'processing';

  // ─────────────────────────────────────────────────────────────────────────
  // Campaign-mode helpers
  // ─────────────────────────────────────────────────────────────────────────

  function toggleCamAsset(f: AdFormat) {
    setCamAssets(prev => prev.includes(f) ? prev.filter(a => a !== f) : [...prev, f]);
  }

  async function handleCampaignGenerate() {
    if (!camBrief.trim() || camLoading || camAssets.length === 0) return;
    setCamError(null);
    setCamLoading(true);
    let sharedCampaignId: string | undefined;
    let firstExecutionId: string | undefined;

    try {
      for (const assetFormat of camAssets) {
        setCamStep(`Generating ${assetFormat}…`);
        const result = await runCampaign({
          mode:     'campaign',
          brief:    camBrief.trim(),
          format:   apiFormat(assetFormat),
          platform: camPlatform,
          goal:     camGoal,
          assets:   camAssets.map(apiFormat),
          ...(camAngle                   && { styleContext: camAngle }),
          ...(selectedPersonaId          && { personaId: selectedPersonaId }),
          ...(sharedCampaignId          && { campaignId: sharedCampaignId }),
          ...(assetFormat === 'video'   && { durationTier: camDuration }),
          ...(assetFormat === 'carousel'&& { slideCount: camSlides }),
          ...(assetFormat === 'image'   && { sizes: ['1200x628', '1080x1080'] }),
        });

        // For campaign mode we ignore queued video results (no inline polling)
        if (!isQueued(result) && !sharedCampaignId) {
          sharedCampaignId = result.campaignId;
          firstExecutionId = result.executionId;
          saveRunResult(result, camBrief.trim(), apiFormat(assetFormat));
        }
      }
      if (firstExecutionId) router.push(`/result/${firstExecutionId}`);
    } catch (err) {
      setCamError(err instanceof Error ? err.message : 'Generation failed — check backend connection');
    } finally {
      setCamLoading(false);
      setCamStep('');
    }
  }

  // ─── Gallery handler — called when user picks (or skips) a template ──────
  function handleGallerySelect(pickedTemplateId: string, pickedFormat: GalleryFormat) {
    setTemplateId(pickedTemplateId);
    setFormat(pickedFormat as AdFormat);
    setStep('brief');
    // Pre-fetch templates list for the brief form (already loaded in gallery)
    if ((pickedFormat === 'carousel' || pickedFormat === 'image') && templates.length === 0) {
      getTemplateCatalog().then(r => setTemplates(r.templates)).catch(() => {});
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  if (step === 'gallery') {
    return (
      <div className="app-shell">
        <Sidebar />
        <main className="app-main" style={{ display: 'flex', flexDirection: 'column' }}>
          <TemplateGallery
            templates={templates.length > 0 ? templates : []}
            onSelect={handleGallerySelect}
            defaultFormat={format as GalleryFormat}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-main">

        {/* ── Top bar ──────────────────────────────────────────────────────── */}
        <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '10px 32px', display: 'flex', alignItems: 'center', gap: 16 }}>
          <button
            onClick={() => setStep('gallery')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--muted)', fontFamily: 'inherit', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, padding: '4px 0' }}
          >
            ← Templates
          </button>

          <div style={{ width: 1, height: 16, background: 'var(--border)' }} />

          <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>✦ Create</span>

          <div style={{ display: 'flex', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', padding: 3, gap: 2 }}>
            {(['quick', 'campaign'] as Mode[]).map(m => (
              <button key={m} onClick={() => setMode(m)}
                style={{ padding: '5px 16px', borderRadius: 6, border: 'none', fontFamily: 'inherit', fontWeight: 600, fontSize: 12, cursor: 'pointer', transition: 'all 0.15s',
                  background: mode === m ? 'var(--indigo)' : 'transparent',
                  color:      mode === m ? '#fff'          : 'var(--sub)' }}>
                {m === 'quick' ? '⚡ Quick Ad' : '📋 Campaign'}
              </button>
            ))}
          </div>

          <span style={{ fontSize: 11, color: 'var(--muted)' }}>
            {mode === 'quick'
              ? 'One brief, one ad, instant live preview'
              : 'Full pipeline — concept → angles → multiple formats → result page'}
          </span>

          {lastRunResult && mode === 'quick' && (
            <a href={`/result/${lastRunResult.executionId}`}
              style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--indigo-l)', textDecoration: 'none', border: '1px solid var(--indigo)', borderRadius: 5, padding: '3px 10px' }}>
              Full Result →
            </a>
          )}
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            PHOTO REVEAL — full custom form, bypasses normal brief flow
            ════════════════════════════════════════════════════════════════ */}
        {templateId === 'photo-reveal' && (
          <div style={{ padding: '32px', maxWidth: 860, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 32 }}>

            {/* Header */}
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 6 }}>Photo Reveal Carousel</div>
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>Describe your topic — AI writes the hook + labels and sources photos automatically.</div>
            </div>

            {/* AI brief + generate */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-label" style={{ margin: 0 }}>What is this carousel about?</div>
              <textarea
                value={prBrief}
                onChange={e => setPrBrief(e.target.value)}
                placeholder="e.g. The untold story of how SpaceX almost went bankrupt before their first successful launch"
                rows={3}
                style={{ width: '100%', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' as const }}
              />
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <button
                  disabled={prGenerating || !prBrief.trim()}
                  onClick={async () => {
                    if (!prBrief.trim()) return;
                    setPrGenerating(true);
                    try {
                      const res = await fetch('/api/photo-reveal', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ brief: prBrief, slideCount: 5, mediaCount: mediaLibrary.length }),
                      });
                      if (!res.ok) throw new Error('Generation failed');
                      const data = await res.json() as {
                        hook:   string;
                        slides: { label: string; unsplashKeyword: string; mediaIndex?: number | null }[];
                      };

                      // Populate hook + labels
                      setPrHook(data.hook ?? '');
                      setPrItems(data.slides.map(s => s.label));
                      setPrImages({});
                      setPrUnsplashQ({});

                      // Auto-source images for each slide
                      data.slides.forEach(async (slide, idx) => {
                        // Prefer media library if Claude picked an index and it exists
                        if (slide.mediaIndex != null && mediaLibrary[slide.mediaIndex]) {
                          setPrImages(p => ({ ...p, [idx]: mediaLibrary[slide.mediaIndex as number] }));
                          return;
                        }
                        // Otherwise fetch from Unsplash
                        if (slide.unsplashKeyword) {
                          setPrUnsplashLoading(p => ({ ...p, [idx]: true }));
                          try {
                            const r = await fetch(`/api/unsplash?q=${encodeURIComponent(slide.unsplashKeyword)}`);
                            if (r.ok) {
                              const img = await r.json() as { url: string };
                              if (img.url) setPrImages(p => ({ ...p, [idx]: img.url }));
                            }
                          } finally {
                            setPrUnsplashLoading(p => ({ ...p, [idx]: false }));
                          }
                        }
                      });
                    } catch {
                      // silently keep what was generated so far
                    } finally {
                      setPrGenerating(false);
                    }
                  }}
                  style={{
                    padding: '10px 24px', borderRadius: 8, fontWeight: 700, fontSize: 13,
                    background: prGenerating || !prBrief.trim() ? 'var(--surface-2)' : 'var(--accent)',
                    color: prGenerating || !prBrief.trim() ? 'var(--muted)' : '#000',
                    border: 'none', cursor: prGenerating || !prBrief.trim() ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit', transition: 'all 0.15s',
                  }}
                >
                  {prGenerating ? 'Generating...' : 'Generate Carousel'}
                </button>
                {(prHook || prItems.length > 0) && !prGenerating && (
                  <span style={{ fontSize: 12, color: 'var(--accent)' }}>
                    {prItems.length + 1} slides ready — scroll down to edit
                  </span>
                )}
              </div>
            </div>

            {/* Hook headline — editable after generation */}
            <div>
              <div className="form-label">Hook Headline (Slide 1)</div>
              <input
                value={prHook}
                onChange={e => setPrHook(e.target.value)}
                placeholder="Generate above or type manually..."
                style={{ width: '100%', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' as const }}
              />
            </div>

            {/* Accent color */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div className="form-label" style={{ margin: 0 }}>Label Accent Color</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {['#f59e0b','#ffffff','#ef4444','#22c55e','#3b82f6','#a855f7','#f97316'].map(c => (
                  <button key={c} onClick={() => setPrAccent(c)}
                    style={{ width: 24, height: 24, borderRadius: '50%', background: c, border: prAccent === c ? '3px solid var(--text)' : '2px solid var(--border)', cursor: 'pointer', flexShrink: 0 }} />
                ))}
                <input type="color" value={prAccent} onChange={e => setPrAccent(e.target.value)}
                  style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid var(--border)', cursor: 'pointer', padding: 0, background: 'none' }} />
              </div>
            </div>

            {/* Reveal slides */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div className="form-label" style={{ margin: 0 }}>Reveal Slides</div>
                <button onClick={() => setPrItems(p => [...p, ''])}
                  style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', background: 'rgba(0,201,122,0.08)', border: '1px solid rgba(0,201,122,0.2)', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontFamily: 'inherit' }}>
                  + Add Slide
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {prItems.map((item, idx) => (
                  <div key={idx} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {/* Slide label */}
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', minWidth: 20 }}>{idx + 2}</div>
                      <input
                        value={item}
                        onChange={e => setPrItems(p => p.map((v, i) => i === idx ? e.target.value : v))}
                        placeholder="e.g. SPONGE BOY, ORIGINAL PATENT, KRUSTY KRAB"
                        style={{ flex: 1, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 12px', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit' }}
                      />
                      <button onClick={() => {
                        setPrItems(p => p.filter((_, i) => i !== idx));
                        setPrImages(p => { const n = {...p}; delete n[idx]; return n; });
                      }}
                        style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        ×
                      </button>
                    </div>

                    {/* Image picker for this slide */}
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                      {/* Preview if image set */}
                      {prImages[idx] ? (
                        <div style={{ position: 'relative', width: 80, height: 56, borderRadius: 7, overflow: 'hidden', flexShrink: 0 }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={prImages[idx]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          <button onClick={() => setPrImages(p => { const n = {...p}; delete n[idx]; return n; })}
                            style={{ position: 'absolute', top: 2, right: 2, width: 18, height: 18, borderRadius: '50%', background: 'rgba(0,0,0,0.7)', border: 'none', color: '#fff', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                        </div>
                      ) : (
                        <div style={{ width: 80, height: 56, borderRadius: 7, background: 'var(--surface-2)', border: '1px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <span style={{ fontSize: 18, color: 'var(--muted)' }}>◻</span>
                        </div>
                      )}

                      {/* Upload button */}
                      <label style={{ cursor: 'pointer' }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--sub)', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 10px', whiteSpace: 'nowrap' as const }}>
                          Upload
                        </div>
                        <input type="file" accept="image/*" style={{ display: 'none' }}
                          onChange={e => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onload = ev => setPrImages(p => ({ ...p, [idx]: ev.target?.result as string }));
                            reader.readAsDataURL(file);
                          }} />
                      </label>

                      {/* From media library */}
                      {mediaLibrary.length > 0 && (
                        <div style={{ position: 'relative' }}>
                          <button onClick={() => setPrMediaOpen(prMediaOpen === idx ? null : idx)}
                            style={{ fontSize: 11, fontWeight: 600, color: 'var(--sub)', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' as const }}>
                            Library ({mediaLibrary.length})
                          </button>
                          {prMediaOpen === idx && (
                            <div style={{ position: 'absolute', top: '110%', left: 0, zIndex: 100, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 10, display: 'grid', gridTemplateColumns: 'repeat(4, 64px)', gap: 6, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
                              {mediaLibrary.map((src, mi) => (
                                <div key={mi} style={{ cursor: 'pointer', borderRadius: 6, overflow: 'hidden', border: '2px solid transparent' }}
                                  onClick={() => { setPrImages(p => ({ ...p, [idx]: src })); setPrMediaOpen(null); }}>
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={src} alt="" style={{ width: 64, height: 48, objectFit: 'cover', display: 'block' }} />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Unsplash search */}
                      <div style={{ display: 'flex', gap: 6, flex: 1, minWidth: 160 }}>
                        <input
                          value={prUnsplashQ[idx] ?? (item || '')}
                          onChange={e => setPrUnsplashQ(p => ({ ...p, [idx]: e.target.value }))}
                          placeholder="Unsplash keyword…"
                          style={{ flex: 1, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 8px', color: 'var(--text)', fontSize: 11, fontFamily: 'inherit' }}
                          onKeyDown={async e => {
                            if (e.key !== 'Enter') return;
                            const q = prUnsplashQ[idx] ?? item;
                            if (!q) return;
                            setPrUnsplashLoading(p => ({ ...p, [idx]: true }));
                            try {
                              const res = await fetch(`/api/unsplash?q=${encodeURIComponent(q)}`);
                              if (res.ok) {
                                const data = await res.json() as { url: string };
                                if (data.url) setPrImages(p => ({ ...p, [idx]: data.url }));
                              }
                            } finally { setPrUnsplashLoading(p => ({ ...p, [idx]: false })); }
                          }}
                        />
                        <button
                          disabled={prUnsplashLoading[idx]}
                          onClick={async () => {
                            const q = prUnsplashQ[idx] ?? item;
                            if (!q) return;
                            setPrUnsplashLoading(p => ({ ...p, [idx]: true }));
                            try {
                              const res = await fetch(`/api/unsplash?q=${encodeURIComponent(q)}`);
                              if (res.ok) {
                                const data = await res.json() as { url: string };
                                if (data.url) setPrImages(p => ({ ...p, [idx]: data.url }));
                              }
                            } finally { setPrUnsplashLoading(p => ({ ...p, [idx]: false })); }
                          }}
                          style={{ fontSize: 11, fontWeight: 600, color: prUnsplashLoading[idx] ? 'var(--muted)' : 'var(--accent)', background: 'rgba(0,201,122,0.08)', border: '1px solid rgba(0,201,122,0.2)', borderRadius: 6, padding: '5px 10px', cursor: prUnsplashLoading[idx] ? 'not-allowed' : 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' as const }}>
                          {prUnsplashLoading[idx] ? '...' : 'Search'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {prItems.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--muted)', fontSize: 13 }}>
                    No slides yet. Click <strong>+ Add Slide</strong> to start building your reveal.
                  </div>
                )}
              </div>
            </div>

            {/* Live preview */}
            {(prHook || prItems.length > 0) && (
              <div>
                <div className="form-label">Preview</div>
                <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 8 }}>
                  {/* Slide 1 — hook */}
                  <div style={{ flexShrink: 0, width: 160, height: 220, borderRadius: 10, overflow: 'hidden', position: 'relative', background: '#111', border: '1px solid var(--border)' }}>
                    {prImages[-1] && <img src={prImages[-1]} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.3) 50%, transparent 100%)' }} />
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '12px 10px 10px' }}>
                      <div style={{ fontSize: 10, fontWeight: 900, color: prAccent, textTransform: 'uppercase', lineHeight: 1.2, letterSpacing: '-0.01em' }}>
                        {prHook || 'YOUR HOOK HEADLINE'}
                      </div>
                    </div>
                    <div style={{ position: 'absolute', top: 8, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
                      <label style={{ cursor: 'pointer' }}>
                        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', background: 'rgba(0,0,0,0.5)', borderRadius: 4, padding: '2px 6px' }}>+ photo</div>
                        <input type="file" accept="image/*" style={{ display: 'none' }}
                          onChange={e => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onload = ev => setPrImages(p => ({ ...p, [-1]: ev.target?.result as string }));
                            reader.readAsDataURL(file);
                          }} />
                      </label>
                    </div>
                  </div>

                  {/* Reveal slides */}
                  {prItems.map((label, idx) => (
                    <div key={idx} style={{ flexShrink: 0, width: 160, height: 220, borderRadius: 10, overflow: 'hidden', position: 'relative', background: '#111', border: '1px solid var(--border)' }}>
                      {prImages[idx] && <img src={prImages[idx]} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
                      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.3) 50%, transparent 100%)' }} />
                      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '12px 10px 10px' }}>
                        <div style={{ fontSize: 11, fontWeight: 900, color: prAccent, textTransform: 'uppercase', lineHeight: 1.2, letterSpacing: '-0.01em' }}>
                          {label || `SLIDE ${idx + 2}`}
                        </div>
                      </div>
                      {!prImages[idx] && (
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ fontSize: 24, color: 'rgba(255,255,255,0.1)' }}>◻</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Export note */}
            <div style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.18)', borderRadius: 10, padding: '14px 18px', fontSize: 12, color: 'var(--indigo-l)', lineHeight: 1.6 }}>
              AI sources photos from Unsplash or your media library automatically. You can swap any photo manually using Upload, Library, or a new Unsplash search. Full PNG export per slide coming soon.
            </div>

          </div>
        )}

        <div className="page-content" style={templateId === 'photo-reveal' ? { display: 'none' } : mode === 'quick' ? { padding: 0, overflow: 'hidden' } : undefined}>

          {/* ═══════════════════════════════════════════════════════════════
              QUICK MODE — 2-column: control panel | live preview
              ══════════════════════════════════════════════════════════════ */}
          {mode === 'quick' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 0, alignItems: 'start' }}>

              {/* ── LEFT: live preview stage ─────────────────────────────── */}
              <div style={{ minHeight: 'calc(100vh - 112px)', background: 'var(--bg)', borderRight: '1px solid var(--border)', display: 'flex', alignItems: 'stretch' }}>
                <PreviewStage
                  status={previewStatus}
                  format={format as PreviewFormat}
                  progress={previewProgress}
                  result={previewResult}
                  error={previewError}
                  videoMode={format === 'video' ? videoMode : undefined}
                  onRetry={handleGenerate}
                  onDownload={handleDownload}
                  onRegenerate={handleGenerate}
                  onNewAngle={handleGenerate}
                />
              </div>

              {/* ── RIGHT: control panel ─────────────────────────────────── */}
              <div style={{ position: 'sticky', top: 49, height: 'calc(100vh - 49px)', overflowY: 'auto', padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 0 }}>

                {/* Format */}
                <div style={{ marginBottom: 20 }}>
                  <div className="form-label">Format</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                    {([
                      ['video',    '▶',  'Video'],
                      ['carousel', '⊞',  'Carousel'],
                      ['image',    '⬜', 'Image'],
                    ] as [AdFormat, string, string][]).map(([id, icon, label]) => {
                      const locked = id === 'video' && !isAdmin;
                      return (
                        <button key={id}
                          onClick={() => { if (!locked) setFormat(id); }}
                          disabled={generating || locked}
                          className={`format-btn${!locked && format === id ? ' active' : ''}`}
                          style={{ flexDirection: 'column', gap: 4, padding: '12px 8px', opacity: locked ? 0.55 : 1, cursor: locked ? 'not-allowed' : 'pointer', position: 'relative' }}>
                          <span style={{ fontSize: 20 }}>{locked ? '🔒' : icon}</span>
                          <span>{label}</span>
                          {locked && (
                            <span style={{ position: 'absolute', bottom: 4, left: 0, right: 0, fontSize: 8, color: 'var(--amber)', fontWeight: 700, letterSpacing: '0.05em', textAlign: 'center' }}>
                              ADMIN ONLY
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Platform */}
                <div style={{ marginBottom: 20 }}>
                  <div className="form-label">Platform</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {([
                      ['meta',   '📘', 'Meta'],
                      ['tiktok', '🎵', 'TikTok'],
                      ['google', '🔍', 'Google'],
                    ] as [AdPlatform, string, string][]).map(([id, icon, label]) => (
                      <button key={id} onClick={() => setPlatform(id)} disabled={generating}
                        className={`format-btn${platform === id ? ' active' : ''}`} style={{ flex: 1 }}>
                        {icon} {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Goal + Angle */}
                <div style={{ marginBottom: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <div className="form-label">Goal</div>
                    <select value={goal} onChange={e => setGoal(e.target.value as RunGoal)} disabled={generating} style={dropdownStyle}>
                      {GOALS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <div className="form-label">Angle</div>
                    <select value={angle} onChange={e => setAngle(e.target.value)} disabled={generating} style={dropdownStyle}>
                      {ANGLES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                    </select>
                  </div>
                </div>

                {/* Duration — video only */}
                {format === 'video' && (
                  <div style={{ marginBottom: 20 }}>
                    <div className="form-label">Duration</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {(['SHORT', 'MEDIUM', 'LONG', 'EXTENDED'] as DurationTier[]).map(d => (
                        <button key={d} onClick={() => setDurationTier(d)} disabled={generating}
                          style={{ flex: 1, padding: '8px 4px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center',
                            background: durationTier === d ? 'var(--accent)' : 'var(--surface-2)',
                            border:     `1px solid ${durationTier === d ? 'var(--accent)' : 'var(--border)'}`,
                            color:      durationTier === d ? '#fff' : 'var(--sub)' }}>
                          {DURATION_LABELS[d]}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Video Style — video only */}
                {format === 'video' && (
                  <div style={{ marginBottom: 20 }}>
                    <div className="form-label">Video Style</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      {([
                        ['ugc',     '📱', 'UGC',      'Kling · Authentic, scroll-native',        'var(--amber)'],
                        ['classic', '🎬', 'Cinematic', 'Veo · Premium, polished production',      '#a78bfa'],
                      ] as [string, string, string, string, string][]).map(([id, icon, label, sub, activeColor]) => (
                        <button
                          key={id}
                          onClick={() => setVideoMode(id as 'ugc' | 'classic')}
                          disabled={generating}
                          style={{
                            padding: '12px 14px', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                            fontFamily: 'inherit', transition: 'all 0.15s',
                            background: videoMode === id ? 'rgba(79,70,229,0.12)' : 'var(--surface-2)',
                            border:     `1.5px solid ${videoMode === id ? activeColor : 'var(--border)'}`,
                          }}
                        >
                          <div style={{ fontSize: 18, marginBottom: 4 }}>{icon}</div>
                          <div style={{ fontWeight: 700, fontSize: 13, color: videoMode === id ? activeColor : 'var(--text)' }}>
                            {label}
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2, lineHeight: 1.3 }}>{sub}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Voiceover — video only */}
                {format === 'video' && (
                  <div style={{ marginBottom: 20 }}>
                    <div className="form-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>🎙 AI Voiceover</span>
                      <span style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 400 }}>
                        ElevenLabs · mixed into final video
                      </span>
                    </div>

                    {/* Toggle */}
                    <button
                      onClick={() => setVoiceoverEnabled(v => !v)}
                      disabled={generating}
                      style={{
                        width: '100%', padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
                        fontFamily: 'inherit', fontWeight: 600, fontSize: 13, textAlign: 'left',
                        display: 'flex', alignItems: 'center', gap: 10, transition: 'all 0.15s',
                        background: voiceoverEnabled ? 'rgba(79,70,229,0.12)' : 'var(--surface-2)',
                        border: `1.5px solid ${voiceoverEnabled ? 'var(--indigo)' : 'var(--border)'}`,
                        color: voiceoverEnabled ? 'var(--indigo-l)' : 'var(--sub)',
                      }}
                    >
                      <span style={{ fontSize: 18 }}>{voiceoverEnabled ? '🔊' : '🔇'}</span>
                      <div>
                        <div>{voiceoverEnabled ? 'Voiceover ON' : 'Voiceover OFF'}</div>
                        <div style={{ fontSize: 10, fontWeight: 400, color: 'var(--muted)', marginTop: 1 }}>
                          {voiceoverEnabled
                            ? 'Scene text → TTS → mixed into video audio track'
                            : 'Click to enable — generates speech from your ad script'}
                        </div>
                      </div>
                    </button>

                    {/* Voice picker — shown when voiceover is on */}
                    {voiceoverEnabled && (
                      <div style={{ marginTop: 10 }}>
                        <select
                          value={voiceId}
                          onChange={e => setVoiceId(e.target.value)}
                          disabled={generating}
                          style={dropdownStyle}
                        >
                          <option value="">— Default voice (Rachel) —</option>
                          {voices.map(v => (
                            <option key={v.voiceId} value={v.voiceId}>
                              {v.name}{v.category ? ` · ${v.category}` : ''}
                            </option>
                          ))}
                        </select>
                        {voices.length === 0 && (
                          <div style={{ marginTop: 4, fontSize: 11, color: 'var(--muted)' }}>
                            Voice list unavailable — check ELEVENLABS_API_KEY in Railway env vars.
                            Default voice (Rachel) will be used.
                          </div>
                        )}
                        {voiceId && voices.length > 0 && (() => {
                          const v = voices.find(x => x.voiceId === voiceId);
                          return v?.previewUrl ? (
                            <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                              <audio controls src={v.previewUrl} style={{ height: 28, flex: 1, opacity: 0.8 }} />
                              <span style={{ fontSize: 10, color: 'var(--muted)' }}>Preview</span>
                            </div>
                          ) : null;
                        })()}
                      </div>
                    )}
                  </div>
                )}

                {/* Slides — carousel only */}
                {format === 'carousel' && (
                  <div style={{ marginBottom: 20 }}>
                    <div className="form-label">Slides</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {[3, 5, 7, 10].map(n => (
                        <button key={n} onClick={() => setSlideCount(n)} disabled={generating}
                          style={{ flex: 1, padding: '8px 4px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center',
                            background: slideCount === n ? 'var(--accent)' : 'var(--surface-2)',
                            border:     `1px solid ${slideCount === n ? 'var(--accent)' : 'var(--border)'}`,
                            color:      slideCount === n ? '#fff' : 'var(--sub)' }}>
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Template chip — shows selected template, click to go back to gallery */}
                {(format === 'carousel' || format === 'image') && (
                  <div style={{ marginBottom: 20 }}>
                    <div className="form-label">🎨 Template</div>
                    <div
                      onClick={() => !generating && setStep('gallery')}
                      style={{
                        padding: '10px 12px', borderRadius: 8, cursor: generating ? 'default' : 'pointer',
                        background: templateId ? 'rgba(79,70,229,0.1)' : 'var(--surface-2)',
                        border: `1.5px solid ${templateId ? 'var(--indigo)' : 'var(--border)'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        transition: 'all 0.15s',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {/* Thumbnail preview */}
                        {templateId && (
                          <img
                            src={`/templates/${templateId}.png`}
                            alt=""
                            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            style={{ width: 36, height: 36, borderRadius: 5, objectFit: 'cover', border: '1px solid rgba(79,70,229,0.3)' }}
                          />
                        )}
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: templateId ? 'var(--indigo-l)' : 'var(--muted)' }}>
                            {templateId
                              ? (templates.find(t => t.id === templateId)?.name ?? templateId)
                              : 'AI Auto-Select'}
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 1 }}>
                            {templateId
                              ? templates.find(t => t.id === templateId)?.description
                              : 'Best template picked per slide by AI'}
                          </div>
                        </div>
                      </div>
                      {!generating && (
                        <span style={{ fontSize: 11, color: 'var(--indigo-l)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                          Change →
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Brand Color — carousel + image only */}
                {(format === 'carousel' || format === 'image') && (
                  <div style={{ marginBottom: 20 }}>
                    <div className="form-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>🎨 Brand Color</span>
                      {primaryColor && (
                        <button onClick={() => setPrimaryColor('')} disabled={generating}
                          style={{ fontSize: 11, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                          Clear
                        </button>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: primaryColor ? 8 : 0 }}>
                      {([
                        ['#4f46e5','Indigo'], ['#2563eb','Blue'],    ['#0891b2','Cyan'],
                        ['#059669','Emerald'],['#16a34a','Green'],   ['#d97706','Amber'],
                        ['#ea580c','Orange'], ['#dc2626','Red'],     ['#ec4899','Pink'],
                        ['#9333ea','Purple'], ['#18181b','Black'],   ['#f8fafc','White'],
                      ] as [string,string][]).map(([color, label]) => (
                        <button key={color} title={label} disabled={generating}
                          onClick={() => setPrimaryColor(primaryColor === color ? '' : color)}
                          style={{
                            width: 28, height: 28, borderRadius: 6, border: 'none', cursor: 'pointer', background: color, transition: 'transform 0.12s',
                            transform: primaryColor === color ? 'scale(1.2)' : 'scale(1)',
                            outline: primaryColor === color ? '2.5px solid var(--indigo)' : '2px solid rgba(255,255,255,0.12)',
                            outlineOffset: primaryColor === color ? 2 : 0,
                            boxShadow: color === '#f8fafc' ? 'inset 0 0 0 1px rgba(0,0,0,0.15)' : 'none',
                          }} />
                      ))}
                      <label title="Custom color" style={{ position: 'relative', width: 28, height: 28, borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', outline: '2px solid rgba(255,255,255,0.12)', background: 'var(--surface-2)' }}>
                        <span style={{ fontSize: 16, color: 'var(--muted)', pointerEvents: 'none', lineHeight: 1 }}>+</span>
                        <input type="color" disabled={generating} value={primaryColor || '#4f46e5'}
                          onChange={e => setPrimaryColor(e.target.value)}
                          style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }} />
                      </label>
                    </div>
                    {primaryColor && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: 'var(--surface-2)', borderRadius: 6, border: '1px solid var(--border)' }}>
                        <div style={{ width: 14, height: 14, borderRadius: 3, background: primaryColor, flexShrink: 0, boxShadow: '0 0 0 1px rgba(0,0,0,0.2)' }} />
                        <span style={{ fontSize: 12, color: 'var(--text)', fontFamily: 'monospace', fontWeight: 600 }}>{primaryColor}</span>
                        <span style={{ fontSize: 11, color: 'var(--muted)' }}>· buttons, accents &amp; highlights</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Persona */}
                {personas.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <div className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      Target Persona
                      <span style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 400 }}>optional · shapes all AI copy</span>
                    </div>
                    <select
                      value={selectedPersonaId}
                      onChange={e => setSelectedPersonaId(e.target.value)}
                      disabled={generating}
                      style={{
                        width: '100%', background: 'var(--surface-2)', border: '1px solid var(--border)',
                        borderRadius: 8, padding: '9px 12px', color: selectedPersonaId ? 'var(--text)' : 'var(--muted)',
                        fontSize: 13, outline: 'none', cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >
                      <option value="">— No persona —</option>
                      {personas.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    {selectedPersonaId && (() => {
                      const p = personas.find(x => x.id === selectedPersonaId);
                      return p ? (
                        <div style={{ marginTop: 6, fontSize: 11, color: 'var(--muted)', lineHeight: 1.5, background: 'var(--surface-2)', borderRadius: 6, padding: '6px 10px', border: '1px solid var(--border)' }}>
                          <span style={{ color: 'var(--accent-l)' }}>👤 {p.name}</span> — {p.description}
                          {p.painPoints.length > 0 && (
                            <div style={{ marginTop: 3, color: '#f87171' }}>Pain: {p.painPoints.slice(0, 2).join(' · ')}</div>
                          )}
                        </div>
                      ) : null;
                    })()}
                  </div>
                )}

                {/* Brief */}
                <div style={{ marginBottom: 20 }}>
                  <div className="form-label">Brief</div>
                  <textarea
                    className="form-input"
                    value={brief}
                    onChange={e => setBrief(e.target.value)}
                    rows={5}
                    disabled={generating}
                    placeholder="Describe your product, target audience, and key message…"
                    style={{ resize: 'vertical' }}
                  />
                  <div style={{ marginTop: 4, fontSize: 11, color: 'var(--muted)', display: 'flex', gap: 12 }}>
                    <span>{brief.length} chars</span>
                    <span>format: <strong style={{ color: 'var(--accent-l)' }}>{apiFormat(format)}</strong></span>
                    {format === 'video'    && <span>duration: <strong style={{ color: 'var(--accent-l)' }}>{DURATION_LABELS[durationTier]}</strong></span>}
                    {format === 'carousel' && <span>slides: <strong style={{ color: 'var(--accent-l)' }}>{slideCount}</strong></span>}
                  </div>
                </div>

                {/* Generate button */}
                <button
                  onClick={handleGenerate}
                  disabled={!brief.trim() || generating}
                  className="btn-generate"
                  style={{ width: '100%' }}>
                  {generating ? (
                    <><div className="spinner" />{previewStatus === 'processing' ? 'Rendering video…' : 'Generating…'}</>
                  ) : (
                    <>⚡ Generate {format === 'image' ? 'Image' : format === 'carousel' ? 'Carousel' : 'Video'}</>
                  )}
                </button>

                {lastRunResult && (
                  <div style={{ marginTop: 10, textAlign: 'center' }}>
                    <a href={`/result/${lastRunResult.executionId}`}
                      style={{ fontSize: 11, color: 'var(--indigo-l)', textDecoration: 'none' }}>
                      View full result &amp; editor →
                    </a>
                  </div>
                )}

              </div>{/* /controls panel */}
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              CAMPAIGN MODE — 2-column mirror of Quick Ad
              ══════════════════════════════════════════════════════════════ */}
          {mode === 'campaign' && (
            <div style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: 32, alignItems: 'start' }}>

              {/* ── LEFT: control panel ──────────────────────────────────── */}
              <div>

                {/* Assets to Generate */}
                <div style={{ marginBottom: 20 }}>
                  <div className="form-label">Assets to Generate</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                    {([
                      ['video',    '▶',  'Video'],
                      ['carousel', '⊞',  'Carousel'],
                      ['image',    '⬜', 'Image'],
                    ] as [AdFormat, string, string][]).map(([id, icon, label]) => {
                      const locked  = id === 'video' && !isAdmin;
                      const checked = camAssets.includes(id);
                      return (
                        <button key={id}
                          onClick={() => { if (!locked) toggleCamAsset(id); }}
                          disabled={camLoading || locked}
                          className={`format-btn${!locked && checked ? ' active' : ''}`}
                          style={{ flexDirection: 'column', gap: 4, padding: '12px 8px', opacity: locked ? 0.55 : 1, cursor: locked ? 'not-allowed' : 'pointer', position: 'relative' }}>
                          <span style={{ fontSize: 20 }}>{locked ? '🔒' : icon}</span>
                          <span>{label}</span>
                          {locked && (
                            <span style={{ position: 'absolute', bottom: 4, left: 0, right: 0, fontSize: 8, color: 'var(--amber)', fontWeight: 700, letterSpacing: '0.05em', textAlign: 'center' }}>
                              ADMIN ONLY
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  {camAssets.length === 0 && (
                    <div style={{ fontSize: 11, color: 'var(--rose)', marginTop: 6 }}>Select at least one format.</div>
                  )}
                </div>

                {/* Platform */}
                <div style={{ marginBottom: 20 }}>
                  <div className="form-label">Platform</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {([['meta', '📘', 'Meta'], ['tiktok', '🎵', 'TikTok'], ['google', '🔍', 'Google']] as [AdPlatform, string, string][]).map(([id, icon, label]) => (
                      <button key={id} onClick={() => setCamPlatform(id)} disabled={camLoading}
                        className={`format-btn${camPlatform === id ? ' active' : ''}`} style={{ flex: 1 }}>
                        {icon} {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Goal + Angle */}
                <div style={{ marginBottom: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <div className="form-label">Goal</div>
                    <select value={camGoal} onChange={e => setCamGoal(e.target.value as RunGoal)} disabled={camLoading} style={dropdownStyle}>
                      {GOALS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <div className="form-label">Angle</div>
                    <select value={camAngle} onChange={e => setCamAngle(e.target.value)} disabled={camLoading} style={dropdownStyle}>
                      {ANGLES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                    </select>
                  </div>
                </div>

                {/* Duration — only when video selected */}
                {camAssets.includes('video') && (
                  <div style={{ marginBottom: 20 }}>
                    <div className="form-label">Video Duration</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {(['SHORT', 'MEDIUM', 'LONG', 'EXTENDED'] as DurationTier[]).map(d => (
                        <button key={d} onClick={() => setCamDuration(d)} disabled={camLoading}
                          style={{ flex: 1, padding: '8px 4px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center',
                            background: camDuration === d ? 'var(--accent)' : 'var(--surface-2)',
                            border:     `1px solid ${camDuration === d ? 'var(--accent)' : 'var(--border)'}`,
                            color:      camDuration === d ? '#fff' : 'var(--sub)' }}>
                          {DURATION_LABELS[d]}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Slides — only when carousel selected */}
                {camAssets.includes('carousel') && (
                  <div style={{ marginBottom: 20 }}>
                    <div className="form-label">Slides</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {[3, 5, 7, 10].map(n => (
                        <button key={n} onClick={() => setCamSlides(n)} disabled={camLoading}
                          style={{ flex: 1, padding: '8px 4px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center',
                            background: camSlides === n ? 'var(--accent)' : 'var(--surface-2)',
                            border:     `1px solid ${camSlides === n ? 'var(--accent)' : 'var(--border)'}`,
                            color:      camSlides === n ? '#fff' : 'var(--sub)' }}>
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Persona */}
                {personas.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <div className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      Target Persona
                      <span style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 400 }}>optional</span>
                    </div>
                    <select
                      value={selectedPersonaId}
                      onChange={e => setSelectedPersonaId(e.target.value)}
                      disabled={camLoading}
                      style={{
                        width: '100%', background: 'var(--surface-2)', border: '1px solid var(--border)',
                        borderRadius: 8, padding: '9px 12px', color: selectedPersonaId ? 'var(--text)' : 'var(--muted)',
                        fontSize: 13, outline: 'none', cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >
                      <option value="">— No persona —</option>
                      {personas.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Brief */}
                <div style={{ marginBottom: 20 }}>
                  <div className="form-label">Campaign Brief</div>
                  <textarea className="form-input" rows={5}
                    placeholder="e.g. A fitness app that creates personalised workout plans using AI — targeting busy professionals who have 20 minutes a day."
                    value={camBrief} onChange={e => setCamBrief(e.target.value)} disabled={camLoading}
                    style={{ resize: 'vertical' }} />
                  <div style={{ marginTop: 4, fontSize: 11, color: 'var(--muted)', display: 'flex', gap: 12 }}>
                    <span>{camBrief.length} chars</span>
                    <span>assets: <strong style={{ color: 'var(--accent-l)' }}>{camAssets.length > 0 ? camAssets.join(', ') : 'none'}</strong></span>
                    <span>~{camAssets.length * 8}s</span>
                  </div>
                </div>

                {/* Error */}
                {camError && (
                  <div className="form-error" style={{ marginBottom: 16 }}>⚠ {camError}</div>
                )}

                {/* Generate */}
                <button className="btn-generate" style={{ width: '100%' }}
                  onClick={handleCampaignGenerate}
                  disabled={!camBrief.trim() || camLoading || camAssets.length === 0}>
                  {camLoading
                    ? <><div className="spinner" />Generating {camAssets.length > 1 ? `${camAssets.length} assets` : camAssets[0]}…</>
                    : <>✦ Generate Campaign</>}
                </button>
              </div>

              {/* ── RIGHT: status panel ───────────────────────────────────── */}
              <div style={{
                minHeight: 480, borderRadius: 16, border: '1px dashed var(--border)',
                background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {!camLoading && !camError && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: 32, gap: 0 }}>
                    <div style={{ fontSize: 48, opacity: 0.12, lineHeight: 1 }}>✦</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--sub)', marginTop: 12 }}>
                      Your campaign will appear here
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                      Select formats, write your brief, and hit Generate
                    </div>
                    {camAssets.length > 0 && (
                      <div style={{ marginTop: 20, display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                        {camAssets.map(a => (
                          <span key={a} style={{
                            fontSize: 11, fontWeight: 600, padding: '4px 12px', borderRadius: 20,
                            background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)',
                            color: 'var(--indigo-l)',
                          }}>
                            {a === 'video' ? '▶ Video' : a === 'carousel' ? '⊞ Carousel' : '⬜ Image'}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {camLoading && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: 32, gap: 16 }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: '50%',
                      border: '3px solid var(--border)', borderTopColor: 'var(--accent)',
                      animation: 'spin 1s linear infinite',
                    }} />
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
                      {camStep || 'Generating campaign…'}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                      Concept → Angles → {camAssets.join(' + ')}
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginTop: 4 }}>
                      {camAssets.map(a => (
                        <span key={a} style={{
                          fontSize: 11, fontWeight: 600, padding: '4px 12px', borderRadius: 20,
                          background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)',
                          color: '#10b981',
                        }}>
                          {a === 'video' ? '▶ Video' : a === 'carousel' ? '⊞ Carousel' : '⬜ Image'}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {camError && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: 32, gap: 12 }}>
                    <div style={{ fontSize: 36, opacity: 0.5 }}>⚠</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--rose)' }}>Generation failed</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', maxWidth: 300, lineHeight: 1.6 }}>{camError}</div>
                  </div>
                )}
              </div>

            </div>
          )}

        </div>
      </main>
    </div>
  );
}

// ─── Page export ──────────────────────────────────────────────────────────────

export default function CreatePage() {
  return (
    <Suspense>
      <CreatePageInner />
    </Suspense>
  );
}
