'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams }            from 'next/navigation';
import { Sidebar }                               from '@/components/Sidebar';
import { PreviewStage }                          from '@/components/PreviewStage';
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
  type CreativeContent,
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
  awareness:  'Awareness',
  engagement: 'Engagement',
};

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

  // ── Quick-mode controls ───────────────────────────────────────────────────
  const [format,       setFormat]       = useState<AdFormat>('carousel');
  const [platform,     setPlatform]     = useState<AdPlatform>('meta');
  const [goal,         setGoal]         = useState<RunGoal>('conversion');
  const [angle,        setAngle]        = useState('');
  const [durationTier, setDurationTier] = useState<DurationTier>('MEDIUM');
  const [slideCount,   setSlideCount]   = useState(5);
  const [brief,        setBrief]        = useState('');
  const [videoMode,    setVideoMode]    = useState<'ugc' | 'classic'>('ugc');

  // ── Preview state machine ─────────────────────────────────────────────────
  const [previewStatus,   setPreviewStatus]   = useState<PreviewStatus>('idle');
  const [previewProgress, setPreviewProgress] = useState(0);
  const [previewResult,   setPreviewResult]   = useState<PreviewResult | null>(null);
  const [previewError,    setPreviewError]    = useState<string | null>(null);
  const [lastRunResult,   setLastRunResult]   = useState<RunResult | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clean up polling on unmount
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  function stopPolling() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }

  // ── Campaign-mode state ───────────────────────────────────────────────────
  const [camBrief,      setCamBrief]      = useState('');
  const [camPlatform,   setCamPlatform]   = useState<AdPlatform>('meta');
  const [camGoal,       setCamGoal]       = useState<RunGoal>('conversion');
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
        setPreviewResult(prev => prev ? { ...prev, imagesReady: true } : prev);
        return;
      }
      try {
        const creative = await getCreativeById(creativeId);
        if (checkImagesReady(creative, fmt)) {
          stopPolling();
          setPreviewResult(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              slides:      (creative.slides  as SlideData[]  | undefined) ?? prev.slides,
              banners:     (creative.banners as BannerData[] | undefined) ?? prev.banners,
              imagesReady: true,
            };
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
    setPreviewStatus('generating');
    setPreviewProgress(0);
    setPreviewResult(null);
    setPreviewError(null);

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
        ...(format === 'carousel' && { slideCount }),
        ...(format === 'image'    && { sizes: ['1200x628', '1080x1080', '1080x1920'] }),
      });

      if (isQueued(response)) {
        // ── Async video path: poll job status ──────────────────────────────
        setPreviewStatus('processing');
        setPreviewProgress(5);
        const { jobId } = response;

        pollRef.current = setInterval(async () => {
          try {
            const job = await getJobStatus(jobId);
            setPreviewProgress(job.progress ?? 0);

            if (job.status === 'completed' && job.result) {
              stopPolling();
              saveRunResult(job.result, brief.trim(), 'video');
              setLastRunResult(job.result);
              const pr = await fetchPreviewResult(job.result, format);
              setPreviewResult(pr);
              setPreviewStatus('done');
            } else if (job.status === 'failed') {
              stopPolling();
              setPreviewError(job.error ?? 'Video rendering failed. Check Railway logs.');
              setPreviewStatus('error');
            }
          } catch (pollErr) {
            stopPolling();
            setPreviewError(pollErr instanceof Error ? pollErr.message : 'Polling error');
            setPreviewStatus('error');
          }
        }, 3_000);

      } else {
        // ── Sync path (carousel / image) ─────────────────────────────────
        saveRunResult(response, brief.trim(), apiFormat(format));
        setLastRunResult(response);
        const pr = await fetchPreviewResult(response, format);
        setPreviewResult(pr);
        setPreviewStatus('done');

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

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-main">

        {/* ── Top bar ──────────────────────────────────────────────────────── */}
        <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '10px 32px', display: 'flex', alignItems: 'center', gap: 16 }}>
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

        <div className="page-content">

          {/* ═══════════════════════════════════════════════════════════════
              QUICK MODE — 2-column: control panel | live preview
              ══════════════════════════════════════════════════════════════ */}
          {mode === 'quick' && (
            <div style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: 32, alignItems: 'start' }}>

              {/* ── LEFT: control panel ──────────────────────────────────── */}
              <div>

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
                      <option value="conversion">🎯 Sales</option>
                      <option value="awareness">📡 Awareness</option>
                      <option value="engagement">💬 Engagement</option>
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
              </div>

              {/* ── RIGHT: live preview stage ─────────────────────────────── */}
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
                      <option value="conversion">🎯 Sales</option>
                      <option value="awareness">📡 Awareness</option>
                      <option value="engagement">💬 Engagement</option>
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
