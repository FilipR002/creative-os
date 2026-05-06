'use client';

import { useState } from 'react';
import type { BannerVariant } from '@/lib/api/creative-client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Theme {
  bg: string; fg: string; accent: string; muted: string;
  ctaBg: string; ctaFg: string; ctaBorder?: string;
}

type AID =
  | 'product-drop' | 'bold-type'    | 'offer-flash'  | 'photo-overlay'
  | 'split-panel'  | 'social-proof' | 'stat-bomb'    | 'dark-minimal';

type Cat = 'square' | 'wide' | 'tall' | 'rect' | 'strip' | 'sky';

// ─── Archetype catalogue ──────────────────────────────────────────────────────

const ARCHETYPES: { id: AID; label: string; icon: string; t: Theme }[] = [
  {
    id: 'product-drop', label: 'Product Drop', icon: '📦',
    t: { bg:'#f0f4ff', fg:'#1e1b4b', accent:'#4f46e5', muted:'#818cf8', ctaBg:'#4f46e5', ctaFg:'#fff' },
  },
  {
    id: 'bold-type', label: 'Bold Type', icon: '✦',
    t: { bg:'#09090b', fg:'#fafafa', accent:'#a3e635', muted:'rgba(250,250,250,0.4)', ctaBg:'#a3e635', ctaFg:'#09090b' },
  },
  {
    id: 'offer-flash', label: 'Offer Flash', icon: '⚡',
    t: { bg:'#0c0500', fg:'#fff', accent:'#f97316', muted:'rgba(255,255,255,0.5)', ctaBg:'#f97316', ctaFg:'#fff' },
  },
  {
    id: 'photo-overlay', label: 'Photo Overlay', icon: '🌆',
    t: { bg:'#0c1520', fg:'#fff', accent:'#38bdf8', muted:'rgba(255,255,255,0.45)', ctaBg:'#38bdf8', ctaFg:'#0c1520' },
  },
  {
    id: 'split-panel', label: 'Split Panel', icon: '▐',
    t: { bg:'#fff', fg:'#0f172a', accent:'#6366f1', muted:'#94a3b8', ctaBg:'#6366f1', ctaFg:'#fff' },
  },
  {
    id: 'social-proof', label: 'Social Proof', icon: '★',
    t: { bg:'#fffbf0', fg:'#1c1917', accent:'#d97706', muted:'#78716c', ctaBg:'#d97706', ctaFg:'#fff' },
  },
  {
    id: 'stat-bomb', label: 'Stat Bomb', icon: '📊',
    t: { bg:'#fff', fg:'#0f172a', accent:'#4f46e5', muted:'#94a3b8', ctaBg:'#4f46e5', ctaFg:'#fff' },
  },
  {
    id: 'dark-minimal', label: 'Dark Minimal', icon: '◼',
    t: { bg:'#09090b', fg:'#fafafa', accent:'#22d3ee', muted:'rgba(250,250,250,0.3)', ctaBg:'transparent', ctaFg:'#22d3ee', ctaBorder:'1px solid #22d3ee' },
  },
];

// ─── Size catalogue ───────────────────────────────────────────────────────────

const SIZES: { key: string; label: string; ratio: number; dw: number; cat: Cat; span?: boolean }[] = [
  { key:'1080x1080', label:'Square',      ratio: 1,          dw: 148, cat:'square' },
  { key:'1200x628',  label:'Landscape',   ratio: 628/1200,   dw: 190, cat:'wide'   },
  { key:'1080x1920', label:'Story',       ratio: 1920/1080,  dw: 100, cat:'tall'   },
  { key:'300x250',   label:'Rectangle',   ratio: 250/300,    dw: 140, cat:'rect'   },
  { key:'728x90',    label:'Leaderboard', ratio: 90/728,     dw: 240, cat:'strip', span: true },
  { key:'160x600',   label:'Skyscraper',  ratio: 600/160,    dw: 68,  cat:'sky'    },
];

// ─── Shared micro-components ──────────────────────────────────────────────────

/** Scale px relative to 148px (square) reference width */
function sc(n: number, dw: number) { return Math.max(4, Math.round(n * dw / 148)); }

