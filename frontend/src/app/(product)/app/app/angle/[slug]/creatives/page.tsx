'use client';
// ─── Angle → Full Creatives Gallery ──────────────────────────────────────────

import { useEffect, useState, useRef } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import {
  generateVideo, generateCarousel, generateBanner,
  generateVideoImages, generateCarouselImages, generateBannerImages,
} from '@/lib/api/creator-client';
import type { SceneImage, SlideImage, BannerImage } from '@/lib/api/creator-client';
import type {
  VideoCreative, VideoScene,
  CarouselCreative, CarouselSlide,
  BannerCreative, BannerItem,
} from '@/lib/types/creator';

type Tab = 'video' | 'carousel' | 'banners';

export default function CreativesPage() {
  const { slug }       = useParams<{ slug: string }>();
  const searchParams   = useSearchParams();
  const conceptId      = searchParams.get('conceptId')  ?? '';
  const campaignId     = searchParams.get('campaignId') ?? '';
  const angleSlug      = decodeURIComponent(slug);

  // creatives state
  const [video,     setVideo]     = useState<VideoCreative    | null>(null);
  const [carousel,  setCarousel]  = useState<CarouselCreative | null>(null);
  const [banners,   setBanners]   = useState<BannerCreative   | null>(null);
  const [vidErr,    setVidErr]    = useState<string | null>(null);
  const [carErr,    setCarErr]    = useState<string | null>(null);
  const [banErr,    setBanErr]    = useState<string | null>(null);

  // image state
  const [sceneImgs,  setSceneImgs]  = useState<Record<number, string | null>>({});
  const [slideImgs,  setSlideImgs]  = useState<Record<number, string | null>>({});
  const [bannerImgs, setBannerImgs] = useState<Record<number, string | null>>({});

  const [tab,   setTab]   = useState<Tab>('video');
  const started = useRef(false);

  useEffect(() => {
    if (started.current || !conceptId || !campaignId) return;
    started.current = true;

    // Phase 1: generate all text creatives in parallel
    const vidP = generateVideo({ campaignId, conceptId, angleSlug, durationTier: '60s' })
      .then(v => { setVideo(v); return v; })
      .catch(e => { setVidErr((e as Error).message); return null; });

    const carP = generateCarousel({ campaignId, conceptId, angleSlug, slideCount: 6 })
      .then(c => { setCarousel(c); return c; })
      .catch(e => { setCarErr((e as Error).message); return null; });

    const banP = generateBanner({ campaignId, conceptId, angleSlug, sizes: ['1080x1080', '1200x628', '160x600'] })
      .then(b => { setBanners(b); return b; })
      .catch(e => { setBanErr((e as Error).message); return null; });

    // Phase 2: generate images as soon as each creative resolves
    vidP.then(v => {
      if (!v) return;
      generateVideoImages(v.creativeId)
        .then(({ images }) => {
          images.forEach(img => {
            if (img.imageUrl) {
              setSceneImgs(prev => ({ ...prev, [img.sceneNumber]: img.imageUrl }));
            }
          });
        })
        .catch(() => {}); // silent
    });

    carP.then(c => {
      if (!c) return;
      generateCarouselImages(c.creativeId)
        .then(({ images }) => {
          images.forEach(img => {
            if (img.imageUrl) {
              setSlideImgs(prev => ({ ...prev, [img.slideNumber]: img.imageUrl }));
            }
          });
        })
        .catch(() => {});
    });

    banP.then(b => {
      if (!b) return;
      generateBannerImages(b.creativeId)
        .then(({ images }) => {
          images.forEach(img => {
            if (img.imageUrl) {
              setBannerImgs(prev => ({ ...prev, [img.bannerIndex]: img.imageUrl }));
            }
          });
        })
        .catch(() => {});
    });
  }, [conceptId, campaignId, angleSlug]);

  const backHref = conceptId
    ? `/app/app/concept/${conceptId}/angles?campaignId=${campaignId}`
    : '/app/app';

  const loading = !video && !carousel && !banners && !vidErr && !carErr && !banErr;

  return (
    <div style={shell}>
      <nav style={nav}>
        <a href={backHref} style={back}>← Angles</a>
        <span style={logo}>Creative OS</span>
        <a href="/app/app" style={{ fontSize: 13, color: '#555', textDecoration: 'none' }}>Dashboard</a>
      </nav>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '48px 24px' }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
            Angle: {angleSlug}
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 6 }}>
            Your Creatives
          </h1>
          <p style={{ color: '#666', fontSize: 14 }}>
            Video script, carousel slides, and display banners — all generated from your angle.
          </p>
        </div>

        {loading && (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <Spinner />
            <p style={{ color: '#555', fontSize: 14, marginTop: 20 }}>Generating video, carousel &amp; banners…</p>
          </div>
        )}

        {!loading && (
          <>
            {/* Tab bar */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 32, background: '#111', borderRadius: 10, padding: 4, width: 'fit-content' }}>
              {(['video', 'carousel', 'banners'] as Tab[]).map(t => (
                <button key={t} onClick={() => setTab(t)} style={{
                  padding: '8px 20px', borderRadius: 8, border: 'none', fontWeight: 600, fontSize: 13,
                  background: tab === t ? '#6366f1' : 'transparent',
                  color: tab === t ? '#fff' : '#666',
                  cursor: 'pointer', transition: 'all 0.15s', textTransform: 'capitalize',
                }}>
                  {t === 'video' ? '🎬 Video' : t === 'carousel' ? '📱 Carousel' : '🖼 Banners'}
                </button>
              ))}
            </div>

            {/* Video tab */}
            {tab === 'video' && (
              <div>
                {vidErr && <ErrBox msg={vidErr} />}
                {video && (
                  <>
                    <div style={{ display: 'flex', gap: 16, marginBottom: 28, flexWrap: 'wrap' }}>
                      <MetaTile label="Duration"   value={video.durationTier} />
                      <MetaTile label="Scenes"     value={String(video.sceneCount)} />
                      <MetaTile label="Hook Score" value={`${video.hookScore}/10${video.hookBoosted ? ' ⚡' : ''}`} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      {video.scenes.map(scene => (
                        <SceneCard key={scene.scene_number} scene={scene} img={sceneImgs[scene.scene_number] ?? null} />
                      ))}
                    </div>
                  </>
                )}
                {!video && !vidErr && <Skeleton />}
              </div>
            )}

            {/* Carousel tab */}
            {tab === 'carousel' && (
              <div>
                {carErr && <ErrBox msg={carErr} />}
                {carousel && (
                  <>
                    <div style={{ display: 'flex', gap: 16, marginBottom: 28, flexWrap: 'wrap' }}>
                      <MetaTile label="Platform"   value={carousel.platform} />
                      <MetaTile label="Slides"     value={String(carousel.slideCount)} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 16 }}>
                      {carousel.slides.map(slide => (
                        <SlideCard key={slide.slide_number} slide={slide} img={slideImgs[slide.slide_number] ?? null} />
                      ))}
                    </div>
                  </>
                )}
                {!carousel && !carErr && <Skeleton />}
              </div>
            )}

            {/* Banners tab */}
            {tab === 'banners' && (
              <div>
                {banErr && <ErrBox msg={banErr} />}
                {banners && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {banners.banners.map((banner, i) => (
                      <BannerCard key={banner.size} banner={banner} img={bannerImgs[i] ?? null} />
                    ))}
                  </div>
                )}
                {!banners && !banErr && <Skeleton />}
              </div>
            )}
          </>
        )}
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:0.5}50%{opacity:1}} @keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ── Scene card ────────────────────────────────────────────────────────────────

