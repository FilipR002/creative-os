'use client';

/**
 * PreviewStage — right-panel of the /create page.
 *
 * State machine:
 *   idle              → empty state with format icon
 *   generating        → spinner + progress ring (concept/angles phase)
 *   processing        → spinner + progress ring (Kling render phase — video only)
 *   done              → real content; if imagesReady===false shows skeletons + polling banner
 *   error             → error message + retry button
 *
 * Image rendering rules:
 *   - IF imageUrl exists and length > 0  → render <img src={imageUrl} />
 *   - IF imageUrl missing                → render <SkeletonImage /> (pulsing placeholder)
 *   - Gradients and fake visuals are NEVER shown as content fallbacks
 */

import { useState, useEffect } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type PreviewStatus = 'idle' | 'generating' | 'processing' | 'done' | 'error';
export type PreviewFormat = 'video' | 'carousel' | 'image';

export interface SlideData {
  slide_number: number;
  type:         string;
  hook:         string;
  headline:     string;
  body:         string;
  cta:          string;
  imageUrl?:    string;
}

export interface BannerData {
  size:             string;
  headline:         string;
  subtext:          string;
  cta:              string;
  visual_direction: string;
  imageUrl?:        string;
}

export interface PreviewResult {
  // Video
  stitchedVideoUrl?: string;
  sceneVideoUrls?:   string[];
  // Carousel
  slides?:           SlideData[];
  // Banner/image
  banners?:          BannerData[];
  // Shared meta
  angleSlug?:        string;
  score?:            number;
  executionId?:      string;
  /** 'ugc' | 'classic' — set for video; drives badge in preview */
  videoMode?:        'ugc' | 'classic';
  /**
   * false = images are being generated in background; show skeletons + poll indicator.
   * true  = all imageUrls populated.
   * undefined = video (no images) or legacy.
   */
  imagesReady?:      boolean;
}

export interface PreviewStageProps {
  status:     PreviewStatus;
  format:     PreviewFormat;
  progress?:  number;   // 0–100
  result?:    PreviewResult | null;
  error?:     string | null;
  /** Passed through for the video processing spinner label and done badge */
  videoMode?: 'ugc' | 'classic';
  onRetry?:       () => void;
  onDownload?:    () => void;
  onRegenerate?:  () => void;
  onNewAngle?:    () => void;
}

// ─── Lightbox ─────────────────────────────────────────────────────────────────

function Lightbox({ src, label, onClose }: { src: string; label?: string; onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.92)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: 24,
        backdropFilter: 'blur(6px)',
      }}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        style={{
          position: 'absolute', top: 20, right: 24,
          background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: '50%', width: 36, height: 36,
          color: '#fff', fontSize: 18, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          lineHeight: 1,
        }}
      >
        ×
      </button>

      {/* Image */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: '90vw', maxHeight: '85vh',
          borderRadius: 12, overflow: 'hidden',
          boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={label ?? 'Preview'}
          style={{ display: 'block', maxWidth: '90vw', maxHeight: '82vh', objectFit: 'contain' }}
        />
      </div>

      {/* Label */}
      {label && (
        <div style={{
          marginTop: 14, fontSize: 12, color: 'rgba(255,255,255,0.45)',
          fontWeight: 500, letterSpacing: '0.04em',
        }}>
          {label}
        </div>
      )}
      <div style={{ marginTop: 6, fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>
        Press ESC or click outside to close
      </div>
    </div>
  );
}

// ─── Skeleton image ───────────────────────────────────────────────────────────

function SkeletonImage({ height = 240, label = 'Rendering image…' }: { height?: number; label?: string }) {
  return (
    <div style={{
      height,
      display:         'flex',
      alignItems:      'center',
      justifyContent:  'center',
      flexDirection:   'column',
      gap:             8,
      background:      'var(--surface-2)',
      borderBottom:    '1px solid var(--border)',
    }}>
      {/* Pulsing ring */}
      <div style={{
        width:        32,
        height:       32,
        borderRadius: '50%',
        border:       '3px solid var(--border)',
        borderTopColor: 'var(--accent)',
        animation:    'spin 1s linear infinite',
      }} />
      <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500 }}>{label}</span>
    </div>
  );
}