const C: React.CSSProperties = { display:'flex', flexDirection:'column' };
const R: React.CSSProperties = { display:'flex', flexDirection:'row', alignItems:'center' };
const ABS: React.CSSProperties = { position:'absolute', inset:0 };

function Brand({ dw, color }: { dw: number; color: string }) {
  const s = sc(8, dw);
  return (
    <div style={{ ...R, gap: sc(3, dw) }}>
      <div style={{ width: s, height: s, borderRadius: sc(2, dw), background: color, flexShrink: 0 }} />
      <span style={{ fontSize: sc(7, dw), fontWeight: 800, color, letterSpacing: '-0.02em', lineHeight: 1 }}>brand</span>
    </div>
  );
}

function Btn({ label, t, dw, full }: { label: string; t: Theme; dw: number; full?: boolean }) {
  return (
    <div style={{
      display:'inline-flex', alignItems:'center', justifyContent:'center',
      background: t.ctaBg, color: t.ctaFg, border: t.ctaBorder ?? 'none',
      borderRadius: sc(4, dw), padding:`${sc(4, dw)}px ${sc(9, dw)}px`,
      fontSize: sc(8, dw), fontWeight: 700, lineHeight: 1, whiteSpace:'nowrap',
      width: full ? '100%' : 'auto', boxSizing:'border-box',
    }}>
      {label}
    </div>
  );
}

function Stars({ dw, color }: { dw: number; color: string }) {
  return (
    <div style={{ ...R, gap: sc(1, dw) }}>
      {[0,1,2,3,4].map(i => <span key={i} style={{ fontSize: sc(9, dw), color, lineHeight: 1 }}>★</span>)}
    </div>
  );
}

// ─── Per-archetype render engine ──────────────────────────────────────────────