function SceneCard({ scene, img }: { scene: VideoScene; img: string | null }) {
  return (
    <div style={{ display: 'flex', gap: 0, background: '#111', border: '1px solid #1e2330', borderRadius: 12, overflow: 'hidden' }}>
      {/* Image panel */}
      <div style={{ width: 200, minHeight: 160, flexShrink: 0, background: '#0a0a12', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        {img ? (
          <img src={img} alt={`Scene ${scene.scene_number}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, opacity: 0.4 }}>
            <span style={{ fontSize: 28 }}>🎬</span>
            <span style={{ fontSize: 11, color: '#555' }}>Generating…</span>
          </div>
        )}
        <div style={{ position: 'absolute', top: 8, left: 8, fontSize: 10, fontWeight: 700, color: '#fff', background: 'rgba(0,0,0,0.6)', padding: '2px 7px', borderRadius: 99 }}>
          {scene.scene_number}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '18px 20px', flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <SceneTag color="#6366f1">{scene.type}</SceneTag>
          <SceneTag color="#f59e0b">{scene.duration_seconds}s</SceneTag>
          {scene.emotion && <SceneTag color="#22c55e">{scene.emotion}</SceneTag>}
        </div>
        {scene.on_screen_text && (
          <div style={{ fontSize: 15, fontWeight: 700, color: '#f0f0f0', lineHeight: 1.3 }}>{scene.on_screen_text}</div>
        )}
        {scene.voiceover && (
          <p style={{ fontSize: 13, color: '#888', lineHeight: 1.6, margin: 0 }}>
            🎙 {scene.voiceover}
          </p>
        )}
        {scene.visual_prompt && (
          <p style={{ fontSize: 11, color: '#555', fontStyle: 'italic', lineHeight: 1.55, margin: 0, borderTop: '1px solid #1e2330', paddingTop: 8 }}>
            Visual: {scene.visual_prompt}
          </p>
        )}
      </div>
    </div>
  );
}

function SceneTag({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 700, color, background: `${color}22`, padding: '2px 8px', borderRadius: 99, textTransform: 'capitalize', letterSpacing: '0.04em' }}>
      {children}
    </span>
  );
}

// ── Slide card ────────────────────────────────────────────────────────────────

function SlideCard({ slide, img }: { slide: CarouselSlide; img: string | null }) {
  return (
    <div style={{ background: '#111', border: '1px solid #1e2330', borderRadius: 12, overflow: 'hidden' }}>
      {/* Square image */}
      <div style={{ aspectRatio: '1/1', background: '#0a0a12', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        {img ? (
          <img src={img} alt={`Slide ${slide.slide_number}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : (
          <span style={{ fontSize: 32, opacity: 0.2 }}>📱</span>
        )}
        <div style={{ position: 'absolute', top: 8, left: 8, fontSize: 10, fontWeight: 700, color: '#fff', background: 'rgba(0,0,0,0.6)', padding: '2px 7px', borderRadius: 99 }}>
          {slide.slide_number}
        </div>
        <div style={{ position: 'absolute', top: 8, right: 8, fontSize: 10, color: '#888', background: 'rgba(0,0,0,0.6)', padding: '2px 7px', borderRadius: 99 }}>
          {slide.type}
        </div>
      </div>
      {/* Copy */}
      <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {slide.hook && (
          <div style={{ fontSize: 12, fontWeight: 700, color: '#6366f1' }}>{slide.hook}</div>
        )}
        <div style={{ fontSize: 14, fontWeight: 700, color: '#f0f0f0', lineHeight: 1.35 }}>{slide.headline}</div>
        {slide.body && (
          <p style={{ fontSize: 12, color: '#888', lineHeight: 1.55, margin: 0 }}>{slide.body}</p>
        )}
        {slide.cta && (
          <div style={{ marginTop: 4, fontSize: 12, fontWeight: 700, color: '#22c55e' }}>{slide.cta} →</div>
        )}
      </div>
    </div>
  );
}

// ── Banner card ───────────────────────────────────────────────────────────────

function BannerCard({ banner, img }: { banner: BannerItem; img: string | null }) {
  return (
    <div style={{ display: 'flex', gap: 0, background: '#111', border: '1px solid #1e2330', borderRadius: 12, overflow: 'hidden' }}>
      {/* Preview */}
      <div style={{ width: 180, flexShrink: 0, background: '#0a0a12', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 130 }}>
        {img ? (
          <img src={img} alt={banner.size} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, opacity: 0.3 }}>
            <span style={{ fontSize: 24 }}>🖼</span>
            <span style={{ fontSize: 10, color: '#555' }}>{banner.size}</span>
          </div>
        )}
      </div>
      {/* Copy */}
      <div style={{ padding: '18px 20px', flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#6366f1', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          {banner.size}
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#f0f0f0', lineHeight: 1.3 }}>{banner.headline}</div>
        {banner.subtext && (
          <p style={{ fontSize: 13, color: '#888', lineHeight: 1.6, margin: 0 }}>{banner.subtext}</p>
        )}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 4 }}>
          {banner.cta && (
            <span style={{ fontSize: 12, fontWeight: 700, color: '#22c55e' }}>{banner.cta}</span>
          )}
          {banner.layout && (
            <span style={{ fontSize: 11, color: '#555' }}>Layout: {banner.layout}</span>
          )}
        </div>
        {banner.visual_direction && (
          <p style={{ fontSize: 11, color: '#555', fontStyle: 'italic', lineHeight: 1.5, margin: 0, borderTop: '1px solid #1e2330', paddingTop: 8 }}>
            {banner.visual_direction}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function MetaTile({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: '#111', border: '1px solid #1e2330', borderRadius: 10, padding: '12px 16px' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: '#c0c0d0', textTransform: 'capitalize' }}>{value}</div>
    </div>
  );
}

function ErrBox({ msg }: { msg: string }) {
  return (
    <div style={{ background: '#1a0a0a', border: '1px solid #3a1010', borderRadius: 10, padding: '16px 18px', color: '#f87171', fontSize: 13, marginBottom: 16 }}>
      ⚠ {msg}
    </div>
  );
}

function Skeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {[1, 2, 3].map(i => (
        <div key={i} style={{ height: 140, borderRadius: 12, background: '#111', animation: 'pulse 1.5s ease-in-out infinite' }} />
      ))}
    </div>
  );
}

function Spinner() {
  return (
    <div style={{ width: 40, height: 40, border: '3px solid #1e2330', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} />
  );
}

const shell: React.CSSProperties = { minHeight: '100vh', background: '#0d0e14', color: '#f0f0f0', fontFamily: 'system-ui, sans-serif' };
const nav:   React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 32px', borderBottom: '1px solid #1e2330' };
const logo:  React.CSSProperties = { fontSize: 13, fontWeight: 800, color: '#6366f1' };
const back:  React.CSSProperties = { fontSize: 13, color: '#555', textDecoration: 'none', width: 80 };