// ─── Video player ─────────────────────────────────────────────────────────────

function VideoPlayer({ url }: { url: string }) {
  return (
    <div style={{ width: '100%', borderRadius: 12, overflow: 'hidden', background: '#000', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
      <video
        controls
        playsInline
        style={{ width: '100%', display: 'block', maxHeight: 480 }}
        src={url}
      >
        Your browser does not support the video tag.
      </video>
    </div>
  );
}

// ─── Carousel preview ─────────────────────────────────────────────────────────

function CarouselPreview({ slides, imagesReady }: { slides: SlideData[]; imagesReady?: boolean }) {
  const [active,   setActive]   = useState(0);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const slide = slides[active];
  if (!slide) return null;

  const hasImage = slide.imageUrl && slide.imageUrl.length > 0;

  return (
    <div style={{ width: '100%', maxWidth: 440, margin: '0 auto' }}>
      {/* Image-loading banner */}
      {imagesReady === false && (
        <div style={{
          display:        'flex',
          alignItems:     'center',
          gap:            8,
          padding:        '7px 14px',
          marginBottom:   12,
          background:     'rgba(99,102,241,0.06)',
          border:         '1px solid rgba(99,102,241,0.18)',
          borderRadius:   8,
          fontSize:       11,
          color:          'var(--indigo-l)',
          fontWeight:     600,
        }}>
          <div style={{
            width:        10,
            height:       10,
            borderRadius: '50%',
            border:       '2px solid var(--indigo)',
            borderTopColor: 'transparent',
            animation:    'spin 0.8s linear infinite',
            flexShrink:   0,
          }} />
          Rendering visuals with Imagen 4…
        </div>
      )}

      {/* Card */}
      <div style={{
        borderRadius: 16,
        overflow:     'hidden',
        boxShadow:    '0 8px 32px rgba(0,0,0,0.25)',
        border:       '1px solid var(--border)',
        background:   'var(--surface)',
      }}>
        {/* Image zone — real image or skeleton */}
        {hasImage ? (
          <div
            onClick={() => setLightbox(slide.imageUrl!)}
            style={{ height: 240, overflow: 'hidden', position: 'relative', cursor: 'zoom-in' }}
          >
            <img
              src={slide.imageUrl!}
              alt={slide.headline}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
            {/* Overlay: type badge + hook */}
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 55%)',
            }} />
            <div style={{
              position: 'absolute', top: 10, right: 10,
              background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)',
              borderRadius: 5, padding: '2px 8px',
              fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.85)',
              textTransform: 'uppercase', letterSpacing: '0.06em',
            }}>
              {slide.type}
            </div>
            {slide.hook && (
              <div style={{
                position: 'absolute', bottom: 12, left: 14, right: 14,
                fontSize: 13, fontWeight: 700, color: '#fff',
                textShadow: '0 1px 6px rgba(0,0,0,0.6)', lineHeight: 1.35,
              }}>
                {slide.hook}
              </div>
            )}
          </div>
        ) : (
          <SkeletonImage height={240} label={`Rendering slide ${active + 1}…`} />
        )}

        {/* Copy zone */}
        <div style={{ padding: '14px 18px' }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', marginBottom: 6, lineHeight: 1.3 }}>
            {slide.headline}
          </div>
          {slide.body && (
            <p style={{ fontSize: 12, color: 'var(--sub)', lineHeight: 1.6, margin: '0 0 10px' }}>
              {slide.body}
            </p>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>
              {active + 1} / {slides.length}
            </span>
            {slide.cta && (
              <span style={{
                padding: '5px 14px', borderRadius: 7, fontSize: 12, fontWeight: 700,
                background: 'var(--accent)', color: '#fff',
              }}>
                {slide.cta}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Dot navigation */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 14 }}>
        {slides.map((_, i) => (
          <button key={i} onClick={() => setActive(i)} style={{
            width: i === active ? 24 : 8, height: 8, borderRadius: 4,
            border: 'none', cursor: 'pointer', transition: 'all 0.2s',
            background: i === active ? 'var(--accent)' : 'var(--border)',
            padding: 0,
          }} />
        ))}
      </div>

      {lightbox && <Lightbox src={lightbox} label={`Slide ${active + 1} — ${slide.headline}`} onClose={() => setLightbox(null)} />}
    </div>
  );
}

// ─── Banner / image preview ───────────────────────────────────────────────────

function BannerPreview({ banners, imagesReady }: { banners: BannerData[]; imagesReady?: boolean }) {
  const [active,   setActive]   = useState(0);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const banner = banners[active];
  if (!banner) return null;

  const hasImage = banner.imageUrl && banner.imageUrl.length > 0;

  return (
    <div style={{ width: '100%', maxWidth: 440, margin: '0 auto' }}>
      {/* Image-loading banner */}
      {imagesReady === false && (
        <div style={{
          display:        'flex',
          alignItems:     'center',
          gap:            8,
          padding:        '7px 14px',
          marginBottom:   12,
          background:     'rgba(99,102,241,0.06)',
          border:         '1px solid rgba(99,102,241,0.18)',
          borderRadius:   8,
          fontSize:       11,
          color:          'var(--indigo-l)',
          fontWeight:     600,
        }}>
          <div style={{
            width:        10,
            height:       10,
            borderRadius: '50%',
            border:       '2px solid var(--indigo)',
            borderTopColor: 'transparent',
            animation:    'spin 0.8s linear infinite',
            flexShrink:   0,
          }} />
          Rendering visuals with Imagen 4…
        </div>
      )}

      {/* Size tabs */}
      {banners.length > 1 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
          {banners.map((b, i) => (
            <button key={i} onClick={() => setActive(i)} style={{
              padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
              background: i === active ? 'var(--accent)' : 'var(--surface-2)',
              border:     `1px solid ${i === active ? 'var(--accent)' : 'var(--border)'}`,
              color:      i === active ? '#fff' : 'var(--sub)',
            }}>
              {b.size}
            </button>
          ))}
        </div>
      )}

      {/* Card */}
      <div style={{
        borderRadius: 14,
        overflow:     'hidden',
        border:       '1px solid var(--border)',
        boxShadow:    '0 8px 28px rgba(0,0,0,0.18)',
        background:   'var(--surface)',
      }}>
        {/* Visual zone — real image or skeleton */}
        {hasImage ? (
          <div
            onClick={() => setLightbox(banner.imageUrl!)}
            style={{ height: 220, overflow: 'hidden', position: 'relative', cursor: 'zoom-in' }}
          >
            <img
              src={banner.imageUrl!}
              alt={banner.headline}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
            {/* Dark overlay for text legibility */}
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(to top, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.15) 60%, transparent 100%)',
            }} />
            <div style={{ position: 'absolute', bottom: 18, left: 20, right: 20, zIndex: 2 }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', lineHeight: 1.2, marginBottom: 5, textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>
                {banner.headline}
              </div>
              {banner.subtext && (
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', lineHeight: 1.5 }}>
                  {banner.subtext}
                </div>
              )}
            </div>
          </div>
        ) : (
          <SkeletonImage height={220} label={`Rendering ${banner.size}…`} />
        )}

        {/* CTA bar */}
        <div style={{
          padding: '12px 18px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          borderTop: '1px solid var(--border)',
        }}>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>
            {banner.size} · {banner.visual_direction?.slice(0, 40)}
          </div>
          <button style={{
            padding: '7px 18px', borderRadius: 7, fontSize: 12, fontWeight: 700,
            background: 'var(--accent)', border: 'none', color: '#fff', cursor: 'default',
          }}>
            {banner.cta}
          </button>
        </div>
      </div>

      {lightbox && <Lightbox src={lightbox} label={`${banner.size} — ${banner.headline}`} onClose={() => setLightbox(null)} />}
    </div>
  );
}

