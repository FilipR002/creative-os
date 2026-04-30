'use client';

// ─── TemplateGallery ──────────────────────────────────────────────────────────
// Full-page template picker shown as the first screen when creating a new ad.

import { useState } from 'react';
import type { TemplateMetadata } from '@/lib/api/creator-client';

export type GalleryFormat = 'carousel' | 'image' | 'video';
type ToneFilter = 'all' | 'bold' | 'minimal' | 'premium' | 'friendly' | 'urgent' | 'energetic';

interface Props {
  templates:     TemplateMetadata[];
  onSelect:      (templateId: string, format: GalleryFormat) => void;
  defaultFormat?: GalleryFormat;
}

const TONE_LABELS: Record<ToneFilter, string> = {
  all:       'All',
  bold:      'Bold',
  minimal:   'Minimal',
  premium:   'Premium',
  friendly:  'Friendly',
  urgent:    'Urgent',
  energetic: 'Energetic',
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
    <div style={{ ...s, background: 'linear-gradient(160deg, #1e1b4b 0%, #312e81 60%, #4f46e5 100%)', justifyContent: 'flex-end', alignItems: 'flex-start', padding: 18 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 55%)' }} />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ height: 9, background: '#fff', borderRadius: 2, width: 140, marginBottom: 6 }} />
        <div style={{ height: 6, background: 'rgba(255,255,255,0.5)', borderRadius: 2, width: 110, marginBottom: 12 }} />
        <div style={{ height: 22, background: '#4f46e5', borderRadius: 5, width: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ height: 5, background: '#fff', borderRadius: 2, width: 50 }} />
        </div>
      </div>
    </div>
  );

  if (id === 'bold-headline') return (
    <div style={{ ...s, background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)' }}>
      <div style={{ fontSize: 28, fontWeight: 900, color: '#fff', textAlign: 'center', lineHeight: 1.1, letterSpacing: '-0.03em', textShadow: '0 2px 12px rgba(79,70,229,0.5)' }}>
        Transform<br />Your Brand
      </div>
      <div style={{ height: 5, background: accent, borderRadius: 2, width: 60, marginTop: 4 }} />
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
    <div style={{ ...s, background: '#0f172a', justifyContent: 'flex-start', padding: 14, gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, #a78bfa, #60a5fa)' }} />
        <div>
          <div style={{ height: 5, background: '#fff', borderRadius: 2, width: 60 }} />
          <div style={{ height: 4, background: 'rgba(255,255,255,0.35)', borderRadius: 2, width: 40, marginTop: 3 }} />
        </div>
      </div>
      <div style={{ flex: 1, width: '100%', background: 'linear-gradient(160deg, #312e81, #1e40af)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ height: 6, background: 'rgba(255,255,255,0.7)', borderRadius: 2, width: 80 }} />
      </div>
      <div style={{ height: 5, background: 'rgba(255,255,255,0.4)', borderRadius: 2, width: '90%' }} />
      <div style={{ height: 5, background: 'rgba(255,255,255,0.25)', borderRadius: 2, width: '70%' }} />
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
    <div style={{ ...s, background: '#0f172a', gap: 6 }}>
      <div style={{ fontSize: 52, fontWeight: 900, color: '#fff', lineHeight: 1, letterSpacing: '-0.04em' }}>
        87<span style={{ fontSize: 28, color: accent }}>%</span>
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
    <div style={{ ...s, background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)', gap: 8 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: accent, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Limited Time</div>
      <div style={{ height: 9, background: '#fff', borderRadius: 2, width: 140 }} />
      <div style={{ height: 6, background: 'rgba(255,255,255,0.4)', borderRadius: 2, width: 110 }} />
      <div style={{ marginTop: 8, height: 30, background: accent, borderRadius: 8, width: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 4px 16px ${accent}55` }}>
        <div style={{ height: 5, background: '#fff', borderRadius: 2, width: 70 }} />
      </div>
    </div>
  );

  if (id === 'gradient-pop') return (
    <div style={{ ...s, background: 'linear-gradient(135deg, #7c3aed 0%, #2563eb 50%, #0891b2 100%)', gap: 8 }}>
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
    <div style={{ ...s, background: 'linear-gradient(160deg, #0f172a 0%, #1e1b4b 100%)', justifyContent: 'flex-start', padding: 18, gap: 6 }}>
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
      <div style={{ height: '50%', width: '100%', background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ height: 9, background: '#fff', borderRadius: 2, width: 110 }} />
      </div>
      <div style={{ height: '50%', width: '100%', background: '#f8fafc', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        <div style={{ height: 5, background: '#94a3b8', borderRadius: 2, width: 100 }} />
        <div style={{ height: 20, background: '#1e293b', borderRadius: 5, width: 80 }} />
      </div>
    </div>
  );

  if (id === 'floating-card') return (
    <div style={{ ...s, background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)' }}>
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
    <div style={{ ...s, background: '#0f172a', gap: 10 }}>
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
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)' }} />
      <div style={{ position: 'absolute', right: 0, top: 0, width: '50%', height: '100%', background: 'linear-gradient(160deg, #ea580c, #f97316)', clipPath: 'polygon(20% 0, 100% 0, 100% 100%, 0% 100%)' }} />
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: 7, padding: 18, alignSelf: 'flex-start', marginTop: 20 }}>
        <div style={{ height: 9, background: '#fff', borderRadius: 2, width: 100 }} />
        <div style={{ height: 5, background: 'rgba(255,255,255,0.6)', borderRadius: 2, width: 80 }} />
      </div>
    </div>
  );

  if (id === 'overlay-card') return (
    <div style={{ ...s, background: 'linear-gradient(160deg, #0f172a 0%, #1e3a5f 100%)', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(15,23,42,0.85), rgba(30,58,95,0.85))' }} />
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
    <div style={{ ...s, background: '#0f172a', gap: 6 }}>
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
    bold:      'linear-gradient(135deg, #1e1b4b 0%, #4f46e5 100%)',
    minimal:   'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
    premium:   'linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #854d0e 100%)',
    friendly:  'linear-gradient(135deg, #0f172a 0%, #1d4ed8 100%)',
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

// ─── Template Card ────────────────────────────────────────────────────────────

function TemplateCard({ template, selected, onClick }: {
  template: TemplateMetadata;
  selected: boolean;
  onClick:  () => void;
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
        cursor:       'pointer', overflow: 'hidden', transition: 'all 0.18s ease',
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
        {/* CSS fallback — always rendered, hidden once real PNG loads */}
        <div style={{ position: 'absolute', inset: 0, display: imgLoaded ? 'none' : 'flex' }}>
          <Fallback id={template.id} tone={template.tones[0] ?? 'bold'} />
        </div>

        {/* Real PNG — hidden until loaded */}
        {!imgError && (
          <img
            src={`/templates/${template.id}.png`}
            alt={template.name}
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgError(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', opacity: imgLoaded ? 1 : 0, transition: 'opacity 0.2s' }}
          />
        )}

        {/* Selected check */}
        {selected && (
          <div style={{ position: 'absolute', top: 8, right: 8, width: 22, height: 22, borderRadius: '50%', background: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(79,70,229,0.5)', zIndex: 2 }}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M2 5l2.5 2.5 4-4" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        )}

        {/* IMG badge */}
        {template.requiresImage && (
          <div style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', borderRadius: 4, padding: '2px 6px', fontSize: 9, fontWeight: 700, color: '#fbbf24', letterSpacing: '0.06em', zIndex: 2 }}>
            IMG
          </div>
        )}

        {/* Hover overlay */}
        {hovered && !selected && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(2px)', zIndex: 2 }}>
            <div style={{ background: '#4f46e5', color: '#fff', fontSize: 12, fontWeight: 700, padding: '9px 20px', borderRadius: 8, letterSpacing: '0.03em', boxShadow: '0 4px 16px rgba(79,70,229,0.5)' }}>
              Use Template
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: '10px 12px 12px' }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: selected ? '#a5b4fc' : 'var(--text)', marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {template.name}
        </div>
        <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {template.description}
        </div>
        <div style={{ marginTop: 8, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {template.tones.slice(0, 3).map(tone => (
            <span key={tone} style={{ fontSize: 9, fontWeight: 600, color: 'var(--muted)', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 3, padding: '1px 5px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              {tone}
            </span>
          ))}
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
      <div style={{ padding: '0 12px 12px' }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--muted)', marginBottom: 3 }}>Skip — Auto</div>
        <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.4 }}>AI optimises per slide</div>
        <div style={{ marginTop: 8, display: 'flex', gap: 4 }}>
          <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--muted)', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 3, padding: '1px 5px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>auto</span>
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function TemplateGallery({ templates, onSelect, defaultFormat = 'carousel' }: Props) {
  const [format,     setFormat]     = useState<GalleryFormat>(defaultFormat);
  const [toneFilter, setToneFilter] = useState<ToneFilter>('all');
  const [selected,   setSelected]   = useState('');

  const isVisual = format !== 'video';

  const visible = isVisual
    ? templates.filter(t => toneFilter === 'all' || t.tones.includes(toneFilter as any))
    : [];

  function handleSelect(id: string) {
    setSelected(id);
    setTimeout(() => onSelect(id, format), 180);
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg, #0f1117)', color: 'var(--text, #f1f5f9)', display: 'flex', flexDirection: 'column' }}>

      {/* Top bar */}
      <div style={{ padding: '14px 40px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: 20, background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(12px)', position: 'sticky', top: 0, zIndex: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 16, fontWeight: 900, letterSpacing: '-0.02em' }}>✦ Creative OS</span>
        <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.12)' }} />

        {/* Format tabs */}
        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: 3, gap: 2 }}>
          {(['carousel','image','video'] as GalleryFormat[]).map(f => (
            <button key={f} onClick={() => { setFormat(f); setSelected(''); }}
              style={{ padding: '6px 16px', borderRadius: 7, border: 'none', fontFamily: 'inherit', fontWeight: 700, fontSize: 12, cursor: 'pointer', transition: 'all 0.15s', background: format === f ? '#4f46e5' : 'transparent', color: format === f ? '#fff' : 'rgba(255,255,255,0.45)' }}>
              {f === 'carousel' ? '⊞ Carousel' : f === 'image' ? '⬜ Banner' : '▶ Video'}
            </button>
          ))}
        </div>

        {/* Tone pills */}
        {isVisual && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {(Object.keys(TONE_LABELS) as ToneFilter[]).map(t => (
              <button key={t} onClick={() => setToneFilter(t)}
                style={{ padding: '4px 12px', borderRadius: 20, border: `1px solid ${toneFilter === t ? '#4f46e5' : 'rgba(255,255,255,0.12)'}`, fontFamily: 'inherit', fontWeight: 600, fontSize: 11, cursor: 'pointer', transition: 'all 0.15s', background: toneFilter === t ? 'rgba(79,70,229,0.25)' : 'transparent', color: toneFilter === t ? '#a5b4fc' : 'rgba(255,255,255,0.45)' }}>
                {TONE_LABELS[t]}
              </button>
            ))}
          </div>
        )}

        {isVisual && (
          <span style={{ marginLeft: 'auto', fontSize: 12, color: 'rgba(255,255,255,0.3)', fontWeight: 500 }}>
            {visible.length + 1} options
          </span>
        )}
      </div>

      {/* Body */}
      <div style={{ flex: 1, padding: '36px 40px 60px', maxWidth: 1400, margin: '0 auto', width: '100%' }}>
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.1 }}>
            {format === 'video' ? 'Create a Video Ad' : `Choose a ${format === 'image' ? 'Banner' : 'Carousel'} Template`}
          </h1>
          <p style={{ margin: '8px 0 0', fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>
            {format === 'video'
              ? 'Video style is AI-selected per scene — describe your product and the engine decides.'
              : 'Pick the visual style. AI fills in the copy and images.'}
          </p>
        </div>

        {/* Video CTA */}
        {format === 'video' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 320, gap: 20 }}>
            <div style={{ fontSize: 52 }}>🎬</div>
            <div style={{ textAlign: 'center', maxWidth: 440 }}>
              <div style={{ fontWeight: 800, fontSize: 20, marginBottom: 10 }}>AI-Directed Video</div>
              <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>The engine auto-selects the best visual style, pacing, and text overlays per scene based on your brief, goal, and platform.</div>
            </div>
            <button onClick={() => onSelect('', 'video')}
              style={{ padding: '13px 32px', borderRadius: 10, border: 'none', fontFamily: 'inherit', fontWeight: 800, fontSize: 14, cursor: 'pointer', background: '#4f46e5', color: '#fff', boxShadow: '0 4px 20px rgba(79,70,229,0.45)', letterSpacing: '-0.01em' }}>
              Start Creating Video →
            </button>
          </div>
        )}

        {/* Template grid */}
        {isVisual && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 18 }}>
            <SkipCard onClick={() => handleSelect('')} />
            {visible.map(t => (
              <TemplateCard key={t.id} template={t} selected={selected === t.id} onClick={() => handleSelect(t.id)} />
            ))}
            {visible.length === 0 && (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px 0', color: 'rgba(255,255,255,0.25)' }}>
                No templates match — try "All"
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
