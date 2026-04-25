'use client';

import { useRef, useState } from 'react';
import type { CarouselSlide } from '@/lib/api/creative-client';

interface Props {
  slides: CarouselSlide[];
}

export function CarouselPreview({ slides }: Props) {
  const [current, setCurrent]   = useState(0);
  const trackRef                = useRef<HTMLDivElement>(null);
  const dragStart               = useRef<number | null>(null);
  const CARD_W                  = 300;

  function prev() { setCurrent(c => Math.max(0, c - 1)); }
  function next() { setCurrent(c => Math.min(slides.length - 1, c + 1)); }

  function onMouseDown(e: React.MouseEvent) { dragStart.current = e.clientX; }
  function onMouseUp(e: React.MouseEvent) {
    if (dragStart.current === null) return;
    const delta = dragStart.current - e.clientX;
    if (delta > 50)       next();
    else if (delta < -50) prev();
    dragStart.current = null;
  }
  function onTouchStart(e: React.TouchEvent) {
    dragStart.current = e.touches[0].clientX;
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (dragStart.current === null) return;
    const delta = dragStart.current - e.changedTouches[0].clientX;
    if (delta > 50)       next();
    else if (delta < -50) prev();
    dragStart.current = null;
  }

  if (!slides.length) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
      {/* Slide count indicator */}
      <div style={{ display: 'flex', gap: 6 }}>
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            style={{
              width:        i === current ? 20 : 6,
              height:       6,
              borderRadius: 3,
              background:   i === current ? 'var(--accent)' : 'rgba(255,255,255,0.2)',
              border:       'none',
              cursor:       'pointer',
              transition:   'width 0.2s, background 0.2s',
              padding:      0,
            }}
          />
        ))}
      </div>

      {/* Track */}
      <div
        style={{ position: 'relative', width: CARD_W, overflow: 'hidden', userSelect: 'none' }}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div
          ref={trackRef}
          style={{
            display:    'flex',
            transform:  `translateX(-${current * CARD_W}px)`,
            transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)',
          }}
        >
          {slides.map((slide, i) => (
            <div
              key={i}
              style={{
                minWidth:     CARD_W,
                aspectRatio:  '4/5',
                background:   i % 2 === 0
                  ? 'linear-gradient(145deg, #0F1621, #131C2A)'
                  : 'linear-gradient(145deg, #131C2A, #1A2235)',
                border:       '1px solid var(--border)',
                borderRadius: 16,
                padding:      28,
                display:      'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
                gap:          12,
              }}
            >
              {/* Slide number */}
              <div style={{
                position:     'absolute',
                top:          20,
                right:        20,
                fontSize:     11,
                fontWeight:   600,
                color:        'var(--muted)',
                background:   'rgba(0,0,0,0.4)',
                borderRadius: 20,
                padding:      '3px 9px',
              }}>
                {i + 1} / {slides.length}
              </div>

              {/* Content */}
              <div>
                <div style={{
                  fontSize:     18,
                  fontWeight:   700,
                  color:        'var(--text)',
                  lineHeight:   1.3,
                  marginBottom: 8,
                }}>
                  {slide.headline}
                </div>
                {slide.subtext && (
                  <div style={{ fontSize: 13, color: 'var(--sub)', lineHeight: 1.5 }}>
                    {slide.subtext}
                  </div>
                )}
                {slide.cta && (
                  <div style={{
                    marginTop:    14,
                    display:      'inline-flex',
                    alignItems:   'center',
                    gap:          6,
                    fontSize:     12,
                    fontWeight:   600,
                    color:        'var(--accent)',
                    background:   'rgba(0,201,122,0.1)',
                    border:       '1px solid rgba(0,201,122,0.25)',
                    borderRadius: 6,
                    padding:      '6px 12px',
                  }}>
                    {slide.cta}
                    <span style={{ fontSize: 10 }}>→</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Arrow controls */}
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={prev}
          disabled={current === 0}
          style={{
            width:        36,
            height:       36,
            borderRadius: '50%',
            background:   current === 0 ? 'rgba(255,255,255,0.04)' : 'var(--surface)',
            border:       '1px solid var(--border)',
            color:        current === 0 ? 'var(--muted)' : 'var(--text)',
            display:      'flex',
            alignItems:   'center',
            justifyContent: 'center',
            cursor:       current === 0 ? 'default' : 'pointer',
            fontSize:     14,
            transition:   'background 0.15s',
          }}
        >
          ←
        </button>
        <button
          onClick={next}
          disabled={current === slides.length - 1}
          style={{
            width:        36,
            height:       36,
            borderRadius: '50%',
            background:   current === slides.length - 1 ? 'rgba(255,255,255,0.04)' : 'var(--surface)',
            border:       '1px solid var(--border)',
            color:        current === slides.length - 1 ? 'var(--muted)' : 'var(--text)',
            display:      'flex',
            alignItems:   'center',
            justifyContent: 'center',
            cursor:       current === slides.length - 1 ? 'default' : 'pointer',
            fontSize:     14,
            transition:   'background 0.15s',
          }}
        >
          →
        </button>
      </div>
    </div>
  );
}