// ─── Progress ring ────────────────────────────────────────────────────────────

function ProgressRing({ pct }: { pct: number }) {
  const r = 28, circ = 2 * Math.PI * r;
  return (
    <svg width={72} height={72} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={36} cy={36} r={r} fill="none" stroke="var(--border)" strokeWidth={5} />
      <circle cx={36} cy={36} r={r} fill="none" stroke="var(--accent)" strokeWidth={5}
        strokeDasharray={`${circ * (pct / 100)} ${circ}`}
        style={{ transition: 'stroke-dasharray 0.4s ease' }} />
    </svg>
  );
}

// ─── Action button ────────────────────────────────────────────────────────────

function ActionBtn({ icon, label, onClick, accent = false }: {
  icon: string; label: string; onClick: () => void; accent?: boolean;
}) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '9px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600,
      cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
      background: accent ? 'var(--accent)' : 'var(--surface-2)',
      border: `1px solid ${accent ? 'var(--accent)' : 'var(--border)'}`,
      color: accent ? '#fff' : 'var(--sub)',
    }}>
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

// ─── Shared layout styles ─────────────────────────────────────────────────────

const stageWrap: React.CSSProperties = {
  display:        'flex',
  alignItems:     'center',
  justifyContent: 'center',
  minHeight:      480,
  borderRadius:   16,
  border:         '1px dashed var(--border)',
  background:     'var(--surface)',
};

