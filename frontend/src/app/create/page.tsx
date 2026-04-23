'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams }     from 'next/navigation';
import { Sidebar }                        from '@/components/Sidebar';
import {
  runCampaign, saveRunResult,
  type RunResult, type RunFormat, type RunGoal,
} from '@/lib/api/run-client';
import {
  generateAdCopy,
  getVideosByCampaign,
  getCarouselsByCampaign,
  getBannersByCampaign,
  getMe,
  type AdCopyInput,
} from '@/lib/api/creator-client';
import type {
  VideoCreative, CarouselCreative, BannerCreative,
  BannerItem, VideoScene, CarouselSlide,
} from '@/lib/types/creator';

// ─── Types ────────────────────────────────────────────────────────────────────

type Mode       = 'quick' | 'campaign';
type AdFormat   = 'video' | 'carousel' | 'banner';
type AdPlatform = 'meta' | 'tiktok' | 'google';
type AdTone     = 'bold' | 'subtle' | 'humorous' | 'inspirational' | 'direct';

interface AdCopyResult {
  headline: string;
  body:     string;
  cta:      string;
  hashtags: string[];
}

interface CampaignAssetResult {
  format:   AdFormat;
  result:   RunResult;
  video?:   VideoCreative;
  carousel?: CarouselCreative;
  banner?:  BannerCreative;
  caption?: AdCopyResult;
}

// ─── Platform Mockup Components ───────────────────────────────────────────────