function renderContent(
  id: AID, cat: Cat, dw: number,
  hl: string, cta: string, t: Theme,
): React.ReactNode {
  const p   = sc(10, dw);
  const gap = sc(6, dw);

  // Column wrapper — most archetypes use this for square/tall/rect
  const col = (children: React.ReactNode) => (
    <div style={{ ...ABS, ...C, padding: p, gap, background: t.bg }}>{children}</div>
  );

  // Trimmed headlines
  const h25 = hl.slice(0, 25);
  const h40 = hl.slice(0, 40);
  const h60 = hl.slice(0, 60);

  // ── STRIP (leaderboard 728×90): all archetypes → horizontal bar ───────────
  if (cat === 'strip') {
    const isSplit = id === 'split-panel';
    return (
      <div style={{ ...ABS, ...R, padding: `0 ${p}px`, gap: sc(8, dw), background: t.bg, overflow:'hidden' }}>
        {isSplit && <div style={{ ...ABS, left: 0, right:'65%', background: t.accent }} />}
        <Brand dw={dw} color={isSplit ? '#fff' : t.accent} />
        <div style={{ flex:1, fontSize: sc(11, dw), fontWeight: 800, color: t.fg, lineHeight:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {h40}
        </div>
        {id === 'offer-flash' && (
          <span style={{ fontSize: sc(9, dw), fontWeight:800, color: t.accent, whiteSpace:'nowrap' }}>50% OFF</span>
        )}
        {id === 'stat-bomb' && (
          <span style={{ fontSize: sc(11, dw), fontWeight:900, color: t.accent, whiteSpace:'nowrap' }}>312%</span>
        )}
        <Btn label={cta} t={t} dw={dw} />
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PRODUCT DROP
  // ─────────────────────────────────────────────────────────────────────────
  if (id === 'product-drop') {
    const product = (size: number) => (
      <div style={{ position:'relative', width: sc(size, dw), height: sc(size, dw), display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ ...ABS, borderRadius: sc(10, dw), background:`${t.accent}18` }} />
        <div style={{ width:'72%', height:'72%', borderRadius: sc(8, dw), background: t.accent, boxShadow:`0 ${sc(6, dw)}px ${sc(18, dw)}px ${t.accent}55` }} />
      </div>
    );

    if (cat === 'sky') return (
      <div style={{ ...ABS, ...C, background: t.bg, padding: p, gap: sc(5, dw), alignItems:'center' }}>
        <Brand dw={dw} color={t.accent} />
        <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center' }}>{product(48)}</div>
        <div style={{ fontSize: sc(8, dw), fontWeight: 900, color: t.fg, lineHeight:1.2, textAlign:'center', width:'100%' }}>{h25}</div>
        <Btn label={cta} t={t} dw={dw} full />
      </div>
    );

    if (cat === 'wide') return (
      <div style={{ ...ABS, ...R, background: t.bg, overflow:'hidden' }}>
        <div style={{ flex:1, ...C, padding:`${p}px`, gap: sc(5, dw) }}>
          <Brand dw={dw} color={t.accent} />
          <div style={{ fontSize: sc(13, dw), fontWeight: 900, color: t.fg, lineHeight:1.1, letterSpacing:'-0.02em' }}>{h40}</div>
          <Btn label={cta} t={t} dw={dw} />
        </div>
        <div style={{ width: sc(72, dw), height:'100%', background:`${t.accent}10`, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
          {product(56)}
        </div>
      </div>
    );

    return col(
      <>
        <div style={{ ...R, justifyContent:'space-between' }}>
          <Brand dw={dw} color={t.accent} />
          <div style={{ background: t.accent, color:'#fff', borderRadius: sc(4, dw), padding:`${sc(2, dw)}px ${sc(6, dw)}px`, fontSize: sc(7, dw), fontWeight:800 }}>$49</div>
        </div>
        <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center' }}>{product(cat === 'tall' ? 64 : 52)}</div>
        <div style={{ fontSize: sc(cat === 'rect' ? 10 : 12, dw), fontWeight:900, color: t.fg, lineHeight:1.15, letterSpacing:'-0.02em' }}>{h40}</div>
        <Btn label={cta} t={t} dw={dw} full />
      </>,
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // BOLD TYPE
  // ─────────────────────────────────────────────────────────────────────────
  if (id === 'bold-type') {
    if (cat === 'sky') return (
      <div style={{ ...ABS, ...C, background: t.bg, padding: p, gap: sc(6, dw), justifyContent:'flex-end' }}>
        <div style={{ width: sc(20, dw), height: sc(2, dw), background: t.accent }} />
        <div style={{ fontSize: sc(10, dw), fontWeight:900, color: t.fg, lineHeight:1.05, letterSpacing:'-0.03em', flex:1, display:'flex', alignItems:'center' }}>{h25}</div>
        <Btn label={cta} t={t} dw={dw} full />
        <Brand dw={dw} color={t.muted} />
      </div>
    );

    if (cat === 'wide') return (
      <div style={{ ...ABS, ...R, background: t.bg, padding: `0 ${p}px`, gap: sc(10, dw), overflow:'hidden' }}>
        <div style={{ ...C, gap: sc(6, dw), flex:1 }}>
          <div style={{ fontSize: sc(19, dw), fontWeight:900, color: t.fg, lineHeight:0.93, letterSpacing:'-0.04em' }}>{h40}</div>
          <div style={{ ...R, gap: sc(8, dw) }}>
            <Brand dw={dw} color={t.muted} />
            <Btn label={cta} t={t} dw={dw} />
          </div>
        </div>
        <div style={{ fontSize: sc(52, dw), color:`${t.accent}14`, fontWeight:900, letterSpacing:'-0.1em', lineHeight:0.9, flexShrink:0 }}>✦</div>
      </div>
    );

    return col(
      <>
        <div style={{ flex:1, display:'flex', alignItems:'center' }}>
          <div style={{ fontSize: sc(cat === 'rect' ? 16 : cat === 'tall' ? 13 : 21, dw), fontWeight:900, color: t.fg, lineHeight:0.93, letterSpacing:'-0.04em' }}>
            {h40}
          </div>
        </div>
        <div style={{ height: sc(1, dw), background:`${t.accent}44`, width:'100%' }} />
        <div style={{ ...R, justifyContent:'space-between' }}>
          <Brand dw={dw} color={t.muted} />
          <Btn label={cta} t={t} dw={dw} />
        </div>
      </>,
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // OFFER FLASH
  // ─────────────────────────────────────────────────────────────────────────
  if (id === 'offer-flash') {
    const badge = (fsBig: number, fsSub: number) => (
      <div style={{ background: t.accent, borderRadius: sc(8, dw), padding:`${sc(5, dw)}px ${sc(10, dw)}px`, alignSelf:'flex-start' }}>
        <div style={{ fontSize: sc(fsBig, dw), fontWeight:900, color:'#fff', lineHeight:1, letterSpacing:'-0.04em' }}>50% OFF</div>
        <div style={{ fontSize: sc(fsSub, dw), fontWeight:700, color:'rgba(255,255,255,0.7)', marginTop: sc(1, dw) }}>Today only</div>
      </div>
    );

    if (cat === 'sky') return (
      <div style={{ ...ABS, ...C, background: t.bg, padding: p, gap: sc(5, dw), justifyContent:'space-between', alignItems:'center' }}>
        <Brand dw={dw} color={t.accent} />
        <div style={{ ...C, alignItems:'center', gap: sc(3, dw) }}>
          <div style={{ background: t.accent, borderRadius: sc(6, dw), padding:`${sc(5, dw)}px ${sc(7, dw)}px`, textAlign:'center' }}>
            <div style={{ fontSize: sc(14, dw), fontWeight:900, color:'#fff', lineHeight:1, letterSpacing:'-0.04em' }}>50%</div>
            <div style={{ fontSize: sc(6, dw), fontWeight:800, color:'rgba(255,255,255,0.8)', letterSpacing:'0.06em' }}>OFF</div>
          </div>
          <span style={{ fontSize: sc(7, dw), color: t.muted, textDecoration:'line-through' }}>$199</span>
          <span style={{ fontSize: sc(12, dw), fontWeight:900, color:'#fff' }}>$97</span>
        </div>
        <Btn label={cta} t={t} dw={dw} full />
      </div>
    );

    if (cat === 'wide') return (
      <div style={{ ...ABS, ...R, background: t.bg, padding:`0 ${p}px`, gap: sc(10, dw), overflow:'hidden' }}>
        {badge(22, 7)}
        <div style={{ ...C, gap: sc(4, dw), flex:1 }}>
          <div style={{ fontSize: sc(12, dw), fontWeight:900, color: t.fg, lineHeight:1.1 }}>{h40}</div>
          <div style={{ ...R, gap: sc(8, dw) }}>
            <span style={{ fontSize: sc(7, dw), color: t.muted, textDecoration:'line-through' }}>$199</span>
            <span style={{ fontSize: sc(12, dw), fontWeight:900, color: t.accent }}>$97</span>
          </div>
          <Btn label={cta} t={t} dw={dw} />
        </div>
      </div>
    );

    return col(
      <>
        <Brand dw={dw} color={t.accent} />
        {badge(cat === 'rect' ? 18 : 22, 6)}
        <div style={{ fontSize: sc(10, dw), fontWeight:800, color: t.fg, lineHeight:1.2 }}>{h40}</div>
        <div style={{ ...R, gap: sc(8, dw) }}>
          <span style={{ fontSize: sc(8, dw), color: t.muted, textDecoration:'line-through' }}>$199</span>
          <span style={{ fontSize: sc(13, dw), fontWeight:900, color: t.accent }}>$97</span>
        </div>
        {cat !== 'rect' && <div style={{ fontSize: sc(7, dw), color: t.muted }}>⏰ Limited-time offer</div>}
        <Btn label={cta} t={t} dw={dw} full />
      </>,
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PHOTO OVERLAY
  // ─────────────────────────────────────────────────────────────────────────
  if (id === 'photo-overlay') {
    // Fake photo texture: diagonal stripes + colour noise
    const photoBg = (
      <>
        <div style={{ ...ABS, backgroundImage: `repeating-linear-gradient(135deg, ${t.accent}06 0px, ${t.accent}06 2px, transparent 2px, transparent 13px)` }} />
        <div style={{ ...ABS, background:`linear-gradient(to top, ${t.bg} 0%, ${t.bg}cc 45%, transparent 72%)` }} />
      </>
    );

    if (cat === 'sky') return (
      <div style={{ ...ABS, ...C, background: t.bg, justifyContent:'flex-end', overflow:'hidden' }}>
        {photoBg}
        <div style={{ ...C, padding: p, gap: sc(5, dw), zIndex:1 }}>
          <div style={{ fontSize: sc(9, dw), fontWeight:800, color: t.fg, lineHeight:1.2 }}>{h25}</div>
          <Btn label={cta} t={t} dw={dw} full />
          <Brand dw={dw} color={t.accent} />
        </div>
      </div>
    );

    if (cat === 'wide') return (
      <div style={{ ...ABS, background: t.bg, overflow:'hidden' }}>
        {photoBg}
        <div style={{ ...ABS, ...R, padding:`0 ${p}px`, zIndex:1 }}>
          <div style={{ ...C, gap: sc(5, dw), maxWidth:'62%' }}>
            <Brand dw={dw} color={t.accent} />
            <div style={{ fontSize: sc(13, dw), fontWeight:900, color: t.fg, lineHeight:1.1 }}>{h40}</div>
            <Btn label={cta} t={t} dw={dw} />
          </div>
        </div>
      </div>
    );

    return (
      <div style={{ ...ABS, background: t.bg, overflow:'hidden', ...C, justifyContent:'flex-end' }}>
        {photoBg}
        <div style={{ ...C, padding: p, gap: sc(5, dw), zIndex:1 }}>
          {cat !== 'rect' && <Brand dw={dw} color={t.accent} />}
          <div style={{ fontSize: sc(cat === 'rect' ? 10 : 12, dw), fontWeight:900, color: t.fg, lineHeight:1.15 }}>{h40}</div>
          <Btn label={cta} t={t} dw={dw} full />
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SPLIT PANEL
  // ─────────────────────────────────────────────────────────────────────────
  if (id === 'split-panel') {
    const visual = (size: number) => (
      <div style={{ position:'relative', width: sc(size, dw), height: sc(size, dw), display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ ...ABS, borderRadius: sc(10, dw), background:'rgba(255,255,255,0.15)' }} />
        <div style={{ width:'65%', height:'65%', borderRadius: sc(8, dw), background:'rgba(255,255,255,0.4)' }} />
      </div>
    );

    if (cat === 'sky') return (
      <div style={{ ...ABS, ...C, overflow:'hidden' }}>
        <div style={{ flex:1.1, background: t.accent, display:'flex', alignItems:'center', justifyContent:'center' }}>{visual(36)}</div>
        <div style={{ flex:1, background: t.bg, ...C, padding:`${sc(5, dw)}px ${sc(6, dw)}px`, gap: sc(4, dw) }}>
          <div style={{ fontSize: sc(7, dw), fontWeight:800, color: t.fg, lineHeight:1.2 }}>{h25}</div>
          <Btn label={cta} t={t} dw={dw} full />
        </div>
      </div>
    );

    if (cat === 'wide' || cat === 'rect') return (
      <div style={{ ...ABS, ...R, overflow:'hidden' }}>
        <div style={{ flex:1, background: t.accent, height:'100%', display:'flex', alignItems:'center', justifyContent:'center' }}>{visual(44)}</div>
        <div style={{ flex:1.3, ...C, padding:`${sc(8, dw)}px`, gap: sc(5, dw) }}>
          <Brand dw={dw} color={t.accent} />
          <div style={{ fontSize: sc(cat === 'wide' ? 12 : 9, dw), fontWeight:800, color: t.fg, lineHeight:1.2 }}>{h40}</div>
          <Btn label={cta} t={t} dw={dw} />
        </div>
      </div>
    );

    return (
      <div style={{ ...ABS, ...C, overflow:'hidden' }}>
        <div style={{ flex: cat === 'tall' ? 1.3 : 1, background: t.accent, display:'flex', alignItems:'center', justifyContent:'center' }}>{visual(58)}</div>
        <div style={{ flex:1, background: t.bg, ...C, padding:`${p}px`, gap: sc(5, dw) }}>
          <Brand dw={dw} color={t.accent} />
          <div style={{ fontSize: sc(11, dw), fontWeight:800, color: t.fg, lineHeight:1.2 }}>{h40}</div>
          <Btn label={cta} t={t} dw={dw} full />
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SOCIAL PROOF
  // ─────────────────────────────────────────────────────────────────────────
  if (id === 'social-proof') {
    const avatar = (
      <div style={{ width: sc(18, dw), height: sc(18, dw), borderRadius:'50%', background: t.accent, flexShrink:0 }} />
    );

    if (cat === 'sky') return (
      <div style={{ ...ABS, ...C, background: t.bg, padding: p, gap: sc(4, dw) }}>
        <Brand dw={dw} color={t.accent} />
        <Stars dw={dw} color={t.accent} />
        <div style={{ fontSize: sc(7, dw), color: t.fg, fontStyle:'italic', lineHeight:1.3, flex:1 }}>"{h25}"</div>
        <div style={{ fontSize: sc(6, dw), color: t.muted }}>— Sarah K.</div>
        <Btn label={cta} t={t} dw={dw} full />
      </div>
    );

    if (cat === 'wide') return (
      <div style={{ ...ABS, ...R, background: t.bg, padding:`0 ${p}px`, gap: sc(10, dw), overflow:'hidden' }}>
        <div style={{ ...C, flex:1, gap: sc(5, dw) }}>
          <Stars dw={dw} color={t.accent} />
          <div style={{ fontSize: sc(12, dw), color: t.fg, fontStyle:'italic', fontWeight:500, lineHeight:1.2 }}>"{h40}"</div>
          <div style={{ ...R, gap: sc(6, dw) }}>
            {avatar}
            <span style={{ fontSize: sc(7, dw), color: t.muted }}>Sarah K. · Verified buyer</span>
          </div>
        </div>
        <div style={{ ...C, gap: sc(6, dw), alignItems:'flex-end', flexShrink:0 }}>
          <Btn label={cta} t={t} dw={dw} />
          <Brand dw={dw} color={t.accent} />
        </div>
      </div>
    );

    return col(
      <>
        <Stars dw={dw} color={t.accent} />
        <div style={{ fontSize: sc(cat === 'rect' ? 8 : 10, dw), color: t.fg, fontStyle:'italic', fontWeight:500, lineHeight:1.3, flex: cat === 'tall' ? 1 : 'none' }}>
          "{cat === 'tall' ? h60 : h40}"
        </div>
        <div style={{ ...R, gap: sc(5, dw) }}>
          {avatar}
          <div style={{ ...C, gap: 0 }}>
            <span style={{ fontSize: sc(7, dw), color: t.fg, fontWeight:700 }}>Sarah K.</span>
            <span style={{ fontSize: sc(6, dw), color: t.muted }}>Verified customer</span>
          </div>
        </div>
        {cat !== 'rect' && <div style={{ height: sc(1, dw), background:`${t.accent}33`, width:'100%' }} />}
        <Btn label={cta} t={t} dw={dw} full />
      </>,
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STAT BOMB
  // ─────────────────────────────────────────────────────────────────────────
  if (id === 'stat-bomb') {
    if (cat === 'sky') return (
      <div style={{ ...ABS, ...C, background: t.bg, padding: p, gap: sc(5, dw), alignItems:'center', justifyContent:'center' }}>
        <Brand dw={dw} color={t.accent} />
        <div style={{ height: sc(1, dw), background:`${t.accent}22`, width:'100%' }} />
        <div style={{ fontSize: sc(28, dw), fontWeight:900, color: t.accent, lineHeight:1, letterSpacing:'-0.05em', textAlign:'center' }}>312%</div>
        <div style={{ fontSize: sc(6, dw), color: t.muted, textAlign:'center' }}>avg growth</div>
        <div style={{ height: sc(1, dw), background:`${t.accent}22`, width:'100%' }} />
        <Btn label={cta} t={t} dw={dw} full />
      </div>
    );

    if (cat === 'wide') return (
      <div style={{ ...ABS, ...R, background: t.bg, padding:`0 ${sc(16, dw)}px`, gap: sc(14, dw), overflow:'hidden' }}>
        <div style={{ fontSize: sc(46, dw), fontWeight:900, color: t.accent, lineHeight:1, letterSpacing:'-0.06em', flexShrink:0 }}>312%</div>
        <div style={{ ...C, gap: sc(4, dw), flex:1 }}>
          <div style={{ height: sc(2, dw), background: t.accent, width: sc(20, dw) }} />
          <div style={{ fontSize: sc(10, dw), color: t.fg, fontWeight:700, lineHeight:1.2 }}>{h40}</div>
          <div style={{ ...R, gap: sc(8, dw) }}>
            <Btn label={cta} t={t} dw={dw} />
            <Brand dw={dw} color={t.muted} />
          </div>
        </div>
      </div>
    );

    return col(
      <>
        <Brand dw={dw} color={t.accent} />
        <div style={{ height: sc(1, dw), background:`${t.accent}22`, width:'100%' }} />
        <div style={{ flex: cat === 'tall' ? 1 : 'none', display:'flex', alignItems:'center' }}>
          <div style={{ fontSize: sc(cat === 'rect' ? 32 : 40, dw), fontWeight:900, color: t.accent, lineHeight:1, letterSpacing:'-0.06em' }}>312%</div>
        </div>
        <div style={{ fontSize: sc(cat === 'rect' ? 7 : 8, dw), color: t.muted, lineHeight:1.3 }}>
          average growth in 90 days
        </div>
        <div style={{ height: sc(1, dw), background:`${t.accent}22`, width:'100%' }} />
        <Btn label={cta} t={t} dw={dw} full />
      </>,
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DARK MINIMAL
  // ─────────────────────────────────────────────────────────────────────────
  if (id === 'dark-minimal') {
    if (cat === 'sky') return (
      <div style={{ ...ABS, ...C, background: t.bg, padding: p, gap: sc(7, dw), justifyContent:'center' }}>
        <div style={{ height: sc(2, dw), background: t.accent, width: sc(20, dw) }} />
        <div style={{ fontSize: sc(9, dw), fontWeight:700, color: t.fg, lineHeight:1.3 }}>{h25}</div>
        <div style={{ fontSize: sc(7, dw), color: t.accent }}>{cta} →</div>
        <div style={{ marginTop:'auto' }}><Brand dw={dw} color={t.muted} /></div>
      </div>
    );

    if (cat === 'wide') return (
      <div style={{ ...ABS, ...R, background: t.bg, padding:`0 ${p}px`, gap: sc(12, dw), overflow:'hidden' }}>
        <div style={{ ...C, gap: sc(7, dw), flex:1 }}>
          <div style={{ height: sc(1, dw), background: t.accent, width: sc(24, dw) }} />
          <div style={{ fontSize: sc(14, dw), fontWeight:800, color: t.fg, lineHeight:1.05, letterSpacing:'-0.03em' }}>{h40}</div>
          <div style={{ ...R, gap: sc(10, dw) }}>
            <div style={{ fontSize: sc(8, dw), color: t.accent }}>{cta} →</div>
            <Brand dw={dw} color={t.muted} />
          </div>
        </div>
        <div style={{ fontSize: sc(44, dw), color:`${t.accent}0a`, fontWeight:900, flexShrink:0, lineHeight:1 }}>◼</div>
      </div>
    );

    return col(
      <>
        <Brand dw={dw} color={t.muted} />
        <div style={{ flex:1, ...C, justifyContent:'center', gap: sc(6, dw) }}>
          <div style={{ height: sc(1, dw), background: t.accent, width: sc(24, dw) }} />
          <div style={{ fontSize: sc(cat === 'rect' ? 10 : cat === 'tall' ? 11 : 14, dw), fontWeight:800, color: t.fg, lineHeight:1.1, letterSpacing:'-0.03em' }}>{h40}</div>
          {cat !== 'rect' && <div style={{ fontSize: sc(7, dw), color: t.muted }}>{h25}</div>}
        </div>
        <div style={{ ...R, justifyContent:'space-between' }}>
          <div style={{ fontSize: sc(8, dw), color: t.accent }}>{cta} →</div>
          {cat !== 'rect' && <div style={{ fontSize: sc(6, dw), color: t.muted, letterSpacing:'0.06em', textTransform:'uppercase' }}>brand.com</div>}
        </div>
      </>,
    );
  }

  return null;
}

// ─── BannerUnit ───────────────────────────────────────────────────────────────

function BannerUnit({
  archetypeId, cat, dw, label, sizeKey, headline, cta, imageUrl, theme,
}: {
  archetypeId: AID; cat: Cat; dw: number; label: string; sizeKey: string;
  headline: string; cta: string; imageUrl?: string; theme: Theme;
}) {
  const meta  = SIZES.find(s => s.key === sizeKey);
  const ratio = meta?.ratio ?? 1;
  const dh    = Math.round(dw * ratio);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap: 6, alignItems:'flex-start' }}>
      <div style={{ fontSize: 10, color:'var(--muted)', fontWeight: 500, letterSpacing:'0.01em' }}>
        {label} <span style={{ color:'var(--border2)' }}>·</span> {sizeKey}
      </div>
      <div style={{
        width: dw, height: dh,
        borderRadius: 6,
        overflow: 'hidden',
        border: '1px solid var(--border)',
        position: 'relative',
        flexShrink: 0,
      }}>
        {imageUrl ? (
          <img src={imageUrl} alt={label} style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} />
        ) : (
          renderContent(archetypeId, cat, dw, headline, cta, theme)
        )}
      </div>
    </div>
  );
}

// ─── BannerGrid (main export) ─────────────────────────────────────────────────

interface Props {
  banners:  BannerVariant[];
  headline: string;
  cta:      string;
}

export function BannerGrid({ banners, headline, cta }: Props) {
  const [arcIdx, setArcIdx] = useState(0);

  const arc     = ARCHETYPES[arcIdx];
  const hasImgs = banners.some(b => b.imageUrl && b.imageUrl.length > 0);

  // If API returned real images → show them at correct aspect ratio
  if (hasImgs) {
    const display = banners.length > 0 ? banners : SIZES.map(s => ({ size: s.key, imageUrl:'', headline }));
    return (
      <div style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap: 16, width:'100%', maxWidth: 520 }}>
        {display.map((b, i) => {
          const meta = SIZES.find(s => s.key === b.size);
          return (
            <BannerUnit
              key={i}
              archetypeId={arc.id}
              cat={meta?.cat ?? 'square'}
              dw={meta?.dw ?? 148}
              label={meta?.label ?? b.size}
              sizeKey={b.size}
              headline={b.headline || headline}
              cta={cta}
              imageUrl={b.imageUrl || undefined}
              theme={arc.t}
            />
          );
        })}
      </div>
    );
  }

  // Gallery / placeholder mode — archetype picker + all 6 sizes
  return (
    <div style={{ display:'flex', flexDirection:'column', gap: 16, width:'100%', maxWidth: 520 }}>

      {/* Archetype selector */}
      <div style={{ display:'flex', gap: 6, flexWrap:'wrap' }}>
        {ARCHETYPES.map((a, i) => (
          <button
            key={a.id}
            onClick={() => setArcIdx(i)}
            style={{
              display:'inline-flex', alignItems:'center', gap: 5,
              padding:'4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
              cursor:'pointer', fontFamily:'inherit', transition:'all 0.15s',
              background: i === arcIdx ? 'var(--accent)'    : 'var(--surface-2)',
              border:     `1px solid ${i === arcIdx ? 'var(--accent)' : 'var(--border)'}`,
              color:      i === arcIdx ? '#fff'              : 'var(--sub)',
            }}
          >
            <span>{a.icon}</span>{a.label}
          </button>
        ))}
      </div>

      {/* Size grid */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 14, alignItems:'start' }}>
        {SIZES.map(s => (
          <div key={s.key} style={{ gridColumn: s.span ? '1 / -1' : undefined }}>
            <BannerUnit
              archetypeId={arc.id}
              cat={s.cat}
              dw={s.dw}
              label={s.label}
              sizeKey={s.key}
              headline={headline || 'Your headline goes here for maximum impact'}
              cta={cta || 'Learn More'}
              theme={arc.t}
            />
          </div>
        ))}
      </div>

      {/* Legend */}
      <div style={{ fontSize: 10, color:'var(--muted)', display:'flex', gap: 6, alignItems:'center' }}>
        <span style={{ width: 8, height: 8, borderRadius:'50%', background:'var(--accent)', display:'inline-block', flexShrink:0 }} />
        {arc.label} archetype · 6 IAB standard sizes
      </div>
    </div>
  );
}
