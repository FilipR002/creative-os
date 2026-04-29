'use client';

// ─── TemplateGallery ──────────────────────────────────────────────────────────
// Full-page template picker shown as the first screen when creating a new ad.
// User picks a format tab → browses visual thumbnails → clicks to start.

import { useState } from 'react';
import type { TemplateMetadata } from '@/lib/api/creator-client';

// ── Types ─────────────────────────────────────────────────────────────────────

export type GalleryFormat = 'carousel' | 'image' | 'video';
type ToneFilter = 'all' | 'bold' | 'minimal' | 'premium' | 'friendly' | 'urgent' | 'energetic';

interface Props {
  templates: TemplateMetadata[];
  onSelect: (templateId: string, format: GalleryFormat) => void;
  defaultFormat?: GalleryFormat;
}

// ── Tone → gradient (shown when PNG thumbnail is missing) ─────────────────────

const TONE_GRADIENTS: Record<string, string> = {
  bold:      'linear-gradient(135deg, #1e1b4b 0%, #4f46e5 100%)',
  minimal:   'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
  premium:   'linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #854d0e 100%)',
  friendly:  'linear-gradient(135deg, #0f172a 0%, #1d4ed8 100%)',
  urgent:    'linear-gradient(135deg, #450a0a 0%, #dc2626 100%)',
  energetic: 'linear-gradient(135deg, #431407 0%, #ea580c 100%)',
};

const TONE_LABELS: Record<ToneFilter, string> = {
  all:       'All',
  bold:      '⚡ Bold',
  minimal:   '✦ Minimal',
  premium:   '💎 Premium',
  friendly:  '😊 Friendly',
  urgent:    '🔥 Urgent',
  energetic: '⚡ Energetic',
};

// ── TemplateCard ──────────────────────────────────────────────────────────────