function MetaMockup({ headline, body, cta, hook }: { headline: string; body: string; cta: string; hook?: string }) {
  return (
    <div style={{ maxWidth: 360, border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden', background: '#fff', fontFamily: 'system-ui, sans-serif', boxShadow: '0 2px 12px rgba(0,0,0,0.12)' }}>
      <div style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid #f3f4f6' }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#1877f2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14, fontWeight: 700 }}>B</div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1c1e21' }}>Your Brand</div>
          <div style={{ fontSize: 11, color: '#606770' }}>Sponsored · 📘</div>
        </div>
        <span style={{ marginLeft: 'auto', fontSize: 18, color: '#606770' }}>···</span>
      </div>
      <div style={{ padding: '10px 12px' }}>
        {hook && <div style={{ fontSize: 14, fontWeight: 700, color: '#1c1e21', marginBottom: 4 }}>{hook}</div>}
        <p style={{ fontSize: 13, color: '#1c1e21', margin: 0, lineHeight: 1.5 }}>{body || headline}</p>
      </div>
      <div style={{ height: 180, background: 'linear-gradient(135deg, #1877f2 0%, #42b72a 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>{headline}</span>
      </div>
      <div style={{ padding: '10px 12px', background: '#f0f2f5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 11, color: '#606770' }}>yourbrand.com</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1c1e21' }}>{headline.slice(0, 40)}</div>
        </div>
        <button style={{ padding: '6px 14px', borderRadius: 6, background: '#1877f2', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'default' }}>
          {cta || 'Learn More'}
        </button>
      </div>
      <div style={{ padding: '8px 12px', display: 'flex', gap: 16, borderTop: '1px solid #e4e6eb' }}>
        {['👍 Like', '💬 Comment', '➦ Share'].map(a => (
          <span key={a} style={{ fontSize: 12, color: '#606770', fontWeight: 600 }}>{a}</span>
        ))}
      </div>
    </div>
  );
}

function TikTokMockup({ hook, body, cta }: { hook: string; body: string; cta: string }) {
  return (
    <div style={{ width: 200, height: 355, background: '#000', borderRadius: 16, overflow: 'hidden', position: 'relative', fontFamily: 'system-ui, sans-serif', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' }} />
      <div style={{ position: 'absolute', top: 10, left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 2 }}>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>For You</span>
      </div>
      <div style={{ position: 'absolute', bottom: 80, left: 10, right: 50, zIndex: 2 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#fff', marginBottom: 6, lineHeight: 1.3 }}>{hook.slice(0, 60)}</div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)', lineHeight: 1.4 }}>{body.slice(0, 80)}</div>
        <div style={{ marginTop: 8, padding: '4px 10px', background: 'rgba(254,44,85,0.9)', borderRadius: 20, display: 'inline-block', fontSize: 10, fontWeight: 700, color: '#fff' }}>{cta || 'Shop Now'}</div>
      </div>
      <div style={{ position: 'absolute', right: 8, bottom: 100, zIndex: 2, display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>
        {['❤️', '💬', '➦', '⊕'].map(icon => (
          <div key={icon} style={{ textAlign: 'center' }}>
            <span style={{ fontSize: 20 }}>{icon}</span>
            <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.8)', marginTop: 2 }}>12K</div>
          </div>
        ))}
      </div>
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 70, background: 'linear-gradient(180deg, transparent, rgba(0,0,0,0.8))', display: 'flex', alignItems: 'center', padding: '0 10px', gap: 8, zIndex: 2 }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#fe2c55', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>B</div>
        <div>
          <div style={{ fontSize: 10, color: '#fff', fontWeight: 700 }}>@yourbrand</div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)' }}>Sponsored</div>
        </div>
      </div>
    </div>
  );
}

function GoogleMockup({ headline, body, cta }: { headline: string; body: string; cta: string }) {
  return (
    <div style={{ maxWidth: 400, background: '#fff', borderRadius: 8, border: '1px solid #e5e7eb', padding: 16, fontFamily: 'Arial, sans-serif', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <div style={{ width: 16, height: 16, borderRadius: 2, background: '#1a73e8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 9, color: '#fff', fontWeight: 900 }}>Ad</span>
        </div>
        <span style={{ fontSize: 12, color: '#006621' }}>yourbrand.com</span>
      </div>
      <a style={{ fontSize: 18, color: '#1558d6', fontWeight: 400, cursor: 'pointer', textDecoration: 'none', display: 'block', marginBottom: 4 }}>
        {headline.slice(0, 60)}
      </a>
      <p style={{ fontSize: 13, color: '#4d5156', margin: 0, lineHeight: 1.5 }}>
        {body.slice(0, 120)} · {cta || 'Learn more'}
      </p>
      <div style={{ marginTop: 10, display: 'flex', gap: 10 }}>
        {['⭐ 4.8', '📍 Available Now', '💰 Free Trial'].map(tag => (
          <span key={tag} style={{ fontSize: 11, color: '#70757a', border: '1px solid #dadce0', borderRadius: 4, padding: '2px 6px' }}>{tag}</span>
        ))}
      </div>
    </div>
  );
}

function CarouselMockup({ slides }: { slides: { headline: string; body: string; cta: string }[] }) {
  const [active, setActive] = useState(0);
  const slide = slides[active] ?? slides[0];
  return (
    <div style={{ maxWidth: 360, fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.1)' }}>
        <div style={{ height: 200, background: `linear-gradient(135deg, hsl(${active * 30},70%,50%) 0%, hsl(${active * 30 + 60},60%,40%) 100%)`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20, textAlign: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', marginBottom: 6, lineHeight: 1.3 }}>{slide?.headline || `Slide ${active + 1}`}</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)', lineHeight: 1.4 }}>{slide?.body?.slice(0, 80)}</div>
        </div>
        <div style={{ padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f3f4f6' }}>
          <span style={{ fontSize: 12, color: '#6b7280' }}>Slide {active + 1} of {slides.length}</span>
          <button style={{ padding: '5px 14px', borderRadius: 6, background: '#1877f2', border: 'none', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'default' }}>
            {slide?.cta || 'Learn More'}
          </button>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 10 }}>
        {slides.map((_, i) => (
          <button key={i} onClick={() => setActive(i)}
            style={{ width: i === active ? 20 : 8, height: 8, borderRadius: 4, border: 'none', cursor: 'pointer', transition: 'all 0.2s', background: i === active ? '#1877f2' : '#d1d5db' }} />
        ))}
      </div>
    </div>
  );
}

function VideoMockup({ scenes, duration }: { scenes: { voiceover: string; on_screen_text: string; duration_seconds: number }[]; duration: string }) {
  const [scene, setScene] = useState(0);
  const [playing, setPlaying] = useState(false);
  const current = scenes[scene];
  return (
    <div style={{ maxWidth: 360, fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ background: '#000', borderRadius: 12, overflow: 'hidden', aspectRatio: '16/9', position: 'relative', boxShadow: '0 4px 16px rgba(0,0,0,0.3)' }}>
        <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(135deg, hsl(${scene * 40},60%,20%) 0%, hsl(${scene * 40 + 80},50%,15%) 100%)` }} />
        {current && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20, textAlign: 'center', zIndex: 2 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', marginBottom: 8, lineHeight: 1.3, textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
              {current.on_screen_text || `Scene ${scene + 1}`}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', lineHeight: 1.5 }}>
              {current.voiceover?.slice(0, 100)}
            </div>
          </div>
        )}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3 }}>
          <button onClick={() => setPlaying(p => !p)}
            style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', border: '2px solid rgba(255,255,255,0.5)', cursor: 'pointer', backdropFilter: 'blur(4px)', fontSize: 20, color: '#fff' }}>
            {playing ? '⏸' : '▶'}
          </button>
        </div>
        <div style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.6)', borderRadius: 4, padding: '2px 6px', fontSize: 11, color: '#fff', zIndex: 4 }}>{duration}</div>
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 12px 8px', zIndex: 4 }}>
          <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 99, height: 3 }}>
            <div style={{ height: '100%', borderRadius: 99, background: '#fff', width: `${((scene + 1) / scenes.length) * 100}%`, transition: 'width 0.3s' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 9, color: 'rgba(255,255,255,0.6)' }}>
            <span>Scene {scene + 1}/{scenes.length}</span>
            <span>{duration}</span>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 4, marginTop: 8, overflowX: 'auto' }}>
        {scenes.map((_, i) => (
          <button key={i} onClick={() => setScene(i)}
            style={{ minWidth: 40, padding: '4px 0', borderRadius: 4, border: `1px solid ${i === scene ? '#6366f1' : '#e5e7eb'}`, background: i === scene ? '#6366f1' : '#f9fafb', color: i === scene ? '#fff' : '#6b7280', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
            S{i + 1}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Caption Panel ────────────────────────────────────────────────────────────

function CaptionPanel({ caption, onRegenerate, loading }: { caption: AdCopyResult; onRegenerate: () => void; loading: boolean }) {
  const [text, setText] = useState(caption.body);
  useEffect(() => { setText(caption.body); }, [caption.body]);

  function copy() {
    navigator.clipboard.writeText(`${caption.headline}\n\n${text}\n\n${caption.cta}\n\n${caption.hashtags?.join(' ')}`);
  }

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 16, marginTop: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div className="section-label">✍️ Caption</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onRegenerate} disabled={loading}
            style={{ fontSize: 11, padding: '4px 10px', borderRadius: 5, border: '1px solid var(--border)', background: 'transparent', color: 'var(--sub)', cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
            {loading ? '…' : '↺ Regenerate'}
          </button>
          <button onClick={copy}
            style={{ fontSize: 11, padding: '4px 10px', borderRadius: 5, border: '1px solid var(--indigo)', background: 'transparent', color: 'var(--indigo-l)', cursor: 'pointer', fontFamily: 'inherit' }}>
            Copy
          </button>
        </div>
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>{caption.headline}</div>
      <textarea value={text} onChange={e => setText(e.target.value)} rows={3}
        style={{ width: '100%', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 10px', color: 'var(--text)', fontSize: 12, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }} />
      <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, background: 'rgba(99,102,241,0.1)', color: 'var(--indigo-l)', fontWeight: 600 }}>{caption.cta}</span>
        {caption.hashtags?.slice(0, 4).map(h => (
          <span key={h} style={{ fontSize: 11, color: 'var(--muted)' }}>{h}</span>
        ))}
      </div>
    </div>
  );
}

// ─── Inner component (uses useSearchParams) ───────────────────────────────────

function CreatePageInner() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  // ── Mode ──────────────────────────────────────────────────────────────────
  const [mode, setMode] = useState<Mode>(() => {
    const p = searchParams.get('mode');
    return p === 'campaign' ? 'campaign' : 'quick';
  });

  // ── Role / admin gate ─────────────────────────────────────────────────────
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null); // null = loading

  useEffect(() => {
    getMe()
      .then(me => setIsAdmin(me.role === 'admin'))
      .catch(() => setIsAdmin(false));
  }, []);

  // ── Shared state ──────────────────────────────────────────────────────────
  const [brief,    setBrief]    = useState('');
  const [platform, setPlatform] = useState<AdPlatform>('meta');
  const [goal,     setGoal]     = useState<RunGoal>('conversion');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  // ── Quick mode state ──────────────────────────────────────────────────────
  // Default to carousel if not admin (video is locked)
  const [format, setFormat] = useState<AdFormat>(() => 'carousel');
  const [videoLength,     setVideoLength]     = useState('30s');
  const [carouselSlides,  setCarouselSlides]  = useState(7);
  const [tone,            setTone]            = useState<AdTone>('bold');
  const [videoCreative,   setVideoCreative]   = useState<VideoCreative | null>(null);
  const [carouselCreative,setCarouselCreative]= useState<CarouselCreative | null>(null);
  const [bannerCreative,  setBannerCreative]  = useState<BannerCreative | null>(null);
  const [captionResult,   setCaptionResult]   = useState<AdCopyResult | null>(null);
  const [runResult,       setRunResult]       = useState<RunResult | null>(null);
  const [genCaption,      setGenCaption]      = useState(false);
  const [previewReady,    setPreviewReady]    = useState(false);

  // ── Campaign mode state ───────────────────────────────────────────────────
  const [selectedAssets,    setSelectedAssets]    = useState<AdFormat[]>(['carousel']);
  const [campaignResults,   setCampaignResults]   = useState<CampaignAssetResult[]>([]);
  const [generationStep,    setGenerationStep]    = useState('');

  function toggleAsset(f: AdFormat) {
    setSelectedAssets(prev =>
      prev.includes(f)
        ? prev.filter(a => a !== f)
        : [...prev, f]
    );
  }

  // ── Quick generate ────────────────────────────────────────────────────────
  async function handleQuickGenerate() {
    if (!brief.trim() || loading) return;
    setError(null);
    setLoading(true);
    setVideoCreative(null);
    setCarouselCreative(null);
    setBannerCreative(null);
    setCaptionResult(null);
    setRunResult(null);
    setPreviewReady(false);

    try {
      const result = await runCampaign({
        mode:     'quick',
        brief:    brief.trim(),
        format,
        platform,
        goal,
        ...(format === 'video'    && { durationTier: videoLength }),
        ...(format === 'carousel' && { slideCount: carouselSlides }),
        ...(format === 'banner'   && { sizes: ['1200x628', '1080x1080', '1080x1920'] }),
      });
      setRunResult(result);
      saveRunResult(result, brief.trim(), format);

      if (format === 'video') {
        const videos = await getVideosByCampaign(result.campaignId).catch(() => []);
        if (videos.length) setVideoCreative(videos[0]);
      } else if (format === 'carousel') {
        const carousels = await getCarouselsByCampaign(result.campaignId).catch(() => []);
        if (carousels.length) setCarouselCreative(carousels[0]);
      } else {
        const banners = await getBannersByCampaign(result.campaignId).catch(() => []);
        if (banners.length) setBannerCreative(banners[0]);
      }

      const topAngle = result.angles?.[0];
      if (topAngle) {
        const captionInput: AdCopyInput = {
          campaignId:  result.campaignId,
          angleSlug:   topAngle.slug,
          coreMessage: brief.trim(),
          platform,
          format,
          tone,
        };
        const cap = await generateAdCopy(captionInput).catch(() => null) as AdCopyResult | null;
        if (cap) setCaptionResult(cap);
      }
      setPreviewReady(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed — check backend connection');
    } finally {
      setLoading(false);
    }
  }

  async function handleRegenerateCaption() {
    if (!runResult || genCaption) return;
    setGenCaption(true);
    const topAngle = runResult.angles?.[0];
    if (topAngle) {
      const cap = await generateAdCopy({
        campaignId:  runResult.campaignId,
        angleSlug:   topAngle.slug,
        coreMessage: brief.trim(),
        platform,
        format,
        tone,
      }).catch(() => null) as AdCopyResult | null;
      if (cap) setCaptionResult(cap);
    }
    setGenCaption(false);
  }

  // ── Campaign generate ─────────────────────────────────────────────────────
  async function handleCampaignGenerate() {
    if (!brief.trim() || loading || selectedAssets.length === 0) return;
    setError(null);
    setLoading(true);
    setCampaignResults([]);

    let sharedCampaignId: string | undefined;
    const results: CampaignAssetResult[] = [];

    try {
      for (const assetFormat of selectedAssets) {
        setGenerationStep(`Generating ${assetFormat}…`);

        const result = await runCampaign({
          mode:       'campaign',
          brief:      brief.trim(),
          format:     assetFormat as RunFormat,
          platform,
          goal,
          assets:     selectedAssets,
          ...(sharedCampaignId && { campaignId: sharedCampaignId }),
          ...(assetFormat === 'video'    && { durationTier: videoLength }),
          ...(assetFormat === 'carousel' && { slideCount: carouselSlides }),
          ...(assetFormat === 'banner'   && { sizes: ['1200x628', '1080x1080'] }),
        });

        if (!sharedCampaignId) {
          sharedCampaignId = result.campaignId;
          saveRunResult(result, brief.trim(), assetFormat as RunFormat);
        }

        const entry: CampaignAssetResult = { format: assetFormat, result };

        if (assetFormat === 'video') {
          const videos = await getVideosByCampaign(result.campaignId).catch(() => []);
          if (videos.length) entry.video = videos[0];
        } else if (assetFormat === 'carousel') {
          const carousels = await getCarouselsByCampaign(result.campaignId).catch(() => []);
          if (carousels.length) entry.carousel = carousels[0];
        } else {
          const banners = await getBannersByCampaign(result.campaignId).catch(() => []);
          if (banners.length) entry.banner = banners[0];
        }

        const topAngle = result.angles?.[0];
        if (topAngle) {
          const cap = await generateAdCopy({
            campaignId:  result.campaignId,
            angleSlug:   topAngle.slug,
            coreMessage: brief.trim(),
            platform,
            format:      assetFormat,
            tone:        'bold',
          }).catch(() => null) as AdCopyResult | null;
          if (cap) entry.caption = cap;
        }

        results.push(entry);
        setCampaignResults([...results]);
      }

      // Redirect to the result page of the first (primary) run
      if (results[0]) {
        router.push(`/result/${results[0].result.executionId}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed — check backend connection');
    } finally {
      setLoading(false);
      setGenerationStep('');
    }
  }

  const hasQuickResult = previewReady && (videoCreative || carouselCreative || bannerCreative);

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
                  color: mode === m ? '#fff' : 'var(--sub)' }}>
                {m === 'quick' ? '⚡ Quick Ad' : '📋 Campaign'}
              </button>
            ))}
          </div>
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>
            {mode === 'quick' ? 'Single asset, instant preview, no campaign overhead' : 'Full pipeline — concept → angles → multiple formats → result page'}
          </span>
          {runResult && mode === 'quick' && (
            <a href={`/result/${runResult.executionId}`}
              style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--indigo-l)', textDecoration: 'none', border: '1px solid var(--indigo)', borderRadius: 5, padding: '3px 10px' }}>
              Full Editor →
            </a>
          )}
        </div>

        <div className="page-content">

          {/* ── QUICK MODE ────────────────────────────────────────────────── */}
          {mode === 'quick' && (
            <div style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: 32, alignItems: 'start' }}>

              {/* Controls */}
              <div style={{ maxWidth: 400 }}>
                <div className="new-campaign-badge" style={{ marginBottom: 6 }}>⚡ Quick Ad Mode</div>
                <h1 className="new-campaign-title" style={{ fontSize: 22, marginBottom: 6 }}>One brief. One ad. Instantly.</h1>
                <p className="new-campaign-sub" style={{ fontSize: 13, marginBottom: 24 }}>
                  Pick a format, set your goal, write your brief — preview renders live.
                </p>

                {/* Format */}
                <div style={{ marginBottom: 20 }}>
                  <div className="form-label">Ad Format</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                    {([['video', '▶', 'Video'], ['carousel', '⊞', 'Carousel'], ['banner', '⬜', 'Banner']] as [AdFormat, string, string][]).map(([id, icon, label]) => {
                      const videoLocked = id === 'video' && !isAdmin;
                      return (
                        <button key={id}
                          onClick={() => { if (!videoLocked) setFormat(id); }}
                          disabled={loading || videoLocked}
                          className={`format-btn${!videoLocked && format === id ? ' active' : ''}`}
                          style={{ flexDirection: 'column', gap: 4, padding: '12px 8px', opacity: videoLocked ? 0.6 : 1, cursor: videoLocked ? 'not-allowed' : 'pointer', position: 'relative' }}>
                          <span style={{ fontSize: 20 }}>{videoLocked ? '🔒' : icon}</span>
                          <span>{label}</span>
                          {videoLocked && (
                            <span style={{ position: 'absolute', bottom: 4, left: 0, right: 0, fontSize: 8, color: 'var(--amber)', fontWeight: 700, letterSpacing: '0.05em', textAlign: 'center' }}>
                              COMING SOON
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
                    {([['meta', '📘', 'Meta'], ['tiktok', '🎵', 'TikTok'], ['google', '🔍', 'Google']] as [AdPlatform, string, string][]).map(([id, icon, label]) => (
                      <button key={id} onClick={() => setPlatform(id)} disabled={loading}
                        className={`format-btn${platform === id ? ' active' : ''}`} style={{ flex: 1 }}>
                        {icon} {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Video length */}
                {format === 'video' && (
                  <div style={{ marginBottom: 20 }}>
                    <div className="form-label">Video Length</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {['5s','8s','10s','15s','30s','60s','75s','90s'].map(d => (
                        <button key={d} onClick={() => setVideoLength(d)} disabled={loading}
                          style={{ padding: '6px 14px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                            background: videoLength === d ? 'var(--accent)' : 'var(--surface2)',
                            border: `1px solid ${videoLength === d ? 'var(--accent)' : 'var(--border2)'}`,
                            color: videoLength === d ? '#fff' : 'var(--sub)' }}>
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Carousel slides */}
                {format === 'carousel' && (
                  <div style={{ marginBottom: 20 }}>
                    <div className="form-label">Slides: <strong style={{ color: 'var(--text)', textTransform: 'none', letterSpacing: 0 }}>{carouselSlides}</strong></div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {[5,6,7,8,9,10].map(n => (
                        <button key={n} onClick={() => setCarouselSlides(n)} disabled={loading}
                          style={{ padding: '6px 14px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                            background: carouselSlides === n ? 'var(--accent)' : 'var(--surface2)',
                            border: `1px solid ${carouselSlides === n ? 'var(--accent)' : 'var(--border2)'}`,
                            color: carouselSlides === n ? '#fff' : 'var(--sub)' }}>
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Goal */}
                <div style={{ marginBottom: 20 }}>
                  <div className="form-label">Goal</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {([['conversion', 'Drive Sales'], ['awareness', 'Build Awareness'], ['engagement', 'Boost Engagement']] as [RunGoal, string][]).map(([id, label]) => (
                      <button key={id} onClick={() => setGoal(id)} disabled={loading}
                        className={`format-btn${goal === id ? ' active' : ''}`} style={{ flex: 1 }}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Brief */}
                <div style={{ marginBottom: 20 }}>
                  <div className="form-label">Brief</div>
                  <textarea className="form-input" value={brief} onChange={e => setBrief(e.target.value)} rows={4} disabled={loading}
                    placeholder="Describe your product, audience, and key message…"
                    style={{ resize: 'vertical' }} />
                </div>

                {/* Request preview */}
                <div style={{ marginBottom: 16, padding: '8px 14px', background: 'rgba(0,201,122,0.05)', border: '1px solid rgba(0,201,122,0.15)', borderRadius: 8, fontSize: 11, color: 'var(--muted)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  <span>→ <code style={{ color: 'var(--accent-l)' }}>POST /api/run</code></span>
                  <span>format: <strong style={{ color: 'var(--accent-l)' }}>{format}</strong></span>
                  {format === 'video'    && <span>duration: <strong style={{ color: 'var(--accent-l)' }}>{videoLength}</strong></span>}
                  {format === 'carousel' && <span>slides: <strong style={{ color: 'var(--accent-l)' }}>{carouselSlides}</strong></span>}
                  <span>platform: <strong style={{ color: 'var(--accent-l)' }}>{platform}</strong></span>
                </div>

                {error && (
                  <div className="form-error" style={{ marginBottom: 16 }}>⚠ {error}</div>
                )}

                <button onClick={handleQuickGenerate} disabled={!brief.trim() || loading}
                  className="btn-generate" style={{ width: '100%' }}>
                  {loading
                    ? <><div className="spinner" />Generating…</>
                    : <>⚡ Generate Ad</>}
                </button>
              </div>

              {/* Preview */}
              <div>
                {!hasQuickResult && !loading && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400, color: 'var(--muted)', gap: 12, textAlign: 'center' }}>
                    <div style={{ fontSize: 48, opacity: 0.3 }}>{format === 'video' ? '▶' : format === 'carousel' ? '⊞' : '⬜'}</div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>Your {format} ad preview will appear here</div>
                    <div style={{ fontSize: 12 }}>Fill in the brief and click Generate</div>
                  </div>
                )}

                {loading && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400, gap: 16 }}>
                    <div className="spinner" style={{ width: 32, height: 32 }} />
                    <div style={{ fontSize: 14, color: 'var(--sub)', fontWeight: 600 }}>Running pipeline…</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>Concept → Angles → {format} Creative → Caption</div>
                  </div>
                )}

                {hasQuickResult && !loading && (
                  <div>
                    {/* Mockup */}
                    <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'center' }}>
                      {videoCreative && platform === 'tiktok' && (
                        <TikTokMockup
                          hook={videoCreative.scenes?.[0]?.on_screen_text || ''}
                          body={videoCreative.scenes?.[0]?.voiceover || ''}
                          cta={captionResult?.cta || 'Watch Now'}
                        />
                      )}
                      {videoCreative && platform === 'google' && (
                        <GoogleMockup
                          headline={captionResult?.headline || videoCreative.scenes?.[0]?.on_screen_text || ''}
                          body={captionResult?.body || videoCreative.scenes?.[0]?.voiceover || ''}
                          cta={captionResult?.cta || 'Watch Now'}
                        />
                      )}
                      {videoCreative && platform === 'meta' && (
                        <MetaMockup
                          headline={captionResult?.headline || videoCreative.scenes?.[0]?.on_screen_text || ''}
                          body={captionResult?.body || videoCreative.scenes?.[0]?.voiceover || ''}
                          cta={captionResult?.cta || 'Learn More'}
                          hook={videoCreative.scenes?.[0]?.on_screen_text}
                        />
                      )}
                      {carouselCreative && (
                        <CarouselMockup slides={(carouselCreative.slides ?? []).map((s: CarouselSlide) => ({ headline: s.headline, body: s.body, cta: s.cta }))} />
                      )}
                      {bannerCreative && platform === 'meta' && (
                        <MetaMockup
                          headline={captionResult?.headline || bannerCreative.banners?.[0]?.headline || ''}
                          body={captionResult?.body || bannerCreative.banners?.[0]?.subtext || ''}
                          cta={bannerCreative.banners?.[0]?.cta || 'Learn More'}
                        />
                      )}
                      {bannerCreative && platform === 'google' && (
                        <GoogleMockup
                          headline={bannerCreative.banners?.[0]?.headline || ''}
                          body={bannerCreative.banners?.[0]?.subtext || ''}
                          cta={bannerCreative.banners?.[0]?.cta || 'Learn More'}
                        />
                      )}
                      {bannerCreative && platform === 'tiktok' && (
                        <TikTokMockup
                          hook={bannerCreative.banners?.[0]?.headline || ''}
                          body={bannerCreative.banners?.[0]?.subtext || ''}
                          cta={bannerCreative.banners?.[0]?.cta || 'Shop Now'}
                        />
                      )}
                    </div>

                    {/* Video navigator */}
                    {videoCreative && (
                      <VideoMockup
                        scenes={videoCreative.scenes || []}
                        duration={videoLength}
                      />
                    )}

                    {/* Caption */}
                    {captionResult && (
                      <CaptionPanel caption={captionResult} onRegenerate={handleRegenerateCaption} loading={genCaption} />
                    )}

                    {/* Score chip */}
                    {runResult?.winner && (
                      <div style={{ marginTop: 12, padding: '6px 12px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 6, fontSize: 11, color: '#10b981', display: 'flex', gap: 12 }}>
                        <span>Winner score: <strong>{(runResult.winner.totalScore * 100).toFixed(0)}%</strong></span>
                        <span>Angle: <strong>{runResult.winner.angleSlug}</strong></span>
                        <a href={`/result/${runResult.executionId}`} style={{ marginLeft: 'auto', color: 'var(--indigo-l)', textDecoration: 'none' }}>Full campaign →</a>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── CAMPAIGN MODE ─────────────────────────────────────────────── */}
          {mode === 'campaign' && (
            <div className="new-campaign-wrap" style={{ maxWidth: 680 }}>
              <div className="new-campaign-badge">📋 Campaign Mode</div>
              <h1 className="new-campaign-title">One idea. Endless creatives.</h1>
              <p className="new-campaign-sub">
                Describe your product — AI handles concept, angles, and all selected ad formats.
              </p>

              {/* Brief */}
              <div style={{ marginBottom: 20 }}>
                <div className="form-label">Campaign Brief</div>
                <textarea className="form-input" rows={5}
                  placeholder="e.g. A fitness app that creates personalised workout plans using AI — targeting busy professionals who have 20 minutes a day."
                  value={brief} onChange={e => setBrief(e.target.value)} disabled={loading} />
              </div>

              {/* Platform */}
              <div style={{ marginBottom: 16 }}>
                <div className="form-label">Platform</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {([['meta', '📘', 'Meta'], ['tiktok', '🎵', 'TikTok'], ['google', '🔍', 'Google']] as [AdPlatform, string, string][]).map(([id, icon, label]) => (
                    <button key={id} onClick={() => setPlatform(id)} disabled={loading}
                      className={`format-btn${platform === id ? ' active' : ''}`} style={{ flex: 1 }}>
                      {icon} {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Asset selection */}
              <div style={{ marginBottom: 20 }}>
                <div className="form-label">Assets to Generate</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {([
                    ['video',    '▶',  'Video',    'High engagement, storytelling, brand recall'],
                    ['carousel', '⊞',  'Carousel', 'Multi-slide, educational, product features'],
                    ['banner',   '⬜', 'Banner',   'Retargeting, display network, brand awareness'],
                  ] as [AdFormat, string, string, string][]).map(([id, icon, label, desc]) => {
                    const videoLocked = id === 'video' && !isAdmin;
                    const checked     = selectedAssets.includes(id);
                    return (
                      <label key={id}
                        onClick={e => { if (videoLocked) e.preventDefault(); }}
                        style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px', borderRadius: 10, transition: 'all 0.15s',
                          cursor: videoLocked ? 'not-allowed' : 'pointer',
                          opacity: videoLocked ? 0.65 : 1,
                          background: videoLocked ? 'var(--surface-2)' : checked ? 'rgba(99,102,241,0.06)' : 'var(--surface)',
                          border: `1.5px solid ${videoLocked ? 'var(--border)' : checked ? 'var(--indigo)' : 'var(--border)'}` }}>
                        <input type="checkbox" checked={checked && !videoLocked}
                          onChange={() => { if (!videoLocked) toggleAsset(id); }}
                          disabled={loading || videoLocked}
                          style={{ width: 16, height: 16, accentColor: 'var(--indigo)', cursor: videoLocked ? 'not-allowed' : 'pointer' }} />
                        <span style={{ fontSize: 20 }}>{videoLocked ? '🔒' : icon}</span>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: videoLocked ? 'var(--muted)' : checked ? 'var(--text)' : 'var(--sub)' }}>{label}</div>
                          <div style={{ fontSize: 11, color: 'var(--muted)' }}>{videoLocked ? 'Coming soon — available to admins only' : desc}</div>
                        </div>
                        {videoLocked && (
                          <span style={{ marginLeft: 'auto', fontSize: 9, padding: '2px 8px', borderRadius: 4, background: 'rgba(245,158,11,0.1)', color: 'var(--amber)', fontWeight: 700, letterSpacing: '0.05em' }}>COMING SOON</span>
                        )}
                        {checked && !videoLocked && (
                          <span style={{ marginLeft: 'auto', fontSize: 10, padding: '2px 8px', borderRadius: 4, background: 'rgba(99,102,241,0.12)', color: 'var(--indigo-l)', fontWeight: 700 }}>Selected</span>
                        )}
                      </label>
                    );
                  })}
                </div>
                {selectedAssets.length === 0 && (
                  <div style={{ fontSize: 11, color: 'var(--rose)', marginTop: 6 }}>Select at least one asset format to continue.</div>
                )}
              </div>

              {/* Video length (if video selected) */}
              {selectedAssets.includes('video') && (
                <div style={{ marginBottom: 16 }}>
                  <div className="form-label">Video Length</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {['5s','8s','10s','15s','30s','60s','75s','90s'].map(d => (
                      <button key={d} onClick={() => setVideoLength(d)} disabled={loading}
                        style={{ padding: '6px 14px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                          background: videoLength === d ? 'var(--indigo)' : 'var(--surface)',
                          border: `1px solid ${videoLength === d ? 'var(--indigo)' : 'var(--border)'}`,
                          color: videoLength === d ? '#fff' : 'var(--sub)' }}>
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Carousel slides (if carousel selected) */}
              {selectedAssets.includes('carousel') && (
                <div style={{ marginBottom: 16 }}>
                  <div className="form-label">Carousel Slides: <strong style={{ color: 'var(--text)' }}>{carouselSlides}</strong></div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {[5,6,7,8,9,10].map(n => (
                      <button key={n} onClick={() => setCarouselSlides(n)} disabled={loading}
                        style={{ padding: '6px 14px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                          background: carouselSlides === n ? 'var(--indigo)' : 'var(--surface)',
                          border: `1px solid ${carouselSlides === n ? 'var(--indigo)' : 'var(--border)'}`,
                          color: carouselSlides === n ? '#fff' : 'var(--sub)' }}>
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Goal */}
              <div style={{ marginBottom: 28 }}>
                <div className="form-label">Goal</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {([['conversion', 'Drive Sales'], ['awareness', 'Build Awareness'], ['engagement', 'Boost Engagement']] as [RunGoal, string][]).map(([id, label]) => (
                    <button key={id} onClick={() => setGoal(id)} disabled={loading}
                      className={`format-btn${goal === id ? ' active' : ''}`} style={{ flex: 1 }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Request preview */}
              <div style={{ marginBottom: 16, padding: '8px 14px', background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 8, fontSize: 11, color: 'var(--muted)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <span>Assets: <strong style={{ color: 'var(--indigo-l)' }}>{selectedAssets.join(' + ') || 'none'}</strong></span>
                <span>Platform: <strong style={{ color: 'var(--indigo-l)' }}>{platform}</strong></span>
                {selectedAssets.includes('video')    && <span>Duration: <strong style={{ color: 'var(--indigo-l)' }}>{videoLength}</strong></span>}
                {selectedAssets.includes('carousel') && <span>Slides: <strong style={{ color: 'var(--indigo-l)' }}>{carouselSlides}</strong></span>}
                <span>Goal: <strong style={{ color: 'var(--indigo-l)' }}>{goal}</strong></span>
              </div>

              {/* Progress */}
              {loading && generationStep && (
                <div style={{ marginBottom: 16, padding: '8px 14px', background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8, fontSize: 12, color: '#10b981', display: 'flex', gap: 10, alignItems: 'center' }}>
                  <div className="spinner" />
                  {generationStep}
                  {selectedAssets.length > 1 && (
                    <span style={{ marginLeft: 4, color: 'var(--muted)' }}>
                      ({campaignResults.length + 1}/{selectedAssets.length})
                    </span>
                  )}
                </div>
              )}

              {error && (
                <div className="form-error" style={{ marginBottom: 16 }}>⚠ {error}</div>
              )}

              <button className="btn-generate" onClick={handleCampaignGenerate}
                disabled={!brief.trim() || loading || selectedAssets.length === 0}>
                {loading
                  ? <><div className="spinner" />Generating {selectedAssets.length > 1 ? `${selectedAssets.length} assets` : selectedAssets[0]}…</>
                  : <>✦ Generate Campaign ↗</>}
              </button>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
                <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0 }}>
                  ~{selectedAssets.length * 8}s · {brief.length} characters
                </p>
                <button onClick={() => setMode('quick')}
                  style={{ fontSize: 12, color: 'var(--indigo-l)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  Switch to Quick Ad →
                </button>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}

// ─── Page export (wrapped in Suspense for useSearchParams) ────────────────────

export default function CreatePage() {
  return (
    <Suspense>
      <CreatePageInner />
    </Suspense>
  );
}
