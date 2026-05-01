'use client';

// ─── TemplateGallery ──────────────────────────────────────────────────────────
// Full-page template picker shown as the first screen when creating a new ad.

import React, { useState, useEffect, useRef } from 'react';
import type { TemplateMetadata } from '@/lib/api/creator-client';

export type GalleryFormat = 'carousel' | 'image' | 'video';
type Category = 'all' | 'bold' | 'minimal' | 'story' | 'social' | 'product' | 'urgent';

interface Props {
  templates:     TemplateMetadata[];
  onSelect:      (templateId: string, format: GalleryFormat) => void;
  defaultFormat?: GalleryFormat;
}

const CATEGORIES: { id: Category; label: string; icon: string }[] = [
  { id: 'all',     label: 'All Templates', icon: '⊞' },
  { id: 'bold',    label: 'Bold',          icon: '⚡' },
  { id: 'minimal', label: 'Minimal',       icon: '◻' },
  { id: 'story',   label: 'Story',         icon: '✦' },
  { id: 'social',  label: 'Social Proof',  icon: '★' },
  { id: 'product', label: 'Product',       icon: '◈' },
  { id: 'urgent',  label: 'Urgent',        icon: '◎' },
];

const CATEGORY_IDS: Record<Category, string[]> = {
  all:     [],
  bold:    ['full-bleed','bold-headline','gradient-pop','diagonal-split','neon-dark','retro-bold','color-block','headline-badge'],
  minimal: ['minimal','bright-minimal','text-only-bold','side-by-side'],
  story:   ['story-hook','problem-slide','brand-manifesto','ugc-style','magazine-editorial'],
  social:  ['testimonial','social-proof-grid','stats-hero'],
  product: ['product-center','product-demo','floating-card','feature-list','number-list','split-panel','overlay-card'],
  urgent:  ['cta-final','countdown-urgency','dark-luxury'],
};

// ─── Per-template mini preview fallbacks ─────────────────────────────────────
// Each returns a distinct CSS-only layout that visually represents the template.

function Fallback({ id, tone }: { id: string; tone: string }) {
  const isLight = ['minimal','bright-minimal','feature-list','floating-card','product-demo','magazine-editorial','split-panel','side-by-side'].includes(id);
  const bg    = isLight ? '#f8fafc' : '#0f172a';
  const text  = isLight ? '#1e293b' : '#f1f5f9';
  const muted = isLight ? '#64748b' : 'rgba(255,255,255,0.45)';

  const accents: Record<string, string> = {
    bold: '#4f46e5', minimal: '#6366f1', premium: '#d97706',
    friendly: '#2563eb', urgent: '#dc2626', energetic: '#ea580c',
  };
  const accent = accents[tone] ?? '#4f46e5';

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
      <div style={{ fontSize: 28, marginBottom: 4 }}>😤</div>
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
  'full-bleed':         { bg: 'linear-gradient(160deg,#78350f,#d97706)',           light: false },
  'bold-headline':      { bg: '#000',                                               light: false },
  'minimal':            { bg: '#ffffff',                                            light: true  },
  'ugc-style':          { bg: '#fafafa',                                            light: true  },
  'testimonial':        { bg: '#ffffff',                                            light: true  },
  'stats-hero':         { bg: '#020617',                                            light: false },
  'feature-list':       { bg: '#ffffff',                                            light: true  },
  'cta-final':          { bg: 'linear-gradient(135deg,#450a0a,#7f1d1d)',            light: false },
  'gradient-pop':       { bg: 'linear-gradient(135deg,#059669,#0891b2,#6366f1)',    light: false },
  'dark-luxury':        { bg: 'linear-gradient(160deg,#020617,#0f172a,#1c1917)',    light: false },
  'bright-minimal':     { bg: '#ffffff',                                            light: true  },
  'story-hook':         { bg: 'linear-gradient(160deg,#022c22,#064e3b)',            light: false },
  'problem-slide':      { bg: 'linear-gradient(135deg,#1c0505,#450a0a)',            light: false },
  'text-only-bold':     { bg: '#f8fafc',                                            light: true  },
  'product-center':     { bg: '#f8fafc',                                            light: true  },
  'neon-dark':          { bg: '#020617',                                            light: false },
  'magazine-editorial': { bg: '#ffffff',                                            light: true  },
  'color-block':        { bg: '#f8fafc',                                            light: true  },
  'floating-card':      { bg: 'linear-gradient(135deg,#052e16,#14532d)',            light: false },
  'countdown-urgency':  { bg: 'linear-gradient(135deg,#1c0505,#7f1d1d)',            light: false },
  'social-proof-grid':  { bg: '#ffffff',                                            light: true  },
  'headline-badge':     { bg: '#18181b',                                            light: false },
  'side-by-side':       { bg: '#ffffff',                                            light: true  },
  'diagonal-split':     { bg: '#1c1917',                                            light: false },
  'overlay-card':       { bg: 'linear-gradient(160deg,#1a1a2e,#16213e,#0f3460)',   light: false },
  'number-list':        { bg: '#ffffff',                                            light: true  },
  'brand-manifesto':    { bg: '#18181b',                                            light: false },
  'product-demo':       { bg: '#f8fafc',                                            light: true  },
  'retro-bold':         { bg: '#fef3c7',                                            light: true  },
  'split-panel':        { bg: '#f8fafc',                                            light: true  },
};

const TONE_ACCENTS: Record<string, string> = {
  bold: '#4f46e5', minimal: '#6366f1', premium: '#d97706',
  friendly: '#2563eb', urgent: '#dc2626', energetic: '#ea580c',
};

const SLIDE_LABELS = ['COVER', 'FEATURE', 'CTA'] as const;

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

