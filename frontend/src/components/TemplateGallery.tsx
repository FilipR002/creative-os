'use client';

// ─── TemplateGallery ──────────────────────────────────────────────────────────
// Full-page template picker shown as the first screen when creating a new ad.

import React, { useState, useEffect, useRef } from 'react';
import type { TemplateMetadata } from '@/lib/api/creator-client';

// ─── Global synchronized carousel clock ──────────────────────────────────────
// One interval drives ALL carousel cards simultaneously so they transition
// in unison instead of each firing at a random offset (epilepsy prevention).
let _globalSlide = 0;
const _slideListeners = new Set<(s: number) => void>();
if (typeof window !== 'undefined') {
  setInterval(() => {
    _globalSlide = (_globalSlide + 1) % 3;
    _slideListeners.forEach(fn => fn(_globalSlide));
  }, 3000);
}

function useGlobalSlide(paused: boolean): { slide: number; fading: boolean } {
  const [slide,  setSlide]  = useState(_globalSlide);
  const [fading, setFading] = useState(false);
  useEffect(() => {
    if (paused) return;
    const listener = (next: number) => {
      setFading(true);
      setTimeout(() => { setSlide(next); setFading(false); }, 220);
    };
    _slideListeners.add(listener);
    return () => { _slideListeners.delete(listener); };
  }, [paused]);
  return { slide, fading };
}

export type GalleryFormat = 'carousel' | 'image' | 'video';
type Category = 'all' | 'conversion' | 'trust' | 'empathy' | 'engagement' | 'scroll-stop' | 'social-native' | 'aesthetic' | 'education' | 'product' | 'brand';

interface Props {
  templates:     TemplateMetadata[];
  onSelect:      (templateId: string, format: GalleryFormat) => void;
  defaultFormat?: GalleryFormat;
}

const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'all',           label: 'All' },
  { id: 'conversion',    label: 'Conversion' },
  { id: 'trust',         label: 'Trust' },
  { id: 'empathy',       label: 'Empathy' },
  { id: 'engagement',    label: 'Engagement' },
  { id: 'scroll-stop',   label: 'Scroll-Stop' },
  { id: 'social-native', label: 'Social Native' },
  { id: 'aesthetic',     label: 'Aesthetic' },
  { id: 'education',     label: 'Education' },
  { id: 'product',       label: 'Product' },
  { id: 'brand',         label: 'Brand' },
];

const CATEGORY_IDS: Record<Category, string[]> = {
  all:            [],
  conversion:     ['countdown-urgency','cta-final','offer-stack','value-math','bold-headline','diagonal-split','gradient-pop','guarantee-badge','free-trial','limited-drop','offer-announce','price-compare','bundle-stack','problem-slide','story-hook','offer-drop','versus-slide','before-after-slide'],
  trust:          ['testimonial','social-proof-grid','stats-hero','case-study','feature-list','magazine-editorial','insight-frame','award-winner','founder-story','review-card','trust-bar','news-frame','video-thumbnail','community-quote','stat-study','testimonial-card','press-slide'],
  empathy:        ['ugc-style','empathy-card','validation-card','pain-diagnostic','mistake-alert','story-hook','problem-slide','caption-style','chat-thread','meme-format','comment-reply','full-bleed','overlay-card','photo-reveal','brand-manifesto','chat-native','before-after-slide'],
  engagement:     ['do-dont','transform-split','poll-card','hot-take','leaderboard','checklist-viral','myth-reality','photo-reveal','side-by-side','event-card','meme-format','three-reasons','timeline-journey','reddit-thread','photo-grid','versus-slide','gallery-slide'],
  'scroll-stop':  ['bold-headline','text-only-bold','retro-bold','neon-dark','headline-badge','brand-manifesto','brutalist','collage-cutout','aurora-gradient','duotone-photo','hot-take','full-bleed','gradient-pop','color-block','mono-editorial','offer-drop','versus-slide'],
  'social-native':['chat-thread','tweet-screenshot','tiktok-native','reddit-thread','email-mockup','receipt-style','ugc-style','caption-style','meme-format','comment-reply','photo-reveal','poll-card','video-thumbnail','story-hook','floating-card','chat-native'],
  aesthetic:      ['aurora-gradient','duotone-photo','mono-editorial','risograph-print','dark-luxury','overlay-card','gradient-pop','color-block','floating-card','collage-cutout','neon-dark','magazine-editorial','diagonal-split','full-bleed','bright-minimal','gallery-slide'],
  education:      ['chart-reveal','three-reasons','timeline-journey','vs-table','insight-frame','feature-list','number-list','stat-study','steps-infographic','checklist-viral','stats-hero','case-study','do-dont','myth-reality','leaderboard','point-out-slide'],
  product:        ['product-center','product-demo','bundle-stack','split-panel','flat-lay','app-mockup','photo-grid','side-by-side','color-block','bright-minimal','minimal','full-bleed','floating-card','overlay-card','price-compare','point-out-slide','gallery-slide'],
  brand:          ['brand-manifesto','brand-awareness','founder-story','mono-editorial','magazine-editorial','minimal','bright-minimal','text-only-bold','retro-bold','diagonal-split','dark-luxury','color-block','gradient-pop','aurora-gradient','headline-badge','press-slide'],
};

// ─── Per-template mini preview fallbacks ─────────────────────────────────────
// Each returns a distinct CSS-only layout that visually represents the template.

function Fallback({ id, tone }: { id: string; tone: string }) {
  const isLight = ['minimal','bright-minimal','feature-list','floating-card','product-demo','magazine-editorial','split-panel','side-by-side','case-study','insight-frame','do-dont','transform-split'].includes(id);
  const bg    = isLight ? '#f8fafc' : '#0f172a';
  const text  = isLight ? '#1e293b' : '#f1f5f9';
  const muted = isLight ? '#64748b' : 'rgba(255,255,255,0.45)';

  const accent = TEMPLATE_ACCENTS[id] ?? TONE_ACCENTS[tone] ?? '#4f46e5';

  const s: React.CSSProperties = { width: '100%', height: '100%', overflow: 'hidden', position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16, background: bg, color: text };

  // ── Template-specific layouts ────────────────────────────────────────────

  if (id === 'split-panel') return (
    <div style={{ ...s, flexDirection: 'row', padding: 0, gap: 0 }}>
      <div style={{ flex: 1, height: '100%', background: 'linear-gradient(160deg, #4f46e5, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.2)' }} />
      </div>
      <div style={{ flex: 1, background: '#f8fafc', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 8, padding: 16 }}>
        <div style={{ height: 10, background: '#1e293b', borderRadius: 3, width: '80%' }} />
        <div style={{ height: 6, background: '#94a3b8', borderRadius: 3, width: '90%' }} />
        <div style={{ height: 6, background: '#94a3b8', borderRadius: 3, width: '70%' }} />
        <div style={{ marginTop: 8, height: 24, background: '#4f46e5', borderRadius: 6, width: '60%' }} />
      </div>
    </div>
  );

  if (id === 'full-bleed') return (
    <div style={{ ...s, background: 'linear-gradient(160deg, #78350f 0%, #b45309 50%, #d97706 100%)', justifyContent: 'flex-end', alignItems: 'flex-start', padding: 18 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 55%)' }} />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ height: 9, background: '#fff', borderRadius: 2, width: 140, marginBottom: 6 }} />
        <div style={{ height: 6, background: 'rgba(255,255,255,0.5)', borderRadius: 2, width: 110, marginBottom: 12 }} />
        <div style={{ height: 22, background: '#f59e0b', borderRadius: 5, width: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ height: 5, background: '#fff', borderRadius: 2, width: 50 }} />
        </div>
      </div>
    </div>
  );

  if (id === 'bold-headline') return (
    <div style={{ ...s, background: '#000' }}>
      <div style={{ fontSize: 28, fontWeight: 900, color: '#fff', textAlign: 'center', lineHeight: 1.1, letterSpacing: '-0.03em' }}>
        Transform<br />Your Brand
      </div>
      <div style={{ height: 5, background: '#fff', borderRadius: 2, width: 60, marginTop: 4 }} />
    </div>
  );

  if (id === 'minimal') return (
    <div style={{ ...s, background: '#fff', gap: 10 }}>
      <div style={{ height: 3, background: '#1e293b', borderRadius: 2, width: 80 }} />
      <div style={{ height: 14, background: '#1e293b', borderRadius: 2, width: 140, fontWeight: 900 }} />
      <div style={{ height: 5, background: '#e2e8f0', borderRadius: 2, width: 120 }} />
      <div style={{ height: 5, background: '#e2e8f0', borderRadius: 2, width: 100 }} />
      <div style={{ marginTop: 6, height: 24, border: '1.5px solid #1e293b', borderRadius: 4, width: 90, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ height: 5, background: '#1e293b', borderRadius: 2, width: 55 }} />
      </div>
    </div>
  );

  if (id === 'ugc-style') return (
    <div style={{ ...s, background: '#fafafa', justifyContent: 'flex-start', padding: 12, gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, #f97316, #ec4899)' }} />
        <div>
          <div style={{ height: 5, background: '#1e293b', borderRadius: 2, width: 60 }} />
          <div style={{ height: 4, background: '#94a3b8', borderRadius: 2, width: 40, marginTop: 3 }} />
        </div>
        <div style={{ marginLeft: 'auto', height: 20, background: '#f97316', borderRadius: 4, width: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ height: 4, background: '#fff', borderRadius: 1, width: 26 }} />
        </div>
      </div>
      <div style={{ flex: 1, width: '100%', background: 'linear-gradient(160deg, #fed7aa, #fde68a)', borderRadius: 8 }} />
      <div style={{ height: 5, background: '#334155', borderRadius: 2, width: '90%' }} />
      <div style={{ height: 5, background: '#94a3b8', borderRadius: 2, width: '70%' }} />
    </div>
  );

  if (id === 'testimonial') return (
    <div style={{ ...s, background: '#fff', gap: 10 }}>
      <div style={{ fontSize: 18, color: '#f59e0b', letterSpacing: 2 }}>★★★★★</div>
      <div style={{ fontSize: 28, color: '#94a3b8', lineHeight: 1, fontFamily: 'Georgia, serif' }}>"</div>
      <div style={{ textAlign: 'center', gap: 4, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ height: 5, background: '#334155', borderRadius: 2, width: 130 }} />
        <div style={{ height: 5, background: '#334155', borderRadius: 2, width: 110 }} />
        <div style={{ height: 5, background: '#94a3b8', borderRadius: 2, width: 90, marginTop: 2 }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
        <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#6366f1' }} />
        <div style={{ height: 4, background: '#94a3b8', borderRadius: 2, width: 55 }} />
      </div>
    </div>
  );

  if (id === 'stats-hero') return (
    <div style={{ ...s, background: '#020617', gap: 6 }}>
      <div style={{ fontSize: 52, fontWeight: 900, color: '#fff', lineHeight: 1, letterSpacing: '-0.04em' }}>
        87<span style={{ fontSize: 28, color: '#22d3ee' }}>%</span>
      </div>
      <div style={{ height: 5, background: 'rgba(255,255,255,0.5)', borderRadius: 2, width: 110, marginTop: 4 }} />
      <div style={{ height: 4, background: 'rgba(255,255,255,0.25)', borderRadius: 2, width: 80 }} />
    </div>
  );

  if (id === 'feature-list') return (
    <div style={{ ...s, background: '#fff', alignItems: 'flex-start', justifyContent: 'center', gap: 10, padding: 18 }}>
      <div style={{ height: 8, background: '#1e293b', borderRadius: 2, width: 110, marginBottom: 4 }} />
      {['120px','100px','130px'].map((w, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 14, height: 14, borderRadius: '50%', background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <div style={{ width: 5, height: 3, borderLeft: '1.5px solid #fff', borderBottom: '1.5px solid #fff', transform: 'rotate(-45deg) translate(1px,-1px)' }} />
          </div>
          <div style={{ height: 5, background: '#94a3b8', borderRadius: 2, width: w }} />
        </div>
      ))}
    </div>
  );

  if (id === 'cta-final') return (
    <div style={{ ...s, background: 'linear-gradient(135deg, #450a0a 0%, #7f1d1d 100%)', gap: 8 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: accent, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Limited Time</div>
      <div style={{ height: 9, background: '#fff', borderRadius: 2, width: 140 }} />
      <div style={{ height: 6, background: 'rgba(255,255,255,0.4)', borderRadius: 2, width: 110 }} />
      <div style={{ marginTop: 8, height: 30, background: accent, borderRadius: 8, width: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 4px 16px ${accent}55` }}>
        <div style={{ height: 5, background: '#fff', borderRadius: 2, width: 70 }} />
      </div>
    </div>
  );

  if (id === 'gradient-pop') return (
    <div style={{ ...s, background: 'linear-gradient(135deg, #059669 0%, #0891b2 50%, #6366f1 100%)', gap: 8 }}>
      <div style={{ height: 10, background: 'rgba(255,255,255,0.9)', borderRadius: 2, width: 130 }} />
      <div style={{ height: 6, background: 'rgba(255,255,255,0.5)', borderRadius: 2, width: 100 }} />
      <div style={{ marginTop: 8, height: 26, background: '#fff', borderRadius: 6, width: 90, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ height: 5, background: '#7c3aed', borderRadius: 2, width: 55 }} />
      </div>
    </div>
  );

  if (id === 'dark-luxury') return (
    <div style={{ ...s, background: 'linear-gradient(160deg, #020617 0%, #0f172a 60%, #1c1917 100%)', gap: 8 }}>
      <div style={{ height: 3, background: '#d97706', borderRadius: 1, width: 40, marginBottom: 4 }} />
      <div style={{ height: 10, background: '#fef3c7', borderRadius: 2, width: 120, fontFamily: 'serif' }} />
      <div style={{ height: 6, background: 'rgba(253,230,138,0.4)', borderRadius: 2, width: 90 }} />
      <div style={{ marginTop: 10, height: 22, border: '1px solid #d97706', borderRadius: 3, width: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ height: 4, background: '#d97706', borderRadius: 1, width: 45 }} />
      </div>
    </div>
  );

  if (id === 'bright-minimal') return (
    <div style={{ ...s, background: '#fff', gap: 10 }}>
      <div style={{ height: 3, background: '#4f46e5', borderRadius: 1, width: 40 }} />
      <div style={{ height: 12, background: '#1e293b', borderRadius: 2, width: 130 }} />
      <div style={{ height: 5, background: '#cbd5e1', borderRadius: 2, width: 110 }} />
      <div style={{ marginTop: 8, height: 26, background: '#4f46e5', borderRadius: 5, width: 90, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ height: 5, background: '#fff', borderRadius: 2, width: 55 }} />
      </div>
    </div>
  );

  if (id === 'story-hook') return (
    <div style={{ ...s, background: 'linear-gradient(160deg, #022c22 0%, #064e3b 100%)', justifyContent: 'flex-start', padding: 18, gap: 6 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: accent, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Wait—</div>
      <div style={{ fontSize: 22, fontWeight: 900, color: '#fff', lineHeight: 1.15, letterSpacing: '-0.02em' }}>Is this<br />you?</div>
      <div style={{ marginTop: 'auto', height: 5, background: 'rgba(255,255,255,0.3)', borderRadius: 2, width: '80%' }} />
    </div>
  );

  if (id === 'problem-slide') return (
    <div style={{ ...s, background: 'linear-gradient(135deg, #1c0505 0%, #450a0a 100%)', gap: 8 }}>
      <div style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(252,165,165,0.2)', border: '1.5px solid rgba(252,165,165,0.5)', marginBottom: 4 }} />
      <div style={{ height: 9, background: '#fca5a5', borderRadius: 2, width: 130 }} />
      <div style={{ height: 5, background: 'rgba(252,165,165,0.5)', borderRadius: 2, width: 100 }} />
    </div>
  );

  if (id === 'text-only-bold') return (
    <div style={{ ...s, background: '#f8fafc', gap: 6 }}>
      <div style={{ fontSize: 22, fontWeight: 900, color: '#0f172a', lineHeight: 1.15, textAlign: 'center', letterSpacing: '-0.03em' }}>
        "Your brand<br />story starts<br />here."
      </div>
      <div style={{ height: 3, background: '#4f46e5', borderRadius: 1, width: 30, marginTop: 6 }} />
    </div>
  );

  if (id === 'product-center') return (
    <div style={{ ...s, background: '#f8fafc', gap: 8 }}>
      <div style={{ width: 80, height: 80, borderRadius: 16, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(99,102,241,0.35)' }}>
        <div style={{ width: 40, height: 40, borderRadius: 8, background: 'rgba(255,255,255,0.3)' }} />
      </div>
      <div style={{ height: 7, background: '#1e293b', borderRadius: 2, width: 110 }} />
      <div style={{ height: 5, background: '#94a3b8', borderRadius: 2, width: 80 }} />
    </div>
  );

  if (id === 'neon-dark') return (
    <div style={{ ...s, background: '#020617', gap: 8 }}>
      <div style={{ height: 10, background: '#transparent', borderRadius: 2, width: 130, fontSize: 14, fontWeight: 900, color: '#00ff88', textShadow: '0 0 12px #00ff8899', textAlign: 'center', letterSpacing: '0.05em' }}>
        TRANSFORM
      </div>
      <div style={{ height: 6, color: '#a78bfa', fontSize: 10, textShadow: '0 0 8px #a78bfa99', textAlign: 'center', letterSpacing: '0.08em' }}>
        YOUR BRAND
      </div>
      <div style={{ marginTop: 8, height: 22, border: '1px solid #00ff88', borderRadius: 4, width: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 12px #00ff8833' }}>
        <div style={{ height: 4, background: '#00ff88', borderRadius: 1, width: 55, boxShadow: '0 0 6px #00ff88' }} />
      </div>
    </div>
  );

  if (id === 'magazine-editorial') return (
    <div style={{ ...s, flexDirection: 'row', padding: 0, gap: 0 }}>
      <div style={{ width: '45%', height: '100%', background: 'linear-gradient(160deg, #1e293b, #0f172a)' }} />
      <div style={{ flex: 1, background: '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 7, padding: 14 }}>
        <div style={{ height: 4, background: '#dc2626', borderRadius: 1, width: 30 }} />
        <div style={{ height: 8, background: '#1e293b', borderRadius: 2, width: '90%' }} />
        <div style={{ height: 8, background: '#1e293b', borderRadius: 2, width: '70%' }} />
        <div style={{ height: 5, background: '#94a3b8', borderRadius: 2, width: '90%' }} />
        <div style={{ height: 5, background: '#94a3b8', borderRadius: 2, width: '80%' }} />
        <div style={{ marginTop: 6, height: 3, background: '#1e293b', borderRadius: 1, width: 50 }} />
      </div>
    </div>
  );

  if (id === 'color-block') return (
    <div style={{ ...s, gap: 0, padding: 0 }}>
      <div style={{ height: '50%', width: '100%', background: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ height: 9, background: '#fff', borderRadius: 2, width: 110 }} />
      </div>
      <div style={{ height: '50%', width: '100%', background: '#f8fafc', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        <div style={{ height: 5, background: '#94a3b8', borderRadius: 2, width: 100 }} />
        <div style={{ height: 20, background: '#1e293b', borderRadius: 5, width: 80 }} />
      </div>
    </div>
  );

  if (id === 'floating-card') return (
    <div style={{ ...s, background: 'linear-gradient(135deg, #052e16 0%, #14532d 100%)' }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: '16px 18px', width: '80%', boxShadow: '0 8px 30px rgba(0,0,0,0.4)', display: 'flex', flexDirection: 'column', gap: 7 }}>
        <div style={{ height: 7, background: '#1e293b', borderRadius: 2, width: '80%' }} />
        <div style={{ height: 5, background: '#94a3b8', borderRadius: 2, width: '90%' }} />
        <div style={{ height: 5, background: '#94a3b8', borderRadius: 2, width: '70%' }} />
        <div style={{ height: 22, background: '#4f46e5', borderRadius: 6, width: '55%', marginTop: 4 }} />
      </div>
    </div>
  );

  if (id === 'countdown-urgency') return (
    <div style={{ ...s, background: 'linear-gradient(135deg, #1c0505 0%, #7f1d1d 100%)', gap: 8 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#fca5a5', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Ends in</div>
      <div style={{ display: 'flex', gap: 6 }}>
        {['24','00','00'].map((v, i) => (
          <div key={i} style={{ background: '#fff', borderRadius: 6, width: 34, height: 36, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ fontWeight: 900, fontSize: 14, color: '#1e293b', lineHeight: 1 }}>{v}</div>
          </div>
        ))}
      </div>
      <div style={{ height: 5, background: 'rgba(252,165,165,0.5)', borderRadius: 2, width: 90, marginTop: 2 }} />
    </div>
  );

  if (id === 'social-proof-grid') return (
    <div style={{ ...s, background: '#fff', gap: 6, padding: 14 }}>
      <div style={{ height: 7, background: '#1e293b', borderRadius: 2, width: 100, marginBottom: 2 }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, width: '100%' }}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{ background: '#f1f5f9', borderRadius: 6, padding: 7, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ fontSize: 9, color: '#f59e0b' }}>★★★★★</div>
            <div style={{ height: 3, background: '#94a3b8', borderRadius: 1, width: '90%' }} />
            <div style={{ height: 3, background: '#94a3b8', borderRadius: 1, width: '70%' }} />
          </div>
        ))}
      </div>
    </div>
  );

  if (id === 'headline-badge') return (
    <div style={{ ...s, background: '#18181b', gap: 10 }}>
      <div style={{ background: accent, borderRadius: 20, padding: '4px 14px', display: 'inline-flex' }}>
        <div style={{ height: 5, background: '#fff', borderRadius: 1, width: 50 }} />
      </div>
      <div style={{ fontSize: 22, fontWeight: 900, color: '#fff', lineHeight: 1.1, textAlign: 'center', letterSpacing: '-0.03em' }}>
        Brand<br />Launch
      </div>
    </div>
  );

  if (id === 'side-by-side') return (
    <div style={{ ...s, flexDirection: 'row', padding: 14, gap: 10, background: '#fff', alignItems: 'stretch' }}>
      {[0, 1].map(i => (
        <div key={i} style={{ flex: 1, background: i === 0 ? '#f1f5f9' : '#ede9fe', borderRadius: 8, padding: 10, display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div style={{ height: 6, background: i === 0 ? '#94a3b8' : '#8b5cf6', borderRadius: 2, width: '80%' }} />
          <div style={{ height: 5, background: '#cbd5e1', borderRadius: 2, width: '90%' }} />
          <div style={{ height: 5, background: '#cbd5e1', borderRadius: 2, width: '70%' }} />
        </div>
      ))}
    </div>
  );

  if (id === 'diagonal-split') return (
    <div style={{ ...s, padding: 0, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, background: '#1c1917' }} />
      <div style={{ position: 'absolute', right: 0, top: 0, width: '50%', height: '100%', background: 'linear-gradient(160deg, #ea580c, #f97316)', clipPath: 'polygon(20% 0, 100% 0, 100% 100%, 0% 100%)' }} />
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: 7, padding: 18, alignSelf: 'flex-start', marginTop: 20 }}>
        <div style={{ height: 9, background: '#fff', borderRadius: 2, width: 100 }} />
        <div style={{ height: 5, background: 'rgba(255,255,255,0.6)', borderRadius: 2, width: 80 }} />
      </div>
    </div>
  );

  if (id === 'overlay-card') return (
    <div style={{ ...s, background: 'linear-gradient(160deg, #1a1a2e 0%, #16213e 60%, #0f3460 100%)', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(10,10,30,0.6)' }} />
      <div style={{ position: 'relative', background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 12, padding: 16, width: '85%', display: 'flex', flexDirection: 'column', gap: 7 }}>
        <div style={{ height: 8, background: '#fff', borderRadius: 2, width: '80%' }} />
        <div style={{ height: 5, background: 'rgba(255,255,255,0.5)', borderRadius: 2, width: '90%' }} />
        <div style={{ height: 20, background: '#fff', borderRadius: 5, width: '50%', marginTop: 4 }} />
      </div>
    </div>
  );

  if (id === 'number-list') return (
    <div style={{ ...s, background: '#fff', alignItems: 'flex-start', padding: 16, gap: 10 }}>
      {[['01', 'Transform your brand'], ['02', 'Reach your audience'], ['03', 'Convert at scale']].map(([num, text]) => (
        <div key={num} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: '#e2e8f0', lineHeight: 1, minWidth: 28 }}>{num}</div>
          <div style={{ height: 5, background: '#94a3b8', borderRadius: 2, width: 90 }} />
        </div>
      ))}
    </div>
  );

  if (id === 'brand-manifesto') return (
    <div style={{ ...s, background: '#18181b', gap: 6 }}>
      <div style={{ textAlign: 'center', color: '#fff', fontWeight: 900, fontSize: 14, lineHeight: 1.3, letterSpacing: '-0.01em' }}>
        "We believe<br />in brands that<br />actually matter."
      </div>
      <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
        {[0,1,2].map(i => <div key={i} style={{ width: 4, height: 4, borderRadius: '50%', background: i === 1 ? '#fff' : 'rgba(255,255,255,0.25)' }} />)}
      </div>
    </div>
  );

  if (id === 'product-demo') return (
    <div style={{ ...s, background: '#f8fafc', padding: 14, gap: 8 }}>
      <div style={{ background: '#1e293b', borderRadius: 8, padding: '6px 8px 8px', width: '85%', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {['#ef4444','#f59e0b','#22c55e'].map(c => <div key={c} style={{ width: 6, height: 6, borderRadius: '50%', background: c }} />)}
          <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, marginLeft: 4 }} />
        </div>
        <div style={{ background: '#0f172a', borderRadius: 4, height: 60, display: 'flex', flexDirection: 'column', gap: 4, padding: 8 }}>
          <div style={{ height: 4, background: 'rgba(255,255,255,0.3)', borderRadius: 1, width: '70%' }} />
          <div style={{ height: 4, background: 'rgba(255,255,255,0.15)', borderRadius: 1, width: '90%' }} />
          <div style={{ height: 4, background: 'rgba(99,102,241,0.6)', borderRadius: 1, width: '50%' }} />
        </div>
      </div>
      <div style={{ height: 5, background: '#94a3b8', borderRadius: 2, width: 80 }} />
    </div>
  );

  if (id === 'retro-bold') return (
    <div style={{ ...s, background: '#fef3c7', gap: 8, overflow: 'hidden' }}>
      {/* Halftone dot pattern */}
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle, rgba(0,0,0,0.08) 1px, transparent 1px)', backgroundSize: '8px 8px', opacity: 0.8 }} />
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        <div style={{ height: 3, background: '#1c1917', width: 130 }} />
        <div style={{ fontSize: 22, fontWeight: 900, color: '#1c1917', letterSpacing: '-0.02em', lineHeight: 1, fontFamily: 'serif', textTransform: 'uppercase', textAlign: 'center' }}>
          TRANSFORM<br />YOUR BRAND
        </div>
        <div style={{ height: 3, background: '#1c1917', width: 130 }} />
        <div style={{ marginTop: 6, height: 24, background: '#1c1917', borderRadius: 0, width: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ height: 5, background: '#fef3c7', borderRadius: 1, width: 65 }} />
        </div>
      </div>
    </div>
  );

  if (id === 'offer-stack') return (
    <div style={{ ...s, background: 'linear-gradient(135deg,#450a0a,#991b1b)', gap: 4, justifyContent: 'center' }}>
      <div style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6, padding: '4px 12px', fontSize: 9, color: '#fca5a5', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const }}>Limited Offer</div>
      <div style={{ fontSize: 42, fontWeight: 900, color: '#fff', lineHeight: 1, letterSpacing: '-0.04em' }}>50<span style={{ fontSize: 22, color: '#ef4444' }}>%</span></div>
      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.06em', textTransform: 'uppercase' as const }}>OFF TODAY ONLY</div>
      <div style={{ marginTop: 8, height: 26, background: '#ef4444', borderRadius: 6, width: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(239,68,68,0.5)' }}>
        <div style={{ height: 5, background: '#fff', borderRadius: 2, width: 65 }} />
      </div>
    </div>
  );

  if (id === 'value-math') return (
    <div style={{ ...s, background: 'linear-gradient(135deg,#020617,#0c1a3a)', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ textDecoration: 'line-through', color: 'rgba(255,255,255,0.35)', fontSize: 16, fontWeight: 700 }}>$299</div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>→</div>
        <div style={{ fontSize: 28, fontWeight: 900, color: '#10b981', letterSpacing: '-0.03em' }}>$97</div>
      </div>
      <div style={{ height: 3, background: 'rgba(16,185,129,0.3)', borderRadius: 1, width: 100 }} />
      <div style={{ fontSize: 8, color: '#10b981', fontWeight: 700, letterSpacing: '0.06em' }}>YOU SAVE $202</div>
      <div style={{ marginTop: 6, height: 22, background: '#10b981', borderRadius: 5, width: 90, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ height: 4, background: '#fff', borderRadius: 1, width: 55 }} />
      </div>
    </div>
  );

  if (id === 'case-study') return (
    <div style={{ ...s, background: '#fff', alignItems: 'flex-start', padding: 14, gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ width: 22, height: 22, borderRadius: 6, background: '#6366f1' }} />
        <div style={{ height: 5, background: '#1e293b', borderRadius: 2, width: 70 }} />
      </div>
      <div style={{ height: 1, background: '#e2e8f0', width: '100%' }} />
      <div style={{ display: 'flex', gap: 10, width: '100%' }}>
        {[['Before','#94a3b8'],['After','#6366f1']].map(([label, col]) => (
          <div key={label} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div style={{ fontSize: 7, color: col as string, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.08em' }}>{label}</div>
            <div style={{ height: 14, background: col as string, borderRadius: 3, opacity: label === 'Before' ? 0.3 : 1 }} />
            <div style={{ height: 4, background: '#94a3b8', borderRadius: 1, width: '80%' }} />
          </div>
        ))}
      </div>
      <div style={{ fontSize: 9, fontWeight: 800, color: '#6366f1' }}>+340% in 60 days</div>
    </div>
  );

  if (id === 'insight-frame') return (
    <div style={{ ...s, background: '#fff', alignItems: 'flex-start', padding: 14, gap: 8 }}>
      <div style={{ fontSize: 9, color: '#0ea5e9', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const }}>Insight</div>
      <div style={{ height: 8, background: '#0f172a', borderRadius: 2, width: 130 }} />
      <div style={{ height: 1, background: '#e2e8f0', width: '100%', marginTop: 2 }} />
      {[1,2,3].map(i => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#0ea5e9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <div style={{ fontSize: 7, color: '#fff', fontWeight: 900 }}>{i}</div>
          </div>
          <div style={{ height: 4, background: '#94a3b8', borderRadius: 1, width: 90 }} />
        </div>
      ))}
    </div>
  );

  if (id === 'pain-diagnostic') return (
    <div style={{ ...s, background: 'linear-gradient(135deg,#0a0a0f,#1a0a1a)', gap: 8 }}>
      <div style={{ background: 'rgba(244,63,94,0.15)', border: '1px solid rgba(244,63,94,0.4)', borderRadius: 20, padding: '4px 12px', fontSize: 8, color: '#f43f5e', fontWeight: 700, letterSpacing: '0.08em' }}>DIAGNOSE</div>
      <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', textAlign: 'center', lineHeight: 1.3 }}>Sound<br />familiar?</div>
      {['' as string,'' as string,'' as string].map((_, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ fontSize: 8, color: '#f43f5e' }}>✕</div>
          <div style={{ height: 4, background: 'rgba(244,63,94,0.4)', borderRadius: 1, width: [80,100,65][i] }} />
        </div>
      ))}
    </div>
  );

  if (id === 'mistake-alert') return (
    <div style={{ ...s, background: 'linear-gradient(135deg,#1c0505,#431407)', gap: 8 }}>
      <div style={{ background: '#f97316', borderRadius: 4, padding: '3px 10px', fontSize: 8, color: '#fff', fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>⚠ Mistake #1</div>
      <div style={{ height: 7, background: 'rgba(255,255,255,0.8)', borderRadius: 2, width: 120 }} />
      <div style={{ height: 5, background: 'rgba(255,255,255,0.4)', borderRadius: 2, width: 95 }} />
      <div style={{ marginTop: 4, height: 22, background: 'rgba(249,115,22,0.2)', border: '1px solid #f97316', borderRadius: 5, width: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ height: 4, background: '#f97316', borderRadius: 1, width: 65 }} />
      </div>
    </div>
  );

  if (id === 'empathy-card') return (
    <div style={{ ...s, background: 'linear-gradient(160deg,#fff7f0,#fce7f3)', gap: 8 }}>
      <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'linear-gradient(135deg,#ec4899,#a78bfa)', marginBottom: 2 }} />
      <div style={{ fontSize: 12, fontWeight: 700, color: '#7c3aed', textAlign: 'center', lineHeight: 1.4 }}>
        You deserve<br />to feel this.
      </div>
      <div style={{ height: 5, background: 'rgba(124,58,237,0.2)', borderRadius: 2, width: 100 }} />
      <div style={{ height: 22, background: 'linear-gradient(135deg,#7c3aed,#ec4899)', borderRadius: 20, width: 90, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ height: 4, background: '#fff', borderRadius: 1, width: 55 }} />
      </div>
    </div>
  );

  if (id === 'validation-card') return (
    <div style={{ ...s, background: 'linear-gradient(135deg,#f5f3ff,#ede9fe)', gap: 8 }}>
      <div style={{ display: 'flex', gap: -6 }}>
        {['#a78bfa','#818cf8','#6366f1'].map((c,i) => (
          <div key={i} style={{ width: 22, height: 22, borderRadius: '50%', background: c, border: '2px solid #fff', marginLeft: i > 0 ? -6 : 0 }} />
        ))}
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#4c1d95', textAlign: 'center', lineHeight: 1.4 }}>
        You're not alone.<br />14,000+ feel this.
      </div>
      <div style={{ height: 5, background: 'rgba(124,58,237,0.2)', borderRadius: 2, width: 90 }} />
      <div style={{ height: 22, background: '#7c3aed', borderRadius: 6, width: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ height: 4, background: '#fff', borderRadius: 1, width: 60 }} />
      </div>
    </div>
  );

  if (id === 'do-dont') return (
    <div style={{ ...s, flexDirection: 'row', padding: 0, gap: 0 }}>
      <div style={{ flex: 1, height: '100%', background: '#fff5f5', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 7, padding: 12 }}>
        <div style={{ fontSize: 9, color: '#ef4444', fontWeight: 800, letterSpacing: '0.06em' }}>✕ DON'T</div>
        {[80,70,90].map((w,i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ height: 3, background: 'rgba(239,68,68,0.35)', borderRadius: 1, width: w }} />
          </div>
        ))}
      </div>
      <div style={{ width: 1, background: '#e2e8f0', flexShrink: 0 }} />
      <div style={{ flex: 1, height: '100%', background: '#f0fdf4', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 7, padding: 12 }}>
        <div style={{ fontSize: 9, color: '#16a34a', fontWeight: 800, letterSpacing: '0.06em' }}>✓ DO</div>
        {[85,75,95].map((w,i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ height: 3, background: 'rgba(22,163,74,0.45)', borderRadius: 1, width: w }} />
          </div>
        ))}
      </div>
    </div>
  );

  if (id === 'transform-split') return (
    <div style={{ ...s, flexDirection: 'column', padding: 0, gap: 0, position: 'relative' }}>
      {/* Top half — BEFORE */}
      <div style={{ flex: 1, width: '100%', background: 'linear-gradient(135deg,#1e293b,#334155)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
        <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' as const }}>Before</div>
        <div style={{ height: 6, background: 'rgba(255,255,255,0.2)', borderRadius: 2, width: 80 }} />
        <div style={{ height: 4, background: 'rgba(255,255,255,0.12)', borderRadius: 2, width: 60 }} />
      </div>
      {/* Divider label */}
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: '#14b8a6', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1, fontSize: 10, color: '#fff', fontWeight: 900, boxShadow: '0 2px 8px rgba(20,184,166,0.5)' }}>→</div>
      {/* Bottom half — AFTER */}
      <div style={{ flex: 1, width: '100%', background: 'linear-gradient(135deg,#042f2e,#0f766e)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
        <div style={{ fontSize: 8, color: '#5eead4', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' as const }}>After</div>
        <div style={{ height: 6, background: '#5eead4', borderRadius: 2, width: 90, opacity: 0.8 }} />
        <div style={{ height: 4, background: 'rgba(94,234,212,0.4)', borderRadius: 2, width: 70 }} />
      </div>
    </div>
  );

  // ── Batch 5 — 44 new templates ───────────────────────────────────────────────

  if (id === 'guarantee-badge') return (
    <div style={{ ...s, background: '#1a1a2e', gap: 6 }}>
      <div style={{ width: 80, height: 80, borderRadius: '50%', border: `3px solid ${accent}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
        <div style={{ fontSize: 7, color: accent, fontWeight: 800, letterSpacing: '0.12em' }}>GUARANTEED</div>
        <div style={{ fontSize: 11, color: '#fff', fontWeight: 900, lineHeight: 1 }}>MONEY</div>
        <div style={{ fontSize: 11, color: '#fff', fontWeight: 900, lineHeight: 1 }}>BACK</div>
      </div>
      <div style={{ fontSize: 13, color: accent, fontWeight: 800, marginTop: 4 }}>30 Days</div>
      <div style={{ marginTop: 4, height: 22, background: accent, borderRadius: 5, padding: '0 14px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1a1a2e', fontSize: 9, fontWeight: 800 }}>CLAIM YOURS</div>
    </div>
  );

  if (id === 'free-trial') return (
    <div style={{ ...s, background: '#fff', gap: 6 }}>
      <div style={{ fontSize: 28, color: '#0f172a', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1 }}>START FREE</div>
      <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 500 }}>No credit card required</div>
      <div style={{ marginTop: 8, height: 28, background: '#10b981', borderRadius: 6, padding: '0 18px', display: 'flex', alignItems: 'center', color: '#fff', fontSize: 10, fontWeight: 800, boxShadow: '0 4px 14px rgba(16,185,129,0.35)' }}>Try 14 Days Free</div>
    </div>
  );

  if (id === 'limited-drop') return (
    <div style={{ ...s, background: '#000', gap: 6 }}>
      <div style={{ fontSize: 9, color: '#f97316', fontWeight: 800, letterSpacing: '0.14em' }}>ONLY 12 LEFT</div>
      <div style={{ fontSize: 16, color: '#fff', fontWeight: 900, letterSpacing: '-0.02em' }}>The Drop</div>
      <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
        {['02','47','33'].map((n,i) => (
          <React.Fragment key={i}>
            <div style={{ width: 26, height: 28, background: '#1c1c1c', border: '1px solid #333', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 900 }}>{n}</div>
            {i < 2 && <div style={{ color: '#f97316', fontSize: 14, fontWeight: 900, alignSelf: 'center' }}>:</div>}
          </React.Fragment>
        ))}
      </div>
      <div style={{ marginTop: 6, height: 22, background: '#f97316', borderRadius: 4, padding: '0 14px', display: 'flex', alignItems: 'center', color: '#000', fontSize: 9, fontWeight: 900 }}>CLAIM NOW</div>
    </div>
  );

  if (id === 'offer-announce') return (
    <div style={{ ...s, background: accent, gap: 4 }}>
      <div style={{ fontSize: 32, color: '#fff', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1 }}>40% OFF</div>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.95)', fontWeight: 700, marginTop: 2 }}>Premium Plan</div>
      <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.7)', fontWeight: 600, letterSpacing: '0.08em' }}>TODAY ONLY</div>
      <div style={{ marginTop: 6, height: 24, background: '#fff', borderRadius: 6, padding: '0 16px', display: 'flex', alignItems: 'center', color: '#0f172a', fontSize: 9, fontWeight: 800 }}>Get Deal →</div>
    </div>
  );

  if (id === 'price-compare') return (
    <div style={{ ...s, background: '#fff', gap: 6 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 600 }}>WAS</div>
          <div style={{ fontSize: 18, color: '#94a3b8', fontWeight: 700, textDecoration: 'line-through' }}>$199</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <div style={{ fontSize: 9, color: accent, fontWeight: 800 }}>NOW</div>
          <div style={{ fontSize: 26, color: accent, fontWeight: 900, letterSpacing: '-0.03em' }}>$99</div>
        </div>
      </div>
      <div style={{ background: accent, color: '#fff', fontSize: 9, fontWeight: 800, padding: '3px 10px', borderRadius: 12, marginTop: 4 }}>SAVE $100</div>
      <div style={{ marginTop: 4, height: 22, background: '#0f172a', borderRadius: 5, padding: '0 14px', display: 'flex', alignItems: 'center', color: '#fff', fontSize: 9, fontWeight: 700 }}>Buy Now</div>
    </div>
  );

  if (id === 'award-winner') return (
    <div style={{ ...s, background: '#0f172a', gap: 6 }}>
      <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#fbbf24', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, color: '#0f172a' }}>★</div>
      <div style={{ fontSize: 18, color: '#fff', fontWeight: 900, letterSpacing: '-0.02em' }}>VOTED #1</div>
      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.55)', fontWeight: 500 }}>Best in Category</div>
      <div style={{ fontSize: 8, color: '#fbbf24', fontWeight: 700, padding: '2px 8px', border: '1px solid #fbbf24', borderRadius: 10 }}>2026</div>
      <div style={{ marginTop: 4, height: 22, background: '#fbbf24', borderRadius: 5, padding: '0 14px', display: 'flex', alignItems: 'center', color: '#0f172a', fontSize: 9, fontWeight: 800 }}>See Why</div>
    </div>
  );

  if (id === 'founder-story') return (
    <div style={{ ...s, background: '#fef3c7', gap: 6 }}>
      <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#92400e', color: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800 }}>SR</div>
      <div style={{ fontSize: 12, color: '#451a03', fontWeight: 800 }}>Sarah R., Founder</div>
      <div style={{ fontStyle: 'italic', fontSize: 10, color: '#78350f', textAlign: 'center', lineHeight: 1.3, padding: '0 8px' }}>"I built this because I needed it..."</div>
      <div style={{ width: 60, height: 1, background: '#92400e' }} />
      <div style={{ marginTop: 4, height: 22, background: '#92400e', borderRadius: 5, padding: '0 14px', display: 'flex', alignItems: 'center', color: '#fef3c7', fontSize: 9, fontWeight: 700 }}>Read Story</div>
    </div>
  );

  if (id === 'review-card') return (
    <div style={{ ...s, background: '#fff', gap: 6, alignItems: 'flex-start', padding: 18 }}>
      <div style={{ fontSize: 14, color: '#fbbf24', letterSpacing: 1 }}>★★★★★</div>
      <div style={{ fontSize: 11, color: '#0f172a', fontWeight: 600, lineHeight: 1.3 }}>"Genuinely changed how I work — worth every cent."</div>
      <div style={{ fontSize: 9, color: '#64748b', fontWeight: 600 }}>— Maya K. <span style={{ color: '#10b981' }}>✓ Verified Buyer</span></div>
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, background: accent }} />
    </div>
  );

  if (id === 'trust-bar') return (
    <div style={{ ...s, background: '#fff', flexDirection: 'row', gap: 0, padding: 0 }}>
      {[['10K+','Customers'],['4.9★','Rating'],['99%','Retention']].map(([n,l],i) => (
        <React.Fragment key={i}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
            <div style={{ fontSize: 18, color: accent, fontWeight: 900, letterSpacing: '-0.03em' }}>{n}</div>
            <div style={{ fontSize: 8, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{l}</div>
          </div>
          {i < 2 && <div style={{ width: 1, height: 50, background: '#e2e8f0', alignSelf: 'center' }} />}
        </React.Fragment>
      ))}
    </div>
  );

  if (id === 'news-frame') return (
    <div style={{ ...s, background: '#fff', alignItems: 'flex-start', padding: 18, gap: 5, borderTop: `3px solid ${accent}` }}>
      <div style={{ fontSize: 8, color: accent, fontWeight: 800, letterSpacing: '0.16em' }}>BREAKING</div>
      <div style={{ fontSize: 13, color: '#0f172a', fontWeight: 800, lineHeight: 1.2 }}>The Industry Is Shifting — Here's What You Need To Know</div>
      <div style={{ fontSize: 8, color: '#94a3b8', fontWeight: 500, marginTop: 4 }}>May 4, 2026 · 4 min read</div>
    </div>
  );

  if (id === 'video-thumbnail') return (
    <div style={{ ...s, background: 'linear-gradient(160deg,#0f172a,#1e293b)', gap: 8 }}>
      <div style={{ width: 50, height: 50, borderRadius: '50%', background: 'rgba(255,255,255,0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
        <div style={{ width: 0, height: 0, borderLeft: '14px solid #0f172a', borderTop: '8px solid transparent', borderBottom: '8px solid transparent', marginLeft: 4 }} />
      </div>
      <div style={{ fontSize: 11, color: '#fff', fontWeight: 700, textAlign: 'center' }}>How We 10× Our Output</div>
      <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)' }}>248K views · 12:48</div>
    </div>
  );

  if (id === 'community-quote') return (
    <div style={{ ...s, background: '#f1f5f9', alignItems: 'flex-start', padding: 14, gap: 5 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ width: 18, height: 18, borderRadius: '50%', background: accent }} />
        <div style={{ fontSize: 9, color: '#0f172a', fontWeight: 700 }}>u/curious_dev</div>
        <div style={{ fontSize: 9, color: '#64748b' }}>↑ 2.4k</div>
      </div>
      <div style={{ fontSize: 11, color: '#0f172a', fontWeight: 700, lineHeight: 1.25 }}>"Honestly the best switch I've made all year"</div>
      <div style={{ fontSize: 8, color: '#64748b' }}>r/productivity · 142 comments</div>
    </div>
  );

  if (id === 'stat-study') return (
    <div style={{ ...s, background: '#fff', gap: 4 }}>
      <div style={{ fontSize: 9, color: accent, fontWeight: 800, letterSpacing: '0.12em' }}>NEW STUDY</div>
      <div style={{ fontSize: 40, color: accent, fontWeight: 900, lineHeight: 1, letterSpacing: '-0.04em' }}>73%</div>
      <div style={{ fontSize: 10, color: '#0f172a', fontWeight: 600, textAlign: 'center', padding: '0 12px' }}>of users report better results in week one</div>
      <div style={{ fontSize: 7, color: '#94a3b8', marginTop: 4 }}>Source: Internal Survey 2026</div>
    </div>
  );

  if (id === 'caption-style') return (
    <div style={{ ...s, background: '#000', padding: 0, gap: 0 }}>
      <div style={{ flex: 1.4, background: 'linear-gradient(160deg,#1e293b,#0f172a)' }} />
      <div style={{ flex: 1, padding: 12, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4 }}>
        <div style={{ fontSize: 11, color: '#fff', fontWeight: 700, lineHeight: 1.2, textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}>"It actually saved me hours."</div>
        <div style={{ fontSize: 11, color: '#fff', fontWeight: 700, lineHeight: 1.2, textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}>Try it free →</div>
        <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>@maya · Follow</div>
      </div>
    </div>
  );

  if (id === 'chat-thread') return (
    <div style={{ ...s, background: '#fff', alignItems: 'stretch', padding: 14, gap: 6, justifyContent: 'center' }}>
      <div style={{ alignSelf: 'flex-end', maxWidth: '80%', background: '#3b82f6', color: '#fff', fontSize: 10, padding: '6px 10px', borderRadius: '12px 12px 2px 12px', fontWeight: 600 }}>Does X actually work?</div>
      <div style={{ alignSelf: 'flex-start', maxWidth: '80%', background: '#e2e8f0', color: '#0f172a', fontSize: 10, padding: '6px 10px', borderRadius: '12px 12px 12px 2px', fontWeight: 600 }}>Life changing honestly 🙌</div>
      <div style={{ fontSize: 7, color: '#94a3b8', textAlign: 'center', marginTop: 2 }}>2:47 PM</div>
    </div>
  );

  if (id === 'meme-format') return (
    <div style={{ ...s, background: '#fff', justifyContent: 'space-between', padding: 12 }}>
      <div style={{ fontSize: 13, color: '#000', fontWeight: 900, textTransform: 'uppercase', textAlign: 'center', lineHeight: 1.1, letterSpacing: '-0.01em' }}>WHEN YOU FINALLY TRY IT</div>
      <div style={{ width: '100%', flex: 1, background: '#cbd5e1', borderRadius: 4, margin: '6px 0' }} />
      <div style={{ fontSize: 13, color: '#000', fontWeight: 900, textTransform: 'uppercase', textAlign: 'center', lineHeight: 1.1, letterSpacing: '-0.01em' }}>WHY DIDN'T I SOONER??</div>
    </div>
  );

  if (id === 'comment-reply') return (
    <div style={{ ...s, background: '#000', padding: 0, gap: 0 }}>
      <div style={{ padding: '10px 12px 0' }}>
        <div style={{ display: 'inline-block', background: accent, color: '#fff', fontSize: 8, fontWeight: 700, padding: '3px 8px', borderRadius: 12 }}>Replying to @user</div>
      </div>
      <div style={{ flex: 1, margin: '8px 12px', background: 'linear-gradient(160deg,#1e293b,#0f172a)', borderRadius: 4 }} />
      <div style={{ padding: '0 12px 12px', fontSize: 11, color: '#fff', fontWeight: 700, lineHeight: 1.2 }}>Here's what actually happened...</div>
    </div>
  );

  if (id === 'poll-card') return (
    <div style={{ ...s, background: 'linear-gradient(160deg,#312e81,#1e1b4b)', gap: 6 }}>
      <div style={{ fontSize: 12, color: '#fff', fontWeight: 800, textAlign: 'center', padding: '0 8px' }}>Which would you pick?</div>
      <div style={{ display: 'flex', gap: 6, width: '90%' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ background: 'rgba(255,255,255,0.95)', color: '#1e1b4b', fontSize: 9, fontWeight: 800, padding: '6px 8px', borderRadius: 6, textAlign: 'center' }}>OPTION A</div>
          <div style={{ height: 3, background: 'rgba(255,255,255,0.25)', borderRadius: 2 }}><div style={{ height: '100%', width: '62%', background: accent, borderRadius: 2 }} /></div>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: 9, fontWeight: 800, padding: '6px 8px', borderRadius: 6, textAlign: 'center', border: '1px solid rgba(255,255,255,0.3)' }}>OPTION B</div>
          <div style={{ height: 3, background: 'rgba(255,255,255,0.25)', borderRadius: 2 }}><div style={{ height: '100%', width: '38%', background: accent, borderRadius: 2 }} /></div>
        </div>
      </div>
    </div>
  );

  if (id === 'hot-take') return (
    <div style={{ ...s, background: accent, gap: 5 }}>
      <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)', fontWeight: 800, letterSpacing: '0.16em' }}>🔥 HOT TAKE</div>
      <div style={{ fontSize: 16, color: '#fff', fontWeight: 900, textAlign: 'center', lineHeight: 1.1, padding: '0 14px', letterSpacing: '-0.02em' }}>Most "productivity tools" make you slower.</div>
      <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.7)', fontWeight: 600, marginTop: 4 }}>Do you agree?</div>
    </div>
  );

  if (id === 'leaderboard') return (
    <div style={{ ...s, background: '#fff', alignItems: 'flex-start', padding: 16, gap: 5 }}>
      <div style={{ fontSize: 9, color: '#0f172a', fontWeight: 800, letterSpacing: '0.12em' }}>TOP PICKS</div>
      {[['01','★','#fbbf24','Premium Pro'],['02','','#94a3b8','Standard'],['03','','#b45309','Lite'],['04','','#cbd5e1','Free']].map(([n,star,c,l],i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
          <div style={{ fontSize: 11, fontWeight: 900, color: c as string, width: 18 }}>{n}</div>
          {star && <div style={{ fontSize: 10, color: c as string }}>{star}</div>}
          <div style={{ fontSize: 9, color: '#0f172a', fontWeight: 600 }}>{l}</div>
        </div>
      ))}
    </div>
  );

  if (id === 'checklist-viral') return (
    <div style={{ ...s, background: '#fff', alignItems: 'flex-start', padding: 16, gap: 5 }}>
      <div style={{ fontSize: 10, color: '#0f172a', fontWeight: 800 }}>Check what applies:</div>
      {[['✓','#16a34a','Always tired by 3pm'],['✓','#16a34a','Brain fog after meals'],['✗','#dc2626','Sleep through the night'],['✓','#16a34a','Crave sugar daily']].map(([m,c,t],i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ fontSize: 11, color: c as string, fontWeight: 900 }}>{m}</div>
          <div style={{ fontSize: 9, color: '#334155', fontWeight: 500 }}>{t}</div>
        </div>
      ))}
      <div style={{ marginTop: 4, height: 20, background: accent, borderRadius: 4, padding: '0 12px', display: 'flex', alignItems: 'center', color: '#fff', fontSize: 8, fontWeight: 800 }}>How many?</div>
    </div>
  );

  if (id === 'myth-reality') return (
    <div style={{ ...s, flexDirection: 'row', padding: 0, gap: 0 }}>
      <div style={{ flex: 1, background: '#0f172a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
        <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.55)', fontWeight: 800, letterSpacing: '0.14em' }}>MYTH</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', fontWeight: 900, textDecoration: 'line-through' }}>More hours</div>
      </div>
      <div style={{ flex: 1, background: accent, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
        <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.85)', fontWeight: 800, letterSpacing: '0.14em' }}>REALITY</div>
        <div style={{ fontSize: 13, color: '#fff', fontWeight: 900 }}>Better focus</div>
      </div>
    </div>
  );

  if (id === 'event-card') return (
    <div style={{ ...s, background: '#0f172a', gap: 5 }}>
      <div style={{ width: 32, height: 32, background: accent, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>📅</div>
      <div style={{ fontSize: 13, color: '#fff', fontWeight: 800, textAlign: 'center', padding: '0 12px', lineHeight: 1.2 }}>Free Live Workshop</div>
      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>May 15 · 2PM EST</div>
      <div style={{ marginTop: 4, height: 22, background: accent, borderRadius: 5, padding: '0 14px', display: 'flex', alignItems: 'center', color: '#fff', fontSize: 9, fontWeight: 800 }}>Register Free →</div>
    </div>
  );

  if (id === 'three-reasons') return (
    <div style={{ ...s, background: '#fff', alignItems: 'flex-start', padding: 14, gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <div style={{ fontSize: 36, color: accent, fontWeight: 900, lineHeight: 1, letterSpacing: '-0.05em' }}>3</div>
        <div style={{ fontSize: 11, color: '#0f172a', fontWeight: 800 }}>Reasons Why</div>
      </div>
      {[['01','Faster'],['02','Cheaper'],['03','Better']].map(([n,t],i) => (
        <div key={i} style={{ width: '100%' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '3px 0' }}>
            <div style={{ fontSize: 8, color: accent, fontWeight: 800 }}>{n}</div>
            <div style={{ fontSize: 9, color: '#334155', fontWeight: 700 }}>{t}</div>
          </div>
          {i < 2 && <div style={{ height: 1, background: '#e2e8f0' }} />}
        </div>
      ))}
    </div>
  );

  if (id === 'timeline-journey') return (
    <div style={{ ...s, background: '#fff', gap: 6 }}>
      <div style={{ fontSize: 10, color: '#0f172a', fontWeight: 800 }}>Your Journey</div>
      <div style={{ display: 'flex', alignItems: 'center', position: 'relative', width: '85%' }}>
        <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 2, background: '#e2e8f0' }} />
        {[1,2,3,4].map((n,i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', zIndex: 1 }}>
            <div style={{ width: 18, height: 18, borderRadius: '50%', background: i === 0 ? accent : '#e2e8f0', color: i === 0 ? '#fff' : '#94a3b8', fontSize: 8, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #fff' }}>{n}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', width: '85%', justifyContent: 'space-between', fontSize: 7, color: '#94a3b8', fontWeight: 600 }}>
        <span>Start</span><span>Learn</span><span>Apply</span><span>Win</span>
      </div>
    </div>
  );

  if (id === 'brutalist') return (
    <div style={{ ...s, background: '#fff', border: '3px solid #000', alignItems: 'flex-start', padding: 14, gap: 5 }}>
      <div style={{ fontSize: 24, color: '#000', fontWeight: 900, lineHeight: 0.95, letterSpacing: '-0.04em' }}>NO BS.</div>
      <div style={{ fontSize: 24, color: '#000', fontWeight: 900, lineHeight: 0.95, letterSpacing: '-0.04em' }}>JUST RESULTS.</div>
      <div style={{ height: 2, background: '#000', width: '100%' }} />
      <div style={{ fontSize: 9, color: '#000', fontWeight: 700 }}>Built for those who get it.</div>
    </div>
  );

  if (id === 'collage-cutout') return (
    <div style={{ ...s, background: '#faf5e9', position: 'relative' }}>
      <div style={{ position: 'absolute', top: 30, left: 24, width: 70, height: 50, background: accent, transform: 'rotate(-6deg)' }} />
      <div style={{ position: 'absolute', top: 50, left: 60, width: 70, height: 50, background: '#0f172a', transform: 'rotate(4deg)' }} />
      <div style={{ position: 'absolute', top: 70, left: 90, width: 60, height: 40, background: '#94a3b8', transform: 'rotate(-3deg)' }} />
      <div style={{ position: 'relative', zIndex: 2, fontSize: 13, fontWeight: 900, color: '#0f172a', background: '#faf5e9', padding: '4px 8px', letterSpacing: '-0.02em' }}>Hand-crafted vibes</div>
    </div>
  );

  if (id === 'aurora-gradient') return (
    <div style={{ ...s, background: 'linear-gradient(135deg, #c084fc 0%, #818cf8 30%, #38bdf8 60%, #34d399 100%)', gap: 6 }}>
      <div style={{ fontSize: 18, color: '#fff', fontWeight: 900, letterSpacing: '-0.03em', textAlign: 'center', textShadow: '0 2px 12px rgba(0,0,0,0.2)' }}>Beyond Ordinary</div>
      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>Made for visionaries</div>
      <div style={{ marginTop: 4, height: 22, background: 'rgba(255,255,255,0.25)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.4)', borderRadius: 11, padding: '0 14px', display: 'flex', alignItems: 'center', color: '#fff', fontSize: 9, fontWeight: 700 }}>Explore →</div>
    </div>
  );

  if (id === 'duotone-photo') return (
    <div style={{ ...s, padding: 0, position: 'relative' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg,#1e1b4b,#312e81)' }} />
      <div style={{ position: 'absolute', inset: 0, background: accent, opacity: 0.55, mixBlendMode: 'screen' }} />
      <div style={{ position: 'relative', zIndex: 2, fontSize: 16, color: '#fff', fontWeight: 900, textAlign: 'center', padding: '0 16px', letterSpacing: '-0.03em' }}>Bold Vision Required</div>
    </div>
  );

  if (id === 'mono-editorial') return (
    <div style={{ ...s, background: '#fff', alignItems: 'flex-start', padding: 18, gap: 6 }}>
      <div style={{ fontFamily: 'Georgia, serif', fontSize: 18, color: '#000', fontStyle: 'italic', lineHeight: 1.15, letterSpacing: '-0.02em' }}>The future, rewritten.</div>
      <div style={{ height: 1, background: '#000', width: 60 }} />
      <div style={{ fontFamily: 'Georgia, serif', fontSize: 9, color: '#000', lineHeight: 1.4 }}>An essay on what comes next, and why it matters now.</div>
    </div>
  );

  if (id === 'risograph-print') return (
    <div style={{ ...s, background: '#fafaf0', position: 'relative' }}>
      <div style={{ position: 'absolute', top: 32, left: 30, width: 80, height: 60, background: '#f43f5e', opacity: 0.85 }} />
      <div style={{ position: 'absolute', top: 42, left: 46, width: 80, height: 60, background: '#0d9488', opacity: 0.7 }} />
      <div style={{ position: 'absolute', top: 52, left: 62, width: 80, height: 60, background: '#fbbf24', opacity: 0.65 }} />
      <div style={{ position: 'relative', zIndex: 2, fontSize: 12, color: '#0f172a', fontWeight: 900, background: '#fafaf0', padding: '4px 8px', letterSpacing: '-0.02em' }}>Print Vibes</div>
    </div>
  );

  if (id === 'chart-reveal') return (
    <div style={{ ...s, background: '#fff', gap: 6 }}>
      <div style={{ fontSize: 8, color: accent, fontWeight: 800, letterSpacing: '0.14em' }}>RESULTS</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 50 }}>
        {[20,32,45,60].map((h,i) => (
          <div key={i} style={{ width: 14, height: h, background: i === 3 ? accent : 'rgba(0,0,0,0.15)', borderRadius: '2px 2px 0 0' }} />
        ))}
      </div>
      <div style={{ fontSize: 18, color: accent, fontWeight: 900, letterSpacing: '-0.03em' }}>+247%</div>
      <div style={{ fontSize: 7, color: '#94a3b8' }}>YoY growth · Source: Q1 report</div>
    </div>
  );

  if (id === 'steps-infographic') return (
    <div style={{ ...s, background: '#fff', gap: 6 }}>
      <div style={{ fontSize: 9, color: '#0f172a', fontWeight: 800 }}>How it works</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {[1,2,3,4].map((n,i) => (
          <React.Fragment key={i}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <div style={{ width: 22, height: 22, borderRadius: '50%', background: accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 900 }}>{n}</div>
              <div style={{ fontSize: 7, color: '#64748b', fontWeight: 600 }}>Step</div>
            </div>
            {i < 3 && <div style={{ fontSize: 10, color: '#cbd5e1' }}>→</div>}
          </React.Fragment>
        ))}
      </div>
      <div style={{ marginTop: 4, height: 20, background: accent, borderRadius: 4, padding: '0 12px', display: 'flex', alignItems: 'center', color: '#fff', fontSize: 8, fontWeight: 800 }}>Get Started</div>
    </div>
  );

  if (id === 'vs-table') return (
    <div style={{ ...s, background: '#fff', alignItems: 'stretch', padding: 14, gap: 0, justifyContent: 'center' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: 4, fontSize: 8, color: '#94a3b8', fontWeight: 700, padding: '4px 0', borderBottom: '1px solid #e2e8f0' }}>
        <div>Feature</div><div style={{ textAlign: 'center', color: accent }}>Us</div><div style={{ textAlign: 'center' }}>Them</div>
      </div>
      {['Speed','Price','Support','Quality'].map((f,i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: 4, fontSize: 9, color: '#0f172a', fontWeight: 600, padding: '3px 0', borderBottom: i < 3 ? '1px solid #f1f5f9' : 'none' }}>
          <div>{f}</div><div style={{ textAlign: 'center', color: accent, fontWeight: 900 }}>✓</div><div style={{ textAlign: 'center', color: '#cbd5e1' }}>✗</div>
        </div>
      ))}
    </div>
  );

  if (id === 'flat-lay') return (
    <div style={{ ...s, background: '#fff', gap: 6 }}>
      <div style={{ width: 80, height: 60, background: 'linear-gradient(135deg,#f1f5f9,#e2e8f0)', borderRadius: 6, boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }} />
      <div style={{ fontSize: 10, color: '#0f172a', fontWeight: 700 }}>The Essential Kit</div>
      <div style={{ fontSize: 9, color: accent, fontWeight: 800 }}>$49</div>
      <div style={{ marginTop: 2, height: 20, background: '#0f172a', borderRadius: 4, padding: '0 12px', display: 'flex', alignItems: 'center', color: '#fff', fontSize: 8, fontWeight: 700 }}>Shop Now</div>
    </div>
  );

  if (id === 'app-mockup') return (
    <div style={{ ...s, background: '#f8fafc', flexDirection: 'row', gap: 10 }}>
      <div style={{ width: 60, height: 100, border: '2px solid #0f172a', borderRadius: 10, padding: 4, background: '#fff', display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div style={{ height: 8, background: accent, borderRadius: 2 }} />
        <div style={{ height: 4, background: '#e2e8f0', borderRadius: 2 }} />
        <div style={{ height: 4, background: '#e2e8f0', borderRadius: 2, width: '70%' }} />
        <div style={{ height: 14, background: '#f1f5f9', borderRadius: 2, marginTop: 'auto' }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ fontSize: 11, color: '#0f172a', fontWeight: 800 }}>Your App</div>
        <div style={{ fontSize: 8, color: '#64748b' }}>iOS + Android</div>
        <div style={{ marginTop: 4, height: 20, background: accent, borderRadius: 4, padding: '0 10px', display: 'flex', alignItems: 'center', color: '#fff', fontSize: 8, fontWeight: 700 }}>Download</div>
      </div>
    </div>
  );

  if (id === 'photo-grid') return (
    <div style={{ ...s, padding: 8, gap: 0 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: 4, width: '100%', height: '100%' }}>
        {['linear-gradient(135deg,#fda4af,#f43f5e)','linear-gradient(135deg,#a5b4fc,#6366f1)','linear-gradient(135deg,#86efac,#16a34a)','linear-gradient(135deg,#fcd34d,#d97706)'].map((g,i) => (
          <div key={i} style={{ background: g, borderRadius: 4, border: '2px solid #fff', position: 'relative' }}>
            <div style={{ position: 'absolute', bottom: 2, left: 4, fontSize: 7, color: '#fff', fontWeight: 800 }}>0{i+1}</div>
          </div>
        ))}
      </div>
    </div>
  );

  if (id === 'brand-awareness') return (
    <div style={{ ...s, background: '#fff', gap: 8 }}>
      <div style={{ width: 48, height: 48, borderRadius: '50%', background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 20, fontWeight: 900 }}>B</div>
      <div style={{ fontSize: 10, color: '#64748b', fontWeight: 500, letterSpacing: '0.04em' }}>Built different.</div>
    </div>
  );

  if (id === 'tweet-screenshot') return (
    <div style={{ ...s, background: '#f8fafc', padding: 12 }}>
      <div style={{ width: '100%', background: '#fff', borderRadius: 10, padding: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column', gap: 5 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#0f172a' }} />
          <div style={{ fontSize: 9, color: '#0f172a', fontWeight: 800 }}>Maya K.</div>
          <div style={{ fontSize: 8, color: '#64748b' }}>@mayak</div>
          <div style={{ marginLeft: 'auto', fontSize: 11, color: '#0f172a', fontWeight: 900 }}>𝕏</div>
        </div>
        <div style={{ fontSize: 10, color: '#0f172a', fontWeight: 500, lineHeight: 1.3 }}>this changed my workflow honestly. just buy it.</div>
        <div style={{ height: 1, background: '#f1f5f9' }} />
        <div style={{ fontSize: 8, color: '#64748b', display: 'flex', gap: 8 }}><span>♡ 2.4k</span><span>🔁 847</span><span>📊 48k</span></div>
      </div>
    </div>
  );

  if (id === 'tiktok-native') return (
    <div style={{ ...s, background: '#000', flexDirection: 'row', padding: 0, gap: 0, alignItems: 'stretch' }}>
      <div style={{ width: 3, background: accent, height: '40%', alignSelf: 'flex-start', marginTop: 8 }} />
      <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: 10 }}>
        <div style={{ fontSize: 9, color: '#fff', fontWeight: 800 }}>@creator</div>
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', fontWeight: 500, marginTop: 2, lineHeight: 1.2 }}>POV: you finally tried it #fyp</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', padding: 10, gap: 8 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ fontSize: 14 }}>♥</div>
          <div style={{ fontSize: 7, color: '#fff', fontWeight: 700 }}>248K</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ fontSize: 14 }}>💬</div>
          <div style={{ fontSize: 7, color: '#fff', fontWeight: 700 }}>4.2K</div>
        </div>
        <div style={{ fontSize: 14 }}>↗</div>
      </div>
    </div>
  );

  if (id === 'reddit-thread') return (
    <div style={{ ...s, background: '#fff', flexDirection: 'row', padding: 10, gap: 8, alignItems: 'flex-start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        <div style={{ fontSize: 12, color: accent }}>▲</div>
        <div style={{ fontSize: 9, color: '#0f172a', fontWeight: 800 }}>14.2k</div>
        <div style={{ fontSize: 12, color: '#cbd5e1' }}>▼</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
        <div style={{ fontSize: 7, color: '#64748b' }}>r/buildinpublic · u/dev_anon</div>
        <div style={{ fontSize: 11, color: '#0f172a', fontWeight: 800, lineHeight: 1.2 }}>I built this in a weekend and it's making me $4k/mo</div>
        <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
          <div style={{ fontSize: 9 }}>🏆</div>
          <div style={{ fontSize: 9 }}>⭐</div>
          <div style={{ fontSize: 7, color: '#64748b', alignSelf: 'center', marginLeft: 'auto' }}>847 comments</div>
        </div>
      </div>
    </div>
  );

  if (id === 'email-mockup') return (
    <div style={{ ...s, background: '#fff', border: '1px solid #e2e8f0', alignItems: 'flex-start', padding: 14, gap: 6 }}>
      <div style={{ fontSize: 8, color: '#64748b', fontWeight: 500 }}>From: <span style={{ color: '#0f172a', fontWeight: 700 }}>Brand</span> &lt;hello@brand.com&gt;</div>
      <div style={{ height: 2, background: '#0f172a', width: '100%' }} />
      <div style={{ fontSize: 13, color: '#0f172a', fontWeight: 800, lineHeight: 1.2 }}>Your invitation is ready</div>
      <div style={{ fontSize: 9, color: '#94a3b8', lineHeight: 1.3 }}>Hi there — we wanted to share something we think you'll love. Click below to claim yours...</div>
      <div style={{ marginTop: 4, height: 22, background: accent, borderRadius: 4, padding: '0 14px', display: 'flex', alignItems: 'center', color: '#fff', fontSize: 9, fontWeight: 800 }}>Open Invite</div>
    </div>
  );

  if (id === 'receipt-style') return (
    <div style={{ ...s, background: '#fff', borderTop: '2px dashed #0f172a', borderBottom: '2px dashed #0f172a', alignItems: 'stretch', padding: 14, gap: 4, justifyContent: 'flex-start' }}>
      <div style={{ fontSize: 9, color: '#0f172a', fontWeight: 800, textAlign: 'center', letterSpacing: '0.14em' }}>ORDER RECEIPT</div>
      <div style={{ height: 1, background: '#e2e8f0', margin: '4px 0' }} />
      {[['Course access','$199'],['Templates','$ 99'],['Community','$ 49'],['Bonuses','$ 79']].map(([l,v],i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: '#334155' }}>
          <span>{l}</span>
          <span style={{ fontWeight: 700 }}>{v}</span>
        </div>
      ))}
      <div style={{ height: 2, background: '#0f172a', margin: '4px 0' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: 9, color: '#0f172a', fontWeight: 800 }}>TOTAL VALUE</span>
        <span style={{ fontSize: 16, color: accent, fontWeight: 900 }}>$426</span>
      </div>
      <div style={{ marginTop: 4, height: 20, background: accent, borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 8, fontWeight: 800 }}>GET ALL FOR $99</div>
    </div>
  );

  if (id === 'bundle-stack') return (
    <div style={{ ...s, background: '#f8fafc', position: 'relative' }}>
      <div style={{ fontSize: 8, color: accent, fontWeight: 800, letterSpacing: '0.14em', marginBottom: 6 }}>BUNDLE & SAVE</div>
      <div style={{ position: 'relative', width: 100, height: 60 }}>
        <div style={{ position: 'absolute', top: 0, left: 0, width: 60, height: 50, background: 'linear-gradient(135deg,#cbd5e1,#94a3b8)', borderRadius: 4, boxShadow: '0 4px 8px rgba(0,0,0,0.12)' }} />
        <div style={{ position: 'absolute', top: 5, left: 18, width: 60, height: 50, background: 'linear-gradient(135deg,#a5b4fc,#6366f1)', borderRadius: 4, boxShadow: '0 4px 8px rgba(0,0,0,0.12)' }} />
        <div style={{ position: 'absolute', top: 10, left: 36, width: 60, height: 50, background: accent, borderRadius: 4, boxShadow: '0 4px 8px rgba(0,0,0,0.18)' }} />
      </div>
      <div style={{ marginTop: 8, fontSize: 9, color: '#94a3b8', textDecoration: 'line-through' }}>$297</div>
      <div style={{ fontSize: 16, color: accent, fontWeight: 900, lineHeight: 1 }}>$129</div>
      <div style={{ marginTop: 4, height: 20, background: '#0f172a', borderRadius: 4, padding: '0 12px', display: 'flex', alignItems: 'center', color: '#fff', fontSize: 8, fontWeight: 700 }}>Get Bundle</div>
    </div>
  );

  // ── Creative angle-routed batch (testimonial-card … offer-drop) ─────────────

  if (id === 'testimonial-card') return (
    <div style={{ ...s, background: '#fff', gap: 8 }}>
      <div style={{ fontSize: 14, color: '#f59e0b', letterSpacing: 2 }}>★★★★★</div>
      <div style={{ fontSize: 22, color: '#94a3b8', lineHeight: 1, fontFamily: 'Georgia, serif' }}>"</div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <div style={{ height: 5, background: '#1e293b', borderRadius: 2, width: 130 }} />
        <div style={{ height: 5, background: '#1e293b', borderRadius: 2, width: 110 }} />
        <div style={{ height: 4, background: '#94a3b8', borderRadius: 2, width: 80 }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
        <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }} />
        <div style={{ height: 4, background: '#94a3b8', borderRadius: 2, width: 60 }} />
      </div>
      <div style={{ marginTop: 4, background: '#00b67a', borderRadius: 4, padding: '3px 8px', fontSize: 7, color: '#fff', fontWeight: 800, letterSpacing: '0.06em' }}>★ Trustpilot</div>
    </div>
  );

  if (id === 'versus-slide') return (
    <div style={{ ...s, flexDirection: 'row', padding: 0, gap: 0, position: 'relative' }}>
      <div style={{ flex: 1, height: '100%', background: '#111', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.45)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const }}>Without</div>
        <div style={{ height: 4, background: 'rgba(255,255,255,0.2)', borderRadius: 1, width: 55 }} />
        <div style={{ height: 4, background: 'rgba(255,255,255,0.12)', borderRadius: 1, width: 40 }} />
      </div>
      <div style={{ flex: 1, height: '100%', background: accent, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        <div style={{ fontSize: 8, color: '#fff', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const }}>With Us</div>
        <div style={{ height: 4, background: 'rgba(255,255,255,0.7)', borderRadius: 1, width: 55 }} />
        <div style={{ height: 4, background: 'rgba(255,255,255,0.5)', borderRadius: 1, width: 40 }} />
      </div>
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 26, height: 26, borderRadius: '50%', background: '#fff', border: `2px solid ${accent}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 900, color: '#111', boxShadow: '0 2px 8px rgba(0,0,0,0.3)', zIndex: 2 }}>VS</div>
    </div>
  );

  if (id === 'before-after-slide') return (
    <div style={{ ...s, flexDirection: 'column', padding: 0, gap: 0, position: 'relative' }}>
      <div style={{ flex: 1, width: '100%', background: 'linear-gradient(135deg,#1e293b,#334155)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
        <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.45)', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' as const }}>Before</div>
        <div style={{ height: 4, background: 'rgba(255,255,255,0.2)', borderRadius: 1, width: 70 }} />
      </div>
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 24, height: 24, borderRadius: '50%', background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#fff', fontWeight: 900, zIndex: 2, boxShadow: `0 2px 10px ${accent}88` }}>↓</div>
      <div style={{ flex: 1, width: '100%', background: `linear-gradient(135deg,${accent}cc,${accent})`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
        <div style={{ fontSize: 8, color: '#fff', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' as const }}>After</div>
        <div style={{ height: 4, background: 'rgba(255,255,255,0.75)', borderRadius: 1, width: 80 }} />
      </div>
    </div>
  );

  if (id === 'press-slide') return (
    <div style={{ ...s, background: '#fff', alignItems: 'center', padding: 16, gap: 6 }}>
      <div style={{ fontSize: 7, color: '#94a3b8', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' as const }}>As Seen In</div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
        {['Forbes','TechCrunch','Reuters'].map((name, i) => (
          <div key={i} style={{ fontSize: i === 0 ? 10 : 8, fontWeight: 900, color: i === 0 ? '#1e293b' : '#94a3b8', letterSpacing: i === 0 ? '-0.02em' : '0.04em', fontFamily: 'serif' }}>{name}</div>
        ))}
      </div>
      <div style={{ height: 1, background: '#e2e8f0', width: '90%' }} />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
        <div style={{ height: 5, background: '#334155', borderRadius: 2, width: 120 }} />
        <div style={{ height: 4, background: '#94a3b8', borderRadius: 2, width: 100 }} />
      </div>
      <div style={{ marginTop: 4, height: 20, background: accent, borderRadius: 4, padding: '0 12px', display: 'flex', alignItems: 'center', color: '#fff', fontSize: 8, fontWeight: 800 }}>Learn More</div>
    </div>
  );

  if (id === 'point-out-slide') return (
    <div style={{ ...s, background: '#f8fafc', flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 }}>
      <div style={{ width: 70, height: 70, borderRadius: 12, background: 'linear-gradient(135deg,#e2e8f0,#cbd5e1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative' }}>
        <div style={{ width: 30, height: 30, borderRadius: 6, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', opacity: 0.6 }} />
        {[{top:'12px',right:'10px'},{top:'34px',right:'6px'},{top:'54px',right:'14px'}].map((pos,i) => (
          <div key={i} style={{ position: 'absolute', ...pos as any, width: 7, height: 7, borderRadius: '50%', background: accent, border: '1.5px solid #fff', boxShadow: `0 0 0 2px ${accent}44` }} />
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {['Feature A','Feature B','Feature C'].map((label, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: accent }} />
            <div style={{ height: 4, background: '#94a3b8', borderRadius: 1, width: [55,45,60][i] }} />
          </div>
        ))}
      </div>
    </div>
  );

  if (id === 'gallery-slide') return (
    <div style={{ ...s, padding: 0, gap: 0, flexDirection: 'column' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', flex: 1, width: '100%' }}>
        {[`${accent}cc`,`${accent}99`,`${accent}77`,`${accent}55`].map((c, i) => (
          <div key={i} style={{ background: c, display: 'flex', alignItems: 'center', justifyContent: 'center', aspectRatio: '1' }}>
            <div style={{ width: 20, height: 20, borderRadius: 4, background: 'rgba(255,255,255,0.25)' }} />
          </div>
        ))}
      </div>
      <div style={{ height: 32, background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '0 12px', width: '100%' }}>
        <div style={{ height: 5, background: '#fff', borderRadius: 2, width: 80 }} />
        <div style={{ height: 18, background: accent, borderRadius: 4, width: 44 }} />
      </div>
    </div>
  );

  if (id === 'chat-native') return (
    <div style={{ ...s, background: '#f2f2f7', justifyContent: 'flex-start', padding: 10, gap: 7 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingBottom: 6, borderBottom: '1px solid rgba(0,0,0,0.08)', width: '100%' }}>
        <div style={{ width: 20, height: 20, borderRadius: '50%', background: accent }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ height: 4, background: '#1c1c1e', borderRadius: 1, width: 55 }} />
          <div style={{ height: 3, background: '#8e8e93', borderRadius: 1, width: 35 }} />
        </div>
      </div>
      {/* User bubble */}
      <div style={{ alignSelf: 'flex-end', background: accent, borderRadius: '16px 16px 4px 16px', padding: '5px 9px', maxWidth: '75%' }}>
        <div style={{ height: 4, background: 'rgba(255,255,255,0.8)', borderRadius: 1, width: 70 }} />
      </div>
      {/* Brand reply */}
      <div style={{ alignSelf: 'flex-start', background: '#fff', borderRadius: '16px 16px 16px 4px', padding: '5px 9px', maxWidth: '80%', display: 'flex', flexDirection: 'column', gap: 3, boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }}>
        <div style={{ height: 4, background: '#1c1c1e', borderRadius: 1, width: 90 }} />
        <div style={{ height: 3, background: '#8e8e93', borderRadius: 1, width: 70 }} />
      </div>
    </div>
  );

  if (id === 'offer-drop') return (
    <div style={{ ...s, background: '#0f172a', gap: 8, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: '120%', height: '120%', background: `radial-gradient(ellipse at 50% 40%, ${accent}33 0%, transparent 65%)`, pointerEvents: 'none' }} />
      <div style={{ background: `${accent}22`, border: `1px solid ${accent}55`, borderRadius: 20, padding: '3px 10px', fontSize: 8, color: accent, fontWeight: 700, letterSpacing: '0.08em', position: 'relative' }}>FLASH SALE</div>
      <div style={{ width: 80, height: 80, borderRadius: '50%', border: `3px solid ${accent}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0, position: 'relative', boxShadow: `0 0 24px ${accent}44` }}>
        <div style={{ fontSize: 8, color: accent, fontWeight: 700, letterSpacing: '0.1em' }}>SAVE</div>
        <div style={{ fontSize: 24, color: '#fff', fontWeight: 900, lineHeight: 1, letterSpacing: '-0.04em' }}>40%</div>
      </div>
      <div style={{ height: 22, background: accent, borderRadius: 6, padding: '0 14px', display: 'flex', alignItems: 'center', color: '#fff', fontSize: 9, fontWeight: 800, position: 'relative', boxShadow: `0 4px 14px ${accent}55` }}>Claim Offer →</div>
    </div>
  );

  // Default gradient fallback for any unlisted template
  const bgs: Record<string, string> = {
    bold:      'linear-gradient(135deg, #1c1917 0%, #292524 100%)',
    minimal:   'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
    premium:   'linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #854d0e 100%)',
    friendly:  'linear-gradient(135deg, #0c4a6e 0%, #0369a1 100%)',
    urgent:    'linear-gradient(135deg, #450a0a 0%, #dc2626 100%)',
    energetic: 'linear-gradient(135deg, #431407 0%, #ea580c 100%)',
  };

  return (
    <div style={{ ...s, background: bgs[tone] ?? bgs.bold, gap: 8 }}>
      <div style={{ height: 10, background: isLight ? '#1e293b' : '#fff', borderRadius: 2, width: 120 }} />
      <div style={{ height: 6, background: isLight ? '#64748b' : 'rgba(255,255,255,0.5)', borderRadius: 2, width: 90 }} />
      <div style={{ marginTop: 6, height: 24, background: isLight ? '#1e293b' : '#fff', borderRadius: 6, width: 80 }} />
    </div>
  );
}

// ─── Carousel slide preview (animated) ───────────────────────────────────────

const TEMPLATE_STYLES: Record<string, { bg: string; light: boolean }> = {
  'full-bleed':         { bg: '#92400e',   light: false },
  'bold-headline':      { bg: '#000000',   light: false },
  'minimal':            { bg: '#ffffff',   light: true  },
  'ugc-style':          { bg: '#fafafa',   light: true  },
  'testimonial':        { bg: '#ffffff',   light: true  },
  'stats-hero':         { bg: '#020617',   light: false },
  'feature-list':       { bg: '#ffffff',   light: true  },
  'cta-final':          { bg: '#7f1d1d',   light: false },
  'gradient-pop':       { bg: '#4f46e5',   light: false },
  'dark-luxury':        { bg: '#0a0f1e',   light: false },
  'bright-minimal':     { bg: '#ffffff',   light: true  },
  'story-hook':         { bg: '#064e3b',   light: false },
  'problem-slide':      { bg: '#3b0a0a',   light: false },
  'text-only-bold':     { bg: '#f8fafc',   light: true  },
  'product-center':     { bg: '#f8fafc',   light: true  },
  'neon-dark':          { bg: '#020617',   light: false },
  'magazine-editorial': { bg: '#ffffff',   light: true  },
  'color-block':        { bg: '#f8fafc',   light: true  },
  'floating-card':      { bg: '#052e16',   light: false },
  'countdown-urgency':  { bg: '#7f1d1d',   light: false },
  'social-proof-grid':  { bg: '#ffffff',   light: true  },
  'headline-badge':     { bg: '#18181b',   light: false },
  'side-by-side':       { bg: '#ffffff',   light: true  },
  'diagonal-split':     { bg: '#1c1917',   light: false },
  'overlay-card':       { bg: '#0f172a',   light: false },
  'number-list':        { bg: '#ffffff',   light: true  },
  'brand-manifesto':    { bg: '#18181b',   light: false },
  'product-demo':       { bg: '#f8fafc',   light: true  },
  'retro-bold':         { bg: '#fef3c7',   light: true  },
  'split-panel':        { bg: '#f8fafc',   light: true  },
  'offer-stack':        { bg: '#991b1b',   light: false },
  'value-math':         { bg: '#0c1a3a',   light: false },
  'case-study':         { bg: '#ffffff',   light: true  },
  'insight-frame':      { bg: '#ffffff',   light: true  },
  'pain-diagnostic':    { bg: '#0f0a1a',   light: false },
  'mistake-alert':      { bg: '#431407',   light: false },
  'empathy-card':       { bg: '#fdf2f8',   light: true  },
  'validation-card':    { bg: '#ede9fe',   light: true  },
  'do-dont':            { bg: '#ffffff',   light: true  },
  'transform-split':    { bg: '#ffffff',   light: true  },
  // ── Batch 5 ───────────────────────────────────────────────────────────────────
  'guarantee-badge':    { bg: '#f0fdf4',   light: true  },
  'free-trial':         { bg: '#f0f9ff',   light: true  },
  'limited-drop':       { bg: '#0a0a0a',   light: false },
  'offer-announce':     { bg: '#7c1d1d',   light: false },
  'price-compare':      { bg: '#ffffff',   light: true  },
  'bundle-stack':       { bg: '#fafaf9',   light: true  },
  'award-winner':       { bg: '#1c1400',   light: false },
  'founder-story':      { bg: '#fef3c7',   light: true  },
  'review-card':        { bg: '#ffffff',   light: true  },
  'trust-bar':          { bg: '#ffffff',   light: true  },
  'news-frame':         { bg: '#ffffff',   light: true  },
  'video-thumbnail':    { bg: '#000000',   light: false },
  'community-quote':    { bg: '#f8fafc',   light: true  },
  'stat-study':         { bg: '#ffffff',   light: true  },
  'caption-style':      { bg: '#0a0a0a',   light: false },
  'chat-thread':        { bg: '#f0fdf4',   light: true  },
  'meme-format':        { bg: '#ffffff',   light: true  },
  'comment-reply':      { bg: '#fff7ed',   light: true  },
  'poll-card':          { bg: '#1a1a2e',   light: false },
  'hot-take':           { bg: '#1c0505',   light: false },
  'leaderboard':        { bg: '#ffffff',   light: true  },
  'checklist-viral':    { bg: '#ffffff',   light: true  },
  'myth-reality':       { bg: '#0f0720',   light: false },
  'event-card':         { bg: '#1e0a3c',   light: false },
  'three-reasons':      { bg: '#ffffff',   light: true  },
  'timeline-journey':   { bg: '#ffffff',   light: true  },
  'tiktok-native':      { bg: '#000000',   light: false },
  'tweet-screenshot':   { bg: '#ffffff',   light: true  },
  'reddit-thread':      { bg: '#f8fafc',   light: true  },
  'email-mockup':       { bg: '#ffffff',   light: true  },
  'receipt-style':      { bg: '#fefce8',   light: true  },
  'aurora-gradient':    { bg: '#0d0221',   light: false },
  'duotone-photo':      { bg: '#0d0a1e',   light: false },
  'mono-editorial':     { bg: '#ffffff',   light: true  },
  'risograph-print':    { bg: '#fef9c3',   light: true  },
  'collage-cutout':     { bg: '#f8fafc',   light: true  },
  'brutalist':          { bg: '#e7e5e4',   light: true  },
  'chart-reveal':       { bg: '#ffffff',   light: true  },
  'steps-infographic':  { bg: '#ffffff',   light: true  },
  'vs-table':           { bg: '#ffffff',   light: true  },
  'flat-lay':           { bg: '#faf7f5',   light: true  },
  'app-mockup':         { bg: '#f0f9ff',   light: true  },
  'photo-grid':         { bg: '#ffffff',   light: true  },
  'brand-awareness':    { bg: '#18181b',   light: false },
  // ── Creative angle batch ──────────────────────────────────────────────────────
  'testimonial-card':   { bg: '#ffffff',   light: true  },
  'versus-slide':       { bg: '#f0ebe0',   light: true  },
  'before-after-slide': { bg: '#f0ebe0',   light: true  },
  'press-slide':        { bg: '#111111',   light: false },
  'point-out-slide':    { bg: '#111111',   light: false },
  'gallery-slide':      { bg: '#ffffff',   light: true  },
  'chat-native':        { bg: '#f2f2f7',   light: true  },
  'offer-drop':         { bg: '#0f172a',   light: false },
};

const TONE_ACCENTS: Record<string, string> = {
  bold: '#4f46e5', minimal: '#6366f1', premium: '#d97706',
  friendly: '#2563eb', urgent: '#dc2626', energetic: '#ea580c',
};

// Per-template accent colors — each template owns a unique hue so they
// look visually distinct in the gallery regardless of the user's chosen tone.
const TEMPLATE_ACCENTS: Record<string, string> = {
  'full-bleed':         '#f59e0b',  // amber-orange
  'bold-headline':      '#e11d48',  // rose-vivid
  'minimal':            '#7c3aed',  // violet
  'ugc-style':          '#10b981',  // emerald
  'testimonial':        '#2563eb',  // blue
  'stats-hero':         '#06b6d4',  // cyan
  'feature-list':       '#16a34a',  // green
  'cta-final':          '#dc2626',  // red
  'gradient-pop':       '#22d3ee',  // bright cyan
  'dark-luxury':        '#d97706',  // gold
  'bright-minimal':     '#ec4899',  // pink
  'story-hook':         '#22c55e',  // green-400
  'problem-slide':      '#f43f5e',  // rose-red
  'text-only-bold':     '#a855f7',  // purple
  'product-center':     '#0ea5e9',  // sky
  'neon-dark':          '#4ade80',  // neon green
  'magazine-editorial': '#1e293b',  // editorial slate (dark)
  'color-block':        '#f97316',  // orange
  'floating-card':      '#86efac',  // light green (on dark bg)
  'countdown-urgency':  '#ef4444',  // red-hot
  'social-proof-grid':  '#3b82f6',  // blue
  'headline-badge':     '#8b5cf6',  // violet-400
  'side-by-side':       '#4f46e5',  // indigo
  'diagonal-split':     '#fb7185',  // rose-light
  'overlay-card':       '#38bdf8',  // sky-light
  'number-list':        '#eab308',  // yellow
  'brand-manifesto':    '#c026d3',  // fuchsia
  'product-demo':       '#0891b2',  // teal
  'retro-bold':         '#b45309',  // amber-brown
  'split-panel':        '#059669',  // emerald-deep
  'offer-stack':        '#ef4444',  // vivid red
  'value-math':         '#10b981',  // emerald savings-green
  'case-study':         '#6366f1',  // indigo-trust
  'insight-frame':      '#0ea5e9',  // sky-blue
  'pain-diagnostic':    '#f43f5e',  // rose-danger
  'mistake-alert':      '#f97316',  // orange-warning
  'empathy-card':       '#fb7185',  // rose-warm
  'validation-card':    '#a78bfa',  // violet-soft
  'do-dont':            '#22c55e',  // green-correct
  'transform-split':    '#14b8a6',  // teal-transformation
  // ── Batch 5 ───────────────────────────────────────────────────────────────────
  'guarantee-badge':    '#16a34a',  // trust green
  'free-trial':         '#0ea5e9',  // sky blue
  'limited-drop':       '#ef4444',  // urgency red
  'offer-announce':     '#f97316',  // sale orange
  'price-compare':      '#16a34a',  // savings green
  'bundle-stack':       '#f59e0b',  // product amber
  'award-winner':       '#d97706',  // award gold
  'founder-story':      '#92400e',  // warm brown
  'review-card':        '#f59e0b',  // star gold
  'trust-bar':          '#2563eb',  // trust blue
  'news-frame':         '#dc2626',  // news red
  'video-thumbnail':    '#ef4444',  // YouTube red
  'community-quote':    '#ff4500',  // Reddit orange
  'stat-study':         '#3b82f6',  // data blue
  'caption-style':      '#e11d48',  // Instagram rose
  'chat-thread':        '#22c55e',  // iMessage green
  'meme-format':        '#f59e0b',  // meme yellow
  'comment-reply':      '#f97316',  // reply orange
  'poll-card':          '#a855f7',  // poll purple
  'hot-take':           '#ef4444',  // hot red
  'leaderboard':        '#f59e0b',  // gold #1
  'checklist-viral':    '#22c55e',  // check green
  'myth-reality':       '#a855f7',  // myth purple
  'event-card':         '#8b5cf6',  // event violet
  'three-reasons':      '#3b82f6',  // reason blue
  'timeline-journey':   '#0d9488',  // journey teal
  'tiktok-native':      '#fe2c55',  // TikTok red
  'tweet-screenshot':   '#1d9bf0',  // Twitter/X blue
  'reddit-thread':      '#ff4500',  // Reddit orange
  'email-mockup':       '#ea4335',  // Gmail red
  'receipt-style':      '#854d0e',  // receipt brown
  'aurora-gradient':    '#a78bfa',  // aurora violet
  'duotone-photo':      '#c026d3',  // duotone magenta
  'mono-editorial':     '#18181b',  // editorial black
  'risograph-print':    '#ef4444',  // risograph red
  'collage-cutout':     '#f97316',  // collage vivid orange
  'brutalist':          '#000000',  // raw black
  'chart-reveal':       '#16a34a',  // data green
  'steps-infographic':  '#2563eb',  // step blue
  'vs-table':           '#7c3aed',  // compare purple
  'flat-lay':           '#92400e',  // product brown
  'app-mockup':         '#0ea5e9',  // tech sky blue
  'photo-grid':         '#ec4899',  // grid pink
  'brand-awareness':    '#6366f1',  // brand indigo
  // ── Creative angle-routed batch ───────────────────────────────────────────────
  'testimonial-card':   '#2563eb',  // trust blue
  'versus-slide':       '#7c3aed',  // bold violet
  'before-after-slide': '#0d9488',  // transformation teal
  'press-slide':        '#dc2626',  // press red
  'point-out-slide':    '#6366f1',  // callout indigo
  'gallery-slide':      '#ec4899',  // gallery pink
  'chat-native':        '#22c55e',  // iMessage green
  'offer-drop':         '#f97316',  // urgency orange
};

const SLIDE_LABELS = ['COVER', 'FEATURE', 'CTA'] as const;

// ── Real-photo backgrounds ────────────────────────────────────────────────────
// Eight templates get an Unsplash photo as their background layer.
// The photo is fetched once per session from /api/unsplash?id=<template-id>.
// Falls back gracefully to CSS backgrounds if the API key isn't configured.

const PHOTO_TEMPLATE_IDS = new Set([
  // ── Original 8 ──────────────────────────────────────────────────────────────
  'full-bleed','dark-luxury','overlay-card','ugc-style',
  'magazine-editorial','story-hook','product-center','neon-dark',
  // ── Batch 5 – dark-design templates (white text, safe for photo bgs) ────────
  'caption-style','tiktok-native','video-thumbnail','duotone-photo',
  'hot-take','poll-card','offer-announce','limited-drop',
  'event-card','award-winner','aurora-gradient',
  // ── Extended – product/lifestyle templates ────────────────────────────────
  'flat-lay','photo-grid','split-panel','before-after-slide',
  'collage-cutout','retro-bold',
]);

const PHOTO_OVERLAYS: Record<string, string> = {
  // ── Original 8 ──────────────────────────────────────────────────────────────
  'full-bleed':         'linear-gradient(to bottom, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.72) 100%)',
  'dark-luxury':        'linear-gradient(135deg, rgba(0,0,0,0.68) 0%, rgba(0,0,0,0.48) 100%)',
  'overlay-card':       'linear-gradient(to bottom, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.78) 100%)',
  'ugc-style':          'linear-gradient(to bottom, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.55) 100%)',
  'magazine-editorial': 'linear-gradient(to bottom, rgba(255,255,255,0.58) 0%, rgba(255,255,255,0.82) 100%)',
  'story-hook':         'linear-gradient(to bottom, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0.82) 100%)',
  'product-center':     'linear-gradient(to bottom, rgba(0,0,0,0.02) 0%, rgba(0,0,0,0.48) 100%)',
  'neon-dark':          'linear-gradient(135deg, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.62) 100%)',
  // ── Batch 5 ──────────────────────────────────────────────────────────────────
  'caption-style':      'linear-gradient(to bottom, rgba(0,0,0,0.0) 50%, rgba(0,0,0,0.75) 100%)',
  'tiktok-native':      'linear-gradient(to bottom, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0.80) 100%)',
  'video-thumbnail':    'linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.70) 100%)',
  'duotone-photo':      'linear-gradient(135deg, rgba(99,102,241,0.55) 0%, rgba(236,72,153,0.45) 100%)',
  'hot-take':           'linear-gradient(135deg, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.55) 100%)',
  'poll-card':          'linear-gradient(to bottom, rgba(0,0,0,0.30) 0%, rgba(0,0,0,0.68) 100%)',
  'offer-announce':     'linear-gradient(to bottom, rgba(0,0,0,0.12) 0%, rgba(0,0,0,0.65) 100%)',
  'limited-drop':       'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.80) 100%)',
  'event-card':         'linear-gradient(to bottom, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.82) 100%)',
  'award-winner':       'linear-gradient(135deg, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0.42) 100%)',
  'aurora-gradient':    'linear-gradient(to bottom, rgba(0,0,0,0.12) 0%, rgba(0,0,0,0.55) 100%)',
  // ── Extended batch ──────────────────────────────────────────────────────────
  'flat-lay':           'linear-gradient(to bottom, rgba(255,255,255,0.0) 0%, rgba(255,255,255,0.70) 100%)',
  'photo-grid':         'linear-gradient(to bottom, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0.52) 100%)',
  'split-panel':        'linear-gradient(to right, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.0) 55%)',
  'before-after-slide': 'linear-gradient(to bottom, rgba(0,0,0,0.12) 0%, rgba(0,0,0,0.62) 100%)',
  'collage-cutout':     'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.50) 100%)',
  'retro-bold':         'linear-gradient(to bottom, rgba(0,0,0,0.0) 0%, rgba(0,0,0,0.55) 100%)',
};

interface PhotoMeta {
  url:              string;
  credit:           string;
  creditUrl:        string;
  downloadLocation: string;
}

function useTemplatePhoto(id: string): PhotoMeta | null {
  const [meta, setMeta] = React.useState<PhotoMeta | null>(null);
  React.useEffect(() => {
    if (!PHOTO_TEMPLATE_IDS.has(id)) return;
    const cacheKey = `__tmpl_photo_v3_${id}`;
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached) as PhotoMeta;
        setMeta(parsed);
        return;
      }
    } catch {}
    fetch(`/api/unsplash?id=${id}`)
      .then(r => r.ok ? r.json() : null)
      .then((data: PhotoMeta | null) => {
        if (data?.url) {
          try { sessionStorage.setItem(cacheKey, JSON.stringify(data)); } catch {}
          setMeta(data);
          // Ping Unsplash download endpoint (TOS requirement — fire-and-forget)
          if (data.downloadLocation) {
            fetch('/api/unsplash/trigger-download', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ downloadLocation: data.downloadLocation }),
            }).catch(() => {});
          }
        }
      })
      .catch(() => {});
  }, [id]);
  return meta;
}

// ── Shared mini helpers ───────────────────────────────────────────────────────
const T = ({ s, children, color, weight, align, spacing, caps }: {
  s: number; children: React.ReactNode; color: string; weight?: number;
  align?: 'center'|'left'|'right'; spacing?: string; caps?: boolean;
}) => (
  <div style={{ fontSize: s, color, fontWeight: weight ?? 600, lineHeight: 1.25, textAlign: align ?? 'left', letterSpacing: spacing ?? 'normal', textTransform: caps ? 'uppercase' as const : undefined }}>{children}</div>
);
const Bar = ({ w, color, h = 3, op = 0.7 }: { w: number|string; color: string; h?: number; op?: number }) => (
  <div style={{ height: h, background: color, borderRadius: 2, width: typeof w === 'number' ? `${w}%` : w, opacity: op }} />
);
const Dot = ({ color }: { color: string }) => (
  <div style={{ width: 5, height: 5, borderRadius: '50%', background: color, flexShrink: 0 }} />
);
const Check = ({ color }: { color: string }) => (
  <div style={{ width: 12, height: 12, borderRadius: '50%', background: color, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <div style={{ width: 4, height: 3, borderLeft: '1.5px solid #fff', borderBottom: '1.5px solid #fff', transform: 'rotate(-45deg) translate(0.5px,-0.5px)' }} />
  </div>
);
const Cross = () => (
  <div style={{ width: 12, height: 12, borderRadius: '50%', background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.5)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: '#ef4444', fontWeight: 900 }}>✕</div>
);
const Stars = ({ color = '#fbbf24' }: { color?: string }) => (
  <div style={{ display: 'flex', gap: 2 }}>{[0,1,2,3,4].map(i => <div key={i} style={{ fontSize: 9, color }}>★</div>)}</div>
);
const Btn = ({ label, bg, color = '#fff', border }: { label: string; bg: string; color?: string; border?: string }) => (
  <div style={{ height: 24, background: bg, border: border ?? 'none', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 12px', boxShadow: `0 3px 10px ${bg}44` }}>
    <div style={{ fontSize: 8, fontWeight: 800, color, letterSpacing: '0.04em', textTransform: 'uppercase' as const }}>{label}</div>
  </div>
);
const Row = ({ children, gap = 6 }: { children: React.ReactNode; gap?: number }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap, width: '100%' }}>{children}</div>
);
const Col = ({ children, gap = 5, align = 'flex-start' }: { children: React.ReactNode; gap?: number; align?: string }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap, width: '100%', alignItems: align as any }}>{children}</div>
);


// ── SlideBg — pure-CSS background layer, one visual per template ─────────────
// Renders position:absolute;inset:0 — slide content sits on top at zIndex:1.
// Templates with layout-as-background (panel splits) return transparent here.

const NOISE_SVG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='0.4'/%3E%3C/svg%3E")`;

function SlideBg({ id, slide, accent, photoMeta }: { id: string; slide: 0|1|2; accent: string; photoMeta?: PhotoMeta | null }) {
  const s: React.CSSProperties = { position: 'absolute', inset: 0, overflow: 'hidden', zIndex: 0 };
  const blob = (l: string, t: string, sz: number, col: string, op = 0.32) => (
    <div key={`${l}${t}`} style={{ position: 'absolute', left: l, top: t, width: sz, height: sz, borderRadius: '50%', background: col, filter: `blur(${Math.round(sz * 0.55)}px)`, opacity: op, pointerEvents: 'none' }} />
  );
  const dotGrid = `radial-gradient(circle, rgba(0,0,0,0.05) 1px, transparent 1px)`;
  const lineGrid = `linear-gradient(${accent}0d 1px, transparent 1px), linear-gradient(90deg, ${accent}0d 1px, transparent 1px)`;

  // ── Real photo background (slides 0 + 1 only — CTA keeps accent override) ──
  if (photoMeta?.url && PHOTO_TEMPLATE_IDS.has(id) && slide !== 2) return (
    <div style={{ ...s, background: '#000' }}>
      <img
        src={photoMeta.url} alt=""
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.78 }}
        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
      />
      <div style={{ position: 'absolute', inset: 0, background: PHOTO_OVERLAYS[id] ?? 'linear-gradient(rgba(0,0,0,0.3),rgba(0,0,0,0.65))' }} />
      <div style={{ position: 'absolute', inset: 0, backgroundImage: NOISE_SVG, backgroundSize: '200px 200px', opacity: 0.025 }} />
      {/* Unsplash attribution — required by TOS */}
      <a
        href={photoMeta.creditUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          position: 'absolute', bottom: 4, right: 6,
          fontSize: 6, color: 'rgba(255,255,255,0.55)',
          textDecoration: 'none', zIndex: 10,
          textShadow: '0 1px 2px rgba(0,0,0,0.6)',
          whiteSpace: 'nowrap',
        }}
      >
        Photo: {photoMeta.credit} · Unsplash
      </a>
    </div>
  );

  // CTA slide overrides — accent flood for call-to-action energy
  if (slide === 2 && ['full-bleed','number-list','social-proof-grid','story-hook','side-by-side','problem-slide'].includes(id))
    return <div style={{ ...s, background: accent }}><div style={{ position: 'absolute', inset: 0, backgroundImage: NOISE_SVG, backgroundSize: '200px 200px', opacity: 0.035 }} /></div>;

  // ── dark aurora mesh — primary blobs all use template accent ─────────────
  if (['full-bleed','neon-dark','bold-headline','headline-badge','story-hook','problem-slide','countdown-urgency','cta-final'].includes(id)) return (
    <div style={{ ...s, background: '#06080f' }}>
      {blob('-18%', '-22%', 150, accent, 0.38)}
      {blob('55%', '52%', 120, accent, 0.18)}
      {blob('58%', '-18%', 95, accent, 0.12)}
      <div style={{ position: 'absolute', inset: 0, backgroundImage: NOISE_SVG, backgroundSize: '200px 200px', opacity: 0.025 }} />
    </div>
  );

  // ── brand manifesto — dark linen with grain ───────────────────────────────
  if (id === 'brand-manifesto') return (
    <div style={{ ...s, background: '#0a0a0a' }}>
      <div style={{ position: 'absolute', inset: 0, backgroundImage: NOISE_SVG, backgroundSize: '200px 200px', opacity: 0.06 }} />
      {blob('55%', '55%', 110, accent, 0.14)}
    </div>
  );

  // ── vivid aurora — gradient-pop / floating-card / overlay-card ────────────
  if (['gradient-pop','floating-card','overlay-card'].includes(id)) return (
    <div style={{ ...s, background: '#0a0f1e' }}>
      {blob('-12%', '-18%', 160, accent, 0.55)}
      {blob('42%', '32%', 130, accent, 0.30)}
      {blob('22%', '58%', 105, accent, 0.20)}
      <div style={{ position: 'absolute', inset: 0, backgroundImage: NOISE_SVG, backgroundSize: '200px 200px', opacity: 0.03 }} />
    </div>
  );

  // ── soft warm glow on white — testimonial / social-proof ─────────────────
  if (['testimonial','social-proof-grid'].includes(id)) return (
    <div style={{ ...s, background: '#fff' }}>
      <div style={{ position: 'absolute', top: '-35%', right: '-20%', width: 200, height: 200, borderRadius: '50%', background: `radial-gradient(circle, ${accent}16 0%, transparent 70%)` }} />
      <div style={{ position: 'absolute', bottom: '-25%', left: '-18%', width: 170, height: 170, borderRadius: '50%', background: 'radial-gradient(circle, #fbbf2412 0%, transparent 70%)' }} />
    </div>
  );

  // ── ugc-style — clean white with brand top-bar ────────────────────────────
  if (id === 'ugc-style') return (
    <div style={{ ...s, background: '#fff' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${accent}, #f472b6)` }} />
    </div>
  );

  // ── light dot-grid — minimal, product, feature templates ─────────────────
  if (['minimal','bright-minimal','feature-list','number-list','product-center','product-demo'].includes(id)) return (
    <div style={{ ...s, background: '#f8fafc' }}>
      <div style={{ position: 'absolute', inset: 0, backgroundImage: dotGrid, backgroundSize: '16px 16px', backgroundPosition: '8px 8px' }} />
      <div style={{ position: 'absolute', top: '-28%', right: '-18%', width: 155, height: 155, borderRadius: '50%', background: `${accent}0e` }} />
    </div>
  );

  // ── stats-hero — line grid dark with accent radial center ─────────────────
  if (id === 'stats-hero') return (
    <div style={{ ...s, background: '#06080f' }}>
      <div style={{ position: 'absolute', inset: 0, backgroundImage: lineGrid, backgroundSize: '22px 22px' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 42%, transparent 18%, #06080f 72%)' }} />
      {blob('35%', '8%', 130, accent, 0.2)}
    </div>
  );

  // ── dark-luxury — near-black with noise grain + gold hairlines ────────────
  if (id === 'dark-luxury') return (
    <div style={{ ...s, background: '#070707' }}>
      <div style={{ position: 'absolute', inset: 0, backgroundImage: NOISE_SVG, backgroundSize: '200px 200px', opacity: 0.06 }} />
      <div style={{ position: 'absolute', top: '20%', left: '10%', right: '10%', height: 1, background: 'rgba(212,175,55,0.22)' }} />
      <div style={{ position: 'absolute', bottom: '20%', left: '10%', right: '10%', height: 1, background: 'rgba(212,175,55,0.22)' }} />
    </div>
  );

  // ── retro-bold — cream with ruled lines + dashed circle ──────────────────
  if (id === 'retro-bold') return (
    <div style={{ ...s, background: '#fef3c7' }}>
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 19px, rgba(30,41,59,0.055) 19px, rgba(30,41,59,0.055) 20px)' }} />
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 165, height: 165, borderRadius: '50%', border: '1px dashed rgba(30,41,59,0.12)' }} />
    </div>
  );

  // ── magazine-editorial — white with ruled lines + accent top bar ──────────
  if (id === 'magazine-editorial') return (
    <div style={{ ...s, background: '#fff' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: accent }} />
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(0,0,0,0.018) 1px, transparent 1px)', backgroundSize: '100% 22px', top: 3 }} />
    </div>
  );

  // ── text-only-bold — solid accent with noise grain ────────────────────────
  if (id === 'text-only-bold') return (
    <div style={{ ...s, background: accent }}>
      <div style={{ position: 'absolute', inset: 0, backgroundImage: NOISE_SVG, backgroundSize: '200px 200px', opacity: 0.04 }} />
    </div>
  );

  // ── split-panel — light dot-grid (panels provide their own colors) ─────────
  if (id === 'split-panel') return (
    <div style={{ ...s, background: '#f1f5f9' }}>
      <div style={{ position: 'absolute', inset: 0, backgroundImage: dotGrid, backgroundSize: '18px 18px' }} />
    </div>
  );

  // ── layout-as-background templates — transparent (panels handle colors) ───
  if (['diagonal-split','side-by-side','color-block'].includes(id))
    return <div style={{ ...s, background: 'transparent' }} />;

  if (id === 'offer-stack') {
    if (slide === 2) return <div style={{ ...s, background: '#ef4444' }}><div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 120%, rgba(255,255,255,0.08), transparent 70%)' }} /></div>;
    return <div style={{ ...s, background: '#991b1b' }}><div style={{ position: 'absolute', inset: 0, backgroundImage: `radial-gradient(circle, rgba(239,68,68,0.15) 1px, transparent 1px)`, backgroundSize: '14px 14px' }} /></div>;
  }
  if (id === 'value-math') {
    if (slide === 2) return <div style={{ ...s, background: '#065f46' }} />;
    return <div style={{ ...s, background: '#0c1a3a' }}><div style={{ position: 'absolute', inset: 0, background: `linear-gradient(${accent}08 1px, transparent 1px), linear-gradient(90deg, ${accent}08 1px, transparent 1px)`, backgroundSize: '20px 20px' }} /></div>;
  }
  if (id === 'case-study') {
    if (slide === 2) return <div style={{ ...s, background: accent }} />;
    return <div style={{ ...s, background: '#ffffff' }}><div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: accent }} /></div>;
  }
  if (id === 'insight-frame') {
    if (slide === 2) return <div style={{ ...s, background: accent }} />;
    return <div style={{ ...s, background: '#ffffff' }}><div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 3, background: accent }} /></div>;
  }
  if (id === 'pain-diagnostic') {
    if (slide === 2) return <div style={{ ...s, background: accent }} />;
    return <div style={{ ...s, background: '#0f0a1a' }}>{blob('-10%','-10%',200,'#f43f5e',0.06)}{blob('60%','60%',180,'#7c3aed',0.06)}</div>;
  }
  if (id === 'mistake-alert') {
    if (slide === 2) return <div style={{ ...s, background: '#431407' }} />;
    return <div style={{ ...s, background: '#431407' }}><div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: '#f97316' }} /></div>;
  }
  if (id === 'empathy-card') {
    if (slide === 2) return <div style={{ ...s, background: '#7c3aed' }} />;
    return <div style={{ ...s, background: '#fdf2f8' }}>{blob('60%','-20%',180,'#ec4899',0.1)}</div>;
  }
  if (id === 'validation-card') {
    if (slide === 2) return <div style={{ ...s, background: '#4c1d95' }} />;
    return <div style={{ ...s, background: '#ede9fe' }}>{blob('60%','60%',200,'#a78bfa',0.15)}</div>;
  }
  if (id === 'do-dont') {
    if (slide === 2) return <div style={{ ...s, background: '#f0fdf4' }} />;
    return (
      <div style={{ ...s, flexDirection: 'row', padding: 0, gap: 0 }}>
        <div style={{ flex: 1, height: '100%', background: '#fff5f5' }} />
        <div style={{ width: 1, background: '#e2e8f0', flexShrink: 0 }} />
        <div style={{ flex: 1, height: '100%', background: '#f0fdf4' }} />
      </div>
    );
  }
  if (id === 'transform-split') {
    if (slide === 2) return <div style={{ ...s, background: '#0f766e' }} />;
    return (
      <div style={{ ...s, flexDirection: 'column', padding: 0, gap: 0 }}>
        <div style={{ flex: 1, width: '100%', background: '#334155' }} />
        <div style={{ flex: 1, width: '100%', background: '#0f766e' }} />
      </div>
    );
  }

  // ── Batch 5: 44 new templates ──────────────────────────────────────────────

  // Group A: Dark/premium
  if (id === 'guarantee-badge' || id === 'award-winner') return (
    <div style={{ ...s, background: '#0a0e1a' }}>{blob('30%','30%',160,accent,0.28)}</div>
  );
  if (id === 'limited-drop') return (
    <div style={{ ...s, background: '#000' }}>
      {blob('-15%','-10%',130,'#ef4444',0.35)}
      {blob('60%','60%',110,accent,0.22)}
    </div>
  );
  if (id === 'hot-take') return <div style={{ ...s, background: accent }}><div style={{ position:'absolute', inset:0, backgroundImage: NOISE_SVG, backgroundSize:'200px 200px', opacity:0.04 }} /></div>;
  if (id === 'mono-editorial') return <div style={{ ...s, background: '#fff' }} />;
  if (id === 'caption-style' || id === 'tiktok-native') return (
    <div style={{ ...s, background: '#000' }}>{blob('30%','70%',120,accent,0.15)}</div>
  );
  if (id === 'brutalist') return <div style={{ ...s, background: '#fff' }} />;

  // Group B: White with subtle warm glow
  if (['free-trial','price-compare','review-card','trust-bar','checklist-viral','vs-table','three-reasons','timeline-journey','steps-infographic','chart-reveal','flat-lay','leaderboard','stat-study','email-mockup'].includes(id)) return (
    <div style={{ ...s, background: '#fff' }}>
      <div style={{ position:'absolute', top:'-40%', right:'-20%', width:200, height:200, borderRadius:'50%', background:`radial-gradient(circle, ${accent}10 0%, transparent 70%)` }} />
    </div>
  );
  if (id === 'news-frame') return (
    <div style={{ ...s, background: '#f8f9fa' }}>
      <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background: accent }} />
    </div>
  );
  if (id === 'brand-awareness') return (
    <div style={{ ...s, background: slide === 2 ? '#0f172a' : '#fff' }}>
      <div style={{ position:'absolute', top:'-40%', right:'-20%', width:200, height:200, borderRadius:'50%', background:`radial-gradient(circle, ${accent}14 0%, transparent 70%)` }} />
    </div>
  );

  // Group C: Warm/social
  if (id === 'founder-story') return <div style={{ ...s, background: '#fef3c7' }} />;
  if (id === 'community-quote' || id === 'reddit-thread') return <div style={{ ...s, background: '#f1f5f9' }} />;
  if (id === 'chat-thread' || id === 'tweet-screenshot' || id === 'meme-format' || id === 'receipt-style' || id === 'photo-grid') return <div style={{ ...s, background: '#fff' }} />;
  if (id === 'comment-reply') return <div style={{ ...s, background: '#000' }}>{blob('40%','30%',130,accent,0.18)}</div>;
  if (id === 'poll-card') return <div style={{ ...s, background: '#1a1a2e' }}>{blob('60%','60%',140,accent,0.25)}</div>;
  if (id === 'bundle-stack') return <div style={{ ...s, background: '#f8fafc' }} />;
  if (id === 'app-mockup') return (
    <div style={{ ...s, background: '#f0f4ff' }}>
      <div style={{ position:'absolute', top:'-30%', right:'-15%', width:160, height:160, borderRadius:'50%', background:`${accent}10` }} />
    </div>
  );
  if (id === 'event-card') return <div style={{ ...s, background: '#0f172a' }}>{blob('25%','25%',150,accent,0.28)}</div>;

  // Group D: Vivid/gradient
  if (id === 'offer-announce') return <div style={{ ...s, background: accent }}><div style={{ position:'absolute', inset:0, backgroundImage: NOISE_SVG, backgroundSize:'200px 200px', opacity:0.04 }} /></div>;
  if (id === 'myth-reality') return (
    <div style={{ ...s, flexDirection:'row' }}>
      <div style={{ flex:1, background:'#1e293b' }} />
      <div style={{ flex:1, background: accent }} />
    </div>
  );
  if (id === 'aurora-gradient') return (
    <div style={{ ...s, background: '#0d0221', overflow: 'hidden' }}>
      {/* Aurora arc bands — pure CSS, no gradient background */}
      <div style={{ position: 'absolute', top: '-40%', left: '-20%', width: '110%', height: '80%', borderRadius: '50%', background: '#a855f7', opacity: 0.18, filter: 'blur(40px)' }} />
      <div style={{ position: 'absolute', top: '-10%', left: '30%', width: '90%', height: '60%', borderRadius: '50%', background: '#38bdf8', opacity: 0.14, filter: 'blur(50px)' }} />
      <div style={{ position: 'absolute', bottom: '-20%', left: '-10%', width: '80%', height: '55%', borderRadius: '50%', background: '#34d399', opacity: 0.12, filter: 'blur(45px)' }} />
    </div>
  );
  if (id === 'duotone-photo') return (
    <div style={{ ...s, background: slide === 2 ? accent : '#000' }}>
      {slide !== 2 && <div style={{ position:'absolute', inset:0, background: `linear-gradient(135deg, ${accent}66, transparent)` }} />}
    </div>
  );
  if (id === 'risograph-print') return (
    <div style={{ ...s, background: '#fafaf0' }}>
      {blob('15%','20%',100,'#ef4444',0.18)}
      {blob('60%','55%',110,accent,0.20)}
      {blob('30%','75%',90,'#3b82f6',0.16)}
    </div>
  );
  if (id === 'collage-cutout') return (
    <div style={{ ...s, background: '#fafaf5' }}>
      <div style={{ position:'absolute', top:'10%', left:'-10%', width:80, height:50, background: `${accent}30`, transform:'rotate(-8deg)' }} />
      <div style={{ position:'absolute', bottom:'15%', right:'-5%', width:90, height:60, background: '#fbbf2440', transform:'rotate(6deg)' }} />
      <div style={{ position:'absolute', top:'40%', right:'20%', width:50, height:50, borderRadius:'50%', background: '#ec489930' }} />
    </div>
  );
  if (id === 'video-thumbnail') return <div style={{ ...s, background: '#0a0a0a' }}>{blob('40%','40%',150,accent,0.25)}</div>;

  // ── Creative angle-routed batch ───────────────────────────────────────────
  if (id === 'testimonial-card') return (
    <div style={{ ...s, background: '#ffffff' }}>{blob('70%','-20%',180,accent,0.07)}</div>
  );
  if (id === 'versus-slide') return (
    <div style={{ ...s, background:'#f0ebe0' }}>{blob('80%','-10%',160,accent,0.08)}</div>
  );
  if (id === 'before-after-slide') return (
    <div style={{ ...s, background:'#f0ebe0' }}>{blob('20%','80%',140,accent,0.08)}</div>
  );
  if (id === 'press-slide') return (
    <div style={{ ...s, background:'#111111' }}>
      <div style={{ position:'absolute', bottom:0, left:0, right:0, height:20, background:accent }} />
    </div>
  );
  if (id === 'point-out-slide') return (
    <div style={{ ...s, background:'#111111' }}>
      <div style={{ position:'absolute', bottom:0, left:0, right:0, height:20, background:'#dc2626' }} />
    </div>
  );
  if (id === 'gallery-slide') return (
    <div style={{ ...s, background:'#ffffff' }} />
  );
  if (id === 'chat-native') return <div style={{ ...s, background:'#f2f2f7' }} />;
  if (id === 'offer-drop') return (
    <div style={{ ...s, background:'#111111' }}>{blob('50%','20%',200,accent,0.25)}</div>
  );

  // ── default dark aurora ───────────────────────────────────────────────────
  return (
    <div style={{ ...s, background: '#0f1117' }}>
      {blob('25%', '15%', 110, accent, 0.28)}
      {blob('60%', '60%', 90, accent, 0.16)}
    </div>
  );
}

// ── TemplateSlide — orchestrates SlideBg + per-template content ──────────────
function TemplateSlide({ id, slide, txt, muted, accent, photoMeta }: {
  id: string; slide: 0|1|2; txt: string; muted: string; accent: string; photoMeta?: PhotoMeta | null;
}) {
  // Content wrappers — sit above SlideBg at zIndex:1, no background
  const z: React.CSSProperties = { position: 'absolute', inset: 0, zIndex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' };
  const zc: React.CSSProperties = { ...z, alignItems: 'center', justifyContent: 'center' };
  const zp = (align: 'center'|'flex-start' = 'flex-start', justify = 'center'): React.CSSProperties =>
    ({ ...z, alignItems: align, justifyContent: justify, padding: '16px 14px', gap: 6 });

  const content = (() => {

    // ── full-bleed ────────────────────────────────────────────────────────────
    if (id === 'full-bleed') {
      if (slide === 0) return (
        <div style={{ ...z }}>
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(to top,rgba(0,0,0,0.88) 0%,transparent 100%)', padding: '18px 14px 16px', display: 'flex', flexDirection: 'column', gap: 5 }}>
            <T s={7} color={accent} weight={700} caps spacing="0.12em">New Drop</T>
            <T s={17} color="#fff" weight={900} spacing="-0.04em">Stop Scrolling.</T>
            <T s={8} color="rgba(255,255,255,0.6)">This changes your game →</T>
          </div>
        </div>
      );
      if (slide === 1) return (
        <div style={{ ...zp('flex-start'), gap: 7 }}>
          {['Works in 60 seconds','10,000+ happy users','No experience needed'].map((t, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', background: 'rgba(255,255,255,0.07)', borderRadius: 8, padding: '7px 10px', width: '100%' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: accent, flexShrink: 0 }} /><T s={8} color="#f1f5f9" weight={600}>{t}</T>
            </div>
          ))}
        </div>
      );
      // slide 2 — Chapter Epilogue
      return (
        <div style={{ ...z, alignItems:'flex-start', justifyContent:'flex-end', padding:'0 14px 20px' }}>
          <div style={{ display:'flex', flexDirection:'column', gap:8, width:'100%' }}>
            <div style={{ height:1, background:'rgba(255,255,255,0.2)', width:'100%' }} />
            <T s={8.5} color="#fff" weight={300} align="left" spacing="0.01em">That's the full story. What you do next is up to you.</T>
            <T s={7.5} color="rgba(255,255,255,0.45)" align="left">The scroll stops here. The action starts now.</T>
            <T s={7.5} color={accent} weight={600}>@brand · link in bio →</T>
          </div>
        </div>
      );
    }

    // ── bold-headline ─────────────────────────────────────────────────────────
    if (id === 'bold-headline') {
      if (slide === 0) return (
        <div style={{ ...zc, gap: 6 }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: accent, zIndex: 2 }} />
          <T s={7} color={accent} weight={700} caps spacing="0.15em">The truth about</T>
          <div style={{ textAlign: 'center', lineHeight: 0.88, letterSpacing: '-0.05em' }}>
            <div style={{ fontSize: 26, fontWeight: 900, color: '#f1f5f9' }}>THE</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: accent }}>TRUTH</div>
          </div>
          <div style={{ height: 2, background: accent, width: 40, borderRadius: 1, marginTop: 4 }} />
          <T s={7} color="rgba(255,255,255,0.4)" align="center">Swipe →</T>
        </div>
      );
      if (slide === 1) return (
        <div style={{ ...zp(), gap: 7 }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: accent, zIndex: 2 }} />
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {['FAST.','PROVEN.','POWERFUL.'].map((w, i) => (
              <div key={i} style={{ fontSize: 20, fontWeight: 900, color: i === 1 ? accent : '#f1f5f9', letterSpacing: '-0.04em', lineHeight: 1 }}>{w}</div>
            ))}
            <div style={{ height: 1, background: 'rgba(255,255,255,0.1)', marginTop: 4 }} />
            <T s={7} color="rgba(255,255,255,0.35)">Results you can measure.</T>
          </div>
        </div>
      );
      // slide 2 — Brand Statement
      return (
        <div style={{ ...zc, gap: 9, padding:'0 16px' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: accent, zIndex: 2 }} />
          <div style={{ height:2, background:accent, width:32, marginTop:8 }} />
          <T s={8} color="rgba(241,245,249,0.45)" weight={300} align="center" spacing="0.06em" caps>Built for people who</T>
          <T s={14} color="#f1f5f9" weight={900} align="center" spacing="-0.04em">never settle for less.</T>
          <T s={7} color="rgba(241,245,249,0.3)" align="center">Not for everyone.</T>
        </div>
      );
    }

    // ── gradient-pop ──────────────────────────────────────────────────────────
    if (id === 'gradient-pop') {
      if (slide === 0) return (
        <div style={{ ...zc, gap: 8 }}>
          <div style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)', borderRadius: 20, padding: '3px 12px', border: '1px solid rgba(255,255,255,0.3)' }}>
            <T s={7} color="#fff" weight={700}>✦ New Release</T>
          </div>
          <T s={18} color="#fff" weight={900} align="center" spacing="-0.04em">Don't scroll past.</T>
          <T s={8} color="rgba(255,255,255,0.7)" align="center">You'll wish you didn't.</T>
          <div style={{ background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(8px)', borderRadius: 30, padding: '7px 18px', border: '1px solid rgba(255,255,255,0.35)', marginTop: 4 }}>
            <T s={8} color="#fff" weight={700}>See Why →</T>
          </div>
        </div>
      );
      if (slide === 1) return (
        <div style={{ ...zp('flex-start'), gap: 8 }}>
          <T s={9} color="rgba(255,255,255,0.65)" weight={600}>What you get:</T>
          {['Instant results','10x faster workflow','Community support'].map((t, i) => (
            <div key={i} style={{ background: 'rgba(255,255,255,0.14)', backdropFilter: 'blur(6px)', borderRadius: 8, padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 6, border: '1px solid rgba(255,255,255,0.2)', width: '100%' }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#fff', flexShrink: 0 }} />
              <T s={8} color="#fff" weight={600}>{t}</T>
            </div>
          ))}
        </div>
      );
      // slide 2 — Brand Statement
      return (
        <div style={{ ...zc, gap: 10, padding:'0 16px' }}>
          <div style={{ background:'rgba(255,255,255,0.12)', backdropFilter:'blur(8px)', borderRadius:12, padding:'16px 14px', width:'90%', display:'flex', flexDirection:'column', gap:8, border:'1px solid rgba(255,255,255,0.2)' }}>
            <T s={8} color="rgba(255,255,255,0.5)" weight={300} align="center" spacing="0.06em" caps>For those who</T>
            <T s={14} color="#fff" weight={900} align="center" spacing="-0.03em">pop when others blend in.</T>
            <T s={7} color="rgba(255,255,255,0.35)" align="center">Not for the background.</T>
          </div>
        </div>
      );
    }

    // ── diagonal-split ────────────────────────────────────────────────────────
    if (id === 'diagonal-split') {
      if (slide === 0) return (
        <div style={{ ...z, flexDirection: 'row' }}>
          <div style={{ position: 'absolute', inset: 0, background: accent, clipPath: 'polygon(0 0, 52% 0, 42% 100%, 0 100%)' }} />
          <div style={{ position: 'absolute', left: '4%', top: '50%', transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', gap: 4, width: '40%' }}>
            <T s={7} color="rgba(255,255,255,0.65)" caps spacing="0.1em">Before</T>
            <T s={11} color="#fff" weight={900} spacing="-0.02em">Stuck &amp; Slow</T>
          </div>
          <div style={{ position: 'absolute', right: '4%', top: '50%', transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', gap: 4, width: '44%' }}>
            <T s={7} color={accent} caps spacing="0.1em">After</T>
            <T s={11} color="#1e293b" weight={900} spacing="-0.02em">Fast &amp; Free</T>
          </div>
        </div>
      );
      if (slide === 1) return (
        <div style={{ ...z, flexDirection: 'row' }}>
          <div style={{ position: 'absolute', inset: 0, background: accent, clipPath: 'polygon(0 0, 52% 0, 42% 100%, 0 100%)' }} />
          <div style={{ position: 'absolute', left: '4%', top: '50%', transform: 'translateY(-50%)', width: '38%', display: 'flex', flexDirection: 'column', gap: 5 }}>
            {['Wasted time','High costs','No results'].map((t, i) => (
              <Row key={i} gap={4}><Cross /><T s={7} color="rgba(255,255,255,0.85)">{t}</T></Row>
            ))}
          </div>
          <div style={{ position: 'absolute', right: '4%', top: '50%', transform: 'translateY(-50%)', width: '44%', display: 'flex', flexDirection: 'column', gap: 5 }}>
            {['10x faster','Half the cost','Guaranteed'].map((t, i) => (
              <Row key={i} gap={4}><Check color={accent} /><T s={7} color="#334155">{t}</T></Row>
            ))}
          </div>
        </div>
      );
      // slide 2 — Chapter Epilogue
      return (
        <div style={{ ...z, background: accent, alignItems:'flex-start', justifyContent:'flex-end', padding:'18px 18px 22px' }}>
          <div style={{ display:'flex', flexDirection:'column', gap:8, width:'100%' }}>
            <div style={{ height:1, background:'rgba(255,255,255,0.3)', width:'100%' }} />
            <T s={8.5} color="#fff" weight={300} align="left">That's the before. You've already seen the after. The question is: which side will you be on?</T>
            <T s={7.5} color={accent} weight={600}>@brand · link in bio →</T>
          </div>
        </div>
      );
    }

    // ── neon-dark ─────────────────────────────────────────────────────────────
    if (id === 'neon-dark') {
      const glow = `0 0 20px ${accent}88, 0 0 40px ${accent}44`;
      if (slide === 0) return (
        <div style={{ ...zc, gap: 6 }}>
          <T s={7} color={accent} weight={700} caps spacing="0.18em">Level up</T>
          <div style={{ fontSize: 28, fontWeight: 900, color: '#fff', letterSpacing: '-0.04em', textShadow: glow, textAlign: 'center', lineHeight: 1 }}>GLOW<br/>UP</div>
          <T s={8} color="rgba(255,255,255,0.4)" align="center">Your brand, amplified.</T>
          <div style={{ background: accent, borderRadius: 8, padding: '6px 16px', marginTop: 4, boxShadow: glow }}>
            <T s={8} color="#fff" weight={700}>Get Access</T>
          </div>
        </div>
      );
      if (slide === 1) return (
        <div style={{ ...zp(), gap: 7 }}>
          {['Instant deploy','Laser targeting','Premium results'].map((t, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', border: `1px solid ${accent}44`, borderRadius: 8, padding: '6px 10px', background: `${accent}0a`, width: '100%' }}>
              <div style={{ width: 6, height: 6, borderRadius: 2, background: accent, flexShrink: 0 }} /><T s={8} color="#f1f5f9" weight={600}>{t}</T>
            </div>
          ))}
        </div>
      );
      // slide 2 — Brand Statement (neon)
      return (
        <div style={{ ...zc, gap: 9, padding:'0 16px' }}>
          <div style={{ height:2, background:accent, width:30, boxShadow:glow }} />
          <T s={8} color="rgba(255,255,255,0.4)" weight={300} align="center" spacing="0.06em" caps>Built for brands that</T>
          <div style={{ textShadow:glow }}><T s={14} color="#fff" weight={900} align="center" spacing="-0.03em">glow in the dark.</T></div>
          <T s={7} color="rgba(255,255,255,0.25)" align="center">Not for the dim ones.</T>
        </div>
      );
    }

    // ── retro-bold ────────────────────────────────────────────────────────────
    if (id === 'retro-bold') {
      if (slide === 0) return (
        <div style={{ ...zc, gap: 8 }}>
          <div style={{ border: '3px solid #1e293b', borderRadius: 4, padding: '2px 10px', transform: 'rotate(-2deg)', background: 'rgba(255,255,255,0.6)', marginBottom: 4 }}>
            <T s={7} color="#1e293b" weight={900} caps spacing="0.12em">Est. 2024</T>
          </div>
          <div style={{ textAlign: 'center', lineHeight: 0.9, letterSpacing: '-0.03em' }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#1e293b' }}>OLD SCHOOL.</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: accent }}>NEW RESULTS.</div>
          </div>
          <div style={{ height: 3, background: '#1e293b', width: 50, borderRadius: 1 }} />
          <T s={7} color="rgba(30,41,59,0.5)" align="center">Since the beginning</T>
        </div>
      );
      if (slide === 1) return (
        <div style={{ ...zp(), gap: 8 }}>
          <T s={9} color="#1e293b" weight={800} spacing="-0.01em">Why the classics work:</T>
          <div style={{ height: 2, background: '#1e293b', width: '100%', opacity: 0.12 }} />
          {['Proven over decades','Built on real results','No gimmicks needed'].map((t, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ width: 16, height: 16, borderRadius: 3, border: '2px solid #1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <div style={{ width: 6, height: 5, borderLeft: '2px solid #1e293b', borderBottom: '2px solid #1e293b', transform: 'rotate(-45deg) translate(0.5px,-0.5px)' }} />
              </div>
              <T s={8} color="#1e293b" weight={600}>{t}</T>
            </div>
          ))}
        </div>
      );
      // slide 2 — Brand Statement (retro)
      return (
        <div style={{ ...z, background: '#1e293b', alignItems:'center', justifyContent:'center' }}>
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8, padding:'0 16px' }}>
            <div style={{ height:3, background:'#fef3c7', width:32 }} />
            <T s={8} color="rgba(254,243,199,0.45)" weight={300} align="center" spacing="0.08em" caps>Made for people who</T>
            <T s={14} color="#fef3c7" weight={900} align="center" spacing="-0.02em">respect what lasts.</T>
            <T s={7} color="rgba(254,243,199,0.3)" align="center">Not for the trend-chasers.</T>
          </div>
        </div>
      );
    }

    // ── color-block ───────────────────────────────────────────────────────────
    if (id === 'color-block') {
      if (slide === 0) return (
        <div style={{ ...z, flexDirection: 'row' }}>
          <div style={{ flex: 1, background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#fff', letterSpacing: '-0.04em', textAlign: 'center', lineHeight: 0.9 }}>BOLD<br/>.</div>
          </div>
          <div style={{ flex: 1, background: '#f8fafc', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 10 }}>
            <T s={8} color="#1e293b" weight={700} align="center">Stand out. Every time.</T>
            <div style={{ height: 2, background: accent, width: 30, borderRadius: 1 }} />
            <T s={7} color="#64748b" align="center">Swipe →</T>
          </div>
        </div>
      );
      if (slide === 1) return (
        <div style={{ ...z, flexDirection: 'row' }}>
          <div style={{ flex: 1, background: '#f8fafc', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', gap: 5, padding: '14px 10px' }}>
            <T s={8} color="#1e293b" weight={800} spacing="-0.01em">What's inside:</T>
            {['Bold templates','Pro copywriting','Easy to launch'].map((t, i) => (
              <Row key={i} gap={5}><Check color={accent} /><T s={7} color="#475569">{t}</T></Row>
            ))}
          </div>
          <div style={{ flex: 1, background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 10 }}>
            <T s={11} color="#fff" weight={900} align="center" spacing="-0.03em">All in one.</T>
          </div>
        </div>
      );
      // slide 2 — Cart Card (color-block split version)
      return (
        <div style={{ ...z, flexDirection: 'row' }}>
          <div style={{ flex: 1, background: '#0f172a', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', gap:5, padding:'14px 12px' }}>
            <Stars color="#f59e0b" />
            <T s={9} color="#f1f5f9" weight={800}>The Bold Bundle</T>
            <div style={{ display:'flex', gap:5, alignItems:'baseline' }}>
              <div style={{ textDecoration:'line-through' }}><T s={6} color="#475569">$99</T></div>
              <T s={14} color={accent} weight={900}>$49</T>
            </div>
            <div style={{ background:accent, borderRadius:5, padding:'5px 10px', width:'100%', textAlign:'center' }}>
              <T s={7.5} color="#fff" weight={700} align="center">Get It →</T>
            </div>
          </div>
          <div style={{ flex: 1, background: accent, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <T s={22} color="rgba(255,255,255,0.2)" weight={900} align="center" spacing="-0.06em">BOLD.</T>
          </div>
        </div>
      );
    }

    // ── headline-badge ────────────────────────────────────────────────────────
    if (id === 'headline-badge') {
      if (slide === 0) return (
        <div style={{ ...zc, gap: 8 }}>
          <div style={{ background: `${accent}22`, border: `1px solid ${accent}55`, borderRadius: 20, padding: '4px 12px' }}>
            <T s={7} color={accent} weight={700}>✦ Just Launched</T>
          </div>
          <T s={16} color="#f1f5f9" weight={900} align="center" spacing="-0.03em">The hook that converts every time.</T>
          <T s={8} color="rgba(241,245,249,0.4)" align="center">Swipe to see how →</T>
        </div>
      );
      if (slide === 1) return (
        <div style={{ ...zp(), gap: 8 }}>
          <div style={{ background: `${accent}18`, border: `1px solid ${accent}33`, borderRadius: 20, padding: '3px 10px', alignSelf: 'flex-start' }}>
            <T s={6} color={accent} weight={700}>Why it works</T>
          </div>
          {['Psychology-backed copy','Instant attention grab','Proven to convert'].map((t, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ width: 3, height: 14, borderRadius: 2, background: accent, flexShrink: 0 }} />
              <T s={8} color="#e2e8f0" weight={500}>{t}</T>
            </div>
          ))}
        </div>
      );
      // slide 2 — Brand Statement
      return (
        <div style={{ ...zc, gap: 9, padding:'0 16px' }}>
          <div style={{ background: `${accent}18`, border: `1px solid ${accent}33`, borderRadius: 20, padding: '3px 12px' }}>
            <T s={6} color={accent} weight={700}>✦ Brand philosophy</T>
          </div>
          <T s={8} color="rgba(241,245,249,0.45)" weight={300} align="center" spacing="0.06em" caps>For those who</T>
          <T s={13} color="#f1f5f9" weight={900} align="center" spacing="-0.03em">hook before they sell.</T>
          <T s={7} color="rgba(241,245,249,0.3)" align="center">Not for the pushy ones.</T>
        </div>
      );
    }

    // ── minimal ───────────────────────────────────────────────────────────────
    if (id === 'minimal') {
      if (slide === 0) return (
        <div style={{ ...zc, gap: 10 }}>
          <div style={{ height: 1, background: '#cbd5e1', width: '70%' }} />
          <T s={14} color="#0f172a" weight={700} align="center" spacing="-0.02em">Less noise.<br/>More signal.</T>
          <div style={{ height: 1, background: '#cbd5e1', width: '70%' }} />
          <T s={7} color="#94a3b8" align="center">The simpler way to grow</T>
        </div>
      );
      if (slide === 1) return (
        <div style={{ ...zp(), gap: 0 }}>
          {[['No fluff','Just what works'],['No bloat','Clean and fast'],['No guessing','Data-backed']].map(([a, b], i) => (
            <div key={i} style={{ borderBottom: '1px solid #e8eef4', padding: '9px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <T s={8} color="#0f172a" weight={700}>{a}</T>
              <T s={7} color="#94a3b8">{b}</T>
            </div>
          ))}
        </div>
      );
      // slide 2 — Save This
      return (
        <div style={{ ...zp(), gap: 7 }}>
          <T s={7} color="#94a3b8" caps spacing="0.12em">📌 Save this principle</T>
          <div style={{ background:`${accent}0f`, border:`1px solid ${accent}2a`, borderRadius: 8, padding:'10px 12px', width:'100%' }}>
            <T s={8.5} color="#0f172a" weight={700} align="left">Complexity is a bug, not a feature. The best tools are the ones you don't have to think about.</T>
          </div>
          <T s={7} color="#64748b">Share this with your team before the next tool debate.</T>
          <T s={7.5} color={accent} weight={700}>yourbrand.com →</T>
        </div>
      );
    }

    // ── bright-minimal ────────────────────────────────────────────────────────
    if (id === 'bright-minimal') {
      if (slide === 0) return (
        <div style={{ ...zc, gap: 10 }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', border: `2.5px solid ${accent}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 16, height: 16, borderRadius: '50%', background: accent }} />
          </div>
          <T s={14} color="#0f172a" weight={800} align="center" spacing="-0.02em">Simply better.</T>
          <T s={8} color="#64748b" align="center">No fluff. Just results.</T>
          <div style={{ background: accent, borderRadius: 30, padding: '7px 18px', marginTop: 4 }}>
            <T s={8} color="#fff" weight={700}>Try It Free</T>
          </div>
        </div>
      );
      if (slide === 1) return (
        <div style={{ ...zp(), gap: 10 }}>
          <T s={9} color="#0f172a" weight={800}>Everything included:</T>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, width: '100%' }}>
            {['✓ Templates','✓ Analytics','✓ Exports','✓ Support'].map((t, i) => (
              <div key={i} style={{ background: '#fff', borderRadius: 8, padding: '6px 8px', border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                <T s={7} color="#334155" weight={600}>{t}</T>
              </div>
            ))}
          </div>
        </div>
      );
      // slide 2 — Brand Statement
      return (
        <div style={{ ...zc, gap: 10, padding: '0 16px' }}>
          <div style={{ height: 1, background: '#e2e8f0', width: 40 }} />
          <T s={8} color="#94a3b8" weight={300} align="center" spacing="0.08em" caps>Built for people who</T>
          <T s={14} color="#0f172a" weight={900} align="center" spacing="-0.03em">like things that just work.</T>
          <T s={7} color="#cbd5e1" align="center">Not for everyone. That's fine.</T>
          <T s={7.5} color={accent} weight={700}>yourbrand.com →</T>
        </div>
      );
    }

    // ── text-only-bold ────────────────────────────────────────────────────────
    if (id === 'text-only-bold') {
      if (slide === 0) return (
        <div style={{ ...zc, gap: 8 }}>
          <T s={20} color="#fff" weight={900} align="center" spacing="-0.04em">We need to talk.</T>
          <T s={8} color="rgba(255,255,255,0.65)" align="center">About what you've been missing.</T>
          <div style={{ height: 1, background: 'rgba(255,255,255,0.3)', width: 50, marginTop: 4 }} />
        </div>
      );
      if (slide === 1) return (
        <div style={{ ...zc, gap: 8 }}>
          <T s={10} color="rgba(255,255,255,0.6)" weight={400} align="center">While you were busy, your competition was growing 3x faster.</T>
          <div style={{ height: 1, background: 'rgba(255,255,255,0.25)', width: '80%' }} />
          <T s={11} color="#fff" weight={800} align="center" spacing="-0.02em">It doesn't have to be that way.</T>
        </div>
      );
      // slide 2 — Brand Statement
      return (
        <div style={{ ...zc, gap: 9, padding:'0 16px' }}>
          <div style={{ height:1, background:'rgba(255,255,255,0.3)', width:40 }} />
          <T s={8} color="rgba(255,255,255,0.4)" weight={300} align="center" spacing="0.06em" caps>For those who</T>
          <T s={14} color="#fff" weight={900} align="center" spacing="-0.03em">say what no one else will.</T>
          <T s={7} color="rgba(255,255,255,0.3)" align="center">Not for everyone. That's the point.</T>
          <T s={7.5} color="rgba(255,255,255,0.6)" weight={700}>yourbrand.com</T>
        </div>
      );
    }

    // ── side-by-side ──────────────────────────────────────────────────────────
    if (id === 'side-by-side') {
      if (slide === 0) return (
        <div style={{ ...z, flexDirection: 'row' }}>
          <div style={{ flex: 1, background: '#fef2f2', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, borderRight: '2px solid #fff' }}>
            <T s={8} color="#ef4444" weight={800} caps>Before</T>
            <div style={{ fontSize: 22 }}>😰</div>
            <T s={7} color="#ef4444" align="center">Slow &amp; frustrated</T>
          </div>
          <div style={{ flex: 1, background: '#f0fdf4', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            <T s={8} color={accent} weight={800} caps>After</T>
            <div style={{ width: 22, height: 22, borderRadius: 6, background: `${accent}40`, border: `2px solid ${accent}` }} />
            <T s={7} color={accent} align="center">Fast &amp; winning</T>
          </div>
        </div>
      );
      if (slide === 1) return (
        <div style={{ ...z, flexDirection: 'row' }}>
          <div style={{ flex: 1, background: '#fef2f2', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', gap: 5, padding: '12px 8px', borderRight: '2px solid #fff' }}>
            {['Wasted hours','Costly mistakes','Zero clarity'].map((t, i) => (
              <Row key={i} gap={4}><Cross /><T s={7} color="#991b1b">{t}</T></Row>
            ))}
          </div>
          <div style={{ flex: 1, background: '#f0fdf4', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', gap: 5, padding: '12px 8px' }}>
            {['10x faster','Save $500/mo','Crystal clear'].map((t, i) => (
              <Row key={i} gap={4}><Check color="#16a34a" /><T s={7} color="#166534">{t}</T></Row>
            ))}
          </div>
        </div>
      );
      // slide 2 — Chapter Epilogue
      return (
        <div style={{ ...z, background: accent, alignItems:'flex-start', justifyContent:'flex-end', padding:'18px 18px 22px' }}>
          <div style={{ display:'flex', flexDirection:'column', gap:8, width:'100%' }}>
            <div style={{ height:1, background:'rgba(255,255,255,0.3)', width:'100%' }} />
            <T s={8.5} color="#fff" weight={300} align="left">That's the transformation. Slow to start, impossible to stop once it clicks.</T>
            <T s={7.5} color="rgba(255,255,255,0.6)" align="left">The only thing left? Your first step.</T>
            <T s={7.5} color="rgba(255,255,255,0.9)" weight={600}>@brand · link in bio →</T>
          </div>
        </div>
      );
    }

    // ── story-hook ────────────────────────────────────────────────────────────
    if (id === 'story-hook') {
      if (slide === 0) return (
        <div style={{ ...z }}>
          {/* Chapter-title card: full dark, cinematic big quote */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: accent }} />
          <div style={{ position: 'absolute', top: 14, left: 14 }}>
            <T s={6} color={accent} weight={700} caps spacing="0.14em">Chapter 1</T>
          </div>
          <div style={{ position: 'absolute', top: '22%', left: 10 }}>
            <div style={{ fontSize: 80, color: `${accent}18`, fontWeight: 900, lineHeight: 0.8, fontFamily: 'Georgia, serif' }}>"</div>
          </div>
          <div style={{ position: 'absolute', bottom: 16, left: 14, right: 14, display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#f1f5f9', letterSpacing: '-0.03em', lineHeight: 1.05 }}>"I failed for 3 years. Then one night changed everything."</div>
            <div style={{ height: 2, background: `${accent}55`, width: 40, marginTop: 2 }} />
            <T s={7} color={accent} weight={600}>Swipe to read →</T>
          </div>
        </div>
      );
      if (slide === 1) return (
        <div style={{ ...zp(), gap: 7 }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: accent }} />
          {/* Story milestone timeline */}
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 0, width: '100%' }}>
            {[['Year 1–3','Zero revenue. 100% failure rate.','rgba(241,245,249,0.35)'],['The night it clicked','Stopped copying, started creating.','rgba(241,245,249,0.6)'],['Week 8','$12,400. First real result.',accent]].map(([t,d,c],i) => (
              <div key={i} style={{ display: 'flex', gap: 10, paddingBottom: 10, position: 'relative' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: i===2?accent:`${accent}55`, flexShrink: 0, marginTop: 3 }} />
                  {i < 2 && <div style={{ width: 1, height: 22, background: `${accent}33` }} />}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <T s={6} color={accent} weight={700} caps spacing="0.08em">{t}</T>
                  <T s={8} color={c as string} weight={i===2?800:400}>{d}</T>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
      // slide 2 — Chapter Epilogue
      return (
        <div style={{ ...z, background: accent, alignItems:'flex-start', justifyContent:'flex-end', padding:'18px 18px 22px' }}>
          <div style={{ display:'flex', flexDirection:'column', gap:8, width:'100%' }}>
            <div style={{ height:1, background:'rgba(255,255,255,0.3)', width:'100%' }} />
            <T s={8.5} color="#fff" weight={300} align="left" spacing="0.01em">That's the whole story. From zero to something real. That's what it looks like.</T>
            <T s={7.5} color="rgba(255,255,255,0.6)" align="left">The next chapter is unwritten.</T>
            <T s={7.5} color="rgba(255,255,255,0.9)" weight={600}>@brand · link in bio →</T>
          </div>
        </div>
      );
    }

    // ── problem-slide ─────────────────────────────────────────────────────────
    if (id === 'problem-slide') {
      if (slide === 0) return (
        <div style={{ ...zp(), gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 8px #ef4444' }} />
            <T s={7} color="#ef4444" weight={700} caps spacing="0.1em">The problem</T>
          </div>
          <T s={12} color="#f1f5f9" weight={800} spacing="-0.02em">Still using yesterday's strategy?</T>
          <div style={{ height: 1, background: 'rgba(239,68,68,0.3)', width: '100%' }} />
          {['Posting daily, zero growth','Burning money on bad ads','Copying competitors'].map((t, i) => (
            <Row key={i} gap={6}><Cross /><T s={8} color="rgba(241,245,249,0.65)">{t}</T></Row>
          ))}
        </div>
      );
      if (slide === 1) return (
        <div style={{ ...zp(), gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px #22c55e' }} />
            <T s={7} color="#22c55e" weight={700} caps spacing="0.1em">The solution</T>
          </div>
          <T s={12} color="#f1f5f9" weight={800} spacing="-0.02em">There's a better way.</T>
          <div style={{ height: 1, background: 'rgba(34,197,94,0.3)', width: '100%' }} />
          {['AI-powered content strategy','Ads that actually convert','Grow on autopilot'].map((t, i) => (
            <Row key={i} gap={6}><Check color="#22c55e" /><T s={8} color="rgba(241,245,249,0.65)">{t}</T></Row>
          ))}
        </div>
      );
      // slide 2 — Permission Slip
      return (
        <div style={{ ...z, background: '#1a0a1e', alignItems:'center', justifyContent:'center', padding:18 }}>
          <div style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:12, padding:'16px 14px', width:'90%', display:'flex', flexDirection:'column', gap:8 }}>
            <T s={7} color={accent} weight={700} caps spacing="0.1em" align="center">A note for you</T>
            <T s={9} color="#f1f5f9" weight={600} align="center" spacing="-0.01em">It's not your fault the old strategy stopped working. The game changed. You just need a new one.</T>
            <div style={{ height:1, background:'rgba(255,255,255,0.1)', width:'100%' }} />
            <T s={7} color="rgba(241,245,249,0.45)" align="center">The solution already exists. You're looking at it.</T>
          </div>
        </div>
      );
    }

    // ── brand-manifesto ───────────────────────────────────────────────────────
    if (id === 'brand-manifesto') {
      if (slide === 0) return (
        <div style={{ ...z, padding:'18px 16px', justifyContent:'flex-end', gap:0 }}>
          {/* Shopify-bold: top accent bar, huge white manifesto text */}
          <div style={{ position:'absolute', top:0, left:0, right:0, height:4, background:accent }} />
          <div style={{ position:'absolute', top:14, left:16 }}>
            <T s={6} color={accent} weight={700} caps spacing="0.14em">Manifesto</T>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
            <div style={{ fontSize:28, fontWeight:900, color:'#f1f5f9', letterSpacing:'-0.04em', lineHeight:0.92 }}>We don't sell products.</div>
            <div style={{ fontSize:28, fontWeight:900, color:accent, letterSpacing:'-0.04em', lineHeight:0.92 }}>We build movements.</div>
            <div style={{ height:2, background:`${accent}55`, width:40, marginTop:8 }} />
          </div>
        </div>
      );
      if (slide === 1) return (
        <div style={{ ...zp(), gap: 0 }}>
          <div style={{ position:'absolute', top:0, left:0, right:0, height:4, background:accent }} />
          <div style={{ marginTop:8, width:'100%', display:'flex', flexDirection:'column', gap:0 }}>
            {[['Radical transparency','We say what others won\'t'],['Community first','Your success is our metric'],['Long-term thinking','We plant trees we won\'t see']].map(([v, d], i) => (
              <div key={i} style={{ borderBottom:'1px solid rgba(255,255,255,0.07)', padding:'9px 0', display:'flex', flexDirection:'column', gap:2 }}>
                <T s={9} color="#f1f5f9" weight={800} spacing="-0.01em">{v}</T>
                <T s={7} color={accent} weight={500}>{d}</T>
              </div>
            ))}
          </div>
        </div>
      );
      // slide 2 — Brand Statement (manifesto version)
      return (
        <div style={{ ...zc, gap: 9, padding:'0 16px' }}>
          <div style={{ position:'absolute', top:0, left:0, right:0, height:4, background:accent }} />
          <div style={{ height:2, background:accent, width:32, marginTop:8 }} />
          <T s={8} color="rgba(241,245,249,0.45)" weight={300} align="center" spacing="0.06em" caps>This is for people who</T>
          <T s={13} color="#f1f5f9" weight={900} align="center" spacing="-0.03em">build movements, not just businesses.</T>
          <T s={7} color="rgba(241,245,249,0.3)" align="center">Not for the passive ones.</T>
        </div>
      );
    }

    // ── ugc-style ─────────────────────────────────────────────────────────────
    if (id === 'ugc-style') {
      if (slide === 0) return (
        <div style={{ ...zp(), gap: 8 }}>
          <Row gap={8}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: `linear-gradient(135deg,${accent},#f472b6)`, flexShrink: 0 }} />
            <div>
              <T s={8} color="#1e293b" weight={700}>@sarahbuilds</T>
              <T s={7} color="#94a3b8">Sponsored · 2h ago</T>
            </div>
          </Row>
          <div style={{ background: '#f1f5f9', borderRadius: 8, height: 58, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <div style={{ width: 28, height: 44, borderRadius: 6, background: '#cbd5e1', border: '2px solid #94a3b8' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ height: 4, background: '#94a3b8', borderRadius: 2, width: 40 }} />
              <div style={{ height: 4, background: '#cbd5e1', borderRadius: 2, width: 30 }} />
            </div>
          </div>
          <T s={8} color="#1e293b" weight={500}>"Day 47 using this and I just crossed $10K/month. Not kidding."</T>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}><div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f43f5e' }} /><T s={7} color="#94a3b8">2.4K</T></div>
            <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}><div style={{ width: 8, height: 8, borderRadius: 2, background: '#94a3b8' }} /><T s={7} color="#94a3b8">183</T></div>
          </div>
        </div>
      );
      if (slide === 1) return (
        <div style={{ ...zp(), gap: 6 }}>
          <T s={8} color="#94a3b8" weight={500}>Results after 30 days:</T>
          {[['Revenue','$10,400/mo','↑ 340%'],['Followers','48.2K','↑ 180%'],['Leads/day','127','↑ 12x']].map(([l, v, c], i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', borderRadius: 6, padding: '6px 8px', width: '100%' }}>
              <T s={7} color="#64748b">{l}</T>
              <T s={8} color="#1e293b" weight={800}>{v}</T>
              <T s={7} color="#16a34a" weight={600}>{c}</T>
            </div>
          ))}
        </div>
      );
      // slide 2 — Chapter Epilogue
      return (
        <div style={{ ...z, background: accent, alignItems:'flex-start', justifyContent:'flex-end', padding:'18px 18px 22px' }}>
          <div style={{ display:'flex', flexDirection:'column', gap:8, width:'100%' }}>
            <div style={{ height:1, background:'rgba(255,255,255,0.3)', width:'100%' }} />
            <T s={8.5} color="#fff" weight={300} align="left" spacing="0.01em">That's day 47. $10K month. The most surprising part? She almost didn't start.</T>
            <T s={7.5} color="rgba(255,255,255,0.6)" align="left">14,000+ people like her chose to start anyway.</T>
            <T s={7.5} color="rgba(255,255,255,0.9)" weight={600}>@brand · link in bio →</T>
          </div>
        </div>
      );
    }

    // ── magazine-editorial ────────────────────────────────────────────────────
    if (id === 'magazine-editorial') {
      if (slide === 0) return (
        <div style={{ ...zp(), gap: 8 }}>
          <div style={{ height: 10 }} />
          <Row gap={8}>
            <T s={6} color="#94a3b8" caps spacing="0.12em">Issue 12</T>
            <div style={{ flex: 1, height: 1, background: '#e2e8f0', marginTop: 3 }} />
            <T s={6} color="#94a3b8" caps spacing="0.12em">May 2025</T>
          </Row>
          <T s={15} color="#0f172a" weight={800} spacing="-0.03em">The future of content is here.</T>
          <div style={{ height: 2, background: accent, width: 30 }} />
          <T s={7} color="#64748b">5 strategies reshaping how brands speak in 2025.</T>
        </div>
      );
      if (slide === 1) return (
        <div style={{ ...zp(), gap: 8 }}>
          <div style={{ height: 8 }} />
          <T s={7} color={accent} weight={700} caps spacing="0.1em">In this issue</T>
          {[['01','AI-first content strategy'],['02','The death of generic ads'],['03','What converts in 2025']].map(([n, t], i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', borderBottom: '1px solid #f1f5f9', padding: '7px 0', width: '100%' }}>
              <T s={7} color={accent} weight={800}>{n}</T>
              <T s={8} color="#334155" weight={500}>{t}</T>
            </div>
          ))}
        </div>
      );
      // slide 2 — Brand Statement
      return (
        <div style={{ position:'absolute', inset:0, zIndex:1, display:'flex', flexDirection:'column', padding:'14px 16px 20px', justifyContent:'flex-end', gap:7 }}>
          <div style={{ height:2, background:accent, width:24 }} />
          <T s={7} color="#94a3b8" caps spacing="0.12em" align="left">Editorial perspective</T>
          <T s={13} color="#0f172a" weight={900} align="left" spacing="-0.03em">Built for people who read to lead.</T>
          <T s={7.5} color="#64748b" align="left">Not everyone picks up the pen. You do.</T>
          <T s={7.5} color={accent} weight={700} align="left">yourbrand.com/subscribe →</T>
        </div>
      );
    }

    // ── testimonial ───────────────────────────────────────────────────────────
    if (id === 'testimonial') {
      if (slide === 0) return (
        <div style={{ ...zc, gap: 6 }}>
          <Stars color={accent} />
          <T s={10} color="#0f172a" weight={700} align="center" spacing="-0.01em">"Best decision I made for my business this year."</T>
          <Row gap={6}>
            <div style={{ width: 22, height: 22, borderRadius: '50%', background: `linear-gradient(135deg,${accent},#818cf8)` }} />
            <div>
              <T s={7} color="#334155" weight={700}>Sarah K.</T>
              <T s={6} color="#94a3b8">CEO, Bloom Studio</T>
            </div>
          </Row>
        </div>
      );
      if (slide === 1) return (
        <div style={{ ...zp(), gap: 7 }}>
          <T s={8} color="#64748b" weight={500}>More success stories:</T>
          {['"ROI doubled in 60 days."','"Saves me 10 hrs a week."','"Worth every penny."'].map((q, i) => (
            <div key={i} style={{ background: '#fff', borderRadius: 8, padding: '7px 10px', border: '1px solid #e2e8f0', width: '100%', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
              <Stars color={accent} />
              <T s={7} color="#334155" weight={500}>{q}</T>
            </div>
          ))}
        </div>
      );
      // slide 2 — Social Proof Stamp
      return (
        <div style={{ ...zc, gap: 7 }}>
          <div style={{ display:'flex' }}>
            {['#6366f1','#ec4899','#f59e0b','#22c55e','#0ea5e9'].map((c,i) => (
              <div key={i} style={{ width:22, height:22, borderRadius:'50%', background:c, border:'2px solid #fff', marginLeft: i > 0 ? -7 : 0, zIndex: 5-i }} />
            ))}
          </div>
          <T s={22} color="#0f172a" weight={900} align="center" spacing="-0.03em">10,000+</T>
          <T s={7.5} color="#64748b" align="center">verified 5-star customers</T>
          <Stars color="#f59e0b" />
          <Btn label="Read All Reviews →" bg={accent} />
        </div>
      );
    }

    // ── social-proof-grid ─────────────────────────────────────────────────────
    if (id === 'social-proof-grid') {
      const av = ['#6366f1','#ec4899','#f59e0b','#10b981','#3b82f6','#8b5cf6','#ef4444','#06b6d4','#84cc16'];
      if (slide === 0) return (
        <div style={{ ...zc, gap: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 3, width: '100%', padding: '0 8px' }}>
            {av.slice(0,9).map((c, i) => <div key={i} style={{ aspectRatio: '1/1', borderRadius: '50%', background: c, opacity: 0.85 }} />)}
            <div style={{ aspectRatio: '1/1', borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <T s={5} color="#64748b" weight={700}>+47K</T>
            </div>
          </div>
          <T s={13} color="#0f172a" weight={900} align="center" spacing="-0.02em">47,000+ creators trust us.</T>
          <T s={7} color="#64748b" align="center">Growing every day →</T>
        </div>
      );
      if (slide === 1) return (
        <div style={{ ...zc, gap: 10 }}>
          <T s={8} color="#64748b" weight={500} align="center">By the numbers</T>
          <Row gap={12}>
            {[['10x','avg growth'],['4.9★','rating'],['99%','uptime']].map(([v, l], i) => (
              <Col key={i} align="center" gap={2}>
                <T s={14} color={accent} weight={900} spacing="-0.03em">{v}</T>
                <T s={6} color="#94a3b8" align="center">{l}</T>
              </Col>
            ))}
          </Row>
          <div style={{ height: 1, background: '#f1f5f9', width: '80%' }} />
          <T s={7} color="#94a3b8" align="center">Verified by independent audit</T>
        </div>
      );
      // slide 2 — Social Proof Stamp
      return (
        <div style={{ ...zc, gap: 7 }}>
          <div style={{ display:'flex' }}>
            {['#6366f1','#ec4899','#f59e0b','#10b981','#3b82f6'].map((c,i) => (
              <div key={i} style={{ width:22, height:22, borderRadius:'50%', background:c, border:'2px solid #fff', marginLeft: i > 0 ? -7 : 0, zIndex: 5-i }} />
            ))}
          </div>
          <T s={20} color="#0f172a" weight={900} align="center" spacing="-0.04em">47,000+</T>
          <T s={7.5} color="#64748b" align="center">creators growing with us</T>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <Stars color="#f59e0b" />
            <T s={7} color="#94a3b8">4.9 avg</T>
          </div>
          <Btn label="Join the Community →" bg={accent} />
        </div>
      );
    }

    // ── stats-hero ────────────────────────────────────────────────────────────
    if (id === 'stats-hero') {
      if (slide === 0) return (
        <div style={{ ...z, padding: '16px 14px', justifyContent: 'flex-end', gap: 0 }}>
          {/* Huge stat dominates the frame — data-infographic style */}
          <div style={{ position: 'absolute', top: 14, left: 14 }}>
            <T s={6} color={accent} weight={700} caps spacing="0.14em">New study · 2026</T>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ fontSize: 56, fontWeight: 900, color: '#f1f5f9', letterSpacing: '-0.06em', lineHeight: 0.85 }}>312%</div>
            <T s={8} color="rgba(241,245,249,0.55)" weight={400}>average revenue growth in 90 days</T>
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              <div style={{ height: 3, background: accent, borderRadius: 2, flex: 3 }} />
              <div style={{ height: 3, background: `${accent}33`, borderRadius: 2, flex: 1 }} />
            </div>
            <T s={6} color={accent} weight={600}>Based on 5,000+ users · Swipe to see →</T>
          </div>
        </div>
      );
      if (slide === 1) return (
        <div style={{ ...zp(), gap: 7 }}>
          <T s={7} color="rgba(241,245,249,0.45)" caps spacing="0.1em">Average customer results</T>
          {[['Revenue','↑ 312%',85],['Lead volume','↑ 47%',55],['Cost per lead','↓ 63%',70],['Time saved','10 hrs/wk',90]].map(([l,v,w],i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <T s={7} color="rgba(241,245,249,0.6)">{l}</T>
                <T s={7} color={accent} weight={800}>{v}</T>
              </div>
              <div style={{ height: 4, background: 'rgba(255,255,255,0.07)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ width: `${w}%`, height: '100%', background: accent, borderRadius: 2 }} />
              </div>
            </div>
          ))}
        </div>
      );
      // slide 2 — Social Proof Stamp
      return (
        <div style={{ ...zc, gap: 7 }}>
          <div style={{ display:'flex' }}>
            {['#f1f5f9','rgba(241,245,249,0.8)','rgba(241,245,249,0.6)','rgba(241,245,249,0.4)','rgba(241,245,249,0.25)'].map((c,i) => (
              <div key={i} style={{ width:22, height:22, borderRadius:'50%', background:c, border:`2px solid ${accent}33`, marginLeft: i > 0 ? -7 : 0, zIndex: 5-i }} />
            ))}
          </div>
          <T s={22} color="#f1f5f9" weight={900} align="center" spacing="-0.04em">5,000+</T>
          <T s={7.5} color="rgba(241,245,249,0.55)" align="center">companies averaging 312% revenue growth</T>
          <div style={{ display:'flex', gap:4 }}>
            {[1,2,3,4,5].map(i => <div key={i} style={{ fontSize:13, color:'#fbbf24' }}>★</div>)}
          </div>
          <T s={7} color={accent} weight={600}>Link in bio →</T>
        </div>
      );
    }

    // ── product-center ────────────────────────────────────────────────────────
    if (id === 'product-center') {
      if (slide === 0) return (
        <div style={{ ...zc, gap: 8 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: `linear-gradient(135deg,${accent},#818cf8)`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 8px 24px ${accent}44` }}><div style={{ width: 18, height: 18, borderRadius: 4, background: 'rgba(255,255,255,0.35)' }} /></div>
          <T s={12} color="#0f172a" weight={800} align="center" spacing="-0.02em">Power up your workflow</T>
          <Row gap={6}>
            {['Fast','Smart','Safe'].map(f => (
              <div key={f} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, padding: '3px 7px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <T s={7} color="#475569" weight={600}>{f}</T>
              </div>
            ))}
          </Row>
        </div>
      );
      if (slide === 1) return (
        <div style={{ ...zp(), gap: 7 }}>
          <T s={9} color="#0f172a" weight={800} spacing="-0.01em">Everything you need:</T>
          {['Instant results, day one','Real-time analytics','AI does the heavy lifting'].map((t, i) => (
            <div key={i} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 10px', display: 'flex', gap: 8, alignItems: 'center', width: '100%', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: accent, flexShrink: 0 }} />
              <T s={8} color="#334155" weight={500}>{t}</T>
            </div>
          ))}
        </div>
      );
      // slide 2 — Cart Card
      return (
        <div style={{ ...zc, gap: 0, padding: 12 }}>
          <div style={{ background:'#fff', borderRadius:10, padding:'10px 12px', width:'92%', boxShadow:`0 6px 24px ${accent}22`, display:'flex', flexDirection:'column', gap:6, border:`1px solid ${accent}18` }}>
            <div style={{ height:44, background:`${accent}14`, borderRadius:6, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <div style={{ width:30, height:30, borderRadius:8, background:`linear-gradient(135deg,${accent},#818cf8)`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                <div style={{ width:10, height:10, borderRadius:3, background:'rgba(255,255,255,0.5)' }} />
              </div>
            </div>
            <T s={8.5} color="#111" weight={700} align="left">Pro Workflow Suite</T>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <Stars color="#f59e0b" />
              <T s={13} color={accent} weight={900}>Free</T>
            </div>
            <div style={{ background:accent, borderRadius:6, padding:'6px 0', textAlign:'center' }}>
              <T s={8} color="#fff" weight={800} align="center">Get Free Access →</T>
            </div>
          </div>
        </div>
      );
    }

    // ── product-demo ──────────────────────────────────────────────────────────
    if (id === 'product-demo') {
      if (slide === 0) return (
        <div style={{ ...zc, gap: 8 }}>
          <div style={{ width: '88%', background: '#1e293b', borderRadius: 8, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.18)' }}>
            <div style={{ background: '#334155', padding: '5px 8px', display: 'flex', gap: 4, alignItems: 'center' }}>
              {['#ef4444','#fbbf24','#22c55e'].map(c => <div key={c} style={{ width: 6, height: 6, borderRadius: '50%', background: c }} />)}
              <div style={{ flex: 1, background: '#475569', borderRadius: 3, height: 5, marginLeft: 4 }} />
            </div>
            <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ height: 5, background: `${accent}77`, borderRadius: 3, width: '75%' }} />
              <div style={{ height: 4, background: 'rgba(255,255,255,0.15)', borderRadius: 3, width: '55%' }} />
              <div style={{ height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 3, width: '65%' }} />
              <div style={{ marginTop: 4, background: accent, borderRadius: 4, padding: '3px 10px', alignSelf: 'flex-start' }}>
                <T s={6} color="#fff" weight={700}>Generate →</T>
              </div>
            </div>
          </div>
          <T s={8} color="#475569" align="center">See it in action</T>
        </div>
      );
      if (slide === 1) return (
        <div style={{ ...zp(), gap: 7 }}>
          <T s={9} color="#0f172a" weight={800}>How it works:</T>
          {[['1','Enter your brief','30 sec'],['2','AI generates ads','Instantly'],['3','Export & launch','1 click']].map(([n, t, d], i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', background: '#fff', borderRadius: 8, padding: '6px 10px', border: '1px solid #e2e8f0', width: '100%', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
              <div style={{ width: 18, height: 18, borderRadius: '50%', background: accent, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <T s={7} color="#fff" weight={800}>{n}</T>
              </div>
              <T s={8} color="#334155" weight={600}>{t}</T>
              <T s={6} color="#94a3b8" weight={500}>{d}</T>
            </div>
          ))}
        </div>
      );
      // slide 2 — Cart Card
      return (
        <div style={{ ...zc, gap: 0, padding: 12 }}>
          <div style={{ background:'#fff', borderRadius:10, padding:'10px 12px', width:'92%', boxShadow:'0 6px 24px rgba(0,0,0,0.1)', display:'flex', flexDirection:'column', gap:6 }}>
            <div style={{ height:44, background:'#1e293b', borderRadius:6, display:'flex', alignItems:'center', padding:'0 8px', gap:4 }}>
              {['#ef4444','#fbbf24','#22c55e'].map(c => <div key={c} style={{ width:5, height:5, borderRadius:'50%', background:c }} />)}
              <div style={{ flex:1, background:'rgba(255,255,255,0.1)', borderRadius:3, height:4, marginLeft:4 }} />
            </div>
            <T s={8.5} color="#111" weight={700} align="left">AI Ad Generator</T>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <Stars color="#f59e0b" />
              <div style={{ display:'flex', gap:5, alignItems:'baseline' }}>
                <div style={{ textDecoration:'line-through' }}><T s={6} color="#94a3b8">$99</T></div>
                <T s={13} color={accent} weight={900}>Free</T>
              </div>
            </div>
            <div style={{ background:accent, borderRadius:6, padding:'6px 0', textAlign:'center' }}>
              <T s={8} color="#fff" weight={800} align="center">Watch Demo →</T>
            </div>
          </div>
        </div>
      );
    }

    // ── floating-card ─────────────────────────────────────────────────────────
    if (id === 'floating-card') {
      const card: React.CSSProperties = { background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(18px)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 12, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6, width: '85%' };
      if (slide === 0) return (
        <div style={{ ...zc }}>
          <div style={card}>
            <T s={7} color="rgba(255,255,255,0.6)" caps spacing="0.1em">Introducing</T>
            <T s={14} color="#fff" weight={900} spacing="-0.03em">Something new.</T>
            <T s={8} color="rgba(255,255,255,0.6)">Crafted for creators who want more.</T>
            <div style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 6, padding: '6px 12px', alignSelf: 'flex-start', marginTop: 2 }}>
              <T s={8} color="#fff" weight={700}>Discover →</T>
            </div>
          </div>
        </div>
      );
      if (slide === 1) return (
        <div style={{ ...zc }}>
          <div style={card}>
            <T s={8} color="rgba(255,255,255,0.65)" weight={500}>What's inside:</T>
            {['Premium templates','AI copy engine','Export to any format'].map((t, i) => (
              <Row key={i} gap={6}>
                <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#fff', flexShrink: 0, marginTop: 2 }} />
                <T s={8} color="#fff" weight={500}>{t}</T>
              </Row>
            ))}
          </div>
        </div>
      );
      return (
        <div style={{ ...zc }}>
          <div style={card}>
            <T s={11} color="#fff" weight={900} spacing="-0.02em">Start creating today.</T>
            <div style={{ background: '#fff', borderRadius: 6, padding: '7px 14px', alignSelf: 'flex-start', boxShadow: '0 4px 14px rgba(0,0,0,0.2)', marginTop: 2 }}>
              <T s={8} color="#7c3aed" weight={800}>Get Access →</T>
            </div>
          </div>
        </div>
      );
    }

    // ── feature-list ──────────────────────────────────────────────────────────
    if (id === 'feature-list') {
      if (slide === 0) return (
        <div style={{ ...zp(), gap: 5 }}>
          {/* Merriam-Webster educational style: definition card */}
          <T s={6} color="#94a3b8" caps spacing="0.14em">What's included</T>
          <div style={{ height: 1, background: '#e2e8f0', width: '100%' }} />
          <div style={{ lineHeight: 1.05 }}><T s={14} color="#0f172a" weight={900} spacing="-0.03em">Everything you need to win.</T></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 4, width: '100%' }}>
            {[['✦','AI-powered copy that converts','Generate 10x faster'],['✦','30+ pro templates','For every niche & format'],['✦','One-click export','PNG, MP4, Canva — done']].map(([icon,t,d],i) => (
              <div key={i} style={{ display: 'flex', gap: 8, padding: '5px 0', borderBottom: i < 2 ? '1px solid #f1f5f9' : 'none' }}>
                <T s={8} color={accent} weight={900}>{icon}</T>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <T s={8} color="#0f172a" weight={700}>{t}</T>
                  <T s={6.5} color="#64748b">{d}</T>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
      if (slide === 1) return (
        <div style={{ ...zp(), gap: 5 }}>
          <T s={7} color="#64748b" caps spacing="0.1em">Side-by-side comparison</T>
          <div style={{ width: '100%' }}>
            <div style={{ display: 'flex', gap: 6, paddingBottom: 5, borderBottom: `2px solid ${accent}33`, marginBottom: 3 }}>
              <div style={{ flex: 2 }} />
              <div style={{ minWidth: 30, textAlign: 'center' }}><T s={7} color={accent} weight={800}>Us</T></div>
              <div style={{ minWidth: 30, textAlign: 'center' }}><T s={7} color="#94a3b8" weight={600}>Them</T></div>
            </div>
            {[['AI Copy','✓','✗'],['Templates','30+','5'],['Export','Free','$49/mo'],['Support','24/7','Email only'],['Setup','5 min','Days']].map(([f, a, b], i) => (
              <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '4px 0', borderBottom: '1px solid #f8fafc' }}>
                <div style={{ flex: 2 }}><T s={7} color="#334155" weight={500}>{f as string}</T></div>
                <div style={{ minWidth: 30, textAlign: 'center' }}><T s={8} color={accent} weight={800}>{a}</T></div>
                <div style={{ minWidth: 30, textAlign: 'center' }}><T s={8} color="#94a3b8">{b}</T></div>
              </div>
            ))}
          </div>
        </div>
      );
      // slide 2 — Save This
      return (
        <div style={{ ...zp(), gap: 7 }}>
          <T s={7} color="#94a3b8" caps spacing="0.12em">📌 Save this comparison</T>
          <div style={{ background:`${accent}0f`, border:`1px solid ${accent}2a`, borderRadius: 8, padding:'10px 12px', width:'100%' }}>
            <T s={8.5} color="#0f172a" weight={700} align="left">The tool with the most features isn't always the best one. The best one is the one you'll actually use.</T>
          </div>
          <T s={7} color="#64748b">Share this with your team before they buy the expensive one.</T>
          <T s={7.5} color={accent} weight={700}>Full comparison at: yourbrand.com →</T>
        </div>
      );
    }

    // ── number-list ───────────────────────────────────────────────────────────
    if (id === 'number-list') {
      if (slide === 0) return (
        <div style={{ ...zp(), gap: 8 }}>
          <T s={11} color="#0f172a" weight={900} spacing="-0.02em">3 steps to your first $10K</T>
          <div style={{ height: 2, background: accent, width: 30, borderRadius: 1 }} />
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', width: '100%' }}>
            <div style={{ width: 24, height: 24, borderRadius: '50%', background: accent, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 4px 12px ${accent}55` }}>
              <T s={9} color="#fff" weight={900}>1</T>
            </div>
            <div>
              <T s={9} color="#0f172a" weight={700}>Discover your angle</T>
              <T s={7} color="#64748b">Find what makes you different</T>
            </div>
          </div>
        </div>
      );
      if (slide === 1) return (
        <div style={{ ...zp(), gap: 8 }}>
          {[[2,'Build in minutes','AI does the writing for you'],[3,'Launch & grow','Post, track, scale']].map(([n, t, d], i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', width: '100%' }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: i === 0 ? `${accent}33` : `${accent}18`, border: `2px solid ${accent}55`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <T s={9} color={accent} weight={900}>{n as string}</T>
              </div>
              <div>
                <T s={9} color="#0f172a" weight={700}>{t as string}</T>
                <T s={7} color="#64748b">{d as string}</T>
              </div>
            </div>
          ))}
        </div>
      );
      // slide 2 — Save This
      return (
        <div style={{ ...z, background: accent, alignItems:'flex-start', justifyContent:'center', padding:16 }}>
          <div style={{ display:'flex', flexDirection:'column', gap:7, width:'100%' }}>
            <T s={7} color="rgba(255,255,255,0.55)" caps spacing="0.12em">📌 The 3-step shortcut</T>
            <div style={{ background:'rgba(255,255,255,0.12)', border:'1px solid rgba(255,255,255,0.2)', borderRadius: 8, padding:'10px 12px' }}>
              <T s={8.5} color="#fff" weight={700} align="left">Most people skip step 1. That's why they're stuck.</T>
            </div>
            <T s={7} color="rgba(255,255,255,0.55)">Save this. Your future self will thank you.</T>
            <T s={7.5} color="rgba(255,255,255,0.9)" weight={700}>yourbrand.com →</T>
          </div>
        </div>
      );
    }

    // ── split-panel ───────────────────────────────────────────────────────────
    if (id === 'split-panel') {
      if (slide === 0) return (
        <div style={{ ...z, flexDirection: 'row' }}>
          <div style={{ flex: 1.1, background: `linear-gradient(180deg,${accent},${accent}cc)`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'rgba(255,255,255,0.25)', border: '2px solid rgba(255,255,255,0.5)' }} />
            <T s={8} color="rgba(255,255,255,0.85)" align="center">Built for results</T>
          </div>
          <div style={{ flex: 1, background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(8px)', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', padding: 12, gap: 5 }}>
            <T s={9} color="#0f172a" weight={800} spacing="-0.01em">Ads that work.</T>
            <T s={7} color="#64748b">No guesswork.</T>
            <div style={{ background: accent, borderRadius: 6, padding: '5px 10px', marginTop: 4 }}>
              <T s={7} color="#fff" weight={700}>See How →</T>
            </div>
          </div>
        </div>
      );
      if (slide === 1) return (
        <div style={{ ...z, flexDirection: 'row' }}>
          <div style={{ flex: 1.1, background: `${accent}18`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5, padding: 10 }}>
            {[['47%','↑ Clicks'],['3x','Revenue'],['$0','Fees']].map(([v, l], i) => (
              <Col key={i} align="center" gap={0}>
                <T s={13} color={accent} weight={900} spacing="-0.03em">{v}</T>
                <T s={6} color="#64748b">{l}</T>
              </Col>
            ))}
          </div>
          <div style={{ flex: 1, background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(8px)', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', padding: 12, gap: 5 }}>
            <T s={8} color="#0f172a" weight={800}>Real growth.</T>
            {['Avg customer','In 60 days'].map((t, i) => <T key={i} s={7} color="#64748b">{t}</T>)}
          </div>
        </div>
      );
      // slide 2 — Cart Card (split-panel version)
      return (
        <div style={{ ...z, flexDirection: 'row' }}>
          <div style={{ flex: 1.1, background: accent, display: 'flex', flexDirection:'column', alignItems: 'center', justifyContent: 'center', gap:4 }}>
            <T s={22} color="#fff" weight={900} align="center" spacing="-0.04em">$0</T>
            <T s={7} color="rgba(255,255,255,0.65)" align="center">to start</T>
          </div>
          <div style={{ flex: 1, background: 'rgba(255,255,255,0.9)', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', gap: 5, padding: 10 }}>
            <Stars color="#f59e0b" />
            <T s={8} color="#0f172a" weight={800}>Ads that work.</T>
            <T s={6.5} color="#64748b">10k+ creators</T>
            <div style={{ background: accent, borderRadius: 5, padding: '5px 10px', width: '100%', textAlign: 'center', marginTop:2 }}>
              <T s={7.5} color="#fff" weight={700} align="center">Start Free →</T>
            </div>
          </div>
        </div>
      );
    }

    // ── overlay-card ──────────────────────────────────────────────────────────
    if (id === 'overlay-card') {
      const topZone = { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: '44%' };
      const glassCard: React.CSSProperties = { position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(16px)', borderTop: '1px solid rgba(255,255,255,0.22)', padding: '13px 14px', display: 'flex', flexDirection: 'column', gap: 5 };
      if (slide === 0) return (
        <div style={{ ...z }}>
          <div style={{ ...topZone, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(255,255,255,0.15)', border: '2px solid rgba(255,255,255,0.3)' }} />
          </div>
          <div style={glassCard}>
            <T s={11} color="#fff" weight={800} spacing="-0.02em">Ready to transform?</T>
            <T s={7} color="rgba(255,255,255,0.65)">Join thousands who already did.</T>
            <div style={{ background: '#fff', borderRadius: 6, padding: '6px 14px', alignSelf: 'flex-start', marginTop: 4 }}>
              <T s={8} color="#7c3aed" weight={800}>Get Access →</T>
            </div>
          </div>
        </div>
      );
      if (slide === 1) return (
        <div style={{ ...z }}>
          <div style={{ ...topZone, padding: '14px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4 }}>
            {['10,000+ users','4.9★ rating','24/7 support'].map((t, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#fff', opacity: 0.8 }} />
                <T s={7} color="rgba(255,255,255,0.9)" weight={500}>{t}</T>
              </div>
            ))}
          </div>
          <div style={glassCard}>
            <T s={9} color="#fff" weight={700}>Trusted by the best.</T>
            <T s={7} color="rgba(255,255,255,0.6)">In 47 countries worldwide.</T>
          </div>
        </div>
      );
      // slide 2 — Chapter Epilogue
      return (
        <div style={{ ...z }}>
          <div style={{ ...topZone, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <T s={13} color="rgba(255,255,255,0.6)" weight={300} align="center" spacing="0.02em">The transformation is real.</T>
          </div>
          <div style={glassCard}>
            <div style={{ height:1, background:'rgba(255,255,255,0.2)', width:'100%' }} />
            <T s={8} color="#fff" weight={300} align="left" spacing="0.01em">That's what happened when we stopped talking and started building.</T>
            <T s={7.5} color="#7c3aed" weight={600}>@brand · link in bio →</T>
          </div>
        </div>
      );
    }

    // ── cta-final ─────────────────────────────────────────────────────────────
    if (id === 'cta-final') {
      const red = '#ef4444';
      if (slide === 0) return (
        <div style={{ ...zc, gap: 8 }}>
          <div style={{ background: `${red}22`, border: `1px solid ${red}55`, borderRadius: 6, padding: '3px 10px' }}>
            <T s={7} color={red} weight={700} caps spacing="0.1em">Limited Time</T>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 40, fontWeight: 900, color: '#f1f5f9', letterSpacing: '-0.05em', lineHeight: 0.9 }}>50%</div>
            <div style={{ fontSize: 14, fontWeight: 900, color: red, letterSpacing: '-0.03em' }}>OFF TODAY</div>
          </div>
          <T s={7} color="rgba(241,245,249,0.45)" align="center">Price goes up at midnight</T>
        </div>
      );
      if (slide === 1) return (
        <div style={{ ...zp(), gap: 7 }}>
          <T s={8} color="#f1f5f9" weight={800}>What's included:</T>
          {['All 30+ templates','AI copy engine','Lifetime access','Priority support'].map((t, i) => (
            <Row key={i} gap={6}><Check color="#22c55e" /><T s={8} color="rgba(241,245,249,0.8)" weight={500}>{t}</T></Row>
          ))}
          <div style={{ background: `${red}18`, border: `1px solid ${red}33`, borderRadius: 6, padding: '5px 8px', display: 'flex', justifyContent: 'space-between', width: '100%' }}>
            <T s={8} color="rgba(241,245,249,0.5)">Total value:</T>
            <T s={8} color={red} weight={700}>$497 → FREE</T>
          </div>
        </div>
      );
      // slide 2 — Value Receipt
      return (
        <div style={{ ...zp('flex-start'), gap: 6 }}>
          <T s={7} color="rgba(255,255,255,0.45)" caps spacing="0.12em">What you get today</T>
          <div style={{ width: '100%', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, overflow: 'hidden' }}>
            {[['Templates bundle','$197'],['AI copy engine','$97'],['Lifetime updates','$49']].map(([name,val],i) => (
              <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 10px', borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.07)' : 'none', background: i % 2 === 0 ? 'rgba(255,255,255,0.04)' : 'transparent' }}>
                <T s={7.5} color="rgba(255,255,255,0.7)" weight={500}>{name}</T>
                <T s={7} color="rgba(255,255,255,0.35)" weight={400}>{val}</T>
              </div>
            ))}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'7px 10px', background:'rgba(255,255,255,0.07)', borderTop:'1px solid rgba(255,255,255,0.15)' }}>
              <T s={7.5} color="rgba(255,255,255,0.7)" weight={700}>Today only</T>
              <T s={15} color={red} weight={900}>$97</T>
            </div>
          </div>
          <Btn label="Claim 50% Off →" bg={red} />
        </div>
      );
    }

    // ── countdown-urgency ─────────────────────────────────────────────────────
    if (id === 'countdown-urgency') {
      if (slide === 0) return (
        <div style={{ ...zc, gap: 8 }}>
          <T s={8} color="rgba(239,68,68,0.9)" weight={700} caps spacing="0.1em">⏰ Sale ends in</T>
          <Row gap={4}>
            {['00','12','34'].map((t, i) => (
              <React.Fragment key={i}>
                {i > 0 && <T s={14} color="rgba(241,245,249,0.3)" weight={700}>:</T>}
                <div style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, padding: '6px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, backdropFilter: 'blur(8px)' }}>
                  <T s={16} color="#f1f5f9" weight={900}>{t}</T>
                  <T s={5} color="rgba(241,245,249,0.3)" caps spacing="0.05em">{['hrs','min','sec'][i]}</T>
                </div>
              </React.Fragment>
            ))}
          </Row>
          <T s={7} color="rgba(239,68,68,0.7)" align="center">After midnight, price doubles.</T>
        </div>
      );
      if (slide === 1) return (
        <div style={{ ...zp(), gap: 7 }}>
          <T s={8} color="#f1f5f9" weight={700}>Before the timer hits zero:</T>
          {['Full access — lifetime deal','Save $200 vs monthly price','Lock in your rate forever'].map((t, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: '7px 10px', backdropFilter: 'blur(4px)', width: '100%' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', flexShrink: 0 }} />
              <T s={8} color="rgba(241,245,249,0.75)" weight={500}>{t}</T>
            </div>
          ))}
        </div>
      );
      // slide 2 — Value Receipt
      return (
        <div style={{ ...zp('flex-start'), gap: 6 }}>
          <T s={7} color="rgba(255,255,255,0.45)" caps spacing="0.12em">Before the timer hits zero</T>
          <div style={{ width: '100%', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, overflow: 'hidden' }}>
            {[['Full access','$299 value'],['Priority support','$99 value'],['Locked-in rate','Priceless']].map(([name,val],i) => (
              <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 10px', borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.07)' : 'none', background: i % 2 === 0 ? 'rgba(255,255,255,0.04)' : 'transparent' }}>
                <T s={7.5} color="rgba(255,255,255,0.7)" weight={500}>{name}</T>
                <T s={7} color="rgba(255,255,255,0.35)">{val}</T>
              </div>
            ))}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'7px 10px', background:'rgba(255,255,255,0.07)', borderTop:'1px solid rgba(255,255,255,0.15)' }}>
              <T s={7.5} color="rgba(255,255,255,0.7)" weight={700}>Your price</T>
              <T s={15} color="#ef4444" weight={900}>$97</T>
            </div>
          </div>
          <Btn label="Grab the Deal →" bg="#ef4444" />
        </div>
      );
    }

    // ── dark-luxury ───────────────────────────────────────────────────────────
    if (id === 'dark-luxury') {
      const gold = '#d4af37';
      if (slide === 0) return (
        <div style={{ ...zc, gap: 8 }}>
          <div style={{ height: 1, background: gold, width: 60, opacity: 0.65 }} />
          <T s={7} color={gold} caps spacing="0.22em" weight={500}>Exclusively Yours</T>
          <T s={15} color="#f5f0e8" weight={300} align="center" spacing="0.03em">Luxury<br/>redefined.</T>
          <div style={{ height: 1, background: gold, width: 60, opacity: 0.65 }} />
          <T s={7} color="rgba(245,240,232,0.3)" align="center">Swipe to discover →</T>
        </div>
      );
      if (slide === 1) return (
        <div style={{ ...zp(), gap: 9 }}>
          <T s={7} color={gold} caps spacing="0.18em">The collection</T>
          {[['Craftsmanship','Handmade, always'],['Exclusivity','Limited to 100'],['Legacy','Est. 1987']].map(([k, v], i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(212,175,55,0.14)', paddingBottom: 8, width: '100%' }}>
              <T s={8} color="rgba(245,240,232,0.7)" weight={400}>{k}</T>
              <T s={7} color={gold} weight={500}>{v}</T>
            </div>
          ))}
        </div>
      );
      // slide 2 — Brand Statement (luxury version)
      return (
        <div style={{ ...zc, gap: 9, padding:'0 20px' }}>
          <div style={{ height:1, background:gold, width:50, opacity:0.55 }} />
          <T s={8} color="rgba(245,240,232,0.35)" weight={300} align="center" spacing="0.1em" caps>Crafted for those who</T>
          <T s={13} color="#f5f0e8" weight={300} align="center" spacing="0.02em">know the difference.</T>
          <div style={{ height:1, background:gold, width:30, opacity:0.4 }} />
          <T s={7} color="rgba(245,240,232,0.25)" align="center" spacing="0.06em">Not for everyone.</T>
        </div>
      );
    }

    // ── offer-stack ──────────────────────────────────────────────────────────────
    if (id === 'offer-stack') {
      if (slide === 0) return (
        <div style={{ ...z, alignItems: 'center', justifyContent: 'center', gap: 6, padding: 16 }}>
          <div style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 20, padding: '4px 14px' }}>
            <T s={7} color="rgba(255,255,255,0.8)" caps spacing="0.1em">Today Only</T>
          </div>
          <T s={54} color="#fff" weight={900} align="center" spacing="-0.05em">50%</T>
          <T s={13} color="rgba(255,255,255,0.7)" align="center" caps spacing="0.06em">off everything</T>
          <Btn label="Claim Your Offer →" bg={accent} />
        </div>
      );
      if (slide === 1) return (
        <div style={{ ...z, justifyContent: 'center', gap: 8, padding: 18 }}>
          <T s={8} color={accent} caps spacing="0.1em">What's included</T>
          <T s={14} color="#fff" weight={800} spacing="-0.02em">Everything you need.</T>
          {['Feature one','Feature two','Feature three'].map((f,i) => (
            <Row key={i}><Check color={accent} /><T s={9} color="rgba(255,255,255,0.75)">{f}</T></Row>
          ))}
        </div>
      );
      // slide 2 — Value Receipt
      return (
        <div style={{ ...zp('flex-start'), gap: 6 }}>
          <T s={7} color="rgba(255,255,255,0.45)" caps spacing="0.12em">What's in the bundle</T>
          <div style={{ width: '100%', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, overflow: 'hidden' }}>
            {[['Full platform access','$297'],['All future templates','$147'],['1-on-1 onboarding','$99']].map(([name,val],i) => (
              <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 10px', borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.07)' : 'none', background: i % 2 === 0 ? 'rgba(255,255,255,0.04)' : 'transparent' }}>
                <T s={7.5} color="rgba(255,255,255,0.7)" weight={500}>{name}</T>
                <T s={7} color="rgba(255,255,255,0.35)">{val}</T>
              </div>
            ))}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'7px 10px', background:'rgba(255,255,255,0.07)', borderTop:'1px solid rgba(255,255,255,0.15)' }}>
              <T s={7.5} color="rgba(255,255,255,0.7)" weight={700}>Today only</T>
              <T s={15} color={accent} weight={900}>$97</T>
            </div>
          </div>
          <Btn label="Get 50% Off Now →" bg={accent} />
        </div>
      );
    }

    // ── value-math ───────────────────────────────────────────────────────────────
    if (id === 'value-math') {
      if (slide === 0) return (
        <div style={{ ...z, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 18 }}>
          <T s={8} color="rgba(255,255,255,0.45)" caps spacing="0.1em">They charge</T>
          <T s={28} color="rgba(255,255,255,0.25)" weight={900} spacing="-0.04em" align="center"><span style={{ textDecoration: 'line-through' }}>$299/mo</span></T>
          <T s={8} color={accent} caps spacing="0.08em">You pay</T>
          <T s={44} color={accent} weight={900} spacing="-0.05em" align="center">$97</T>
          <T s={9} color="rgba(16,185,129,0.7)" align="center">Save $202 every month</T>
        </div>
      );
      if (slide === 1) return (
        <div style={{ ...z, justifyContent: 'center', gap: 8, padding: 20 }}>
          <T s={8} color={accent} caps spacing="0.1em">The math</T>
          {[['Old tool','$299/mo'],['Ours','$97/mo'],['You save','$202/mo']].map(([label, val], i) => (
            <Row key={i}>
              <T s={9} color={i === 2 ? accent : 'rgba(255,255,255,0.6)'}>{label}</T>
              <div style={{ flex: 1 }} />
              <T s={9} color={i === 2 ? accent : '#fff'} weight={i === 2 ? 800 : 600}>{val}</T>
            </Row>
          ))}
          <Bar w="100%" color={accent} h={1} op={0.2} />
          <T s={8} color="rgba(255,255,255,0.45)" align="center">Same results. Lower cost. No brainer.</T>
        </div>
      );
      // slide 2 — Value Receipt (savings math version)
      return (
        <div style={{ ...zp('flex-start'), gap: 6 }}>
          <T s={7} color="rgba(255,255,255,0.45)" caps spacing="0.12em">The math doesn't lie</T>
          <div style={{ width: '100%', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, overflow: 'hidden' }}>
            {[['Competitor A','$299/mo'],['Competitor B','$199/mo'],['Industry avg','$247/mo']].map(([name,val],i) => (
              <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 10px', borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.07)' : 'none', background: i % 2 === 0 ? 'rgba(255,255,255,0.04)' : 'transparent' }}>
                <T s={7.5} color="rgba(255,255,255,0.5)" weight={400}><s>{name}</s></T>
                <T s={7} color="rgba(255,255,255,0.3)"><s>{val}</s></T>
              </div>
            ))}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'7px 10px', background:'rgba(16,185,129,0.12)', borderTop:'1px solid rgba(16,185,129,0.3)' }}>
              <T s={8} color={accent} weight={800}>You pay</T>
              <T s={16} color={accent} weight={900}>$97/mo</T>
            </div>
          </div>
          <T s={6.5} color="rgba(255,255,255,0.35)" align="center">Save $202 every month. No compromise.</T>
          <Btn label="Switch Now →" bg={accent} />
        </div>
      );
    }

    // ── case-study ───────────────────────────────────────────────────────────────
    if (id === 'case-study') {
      if (slide === 0) return (
        <div style={{ ...z, justifyContent: 'center', gap: 8, padding: 18 }}>
          <Row gap={8}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: accent, flexShrink: 0 }} />
            <Col gap={2}>
              <T s={9} color={txt} weight={700}>Acme Corp</T>
              <T s={7} color={muted}>SaaS startup · 12 employees</T>
            </Col>
          </Row>
          <Bar w="100%" color={muted} h={1} op={0.2} />
          <T s={8} color={muted} caps spacing="0.08em">The problem</T>
          <T s={14} color={txt} weight={800} spacing="-0.02em">Losing 40% of leads every month.</T>
          <T s={8} color={muted}>Sound familiar? Here's what changed in 60 days.</T>
        </div>
      );
      if (slide === 1) return (
        <div style={{ ...z, justifyContent: 'center', gap: 8, padding: 20 }}>
          <T s={8} color={accent} caps spacing="0.1em">The result</T>
          <Row gap={14}>
            {[['340%','More leads'],['60d','To results'],['$0','Extra cost']].map(([val, label]) => (
              <Col key={label} gap={2} align="center">
                <T s={18} color={accent} weight={900} spacing="-0.03em" align="center">{val}</T>
                <T s={7} color={muted} align="center">{label}</T>
              </Col>
            ))}
          </Row>
          <Bar w="100%" color={muted} h={1} op={0.15} />
          <T s={8} color={muted} align="center">"We never expected results this fast." — CEO, Acme</T>
        </div>
      );
      // slide 2 — Social Proof Stamp
      return (
        <div style={{ ...zc, gap: 7, padding: 18, background: accent }}>
          <div style={{ display:'flex' }}>
            {['#fff','rgba(255,255,255,0.8)','rgba(255,255,255,0.6)','rgba(255,255,255,0.4)','rgba(255,255,255,0.25)'].map((c,i) => (
              <div key={i} style={{ width:22, height:22, borderRadius:'50%', background:c, border:'2px solid rgba(255,255,255,0.3)', marginLeft: i > 0 ? -7 : 0, zIndex: 5-i }} />
            ))}
          </div>
          <T s={22} color="#fff" weight={900} align="center" spacing="-0.04em">340%</T>
          <T s={7.5} color="rgba(255,255,255,0.7)" align="center">avg revenue growth in 60 days</T>
          <T s={7} color="rgba(255,255,255,0.5)" align="center">Verified · 5,000+ companies</T>
        </div>
      );
    }

    // ── insight-frame ─────────────────────────────────────────────────────────────
    if (id === 'insight-frame') {
      if (slide === 0) return (
        <div style={{ ...z, justifyContent: 'center', padding: '16px 14px 16px 18px', gap: 7 }}>
          {/* Bold left-accent insight card — HBR / Merriam style */}
          <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 4, background: accent }} />
          <div style={{ background: `${accent}12`, border: `1px solid ${accent}33`, borderRadius: 4, padding: '3px 10px', alignSelf: 'flex-start' }}>
            <T s={6} color={accent} caps spacing="0.12em" weight={700}>Key Insight</T>
          </div>
          <div style={{ fontSize: 18, fontWeight: 900, color: txt, letterSpacing: '-0.025em', lineHeight: 1.1 }}>The reason you're not seeing results isn't what you think.</div>
          <T s={7.5} color={muted}>It's not effort. It's not talent. It's this one hidden bottleneck.</T>
          <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
            <T s={6} color={accent} weight={600}>Framework inside →</T>
            <T s={6} color={muted}>3 steps · 2 min read</T>
          </div>
        </div>
      );
      if (slide === 1) return (
        <div style={{ ...z, justifyContent: 'center', padding: '16px 14px 16px 18px', gap: 9 }}>
          <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 4, background: accent }} />
          <T s={7} color={accent} caps spacing="0.1em" weight={700}>The 3-step framework</T>
          {[['01','Find the bottleneck','Not symptoms — the actual root cause slowing everything'],['02','Pull the one lever','The single action that unblocks compound growth'],['03','Measure outcomes','Output is a vanity metric. Results are everything']].map(([n,t,d]) => (
            <div key={n} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <div style={{ lineHeight: 1, minWidth: 22 }}><T s={12} color={accent} weight={900}>{n}</T></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <T s={8} color={txt} weight={800}>{t}</T>
                <T s={6.5} color={muted}>{d}</T>
              </div>
            </div>
          ))}
        </div>
      );
      // slide 2 — Save This
      return (
        <div style={{ ...z, alignItems: 'flex-start', justifyContent: 'center', gap: 7, padding: '18px 16px', background: '#fff' }}>
          <T s={7} color="#94a3b8" caps spacing="0.12em">📌 Save this framework</T>
          <div style={{ background:`${accent}0f`, border:`1px solid ${accent}2a`, borderRadius: 8, padding:'10px 12px', width:'100%' }}>
            <T s={8.5} color="#0f172a" weight={700} align="left">The bottleneck isn't your effort. It's the one decision you keep avoiding.</T>
          </div>
          <T s={7} color="#64748b">Share this with someone who needs to hear it.</T>
          <T s={7.5} color={accent} weight={700}>Full guide at: yourbrand.com →</T>
        </div>
      );
    }

    // ── pain-diagnostic ───────────────────────────────────────────────────────────
    if (id === 'pain-diagnostic') {
      const painTxt = '#f1f5f9';
      const painMuted = 'rgba(241,245,249,0.5)';
      if (slide === 0) return (
        <div style={{ ...z, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 18 }}>
          <div style={{ background: 'rgba(244,63,94,0.15)', border: '1px solid rgba(244,63,94,0.4)', borderRadius: 20, padding: '5px 16px' }}>
            <T s={8} color="#f43f5e" caps spacing="0.1em">Diagnose</T>
          </div>
          <T s={20} color={painTxt} weight={900} align="center" spacing="-0.03em">Does this sound familiar?</T>
          <T s={9} color={painMuted} align="center">If you answered yes to any of these — keep reading.</T>
        </div>
      );
      if (slide === 1) return (
        <div style={{ ...z, justifyContent: 'center', gap: 8, padding: 18 }}>
          <T s={8} color="#f43f5e" caps spacing="0.1em">The real problem</T>
          {['You\'re working harder than ever but results plateau','The tool you\'re using adds work, not removes it','You\'ve tried everything and nothing has stuck'].map((pain, i) => (
            <Row key={i} gap={8}>
              <div style={{ width: 16, height: 16, borderRadius: '50%', background: 'rgba(244,63,94,0.2)', border: '1px solid rgba(244,63,94,0.5)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: '#f43f5e' }}>✕</div>
              <T s={8} color={painMuted}>{pain}</T>
            </Row>
          ))}
        </div>
      );
      // slide 2 — Permission Slip
      return (
        <div style={{ ...z, alignItems: 'center', justifyContent: 'center', padding: 18, background: '#0f0a1a' }}>
          <div style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:'16px 14px', width:'90%', display:'flex', flexDirection:'column', gap:8 }}>
            <T s={7} color={accent} weight={700} caps spacing="0.1em" align="center">A note for you</T>
            <T s={9} color="#f1f5f9" weight={600} align="center" spacing="-0.01em">You're not stuck because you're lazy. You're stuck because the approach was wrong. That ends now.</T>
            <div style={{ height:1, background:'rgba(255,255,255,0.08)', width:'100%' }} />
            <T s={7} color="rgba(241,245,249,0.35)" align="center">The fix is simpler than you think.</T>
          </div>
        </div>
      );
    }

    // ── mistake-alert ─────────────────────────────────────────────────────────────
    if (id === 'mistake-alert') {
      const maTxt = '#fff1ee';
      const maMuted = 'rgba(255,241,238,0.55)';
      if (slide === 0) return (
        <div style={{ ...z, justifyContent: 'flex-start', gap: 6, padding: 18 }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: '#f97316' }} />
          <div style={{ marginTop: 10, background: '#f97316', borderRadius: 4, padding: '3px 10px', display: 'inline-flex', alignSelf: 'flex-start' }}>
            <T s={7} color="#fff" caps spacing="0.08em" weight={900}>⚠ Warning</T>
          </div>
          <T s={18} color={maTxt} weight={900} spacing="-0.03em">3 costly mistakes killing your results.</T>
          <T s={8} color={maMuted}>Most people make all 3 without realising it.</T>
        </div>
      );
      if (slide === 1) return (
        <div style={{ ...z, justifyContent: 'center', gap: 9, padding: 18 }}>
          {[['Mistake #1','Chasing vanity metrics'],['Mistake #2','Skipping the hook'],['Mistake #3','No clear CTA']].map(([badge, text], i) => (
            <Row key={i} gap={8}>
              <div style={{ background: 'rgba(249,115,22,0.2)', border: '1px solid #f97316', borderRadius: 4, padding: '2px 7px', flexShrink: 0 }}>
                <T s={7} color="#f97316" weight={700}>{badge}</T>
              </div>
              <T s={8} color={maTxt}>{text}</T>
            </Row>
          ))}
        </div>
      );
      // slide 2 — Permission Slip
      return (
        <div style={{ ...z, alignItems: 'center', justifyContent: 'center', padding: 18 }}>
          <div style={{ background:'rgba(249,115,22,0.08)', border:'1px solid rgba(249,115,22,0.2)', borderRadius:12, padding:'16px 14px', width:'90%', display:'flex', flexDirection:'column', gap:8 }}>
            <T s={7} color="#f97316" weight={700} caps spacing="0.1em" align="center">A reminder</T>
            <T s={9} color={maTxt} weight={600} align="center" spacing="-0.01em">Knowing the mistake isn't enough. What matters is what you do about it starting today.</T>
            <div style={{ height:1, background:'rgba(249,115,22,0.15)', width:'100%' }} />
            <T s={7} color={maMuted} align="center">You already know which one to fix first.</T>
          </div>
        </div>
      );
    }

    // ── empathy-card ─────────────────────────────────────────────────────────────
    if (id === 'empathy-card') {
      const emTxt = '#3b0764';
      const emMuted = '#7c3aed';
      if (slide === 0) return (
        <div style={{ ...z, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 18 }}>
          <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'linear-gradient(135deg,#ec4899,#a78bfa)' }} />
          <T s={18} color={emTxt} weight={900} align="center" spacing="-0.03em">You deserve to feel this.</T>
          <T s={9} color={emMuted} align="center">Not eventually. Right now.</T>
          <Btn label="Tell Me More →" bg={accent} color="#fff" />
        </div>
      );
      if (slide === 1) return (
        <div style={{ ...z, justifyContent: 'center', gap: 8, padding: 18 }}>
          <T s={8} color={emMuted} caps spacing="0.1em">You're not alone</T>
          <T s={14} color={emTxt} weight={800} spacing="-0.02em">"I was tired of feeling like I was the only one struggling."</T>
          <Bar w="40%" color={accent} h={2} op={0.5} />
          <T s={9} color={emMuted}>— Sarah, 34 · Joined 8 months ago</T>
          <Stars color={accent} />
        </div>
      );
      // slide 2 — Permission Slip
      return (
        <div style={{ ...z, alignItems: 'center', justifyContent: 'center', padding: 18, background: '#fdf2f8' }}>
          <div style={{ background:'#fff', borderRadius:12, padding:'16px 14px', width:'90%', boxShadow:'0 4px 20px rgba(124,58,237,0.1)', display:'flex', flexDirection:'column', gap:8 }}>
            <T s={7} color="#7c3aed" weight={700} caps spacing="0.1em" align="center">You're allowed to</T>
            <T s={9} color={emTxt} weight={700} align="center" spacing="-0.01em">want more for yourself. That's not selfish — it's called growth.</T>
            <div style={{ height:1, background:'#ede9fe', width:'100%' }} />
            <T s={7} color={emMuted} align="center">Take the first step when you're ready. Not before.</T>
          </div>
        </div>
      );
    }

    // ── validation-card ───────────────────────────────────────────────────────────
    if (id === 'validation-card') {
      const valTxt = '#2e1065';
      const valMuted = '#6d28d9';
      if (slide === 0) return (
        <div style={{ ...z, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 18 }}>
          <div style={{ display: 'flex', gap: 0 }}>
            {['#a78bfa','#818cf8','#6366f1','#4f46e5'].map((c,i) => (
              <div key={i} style={{ width: 26, height: 26, borderRadius: '50%', background: c, border: '2px solid #f5f3ff', marginLeft: i > 0 ? -8 : 0 }} />
            ))}
          </div>
          <T s={14} color={valTxt} weight={900} align="center" spacing="-0.02em">14,000+ people feel exactly the same way.</T>
          <T s={8} color={valMuted} align="center">You're not broken. The system is.</T>
          <Btn label="Join the Community →" bg={accent} color="#fff" />
        </div>
      );
      if (slide === 1) return (
        <div style={{ ...z, justifyContent: 'center', gap: 8, padding: 18 }}>
          <T s={8} color={valMuted} caps spacing="0.1em">What they're saying</T>
          {['"Finally, someone gets it."','"I thought it was just me."','"This changed how I see it."'].map((q,i) => (
            <div key={i} style={{ background: 'rgba(167,139,250,0.1)', borderRadius: 8, padding: '7px 10px', border: '1px solid rgba(167,139,250,0.2)' }}>
              <T s={8} color={valTxt}>{q}</T>
            </div>
          ))}
        </div>
      );
      // slide 2 — Permission Slip
      return (
        <div style={{ ...z, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 18, background: '#ede9fe' }}>
          <div style={{ background:'#fff', borderRadius:12, padding:'16px 14px', width:'90%', boxShadow:'0 4px 20px rgba(109,40,217,0.12)', display:'flex', flexDirection:'column', gap:8 }}>
            <T s={7} color="#7c3aed" weight={700} caps spacing="0.1em" align="center">A note for you</T>
            <T s={9} color="#2e1065" weight={600} align="center" spacing="-0.01em">You're allowed to need support. That's not weakness — that's how we grow.</T>
            <div style={{ height:1, background:'#ede9fe', width:'100%' }} />
            <T s={7} color="#7c3aed" align="center">14,000+ people agree. You're not alone.</T>
          </div>
        </div>
      );
    }

    // ── do-dont ───────────────────────────────────────────────────────────────────
    if (id === 'do-dont') {
      if (slide === 0) return (
        <div style={{ ...z, flexDirection: 'row', padding: 0 }}>
          <div style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 8, padding: 14, background: '#fff5f5' }}>
            <T s={9} color="#ef4444" weight={800} caps spacing="0.06em">✕ Don't</T>
            {['Guess at strategy','Copy what worked for others','Ignore your data'].map((t,i) => (
              <Row key={i} gap={5}><Cross /><T s={7.5} color="#64748b">{t}</T></Row>
            ))}
          </div>
          <div style={{ width: 1, background: '#e2e8f0', flexShrink: 0 }} />
          <div style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 8, padding: 14, background: '#f0fdf4' }}>
            <T s={9} color="#16a34a" weight={800} caps spacing="0.06em">✓ Do</T>
            {['Follow a proven system','Test and iterate fast','Let data lead'].map((t,i) => (
              <Row key={i} gap={5}><Check color="#16a34a" /><T s={7.5} color="#374151">{t}</T></Row>
            ))}
          </div>
        </div>
      );
      if (slide === 1) return (
        <div style={{ ...z, justifyContent: 'center', gap: 8, padding: 18 }}>
          <T s={8} color={accent} caps spacing="0.1em">The difference</T>
          <T s={15} color={txt} weight={900} spacing="-0.02em">One approach wastes time. The other compounds it.</T>
          <Bar w="100%" color={muted} h={1} op={0.2} />
          {[['Without system','Inconsistent results','High burnout'],['With system','Predictable growth','Less effort']].map(([label,...items], i) => (
            <Col key={i} gap={4}>
              <T s={8} color={i === 0 ? '#ef4444' : '#16a34a'} weight={700}>{label}</T>
              {items.map(item => <T key={item} s={7.5} color={muted}>{item}</T>)}
            </Col>
          ))}
        </div>
      );
      // slide 2 — Save This
      return (
        <div style={{ ...z, alignItems: 'flex-start', justifyContent: 'center', gap: 7, padding: 18 }}>
          <T s={7} color="#94a3b8" caps spacing="0.12em">📌 Save this rule</T>
          <div style={{ background:`${accent}0f`, border:`1px solid ${accent}2a`, borderRadius: 8, padding:'10px 12px', width:'100%' }}>
            <T s={8.5} color="#0f172a" weight={700} align="left">Every hour spent doing the wrong thing is an hour of not doing the right one.</T>
          </div>
          <T s={7} color="#64748b">Bookmark this. Share it with your team.</T>
          <T s={7.5} color="#16a34a" weight={700}>yourbrand.com →</T>
        </div>
      );
    }

    // ── transform-split ───────────────────────────────────────────────────────────
    if (id === 'transform-split') {
      if (slide === 0) return (
        <div style={{ ...z, flexDirection: 'column', padding: 0, position: 'relative' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 4, padding: 14, background: 'linear-gradient(135deg,#1e293b,#334155)' }}>
            <T s={7} color="rgba(255,255,255,0.4)" caps spacing="0.12em">Before</T>
            <T s={12} color="rgba(255,255,255,0.6)" weight={700} align="center">Struggling every day. No clear path forward.</T>
          </div>
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 28, height: 28, borderRadius: '50%', background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2, boxShadow: `0 2px 12px ${accent}66`, fontSize: 12, color: '#fff' }}>↓</div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 4, padding: 14, background: 'linear-gradient(135deg,#042f2e,#0f766e)' }}>
            <T s={7} color={accent} caps spacing="0.12em">After</T>
            <T s={12} color="#fff" weight={700} align="center">Consistent results. Clear momentum. Real growth.</T>
          </div>
        </div>
      );
      if (slide === 1) return (
        <div style={{ ...z, justifyContent: 'center', gap: 8, padding: 20, background: 'linear-gradient(135deg,#042f2e,#0f766e)' }}>
          <T s={8} color={accent} caps spacing="0.1em">The transformation</T>
          {[['Week 1','Setup and first wins'],['Month 1','System running, 3x output'],['Month 3','Compounding results']].map(([time, result], i) => (
            <Row key={i} gap={10}>
              <T s={8} color={accent} weight={700}>{time}</T>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
              <T s={8} color="rgba(255,255,255,0.7)">{result}</T>
            </Row>
          ))}
        </div>
      );
      // slide 2 — Chapter Epilogue
      return (
        <div style={{ ...z, alignItems: 'flex-start', justifyContent: 'flex-end', gap: 8, padding: '18px 18px 22px', background:`linear-gradient(135deg,#042f2e,#0f766e)` }}>
          <div style={{ height:1, background:`${accent}55`, width:'100%' }} />
          <T s={8.5} color="#fff" weight={300} align="left" spacing="0.01em">That's the transformation. Real, measurable, repeatable.</T>
          <T s={7.5} color="rgba(255,255,255,0.5)" align="left">The only difference between "before" and "after" is the decision to start.</T>
          <T s={7.5} color={accent} weight={600}>@brand · link in bio →</T>
        </div>
      );
    }

    // ── Batch 5: 44 new templates ─────────────────────────────────────────────

    // guarantee-badge
    if (id === 'guarantee-badge') {
      if (slide === 0) return (
        <div style={{ ...zc, gap: 6 }}>
          <T s={6} color={accent} weight={700} caps spacing="0.14em">Guaranteed</T>
          <div style={{ width: 60, height: 60, borderRadius: '50%', border: `3px solid ${accent}`, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column' }}>
            <T s={14} color="#fff" weight={900}>30</T>
            <T s={5} color="rgba(255,255,255,0.6)" caps spacing="0.1em">Days</T>
          </div>
          <T s={9} color="#fff" weight={900} caps spacing="0.05em">Money Back</T>
        </div>
      );
      if (slide === 1) return (
        <div style={{ ...zp(), gap: 8 }}>
          {['Full refund anytime','No questions asked','Keep the bonuses'].map((t,i) => (
            <Row key={i} gap={7}><div style={{ width:14, height:14, color: accent, fontSize:12 }}>▣</div><T s={8} color="#f1f5f9">{t}</T></Row>
          ))}
        </div>
      );
      // slide 2 — Value Receipt (guarantee receipt)
      return (
        <div style={{ ...zp('flex-start'), gap: 6 }}>
          <T s={7} color="rgba(255,255,255,0.45)" caps spacing="0.12em">Your guarantee covers</T>
          <div style={{ width: '100%', border: `1px solid ${accent}33`, borderRadius: 8, overflow: 'hidden' }}>
            {[['Full refund','Within 30 days'],['Keep everything','No questions asked'],['Cancel easily','One click']].map(([name,val],i) => (
              <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 10px', borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.07)' : 'none', background: i % 2 === 0 ? 'rgba(255,255,255,0.04)' : 'transparent' }}>
                <T s={7.5} color="rgba(255,255,255,0.7)" weight={500}>{name}</T>
                <T s={7} color={accent} weight={600}>{val}</T>
              </div>
            ))}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'7px 10px', background:`${accent}18`, borderTop:`1px solid ${accent}44` }}>
              <T s={7.5} color="rgba(255,255,255,0.8)" weight={700}>Your risk</T>
              <T s={15} color={accent} weight={900}>$0</T>
            </div>
          </div>
          <Btn label="Start Risk-Free →" bg={accent} />
        </div>
      );
    }

    // award-winner
    if (id === 'award-winner') {
      if (slide === 0) return (
        <div style={{ ...zc, gap: 7 }}>
          <div style={{ width:42, height:42, borderRadius:'50%', background:'#fbbf24', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 14px rgba(251,191,36,0.5)' }}>
            <div style={{ fontSize:22, color:'#fff' }}>★</div>
          </div>
          <T s={14} color="#fff" weight={900}>VOTED #1</T>
          <T s={7} color="rgba(255,255,255,0.5)" caps spacing="0.1em">Best in Category 2026</T>
        </div>
      );
      if (slide === 1) return (
        <div style={{ ...zp(), gap: 7 }}>
          {[['4.9★','Average rating'],['10k+','Reviews'],['5 yrs','Award winner']].map(([n,l],i) => (
            <Row key={i} gap={9}>
              <T s={14} color={accent} weight={900}>{n}</T>
              <T s={7} color="rgba(255,255,255,0.55)">{l}</T>
            </Row>
          ))}
        </div>
      );
      // slide 2 — Social Proof Stamp
      return (
        <div style={{ ...zc, gap: 6 }}>
          <div style={{ display:'flex' }}>
            {['#fbbf24','#f59e0b','#fcd34d','#fbbf24','#f59e0b'].map((c,i) => (
              <div key={i} style={{ width:22, height:22, borderRadius:'50%', background:c, border:'2px solid rgba(0,0,0,0.3)', marginLeft: i > 0 ? -7 : 0, zIndex: 5-i }} />
            ))}
          </div>
          <T s={22} color="#fff" weight={900} align="center" spacing="-0.04em">4.9 ★</T>
          <T s={7.5} color="rgba(255,255,255,0.55)" align="center">from 10,000+ verified buyers</T>
          <div style={{ background:'#fbbf24', borderRadius:6, padding:'3px 10px' }}>
            <T s={7} color="#000" weight={800} caps spacing="0.06em">Best in Category 2026</T>
          </div>
        </div>
      );
    }

    // limited-drop
    if (id === 'limited-drop') {
      if (slide === 0) return (
        <div style={{ ...zc, gap: 4 }}>
          <T s={8} color="rgba(255,255,255,0.6)" caps spacing="0.14em">Only</T>
          <div style={{ fontSize: 38, color: accent, fontWeight: 900, lineHeight: 1 }}>47</div>
          <T s={8} color="#fff" weight={800} caps spacing="0.08em">Left in stock</T>
        </div>
      );
      if (slide === 1) return (
        <div style={{ ...zp(), gap: 7 }}>
          {['Ships today','Limited run','No restock ever'].map((t,i) => (
            <Row key={i} gap={7}><Dot color={accent} /><T s={8} color="#f1f5f9" weight={600}>{t}</T></Row>
          ))}
        </div>
      );
      // slide 2 — Value Receipt (scarcity version)
      return (
        <div style={{ ...zp('flex-start'), gap: 6 }}>
          <T s={7} color="rgba(255,255,255,0.45)" caps spacing="0.12em">47 units left — what you get</T>
          <div style={{ width: '100%', border: `1px solid ${accent}33`, borderRadius: 8, overflow: 'hidden' }}>
            {[['The product','$197 value'],['Exclusive packaging','$29 value'],['Priority shipping','Free']].map(([name,val],i) => (
              <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 10px', borderBottom: i < 2 ? `1px solid rgba(255,255,255,0.07)` : 'none', background: i % 2 === 0 ? 'rgba(255,255,255,0.04)' : 'transparent' }}>
                <T s={7.5} color="rgba(255,255,255,0.7)" weight={500}>{name}</T>
                <T s={7} color="rgba(255,255,255,0.35)">{val}</T>
              </div>
            ))}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'7px 10px', background:`${accent}18`, borderTop:`1px solid ${accent}44` }}>
              <T s={7.5} color="rgba(255,255,255,0.8)" weight={700}>Drop price</T>
              <T s={15} color={accent} weight={900}>$97</T>
            </div>
          </div>
          <Btn label="Claim Yours →" bg={accent} />
        </div>
      );
    }

    // hot-take
    if (id === 'hot-take') {
      if (slide === 0) return (
        <div style={{ ...zc, gap: 6 }}>
          {/* MTV-style bold debate card */}
          <div style={{ background:'rgba(255,255,255,0.12)', border:'1px solid rgba(255,255,255,0.25)', borderRadius:20, padding:'3px 12px', marginBottom:2 }}>
            <T s={6} color="#fff" weight={800} caps spacing="0.12em">🔥 Hot Take</T>
          </div>
          <div style={{ textAlign:'center', padding:'0 10px' }}>
            <div style={{ fontSize:18, fontWeight:900, color:'#fff', letterSpacing:'-0.03em', lineHeight:1.1 }}>Most "experts" are just confidently wrong.</div>
          </div>
          <div style={{ height:2, background:'rgba(255,255,255,0.3)', width:50, marginTop:4 }} />
          <T s={7} color="rgba(255,255,255,0.6)" align="center">Swipe to see why →</T>
        </div>
      );
      if (slide === 1) return (
        <div style={{ ...z, flexDirection:'row' }}>
          {/* Two-panel debate: Crowd vs Smart */}
          <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:5, padding:'0 10px', borderRight:'1px solid rgba(255,255,255,0.12)' }}>
            <T s={6} color="rgba(255,255,255,0.5)" caps spacing="0.1em">Most people</T>
            <div style={{ fontSize:22 }}>😵</div>
            <T s={7} color="rgba(255,255,255,0.8)" weight={700} align="center">Follow trends blindly</T>
          </div>
          <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:5, padding:'0 10px' }}>
            <T s={6} color={accent} caps spacing="0.1em" weight={700}>Smart ones</T>
            <div style={{ fontSize:22 }}>🎯</div>
            <T s={7} color="#fff" weight={800} align="center">Question everything first</T>
          </div>
        </div>
      );
      // slide 2 — Tag Someone
      return (
        <div style={{ ...zc, gap: 8, padding: '0 16px' }}>
          <div style={{ fontSize: 32 }}>👇</div>
          <T s={15} color="#fff" weight={900} align="center" spacing="-0.03em">Tag someone who needs to hear this.</T>
          <T s={7.5} color="rgba(255,255,255,0.45)" align="center">They'll thank you later. Or argue with you. Both are wins.</T>
        </div>
      );
    }

    // mono-editorial
    if (id === 'mono-editorial') {
      if (slide === 0) return (
        <div style={{ ...zp('flex-start','center'), gap: 6 }}>
          <div style={{ width: 30, height: 2, background:'#000' }} />
          <T s={16} color="#000" weight={900} spacing="-0.03em">The only brand that tells you the truth.</T>
        </div>
      );
      if (slide === 1) return (
        <div style={{ ...zp(), gap: 6 }}>
          <div style={{ borderLeft:'2px solid #000', paddingLeft:10 }}>
            <T s={11} color="#000" weight={700} spacing="-0.01em">"They told us no, but we built it anyway."</T>
            <T s={7} color="#666" spacing="0.04em">— Founders' note</T>
          </div>
        </div>
      );
      // slide 2 — Brand Statement
      return (
        <div style={{ ...zc, gap: 8, padding: '16px' }}>
          <div style={{ height: 2, background: '#000', width: 32 }} />
          <T s={9} color="#000" weight={300} align="center" spacing="0.06em" caps>Built for people who</T>
          <T s={14} color="#000" weight={900} align="center" spacing="-0.02em">refuse to be ordinary.</T>
          <T s={7} color="#666" align="center" weight={400}>Not for everyone.</T>
          <T s={7.5} color="#000" align="center" spacing="0.04em">yourbrand.com</T>
        </div>
      );
    }

    // caption-style
    if (id === 'caption-style') {
      if (slide === 0) return (
        <div style={{ ...z }}>
          {/* Authentic UGC / behind-the-scenes: full-frame photo area with caption overlay */}
          {!photoMeta?.url && <div style={{ position:'absolute', top:0, left:0, right:0, bottom:0, background:'linear-gradient(165deg,#1f2937 0%,#374151 55%,#111827 100%)' }} />}
          {/* Story progress bars */}
          <div style={{ position:'absolute', top:8, left:10, right:10, display:'flex', gap:3 }}>
            {[0,1,2].map(i => <div key={i} style={{ flex:1, height:2, background:i===0?'rgba(255,255,255,0.9)':'rgba(255,255,255,0.3)', borderRadius:1 }} />)}
          </div>
          {/* Creator header */}
          <div style={{ position:'absolute', top:16, left:10, display:'flex', alignItems:'center', gap:6 }}>
            <div style={{ width:22, height:22, borderRadius:'50%', background:`linear-gradient(135deg,${accent},#f472b6)`, border:'1.5px solid #fff' }} />
            <div>
              <T s={7} color="#fff" weight={700}>@brand</T>
            </div>
          </div>
          {/* Caption overlay */}
          <div style={{ position:'absolute', bottom:0, left:0, right:0, background:'linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)', padding:'18px 12px 12px' }}>
            <T s={9} color="#fff" weight={700} spacing="-0.01em">I tried X for 30 days straight. Here's what happened 👇</T>
          </div>
        </div>
      );
      if (slide === 1) return (
        <div style={{ ...zp(), gap: 7 }}>
          {/* Day-by-day reveal — authentic UGC journal */}
          <T s={7} color={accent} weight={700} caps spacing="0.1em">The honest diary</T>
          {[['Day 1','Skeptical. Did it anyway.','rgba(255,255,255,0.45)'],['Day 7','Started noticing a difference.','rgba(255,255,255,0.6)'],['Day 30','I\'m a convert. Life changed.','#fff']].map(([day,note,col],i) => (
            <div key={i} style={{ display:'flex', gap:8, alignItems:'flex-start', borderBottom:i<2?'1px solid rgba(255,255,255,0.07)':'none', paddingBottom:i<2?7:0 }}>
              <div style={{ background:`${accent}22`, border:`1px solid ${accent}55`, borderRadius:4, padding:'2px 6px', flexShrink:0 }}>
                <T s={6} color={accent} weight={700}>{day}</T>
              </div>
              <T s={8} color={col as string} weight={i===2?700:400}>{note}</T>
            </div>
          ))}
        </div>
      );
      // slide 2 — Chapter Epilogue
      return (
        <div style={{ ...zp('flex-start','flex-end'), padding:'0 12px 20px', gap: 8 }}>
          <div style={{ height: 1, background: 'rgba(255,255,255,0.2)', width: '100%' }} />
          <T s={8.5} color="#fff" weight={300} align="left" spacing="0.01em">That's day 30. And that's how it changed everything.</T>
          <T s={7.5} color="rgba(255,255,255,0.5)" align="left">The rest of the story is yours to write.</T>
          <T s={7.5} color={accent} weight={600}>@brand · link in bio →</T>
        </div>
      );
    }

    // tiktok-native
    if (id === 'tiktok-native') {
      if (slide === 0) return (
        <div style={{ ...z, padding:10 }}>
          <div style={{ position:'absolute', top:6, left:8, right:8, display:'flex', gap:3 }}>
            {[0,1,2].map(i => <div key={i} style={{ flex:1, height:2, background:i===0?'#fff':'rgba(255,255,255,0.3)', borderRadius:1 }} />)}
          </div>
          <div style={{ position:'absolute', bottom:14, left:10, right:36 }}>
            <T s={9} color="#fff" weight={800}>@brand</T>
            <T s={7} color="rgba(255,255,255,0.8)">Discover what actually works ✨</T>
          </div>
          <div style={{ position:'absolute', right:8, bottom:14, display:'flex', flexDirection:'column', gap:8, alignItems:'center' }}>
            <Col gap={1} align="center"><div style={{ fontSize:14 }}>♥</div><T s={6} color="#fff">12k</T></Col>
            <Col gap={1} align="center"><div style={{ fontSize:14, color:'#fff' }}>💬</div><T s={6} color="#fff">847</T></Col>
          </div>
        </div>
      );
      if (slide === 1) return (
        <div style={{ ...zc, gap: 6 }}>
          <T s={9} color={accent} weight={700} caps spacing="0.1em">POV:</T>
          <T s={13} color="#fff" weight={900} align="center" spacing="-0.02em">You just discovered the best X.</T>
        </div>
      );
      // slide 2 — Chapter Epilogue
      return (
        <div style={{ ...z, alignItems: 'flex-start', justifyContent: 'flex-end', padding: '0 12px 20px' }}>
          <div style={{ position:'absolute', top:6, left:8, right:8, display:'flex', gap:3 }}>
            {[0,1,2].map(i => <div key={i} style={{ flex:1, height:2, background: '#fff', borderRadius:1, opacity: i < 3 ? 1 : 0.4 }} />)}
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:7, width:'100%' }}>
            <div style={{ height:1, background:'rgba(255,255,255,0.2)', width:'100%' }} />
            <T s={8.5} color="#fff" weight={300} align="left">And that's where the POV ends. The rest is yours to discover.</T>
            <T s={7.5} color="rgba(255,255,255,0.5)" align="left">Follow for more unfiltered content.</T>
            <T s={7.5} color={accent} weight={600}>@brand · link in bio →</T>
          </div>
        </div>
      );
    }

    // brutalist
    if (id === 'brutalist') {
      if (slide === 0) return (
        <div style={{ ...z, padding: 8 }}>
          <div style={{ position:'absolute', inset:6, border:'2px solid #000' }} />
          <div style={{ position:'absolute', top:'50%', left:14, right:14, transform:'translateY(-50%)' }}>
            <T s={20} color="#000" weight={900} spacing="-0.04em">YOUR AD HERE</T>
            <div style={{ height:3, background:'#000', width:60, marginTop:6 }} />
          </div>
        </div>
      );
      if (slide === 1) return (
        <div style={{ ...zp(), gap: 8 }}>
          <div style={{ position:'absolute', inset:6, border:'2px solid #000', pointerEvents:'none' }} />
          {['01. NO BS','02. NO FLUFF','03. JUST WORKS'].map((t,i) => (
            <T key={i} s={11} color="#000" weight={900} spacing="-0.02em">{t}</T>
          ))}
        </div>
      );
      // slide 2 — Brand Statement (brutalist version)
      return (
        <div style={{ ...z, padding:8, alignItems:'center', justifyContent:'center' }}>
          <div style={{ position:'absolute', inset:6, border:'2px solid #000' }} />
          <div style={{ position:'relative', zIndex:2, display:'flex', flexDirection:'column', alignItems:'center', gap:6, padding:'0 16px' }}>
            <div style={{ height:3, background:'#000', width:36 }} />
            <T s={9} color="#000" weight={400} align="center" spacing="0.08em" caps>Made for those who</T>
            <T s={14} color="#000" weight={900} align="center" spacing="-0.04em">DON'T FOLLOW RULES.</T>
            <T s={7} color="#555" align="center">Not for everyone.</T>
          </div>
        </div>
      );
    }

    // free-trial
    if (id === 'free-trial') {
      if (slide === 0) return (
        <div style={{ ...zc, gap: 6 }}>
          <T s={20} color={accent} weight={900} spacing="-0.03em">START FREE</T>
          <T s={8} color="#64748b">No credit card required</T>
          <Row gap={8}>{['✓ Free','✓ Easy','✓ Fast'].map((t,i) => <T key={i} s={7} color="#16a34a" weight={700}>{t}</T>)}</Row>
        </div>
      );
      if (slide === 1) return (
        <div style={{ ...zp(), gap: 9 }}>
          {['Full access','Cancel anytime','24/7 support'].map((t,i) => (
            <Row key={i} gap={7}><Check color={accent} /><T s={8} color="#1e293b" weight={600}>{t}</T></Row>
          ))}
        </div>
      );
      // slide 2 — Value Receipt
      return (
        <div style={{ ...zp(), gap: 5 }}>
          <T s={7} color="#94a3b8" caps spacing="0.12em">Your 14-day trial includes</T>
          <div style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
            {[['Everything in Pro','$49/mo'],['Dedicated support','$19/mo'],['Templates library','$29/mo']].map(([name,val],i) => (
              <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 10px', borderBottom: i < 2 ? '1px solid #f1f5f9' : 'none', background: i % 2 === 0 ? '#fafafa' : '#fff' }}>
                <T s={7.5} color="#334155" weight={500}>{name}</T>
                <T s={7} color="#94a3b8">{val}</T>
              </div>
            ))}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'7px 10px', background:`${accent}0f`, borderTop:`1px solid ${accent}33` }}>
              <T s={8} color="#0f172a" weight={700}>Trial cost</T>
              <T s={15} color={accent} weight={900}>$0</T>
            </div>
          </div>
          <Btn label="Start Free →" bg={accent} />
          <T s={6} color="#94a3b8" align="center">No card required · Cancel anytime</T>
        </div>
      );
    }

    // price-compare
    if (id === 'price-compare') {
      if (slide === 0) return (
        <div style={{ ...zc, gap: 10 }}>
          <Row gap={14}>
            <Col align="center" gap={2}>
              <T s={7} color="#94a3b8" caps spacing="0.1em">Others</T>
              <div style={{ fontSize: 16, color:'#94a3b8', fontWeight: 800, textDecoration:'line-through' }}>$199</div>
            </Col>
            <Col align="center" gap={2}>
              <T s={7} color={accent} caps spacing="0.1em" weight={700}>Us</T>
              <div style={{ fontSize: 22, color: accent, fontWeight: 900 }}>$99</div>
            </Col>
          </Row>
          <T s={8} color="#16a34a" weight={700}>Save 50%</T>
        </div>
      );
      if (slide === 1) return (
        <div style={{ ...zp(), gap: 7 }}>
          <T s={8} color="#0f172a" weight={800}>What you get:</T>
          {['Lifetime updates','Premium support','All features'].map((t,i) => (
            <Row key={i} gap={6}><Check color={accent} /><T s={8} color="#334155">{t}</T></Row>
          ))}
        </div>
      );
      // slide 2 — Value Receipt
      return (
        <div style={{ ...zp(), gap: 5 }}>
          <T s={7} color="#94a3b8" caps spacing="0.12em">Price comparison</T>
          <div style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
            {[['Competitor A','$199/mo'],['Competitor B','$149/mo'],['Industry avg','$174/mo']].map(([name,val],i) => (
              <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 10px', borderBottom: i < 2 ? '1px solid #f1f5f9' : 'none', background: i % 2 === 0 ? '#fafafa' : '#fff' }}>
                <T s={7.5} color="#94a3b8" weight={400}><s>{name}</s></T>
                <T s={7} color="#cbd5e1"><s>{val}</s></T>
              </div>
            ))}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'7px 10px', background:`${accent}0f`, borderTop:`1px solid ${accent}33` }}>
              <T s={8} color="#0f172a" weight={700}>You pay</T>
              <T s={15} color={accent} weight={900}>$99/mo</T>
            </div>
          </div>
          <Btn label="Save 50% Now →" bg={accent} />
          <T s={6} color="#94a3b8" align="center">Offer ends midnight</T>
        </div>
      );
    }

    // review-card
    if (id === 'review-card') {
      if (slide === 0) return (
        <div style={{ ...zp('flex-start','center'), gap: 7 }}>
          <Stars color="#fbbf24" />
          <T s={11} color="#0f172a" weight={700} spacing="-0.01em">"Honestly the best thing I've bought all year."</T>
          <Row gap={6}>
            <div style={{ width:18, height:18, borderRadius:'50%', background:accent }} />
            <Col gap={1}><T s={7} color="#0f172a" weight={700}>Sarah M.</T><T s={6} color="#16a34a" weight={600}>✓ Verified</T></Col>
          </Row>
        </div>
      );
      if (slide === 1) return (
        <div style={{ ...zp(), gap: 6 }}>
          {[['5★','92%'],['4★','6%'],['3★','2%']].map(([s,p],i) => (
            <Row key={i} gap={6}>
              <T s={7} color="#0f172a" weight={700}>{s}</T>
              <div style={{ flex:1, height:5, background:'#f1f5f9', borderRadius:3, overflow:'hidden' }}>
                <div style={{ width: p, height:'100%', background: '#fbbf24' }} />
              </div>
              <T s={6} color="#94a3b8">{p}</T>
            </Row>
          ))}
        </div>
      );
      // slide 2 — Social Proof Stamp
      return (
        <div style={{ ...zc, gap: 7 }}>
          <div style={{ display:'flex' }}>
            {['#6366f1','#ec4899','#f59e0b','#22c55e','#0ea5e9'].map((c,i) => (
              <div key={i} style={{ width:22, height:22, borderRadius:'50%', background:c, border:'2px solid #fff', marginLeft: i > 0 ? -7 : 0, zIndex: 5-i }} />
            ))}
          </div>
          <T s={22} color="#0f172a" weight={900} align="center" spacing="-0.03em">10,247</T>
          <T s={7.5} color="#64748b" align="center">verified 5-star reviews this month</T>
          <Stars color="#fbbf24" />
          <Btn label="Read Reviews →" bg={accent} />
        </div>
      );
    }

    // trust-bar
    if (id === 'trust-bar') {
      if (slide === 0) return (
        <div style={{ ...zc, gap: 8 }}>
          <Row gap={8}>
            {[['10M+','Users'],['4.9★','Rating'],['Free','Forever']].map(([n,l],i) => (
              <Col key={i} align="center" gap={1}>
                <T s={11} color={accent} weight={900}>{n}</T>
                <T s={6} color="#64748b" caps spacing="0.06em">{l}</T>
              </Col>
            ))}
          </Row>
        </div>
      );
      if (slide === 1) return (
        <div style={{ ...zp(), gap: 8 }}>
          <T s={7} color="#94a3b8" caps spacing="0.12em">As Seen In</T>
          <Row gap={6}>
            {['FORBES','TC','WIRED','VOX'].map((b,i) => (
              <div key={i} style={{ background:'#f1f5f9', padding:'4px 7px', borderRadius:3 }}>
                <T s={6} color="#475569" weight={800}>{b}</T>
              </div>
            ))}
          </Row>
        </div>
      );
      // slide 2 — Social Proof Stamp
      return (
        <div style={{ ...zc, gap: 6 }}>
          <div style={{ display:'flex' }}>
            {['#3b82f6','#22c55e','#f59e0b','#ec4899'].map((c,i) => (
              <div key={i} style={{ width:24, height:24, borderRadius:'50%', background:c, border:'2px solid #fff', marginLeft: i > 0 ? -8 : 0, zIndex: 4-i }} />
            ))}
          </div>
          <T s={20} color="#0f172a" weight={900} align="center" spacing="-0.03em">10M+</T>
          <T s={7} color="#64748b" align="center">teams trust us worldwide</T>
          <div style={{ display:'flex', gap:6 }}>
            {['Forbes','TechCrunch','Wired'].map((b,i) => (
              <div key={i} style={{ background:'#f1f5f9', padding:'3px 7px', borderRadius:3 }}>
                <T s={6} color="#475569" weight={800}>{b}</T>
              </div>
            ))}
          </div>
          <Btn label="Join Free →" bg={accent} />
        </div>
      );
    }

    // checklist-viral
    if (id === 'checklist-viral') {
      if (slide === 0) return (
        <div style={{ ...zp(), gap: 5 }}>
          <T s={8} color="#0f172a" weight={900} spacing="-0.01em">The 2026 Growth Checklist</T>
          <T s={7} color="#64748b">Check what you're actually doing:</T>
          {[['Posting consistently','✓','#22c55e'],['Studying analytics','✓','#22c55e'],['Testing new formats','✓','#22c55e'],['Chasing followers','✗','#ef4444'],['Guessing what works','✗','#ef4444']].map(([t,m,c],i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:6, padding:'3px 0', borderBottom:'1px solid #f8fafc' }}>
              <div style={{ width:14, height:14, borderRadius:3, background: m==='✓'?`${c}20`:'#fef2f2', border:`1.5px solid ${c}`, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                <T s={7} color={c as string} weight={900}>{m}</T>
              </div>
              <T s={7} color={m==='✓'?'#1e293b':'#94a3b8'} weight={m==='✓'?600:400}>{t}</T>
            </div>
          ))}
        </div>
      );
      if (slide === 1) return (
        <div style={{ ...zp(), gap: 6 }}>
          <T s={8} color={accent} weight={800} caps spacing="0.1em">The ones who win:</T>
          {[['Create before they feel ready','#22c55e'],['Study their data weekly','#22c55e'],['Double down on what works','#22c55e']].map(([t,c],i) => (
            <div key={i} style={{ display:'flex', gap:8, alignItems:'flex-start', padding:'5px 0', borderBottom:i<2?'1px solid #f1f5f9':'none' }}>
              <div style={{ width:16, height:16, borderRadius:'50%', background:`${c}18`, border:`1.5px solid ${c}`, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', marginTop:1 }}>
                <T s={7} color={c as string} weight={900}>✓</T>
              </div>
              <T s={8} color="#1e293b" weight={600}>{t}</T>
            </div>
          ))}
        </div>
      );
      // slide 2 — Save This
      return (
        <div style={{ ...zp(), gap: 7 }}>
          <T s={7} color="#94a3b8" caps spacing="0.12em">📌 Save this checklist</T>
          <div style={{ background:`${accent}0f`, border:`1px solid ${accent}2a`, borderRadius: 8, padding:'10px 12px' }}>
            <T s={8.5} color="#0f172a" weight={700} align="left">The difference between people who grow and people who plateau is this list.</T>
          </div>
          <T s={7} color="#64748b" align="left">Bookmark this. Come back when you feel stuck.</T>
          <T s={7.5} color={accent} weight={700} align="left">Full guide at: yourlink.com →</T>
        </div>
      );
    }

    // vs-table
    if (id === 'vs-table') {
      if (slide === 0) return (
        <div style={{ ...z, flexDirection:'row' }}>
          {/* Refinery29-style split: left = old way, right = new way */}
          <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:5, background:'#f8fafc', padding:'0 8px' }}>
            <T s={6} color="#94a3b8" caps spacing="0.12em">Old way</T>
            <div style={{ display:'flex', flexDirection:'column', gap:3, width:'100%' }}>
              {['Slow','Confusing','Expensive'].map((t,i) => (
                <div key={i} style={{ background:'#fee2e2', borderRadius:4, padding:'4px 6px', display:'flex', alignItems:'center', gap:4 }}>
                  <div style={{ fontSize:8, color:'#ef4444' }}>✕</div>
                  <T s={6} color="#ef4444" weight={600}>{t}</T>
                </div>
              ))}
            </div>
          </div>
          <div style={{ width:2, background:'#e2e8f0', alignSelf:'stretch' }} />
          <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:5, background:`${accent}0a`, padding:'0 8px' }}>
            <T s={6} color={accent} caps spacing="0.12em" weight={700}>New way</T>
            <div style={{ display:'flex', flexDirection:'column', gap:3, width:'100%' }}>
              {['Instant','Simple','Free'].map((t,i) => (
                <div key={i} style={{ background:`${accent}18`, borderRadius:4, padding:'4px 6px', display:'flex', alignItems:'center', gap:4 }}>
                  <div style={{ fontSize:8, color:accent }}>✓</div>
                  <T s={6} color={accent} weight={700}>{t}</T>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
      if (slide === 1) return (
        <div style={{ ...zp(), gap: 5 }}>
          <Row gap={4}>
            <div style={{ minWidth:50 }}><T s={6} color="#94a3b8" weight={700}>Feature</T></div>
            <div style={{ flex:1 }} />
            <div style={{ minWidth:22, textAlign:'center' }}><T s={6} color={accent} weight={800} caps>Us</T></div>
            <div style={{ minWidth:22, textAlign:'center' }}><T s={6} color="#94a3b8" weight={700} caps>Them</T></div>
          </Row>
          <div style={{ height:1, background:'#e2e8f0', width:'100%' }} />
          {[['Speed','10x','1x'],['Setup','5 min','3 hrs'],['Price','Free','$$$'],['Support','24/7','Email']].map(([f,a,b],i) => (
            <div key={i} style={{ display:'flex', gap:4, alignItems:'center', padding:'3px 0', borderBottom:'1px solid #f1f5f9' }}>
              <div style={{ minWidth:50 }}><T s={7} color="#475569">{f}</T></div>
              <div style={{ flex:1 }} />
              <div style={{ minWidth:22, textAlign:'center' }}><T s={7} color={accent} weight={800}>{a}</T></div>
              <div style={{ minWidth:22, textAlign:'center' }}><T s={7} color="#94a3b8">{b}</T></div>
            </div>
          ))}
        </div>
      );
      // slide 2 — Save This
      return (
        <div style={{ ...zp(), gap: 7 }}>
          <T s={7} color="#94a3b8" caps spacing="0.12em">📌 Key takeaway</T>
          <div style={{ background:`${accent}0f`, border:`1px solid ${accent}2a`, borderRadius: 8, padding:'10px 12px' }}>
            <T s={8.5} color="#0f172a" weight={700} align="left">Before you choose a tool, compare on what actually matters. Speed, setup time, and support — not just price.</T>
          </div>
          <T s={7} color="#64748b">Save this. Share it with your team.</T>
          <T s={7.5} color={accent} weight={700}>See the full comparison →</T>
        </div>
      );
    }

    // three-reasons
    if (id === 'three-reasons') {
      if (slide === 0) return (
        <div style={{ ...zp(), gap: 4 }}>
          {/* Merriam-Webster dictionary entry style */}
          <T s={6} color="#94a3b8" caps spacing="0.14em">3 reasons</T>
          <div style={{ height:1, background:'#e2e8f0', width:'100%' }} />
          <div style={{ fontSize:30, fontWeight:900, color:'#0f172a', letterSpacing:'-0.04em', lineHeight:1 }}>why you should switch today.</div>
          <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:4 }}>
            <T s={7} color={accent} weight={700} caps spacing="0.08em">noun</T>
            <T s={7} color="#94a3b8">/rē-z n/</T>
          </div>
          <T s={7} color="#475569" weight={400}>The compelling arguments that change minds and drive decisions.</T>
        </div>
      );
      if (slide === 1) return (
        <div style={{ ...zp(), gap: 7 }}>
          {[['01','Save 10+ hours per week','Stop doing manually what AI can do for you'],['02','3× better results','Our users average 312% more engagement'],['03','Half the cost','Less than your daily coffee, forever']].map(([n,t,d],i) => (
            <div key={i} style={{ display:'flex', gap:8, alignItems:'flex-start', paddingBottom:7, borderBottom:i<2?'1px solid #f1f5f9':'none' }}>
              <div style={{ minWidth:22, lineHeight:1 }}><T s={9} color={accent} weight={900}>{n}</T></div>
              <div style={{ display:'flex', flexDirection:'column', gap:1 }}>
                <T s={8} color="#0f172a" weight={800}>{t}</T>
                <T s={6.5} color="#64748b">{d}</T>
              </div>
            </div>
          ))}
        </div>
      );
      // slide 2 — Save This
      return (
        <div style={{ ...zp(), gap: 7 }}>
          <T s={7} color="#94a3b8" caps spacing="0.12em">📌 3 reasons — saved</T>
          <div style={{ background:`${accent}0f`, border:`1px solid ${accent}2a`, borderRadius: 8, padding:'10px 12px' }}>
            <T s={8.5} color="#0f172a" weight={700} align="left">If you can't name 3 reasons why your thing is better, your customer can't either. That's where growth stalls.</T>
          </div>
          <T s={7} color="#64748b">Screenshot this. Review before your next pitch.</T>
          <T s={7.5} color={accent} weight={700}>More frameworks at: yourlink.com →</T>
        </div>
      );
    }

    // timeline-journey
    if (id === 'timeline-journey') {
      if (slide === 0) return (
        <div style={{ ...zp(), gap: 6 }}>
          <T s={7} color="#94a3b8" caps spacing="0.12em">Real transformation timeline</T>
          <div style={{ fontSize:34, fontWeight:900, color:'#0f172a', letterSpacing:'-0.05em', lineHeight:1 }}>90 days.<br/>Everything changes.</div>
          <div style={{ display:'flex', alignItems:'center', gap:4, marginTop:4 }}>
            <div style={{ height:3, flex:1, background:`${accent}33`, borderRadius:2 }} />
            <div style={{ height:3, flex:1, background:`${accent}66`, borderRadius:2 }} />
            <div style={{ height:3, flex:1, background:accent, borderRadius:2 }} />
          </div>
          <Row gap={6}>
            <T s={6} color="#94a3b8">Day 1</T>
            <div style={{ flex:1 }} />
            <T s={6} color="#94a3b8">Day 90</T>
          </Row>
        </div>
      );
      if (slide === 1) return (
        <div style={{ ...zp(), gap: 6 }}>
          <T s={7} color={accent} weight={700} caps spacing="0.1em">What actually happens</T>
          {[['Day 1','Clarity — you stop guessing what works'],['Week 3','Momentum — first real traction hits'],['Day 60','System locked in — results compound'],['Day 90','$2.1k → $8.7k. Real numbers.']].map(([t,d],i) => (
            <div key={i} style={{ display:'flex', gap:8, alignItems:'flex-start', paddingBottom:5, borderBottom:i<3?'1px solid #f1f5f9':'none' }}>
              <div style={{ minWidth:42, flexShrink:0 }}><T s={6.5} color={accent} weight={800}>{t}</T></div>
              <T s={7} color="#475569" weight={i===3?700:400}>{d}</T>
            </div>
          ))}
        </div>
      );
      // slide 2 — Save This
      return (
        <div style={{ ...zp(), gap: 7 }}>
          <T s={7} color="#94a3b8" caps spacing="0.12em">📌 Your roadmap, saved</T>
          <div style={{ background:`${accent}0f`, border:`1px solid ${accent}2a`, borderRadius: 8, padding:'10px 12px' }}>
            <T s={8.5} color="#0f172a" weight={700} align="left">Every transformation starts with a Day 1. The map is simple — what changes is whether you take the first step.</T>
          </div>
          <T s={7} color="#64748b">Save this for when you need a reminder.</T>
          <T s={7.5} color={accent} weight={700}>Start your journey at: yourlink.com →</T>
        </div>
      );
    }

    // steps-infographic
    if (id === 'steps-infographic') {
      if (slide === 0) return (
        <div style={{ ...zp(), gap: 5 }}>
          <T s={7} color="#94a3b8" caps spacing="0.12em">Most people skip step 3.</T>
          <div style={{ fontSize:28, fontWeight:900, color:'#0f172a', letterSpacing:'-0.04em', lineHeight:1.05 }}>That's why they never launch.</div>
          <div style={{ display:'flex', gap:5, alignItems:'center', marginTop:6 }}>
            {['Sign up','Pick template','Customize','🚀 Launch'].map((t,i) => (
              <div key={i} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4, flex:1 }}>
                <div style={{ width:22, height:22, borderRadius:'50%', background: i===2?'#ef4444':accent, display:'flex', alignItems:'center', justifyContent:'center', boxShadow: i===2?'0 0 10px rgba(239,68,68,0.4)':'none' }}>
                  <T s={8} color="#fff" weight={900}>{i+1}</T>
                </div>
                <T s={5} color={i===2?'#ef4444':'#94a3b8'} align="center" weight={i===2?700:400}>{t}</T>
              </div>
            ))}
          </div>
          <T s={6.5} color="#ef4444" weight={600}>Step 3 is where 80% stop. Swipe to fix that.</T>
        </div>
      );
      if (slide === 1) return (
        <div style={{ ...zp(), gap: 5 }}>
          <T s={7.5} color={accent} weight={700} caps spacing="0.1em">Step 3 — the full breakdown</T>
          <div style={{ height:1, background:'#e2e8f0', width:'100%' }} />
          {[['Pick your niche','Don\'t try to appeal to everyone'],['Use a proven hook format','Swipe file > starting from scratch'],['Schedule release','Wed/Thu/Fri 9–11am wins'],['Hit publish','Good enough beats perfect, always']].map(([t,d],i) => (
            <div key={i} style={{ display:'flex', gap:8, paddingBottom:5, borderBottom:i<3?'1px solid #f8fafc':'none' }}>
              <div style={{ width:16, height:16, borderRadius:'50%', background:`${accent}18`, border:`1.5px solid ${accent}55`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:1 }}>
                <T s={6.5} color={accent} weight={900}>{i+1}</T>
              </div>
              <div>
                <T s={7.5} color="#0f172a" weight={700} align="left">{t}</T>
                <T s={6.5} color="#94a3b8">{d}</T>
              </div>
            </div>
          ))}
        </div>
      );
      // slide 2 — Save This
      return (
        <div style={{ ...zp(), gap: 7 }}>
          <T s={7} color="#94a3b8" caps spacing="0.12em">📌 The 4-step process</T>
          <div style={{ background:`${accent}0f`, border:`1px solid ${accent}2a`, borderRadius: 8, padding:'10px 12px' }}>
            <T s={8.5} color="#0f172a" weight={700} align="left">Sign up → pick a template → customize → launch. That's it. Most people overthink step 4 and never start.</T>
          </div>
          <T s={7} color="#64748b">Screenshot this. Start step 1 today.</T>
          <T s={7.5} color={accent} weight={700}>Get started at: yourlink.com →</T>
        </div>
      );
    }

    // chart-reveal
    if (id === 'chart-reveal') {
      if (slide === 0) return (
        <div style={{ ...zp(), gap: 6 }}>
          <T s={7} color={accent} weight={700} caps spacing="0.12em">New study reveals</T>
          <div style={{ fontSize:38, color:'#0f172a', fontWeight:900, letterSpacing:'-0.05em', lineHeight:1 }}>312%</div>
          <T s={8} color="#475569" weight={500}>average growth in 90 days</T>
          {/* Bar chart */}
          <div style={{ display:'flex', alignItems:'flex-end', gap:5, height:50, marginTop:4 }}>
            {[['Jan',15],['Feb',28],['Mar',42],['Apr',58],['May',72],['Jun',90]].map(([m,h],i) => (
              <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
                <div style={{ width:'100%', height:`${h}%`, background: i===5?accent:`${accent}${Math.round(50+i*8).toString(16)}`, borderRadius:'2px 2px 0 0' }} />
                <T s={4.5} color="#94a3b8">{m}</T>
              </div>
            ))}
          </div>
        </div>
      );
      if (slide === 1) return (
        <div style={{ ...zp(), gap: 7 }}>
          <T s={8} color={accent} weight={700} caps spacing="0.1em">Before vs After</T>
          <div style={{ width:'100%', display:'flex', flexDirection:'column', gap:5 }}>
            {[['Revenue','$2.1k','$8.7k',75],['Leads','120','480',80],['Conv. Rate','1.2%','4.8%',65]].map(([l,b,a,p],i) => (
              <div key={i} style={{ display:'flex', flexDirection:'column', gap:2 }}>
                <div style={{ display:'flex', gap:4, justifyContent:'space-between' }}>
                  <T s={6} color="#475569" weight={600}>{l}</T>
                  <div style={{ display:'flex', gap:8 }}>
                    <T s={6} color="#94a3b8" weight={500}>{b}</T>
                    <T s={6} color={accent} weight={700}>→ {a}</T>
                  </div>
                </div>
                <div style={{ height:4, background:'#f1f5f9', borderRadius:2, overflow:'hidden' }}>
                  <div style={{ width:`${p}%`, height:'100%', background:accent, borderRadius:2 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      );
      // slide 2 — Save This (data version)
      return (
        <div style={{ ...zp(), gap: 7 }}>
          <T s={7} color="#94a3b8" caps spacing="0.12em">📌 The 312% insight</T>
          <div style={{ background:`${accent}0f`, border:`1px solid ${accent}2a`, borderRadius: 8, padding:'10px 12px' }}>
            <T s={8.5} color="#0f172a" weight={700} align="left">Growth isn't linear — it compounds. The brands that grew 312% didn't work 312% harder. They found 1 lever and pulled it.</T>
          </div>
          <T s={7} color="#64748b">Save this. Revisit in 30 days.</T>
          <T s={7.5} color={accent} weight={700}>Full study at: yourlink.com →</T>
        </div>
      );
    }

    // flat-lay
    if (id === 'flat-lay') {
      if (slide === 0) return (
        <div style={{ ...zc, gap: 0 }}>
          {/* Etsy-style product card */}
          <div style={{ width:'88%', background:'#fff', borderRadius:8, overflow:'hidden', boxShadow:'0 4px 16px rgba(0,0,0,0.10)' }}>
            <div style={{ background:`linear-gradient(135deg,${accent}22,${accent}0a)`, height:62, display:'flex', alignItems:'center', justifyContent:'center', position:'relative' }}>
              <div style={{ width:42, height:36, background:`linear-gradient(160deg,${accent},${accent}bb)`, borderRadius:5, boxShadow:`0 6px 16px ${accent}55`, transform:'rotate(-4deg)' }} />
              <div style={{ position:'absolute', top:7, right:9 }}>
                <Stars color="#f59e0b" />
              </div>
            </div>
            <div style={{ padding:'8px 10px 10px', display:'flex', flexDirection:'column', gap:3 }}>
              <T s={8} color="#111" weight={700}>The Essentials Set</T>
              <T s={6} color="#999" weight={500}>Brand Co.</T>
              <div style={{ display:'flex', gap:8, alignItems:'baseline', marginTop:4 }}>
                <T s={10} color="#111" weight={900}>{`$49`}</T>
                <div style={{ textDecoration:'line-through' }}><T s={7} color="#999" weight={400}>{`$79`}</T></div>
              </div>
            </div>
          </div>
        </div>
      );
      if (slide === 1) return (
        <div style={{ ...zc, gap: 8 }}>
          {/* 2-column product highlights, clean white */}
          <T s={8} color="#111" weight={800} align="center">Why people love it</T>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, width:'90%' }}>
            {[['🌿','Sustainable'],['✋','Hand-crafted'],['⭐','Top rated'],['♻','Eco pack']].map(([e,t],i) => (
              <div key={i} style={{ background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:7, padding:'8px 6px', display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
                <div style={{ fontSize:14 }}>{e}</div>
                <T s={6} color="#475569" weight={700} align="center">{t}</T>
              </div>
            ))}
          </div>
        </div>
      );
      // slide 2 — Cart Card
      return (
        <div style={{ ...zc, gap: 0, padding: 12 }}>
          <div style={{ background:'#fff', borderRadius:10, padding:'10px 12px', width:'90%', boxShadow:'0 6px 24px rgba(0,0,0,0.1)', display:'flex', flexDirection:'column', gap:6 }}>
            <div style={{ height:44, background:`${accent}14`, borderRadius:6, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <div style={{ width:28, height:22, background:`${accent}88`, borderRadius:4 }} />
            </div>
            <T s={8.5} color="#111" weight={700} align="left">The Essentials Set</T>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <Stars color="#f59e0b" />
              <div style={{ display:'flex', gap:6, alignItems:'baseline' }}>
                <div style={{ textDecoration:'line-through' }}><T s={6} color="#94a3b8">$79</T></div>
                <T s={13} color={accent} weight={900}>$49</T>
              </div>
            </div>
            <div style={{ background:accent, borderRadius:6, padding:'6px 0', textAlign:'center', boxShadow:`0 4px 12px ${accent}44` }}>
              <T s={8} color="#fff" weight={800} align="center">Add to Cart →</T>
            </div>
          </div>
        </div>
      );
    }

    // leaderboard
    if (id === 'leaderboard') {
      if (slide === 0) return (
        <div style={{ ...zp(), gap: 5 }}>
          <T s={7} color="#94a3b8" caps spacing="0.12em">Independent ranking · 2026</T>
          {[['🥇','#1','Our Brand','50,221 reviews','#fbbf24'],['🥈','#2','Brand B','12,400 reviews','#94a3b8'],['🥉','#3','Brand C','8,900 reviews','#f97316']].map(([e,n,b,r,c],i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:7, padding:'6px 8px', background: i===0?`${accent}0d`:'transparent', borderRadius:6, border: i===0?`1px solid ${accent}22`:'1px solid transparent' }}>
              <div style={{ fontSize:14 }}>{e}</div>
              <div style={{ flex:1 }}>
                <T s={8} color={i===0?accent:'#475569'} weight={i===0?800:600} align="left">{b as string}</T>
                <T s={5.5} color="#94a3b8">{r as string}</T>
              </div>
              <T s={9} color={c as string} weight={900}>{n}</T>
            </div>
          ))}
        </div>
      );
      if (slide === 1) return (
        <div style={{ ...zp(), gap: 7 }}>
          <T s={7} color={accent} weight={700} caps spacing="0.1em">Why we ranked #1</T>
          <div style={{ height:1, background:'#f1f5f9', width:'100%' }} />
          {[['Response time','Under 2 min','3+ hours'],['Setup speed','5 minutes','Half a day'],['NPS score','87 (world class)','42 (average)'],['Price per seat','$29/mo','$89/mo']].map(([f,a,b],i) => (
            <div key={i} style={{ display:'flex', gap:4, alignItems:'center', paddingBottom:5, borderBottom:i<3?'1px solid #f8fafc':'none' }}>
              <T s={6.5} color="#475569" weight={500} align="left">{f}</T>
              <div style={{ flex:1 }} />
              <T s={7} color={accent} weight={800}>{a}</T>
              <T s={6} color="#cbd5e1" weight={400}>vs {b}</T>
            </div>
          ))}
        </div>
      );
      // slide 2 — Social Proof Stamp
      return (
        <div style={{ ...zc, gap: 7 }}>
          <T s={28} color={accent} weight={900} spacing="-0.04em">#1</T>
          <T s={8.5} color="#0f172a" weight={800} align="center">Rated by 50,000+ users in 2026</T>
          <Stars color="#fbbf24" />
          <T s={7} color="#64748b" align="center">Across 12 independent review platforms</T>
          <Btn label="See Why →" bg={accent} />
        </div>
      );
    }

    // stat-study
    if (id === 'stat-study') {
      if (slide === 0) return (
        <div style={{ ...zp(), gap: 5 }}>
          <T s={6} color="#94a3b8" caps spacing="0.14em">Brand Labs Study · 5,000 users · 90 days</T>
          <div style={{ fontSize: 42, color: accent, fontWeight: 900, lineHeight: 1, letterSpacing:'-0.05em' }}>73%</div>
          <T s={9} color="#1e293b" weight={700} spacing="-0.01em">saw measurable results<br/>in the first 7 days.</T>
          <div style={{ height:1, background:'#e2e8f0', width:'100%', marginTop:2 }} />
          <T s={6.5} color="#94a3b8">The other 27%? They didn't follow the system.</T>
        </div>
      );
      if (slide === 1) return (
        <div style={{ ...zp(), gap: 6 }}>
          <T s={7} color={accent} weight={700} caps spacing="0.1em">Full data breakdown</T>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:5, width:'100%' }}>
            {[['73%','Results in week 1'],['89%','Would recommend'],['4.8★','Avg user rating'],['3.1×','ROI at 90 days']].map(([n,l],i) => (
              <div key={i} style={{ background:'#f8fafc', borderRadius:6, padding:'7px 8px', border:'1px solid #e2e8f0', display:'flex', flexDirection:'column', gap:1 }}>
                <T s={13} color={accent} weight={900} spacing="-0.03em">{n}</T>
                <T s={6} color="#64748b" align="left">{l}</T>
              </div>
            ))}
          </div>
          <T s={6} color="#94a3b8">Source: Brand Labs · 2026 · n=5,000</T>
        </div>
      );
      // slide 2 — Social Proof Stamp
      return (
        <div style={{ ...zc, gap: 6 }}>
          <T s={32} color={accent} weight={900} spacing="-0.04em">73%</T>
          <T s={8} color="#0f172a" weight={700} align="center">of users see results in week 1</T>
          <div style={{ display:'flex' }}>
            {['#6366f1','#ec4899','#f59e0b','#22c55e'].map((c,i) => (
              <div key={i} style={{ width:20, height:20, borderRadius:'50%', background:c, border:'2px solid #fff', marginLeft: i>0 ? -6 : 0 }} />
            ))}
          </div>
          <T s={7} color="#64748b" align="center">5,000 users surveyed · Brand Labs 2026</T>
          <Btn label="Join the 73% →" bg={accent} />
        </div>
      );
    }

    // news-frame
    if (id === 'news-frame') {
      if (slide === 0) return (
        <div style={{ ...zp(), gap: 5 }}>
          <T s={6} color={accent} caps spacing="0.18em" weight={700}>The Daily · Tech</T>
          <T s={13} color="#0f172a" weight={900} spacing="-0.02em">Brand X is changing how we shop online.</T>
        </div>
      );
      if (slide === 1) return (
        <div style={{ ...zp(), gap: 5 }}>
          {['"This is the most innovative tool we\'ve seen this year."','Industry analysts are calling it a turning point.','Early adopters report significant growth.'].map((t,i) => (
            <T key={i} s={7} color="#475569" weight={500}>{t}</T>
          ))}
        </div>
      );
      // slide 2 — Social Proof Stamp
      return (
        <div style={{ ...zp(), gap: 6 }}>
          <T s={7} color="#94a3b8" caps spacing="0.12em">Also featured in</T>
          {[['Forbes','#1 Tool for Modern Brands'],['TechCrunch','Reshaping the industry'],['Wired','Built differently']].map(([pub,quote],i) => (
            <div key={i} style={{ borderLeft:`2px solid ${accent}`, paddingLeft:8, paddingTop:2, paddingBottom:2 }}>
              <T s={7} color={accent} weight={800} caps>{pub}</T>
              <T s={7.5} color="#1e293b" weight={500}>"{quote}"</T>
            </div>
          ))}
          <Btn label="Read the Story →" bg={accent} />
        </div>
      );
    }

    // brand-awareness
    if (id === 'brand-awareness') {
      if (slide === 0) return (
        <div style={{ ...zc, gap: 9 }}>
          <div style={{ display:'flex', gap:6, alignItems:'center' }}>
            {[0,1,2].map(i => (
              <div key={i} style={{ width:28, height:28, borderRadius:5, background: i===1 ? accent : 'rgba(255,255,255,0.08)', border: i===1 ? 'none' : '1px solid rgba(255,255,255,0.12)', boxShadow: i===1 ? `0 0 16px ${accent}66` : 'none', transition:'all 0.2s' }} />
            ))}
          </div>
          <T s={16} color="#fff" weight={900} align="center" spacing="-0.03em">One brand<br/>gets remembered.</T>
          <T s={7} color="rgba(255,255,255,0.35)" align="center">Most blend in. Here's the difference.</T>
        </div>
      );
      if (slide === 1) return (
        <div style={{ ...zp(), gap: 8 }}>
          <T s={7} color={accent} weight={700} caps spacing="0.12em">What brand awareness buys you</T>
          {[['73%','of buyers choose brands they recognize'],['3×','higher conversion from warm audiences'],['7×','more trust before you say a word']].map(([n,t],i) => (
            <div key={i} style={{ display:'flex', gap:10, alignItems:'center', paddingBottom:8, borderBottom: i<2?'1px solid rgba(255,255,255,0.08)':'none' }}>
              <T s={16} color={accent} weight={900} spacing="-0.04em">{n}</T>
              <T s={7} color="rgba(255,255,255,0.55)" weight={400}>{t}</T>
            </div>
          ))}
        </div>
      );
      // slide 2 — Brand Statement
      return (
        <div style={{ ...zc, gap: 8, padding: '0 16px' }}>
          <div style={{ height: 2, background: accent, width: 32 }} />
          <T s={9} color="rgba(255,255,255,0.55)" weight={300} align="center" spacing="0.06em" caps>Built for people who</T>
          <T s={14} color={accent} weight={900} align="center" spacing="-0.02em">refuse to be forgettable.</T>
          <T s={7.5} color="rgba(255,255,255,0.35)" align="center" weight={400}>Not for everyone.</T>
          <T s={7.5} color="rgba(255,255,255,0.6)" align="center" spacing="0.04em">yourbrand.com</T>
        </div>
      );
    }

    // email-mockup
    if (id === 'email-mockup') {
      if (slide === 0) return (
        <div style={{ ...zp(), gap: 5 }}>
          <T s={6} color="#94a3b8">From: Brand &lt;hello@brand.com&gt;</T>
          <div style={{ height:1, background:'#e2e8f0', width:'100%' }} />
          <T s={9} color="#0f172a" weight={800} spacing="-0.01em">Your 50% off ends tonight</T>
          <T s={6} color="#94a3b8">Don't miss out — claim before midnight...</T>
        </div>
      );
      if (slide === 1) return (
        <div style={{ ...zp(), gap: 6 }}>
          <T s={7} color="#1e293b">Hi friend,</T>
          <T s={7} color="#475569">Just 6 hours left to grab 50% off everything.</T>
          <div style={{ background: accent, borderRadius:4, padding:'5px 10px', alignSelf:'flex-start' }}>
            <T s={7} color="#fff" weight={800}>Shop Now →</T>
          </div>
        </div>
      );
      // slide 2 — Value Receipt (email capture version)
      return (
        <div style={{ ...zp(), gap: 6 }}>
          <T s={7} color="#94a3b8" caps spacing="0.12em">When you subscribe you get</T>
          <div style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
            {[['Weekly growth tips','Free'],['Exclusive discounts','Members only'],['Early access','Always first']].map(([name,val],i) => (
              <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 10px', borderBottom: i < 2 ? '1px solid #f1f5f9' : 'none', background: i % 2 === 0 ? '#fafafa' : '#fff' }}>
                <T s={7.5} color="#334155" weight={500}>{name}</T>
                <T s={7} color={accent} weight={600}>{val}</T>
              </div>
            ))}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'7px 10px', background:`${accent}0f`, borderTop:`1px solid ${accent}33` }}>
              <T s={8} color="#0f172a" weight={700}>Your cost</T>
              <T s={14} color={accent} weight={900}>$0</T>
            </div>
          </div>
          <Btn label="Subscribe Free →" bg={accent} />
        </div>
      );
    }

    // founder-story
    if (id === 'founder-story') {
      if (slide === 0) return (
        <div style={{ ...zp(), gap: 6 }}>
          {/* Warm amber bg — intimate founder letter style */}
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: `linear-gradient(135deg, ${accent}, #f59e0b)`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 4px 12px ${accent}44`, flexShrink: 0 }}>
              <T s={13} color="#fff" weight={900}>JD</T>
            </div>
            <div>
              <T s={8} color="#0f172a" weight={800}>Jane Doe</T>
              <T s={6} color="#92400e" weight={600}>Founder & CEO</T>
            </div>
          </div>
          <div style={{ borderLeft: `3px solid ${accent}`, paddingLeft: 10, marginTop: 4 }}>
            <T s={9} color="#451a03" weight={500} spacing="-0.01em">"I built this because I was the customer who couldn't find what I needed. So I made it myself."</T>
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
            <T s={6} color="#92400e" weight={600}>Founded 2019</T>
            <T s={6} color="#d97706">·</T>
            <T s={6} color="#92400e">14,000+ customers</T>
          </div>
        </div>
      );
      if (slide === 1) return (
        <div style={{ ...zp(), gap: 6 }}>
          <T s={7} color="#92400e" caps spacing="0.1em" weight={700}>The real story</T>
          <div style={{ height: 1, background: '#fde68a', width: '100%' }} />
          {[['2019','Broke, no customers, 3 failed attempts'],['2021','Found the one thing that changed everything'],['2024','$2M revenue, 14k happy customers']].map(([y,d],i) => (
            <div key={i} style={{ display: 'flex', gap: 8 }}>
              <div style={{ minWidth: 30 }}><T s={7} color={accent} weight={800}>{y}</T></div>
              <T s={7} color="#451a03" weight={i===2?700:400}>{d}</T>
            </div>
          ))}
        </div>
      );
      // slide 2 — Chapter Epilogue
      return (
        <div style={{ ...zp(), gap: 8, padding: '24px 16px' }}>
          <div style={{ height: 1, background: '#fde68a', width: '100%' }} />
          <T s={11} color="#451a03" weight={300} align="left" spacing="0.01em">That's the real story. The rest is yours to write.</T>
          <T s={7.5} color="#92400e" align="left">We built this so you wouldn't have to start from scratch like we did.</T>
          <T s={7.5} color={accent} weight={700} align="left">yourlink.com/story →</T>
        </div>
      );
    }

    // community-quote
    if (id === 'community-quote') {
      if (slide === 0) return (
        <div style={{ ...zp(), gap: 6 }}>
          <Row gap={6}>
            <Col align="center" gap={0}>
              <div style={{ fontSize:8, color:accent }}>▲</div>
              <T s={7} color="#0f172a" weight={800}>14.2k</T>
            </Col>
            <Col gap={2}>
              <T s={6} color="#64748b" weight={600}>r/community</T>
              <T s={9} color="#0f172a" weight={700} spacing="-0.01em">This product changed my routine</T>
              <T s={6} color="#94a3b8">u/realuser · 8h</T>
            </Col>
          </Row>
        </div>
      );
      if (slide === 1) return (
        <div style={{ ...zp(), gap: 6 }}>
          <div style={{ borderLeft:'2px solid #cbd5e1', paddingLeft:8 }}>
            <T s={7} color="#475569" weight={500}>"Tried it for a month and honestly didn't expect this. Worth every penny."</T>
            <T s={6} color="#94a3b8">847 replies · 2.1k upvotes</T>
          </div>
        </div>
      );
      // slide 2 — Tag Someone
      return (
        <div style={{ ...zc, gap: 8, padding: '0 16px' }}>
          <div style={{ fontSize: 28 }}>👇</div>
          <T s={14} color="#0f172a" weight={900} align="center" spacing="-0.02em">Tag someone in the comments who needs to see this.</T>
          <T s={7.5} color="#64748b" align="center">They'll thank you. Or argue with you. Either way — engagement.</T>
        </div>
      );
    }

    // chat-thread
    if (id === 'chat-thread') {
      if (slide === 0) return (
        <div style={{ ...zp(), gap: 6 }}>
          <div style={{ alignSelf:'flex-end', background: accent, borderRadius:'10px 10px 2px 10px', padding:'5px 9px', maxWidth:'70%' }}>
            <T s={7} color="#fff">Does this actually work?</T>
          </div>
          <div style={{ alignSelf:'flex-start', background:'#f1f5f9', borderRadius:'10px 10px 10px 2px', padding:'5px 9px', maxWidth:'80%' }}>
            <T s={7} color="#1e293b">Changed my life honestly 🤯</T>
          </div>
        </div>
      );
      if (slide === 1) return (
        <div style={{ ...zp(), gap: 5 }}>
          <div style={{ alignSelf:'flex-end', background: accent, borderRadius:'10px 10px 2px 10px', padding:'4px 8px', maxWidth:'70%' }}>
            <T s={6} color="#fff">What did you use?</T>
          </div>
          <div style={{ alignSelf:'flex-start', background:'#f1f5f9', borderRadius:'10px 10px 10px 2px', padding:'4px 8px', maxWidth:'80%' }}>
            <T s={6} color="#1e293b">Brand X. Game changer.</T>
          </div>
          <div style={{ alignSelf:'flex-end', background: accent, borderRadius:'10px 10px 2px 10px', padding:'4px 8px', maxWidth:'70%' }}>
            <T s={6} color="#fff">Sending the link 🙏</T>
          </div>
        </div>
      );
      // slide 2 — Tag Someone
      return (
        <div style={{ ...zc, gap: 8, padding: '0 16px' }}>
          <div style={{ fontSize: 28 }}>👇</div>
          <T s={14} color="#0f172a" weight={900} align="center" spacing="-0.02em">Tag someone you need to send this to.</T>
          <T s={7.5} color="#64748b" align="center">DM it. Send it. Just don't keep it to yourself.</T>
        </div>
      );
    }

    // tweet-screenshot
    if (id === 'tweet-screenshot') {
      if (slide === 0) return (
        <div style={{ ...zp(), gap: 5 }}>
          <Row gap={5}>
            <div style={{ width:22, height:22, borderRadius:'50%', background: accent }} />
            <Col gap={0}><T s={7} color="#0f172a" weight={800}>Real User</T><T s={6} color="#64748b">@realuser</T></Col>
          </Row>
          <T s={8} color="#0f172a" weight={500}>I tried Brand X and now I won't shut up about it. Seriously.</T>
          <Row gap={9}>
            {[['💬','42'],['🔁','128'],['♥','2.1k']].map(([i,n],k) => (
              <Row key={k} gap={2}><div style={{ fontSize:8 }}>{i}</div><T s={6} color="#64748b">{n}</T></Row>
            ))}
          </Row>
        </div>
      );
      if (slide === 1) return (
        <div style={{ ...zp(), gap: 5 }}>
          <T s={7} color="#0f172a" weight={500}>Update: 30 days in. Still wow.</T>
          <div style={{ height:1, background:'#e2e8f0', width:'100%' }} />
          <div style={{ border:'1px solid #e2e8f0', borderRadius:6, padding:6 }}>
            <T s={6} color="#64748b">Quoting @brand</T>
            <T s={7} color="#0f172a" weight={500}>Built for people who want results.</T>
          </div>
        </div>
      );
      // slide 2 — Tag Someone
      return (
        <div style={{ ...zc, gap: 8, padding: '0 16px' }}>
          <div style={{ fontSize: 28 }}>👇</div>
          <T s={14} color="#0f172a" weight={900} align="center" spacing="-0.02em">Tag someone who tweets this stuff every day.</T>
          <T s={7.5} color="#64748b" align="center">They'll either love you or mute you. Win-win.</T>
        </div>
      );
    }

    // reddit-thread
    if (id === 'reddit-thread') {
      if (slide === 0) return (
        <div style={{ ...zp(), gap: 5 }}>
          <Row gap={6}>
            <Col align="center" gap={0}>
              <div style={{ fontSize:9, color:'#f97316' }}>▲</div>
              <T s={7} color="#0f172a" weight={800}>14.2k</T>
            </Col>
            <Col gap={1}>
              <T s={9} color="#0f172a" weight={700} spacing="-0.01em">After 6 months, here's what worked</T>
              <Row gap={4}>
                <div style={{ background:'#fbbf24', borderRadius:8, padding:'1px 5px' }}><T s={5} color="#fff" weight={800}>GOLD</T></div>
                <T s={6} color="#94a3b8">r/community · 12h</T>
              </Row>
            </Col>
          </Row>
        </div>
      );
      if (slide === 1) return (
        <div style={{ ...zp(), gap: 5 }}>
          {['Top comment: "100% agree"','847 replies','2.1k upvotes'].map((t,i) => (
            <Row key={i} gap={5}><Dot color={accent} /><T s={7} color="#475569">{t}</T></Row>
          ))}
        </div>
      );
      // slide 2 — Tag Someone
      return (
        <div style={{ ...zc, gap: 8, padding: '0 16px' }}>
          <div style={{ fontSize: 28 }}>👇</div>
          <T s={14} color="#0f172a" weight={900} align="center" spacing="-0.02em">Tag someone who needs to read this thread.</T>
          <T s={7.5} color="#64748b" align="center">14k upvotes don't lie. Share it.</T>
        </div>
      );
    }

    // meme-format
    if (id === 'meme-format') {
      if (slide === 0) return (
        <div style={{ ...zp('flex-start','flex-start'), gap: 6 }}>
          <T s={11} color="#000" weight={900} align="center" caps spacing="-0.01em">When you finally try it</T>
          <div style={{ background:'#e2e8f0', height:60, width:'100%', borderRadius:4 }} />
          <T s={11} color="#000" weight={900} align="center" caps spacing="-0.01em">And it just works</T>
        </div>
      );
      if (slide === 1) return (
        <div style={{ ...zp('flex-start','flex-start'), gap: 6 }}>
          <T s={10} color="#000" weight={900} caps>Other tools:</T>
          <div style={{ background:'#fee2e2', height:50, width:'100%', borderRadius:4, display:'flex', alignItems:'center', justifyContent:'center', fontSize: 20 }}>😩</div>
          <T s={10} color="#000" weight={900} caps>Brand X:</T>
          <div style={{ background:'#dcfce7', height:30, width:'100%', borderRadius:4, display:'flex', alignItems:'center', justifyContent:'center', fontSize: 16 }}>✨</div>
        </div>
      );
      // slide 2 — Tag Someone
      return (
        <div style={{ ...zc, gap: 8, padding: '0 16px' }}>
          <div style={{ fontSize: 32 }}>😂</div>
          <T s={14} color="#000" weight={900} align="center" spacing="-0.03em">Tag the friend who needs to see this.</T>
          <T s={7.5} color="#555" align="center">Save them from themselves.</T>
        </div>
      );
    }

    // comment-reply
    if (id === 'comment-reply') {
      if (slide === 0) return (
        <div style={{ ...zp(), gap: 7 }}>
          <div style={{ background: accent, borderRadius:20, padding:'3px 10px', alignSelf:'flex-start' }}>
            <T s={7} color="#fff" weight={700}>Replying to @user</T>
          </div>
          <div style={{ background:'rgba(255,255,255,0.06)', height:60, borderRadius:6, width:'100%' }} />
          <T s={9} color="#fff" weight={700}>Here's what happened...</T>
        </div>
      );
      if (slide === 1) return (
        <div style={{ ...zp(), gap: 6 }}>
          <T s={7} color={accent} weight={700} caps spacing="0.1em">The full story</T>
          <T s={8} color="#fff" weight={500}>I tried it for 30 days. Tracked everything. Here's what I learned: it just works.</T>
        </div>
      );
      // slide 2 — Tag Someone
      return (
        <div style={{ ...zc, gap: 8, padding: '0 16px' }}>
          <div style={{ fontSize: 28 }}>👇</div>
          <T s={14} color="#fff" weight={900} align="center" spacing="-0.02em">Tag someone who needs to see this reply.</T>
          <T s={7.5} color="rgba(255,255,255,0.5)" align="center">Sometimes the comment is better than the post.</T>
        </div>
      );
    }

    // poll-card
    if (id === 'poll-card') {
      if (slide === 0) return (
        <div style={{ ...zp(), gap: 7 }}>
          {/* MTV-style bold poll */}
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <div style={{ background:accent, borderRadius:4, padding:'2px 8px' }}>
              <T s={6} color="#fff" weight={900} caps spacing="0.1em">Poll</T>
            </div>
            <T s={6} color='rgba(255,255,255,0.4)' caps spacing="0.08em">1 question</T>
          </div>
          <T s={12} color="#fff" weight={900} spacing="-0.02em">What's holding you back from growing?</T>
          <div style={{ display:'flex', flexDirection:'column', gap:5, width:'100%', marginTop:2 }}>
            {[['A','Not enough time','#fff'],['B','Wrong strategy','rgba(255,255,255,0.65)']].map(([letter,opt,col],i) => (
              <div key={i} style={{ display:'flex', gap:8, alignItems:'center', background:i===0?`${accent}30`:'rgba(255,255,255,0.07)', border:i===0?`1.5px solid ${accent}`:'1px solid rgba(255,255,255,0.12)', borderRadius:8, padding:'8px 10px' }}>
                <div style={{ width:18, height:18, borderRadius:'50%', background:i===0?accent:'rgba(255,255,255,0.12)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <T s={7} color="#fff" weight={900}>{letter}</T>
                </div>
                <T s={8} color={col as string} weight={i===0?700:500}>{opt}</T>
              </div>
            ))}
          </div>
        </div>
      );
      if (slide === 1) return (
        <div style={{ ...zp(), gap: 6 }}>
          <T s={7} color={accent} weight={700} caps spacing="0.1em">Results are in 📊</T>
          {[['A · Time','68%',68],['B · Strategy','24%',24],['C · Other','8%',8]].map(([l,p,w],i) => (
            <Col key={i} gap={3}>
              <Row gap={4}><T s={7} color="#fff" weight={600}>{l}</T><div style={{flex:1}}/><T s={8} color={i===0?accent:'rgba(255,255,255,0.5)'} weight={800}>{p}</T></Row>
              <div style={{ height:6, background:'rgba(255,255,255,0.08)', borderRadius:3, overflow:'hidden' }}>
                <div style={{ width:`${w}%`, height:'100%', background:i===0?accent:'rgba(255,255,255,0.2)', borderRadius:3 }} />
              </div>
            </Col>
          ))}
        </div>
      );
      // slide 2 — Tag Someone
      return (
        <div style={{ ...zc, gap: 8, padding: '0 16px' }}>
          <div style={{ fontSize: 28 }}>👇</div>
          <T s={14} color="#fff" weight={900} align="center" spacing="-0.02em">Drop your answer in the comments.</T>
          <T s={7.5} color="rgba(255,255,255,0.5)" align="center">Then tag someone who'd vote differently.</T>
        </div>
      );
    }

    // receipt-style
    if (id === 'receipt-style') {
      if (slide === 0) return (
        <div style={{ ...zp(), gap: 5 }}>
          <T s={7} color="#0f172a" caps spacing="0.14em" weight={800} align="center">Order Receipt</T>
          <div style={{ borderTop:'1px dashed #94a3b8', width:'100%' }} />
          {[['Course','$197'],['Templates','$97'],['Bonus','$203']].map(([n,v],i) => (
            <Row key={i} gap={4}><T s={7} color="#475569">{n}</T><div style={{flex:1}}/><T s={7} color="#0f172a" weight={700}>{v}</T></Row>
          ))}
          <div style={{ borderTop:'1px solid #0f172a', width:'100%' }} />
          <Row gap={4}><T s={8} color="#0f172a" weight={900}>TOTAL VALUE</T><div style={{flex:1}}/><T s={8} color={accent} weight={900}>$497</T></Row>
        </div>
      );
      if (slide === 1) return (
        <div style={{ ...zp(), gap: 6 }}>
          <T s={7} color={accent} weight={700} caps spacing="0.1em">What's included</T>
          {['Full course access','30 templates','Lifetime updates'].map((t,i) => (
            <Row key={i} gap={5}><Check color={accent} /><T s={7} color="#1e293b">{t}</T></Row>
          ))}
        </div>
      );
      // slide 2 — Value Receipt (receipt style — light theme)
      return (
        <div style={{ ...zp(), gap: 5 }}>
          <T s={7} color="#94a3b8" caps spacing="0.12em">Your order summary</T>
          <div style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden', fontFamily: 'monospace' }}>
            {[['Course access','$197'],['Template pack','$97'],['Lifetime updates','$49']].map(([name,val],i) => (
              <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 10px', borderBottom: i < 2 ? '1px solid #f1f5f9' : 'none', background: i % 2 === 0 ? '#fafafa' : '#fff' }}>
                <T s={7.5} color="#334155" weight={500}>{name}</T>
                <T s={7} color="#94a3b8">{val}</T>
              </div>
            ))}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'7px 10px', background:`${accent}0f`, borderTop:`1px solid ${accent}33` }}>
              <T s={8} color="#0f172a" weight={900}>Total value</T>
              <T s={15} color={accent} weight={900}>$97</T>
            </div>
          </div>
          <Btn label="Claim This Offer →" bg={accent} />
          <T s={6} color="#94a3b8" align="center">Limited-time pricing</T>
        </div>
      );
    }

    // bundle-stack
    if (id === 'bundle-stack') {
      if (slide === 0) return (
        <div style={{ ...zc, gap: 7 }}>
          <div style={{ position:'relative', width:80, height:60 }}>
            {[0,1,2].map(i => (
              <div key={i} style={{ position:'absolute', top:i*6, left:i*8, width:60, height:42, background:`linear-gradient(135deg, ${accent}${i===2?'':'aa'}, ${accent}66)`, borderRadius:4, boxShadow:'0 4px 10px rgba(0,0,0,0.1)' }} />
            ))}
          </div>
          <Row gap={6}>
            <div style={{ fontSize:9, color:'#94a3b8', fontWeight:700, textDecoration:'line-through' }}>$297</div>
            <T s={14} color={accent} weight={900}>$97</T>
          </Row>
        </div>
      );
      if (slide === 1) return (
        <div style={{ ...zp(), gap: 6 }}>
          <T s={7} color={accent} weight={700} caps spacing="0.1em">In the bundle</T>
          {[['Item 1','$99'],['Item 2','$99'],['Item 3','$99']].map(([n,v],i) => (
            <Row key={i} gap={4}><Dot color={accent} /><T s={7} color="#1e293b">{n}</T><div style={{flex:1}}/><T s={7} color="#475569">{v}</T></Row>
          ))}
        </div>
      );
      // slide 2 — Value Receipt
      return (
        <div style={{ ...zp(), gap: 5 }}>
          <T s={7} color="#94a3b8" caps spacing="0.12em">Bundle breakdown</T>
          <div style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
            {[['Item 1','$99 value'],['Item 2','$99 value'],['Item 3','$99 value']].map(([name,val],i) => (
              <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 10px', borderBottom: i < 2 ? '1px solid #f1f5f9' : 'none', background: i % 2 === 0 ? '#fafafa' : '#fff' }}>
                <T s={7.5} color="#334155" weight={500}>{name}</T>
                <T s={7} color="#94a3b8">{val}</T>
              </div>
            ))}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'7px 10px', background:`${accent}0f`, borderTop:`1px solid ${accent}33` }}>
              <T s={8} color="#0f172a" weight={700}>Bundle price</T>
              <T s={15} color={accent} weight={900}>$97</T>
            </div>
          </div>
          <Btn label="Save 67% →" bg={accent} />
        </div>
      );
    }

    // photo-grid
    if (id === 'photo-grid') {
      if (slide === 0) return (
        <div style={{ ...z, padding: 0 }}>
          {/* 2x2 lifestyle product grid — Pinterest / Etsy style */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: 2, width: '100%', height: '100%' }}>
            {[
              { bg: `linear-gradient(145deg, ${accent}, ${accent}aa)`, label: 'New' },
              { bg: `linear-gradient(145deg, #fbbf24, #f59e0b)`, label: '' },
              { bg: `linear-gradient(145deg, #e2e8f0, #cbd5e1)`, label: '' },
              { bg: `linear-gradient(145deg, ${accent}55, ${accent}22)`, label: '⭐' },
            ].map(({ bg, label }, i) => (
              <div key={i} style={{ background: bg, position: 'relative', display: 'flex', alignItems: 'flex-end', padding: 5 }}>
                {label && (
                  <div style={{ background: 'rgba(0,0,0,0.55)', borderRadius: 3, padding: '1px 5px', position: 'absolute', top: 5, left: 5 }}>
                    <T s={5} color="#fff" weight={700}>{label}</T>
                  </div>
                )}
              </div>
            ))}
          </div>
          {/* Overlay label */}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(255,255,255,0.92)', padding: '6px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <T s={7} color="#0f172a" weight={800}>The Collection</T>
            <T s={7} color={accent} weight={700}>Shop →</T>
          </div>
        </div>
      );
      if (slide === 1) return (
        <div style={{ ...zp(), gap: 6 }}>
          <T s={8} color="#0f172a" weight={800}>Why customers love it</T>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, width: '100%' }}>
            {[['🎨','6 colorways'],['📦','Free shipping'],['⭐','4.9 stars'],['♻','Eco packaging']].map(([e,t],i) => (
              <div key={i} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ fontSize: 13 }}>{e}</div>
                <T s={6.5} color="#334155" weight={600}>{t}</T>
              </div>
            ))}
          </div>
        </div>
      );
      // slide 2 — Cart Card
      return (
        <div style={{ ...zc, gap: 0, padding: 12 }}>
          <div style={{ background:'#fff', borderRadius:10, padding:'10px 12px', width:'90%', boxShadow:'0 6px 24px rgba(0,0,0,0.1)', display:'flex', flexDirection:'column', gap:6 }}>
            <div style={{ height:44, background:`${accent}14`, borderRadius:6, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <T s={7} color={accent} weight={700}>📸 The Collection</T>
            </div>
            <T s={8.5} color="#111" weight={700} align="left">Lifestyle Grid Bundle</T>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <Stars color="#f59e0b" />
              <div style={{ display:'flex', gap:6, alignItems:'baseline' }}>
                <div style={{ textDecoration:'line-through' }}><T s={6} color="#94a3b8">$79</T></div>
                <T s={13} color={accent} weight={900}>$49</T>
              </div>
            </div>
            <div style={{ background:accent, borderRadius:6, padding:'6px 0', textAlign:'center' }}>
              <T s={8} color="#fff" weight={800} align="center">Shop Collection →</T>
            </div>
          </div>
        </div>
      );
    }

    // app-mockup
    if (id === 'app-mockup') {
      if (slide === 0) return (
        <div style={{ ...zc, gap: 8 }}>
          <div style={{ width:60, height:100, border:'2px solid #cbd5e1', borderRadius:14, padding:6, background:'#fff', boxShadow:'0 6px 16px rgba(0,0,0,0.08)' }}>
            <div style={{ background: accent, height:18, borderRadius:3, marginBottom:4 }} />
            <Bar w={'100%'} color="#cbd5e1" h={3} />
            <div style={{ height:3 }} />
            <Bar w={'70%'} color="#cbd5e1" h={3} />
          </div>
        </div>
      );
      if (slide === 1) return (
        <div style={{ ...zp(), gap: 7 }}>
          {['One-tap setup','Sync everywhere','Free forever'].map((t,i) => (
            <Row key={i} gap={6}><Check color={accent} /><T s={8} color="#1e293b">{t}</T></Row>
          ))}
        </div>
      );
      // slide 2 — Cart Card
      return (
        <div style={{ ...zc, gap: 0, padding: 12 }}>
          <div style={{ background:'#fff', borderRadius:10, padding:'10px 12px', width:'90%', boxShadow:'0 6px 24px rgba(0,0,0,0.1)', display:'flex', flexDirection:'column', gap:6 }}>
            <div style={{ height:44, background:`${accent}14`, borderRadius:6, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <div style={{ width:28, height:28, borderRadius:8, background:accent, display:'flex', alignItems:'center', justifyContent:'center' }}>
                <T s={14} color="#fff" weight={900}>📱</T>
              </div>
            </div>
            <T s={8.5} color="#111" weight={700} align="left">App Pro — All Features</T>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <Stars color="#f59e0b" />
              <T s={13} color={accent} weight={900}>Free</T>
            </div>
            <div style={{ background:accent, borderRadius:6, padding:'6px 0', textAlign:'center' }}>
              <T s={8} color="#fff" weight={800} align="center">Download Now →</T>
            </div>
          </div>
        </div>
      );
    }

    // event-card
    if (id === 'event-card') {
      if (slide === 0) return (
        <div style={{ ...zc, gap: 7 }}>
          <div style={{ background: accent, borderRadius:6, padding:'6px 10px', textAlign:'center' }}>
            <T s={6} color="rgba(255,255,255,0.8)" caps spacing="0.1em">May</T>
            <T s={16} color="#fff" weight={900}>15</T>
          </div>
          <T s={11} color="#fff" weight={800} align="center">Free Masterclass</T>
          <T s={7} color="rgba(255,255,255,0.6)">2PM EST · Live</T>
        </div>
      );
      if (slide === 1) return (
        <div style={{ ...zp(), gap: 6 }}>
          <T s={7} color={accent} weight={700} caps spacing="0.1em">You'll learn</T>
          {['How to start fast','The 3-step framework','Live Q&A session'].map((t,i) => (
            <Row key={i} gap={5}><Dot color={accent} /><T s={7} color="#fff">{t}</T></Row>
          ))}
        </div>
      );
      // slide 2 — Value Receipt
      return (
        <div style={{ ...zp('flex-start'), gap: 6 }}>
          <T s={7} color="rgba(255,255,255,0.45)" caps spacing="0.12em">What you get (free)</T>
          <div style={{ width: '100%', border: `1px solid ${accent}33`, borderRadius: 8, overflow: 'hidden' }}>
            {[['Live masterclass','$197 value'],['Replay access','$97 value'],['Q&A session','$49 value']].map(([name,val],i) => (
              <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 10px', borderBottom: i < 2 ? 'rgba(255,255,255,0.07)' : 'none', background: i % 2 === 0 ? 'rgba(255,255,255,0.04)' : 'transparent' }}>
                <T s={7.5} color="rgba(255,255,255,0.7)" weight={500}>{name}</T>
                <T s={7} color="rgba(255,255,255,0.35)">{val}</T>
              </div>
            ))}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'7px 10px', background:`${accent}18`, borderTop:`1px solid ${accent}44` }}>
              <T s={7.5} color="rgba(255,255,255,0.8)" weight={700}>Your cost</T>
              <T s={15} color={accent} weight={900}>$0</T>
            </div>
          </div>
          <Btn label="Save My Seat →" bg={accent} />
        </div>
      );
    }

    // offer-announce
    if (id === 'offer-announce') {
      if (slide === 0) return (
        <div style={{ ...zc, gap: 4 }}>
          <div style={{ fontSize: 38, color:'#fff', fontWeight:900, lineHeight:1 }}>40%</div>
          <T s={11} color="#fff" weight={900} caps spacing="0.05em">Off Everything</T>
          <T s={7} color="rgba(255,255,255,0.7)">Today Only</T>
        </div>
      );
      if (slide === 1) return (
        <div style={{ ...zp('flex-start','center'), gap: 8 }}>
          <T s={8} color="rgba(255,255,255,0.85)" caps spacing="0.1em" weight={700}>Hurry · ends in</T>
          <Row gap={5}>
            {[['09','HRS'],['47','MIN'],['33','SEC']].map(([n,l],i) => (
              <Col key={i} align="center" gap={1}>
                <div style={{ background:'rgba(255,255,255,0.15)', borderRadius:4, padding:'4px 7px' }}><T s={11} color="#fff" weight={900}>{n}</T></div>
                <T s={5} color="rgba(255,255,255,0.7)">{l}</T>
              </Col>
            ))}
          </Row>
        </div>
      );
      // slide 2 — Value Receipt (scarcity flash-sale version)
      return (
        <div style={{ ...zp('flex-start'), gap: 6 }}>
          <T s={7} color="rgba(255,255,255,0.45)" caps spacing="0.12em">Today's offer includes</T>
          <div style={{ width: '100%', border:'1px solid rgba(255,255,255,0.15)', borderRadius: 8, overflow: 'hidden' }}>
            {[['All products','40% off'],['Free shipping','$0'],['Priority access','Included']].map(([name,val],i) => (
              <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 10px', borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.07)' : 'none', background: i % 2 === 0 ? 'rgba(255,255,255,0.06)' : 'transparent' }}>
                <T s={7.5} color="rgba(255,255,255,0.7)" weight={500}>{name}</T>
                <T s={7} color={accent} weight={700}>{val}</T>
              </div>
            ))}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'7px 10px', background:'rgba(255,255,255,0.08)', borderTop:'1px solid rgba(255,255,255,0.15)' }}>
              <T s={7.5} color="rgba(255,255,255,0.8)" weight={700}>Ends midnight</T>
              <T s={13} color="#fff" weight={900}>Tonight only</T>
            </div>
          </div>
          <Btn label="Shop Now →" bg="#fff" color={accent} />
        </div>
      );
    }

    // myth-reality
    if (id === 'myth-reality') {
      if (slide === 0) return (
        <div style={{ ...z, flexDirection:'row' }}>
          <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:8 }}>
            <div style={{ textDecoration:'line-through', textDecorationColor:'#ef4444', textDecorationThickness:2 }}>
              <T s={14} color="#fff" weight={900} caps spacing="0.04em" align="center">Myth</T>
            </div>
          </div>
          <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:8 }}>
            <T s={14} color="#fff" weight={900} caps spacing="0.04em" align="center">Reality</T>
          </div>
        </div>
      );
      if (slide === 1) return (
        <div style={{ ...zp(), gap: 8 }}>
          <Col gap={2}>
            <T s={6} color="rgba(255,255,255,0.6)" caps spacing="0.12em">Myth</T>
            <T s={9} color="#fff" weight={700}>"It takes years to see results."</T>
          </Col>
          <div style={{ height:1, background:'rgba(255,255,255,0.2)', width:'100%' }} />
          <Col gap={2}>
            <T s={6} color="#fff" caps spacing="0.12em" weight={800}>Reality</T>
            <T s={9} color="#fff" weight={800}>Most see change in week 1.</T>
          </Col>
        </div>
      );
      // slide 2 — Tag Someone
      return (
        <div style={{ ...zc, gap: 8, padding: '0 16px' }}>
          <div style={{ fontSize: 28 }}>👇</div>
          <T s={14} color="#fff" weight={900} align="center" spacing="-0.03em">Tag someone still living in the myth.</T>
          <T s={7.5} color="rgba(255,255,255,0.5)" align="center">Save them the hard way of finding out.</T>
        </div>
      );
    }

    // aurora-gradient
    if (id === 'aurora-gradient') {
      if (slide === 0) return (
        <div style={{ ...zc, gap: 8 }}>
          <div style={{ width:50, height:50, borderRadius:'50%', border:'2px solid rgba(255,255,255,0.4)', boxShadow:'0 0 30px rgba(255,255,255,0.3)' }} />
          <T s={14} color="#fff" weight={800} align="center" spacing="-0.02em">The future is here.</T>
        </div>
      );
      if (slide === 1) return (
        <div style={{ ...zp('center','center'), gap: 6 }}>
          {['AI-Powered','Real-Time','Beautiful'].map((t,i) => (
            <div key={i} style={{ background:'rgba(255,255,255,0.18)', backdropFilter:'blur(8px)', borderRadius:20, padding:'5px 14px', border:'1px solid rgba(255,255,255,0.3)' }}>
              <T s={8} color="#fff" weight={700}>{t}</T>
            </div>
          ))}
        </div>
      );
      // slide 2 — Brand Statement
      return (
        <div style={{ ...zc, gap: 10, padding: '0 16px' }}>
          <div style={{ height: 1, background: 'rgba(255,255,255,0.2)', width: 40 }} />
          <T s={8} color="rgba(255,255,255,0.5)" weight={300} align="center" spacing="0.08em" caps>Built for people who</T>
          <T s={14} color="#fff" weight={900} align="center" spacing="-0.03em">see what others can't yet.</T>
          <T s={7} color="rgba(255,255,255,0.35)" align="center">Not for everyone.</T>
        </div>
      );
    }

    // duotone-photo
    if (id === 'duotone-photo') {
      if (slide === 0) return (
        <div style={{ ...zp('flex-start','flex-end'), gap: 5 }}>
          <T s={6} color={accent} caps spacing="0.14em" weight={700}>Editorial</T>
          <T s={14} color="#fff" weight={900} spacing="-0.02em">A new kind of brand.</T>
        </div>
      );
      if (slide === 1) return (
        <div style={{ ...zp(), gap: 7 }}>
          {['Bold by design','Built for scale','Loved by users'].map((t,i) => (
            <Row key={i} gap={5}><div style={{width:3,height:14,background:accent}} /><T s={8} color="#fff" weight={600}>{t}</T></Row>
          ))}
        </div>
      );
      // slide 2 — Brand Statement
      return (
        <div style={{ ...zc, gap: 10, padding: '0 16px' }}>
          <div style={{ height: 2, background: accent, width: 32 }} />
          <T s={8} color="rgba(255,255,255,0.45)" weight={300} align="center" spacing="0.06em" caps>A brand built for</T>
          <T s={13} color="#fff" weight={900} align="center" spacing="-0.03em">people who do bold differently.</T>
          <T s={7} color="rgba(255,255,255,0.35)" align="center">Not for everyone.</T>
          <T s={7.5} color={accent} weight={600} align="center">yourbrand.com</T>
        </div>
      );
    }

    // risograph-print
    if (id === 'risograph-print') {
      if (slide === 0) return (
        <div style={{ ...zc, gap: 6 }}>
          <div style={{ position:'relative' }}>
            <T s={20} color="#ef4444" weight={900} spacing="-0.03em">CRAFTED</T>
            <div style={{ position:'absolute', top: 2, left: 2, mixBlendMode:'multiply' }}>
              <T s={20} color={accent} weight={900} spacing="-0.03em">CRAFTED</T>
            </div>
          </div>
          <T s={8} color="#451a03">By hand. With love.</T>
        </div>
      );
      if (slide === 1) return (
        <div style={{ ...zp(), gap: 7 }}>
          <T s={7} color="#ef4444" caps spacing="0.12em" weight={700}>Artisan made</T>
          {['Small batches','Hand-finished','Numbered editions'].map((t,i) => (
            <T key={i} s={8} color="#451a03" weight={500}>· {t}</T>
          ))}
        </div>
      );
      // slide 2 — Brand Statement
      return (
        <div style={{ ...zc, gap: 8, padding: '0 16px' }}>
          <div style={{ height: 2, background: '#ef4444', width: 28 }} />
          <T s={8} color="#7c2d12" weight={300} align="center" spacing="0.06em" caps>Crafted for people who</T>
          <T s={13} color="#451a03" weight={900} align="center" spacing="-0.02em">still believe handmade matters.</T>
          <T s={7} color="#92400e" align="center">Not for the mass-produced crowd.</T>
        </div>
      );
    }

    // collage-cutout
    if (id === 'collage-cutout') {
      if (slide === 0) return (
        <div style={{ ...zp('flex-start','center'), gap: 4 }}>
          <T s={20} color="#0f172a" weight={900} spacing="-0.04em">BOLD.</T>
          <div style={{ fontSize:14, color: accent, fontWeight:900, letterSpacing:'-0.04em', transform:'rotate(-2deg)' }}>raw.</div>
          <T s={18} color="#0f172a" weight={900} spacing="-0.04em">REAL.</T>
        </div>
      );
      if (slide === 1) return (
        <div style={{ ...zp(), gap: 6 }}>
          <div style={{ background:'#fff', padding:'4px 8px', alignSelf:'flex-start', boxShadow:'2px 2px 0 #0f172a' }}>
            <T s={8} color="#0f172a" weight={800}>No filters</T>
          </div>
          <div style={{ background: accent, padding:'4px 8px', alignSelf:'flex-end' }}>
            <T s={8} color="#fff" weight={800}>No fakery</T>
          </div>
          <div style={{ background:'#fbbf24', padding:'4px 8px', alignSelf:'flex-start' }}>
            <T s={8} color="#0f172a" weight={800}>Just real.</T>
          </div>
        </div>
      );
      // slide 2 — Brand Statement
      return (
        <div style={{ ...zc, gap: 8, padding: '0 16px' }}>
          <div style={{ height: 3, background: '#0f172a', width: 28 }} />
          <T s={8} color="#475569" weight={300} align="center" spacing="0.06em" caps>Made for people who</T>
          <T s={13} color="#0f172a" weight={900} align="center" spacing="-0.03em">refuse to blend in.</T>
          <T s={7} color="#64748b" align="center">BOLD. RAW. REAL.</T>
        </div>
      );
    }

    // video-thumbnail
    if (id === 'video-thumbnail') {
      if (slide === 0) return (
        <div style={{ ...zc, gap: 8 }}>
          <div style={{ width:50, height:50, borderRadius:'50%', background:'#fff', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 6px 20px rgba(0,0,0,0.4)' }}>
            <div style={{ width:0, height:0, borderTop:'9px solid transparent', borderBottom:'9px solid transparent', borderLeft:`14px solid #0a0a0a`, marginLeft:3 }} />
          </div>
          <T s={10} color="#fff" weight={800} align="center">Watch the demo</T>
          <T s={7} color={accent} weight={700}>2.4M views</T>
        </div>
      );
      if (slide === 1) return (
        <div style={{ ...zp(), gap: 6 }}>
          <T s={7} color={accent} weight={700} caps spacing="0.1em">In this video</T>
          {['How it works','Real results','Behind the scenes'].map((t,i) => (
            <Row key={i} gap={5}><div style={{ width:0, height:0, borderTop:'4px solid transparent', borderBottom:'4px solid transparent', borderLeft:`6px solid ${accent}` }} /><T s={7} color="#fff">{t}</T></Row>
          ))}
        </div>
      );
      // slide 2 — Social Proof Stamp
      return (
        <div style={{ ...zc, gap: 7 }}>
          <T s={24} color="#fff" weight={900} align="center" spacing="-0.04em">2.4M</T>
          <T s={7.5} color="rgba(255,255,255,0.55)" align="center">views in 48 hours</T>
          <div style={{ display:'flex', gap:12, alignItems:'center' }}>
            {[['♥','48K'],['💬','2.1K'],['↗','12K']].map(([e,n],i) => (
              <div key={i} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:1 }}>
                <div style={{ fontSize:13 }}>{e}</div>
                <T s={6.5} color="rgba(255,255,255,0.7)" weight={700}>{n}</T>
              </div>
            ))}
          </div>
          <T s={7} color={accent} weight={700} align="center">Link in bio →</T>
        </div>
      );
    }

    // ── testimonial-card ──────────────────────────────────────────────────────
    // Style: clean white card, large quote, rating breakdown like G2/Trustpilot
    if (id === 'testimonial-card') {
      if (slide === 0) return (
        <div style={{ position:'absolute', inset:0, zIndex:1, display:'flex', flexDirection:'column', justifyContent:'center', padding:'12px 14px', gap:6 }}>
          <div style={{ fontSize:32, color:accent, lineHeight:1, fontWeight:900, fontFamily:'Georgia,serif' }}>"</div>
          <T s={9} color="#1e293b" weight={700} align="left" spacing="-0.01em">The best decision I've made for my brand this year.</T>
          <div style={{ height:1, background:'#e2e8f0', width:'100%', marginTop:2 }} />
          <Row gap={7}>
            <div style={{ width:24, height:24, borderRadius:'50%', background:`linear-gradient(135deg,${accent},${accent}88)`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <T s={9} color="#fff" weight={900}>M</T>
            </div>
            <Col gap={1} align="flex-start">
              <T s={7} color="#1e293b" weight={700}>Maya K.</T>
              <Row gap={3}><T s={8} color="#f59e0b">★★★★★</T><T s={6} color="#94a3b8">· Verified</T></Row>
            </Col>
          </Row>
        </div>
      );
      if (slide === 1) return (
        <div style={{ position:'absolute', inset:0, zIndex:1, display:'flex', flexDirection:'column', padding:'10px 14px', gap:5 }}>
          <T s={7} color="#94a3b8" caps spacing="0.12em">Rating breakdown</T>
          {[['Results',5],['Ease of use',5],['Support',4],['Value',5]].map(([label,stars],i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:6 }}>
              <T s={7} color="#475569" weight={500} align="left">{label as string}</T>
              <div style={{ flex:1, height:4, background:'#f1f5f9', borderRadius:2, overflow:'hidden' }}>
                <div style={{ width:`${(stars as number)/5*100}%`, height:'100%', background:accent, borderRadius:2 }} />
              </div>
              <T s={7} color={accent} weight={700}>{(stars as number).toFixed(1)}</T>
            </div>
          ))}
          <div style={{ marginTop:3, background:'#00b67a', borderRadius:4, padding:'3px 8px', alignSelf:'flex-start', display:'flex', gap:4, alignItems:'center' }}>
            <T s={7} color="#fff" weight={800}>★ Trustpilot · Excellent</T>
          </div>
        </div>
      );
      // slide 2 — Social Proof Stamp
      return (
        <div style={{ position:'absolute', inset:0, zIndex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:8 }}>
          <div style={{ display:'flex' }}>
            {['#6366f1','#ec4899','#f59e0b','#22c55e','#0ea5e9'].map((c,i) => (
              <div key={i} style={{ width:22, height:22, borderRadius:'50%', background:c, border:'2px solid #fff', marginLeft: i > 0 ? -7 : 0, zIndex: 5-i }} />
            ))}
          </div>
          <T s={28} color="#1e293b" weight={900} align="center" spacing="-0.03em">10,247</T>
          <T s={8} color="#64748b" align="center">verified 5-star reviews</T>
          <div style={{ display:'flex', gap:3 }}>
            {[1,2,3,4,5].map(i => <T key={i} s={12} color="#f59e0b">★</T>)}
          </div>
          <Btn label="Read All Reviews →" bg={accent} />
        </div>
      );
    }

    // ── versus-slide ──────────────────────────────────────────────────────────
    // Style: cream bg, "DO THIS, NOT THAT" from new carousel ideas reference
    if (id === 'versus-slide') {
      const creamCol = '#1e293b';
      const col2 = { flex:1, display:'flex', flexDirection:'column' as const, gap:3 };
      if (slide === 0) return (
        <div style={{ position:'absolute', inset:0, zIndex:1, display:'flex', flexDirection:'column', padding:'10px 12px', gap:6 }}>
          <T s={11} color={accent} weight={900} spacing="-0.02em" align="left">DO THIS,{'\n'}NOT THAT</T>
          <T s={7} color="#64748b" weight={400}>Point out one common mistake and what to do instead.</T>
          <div style={{ flex:1, display:'flex', flexDirection:'row', gap:8, marginTop:2 }}>
            <div style={{ ...col2, borderRight:'1px solid #d4cfc7', paddingRight:8 }}>
              <T s={6} color="#64748b" caps spacing="0.1em" weight={700}>✓ DO THIS</T>
              {['Pick one mistake','Explain why it fails','Show what works better'].map((t,i) => <T key={i} s={6.5} color={creamCol}>{t}</T>)}
            </div>
            <div style={col2}>
              <T s={6} color="#94a3b8" caps spacing="0.1em" weight={700}>✗ NOT THAT</T>
              {['Most people are wrong','Stop doing this now','It never works'].map((t,i) => <T key={i} s={6.5} color="#94a3b8">{t}</T>)}
            </div>
          </div>
        </div>
      );
      if (slide === 1) return (
        <div style={{ position:'absolute', inset:0, zIndex:1, display:'flex', flexDirection:'column', padding:'10px 12px', gap:5 }}>
          <T s={9} color={accent} weight={900} align="left">HOOK IDEAS:</T>
          {[
            '— Most people do [X], here\'s why I don\'t',
            '— I might get cancelled for this, but…',
            '— I know this isn\'t the usual advice…',
            '— Not everyone will agree with this…',
          ].map((t,i) => <T key={i} s={7} color="#334155" weight={500} align="left">{t}</T>)}
        </div>
      );
      // slide 2 — Save This
      return (
        <div style={{ position:'absolute', inset:0, zIndex:1, display:'flex', flexDirection:'column', padding:'12px 14px', gap:7, justifyContent:'center' }}>
          <T s={7} color="#94a3b8" caps spacing="0.12em">📌 Save this framework</T>
          <div style={{ background:`${accent}0f`, border:`1px solid ${accent}2a`, borderRadius: 8, padding:'10px 12px' }}>
            <T s={8.5} color="#0f172a" weight={700} align="left">The mistake isn't doing the wrong thing — it's doing the right thing too late.</T>
          </div>
          <T s={7} color="#64748b">Bookmark this. It'll hit differently when you need it.</T>
          <T s={7.5} color={accent} weight={700}>Full breakdown at: yourbrand.com →</T>
        </div>
      );
    }

    // ── before-after-slide ────────────────────────────────────────────────────
    // Style: cream bg, structured two-panel "BEFORE AND AFTER" ref
    if (id === 'before-after-slide') {
      const creamDark = '#1e293b';
      if (slide === 0) return (
        <div style={{ position:'absolute', inset:0, zIndex:1, display:'flex', flexDirection:'column', padding:'10px 12px', gap:5 }}>
          <T s={11} color={accent} weight={900} spacing="-0.02em" align="left">BEFORE{'\n'}AND AFTER</T>
          <T s={7} color="#64748b" weight={400}>Show the difference your process or product can make.</T>
          <div style={{ flex:1, display:'flex', flexDirection:'column', gap:3, marginTop:2 }}>
            <div style={{ background:'rgba(0,0,0,0.04)', borderRadius:6, padding:'5px 8px' }}>
              <T s={6} color="#94a3b8" caps spacing="0.1em" weight={700}>BEFORE</T>
              {['Struggling every day','No clear path','Wasted effort'].map((t,i) => <T key={i} s={6.5} color="#64748b">{t}</T>)}
            </div>
            <div style={{ alignSelf:'center', width:18, height:18, borderRadius:'50%', background:accent, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <T s={9} color="#fff" weight={900}>↓</T>
            </div>
            <div style={{ background:`${accent}15`, borderRadius:6, padding:'5px 8px' }}>
              <T s={6} color={accent} caps spacing="0.1em" weight={700}>AFTER</T>
              {['Clear momentum','Real results','Time back'].map((t,i) => <T key={i} s={6.5} color={creamDark} weight={600}>{t}</T>)}
            </div>
          </div>
        </div>
      );
      if (slide === 1) return (
        <div style={{ position:'absolute', inset:0, zIndex:1, display:'flex', flexDirection:'column', padding:'10px 12px', gap:5 }}>
          <T s={9} color={accent} weight={900} align="left">HOOK IDEAS:</T>
          {[
            '— Before vs. after [specific change]',
            '— The difference [your product] can make',
            '— From [situation] to [improved result]',
            '— What happens when you take action',
          ].map((t,i) => <T key={i} s={7} color="#334155" weight={500} align="left">{t}</T>)}
        </div>
      );
      // slide 2 — Chapter Epilogue
      return (
        <div style={{ position:'absolute', inset:0, zIndex:1, display:'flex', flexDirection:'column', padding:'12px 14px 20px', justifyContent:'flex-end', gap:8 }}>
          <div style={{ height:1, background:`${accent}44`, width:'100%' }} />
          <T s={8.5} color={accent} weight={300} align="left" spacing="0.01em">That's the full before and after. The rest is up to you.</T>
          <T s={7.5} color="#64748b" align="left">Most people stop at "before." You don't have to.</T>
          <T s={7.5} color={accent} weight={600}>@brand · link in bio →</T>
        </div>
      );
    }

    // ── press-slide ───────────────────────────────────────────────────────────
    // Style: dark editorial like Shopify/Merriam-Webster — big word, photo bg, red CTA bar
    if (id === 'press-slide') {
      if (slide === 0) return (
        <div style={{ position:'absolute', inset:0, zIndex:1, display:'flex', flexDirection:'column', padding:'12px 14px 32px', justifyContent:'center', gap:6 }}>
          <T s={7} color="rgba(255,255,255,0.45)" caps spacing="0.16em" weight={600}>As Seen In</T>
          <T s={22} color="#ffffff" weight={900} spacing="-0.03em" align="left">Forbes.</T>
          <T s={9} color="rgba(255,255,255,0.55)" weight={400} align="left" spacing="0">
            noun | Featured Product of the Year
          </T>
          <T s={8} color="rgba(255,255,255,0.7)" align="left" weight={500}>"The tool every marketer needs."</T>
        </div>
      );
      if (slide === 1) return (
        <div style={{ position:'absolute', inset:0, zIndex:1, display:'flex', flexDirection:'column', padding:'12px 14px 32px', justifyContent:'center', gap:7 }}>
          <T s={7} color="rgba(255,255,255,0.45)" caps spacing="0.16em">Also featured in</T>
          {[['TechCrunch','#1 Marketing Tool'],['Reuters','Reshaping creative'],['Wired','Built different']].map(([src,q],i) => (
            <div key={i} style={{ borderLeft:`2px solid ${accent}`, paddingLeft:8 }}>
              <T s={7} color={accent} weight={800} caps>{src}</T>
              <T s={7.5} color="rgba(255,255,255,0.8)" weight={500} align="left">"{q}"</T>
            </div>
          ))}
        </div>
      );
      // slide 2 — Social Proof Stamp
      return (
        <div style={{ position:'absolute', inset:0, zIndex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:7, padding:'0 16px' }}>
          <div style={{ display:'flex' }}>
            {['#3b82f6','#f59e0b','#ec4899','#22c55e','#8b5cf6'].map((c,i) => (
              <div key={i} style={{ width:22, height:22, borderRadius:'50%', background:c, border:'2px solid rgba(0,0,0,0.4)', marginLeft: i > 0 ? -7 : 0, zIndex: 5-i }} />
            ))}
          </div>
          <T s={22} color="#fff" weight={900} align="center" spacing="-0.04em">50K+</T>
          <T s={7.5} color="rgba(255,255,255,0.55)" align="center">readers follow our editorial</T>
          <div style={{ display:'flex', gap:6 }}>
            {['Forbes','TC','Wired'].map((b,i) => (
              <div key={i} style={{ background:'rgba(255,255,255,0.12)', padding:'3px 8px', borderRadius:3 }}>
                <T s={6} color="rgba(255,255,255,0.7)" weight={800}>{b}</T>
              </div>
            ))}
          </div>
        </div>
      );
    }

    // ── point-out-slide ───────────────────────────────────────────────────────
    // Style: Merriam-Webster "word of the day" — concept word, definition, red bar CTA
    if (id === 'point-out-slide') {
      if (slide === 0) return (
        <div style={{ position:'absolute', inset:0, zIndex:1, display:'flex', flexDirection:'column', padding:'12px 14px 32px', justifyContent:'center', gap:5 }}>
          <T s={7} color="rgba(255,255,255,0.45)" caps spacing="0.16em">Word of the day</T>
          <div style={{ fontStyle:'italic' }}><T s={20} color="#ffffff" weight={900} spacing="-0.02em" align="left">feature.</T></div>
          <T s={7} color="rgba(255,255,255,0.5)" align="left">noun | FEE-cher</T>
          <div style={{ height:1, background:'rgba(255,255,255,0.12)', width:'100%', marginTop:2 }} />
          <T s={8} color="rgba(255,255,255,0.8)" align="left" weight={400}>a distinctive or notable aspect of a product or service worth highlighting.</T>
        </div>
      );
      if (slide === 1) return (
        <div style={{ position:'absolute', inset:0, zIndex:1, display:'flex', flexDirection:'column', padding:'12px 14px 32px', justifyContent:'flex-start', gap:5 }}>
          <T s={7} color="rgba(255,255,255,0.5)" caps spacing="0.14em">Examples:</T>
          {[
            '"Saves 10 hours a week — for creators like us."',
            '"Works without any code or design skills."',
          ].map((q,i) => (
            <div key={i} style={{ padding:'5px 0' }}>
              <T s={7.5} color="rgba(255,255,255,0.85)" weight={400} align="left">{q}</T>
            </div>
          ))}
        </div>
      );
      // slide 2 — Save This
      return (
        <div style={{ position:'absolute', inset:0, zIndex:1, display:'flex', flexDirection:'column', padding:'12px 14px 24px', gap:7, justifyContent:'center' }}>
          <T s={7} color="rgba(255,255,255,0.45)" caps spacing="0.12em">📌 Word to remember</T>
          <div style={{ background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding:'10px 12px' }}>
            <T s={8.5} color="#fff" weight={700} align="left">The features you highlight tell customers what you think matters. Make them count.</T>
          </div>
          <T s={7} color="rgba(255,255,255,0.4)">Save this. Share it with your team.</T>
          <T s={7.5} color="#dc2626" weight={700}>yourbrand.com →</T>
        </div>
      );
    }

    // ── gallery-slide ─────────────────────────────────────────────────────────
    // Style: Etsy "show off goods" — clean white, product front and center, minimal text
    if (id === 'gallery-slide') {
      if (slide === 0) return (
        <div style={{ position:'absolute', inset:0, zIndex:1, display:'flex', flexDirection:'column', padding:'10px 12px', gap:4 }}>
          <T s={7} color="#94a3b8" caps spacing="0.14em">New Collection</T>
          <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', position:'relative' }}>
            <div style={{ width:70, height:70, borderRadius:12, background:`linear-gradient(135deg,${accent}22,${accent}11)`, border:`1px solid ${accent}33`, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <div style={{ width:40, height:40, borderRadius:8, background:`linear-gradient(135deg,${accent}88,${accent}55)` }} />
            </div>
          </div>
          <T s={9} color="#1e293b" weight={800} align="center" spacing="-0.01em">The Signature Piece</T>
          <T s={7} color="#94a3b8" align="center">Handcrafted · Limited run</T>
        </div>
      );
      if (slide === 1) return (
        <div style={{ position:'absolute', inset:0, zIndex:1, padding:8 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4, height:'100%' }}>
            {[accent,`${accent}cc`,`${accent}99`,`${accent}66`].map((c,i) => (
              <div key={i} style={{ background:`linear-gradient(135deg,${c}22,${c}11)`, border:`1px solid ${c}33`, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center' }}>
                <div style={{ width:28, height:28, borderRadius:5, background:`${c}66` }} />
              </div>
            ))}
          </div>
        </div>
      );
      // slide 2 — Cart Card
      return (
        <div style={{ position:'absolute', inset:0, zIndex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:0, padding:12 }}>
          <div style={{ background:'#fff', borderRadius:10, padding:'10px 12px', width:'90%', boxShadow:'0 6px 24px rgba(0,0,0,0.1)', display:'flex', flexDirection:'column', gap:6 }}>
            <div style={{ height:44, background:`${accent}14`, borderRadius:6, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <T s={7} color={accent} weight={700}>🖼️ The Collection</T>
            </div>
            <T s={8.5} color="#111" weight={700} align="left">Gallery Bundle Pack</T>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <Stars color="#f59e0b" />
              <div style={{ display:'flex', gap:6, alignItems:'baseline' }}>
                <div style={{ textDecoration:'line-through' }}><T s={6} color="#94a3b8">$89</T></div>
                <T s={13} color={accent} weight={900}>$49</T>
              </div>
            </div>
            <div style={{ background:accent, borderRadius:6, padding:'6px 0', textAlign:'center' }}>
              <T s={8} color="#fff" weight={800} align="center">Shop Collection →</T>
            </div>
          </div>
        </div>
      );
    }

    // ── chat-native ───────────────────────────────────────────────────────────
    // Style: authentic iOS chat — real conversation, readable, social-native
    if (id === 'chat-native') {
      const cw: React.CSSProperties = { ...z, background:'#f2f2f7', display:'flex', flexDirection:'column', padding:'8px 10px', gap:5, justifyContent:'flex-start' };
      const hdr = (
        <div style={{ display:'flex', alignItems:'center', gap:6, paddingBottom:5, borderBottom:'1px solid rgba(0,0,0,0.07)', marginBottom:1 }}>
          <div style={{ width:22, height:22, borderRadius:'50%', background:accent, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <T s={8} color="#fff" weight={900}>S</T>
          </div>
          <Col gap={0} align="flex-start">
            <T s={8} color="#1c1c1e" weight={700}>Support</T>
            <T s={6} color="#8e8e93">Active now</T>
          </Col>
        </div>
      );
      if (slide === 0) return (
        <div style={cw}>{hdr}
          <div style={{ alignSelf:'flex-end', background:accent, borderRadius:'16px 16px 4px 16px', padding:'6px 10px', maxWidth:'82%' }}>
            <T s={7.5} color="#fff" weight={500}>Does this actually work?</T>
          </div>
          <div style={{ alignSelf:'flex-start', background:'#fff', borderRadius:'16px 16px 16px 4px', padding:'6px 10px', maxWidth:'86%', boxShadow:'0 1px 3px rgba(0,0,0,0.08)' }}>
            <T s={7.5} color="#1c1c1e" weight={500}>Yes — most users see results in week 1. No joke.</T>
          </div>
          <div style={{ alignSelf:'flex-start', background:'#fff', borderRadius:16, padding:'6px 10px', maxWidth:'60%', boxShadow:'0 1px 3px rgba(0,0,0,0.08)' }}>
            <T s={7.5} color="#1c1c1e" weight={500}>Want to see proof? →</T>
          </div>
        </div>
      );
      if (slide === 1) return (
        <div style={cw}>{hdr}
          <div style={{ alignSelf:'flex-end', background:accent, borderRadius:'16px 16px 4px 16px', padding:'6px 10px', maxWidth:'82%' }}>
            <T s={7.5} color="#fff" weight={500}>What makes it different?</T>
          </div>
          <div style={{ alignSelf:'flex-start', background:'#fff', borderRadius:'16px 16px 16px 4px', padding:'6px 10px', maxWidth:'90%', boxShadow:'0 1px 3px rgba(0,0,0,0.08)' }}>
            <T s={7.5} color="#1c1c1e" weight={500}>It's the only tool built specifically for creators who don't want to spend hours on ads.</T>
          </div>
        </div>
      );
      return (
        <div style={cw}>{hdr}
          <div style={{ alignSelf:'flex-start', background:'#fff', borderRadius:'16px 16px 16px 4px', padding:'8px 10px', maxWidth:'92%', boxShadow:'0 1px 3px rgba(0,0,0,0.08)', display:'flex', flexDirection:'column', gap:6 }}>
            <T s={7.5} color="#1c1c1e" weight={600}>Ready to get started? 🎉</T>
            <div style={{ background:accent, borderRadius:10, padding:'5px 12px', alignSelf:'flex-start' }}>
              <T s={7.5} color="#fff" weight={700}>Try for free →</T>
            </div>
          </div>
        </div>
      );
    }

    // ── offer-drop ────────────────────────────────────────────────────────────
    // Style: Shopify bold story — massive number, neon accent, dark bg, underline decoration
    if (id === 'offer-drop') {
      if (slide === 0) return (
        <div style={{ position:'absolute', inset:0, zIndex:1, display:'flex', flexDirection:'column', padding:'12px 14px', justifyContent:'center', gap:4 }}>
          <T s={7} color="rgba(255,255,255,0.4)" caps spacing="0.16em">limited time</T>
          <div style={{ position:'relative', display:'inline-block' }}>
            <T s={44} color={accent} weight={900} spacing="-0.04em" align="left">40%</T>
            <div style={{ position:'absolute', bottom:4, left:0, right:0, height:3, background:accent, opacity:0.4, borderRadius:2 }} />
          </div>
          <T s={14} color="#ffffff" weight={900} caps spacing="0.02em" align="left">OFF{'\n'}EVERYTHING</T>
          <T s={7} color="rgba(255,255,255,0.5)" align="left">today only</T>
        </div>
      );
      if (slide === 1) return (
        <div style={{ position:'absolute', inset:0, zIndex:1, display:'flex', flexDirection:'column', padding:'12px 14px', justifyContent:'center', gap:6 }}>
          <T s={7} color="rgba(255,255,255,0.4)" caps spacing="0.14em">what you get</T>
          {[['Full access','$199 value'],['Lifetime updates','$99 value'],['1-on-1 setup','$149 value']].map(([n,v],i) => (
            <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'1px solid rgba(255,255,255,0.08)', paddingBottom:4 }}>
              <T s={8} color="rgba(255,255,255,0.8)" weight={500}>{n}</T>
              <T s={7} color={accent} weight={700}>{v}</T>
            </div>
          ))}
          <div style={{ display:'flex', alignItems:'baseline', gap:8, marginTop:4 }}>
            <T s={9} color="rgba(255,255,255,0.3)" weight={600}><s>$447</s></T>
            <T s={22} color="#fff" weight={900} spacing="-0.03em">$97</T>
          </div>
        </div>
      );
      return (
        <div style={{ position:'absolute', inset:0, zIndex:1, display:'flex', flexDirection:'column', padding:'12px 14px', justifyContent:'center', gap:8 }}>
          <T s={7} color="rgba(255,255,255,0.4)" caps spacing="0.14em">offer expires soon</T>
          <T s={16} color="#fff" weight={900} spacing="-0.02em" align="left">Claim your{'\n'}discount.</T>
          <Btn label={`Get 40% Off →`} bg={accent} />
        </div>
      );
    }

    // ── fallback ──────────────────────────────────────────────────────────────
    return (
      <div style={{ ...zc, gap: 8 }}>
        <T s={13} color="#fff" weight={900} align="center" spacing="-0.02em">Ad Template</T>
        <div style={{ background: accent, borderRadius: 8, padding: '7px 18px' }}>
          <T s={8} color="#fff" weight={700}>Use Template →</T>
        </div>
      </div>
    );
  })();

  return (
    <>
      <SlideBg id={id} slide={slide} accent={accent} photoMeta={photoMeta} />
      {content}
    </>
  );
}

// ─── Banner Preview ───────────────────────────────────────────────────────────
// Single-frame static preview — each of the 30 banner templates has its own
// archetype-appropriate layout rendered at ~190×190 (square card thumbnail).

function BannerPreview({ id, tone }: { id: string; tone: string }) {
  const dark  = tone === 'dark'  || tone === 'luxury';
  const light = tone === 'light' || tone === 'minimal' || tone === 'editorial';
  const bg    = dark  ? '#0f1117'
              : light ? '#f8fafc'
              : '#1e1b4b';
  const txt   = dark || (!light) ? '#f1f5f9' : '#1e293b';
  const muted = dark  ? 'rgba(241,245,249,0.4)'
              : light ? 'rgba(30,41,59,0.4)'
              : 'rgba(241,245,249,0.45)';
  const accent = TEMPLATE_ACCENTS[id] ?? (
    tone === 'luxury'  ? '#d4af37' :
    tone === 'urgent'  ? '#ef4444' :
    '#6366f1'
  );

  // Shared inner layout
  const wrap: React.CSSProperties = {
    position: 'absolute', inset: 0,
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    padding: 14, gap: 8,
    background: bg, overflow: 'hidden',
  };

  // ── Real-photo support ───────────────────────────────────────────────────────
  const photoMeta = useTemplatePhoto(id);
  const hasPhoto  = Boolean(photoMeta?.url && PHOTO_TEMPLATE_IDS.has(id));
  // Layer: img + gradient overlay — sits at absolute zIndex 0/1
  const photoLayer = hasPhoto ? (
    <>
      <img
        src={photoMeta!.url} alt=""
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.78, zIndex: 0 }}
        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
      />
      <div style={{ position: 'absolute', inset: 0, background: PHOTO_OVERLAYS[id] ?? 'linear-gradient(rgba(0,0,0,0.3),rgba(0,0,0,0.65))', zIndex: 1 }} />
      {/* Unsplash attribution — required by TOS */}
      <a
        href={photoMeta!.creditUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          position: 'absolute', bottom: 4, right: 6, zIndex: 10,
          fontSize: 6, color: 'rgba(255,255,255,0.55)',
          textDecoration: 'none', textShadow: '0 1px 2px rgba(0,0,0,0.6)',
          whiteSpace: 'nowrap',
        }}
      >
        Photo: {photoMeta!.credit} · Unsplash
      </a>
    </>
  ) : null;
  // Content z-index wrapper for photo templates — ensures text is above photo
  const pz = (extra?: React.CSSProperties): React.CSSProperties =>
    hasPhoto ? { position: 'relative', zIndex: 2, ...extra } : { ...extra };

  // ── full-bleed ──────────────────────────────────────────────────────────────
  if (id === 'full-bleed') return (
    <div style={{ ...wrap, background: hasPhoto ? '#000' : `linear-gradient(135deg, ${accent}, ${accent}cc)`, gap: 6 }}>
      {photoLayer}
      {!hasPhoto && <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.25)' }} />}
      <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        <T s={7} color="rgba(255,255,255,0.7)" align="center" caps spacing="0.12em">Your Brand</T>
        <T s={16} color="#fff" weight={900} align="center" spacing="-0.03em">Stop Scrolling.</T>
        <T s={9} color="rgba(255,255,255,0.75)" align="center">This changes everything.</T>
        <Btn label="Learn More →" bg="rgba(255,255,255,0.2)" color="#fff" border="1px solid rgba(255,255,255,0.5)" />
      </div>
    </div>
  );

  // ── split-panel ─────────────────────────────────────────────────────────────
  if (id === 'split-panel') return (
    <div style={{ ...wrap, flexDirection: 'row', padding: 0, gap: 0 }}>
      <div style={{ flex: 1, height: '100%', background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 10 }}>
        <T s={13} color="#fff" weight={900} align="center" spacing="-0.02em">THE OFFER</T>
      </div>
      <div style={{ flex: 1, height: '100%', background: bg, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', padding: 10, gap: 6 }}>
        <T s={8} color={txt} weight={700}>Save 50%</T>
        <Bar w={60} color={muted} h={2} op={0.5} />
        <T s={7} color={muted}>Limited time only</T>
        <Btn label="Claim →" bg={accent} />
      </div>
    </div>
  );

  // ── bold-headline ───────────────────────────────────────────────────────────
  if (id === 'bold-headline') return (
    <div style={{ ...wrap, background: '#0f1117' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: accent }} />
      <T s={7} color={accent} caps spacing="0.15em" weight={700}>Breaking</T>
      <T s={18} color="#f1f5f9" weight={900} align="center" spacing="-0.04em">THE TRUTH</T>
      <T s={8} color="rgba(241,245,249,0.5)" align="center">Most people get this wrong</T>
      <Btn label="Find Out Why" bg={accent} />
    </div>
  );

  // ── minimal ─────────────────────────────────────────────────────────────────
  if (id === 'minimal') return (
    <div style={{ ...wrap, background: '#fff', gap: 10 }}>
      <div style={{ height: 1, background: '#1e293b', width: 80, opacity: 0.15 }} />
      <T s={14} color="#1e293b" weight={700} align="center" spacing="-0.02em">Less noise.<br/>More signal.</T>
      <div style={{ height: 1, background: '#1e293b', width: 80, opacity: 0.15 }} />
      <T s={8} color="rgba(30,41,59,0.45)" align="center">Simple. Effective. Yours.</T>
      <Btn label="Get Started" bg="#1e293b" color="#fff" />
    </div>
  );

  // ── ugc-style ───────────────────────────────────────────────────────────────
  if (id === 'ugc-style') return (
    <div style={{ ...wrap, background: hasPhoto ? '#e8f0f8' : '#fff', gap: 7, alignItems: 'flex-start' }}>
      {photoLayer}
      <div style={pz({ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 7 })}>
        <Row gap={6}>
          <div style={{ width: 22, height: 22, borderRadius: '50%', background: `linear-gradient(135deg, ${accent}, #f472b6)` }} />
          <Col gap={1}>
            <T s={8} color="#1e293b" weight={700}>@realuser</T>
            <T s={7} color="rgba(30,41,59,0.4)">Sponsored</T>
          </Col>
        </Row>
        <T s={9} color="#1e293b" weight={500}>"I can't believe how much this changed my life in just 30 days."</T>
        <Stars />
        <Btn label="Try It Free" bg={accent} />
      </div>
    </div>
  );

  // ── testimonial ─────────────────────────────────────────────────────────────
  if (id === 'testimonial') return (
    <div style={{ ...wrap, background: '#f8fafc', gap: 8 }}>
      <Stars color={accent} />
      <T s={9} color="#1e293b" weight={600} align="center">"Best decision I ever made for my business."</T>
      <Row gap={6}>
        <div style={{ width: 18, height: 18, borderRadius: '50%', background: `linear-gradient(135deg, ${accent}, #818cf8)` }} />
        <T s={7} color="rgba(30,41,59,0.5)">Sarah K. · CEO</T>
      </Row>
      <Btn label="Read Reviews →" bg={accent} />
    </div>
  );

  // ── stats-hero ──────────────────────────────────────────────────────────────
  if (id === 'stats-hero') return (
    <div style={{ ...wrap, background: '#0f1117' }}>
      <T s={7} color={accent} caps spacing="0.12em" weight={700}>Proven results</T>
      <T s={36} color="#f1f5f9" weight={900} align="center" spacing="-0.05em">10x</T>
      <T s={9} color="rgba(241,245,249,0.55)" align="center">faster than the old way</T>
      <Row gap={12}>
        {['47%','3x','$12K'].map(s => (
          <Col key={s} align="center" gap={1}>
            <T s={10} color={accent} weight={800}>{s}</T>
            <T s={6} color="rgba(241,245,249,0.3)">avg</T>
          </Col>
        ))}
      </Row>
    </div>
  );

  // ── feature-list ────────────────────────────────────────────────────────────
  if (id === 'feature-list') return (
    <div style={{ ...wrap, background: '#f8fafc', alignItems: 'flex-start', gap: 7 }}>
      <T s={10} color="#1e293b" weight={800} spacing="-0.02em">Everything you need</T>
      {['AI-powered copy','Instant exports','30-day guarantee'].map((t, i) => (
        <Row key={i} gap={6}><Check color={accent} /><T s={8} color="#475569" weight={500}>{t}</T></Row>
      ))}
      <Btn label="Start Free Trial" bg={accent} />
    </div>
  );

  // ── cta-final ───────────────────────────────────────────────────────────────
  if (id === 'cta-final') return (
    <div style={{ ...wrap, background: accent, gap: 7 }}>
      <T s={7} color="rgba(255,255,255,0.7)" caps spacing="0.12em">Limited Time Offer</T>
      <T s={15} color="#fff" weight={900} align="center" spacing="-0.02em">50% OFF Today Only</T>
      <T s={8} color="rgba(255,255,255,0.7)" align="center">Ends at midnight</T>
      <Btn label="CLAIM DISCOUNT" bg="#fff" color={accent} />
    </div>
  );

  // ── gradient-pop ────────────────────────────────────────────────────────────
  if (id === 'gradient-pop') return (
    <div style={{ ...wrap, background: 'linear-gradient(135deg, #7c3aed, #db2777)', gap: 8 }}>
      <T s={8} color="rgba(255,255,255,0.7)" align="center">You won't regret this.</T>
      <T s={16} color="#fff" weight={900} align="center" spacing="-0.03em">Don't scroll past.</T>
      <div style={{ height: 2, background: 'rgba(255,255,255,0.35)', width: 50 }} />
      <Btn label="See Why →" bg="rgba(255,255,255,0.15)" color="#fff" border="1px solid rgba(255,255,255,0.4)" />
    </div>
  );

  // ── dark-luxury ─────────────────────────────────────────────────────────────
  if (id === 'dark-luxury') return (
    <div style={{ ...wrap, background: '#090909', gap: 8 }}>
      {photoLayer}
      <div style={pz({ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 })}>
        <div style={{ height: 1, background: '#d4af37', width: 60, opacity: 0.7 }} />
        <T s={7} color="#d4af37" caps spacing="0.2em" weight={600}>Exclusively Yours</T>
        <T s={14} color="#f1f5f9" weight={300} align="center" spacing="0.05em">Luxury redefined.</T>
        <div style={{ height: 1, background: '#d4af37', width: 60, opacity: 0.7 }} />
        <Btn label="Explore" bg="transparent" color="#d4af37" border="1px solid #d4af3755" />
      </div>
    </div>
  );

  // ── bright-minimal ──────────────────────────────────────────────────────────
  if (id === 'bright-minimal') return (
    <div style={{ ...wrap, background: '#fff', gap: 8 }}>
      <div style={{ width: 36, height: 36, borderRadius: '50%', border: `2px solid ${accent}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 14, height: 14, borderRadius: '50%', background: accent }} />
      </div>
      <T s={13} color="#1e293b" weight={700} align="center" spacing="-0.02em">Simply better.</T>
      <T s={8} color="rgba(30,41,59,0.4)" align="center">No fluff. Just results.</T>
      <Btn label="Try Now" bg={accent} />
    </div>
  );

  // ── story-hook ──────────────────────────────────────────────────────────────
  if (id === 'story-hook') return (
    <div style={{ ...wrap, background: '#0f1117', alignItems: 'flex-start', gap: 8 }}>
      {photoLayer}
      <div style={pz({ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8 })}>
        <T s={8} color={accent} weight={700}>A true story →</T>
        <T s={13} color="#f1f5f9" weight={800} spacing="-0.02em">"I made $0 for 3 years."</T>
        <T s={8} color="rgba(241,245,249,0.5)">Then I discovered one thing that changed everything.</T>
        <Btn label="Read Story" bg={accent} />
      </div>
    </div>
  );

  // ── problem-slide ───────────────────────────────────────────────────────────
  if (id === 'problem-slide') return (
    <div style={{ ...wrap, background: '#1e1b4b', alignItems: 'flex-start', gap: 7 }}>
      <T s={7} color="rgba(239,68,68,0.8)" caps spacing="0.1em" weight={700}>The problem</T>
      <T s={11} color="#f1f5f9" weight={800} spacing="-0.02em">Sound familiar?</T>
      {['Wasting hours daily','No clear results','Burning money'].map((t, i) => (
        <Row key={i} gap={5}><Cross /><T s={7} color="rgba(241,245,249,0.6)">{t}</T></Row>
      ))}
      <Btn label="Fix This Now" bg="#ef4444" />
    </div>
  );

  // ── text-only-bold ──────────────────────────────────────────────────────────
  if (id === 'text-only-bold') return (
    <div style={{ ...wrap, background: accent, gap: 6 }}>
      <T s={19} color="#fff" weight={900} align="center" spacing="-0.04em">We need to talk.</T>
      <T s={9} color="rgba(255,255,255,0.7)" align="center">About what you've been missing.</T>
      <Btn label="Keep Reading" bg="rgba(255,255,255,0.15)" color="#fff" border="1px solid rgba(255,255,255,0.3)" />
    </div>
  );

  // ── product-center ──────────────────────────────────────────────────────────
  if (id === 'product-center') return (
    <div style={{ ...wrap, background: hasPhoto ? '#000' : '#f8fafc', gap: 8 }}>
      {photoLayer}
      <div style={pz({ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 })}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: `linear-gradient(135deg, ${accent}, #818cf8)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ width: 16, height: 16, borderRadius: 4, background: 'rgba(255,255,255,0.35)' }} /></div>
        <T s={11} color={hasPhoto ? '#fff' : '#1e293b'} weight={800} align="center" spacing="-0.02em">Power up your workflow</T>
        <Row gap={10}>
          {['Fast','Smart','Safe'].map(f => <T key={f} s={7} color={hasPhoto ? 'rgba(255,255,255,0.7)' : '#475569'} weight={600}>{f}</T>)}
        </Row>
        <Btn label="Try Free" bg={accent} />
      </div>
    </div>
  );

  // ── neon-dark ───────────────────────────────────────────────────────────────
  if (id === 'neon-dark') return (
    <div style={{ ...wrap, background: '#030712', gap: 6 }}>
      {photoLayer}
      <div style={{ position: 'absolute', top: '30%', left: '50%', transform: 'translate(-50%,-50%)', width: 100, height: 100, borderRadius: '50%', background: `${accent}20`, filter: 'blur(25px)', pointerEvents: 'none', zIndex: hasPhoto ? 2 : 0 }} />
      <div style={pz({ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 })}>
        <T s={7} color={accent} caps spacing="0.15em" weight={700}>Next level</T>
        <T s={18} color="#fff" weight={900} align="center" spacing="-0.03em">GLOW UP</T>
        <T s={8} color="rgba(255,255,255,0.45)" align="center">Your brand, amplified.</T>
        <Btn label="Get Access" bg={accent} />
      </div>
    </div>
  );

  // ── magazine-editorial ──────────────────────────────────────────────────────
  if (id === 'magazine-editorial') return (
    <div style={{ ...wrap, background: '#fff', alignItems: 'flex-start', gap: 7 }}>
      {photoLayer}
      <div style={pz({ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 7 })}>
        <Row gap={8}>
          <T s={7} color="#94a3b8" caps spacing="0.12em">Issue 12</T>
          <div style={{ height: 1, background: '#94a3b8', flex: 1, marginTop: 4 }} />
        </Row>
        <T s={13} color="#1e293b" weight={800} spacing="-0.02em">The future of content</T>
        <T s={8} color="#64748b">5 trends reshaping how brands speak.</T>
        <div style={{ height: 1, background: '#e2e8f0', width: '100%' }} />
        <T s={7} color="#94a3b8">Read the full story →</T>
      </div>
    </div>
  );

  // ── color-block ─────────────────────────────────────────────────────────────
  if (id === 'color-block') return (
    <div style={{ ...wrap, padding: 0, flexDirection: 'row', gap: 0 }}>
      <div style={{ flex: 1, height: '100%', background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <T s={22} color="#fff" weight={900} spacing="-0.04em">BOLD.</T>
      </div>
      <div style={{ flex: 1, height: '100%', background: '#f8fafc', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 10 }}>
        <T s={9} color="#1e293b" weight={700} align="center">Stand out from the crowd</T>
        <Btn label="Shop Now" bg={accent} />
      </div>
    </div>
  );

  // ── floating-card ───────────────────────────────────────────────────────────
  if (id === 'floating-card') return (
    <div style={{ ...wrap, background: `linear-gradient(135deg, ${accent}33, #818cf844)` }}>
      <div style={{ background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 12, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 6, width: '85%' }}>
        <T s={7} color="rgba(255,255,255,0.6)" caps spacing="0.1em">Introducing</T>
        <T s={12} color="#fff" weight={800} spacing="-0.02em">Something new</T>
        <T s={8} color="rgba(255,255,255,0.55)">Crafted with care.</T>
        <Btn label="Discover" bg="rgba(255,255,255,0.2)" color="#fff" border="1px solid rgba(255,255,255,0.3)" />
      </div>
    </div>
  );

  // ── countdown-urgency ───────────────────────────────────────────────────────
  if (id === 'countdown-urgency') return (
    <div style={{ ...wrap, background: '#0f1117', gap: 8 }}>
      <T s={8} color="rgba(239,68,68,0.9)" caps spacing="0.1em" weight={700}>Sale ends in</T>
      <Row gap={5}>
        {['00','12','34'].map((t, i) => (
          <React.Fragment key={i}>
            {i > 0 && <T s={12} color="rgba(241,245,249,0.4)" weight={700}>:</T>}
            <div style={{ background: '#1e293b', border: '1px solid rgba(241,245,249,0.1)', borderRadius: 6, padding: '4px 7px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <T s={13} color="#f1f5f9" weight={900}>{t}</T>
            </div>
          </React.Fragment>
        ))}
      </Row>
      <T s={8} color="rgba(241,245,249,0.4)" align="center">Hours · Minutes · Seconds</T>
      <Btn label="Shop Before It's Gone" bg="#ef4444" />
    </div>
  );

  // ── social-proof-grid ───────────────────────────────────────────────────────
  if (id === 'social-proof-grid') return (
    <div style={{ ...wrap, background: '#fff', gap: 8 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4, width: '100%' }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} style={{ height: 18, borderRadius: 4, background: `hsl(${200 + i * 25}, 60%, 80%)`, opacity: 0.7 }} />
        ))}
      </div>
      <T s={12} color="#1e293b" weight={900} align="center" spacing="-0.02em">Join 47,000+ creators</T>
      <Row gap={12}>
        {['10K+','4.9★','99%'].map(s => (
          <Col key={s} align="center" gap={1}><T s={9} color={accent} weight={800}>{s}</T></Col>
        ))}
      </Row>
      <Btn label="Join Now" bg={accent} />
    </div>
  );

  // ── headline-badge ──────────────────────────────────────────────────────────
  if (id === 'headline-badge') return (
    <div style={{ ...wrap, background: '#0f1117', gap: 8 }}>
      <div style={{ background: `${accent}25`, border: `1px solid ${accent}55`, borderRadius: 20, padding: '3px 10px' }}>
        <T s={7} color={accent} weight={700}>✦ New Release</T>
      </div>
      <T s={14} color="#f1f5f9" weight={900} align="center" spacing="-0.02em">The hook that converts</T>
      <T s={8} color="rgba(241,245,249,0.45)" align="center">Scroll-stopping every time.</T>
      <Btn label="See It Live" bg={accent} />
    </div>
  );

  // ── side-by-side ────────────────────────────────────────────────────────────
  if (id === 'side-by-side') return (
    <div style={{ ...wrap, flexDirection: 'row', padding: 0, gap: 0 }}>
      <div style={{ flex: 1, height: '100%', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 10 }}>
        <T s={8} color="#ef4444" weight={700} align="center" caps>Before</T>
        {['Slow','Costly','Stressful'].map((t, i) => (
          <Row key={i} gap={4}><Cross /><T s={7} color="rgba(30,41,59,0.6)">{t}</T></Row>
        ))}
      </div>
      <div style={{ flex: 1, height: '100%', background: `${accent}10`, border: `1px solid ${accent}25`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 10 }}>
        <T s={8} color={accent} weight={700} align="center" caps>After</T>
        {['10x faster','Half the cost','Effortless'].map((t, i) => (
          <Row key={i} gap={4}><Check color={accent} /><T s={7} color="rgba(30,41,59,0.7)">{t}</T></Row>
        ))}
      </div>
    </div>
  );

  // ── diagonal-split ──────────────────────────────────────────────────────────
  if (id === 'diagonal-split') return (
    <div style={{ ...wrap, padding: 0, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, background: '#0f1117' }} />
      <div style={{ position: 'absolute', inset: 0, background: accent, clipPath: 'polygon(0 0, 55% 0, 45% 100%, 0 100%)' }} />
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'row', width: '100%', height: '100%', alignItems: 'center' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <T s={9} color="#fff" weight={900} align="center">BEFORE</T>
          <T s={7} color="rgba(255,255,255,0.6)" align="center">Struggling</T>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <T s={9} color="#f1f5f9" weight={900} align="center">AFTER</T>
          <T s={7} color="rgba(241,245,249,0.55)" align="center">Thriving</T>
        </div>
      </div>
    </div>
  );

  // ── overlay-card ────────────────────────────────────────────────────────────
  if (id === 'overlay-card') return (
    <div style={{ ...wrap, background: hasPhoto ? '#000' : `linear-gradient(180deg, ${accent}66, ${accent}dd)`, justifyContent: 'flex-end', padding: 0 }}>
      {photoLayer}
      {!hasPhoto && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '60%', background: `${accent}44` }} />}
      <div style={{ width: '100%', background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(10px)', borderTop: '1px solid rgba(255,255,255,0.2)', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 5, position: 'relative', zIndex: 2 }}>
        <T s={10} color="#fff" weight={800}>Ready to transform?</T>
        <T s={7} color="rgba(255,255,255,0.65)">Join thousands already inside.</T>
        <Btn label="Get Access Now" bg="#fff" color={accent} />
      </div>
    </div>
  );

  // ── number-list ─────────────────────────────────────────────────────────────
  if (id === 'number-list') return (
    <div style={{ ...wrap, background: '#f8fafc', alignItems: 'flex-start', gap: 7 }}>
      <T s={10} color="#1e293b" weight={800} spacing="-0.02em">3 steps to success</T>
      {['Discover your angle','Build in minutes','Launch & grow'].map((t, i) => (
        <Row key={i} gap={8}>
          <div style={{ width: 18, height: 18, borderRadius: '50%', background: accent, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <T s={8} color="#fff" weight={800}>{i + 1}</T>
          </div>
          <T s={8} color="#475569" weight={500}>{t}</T>
        </Row>
      ))}
      <Btn label="Start Now" bg={accent} />
    </div>
  );

  // ── brand-manifesto ─────────────────────────────────────────────────────────
  if (id === 'brand-manifesto') return (
    <div style={{ ...wrap, background: '#0f1117', gap: 8 }}>
      <div style={{ height: 1, background: accent, width: 40, opacity: 0.6 }} />
      <T s={10} color="rgba(241,245,249,0.4)" align="center" spacing="0.02em">"We believe in building</T>
      <T s={13} color="#f1f5f9" weight={800} align="center" spacing="-0.02em">something real.</T>
      <T s={10} color="rgba(241,245,249,0.4)" align="center">Not just another product."</T>
      <div style={{ height: 1, background: accent, width: 40, opacity: 0.6 }} />
    </div>
  );

  // ── product-demo ────────────────────────────────────────────────────────────
  if (id === 'product-demo') return (
    <div style={{ ...wrap, background: '#f8fafc', gap: 8 }}>
      <div style={{ width: '85%', background: '#1e293b', borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ background: '#334155', padding: '4px 8px', display: 'flex', gap: 4 }}>
          {['#ef4444','#fbbf24','#22c55e'].map(c => <div key={c} style={{ width: 6, height: 6, borderRadius: '50%', background: c }} />)}
        </div>
        <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ height: 4, background: `${accent}44`, borderRadius: 2, width: '80%' }} />
          <div style={{ height: 3, background: 'rgba(255,255,255,0.1)', borderRadius: 2, width: '60%' }} />
        </div>
      </div>
      <T s={9} color="#1e293b" weight={700} align="center">See it in action</T>
      <Btn label="Watch Demo" bg={accent} />
    </div>
  );

  // ── retro-bold ──────────────────────────────────────────────────────────────
  if (id === 'retro-bold') return (
    <div style={{ ...wrap, background: '#fef3c7', gap: 8 }}>
      <div style={{ border: '3px solid #1e293b', borderRadius: 4, padding: '4px 12px', transform: 'rotate(-2deg)', background: '#fff' }}>
        <T s={8} color="#1e293b" weight={900} caps spacing="0.1em">Est. 2024</T>
      </div>
      <T s={15} color="#1e293b" weight={900} align="center" spacing="-0.02em">Old School.<br/>New Results.</T>
      <div style={{ height: 3, background: '#1e293b', width: 60 }} />
      <Btn label="Shop Now" bg="#1e293b" color="#fef3c7" />
    </div>
  );

  // ── offer-stack ──────────────────────────────────────────────────────────────
  if (id === 'offer-stack') return (
    <div style={{ ...wrap, flexDirection: 'row', background: 'linear-gradient(135deg,#450a0a,#991b1b)', padding: 0 }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 3, padding: 16 }}>
        <T s={7} color={accent} caps spacing="0.1em">Today Only</T>
        <T s={16} color="#fff" weight={900} spacing="-0.04em">50% Off Everything</T>
        <T s={8} color="rgba(255,255,255,0.55)">Auto-applied at checkout. No code needed.</T>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', padding: '0 18px' }}>
        <Btn label="Claim Offer →" bg={accent} color="#fff" />
      </div>
    </div>
  );

  // ── value-math ───────────────────────────────────────────────────────────────
  if (id === 'value-math') return (
    <div style={{ ...wrap, flexDirection: 'row', background: 'linear-gradient(135deg,#020617,#0c1a3a)', padding: '0 16px', gap: 14 }}>
      <Row gap={8}>
        <div style={{ textDecoration: 'line-through', color: 'rgba(255,255,255,0.3)', fontSize: 14, fontWeight: 700 }}>$299</div>
        <T s={9} color="rgba(255,255,255,0.4)">→</T>
        <T s={22} color={accent} weight={900} spacing="-0.03em">$97</T>
      </Row>
      <div style={{ width: 1, background: 'rgba(255,255,255,0.1)', alignSelf: 'stretch', marginBlock: 6 }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <T s={9} color="#fff" weight={700}>Same results. Lower cost.</T>
        <T s={7.5} color="rgba(255,255,255,0.45)">Save $202 every single month.</T>
      </div>
      <Btn label="Switch Now →" bg={accent} color="#fff" />
    </div>
  );

  // ── case-study ───────────────────────────────────────────────────────────────
  if (id === 'case-study') return (
    <div style={{ ...wrap, flexDirection: 'row', background: '#fff', padding: '0 16px', gap: 12 }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: accent }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <T s={7} color={accent} caps spacing="0.08em">Case Study</T>
        <T s={11} color={txt} weight={800} spacing="-0.02em">Acme Corp grew 340% in 60 days.</T>
        <T s={7.5} color={muted}>From 200 to 880 qualified leads per month.</T>
      </div>
      <Btn label="Read Story →" bg={accent} color="#fff" />
    </div>
  );

  // ── insight-frame ─────────────────────────────────────────────────────────────
  if (id === 'insight-frame') return (
    <div style={{ ...wrap, flexDirection: 'row', background: '#fff', padding: '0 0 0 16px', gap: 12 }}>
      <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 3, background: accent }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <T s={7} color={accent} caps spacing="0.08em">Insight</T>
        <T s={10} color={txt} weight={800} spacing="-0.02em">The real reason results aren't compounding.</T>
        <T s={7.5} color={muted}>3-step framework. Free breakdown.</T>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', padding: '0 16px 0 0' }}>
        <Btn label="Get It Free →" bg={accent} color="#fff" />
      </div>
    </div>
  );

  // ── pain-diagnostic ───────────────────────────────────────────────────────────
  if (id === 'pain-diagnostic') return (
    <div style={{ ...wrap, flexDirection: 'row', background: 'linear-gradient(135deg,#0a0a0f,#1a0a1a)', padding: '0 16px', gap: 12 }}>
      <div style={{ background: 'rgba(244,63,94,0.15)', border: '1px solid rgba(244,63,94,0.4)', borderRadius: 6, padding: '4px 10px', flexShrink: 0 }}>
        <T s={7} color="#f43f5e" caps spacing="0.08em">Diagnose</T>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <T s={10} color="#f1f5f9" weight={800} spacing="-0.02em">Does this sound familiar?</T>
        <T s={7.5} color="rgba(241,245,249,0.45)">If yes — there's a better way. Keep reading.</T>
      </div>
      <Btn label="See The Fix →" bg={accent} color="#fff" />
    </div>
  );

  // ── mistake-alert ─────────────────────────────────────────────────────────────
  if (id === 'mistake-alert') return (
    <div style={{ ...wrap, flexDirection: 'row', background: 'linear-gradient(135deg,#1c0505,#431407)', padding: 0 }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: '#f97316' }} />
      <div style={{ background: '#f97316', padding: '0 16px', display: 'flex', alignItems: 'center', alignSelf: 'stretch' }}>
        <T s={9} color="#fff" weight={900} caps>⚠ Warning</T>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, padding: '0 14px' }}>
        <T s={10} color="#fff1ee" weight={800} spacing="-0.02em">3 mistakes killing your results.</T>
        <T s={7.5} color="rgba(255,241,238,0.5)">Most people make all of them without knowing.</T>
      </div>
      <div style={{ padding: '0 16px 0 0', display: 'flex', alignItems: 'center' }}>
        <Btn label="Avoid Them →" bg="#f97316" color="#fff" />
      </div>
    </div>
  );

  // ── empathy-card ─────────────────────────────────────────────────────────────
  if (id === 'empathy-card') return (
    <div style={{ ...wrap, flexDirection: 'row', background: 'linear-gradient(135deg,#fff7f0,#fce7f3)', padding: '0 16px', gap: 12 }}>
      <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'linear-gradient(135deg,#ec4899,#a78bfa)', flexShrink: 0 }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <T s={10} color="#3b0764" weight={800} spacing="-0.02em">You deserve to feel this.</T>
        <T s={7.5} color="#7c3aed">Not eventually. Starting today.</T>
      </div>
      <Btn label="Begin Now →" bg={accent} color="#fff" />
    </div>
  );

  // ── validation-card ───────────────────────────────────────────────────────────
  if (id === 'validation-card') return (
    <div style={{ ...wrap, flexDirection: 'row', background: 'linear-gradient(135deg,#f5f3ff,#ede9fe)', padding: '0 16px', gap: 12 }}>
      <div style={{ display: 'flex', gap: 0, flexShrink: 0 }}>
        {['#a78bfa','#818cf8','#6366f1'].map((c,i) => (
          <div key={i} style={{ width: 22, height: 22, borderRadius: '50%', background: c, border: '2px solid #f5f3ff', marginLeft: i > 0 ? -7 : 0 }} />
        ))}
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <T s={10} color="#2e1065" weight={800} spacing="-0.02em">14,000+ people feel exactly the same.</T>
        <T s={7.5} color="#6d28d9">You're not broken. Join the community.</T>
      </div>
      <Btn label="Join Free →" bg={accent} color="#fff" />
    </div>
  );

  // ── do-dont ───────────────────────────────────────────────────────────────────
  if (id === 'do-dont') return (
    <div style={{ ...wrap, flexDirection: 'row', background: '#fff', padding: 0, gap: 0 }}>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, padding: 14, background: '#fff5f5' }}>
        <T s={11} color="#ef4444" weight={900}>✕</T>
        <Col gap={2}>
          <T s={7} color="#ef4444" caps spacing="0.06em" weight={700}>Don't</T>
          <T s={9} color="#374151" weight={600}>Guess and hope it works</T>
        </Col>
      </div>
      <div style={{ width: 1, background: '#e2e8f0', flexShrink: 0 }} />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, padding: 14, background: '#f0fdf4' }}>
        <T s={11} color="#16a34a" weight={900}>✓</T>
        <Col gap={2}>
          <T s={7} color="#16a34a" caps spacing="0.06em" weight={700}>Do</T>
          <T s={9} color="#374151" weight={600}>Follow a proven system</T>
        </Col>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', padding: '0 14px 0 10px' }}>
        <Btn label="Get The System →" bg="#16a34a" color="#fff" />
      </div>
    </div>
  );

  // ── transform-split ───────────────────────────────────────────────────────────
  if (id === 'transform-split') return (
    <div style={{ ...wrap, flexDirection: 'row', background: '#fff', padding: 0, gap: 0 }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 3, padding: 14, background: 'linear-gradient(135deg,#1e293b,#334155)' }}>
        <T s={7} color="rgba(255,255,255,0.4)" caps spacing="0.1em">Before</T>
        <T s={9} color="rgba(255,255,255,0.6)" weight={600}>Struggling. No clear path.</T>
      </div>
      <div style={{ width: 24, background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 10, color: '#fff', fontWeight: 900 }}>→</div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 3, padding: 14, background: 'linear-gradient(135deg,#042f2e,#0f766e)' }}>
        <T s={7} color={accent} caps spacing="0.1em">After</T>
        <T s={9} color="#fff" weight={600}>Clear momentum. Real growth.</T>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', padding: '0 14px 0 0', background: 'linear-gradient(135deg,#042f2e,#0f766e)' }}>
        <Btn label="Start Transforming →" bg={accent} color="#fff" />
      </div>
    </div>
  );

  if (id === 'photo-reveal') return (
    <div style={{ ...wrap, background: '#111', justifyContent: 'flex-end', alignItems: 'stretch', padding: 0, gap: 0 }}>
      {/* Simulated photo */}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(160deg,#1c1917 0%,#292524 40%,#44403c 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 56, height: 56, borderRadius: 8, background: 'rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 24, height: 18, border: '2px solid rgba(255,255,255,0.2)', borderRadius: 3 }} />
        </div>
      </div>
      {/* Bottom gradient + label */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.6) 50%, transparent 100%)', padding: '22px 12px 12px' }}>
        <div style={{ fontSize: 13, fontWeight: 900, color: accent, textTransform: 'uppercase', letterSpacing: '-0.01em', lineHeight: 1.1, textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>
          PHOTO REVEAL
        </div>
        <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          your photo · bold label
        </div>
      </div>
    </div>
  );

  // fallback for any unmapped id
  return (
    <div style={{ ...wrap, gap: 8 }}>
      <T s={12} color={txt} weight={800} align="center" spacing="-0.02em">Ad Template</T>
      <Bar w={60} color={accent} h={3} />
      <Btn label="Use Template" bg={accent} />
    </div>
  );
}

function CarouselSlidePreview({ id, tone }: { id: string; tone: string }) {
  const [paused, setPaused] = useState(false);
  const { slide, fading }   = useGlobalSlide(paused);

  // photo-reveal uses static Fallback preview (user photos, not Unsplash)
  if (id === 'photo-reveal') {
    return <Fallback id={id} tone={tone} />;
  }

  const style    = TEMPLATE_STYLES[id] ?? { bg: 'linear-gradient(135deg,#1c1917,#292524)', light: false };
  const txt      = style.light ? '#1e293b' : '#ffffff';
  const muted    = style.light ? 'rgba(30,41,59,0.4)' : 'rgba(255,255,255,0.4)';
  const accent   = TEMPLATE_ACCENTS[id] ?? TONE_ACCENTS[tone] ?? '#4f46e5';
  const dotBase  = style.light ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.25)';
  const photoMeta = useTemplatePhoto(id);

  return (
    <div
      style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Full-bleed slide — crossfades */}
      <div style={{ opacity: fading ? 0 : 1, transition: 'opacity 0.25s ease', position: 'absolute', inset: 0 }}>
        {slide === 0 && <TemplateSlide id={id} slide={0} txt={txt} muted={muted} accent={accent} photoMeta={photoMeta} />}
        {slide === 1 && <TemplateSlide id={id} slide={1} txt={txt} muted={muted} accent={accent} photoMeta={photoMeta} />}
        {slide === 2 && <TemplateSlide id={id} slide={2} txt={txt} muted={muted} accent={accent} photoMeta={photoMeta} />}
      </div>

      {/* Instagram-native progress dots */}
      <div style={{ position: 'absolute', bottom: 7, left: 0, right: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 3, zIndex: 10 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ height: 4, borderRadius: 2, background: '#fff', width: i === slide ? 12 : 4, opacity: i === slide ? 0.95 : 0.35, transition: 'all 0.3s ease', boxShadow: '0 1px 3px rgba(0,0,0,0.4)' }} />
        ))}
      </div>
    </div>
  );
}

// ─── Template Card ────────────────────────────────────────────────────────────

function TemplateCard({ template, selected, onClick, preview }: {
  template: TemplateMetadata;
  selected: boolean;
  onClick:  () => void;
  preview?: React.ReactNode;
}) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError]   = useState(false);
  const [hovered,  setHovered]    = useState(false);

  return (
    <div
      role="button" tabIndex={0} aria-label={`Select ${template.name} template`}
      onClick={onClick} onKeyDown={e => e.key === 'Enter' && onClick()}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{
        borderRadius: 12,
        border:       `2px solid ${selected ? '#4f46e5' : hovered ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)'}`,
        cursor:       'pointer', overflow: 'hidden', transition: 'border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease',
        transform:    hovered ? 'translateY(-4px) scale(1.02)' : 'none',
        boxShadow:    selected
          ? '0 0 0 3px rgba(79,70,229,0.35), 0 8px 24px rgba(0,0,0,0.5)'
          : hovered ? '0 12px 32px rgba(0,0,0,0.4)' : '0 2px 8px rgba(0,0,0,0.2)',
        background:   'var(--surface-2)',
        position:     'relative',
      }}
    >
      {/* Thumbnail */}
      <div style={{ position: 'relative', aspectRatio: '1 / 1', overflow: 'hidden' }}>

        {preview ? (
          /* Animated preview (carousel) — no PNG fallback needed */
          <div style={{ position: 'absolute', inset: 0 }}>{preview}</div>
        ) : (
          /* Static fallback + optional PNG */
          <>
            <div style={{ position: 'absolute', inset: 0, display: imgLoaded ? 'none' : 'flex' }}>
              <Fallback id={template.id} tone={template.tones[0] ?? 'bold'} />
            </div>
            {!imgError && (
              <img
                src={`/templates/${template.id}.png`}
                alt={template.name}
                onLoad={() => setImgLoaded(true)}
                onError={() => setImgError(true)}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', opacity: imgLoaded ? 1 : 0, transition: 'opacity 0.2s' }}
              />
            )}
          </>
        )}

        {/* Selected check */}
        {selected && (
          <div style={{ position: 'absolute', top: 8, right: 8, width: 22, height: 22, borderRadius: '50%', background: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(79,70,229,0.5)', zIndex: 2 }}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M2 5l2.5 2.5 4-4" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        )}

        {/* IMG badge — only on static cards */}
        {!preview && template.requiresImage && (
          <div style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', borderRadius: 4, padding: '2px 6px', fontSize: 9, fontWeight: 700, color: '#fbbf24', letterSpacing: '0.06em', zIndex: 2 }}>
            IMG
          </div>
        )}

        {/* Hover overlay */}
        {hovered && !selected && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(2px)', zIndex: 3 }}>
            <div style={{ background: '#4f46e5', color: '#fff', fontSize: 12, fontWeight: 700, padding: '9px 20px', borderRadius: 8, letterSpacing: '0.03em', boxShadow: '0 4px 16px rgba(79,70,229,0.5)' }}>
              Use Template
            </div>
          </div>
        )}
      </div>

      {/* Footer — name only */}
      <div style={{ padding: '9px 12px 11px' }}>
        <div style={{ fontWeight: 700, fontSize: 12, color: selected ? '#a5b4fc' : 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {template.name}
        </div>
      </div>
    </div>
  );
}

// ─── Skip card ────────────────────────────────────────────────────────────────

function SkipCard({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      role="button" tabIndex={0} aria-label="Skip template — let AI choose"
      onClick={onClick} onKeyDown={e => e.key === 'Enter' && onClick()}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{ borderRadius: 12, border: `2px dashed ${hovered ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)'}`, cursor: 'pointer', overflow: 'hidden', transition: 'all 0.18s ease', transform: hovered ? 'translateY(-4px)' : 'none', background: hovered ? 'rgba(255,255,255,0.03)' : 'transparent' }}
    >
      <div style={{ aspectRatio: '1 / 1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 }}>
        <div style={{ fontSize: 30, opacity: 0.35 }}>✦</div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)', marginBottom: 4 }}>AI Auto-Select</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.5 }}>Let AI pick the best template per slide based on your brief</div>
        </div>
      </div>
      <div style={{ padding: '9px 12px 11px' }}>
        <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>AI Auto-Select</div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

// ─── Shared library props ─────────────────────────────────────────────────────

export interface LibraryProps {
  templates: TemplateMetadata[];
  onSelect:  (templateId: string) => void;
}

// ─── Shared sidebar + grid body (used by both library components) ─────────────

function LibraryBody({
  templates,
  label,
  subtitle,
  selected,
  onSelect,
  renderPreview,
}: {
  templates:      TemplateMetadata[];
  label:          string;
  subtitle:       string;
  selected:       string;
  onSelect:       (id: string) => void;
  renderPreview?: (t: TemplateMetadata) => React.ReactNode;
}) {
  const [category, setCategory] = useState<Category>('all');

  const visible = category === 'all'
    ? templates
    : templates.filter(t => CATEGORY_IDS[category].includes(t.id));

  function handleCategoryChange(cat: Category) {
    setCategory(cat);
  }

  return (
    <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>

      {/* ── LEFT SIDEBAR ──────────────────────────────────────────────────── */}
      <aside style={{
        width: 200, flexShrink: 0,
        borderRight: '1px solid rgba(255,255,255,0.07)',
        padding: '28px 16px',
        display: 'flex', flexDirection: 'column', gap: 2,
        position: 'sticky', top: 49, alignSelf: 'flex-start',
        maxHeight: 'calc(100vh - 49px)', overflowY: 'auto',
      }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10, paddingLeft: 10 }}>
          Category
        </div>
        {CATEGORIES.map(cat => {
          const isActive = category === cat.id;
          const catCount = cat.id === 'all'
            ? templates.length
            : CATEGORY_IDS[cat.id].filter(id => templates.some(t => t.id === id)).length;
          return (
            <button
              key={cat.id}
              onClick={() => handleCategoryChange(cat.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 9,
                padding: '8px 10px', borderRadius: 8, border: 'none',
                fontFamily: 'inherit', cursor: 'pointer', transition: 'all 0.13s',
                background: isActive ? 'rgba(79,70,229,0.18)' : 'transparent',
                color: isActive ? '#a5b4fc' : 'rgba(255,255,255,0.5)',
                fontSize: 13, fontWeight: isActive ? 700 : 500,
                width: '100%', textAlign: 'left',
              }}
            >
              <span style={{ flex: 1 }}>{cat.label}</span>
              <span style={{ fontSize: 10, color: isActive ? '#6366f1' : 'rgba(255,255,255,0.2)', fontWeight: 600 }}>{catCount}</span>
            </button>
          );
        })}
      </aside>

      {/* ── RIGHT GRID ────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, padding: '28px 32px 60px', overflowY: 'auto' }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.15 }}>
            {label}
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>{subtitle}</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 16 }}>
          <SkipCard onClick={() => onSelect('')} />
          {visible.map(t => (
            <TemplateCard
              key={t.id}
              template={t}
              selected={selected === t.id}
              onClick={() => onSelect(t.id)}
              preview={renderPreview ? renderPreview(t) : undefined}
            />
          ))}
          {visible.length === 0 && (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px 0', color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>
              No templates in this category yet
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Carousel Library ─────────────────────────────────────────────────────────

export function CarouselLibrary({ templates, onSelect }: LibraryProps) {
  const [selected, setSelected] = useState('');

  function handleSelect(id: string) {
    setSelected(id);
    setTimeout(() => onSelect(id), 180);
  }

  return (
    <LibraryBody
      templates={templates}
      label="Carousel Templates"
      subtitle="Multi-slide formats — AI fills in copy and images per slide."
      selected={selected}
      onSelect={handleSelect}
      renderPreview={t => (
        <CarouselSlidePreview id={t.id} tone={t.tones[0] ?? 'bold'} />
      )}
    />
  );
}

// ─── Banner Library ───────────────────────────────────────────────────────────

export function BannerLibrary({ templates, onSelect }: LibraryProps) {
  const [selected, setSelected] = useState('');

  function handleSelect(id: string) {
    setSelected(id);
    setTimeout(() => onSelect(id), 180);
  }

  return (
    <LibraryBody
      templates={templates}
      label="Banner Templates"
      subtitle="Static display ads — AI generates copy and imagery for every size."
      selected={selected}
      onSelect={handleSelect}
      renderPreview={t => (
        <BannerPreview id={t.id} tone={t.tones[0] ?? 'bold'} />
      )}
    />
  );
}

// ─── TemplateGallery (format router) ─────────────────────────────────────────
// Owns format tabs and delegates to CarouselLibrary / BannerLibrary / Video CTA.

export function TemplateGallery({ templates, onSelect, defaultFormat = 'carousel' }: Props) {
  const [format, setFormat] = useState<GalleryFormat>(defaultFormat);

  function handleFormatChange(f: GalleryFormat) {
    setFormat(f);
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, color: 'var(--text, #f1f5f9)' }}>

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div style={{
        padding: '10px 32px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 20,
        background: 'var(--surface)', backdropFilter: 'blur(14px)',
        position: 'sticky', top: 0, zIndex: 10, flexShrink: 0,
      }}>
        <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: '-0.01em', color: 'var(--text)', flexShrink: 0 }}>Template Library</span>
        <div style={{ width: 1, height: 16, background: 'var(--border)', flexShrink: 0 }} />

        {/* Format tabs */}
        <div style={{ display: 'flex', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 9, padding: 3, gap: 2 }}>
          {(['carousel','image','video'] as GalleryFormat[]).map(f => (
            <button key={f} onClick={() => handleFormatChange(f)}
              style={{ padding: '5px 15px', borderRadius: 6, border: 'none', fontFamily: 'inherit', fontWeight: 700, fontSize: 12, cursor: 'pointer', transition: 'all 0.13s', background: format === f ? 'var(--indigo)' : 'transparent', color: format === f ? '#fff' : 'var(--muted)' }}>
              {f === 'carousel' ? '⊞ Carousel' : f === 'image' ? '⬜ Banner' : '▶ Video'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Format views ────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>

        {format === 'carousel' && (
          <CarouselLibrary
            templates={templates}
            onSelect={id => onSelect(id, 'carousel')}
          />
        )}

        {format === 'image' && (
          <BannerLibrary
            templates={templates}
            onSelect={id => onSelect(id, 'image')}
          />
        )}

        {format === 'video' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 20, padding: '60px 32px' }}>
            <div style={{ fontSize: 52 }}>🎬</div>
            <div style={{ textAlign: 'center', maxWidth: 440 }}>
              <div style={{ fontWeight: 800, fontSize: 20, marginBottom: 10 }}>AI-Directed Video</div>
              <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>
                The engine auto-selects the best visual style, pacing, and text overlays per scene based on your brief, goal, and platform.
              </div>
            </div>
            <button
              onClick={() => onSelect('', 'video')}
              style={{ padding: '13px 32px', borderRadius: 10, border: 'none', fontFamily: 'inherit', fontWeight: 800, fontSize: 14, cursor: 'pointer', background: '#4f46e5', color: '#fff', boxShadow: '0 4px 20px rgba(79,70,229,0.45)', letterSpacing: '-0.01em' }}
            >
              Start Creating Video →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