function TemplateCard({
  template,
  selected,
  onClick,
}: {
  template: TemplateMetadata;
  selected: boolean;
  onClick:  () => void;
}) {
  const [imgError, setImgError] = useState(false);
  const [hovered,  setHovered]  = useState(false);

  const fallbackGradient = TONE_GRADIENTS[template.tones[0]] ?? TONE_GRADIENTS.bold;
  const isLight = template.tones[0] === 'minimal' || template.tones[0] === 'premium';

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Select ${template.name} template`}
      onClick={onClick}
      onKeyDown={e => e.key === 'Enter' && onClick()}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderRadius:  12,
        border:        `2px solid ${selected ? '#4f46e5' : hovered ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)'}`,
        cursor:        'pointer',
        overflow:      'hidden',
        transition:    'all 0.18s ease',
        transform:     hovered ? 'translateY(-3px) scale(1.015)' : 'none',
        boxShadow:     selected
          ? '0 0 0 3px rgba(79,70,229,0.35), 0 8px 24px rgba(0,0,0,0.4)'
          : hovered
          ? '0 8px 24px rgba(0,0,0,0.35)'
          : '0 2px 8px rgba(0,0,0,0.2)',
        background:    'var(--surface-2)',
        position:      'relative',
      }}
    >
      {/* ── Thumbnail ──────────────────────────────────────────────────────── */}
      <div style={{ position: 'relative', aspectRatio: '1 / 1', overflow: 'hidden' }}>
        {!imgError ? (
          <img
            src={`/templates/${template.id}.png`}
            alt={template.name}
            onError={() => setImgError(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          /* Fallback gradient when PNG not yet generated */
          <div style={{ width: '100%', height: '100%', background: fallbackGradient, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 20 }}>
            <div style={{ fontWeight: 900, fontSize: 15, textAlign: 'center', color: isLight ? '#1e293b' : '#fff', lineHeight: 1.2, textShadow: isLight ? 'none' : '0 1px 4px rgba(0,0,0,0.4)' }}>
              Transform Your Brand
            </div>
            <div style={{ fontSize: 10, color: isLight ? '#64748b' : 'rgba(255,255,255,0.7)', textAlign: 'center' }}>
              AI-powered creatives that convert
            </div>
            <div style={{ marginTop: 8, background: isLight ? '#1e293b' : '#fff', color: isLight ? '#fff' : '#1e293b', fontSize: 9, fontWeight: 800, padding: '5px 12px', borderRadius: 20, letterSpacing: '0.05em' }}>
              GET STARTED
            </div>
          </div>
        )}

        {/* Selected checkmark */}
        {selected && (
          <div style={{ position: 'absolute', top: 8, right: 8, width: 24, height: 24, borderRadius: '50%', background: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(79,70,229,0.5)' }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        )}

        {/* Requires image badge */}
        {template.requiresImage && (
          <div style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', borderRadius: 4, padding: '2px 6px', fontSize: 9, fontWeight: 700, color: '#fbbf24', letterSpacing: '0.06em' }}>
            IMG
          </div>
        )}

        {/* Hover overlay — "Use Template" */}
        {hovered && !selected && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(2px)' }}>
            <div style={{ background: '#4f46e5', color: '#fff', fontSize: 12, fontWeight: 700, padding: '9px 20px', borderRadius: 8, letterSpacing: '0.03em', boxShadow: '0 4px 16px rgba(79,70,229,0.5)' }}>
              Use Template
            </div>
          </div>
        )}
      </div>

      {/* ── Card footer ─────────────────────────────────────────────────────── */}
      <div style={{ padding: '10px 12px 12px' }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: selected ? '#a5b4fc' : 'var(--text)', marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {template.name}
        </div>
        <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {template.description}
        </div>
        {/* Tone badges */}
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

// ── "Skip" card — let AI auto-pick ────────────────────────────────────────────

function SkipCard({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Skip template — let AI choose"
      onClick={onClick}
      onKeyDown={e => e.key === 'Enter' && onClick()}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderRadius:  12,
        border:        `2px dashed ${hovered ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.12)'}`,
        cursor:        'pointer',
        overflow:      'hidden',
        transition:    'all 0.18s ease',
        transform:     hovered ? 'translateY(-3px)' : 'none',
        background:    hovered ? 'rgba(255,255,255,0.04)' : 'transparent',
      }}
    >
      <div style={{ aspectRatio: '1 / 1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 20 }}>
        <div style={{ fontSize: 32, opacity: 0.5 }}>✦</div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)', marginBottom: 4 }}>
            AI Auto-Select
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.5 }}>
            Let AI pick the best template for each slide based on your brief
          </div>
        </div>
      </div>
      <div style={{ padding: '0 12px 12px' }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--muted)', marginBottom: 3 }}>
          Skip — Auto
        </div>
        <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.4 }}>
          AI optimises per slide
        </div>
        <div style={{ marginTop: 8, height: 18 }} />
      </div>
    </div>
  );
}

// ── Main TemplateGallery ──────────────────────────────────────────────────────

export function TemplateGallery({ templates, onSelect, defaultFormat = 'carousel' }: Props) {
  const [format,     setFormat]     = useState<GalleryFormat>(defaultFormat);
  const [toneFilter, setToneFilter] = useState<ToneFilter>('all');
  const [selected,   setSelected]   = useState<string>('');

  const isVisualFormat = format !== 'video';

  // Filter templates based on tone filter
  const visibleTemplates = isVisualFormat
    ? templates.filter(t => toneFilter === 'all' || t.tones.includes(toneFilter as any))
    : [];

  function handleSelect(templateId: string) {
    setSelected(templateId);
    // Small delay so the user sees the selection checkmark before transition
    setTimeout(() => onSelect(templateId, format), 160);
  }

  function handleSkip() {
    setSelected('');
    onSelect('', format);
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg, #0f1117)', color: 'var(--text, #f1f5f9)', display: 'flex', flexDirection: 'column' }}>

      {/* ── Top bar ──────────────────────────────────────────────────────────── */}
      <div style={{ padding: '16px 40px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: 24, background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(12px)', position: 'sticky', top: 0, zIndex: 10 }}>
        {/* Logo */}
        <span style={{ fontSize: 17, fontWeight: 900, letterSpacing: '-0.02em' }}>✦ Creative OS</span>

        <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.12)' }} />

        {/* Format tabs */}
        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: 3, gap: 2 }}>
          {([
            ['carousel', '⊞', 'Carousel'],
            ['image',    '⬜', 'Banner'],
            ['video',    '▶', 'Video'],
          ] as [GalleryFormat, string, string][]).map(([id, icon, label]) => (
            <button key={id} onClick={() => { setFormat(id); setSelected(''); }}
              style={{ padding: '6px 18px', borderRadius: 8, border: 'none', fontFamily: 'inherit', fontWeight: 700, fontSize: 13, cursor: 'pointer', transition: 'all 0.15s',
                background: format === id ? '#4f46e5' : 'transparent',
                color:      format === id ? '#fff'    : 'rgba(255,255,255,0.5)' }}>
              {icon} {label}
            </button>
          ))}
        </div>

        {/* Tone pills — only for visual formats */}
        {isVisualFormat && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {(Object.keys(TONE_LABELS) as ToneFilter[]).map(tone => (
              <button key={tone} onClick={() => setToneFilter(tone)}
                style={{ padding: '4px 12px', borderRadius: 20, border: `1px solid ${toneFilter === tone ? '#4f46e5' : 'rgba(255,255,255,0.12)'}`, fontFamily: 'inherit', fontWeight: 600, fontSize: 11, cursor: 'pointer', transition: 'all 0.15s',
                  background: toneFilter === tone ? 'rgba(79,70,229,0.25)' : 'transparent',
                  color:      toneFilter === tone ? '#a5b4fc'              : 'rgba(255,255,255,0.5)' }}>
                {TONE_LABELS[tone]}
              </button>
            ))}
          </div>
        )}

        {/* Result count */}
        {isVisualFormat && (
          <span style={{ marginLeft: 'auto', fontSize: 12, color: 'rgba(255,255,255,0.35)', fontWeight: 500 }}>
            {visibleTemplates.length + 1} options
          </span>
        )}
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, padding: '40px 40px 60px', maxWidth: 1400, margin: '0 auto', width: '100%' }}>

        {/* Page title */}
        <div style={{ marginBottom: 36 }}>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.1 }}>
            {format === 'video'
              ? 'Create a Video Ad'
              : `Choose a ${format === 'image' ? 'Banner' : 'Carousel'} Template`}
          </h1>
          <p style={{ margin: '8px 0 0', fontSize: 14, color: 'rgba(255,255,255,0.45)', fontWeight: 400 }}>
            {format === 'video'
              ? 'Video style is AI-selected per scene — describe your product and let the engine decide.'
              : 'Pick the visual style that fits your brand. AI fills in the copy and images.'}
          </p>
        </div>

        {/* ── VIDEO: no template grid, just a CTA ──────────────────────────── */}
        {format === 'video' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 340, gap: 24 }}>
            <div style={{ fontSize: 56 }}>🎬</div>
            <div style={{ textAlign: 'center', maxWidth: 480 }}>
              <div style={{ fontWeight: 800, fontSize: 22, marginBottom: 10 }}>AI-Directed Video</div>
              <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>
                The engine auto-selects the best visual style, pacing, and text overlays per scene based on your brief, goal, and platform.
              </div>
            </div>
            <button
              onClick={() => onSelect('', 'video')}
              style={{ padding: '14px 36px', borderRadius: 10, border: 'none', fontFamily: 'inherit', fontWeight: 800, fontSize: 15, cursor: 'pointer', background: '#4f46e5', color: '#fff', boxShadow: '0 4px 20px rgba(79,70,229,0.45)', letterSpacing: '-0.01em', transition: 'all 0.15s' }}>
              Start Creating Video →
            </button>
          </div>
        )}

        {/* ── CAROUSEL / BANNER: template grid ─────────────────────────────── */}
        {isVisualFormat && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 20 }}>

            {/* Auto-select card first */}
            <SkipCard onClick={handleSkip} />

            {/* Template cards */}
            {visibleTemplates.map(template => (
              <TemplateCard
                key={template.id}
                template={template}
                selected={selected === template.id}
                onClick={() => handleSelect(template.id)}
              />
            ))}

            {/* Empty state */}
            {visibleTemplates.length === 0 && (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px 0', color: 'rgba(255,255,255,0.3)' }}>
                No templates match this filter — try "All"
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