const centreStack: React.CSSProperties = {
  display:        'flex',
  flexDirection:  'column',
  alignItems:     'center',
  justifyContent: 'center',
  textAlign:      'center',
  padding:        32,
};

// ─── Main export ──────────────────────────────────────────────────────────────

export function PreviewStage({
  status, format, progress = 0, result, error, videoMode,
  onRetry, onDownload, onRegenerate, onNewAngle,
}: PreviewStageProps) {

  const formatIcon  = format === 'video' ? '▶' : format === 'carousel' ? '⊞' : '⬜';
  const formatLabel = format === 'video' ? 'Video' : format === 'carousel' ? 'Carousel' : 'Image';

  // Resolve active videoMode: prop (during processing) or from result (when done)
  const activeVideoMode = result?.videoMode ?? videoMode;

  // ── IDLE ──────────────────────────────────────────────────────────────────
  if (status === 'idle') {
    return (
      <div style={stageWrap}>
        <div style={centreStack}>
          <div style={{ fontSize: 52, opacity: 0.15, lineHeight: 1 }}>{formatIcon}</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--sub)', marginTop: 12 }}>
            Your {formatLabel} preview will appear here
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
            Fill in the brief and hit Generate
          </div>
        </div>
      </div>
    );
  }

  // ── GENERATING ─────────────────────────────────────────────────────────────
  if (status === 'generating') {
    return (
      <div style={stageWrap}>
        <div style={centreStack}>
          <div style={{ position: 'relative', width: 72, height: 72, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ProgressRing pct={progress} />
            <span style={{ position: 'absolute', fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>
              {progress > 0 ? `${progress}%` : '…'}
            </span>
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginTop: 16 }}>
            Generating your ad…
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
            Concept → Angles → Creative
          </div>
          {progress > 0 && (
            <div style={{ marginTop: 16, width: 240, height: 4, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 99, background: 'var(--accent)', width: `${progress}%`, transition: 'width 0.4s ease' }} />
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── PROCESSING (video Kling render) ────────────────────────────────────────
  if (status === 'processing') {
    return (
      <div style={stageWrap}>
        <div style={centreStack}>
          <div style={{ position: 'relative', width: 72, height: 72, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ProgressRing pct={progress} />
            <span style={{ position: 'absolute', fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>
              {progress > 0 ? `${progress}%` : '…'}
            </span>
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginTop: 16 }}>
            {activeVideoMode === 'classic'
              ? 'Rendering scenes with Veo AI…'
              : 'Rendering scenes with Kling AI…'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
            {activeVideoMode === 'classic'
              ? 'Cinematic pipeline — each scene is rendered individually'
              : 'UGC pipeline — each scene is rendered individually'}
            {' '}— this takes a few minutes
          </div>
          {progress > 0 && (
            <div style={{ marginTop: 16, width: 240, height: 4, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 99, background: 'linear-gradient(90deg, var(--accent), #6366f1)', width: `${progress}%`, transition: 'width 0.4s ease' }} />
            </div>
          )}
          <div style={{ marginTop: 20, fontSize: 11, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }} />
            Polling job status every 3s…
          </div>
        </div>
      </div>
    );
  }

  // ── ERROR ──────────────────────────────────────────────────────────────────
  if (status === 'error') {
    return (
      <div style={stageWrap}>
        <div style={centreStack}>
          <div style={{ fontSize: 36, opacity: 0.5 }}>⚠</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--rose)', marginTop: 12 }}>
            Generation failed
          </div>
          <div style={{
            fontSize: 12, color: 'var(--muted)', marginTop: 8,
            maxWidth: 320, textAlign: 'center', lineHeight: 1.6,
            background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)',
            borderRadius: 8, padding: '10px 14px',
          }}>
            {error ?? 'An unknown error occurred.'}
          </div>
          {onRetry && (
            <button onClick={onRetry} style={{
              marginTop: 16, padding: '8px 24px', borderRadius: 8,
              background: 'var(--surface-2)', border: '1px solid var(--border)',
              color: 'var(--text)', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>
              ↺ Try again
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── DONE ───────────────────────────────────────────────────────────────────
  if (status === 'done' && result) {
    const hasVideo   = !!result.stitchedVideoUrl;
    const hasSlides  = (result.slides?.length  ?? 0) > 0;
    const hasBanners = (result.banners?.length ?? 0) > 0;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

        {/* Score / meta bar */}
        {result.score !== undefined && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16,
            padding: '8px 14px',
            background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)',
            borderRadius: 8, fontSize: 12,
          }}>
            <span style={{ color: '#10b981', fontWeight: 700 }}>
              ✦ Score {(result.score * 100).toFixed(0)}%
            </span>
            {result.angleSlug && (
              <span style={{ color: 'var(--muted)' }}>
                Angle: <strong style={{ color: 'var(--sub)' }}>{result.angleSlug}</strong>
              </span>
            )}
            {result.executionId && (
              <a href={`/result/${result.executionId}`}
                style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--accent)', textDecoration: 'none' }}>
                Full report →
              </a>
            )}
          </div>
        )}

        {/* Video mode badge — UGC or Cinematic */}
        {format === 'video' && activeVideoMode && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            marginBottom: 14, padding: '5px 12px',
            borderRadius: 20, fontSize: 11, fontWeight: 700,
            ...(activeVideoMode === 'ugc'
              ? { background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)', color: '#fbbf24' }
              : { background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.3)', color: '#a78bfa' }
            ),
          }}>
            {activeVideoMode === 'ugc' ? '📱 UGC Video' : '🎬 Cinematic Video'}
          </div>
        )}

        {/* Creative content */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
          {format === 'video' && hasVideo && (
            <VideoPlayer url={result.stitchedVideoUrl!} />
          )}
          {format === 'carousel' && hasSlides && (
            <CarouselPreview slides={result.slides!} imagesReady={result.imagesReady} />
          )}
          {format === 'image' && hasBanners && (
            <BannerPreview banners={result.banners!} imagesReady={result.imagesReady} />
          )}

          {/* Fallback: creative generated but content not yet fetched */}
          {!hasVideo && !hasSlides && !hasBanners && (
            <div style={centreStack}>
              <div style={{ fontSize: 36, opacity: 0.3 }}>{formatIcon}</div>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 10 }}>
                Creative generated — fetching content…
              </div>
            </div>
          )}
        </div>

        {/* Action panel */}
        <div style={{
          marginTop: 20,
          display: 'flex', gap: 10, justifyContent: 'center',
          padding: '16px 0',
          borderTop: '1px solid var(--border)',
        }}>
          {onDownload && (
            <ActionBtn icon="↓" label="Download" onClick={onDownload} accent />
          )}
          {onRegenerate && (
            <ActionBtn icon="↺" label="Regenerate" onClick={onRegenerate} />
          )}
          {onNewAngle && (
            <ActionBtn icon="✦" label="New Angle" onClick={onNewAngle} />
          )}
        </div>
      </div>
    );
  }

  return null;
}