// ── All 3 slides per template ─────────────────────────────────────────────────
function TemplateSlide({ id, slide, txt, muted, accent }: {
  id: string; slide: 0|1|2; txt: string; muted: string; accent: string;
}) {
  const gold = 'rgba(212,175,55,0.75)';

  // ─ FULL BLEED ────────────────────────────────────────────────────────────
  if (id === 'full-bleed') {
    if (slide === 0) return (
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 60%)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: 14 }}>
        <T s={7} color="rgba(255,255,255,0.6)" weight={700} caps spacing="0.1em">THIS CHANGES EVERYTHING</T>
        <T s={11} color="#fff" weight={900} spacing="-0.02em">Stop Scrolling.</T>
        <div style={{ marginTop: 8 }}><Btn label="See Why →" bg={accent} /></div>
      </div>
    );
    if (slide === 1) return (
      <Col gap={7}>
        {['Proven by 10,000+ users','Works in under 60 seconds','No experience needed'].map((t, i) => (
          <Row key={i}><Check color={accent} /><T s={9} color="#fff" weight={600}>{t}</T></Row>
        ))}
      </Col>
    );
    return (
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, transparent 50%)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: 14, gap: 6 }}>
        <T s={9} color="rgba(255,255,255,0.7)" weight={600}>Limited time offer</T>
        <Btn label="Get Started Free →" bg={accent} />
      </div>
    );
  }

  // ─ BOLD HEADLINE ─────────────────────────────────────────────────────────
  if (id === 'bold-headline') {
    if (slide === 0) return (
      <Col align="center" gap={4}>
        <div style={{ fontSize: 28, fontWeight: 900, color: '#fff', letterSpacing: '-0.05em', lineHeight: 0.9, textAlign: 'center', textTransform: 'uppercase' as const }}>THE<br/><span style={{ color: accent }}>TRUTH</span></div>
        <div style={{ height: 2, background: accent, width: 36, borderRadius: 1, marginTop: 4 }} />
        <T s={8} color="rgba(255,255,255,0.5)" weight={600} align="center">Swipe to find out</T>
      </Col>
    );
    if (slide === 1) return (
      <Col gap={6}>
        {['FAST.', 'PROVEN.', 'POWERFUL.'].map((w, i) => (
          <div key={i} style={{ fontSize: 16, fontWeight: 900, color: i === 1 ? accent : '#fff', letterSpacing: '-0.04em', textTransform: 'uppercase' as const, lineHeight: 1 }}>{w}</div>
        ))}
        <div style={{ height: 2, background: 'rgba(255,255,255,0.15)', width: '100%', marginTop: 2 }} />
      </Col>
    );
    return (
      <Col align="center" gap={8}>
        <div style={{ fontSize: 13, fontWeight: 900, color: '#fff', letterSpacing: '-0.03em', textAlign: 'center', textTransform: 'uppercase' as const }}>Ready?</div>
        <Btn label="START NOW →" bg={accent} />
      </Col>
    );
  }

  // ─ GRADIENT POP ──────────────────────────────────────────────────────────
  if (id === 'gradient-pop') {
    if (slide === 0) return (
      <Col align="center" gap={6}>
        <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 99, padding: '3px 10px' }}>
          <T s={7} color="#fff" weight={800} caps spacing="0.08em">NEW DROP</T>
        </div>
        <T s={13} color="#fff" weight={900} align="center" spacing="-0.03em">Don't scroll past this</T>
        <T s={8} color="rgba(255,255,255,0.65)" weight={500} align="center">Swipe to see more →</T>
      </Col>
    );
    if (slide === 1) return (
      <Col gap={7}>
        {[['⚡','Instant results'],['🎯','Built for growth'],['🔥','Used by 50K+ brands']].map(([ic, t], i) => (
          <Row key={i} gap={7}>
            <div style={{ fontSize: 11 }}>{ic}</div>
            <T s={9} color="#fff" weight={600}>{t}</T>
          </Row>
        ))}
      </Col>
    );
    return (
      <Col align="center" gap={8}>
        <T s={9} color="rgba(255,255,255,0.8)" align="center">Limited spots available</T>
        <Btn label="Claim Your Spot →" bg="rgba(255,255,255,0.25)" border="1.5px solid rgba(255,255,255,0.5)" color="#fff" />
      </Col>
    );
  }

  // ─ DIAGONAL SPLIT ────────────────────────────────────────────────────────
  if (id === 'diagonal-split') {
    if (slide === 0) return (
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: '#f8fafc' }} />
        <div style={{ position: 'absolute', top: 0, right: 0, width: '55%', height: '100%', background: accent, clipPath: 'polygon(22% 0, 100% 0, 100% 100%, 0% 100%)' }} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 12px', gap: 3 }}>
          <T s={8} color="rgba(30,41,59,0.5)" weight={700} caps spacing="0.08em">BEFORE vs AFTER</T>
          <T s={11} color="#1e293b" weight={800} spacing="-0.02em">Old way</T>
          <T s={8} color="rgba(30,41,59,0.5)" weight={500}>taking forever</T>
        </div>
      </div>
    );
    if (slide === 1) return (
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: '#f8fafc' }} />
        <div style={{ position: 'absolute', top: 0, right: 0, width: '55%', height: '100%', background: accent, clipPath: 'polygon(22% 0, 100% 0, 100% 100%, 0% 100%)' }} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 12px', gap: 3 }}>
          <T s={8} color="rgba(30,41,59,0.5)" weight={700} caps spacing="0.08em">WITH US</T>
          <T s={11} color="#1e293b" weight={800} spacing="-0.02em">New way</T>
          <T s={8} color="rgba(30,41,59,0.5)" weight={500}>done in 60 sec</T>
        </div>
      </div>
    );
    return (
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: accent }} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
          <T s={10} color="#fff" weight={800} align="center">Ready to switch?</T>
          <Btn label="Try Free →" bg="rgba(255,255,255,0.25)" color="#fff" border="1.5px solid rgba(255,255,255,0.5)" />
        </div>
      </div>
    );
  }

  // ─ NEON DARK ─────────────────────────────────────────────────────────────
  if (id === 'neon-dark') {
    if (slide === 0) return (
      <Col align="center" gap={6}>
        <div style={{ fontSize: 20, fontWeight: 900, color: accent, letterSpacing: '0.06em', textTransform: 'uppercase' as const, textShadow: `0 0 14px ${accent}, 0 0 30px ${accent}66` }}>GLOW UP</div>
        <div style={{ height: 1.5, background: accent, width: 70, boxShadow: `0 0 8px ${accent}` }} />
        <T s={8} color="rgba(255,255,255,0.55)" align="center" weight={500}>Swipe to see the future →</T>
      </Col>
    );
    if (slide === 1) return (
      <Col gap={7}>
        {['24/7 Performance','Zero learning curve','Neon-fast results'].map((t, i) => (
          <Row key={i} gap={6}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: accent, boxShadow: `0 0 6px ${accent}`, flexShrink: 0 }} />
            <T s={9} color="rgba(255,255,255,0.85)" weight={600}>{t}</T>
          </Row>
        ))}
      </Col>
    );
    return (
      <Col align="center" gap={8}>
        <T s={8} color="rgba(255,255,255,0.5)" align="center">Join the movement</T>
        <div style={{ height: 26, border: `1.5px solid ${accent}`, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 16px', boxShadow: `0 0 12px ${accent}44` }}>
          <T s={8} color={accent} weight={800} caps spacing="0.06em">ENTER NOW →</T>
        </div>
      </Col>
    );
  }

  // ─ RETRO BOLD ────────────────────────────────────────────────────────────
  if (id === 'retro-bold') {
    if (slide === 0) return (
      <Col align="center" gap={7}>
        <div style={{ border: '2.5px solid #1e293b', borderRadius: 3, padding: '3px 12px' }}>
          <T s={12} color="#1e293b" weight={900} caps spacing="0.1em">EST. 2024</T>
        </div>
        <T s={9} color="rgba(30,41,59,0.6)" align="center" weight={600}>The original since day one</T>
        <div style={{ height: 3, background: accent, width: 50, borderRadius: 1 }} />
      </Col>
    );
    if (slide === 1) return (
      <Col gap={8}>
        {['Old school quality','New school speed','100% satisfaction'].map((t, i) => (
          <Row key={i} gap={6}>
            <div style={{ fontSize: 9, fontWeight: 900, color: accent }}>0{i+1}</div>
            <T s={9} color="#1e293b" weight={700}>{t}</T>
          </Row>
        ))}
      </Col>
    );
    return (
      <Col align="center" gap={8}>
        <div style={{ border: '2px solid #1e293b', borderRadius: 3, padding: '5px 14px' }}>
          <T s={9} color="#1e293b" weight={900} caps spacing="0.08em">SHOP NOW →</T>
        </div>
      </Col>
    );
  }

  // ─ COLOR BLOCK ───────────────────────────────────────────────────────────
  if (id === 'color-block') {
    const half = { display: 'flex', flexDirection: 'column' as const, justifyContent: 'center', gap: 4, padding: 10 };
    if (slide === 0) return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex' }}>
        <div style={{ flex: 1, background: accent, ...half }}>
          <T s={14} color="#fff" weight={900} spacing="-0.03em">BOLD.</T>
        </div>
        <div style={{ flex: 1, background: '#f8fafc', ...half }}>
          <T s={8} color="rgba(30,41,59,0.5)" weight={700} caps spacing="0.06em">CLEAN.</T>
          <T s={7} color="rgba(30,41,59,0.4)">Swipe to see more</T>
        </div>
      </div>
    );
    if (slide === 1) return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex' }}>
        <div style={{ flex: 1, background: accent, ...half, gap: 6 }}>
          {['Fast','Proven','Bold'].map((t, i) => <T key={i} s={8} color="#fff" weight={800} caps>{t}</T>)}
        </div>
        <div style={{ flex: 1, background: '#f8fafc', ...half, gap: 5 }}>
          {['Slow','Unproven','Boring'].map((t, i) => <T key={i} s={8} color="rgba(30,41,59,0.35)" weight={600}><s>{t}</s></T>)}
        </div>
      </div>
    );
    return (
      <div style={{ position: 'absolute', inset: 0, background: accent, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <T s={11} color="#fff" weight={900} align="center" spacing="-0.02em">Choose bold.</T>
        <Btn label="Get Started →" bg="rgba(255,255,255,0.22)" color="#fff" border="1.5px solid rgba(255,255,255,0.4)" />
      </div>
    );
  }

  // ─ HEADLINE BADGE ────────────────────────────────────────────────────────
  if (id === 'headline-badge') {
    if (slide === 0) return (
      <Col gap={7}>
        <div style={{ background: accent, borderRadius: 4, padding: '2px 8px', alignSelf: 'flex-start' }}>
          <T s={7} color="#fff" weight={800} caps spacing="0.08em">NEW</T>
        </div>
        <T s={12} color="#fff" weight={900} spacing="-0.03em">The hook that stops thumbs</T>
        <T s={8} color="rgba(255,255,255,0.5)" weight={500}>Swipe to learn more →</T>
      </Col>
    );
    if (slide === 1) return (
      <Col gap={7}>
        {[['FEATURED','Get 3x more reach'],['PROVEN','10K+ creators use it'],['FREE','No credit card']].map(([badge, text], i) => (
          <Row key={i} gap={7}>
            <div style={{ background: `${accent}22`, border: `1px solid ${accent}44`, borderRadius: 3, padding: '1px 5px', flexShrink: 0 }}>
              <T s={6} color={accent} weight={800} caps spacing="0.06em">{badge}</T>
            </div>
            <T s={8} color="rgba(255,255,255,0.8)" weight={600}>{text}</T>
          </Row>
        ))}
      </Col>
    );
    return (
      <Col gap={7}>
        <div style={{ background: accent, borderRadius: 4, padding: '2px 8px', alignSelf: 'flex-start' }}>
          <T s={7} color="#fff" weight={800} caps spacing="0.08em">LIMITED</T>
        </div>
        <Btn label="Claim Your Spot →" bg={accent} />
      </Col>
    );
  }

  // ─ MINIMAL ───────────────────────────────────────────────────────────────
  if (id === 'minimal') {
    if (slide === 0) return (
      <Col align="center" gap={10}>
        <div style={{ height: 1, background: 'rgba(30,41,59,0.15)', width: '80%' }} />
        <T s={11} color="#1e293b" weight={700} align="center" spacing="-0.01em">Less noise.<br/>More signal.</T>
        <div style={{ height: 1, background: 'rgba(30,41,59,0.15)', width: '80%' }} />
      </Col>
    );
    if (slide === 1) return (
      <Col gap={8}>
        {['Clarity over clutter','Function over flash','Results, not noise'].map((t, i) => (
          <Row key={i} gap={7}>
            <div style={{ height: 1, background: accent, width: 14, flexShrink: 0 }} />
            <T s={9} color="#475569" weight={500}>{t}</T>
          </Row>
        ))}
      </Col>
    );
    return (
      <Col align="center" gap={10}>
        <T s={9} color="#94a3b8" align="center">Ready for simplicity?</T>
        <div style={{ height: 1, background: 'rgba(30,41,59,0.15)', width: '70%' }} />
        <T s={9} color={accent} weight={700} align="center">Start free →</T>
      </Col>
    );
  }

  // ─ BRIGHT MINIMAL ────────────────────────────────────────────────────────
  if (id === 'bright-minimal') {
    if (slide === 0) return (
      <Col align="center" gap={8}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: `${accent}15`, border: `2px solid ${accent}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 14, height: 14, borderRadius: '50%', background: accent }} />
        </div>
        <T s={11} color="#1e293b" weight={700} align="center" spacing="-0.01em">Simply better.</T>
        <T s={8} color="rgba(30,41,59,0.4)" align="center">Swipe to see how →</T>
      </Col>
    );
    if (slide === 1) return (
      <Col gap={8}>
        {['Clean by design','Fast by default','Built for focus'].map((t, i) => (
          <Row key={i} gap={6}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: `${accent}30`, border: `1.5px solid ${accent}60`, flexShrink: 0 }} />
            <T s={9} color="#334155" weight={600}>{t}</T>
          </Row>
        ))}
      </Col>
    );
    return (
      <Col align="center" gap={8}>
        <T s={8} color="rgba(30,41,59,0.45)" align="center">No risk. Cancel anytime.</T>
        <div style={{ height: 24, border: `1.5px solid ${accent}`, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 14px' }}>
          <T s={8} color={accent} weight={700} caps spacing="0.04em">Get Started →</T>
        </div>
      </Col>
    );
  }

  // ─ TEXT ONLY BOLD ────────────────────────────────────────────────────────
  if (id === 'text-only-bold') {
    if (slide === 0) return (
      <Col gap={5}>
        <T s={14} color="#1e293b" weight={900} spacing="-0.03em">We need<br/>to talk.</T>
        <div style={{ height: 2, background: accent, width: 32, borderRadius: 1, marginTop: 2 }} />
        <T s={8} color="rgba(30,41,59,0.45)" weight={500}>Swipe to read →</T>
      </Col>
    );
    if (slide === 1) return (
      <Col gap={5}>
        <T s={8} color="rgba(30,41,59,0.7)" weight={500} spacing="0.01em">{"Here's the truth nobody's telling you. You don't need more tools — you need a better system."}</T>
        <div style={{ height: 1, background: 'rgba(30,41,59,0.1)', width: '100%', marginTop: 2 }} />
        <T s={7} color="rgba(30,41,59,0.35)" caps spacing="0.08em">Continue reading →</T>
      </Col>
    );
    return (
      <Col gap={6}>
        <T s={13} color="#1e293b" weight={900} spacing="-0.03em">Ready<br/>to start?</T>
        <T s={8} color={accent} weight={700}>Click the link in bio →</T>
      </Col>
    );
  }

  // ─ SIDE BY SIDE ──────────────────────────────────────────────────────────
  if (id === 'side-by-side') {
    const panel = { flex: 1, display: 'flex', flexDirection: 'column' as const, justifyContent: 'center', gap: 4, padding: 10, height: '100%' };
    if (slide === 0) return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex' }}>
        <div style={{ ...panel, background: '#f0f4ff', borderRight: '1px solid #e2e8f0' }}>
          <T s={7} color="rgba(30,41,59,0.5)" weight={700} caps spacing="0.08em">BEFORE</T>
          <T s={9} color="#1e293b" weight={700}>Hours wasted</T>
          <T s={7} color="rgba(30,41,59,0.45)">Frustrating</T>
        </div>
        <div style={{ ...panel, background: '#fff' }}>
          <T s={7} color={accent} weight={700} caps spacing="0.08em">AFTER</T>
          <T s={9} color="#1e293b" weight={700}>Done in 60s</T>
          <T s={7} color="rgba(30,41,59,0.45)">Effortless</T>
        </div>
      </div>
    );
    if (slide === 1) return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex' }}>
        <div style={{ ...panel, background: '#f8fafc', borderRight: '1px solid #e2e8f0' }}>
          {['Slow','Manual','Expensive'].map((t, i) => <Row key={i} gap={4}><Cross /><T s={8} color="rgba(30,41,59,0.5)" weight={600}>{t}</T></Row>)}
        </div>
        <div style={{ ...panel, background: '#fff' }}>
          {['Fast','Automated','Affordable'].map((t, i) => <Row key={i} gap={4}><Check color={accent} /><T s={8} color="#1e293b" weight={600}>{t}</T></Row>)}
        </div>
      </div>
    );
    return (
      <div style={{ position: 'absolute', inset: 0, background: accent, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <T s={10} color="#fff" weight={800} align="center">Choose the better way.</T>
        <Btn label="Start Free →" bg="rgba(255,255,255,0.2)" color="#fff" border="1.5px solid rgba(255,255,255,0.4)" />
      </div>
    );
  }

  // ─ STORY HOOK ────────────────────────────────────────────────────────────
  if (id === 'story-hook') {
    if (slide === 0) return (
      <Col gap={6}>
        <div style={{ fontSize: 7, color: '#6ee7b7', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' as const }}>MY STORY</div>
        <T s={11} color="#fff" weight={800} spacing="-0.02em">{"I made $0 for 3 years. Then this happened."}</T>
        <T s={8} color="rgba(255,255,255,0.5)">Swipe to read →</T>
      </Col>
    );
    if (slide === 1) return (
      <Col gap={7}>
        <T s={8} color="rgba(255,255,255,0.6)" weight={600}>{"Here's what changed everything:"}</T>
        {['I stopped trying harder','I started working smarter','And results followed'].map((t, i) => (
          <Row key={i} gap={6}><Dot color="rgba(110,231,183,0.7)" /><T s={8} color="rgba(255,255,255,0.85)" weight={600}>{t}</T></Row>
        ))}
      </Col>
    );
    return (
      <Col gap={6}>
        <T s={9} color="rgba(255,255,255,0.7)" align="center">Want the full story?</T>
        <T s={8} color="#6ee7b7" weight={700} align="center">Follow for Part 2 →</T>
      </Col>
    );
  }

  // ─ PROBLEM SLIDE ─────────────────────────────────────────────────────────
  if (id === 'problem-slide') {
    if (slide === 0) return (
      <Col gap={6}>
        <div style={{ fontSize: 7, color: '#fca5a5', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase' as const }}>THE PROBLEM</div>
        <T s={11} color="#fff" weight={800} spacing="-0.02em">{"You're wasting 3 hours a day on this."}</T>
        <T s={8} color="rgba(255,255,255,0.45)">Swipe to see why →</T>
      </Col>
    );
    if (slide === 1) return (
      <Col gap={7}>
        <T s={8} color="rgba(255,255,255,0.55)" weight={600}>Sound familiar?</T>
        {['Spending hours with no results','Tools that promise but don\'t deliver','Feeling stuck and overwhelmed'].map((t, i) => (
          <Row key={i} gap={6}><Cross /><T s={8} color="rgba(255,255,255,0.8)" weight={600}>{t}</T></Row>
        ))}
      </Col>
    );
    return (
      <Col gap={7}>
        <div style={{ fontSize: 7, color: '#86efac', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase' as const }}>THE SOLUTION</div>
        <T s={9} color="#fff" weight={700}>We fix that. In 60 seconds.</T>
        <Btn label="Try It Free →" bg="rgba(239,68,68,0.5)" color="#fff" border="1px solid rgba(239,68,68,0.6)" />
      </Col>
    );
  }

  // ─ BRAND MANIFESTO ───────────────────────────────────────────────────────
  if (id === 'brand-manifesto') {
    if (slide === 0) return (
      <Col gap={6}>
        <div style={{ height: 2, background: accent, width: 28, borderRadius: 1 }} />
        <T s={10} color="#fff" weight={800} spacing="-0.02em">{"We believe the old way is broken."}</T>
        <T s={8} color="rgba(255,255,255,0.45)" weight={500}>Swipe to read our manifesto →</T>
      </Col>
    );
    if (slide === 1) return (
      <Col gap={7}>
        {['"Speed is not the enemy of quality."','"Simple beats complex, always."'].map((q, i) => (
          <div key={i} style={{ borderLeft: `2px solid ${accent}`, paddingLeft: 8 }}>
            <T s={8} color="rgba(255,255,255,0.8)" weight={500}>{q}</T>
          </div>
        ))}
      </Col>
    );
    return (
      <Col gap={7} align="center">
        <div style={{ height: 2, background: accent, width: 28, borderRadius: 1 }} />
        <T s={9} color="#fff" weight={700} align="center">Join the movement.</T>
        <T s={8} color={accent} weight={700} align="center">Learn our story →</T>
      </Col>
    );
  }

  // ─ UGC STYLE ─────────────────────────────────────────────────────────────
  if (id === 'ugc-style') {
    if (slide === 0) return (
      <Col gap={7}>
        <Row gap={7}>
          <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(30,41,59,0.15)', border: '1.5px solid rgba(30,41,59,0.2)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9 }}>👤</div>
          <Col gap={2}>
            <T s={8} color="#1e293b" weight={700}>@yourhandle</T>
            <T s={7} color="rgba(30,41,59,0.45)">Day 47 of my journey</T>
          </Col>
        </Row>
        <T s={9} color="#334155" weight={600}>{"Here's what I learned that nobody talks about."}</T>
        <T s={7} color="rgba(30,41,59,0.4)">Swipe for all 7 tips →</T>
      </Col>
    );
    if (slide === 1) return (
      <Col gap={6}>
        <T s={7} color="rgba(30,41,59,0.5)" weight={700} caps spacing="0.08em">TIP #3</T>
        <T s={9} color="#1e293b" weight={600}>{"Stop optimizing what doesn't matter."}</T>
        <div style={{ height: 1, background: 'rgba(30,41,59,0.1)', width: '100%' }} />
        <T s={7} color="rgba(30,41,59,0.4)">Keep swiping for more →</T>
      </Col>
    );
    return (
      <Col gap={7}>
        <T s={9} color="#1e293b" weight={700}>{"Drop a 🙌 if this helped!"}</T>
        <T s={8} color="rgba(30,41,59,0.5)">Save this post · Follow for more</T>
      </Col>
    );
  }

  // ─ MAGAZINE EDITORIAL ────────────────────────────────────────────────────
  if (id === 'magazine-editorial') {
    if (slide === 0) return (
      <div style={{ position: 'absolute', inset: 0, padding: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: 3, height: '100%' }}>
          <div style={{ gridColumn: '1', gridRow: '1/3', background: '#dde4ee', borderRadius: 5, display: 'flex', alignItems: 'flex-end', padding: 6 }}>
            <T s={7} color="#475569" weight={700}>COVER</T>
          </div>
          <div style={{ background: '#e8edf5', borderRadius: 5 }} />
          <div style={{ background: '#f1f5fb', borderRadius: 5, display: 'flex', alignItems: 'flex-end', padding: 4 }}>
            <T s={6} color="#94a3b8">Vol. 12</T>
          </div>
        </div>
      </div>
    );
    if (slide === 1) return (
      <Col gap={6}>
        <div style={{ height: 1, background: 'rgba(30,41,59,0.15)', width: '100%' }} />
        <T s={10} color="#1e293b" weight={800} spacing="-0.02em">Inside this issue</T>
        {['The future of content','5 trends to watch','Expert interviews'].map((t, i) => (
          <Row key={i} gap={6}>
            <T s={7} color={accent} weight={800}>{`0${i+1}`}</T>
            <T s={8} color="#475569" weight={500}>{t}</T>
          </Row>
        ))}
      </Col>
    );
    return (
      <Col gap={7}>
        <div style={{ height: 1, background: 'rgba(30,41,59,0.15)', width: '100%' }} />
        <T s={10} color="#1e293b" weight={800}>Read the full story</T>
        <T s={8} color={accent} weight={600}>Link in bio →</T>
      </Col>
    );
  }

  // ─ TESTIMONIAL ───────────────────────────────────────────────────────────
  if (id === 'testimonial') {
    if (slide === 0) return (
      <Col align="center" gap={7}>
        <Stars />
        <T s={9} color="#1e293b" weight={600} align="center" spacing="0.01em">{'"This literally changed my life. I wish I found it sooner."'}</T>
        <Row gap={6}>
          <div style={{ width: 18, height: 18, borderRadius: '50%', background: `${accent}25`, border: `1.5px solid ${accent}40`, flexShrink: 0 }} />
          <T s={7} color="rgba(30,41,59,0.55)">Sarah K. · Verified buyer</T>
        </Row>
      </Col>
    );
    if (slide === 1) return (
      <Col gap={7}>
        {[
          ['Emma R.','Game changer for my business'],
          ['James T.','Results in the first week'],
          ['Mia L.','Worth every penny'],
        ].map(([name, quote], i) => (
          <Row key={i} gap={6}>
            <div style={{ width: 20, height: 20, borderRadius: '50%', background: `${accent}20`, border: `1px solid ${accent}35`, flexShrink: 0 }} />
            <Col gap={1}>
              <T s={8} color="#1e293b" weight={700}>{name}</T>
              <T s={7} color="rgba(30,41,59,0.5)">{quote}</T>
            </Col>
          </Row>
        ))}
      </Col>
    );
    return (
      <Col align="center" gap={7}>
        <Stars />
        <T s={8} color="rgba(30,41,59,0.6)" align="center">Join 10,000+ happy customers</T>
        <Btn label="See All Reviews →" bg={accent} />
      </Col>
    );
  }

  // ─ SOCIAL PROOF GRID ─────────────────────────────────────────────────────
  if (id === 'social-proof-grid') {
    if (slide === 0) return (
      <Col gap={7}>
        <T s={10} color="#1e293b" weight={800} spacing="-0.02em">Trusted by the best.</T>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
          {['ACME','Startup Co','BigBrand','10K+ more'].map((name, i) => (
            <div key={i} style={{ height: 24, background: i < 3 ? 'rgba(30,41,59,0.06)' : `${accent}10`, border: `1px solid ${i < 3 ? 'rgba(30,41,59,0.1)' : `${accent}30`}`, borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <T s={7} color={i < 3 ? '#64748b' : accent} weight={700}>{name}</T>
            </div>
          ))}
        </div>
      </Col>
    );
    if (slide === 1) return (
      <Col gap={7}>
        {[['10,000+','Active users'],['4.9★','Average rating'],['99%','Satisfaction rate']].map(([num, label], i) => (
          <Row key={i} gap={8}>
            <div style={{ minWidth: 42 }}><T s={12} color={accent} weight={900} spacing="-0.03em">{num}</T></div>
            <T s={8} color="rgba(30,41,59,0.6)" weight={500}>{label}</T>
          </Row>
        ))}
      </Col>
    );
    return (
      <Col align="center" gap={8}>
        <T s={9} color="rgba(30,41,59,0.5)" align="center">Why wait? Join them today.</T>
        <Btn label="Get Started →" bg={accent} />
      </Col>
    );
  }

  // ─ STATS HERO ────────────────────────────────────────────────────────────
  if (id === 'stats-hero') {
    if (slide === 0) return (
      <Col align="center" gap={5}>
        <div style={{ fontSize: 38, fontWeight: 900, color: accent, letterSpacing: '-0.05em', lineHeight: 1 }}>10x</div>
        <T s={8} color="rgba(255,255,255,0.7)" align="center">faster than the old way</T>
        <div style={{ height: 1, background: 'rgba(255,255,255,0.15)', width: 60 }} />
        <T s={7} color="rgba(255,255,255,0.4)">Swipe for the proof →</T>
      </Col>
    );
    if (slide === 1) return (
      <Col gap={8}>
        {[['47%','avg CTR increase'],['3x','more conversions'],['$12K','saved per year']].map(([num, label], i) => (
          <Row key={i} gap={8}>
            <div style={{ minWidth: 38 }}><T s={14} color={accent} weight={900} spacing="-0.03em">{num}</T></div>
            <T s={8} color="rgba(255,255,255,0.6)">{label}</T>
          </Row>
        ))}
      </Col>
    );
    return (
      <Col align="center" gap={7}>
        <T s={8} color="rgba(255,255,255,0.5)" align="center">Data from 10K+ campaigns</T>
        <Btn label="See Full Report →" bg={accent} />
      </Col>
    );
  }

  // ─ PRODUCT CENTER ────────────────────────────────────────────────────────
  if (id === 'product-center') {
    if (slide === 0) return (
      <Col align="center" gap={7}>
        <div style={{ width: 54, height: 54, borderRadius: 14, background: `${accent}18`, border: `2px solid ${accent}35`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: accent, opacity: 0.8 }} />
        </div>
        <Col gap={3} align="center">
          <T s={7} color="rgba(30,41,59,0.5)" weight={700} caps spacing="0.1em">INTRODUCING</T>
          <T s={11} color="#1e293b" weight={800} align="center" spacing="-0.02em">Your next favourite tool</T>
        </Col>
      </Col>
    );
    if (slide === 1) return (
      <Col gap={6}>
        {[['⚡','Blazing fast setup'],['🎯','Precision targeting'],['💎','Premium quality']].map(([ic, t], i) => (
          <Row key={i} gap={7}>
            <div style={{ fontSize: 11 }}>{ic}</div>
            <T s={9} color="#334155" weight={600}>{t}</T>
          </Row>
        ))}
      </Col>
    );
    return (
      <Col align="center" gap={7}>
        <T s={8} color="rgba(30,41,59,0.5)" align="center">Free to try. No card needed.</T>
        <Btn label="Shop Now →" bg={accent} />
      </Col>
    );
  }

  // ─ PRODUCT DEMO ──────────────────────────────────────────────────────────
  if (id === 'product-demo') {
    const browser = (
      <div style={{ width: '88%', height: 52, background: '#e2e8f0', borderRadius: 6, border: '1.5px solid #cbd5e1', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ height: 9, background: '#cbd5e1', display: 'flex', alignItems: 'center', paddingLeft: 6, gap: 3 }}>
          {['#ef4444','#f59e0b','#22c55e'].map(c => <div key={c} style={{ width: 4, height: 4, borderRadius: '50%', background: c }} />)}
        </div>
        <div style={{ flex: 1, background: '#f8fafc', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 3, padding: 6 }}>
          <div style={{ height: 4, background: '#94a3b8', borderRadius: 1, width: '75%' }} />
          <div style={{ height: 4, background: '#cbd5e1', borderRadius: 1, width: '55%' }} />
        </div>
      </div>
    );
    if (slide === 0) return (
      <Col align="center" gap={7}>
        {browser}
        <T s={8} color="rgba(30,41,59,0.55)" align="center">See how it works in real time</T>
      </Col>
    );
    if (slide === 1) return (
      <Col gap={6}>
        {['One-click setup','Real-time preview','Export anywhere'].map((t, i) => (
          <Row key={i}><Check color={accent} /><T s={9} color="#334155" weight={600}>{t}</T></Row>
        ))}
      </Col>
    );
    return (
      <Col align="center" gap={7}>
        {browser}
        <Btn label="Try Free 14 Days →" bg={accent} />
      </Col>
    );
  }

  // ─ FLOATING CARD ─────────────────────────────────────────────────────────
  if (id === 'floating-card') {
    const card = (children: React.ReactNode) => (
      <div style={{ background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(4px)', borderRadius: 10, padding: '10px 12px', width: '88%', boxShadow: '0 8px 24px rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.18)', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {children}
      </div>
    );
    if (slide === 0) return (
      <Col align="center">
        {card(<>
          <T s={7} color="rgba(255,255,255,0.55)" weight={700} caps spacing="0.08em">NEW OFFER</T>
          <T s={10} color="#fff" weight={800} spacing="-0.02em">Floating card design that converts</T>
          <Btn label="Learn More →" bg={accent} />
        </>)}
      </Col>
    );
    if (slide === 1) return (
      <Col align="center">
        {card(<>
          {['Glassmorphism effect','Depth and shadow','Mobile-first layout'].map((t, i) => (
            <Row key={i}><Check color={accent} /><T s={8} color="rgba(255,255,255,0.85)" weight={600}>{t}</T></Row>
          ))}
        </>)}
      </Col>
    );
    return (
      <Col align="center">
        {card(<>
          <T s={8} color="rgba(255,255,255,0.6)" align="center">Limited availability</T>
          <Btn label="Claim Offer →" bg={accent} />
        </>)}
      </Col>
    );
  }

  // ─ FEATURE LIST ──────────────────────────────────────────────────────────
  if (id === 'feature-list') {
    if (slide === 0) return (
      <Col gap={6}>
        <T s={10} color="#1e293b" weight={800} spacing="-0.02em">Everything you need.</T>
        {['Unlimited projects','Team collaboration','Priority support','Analytics dashboard'].map((t, i) => (
          <Row key={i} gap={6}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: `${accent}20`, border: `1.5px solid ${accent}50`, flexShrink: 0 }}>
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 4, height: 4, borderRadius: 1, background: accent }} />
              </div>
            </div>
            <T s={8} color="#475569" weight={500}>{t}</T>
          </Row>
        ))}
      </Col>
    );
    if (slide === 1) return (
      <Col gap={6}>
        <T s={8} color="rgba(30,41,59,0.5)" weight={700} caps spacing="0.08em">MOST POPULAR</T>
        {['Starter · Free','Pro · $12/mo','Team · $39/mo'].map((t, i) => (
          <div key={i} style={{ height: 22, background: i === 1 ? `${accent}12` : 'rgba(30,41,59,0.04)', border: `1px solid ${i === 1 ? `${accent}35` : 'rgba(30,41,59,0.1)'}`, borderRadius: 5, display: 'flex', alignItems: 'center', paddingLeft: 8 }}>
            <T s={8} color={i === 1 ? accent : '#64748b'} weight={i === 1 ? 700 : 500}>{t}</T>
          </div>
        ))}
      </Col>
    );
    return (
      <Col align="center" gap={7}>
        <T s={8} color="rgba(30,41,59,0.5)" align="center">Start with the free plan.</T>
        <Btn label="Get All Features →" bg={accent} />
      </Col>
    );
  }

  // ─ NUMBER LIST ───────────────────────────────────────────────────────────
  if (id === 'number-list') {
    if (slide === 0) return (
      <Col gap={6}>
        <T s={10} color="#1e293b" weight={800} spacing="-0.02em">3 steps to success.</T>
        {[['1','Sign up free'],['2','Connect your tools'],['3','Watch it work']].map(([n, t], i) => (
          <Row key={i} gap={7}>
            <div style={{ width: 18, height: 18, borderRadius: '50%', background: `${accent}18`, border: `1.5px solid ${accent}45`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <T s={8} color={accent} weight={800}>{n}</T>
            </div>
            <T s={9} color="#334155" weight={600}>{t}</T>
          </Row>
        ))}
      </Col>
    );
    if (slide === 1) return (
      <Col gap={6}>
        <Row gap={7}>
          <div style={{ width: 22, height: 22, borderRadius: '50%', background: accent, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <T s={9} color="#fff" weight={900}>2</T>
          </div>
          <T s={9} color="#1e293b" weight={700}>Connect your tools</T>
        </Row>
        <T s={8} color="rgba(30,41,59,0.5)" weight={500}>{"Link your existing stack in one click. No setup, no code, no headaches."}</T>
      </Col>
    );
    return (
      <Col align="center" gap={7}>
        <T s={9} color="rgba(30,41,59,0.55)" align="center">{"You're one step away."}</T>
        <Btn label="Start Step 1 →" bg={accent} />
      </Col>
    );
  }

  // ─ SPLIT PANEL ───────────────────────────────────────────────────────────
  if (id === 'split-panel') {
    if (slide === 0) return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex' }}>
        <div style={{ flex: 1, background: 'linear-gradient(160deg,#4f46e5,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Col align="center" gap={4}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.2)' }} />
            <T s={7} color="rgba(255,255,255,0.7)" align="center">Visual left</T>
          </Col>
        </div>
        <div style={{ flex: 1, background: '#f8fafc', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 5, padding: 10 }}>
          <T s={7} color="rgba(30,41,59,0.5)" weight={700} caps spacing="0.08em">HEADLINE</T>
          <T s={9} color="#1e293b" weight={800} spacing="-0.02em">Copy on the right side</T>
          <T s={7} color="rgba(30,41,59,0.4)">Subtext below</T>
        </div>
      </div>
    );
    if (slide === 1) return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex' }}>
        <div style={{ flex: 1, background: 'linear-gradient(160deg,#4f46e5,#7c3aed)', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 6, padding: 10 }}>
          {['Fast','Reliable','Scalable'].map((t, i) => <T key={i} s={8} color="rgba(255,255,255,0.85)" weight={700}>{t}</T>)}
        </div>
        <div style={{ flex: 1, background: '#f8fafc', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 5, padding: 10 }}>
          {['Setup in 60s','99.9% uptime','Grows with you'].map((t, i) => <T key={i} s={7} color="#475569" weight={500}>{t}</T>)}
        </div>
      </div>
    );
    return (
      <div style={{ position: 'absolute', inset: 0, background: '#4f46e5', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <T s={10} color="#fff" weight={800} align="center">The best of both worlds.</T>
        <Btn label="Start Free →" bg="rgba(255,255,255,0.2)" color="#fff" border="1.5px solid rgba(255,255,255,0.4)" />
      </div>
    );
  }

  // ─ OVERLAY CARD ──────────────────────────────────────────────────────────
  if (id === 'overlay-card') {
    const overlayCard = (children: React.ReactNode) => (
      <div style={{ position: 'absolute', bottom: 10, left: 10, right: 10, background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.22)', borderRadius: 9, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 5 }}>
        {children}
      </div>
    );
    if (slide === 0) return (
      <div style={{ position: 'absolute', inset: 0 }}>
        {overlayCard(<>
          <T s={7} color="rgba(255,255,255,0.6)" weight={700} caps spacing="0.1em">EXCLUSIVE OFFER</T>
          <T s={10} color="#fff" weight={800} spacing="-0.02em">One card. Maximum impact.</T>
        </>)}
      </div>
    );
    if (slide === 1) return (
      <div style={{ position: 'absolute', inset: 0 }}>
        {overlayCard(<>
          {['Fully responsive','High contrast','Eye-catching'].map((t, i) => (
            <Row key={i}><Check color={accent} /><T s={8} color="rgba(255,255,255,0.85)" weight={600}>{t}</T></Row>
          ))}
        </>)}
      </div>
    );
    return (
      <div style={{ position: 'absolute', inset: 0 }}>
        {overlayCard(<>
          <T s={8} color="rgba(255,255,255,0.6)" align="center">{"Don't miss out"}</T>
          <Btn label="Claim Offer →" bg={accent} />
        </>)}
      </div>
    );
  }

  // ─ CTA FINAL ─────────────────────────────────────────────────────────────
  if (id === 'cta-final') {
    if (slide === 0) return (
      <Col align="center" gap={6}>
        <div style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 4, padding: '2px 10px' }}>
          <T s={7} color="#fca5a5" weight={800} caps spacing="0.1em">LIMITED TIME OFFER</T>
        </div>
        <T s={12} color="#fff" weight={900} align="center" spacing="-0.03em">{"Last chance. Don't miss it."}</T>
        <Btn label="GRAB IT NOW →" bg={accent} />
      </Col>
    );
    if (slide === 1) return (
      <Col gap={7}>
        <T s={8} color="rgba(255,255,255,0.55)" weight={700}>Why act now?</T>
        {['✓ Free shipping today only','✓ 30-day money back','✓ Only 47 units left'].map((t, i) => (
          <T key={i} s={9} color="rgba(255,255,255,0.85)" weight={600}>{t}</T>
        ))}
      </Col>
    );
    return (
      <Col align="center" gap={6}>
        <T s={8} color="rgba(255,255,255,0.5)" align="center">Offer expires at midnight</T>
        <div style={{ height: 32, background: accent, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 20px', boxShadow: `0 4px 18px ${accent}66` }}>
          <T s={10} color="#fff" weight={900} caps spacing="0.06em">CLAIM NOW →</T>
        </div>
      </Col>
    );
  }

  // ─ COUNTDOWN URGENCY ─────────────────────────────────────────────────────
  if (id === 'countdown-urgency') {
    const timer = (
      <div style={{ display: 'flex', gap: 5 }}>
        {[['00','HRS'],['12','MIN'],['34','SEC']].map(([n, l], i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <div style={{ width: 28, height: 28, background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.28)', borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 900, color: '#fff' }}>{n}</div>
            <T s={6} color="rgba(255,255,255,0.4)" caps spacing="0.05em">{l}</T>
          </div>
        ))}
      </div>
    );
    if (slide === 0) return (
      <Col align="center" gap={7}>
        <T s={8} color="#fca5a5" weight={800} caps spacing="0.1em">⏰ OFFER ENDS IN</T>
        {timer}
        <T s={8} color="rgba(255,255,255,0.5)">Swipe for the deal →</T>
      </Col>
    );
    if (slide === 1) return (
      <Col gap={7}>
        <T s={8} color="#fca5a5" weight={700}>Why buy now?</T>
        {['🔥 50% off — today only','📦 Ships in 24 hours','🛡️ 60-day guarantee'].map((t, i) => (
          <T key={i} s={9} color="rgba(255,255,255,0.85)" weight={600}>{t}</T>
        ))}
      </Col>
    );
    return (
      <Col align="center" gap={7}>
        {timer}
        <Btn label="CLAIM OFFER →" bg="rgba(239,68,68,0.6)" color="#fff" border="1px solid rgba(239,68,68,0.7)" />
      </Col>
    );
  }

  // ─ DARK LUXURY ───────────────────────────────────────────────────────────
  if (id === 'dark-luxury') {
    if (slide === 0) return (
      <Col align="center" gap={8}>
        <div style={{ height: 1, background: gold, width: 48 }} />
        <T s={12} color="#f8f4e8" weight={300} align="center" spacing="0.06em">Exclusively<br/>Yours.</T>
        <div style={{ height: 1, background: gold, width: 48 }} />
        <T s={7} color="rgba(212,175,55,0.5)" caps spacing="0.14em">Swipe to explore</T>
      </Col>
    );
    if (slide === 1) return (
      <Col gap={8}>
        {['Handcrafted quality','Members-only access','Lifetime guarantee'].map((t, i) => (
          <Row key={i} gap={8}>
            <div style={{ height: 1, background: gold, width: 14, flexShrink: 0 }} />
            <T s={9} color="#f8f4e8" weight={400} spacing="0.04em">{t}</T>
          </Row>
        ))}
      </Col>
    );
    return (
      <Col align="center" gap={8}>
        <div style={{ height: 1, background: gold, width: 48 }} />
        <T s={8} color="rgba(248,244,232,0.6)" align="center" caps spacing="0.1em">By invitation only</T>
        <div style={{ height: 22, border: `1px solid ${gold}`, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 18px' }}>
          <T s={8} color={gold} weight={500} caps spacing="0.12em">Request Access →</T>
        </div>
      </Col>
    );
  }

  // ─ GENERIC FALLBACK ───────────────────────────────────────────────────────
  if (slide === 0) return (
    <Col align="center" gap={7}>
      <T s={14} color={txt} weight={900} align="center" spacing="-0.03em">Hook them here.</T>
      <div style={{ height: 2, background: accent, width: 40, borderRadius: 1 }} />
      <T s={8} color={muted} align="center">Swipe to learn more →</T>
    </Col>
  );
  if (slide === 1) return (
    <Col gap={7}>
      {['Benefit one','Benefit two','Benefit three'].map((t, i) => (
        <Row key={i}><Check color={accent} /><T s={9} color={txt} weight={600}>{t}</T></Row>
      ))}
    </Col>
  );
  return (
    <Col align="center" gap={7}>
      <T s={9} color={muted} align="center">Ready to start?</T>
      <Btn label="Get Started →" bg={accent} />
    </Col>
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
  const accent = tone === 'dark'    ? '#6366f1'
               : tone === 'luxury'  ? '#d4af37'
               : tone === 'light'   ? '#4f46e5'
               : tone === 'minimal' ? '#0f172a'
               : tone === 'urgent'  ? '#ef4444'
               : '#6366f1';

  // Shared inner layout
  const wrap: React.CSSProperties = {
    position: 'absolute', inset: 0,
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    padding: 14, gap: 8,
    background: bg, overflow: 'hidden',
  };

  // ── full-bleed ──────────────────────────────────────────────────────────────
  if (id === 'full-bleed') return (
    <div style={{ ...wrap, background: `linear-gradient(135deg, ${accent}, ${accent}cc)`, gap: 6 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.25)' }} />
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
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
    <div style={{ ...wrap, background: '#fff', gap: 7, alignItems: 'flex-start' }}>
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
      <div style={{ height: 1, background: '#d4af37', width: 60, opacity: 0.7 }} />
      <T s={7} color="#d4af37" caps spacing="0.2em" weight={600}>Exclusively Yours</T>
      <T s={14} color="#f1f5f9" weight={300} align="center" spacing="0.05em">Luxury redefined.</T>
      <div style={{ height: 1, background: '#d4af37', width: 60, opacity: 0.7 }} />
      <Btn label="Explore" bg="transparent" color="#d4af37" border="1px solid #d4af3755" />
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
      <T s={8} color={accent} weight={700}>A true story →</T>
      <T s={13} color="#f1f5f9" weight={800} spacing="-0.02em">"I made $0 for 3 years."</T>
      <T s={8} color="rgba(241,245,249,0.5)">Then I discovered one thing that changed everything.</T>
      <Btn label="Read Story" bg={accent} />
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
    <div style={{ ...wrap, background: '#f8fafc', gap: 8 }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: `linear-gradient(135deg, ${accent}, #818cf8)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>⚡</div>
      <T s={11} color="#1e293b" weight={800} align="center" spacing="-0.02em">Power up your workflow</T>
      <Row gap={10}>
        {['🚀 Fast','✨ Smart','🔒 Safe'].map(f => <T key={f} s={7} color="#475569" weight={600}>{f}</T>)}
      </Row>
      <Btn label="Try Free" bg={accent} />
    </div>
  );

  // ── neon-dark ───────────────────────────────────────────────────────────────
  if (id === 'neon-dark') return (
    <div style={{ ...wrap, background: '#030712', gap: 6 }}>
      <div style={{ position: 'absolute', top: '30%', left: '50%', transform: 'translate(-50%,-50%)', width: 100, height: 100, borderRadius: '50%', background: `${accent}20`, filter: 'blur(25px)', pointerEvents: 'none' }} />
      <T s={7} color={accent} caps spacing="0.15em" weight={700}>Next level</T>
      <T s={18} color="#fff" weight={900} align="center" spacing="-0.03em" >GLOW UP</T>
      <T s={8} color="rgba(255,255,255,0.45)" align="center">Your brand, amplified.</T>
      <Btn label="Get Access" bg={accent} />
    </div>
  );

  // ── magazine-editorial ──────────────────────────────────────────────────────
  if (id === 'magazine-editorial') return (
    <div style={{ ...wrap, background: '#fff', alignItems: 'flex-start', gap: 7 }}>
      <Row gap={8}>
        <T s={7} color="#94a3b8" caps spacing="0.12em">Issue 12</T>
        <div style={{ height: 1, background: '#94a3b8', flex: 1, marginTop: 4 }} />
      </Row>
      <T s={13} color="#1e293b" weight={800} spacing="-0.02em">The future of content</T>
      <T s={8} color="#64748b">5 trends reshaping how brands speak.</T>
      <div style={{ height: 1, background: '#e2e8f0', width: '100%' }} />
      <T s={7} color="#94a3b8">Read the full story →</T>
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
    <div style={{ ...wrap, background: `linear-gradient(180deg, ${accent}66, ${accent}dd)`, justifyContent: 'flex-end', padding: 0 }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '60%', background: `${accent}44` }} />
      <div style={{ width: '100%', background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(10px)', borderTop: '1px solid rgba(255,255,255,0.2)', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 5 }}>
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
  const [slide,  setSlide]  = useState(0);
  const [fading, setFading] = useState(false);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const style   = TEMPLATE_STYLES[id] ?? { bg: 'linear-gradient(135deg,#1c1917,#292524)', light: false };
  const txt     = style.light ? '#1e293b' : '#ffffff';
  const muted   = style.light ? 'rgba(30,41,59,0.4)' : 'rgba(255,255,255,0.4)';
  const accent  = TONE_ACCENTS[tone] ?? '#4f46e5';
  const dotBase = style.light ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.25)';

  useEffect(() => {
    if (paused) return;
    timerRef.current = setInterval(() => {
      setFading(true);
      setTimeout(() => { setSlide(s => (s + 1) % 3); setFading(false); }, 200);
    }, 2200);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [paused]);

  return (
    <div
      style={{ width: '100%', height: '100%', background: style.bg, position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px 14px' }}
      onMouseEnter={() => { setPaused(true); if (timerRef.current) clearInterval(timerRef.current); }}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Slide type badge */}
      <div style={{ position: 'absolute', top: 8, left: 8, fontSize: 8, fontWeight: 700, letterSpacing: '0.09em', padding: '2px 7px', borderRadius: 3, background: style.light ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.12)', color: style.light ? '#475569' : 'rgba(255,255,255,0.65)', zIndex: 1 }}>
        {SLIDE_LABELS[slide]}
      </div>

      {/* Slide content — crossfades on change */}
      <div style={{ opacity: fading ? 0 : 1, transition: 'opacity 0.2s ease', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, width: '100%', height: '100%', position: 'relative' }}>

        {slide === 0 && <TemplateSlide id={id} slide={0} txt={txt} muted={muted} accent={accent} />}
        {slide === 1 && <TemplateSlide id={id} slide={1} txt={txt} muted={muted} accent={accent} />}
        {slide === 2 && <TemplateSlide id={id} slide={2} txt={txt} muted={muted} accent={accent} />}
      </div>

      {/* Progress dots */}
      <div style={{ position: 'absolute', bottom: 8, left: 0, right: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 4, zIndex: 1 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ height: 3, borderRadius: 2, background: i === slide ? txt : dotBase, width: i === slide ? 14 : 4, opacity: i === slide ? 0.9 : 1, transition: 'all 0.3s ease' }} />
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
              <span style={{ fontSize: 13, opacity: isActive ? 1 : 0.6 }}>{cat.icon}</span>
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
    <div style={{ minHeight: '100vh', background: 'var(--bg, #0f1117)', color: 'var(--text, #f1f5f9)', display: 'flex', flexDirection: 'column' }}>

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div style={{
        padding: '12px 32px', borderBottom: '1px solid rgba(255,255,255,0.07)',
        display: 'flex', alignItems: 'center', gap: 20,
        background: 'rgba(10,11,18,0.85)', backdropFilter: 'blur(14px)',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <span style={{ fontSize: 15, fontWeight: 900, letterSpacing: '-0.02em', flexShrink: 0 }}>✦ Creative OS</span>
        <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.1)', flexShrink: 0 }} />

        {/* Format tabs */}
        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 9, padding: 3, gap: 2 }}>
          {(['carousel','image','video'] as GalleryFormat[]).map(f => (
            <button key={f} onClick={() => handleFormatChange(f)}
              style={{ padding: '5px 15px', borderRadius: 6, border: 'none', fontFamily: 'inherit', fontWeight: 700, fontSize: 12, cursor: 'pointer', transition: 'all 0.13s', background: format === f ? '#4f46e5' : 'transparent', color: format === f ? '#fff' : 'rgba(255,255,255,0.4)' }}>
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
