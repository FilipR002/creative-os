'use client';

import type { Platform } from './PlatformSelector';
import type { ReactNode } from 'react';

interface Props {
  platform: Platform;
  format:   'video' | 'carousel' | 'banner';
  caption:  string;
  children: ReactNode;
}

export function MockupFrame({ platform, format, caption, children }: Props) {
  if (platform === 'google' || format === 'banner') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <div style={{
          padding:      16,
          background:   '#fff',
          borderRadius: 12,
          border:       '1px solid var(--border)',
          minWidth:     320,
        }}>
          {/* Google Display header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid #eee' }}>
            <div style={{ width: 20, height: 20, background: '#4285f4', borderRadius: 4 }} />
            <span style={{ fontSize: 11, color: '#666', fontWeight: 500 }}>Google Display Network</span>
            <span style={{ marginLeft: 'auto', fontSize: 10, color: '#999', background: '#f5f5f5', padding: '2px 6px', borderRadius: 3 }}>Ad</span>
          </div>
          {children}
        </div>
      </div>
    );
  }

  if (platform === 'tiktok') {
    return (
      <div style={{ position: 'relative', width: 320, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {/* Phone chrome */}
        <div style={{
          position:     'relative',
          width:        320,
          background:   '#000',
          borderRadius: 40,
          border:       '8px solid #1a1a1a',
          boxShadow:    '0 0 0 1px rgba(255,255,255,0.08), 0 24px 60px rgba(0,0,0,0.8)',
          overflow:     'hidden',
        }}>
          {/* Notch */}
          <div style={{
            position:   'absolute',
            top:        10,
            left:       '50%',
            transform:  'translateX(-50%)',
            width:      80,
            height:     24,
            background: '#000',
            borderRadius: 12,
            zIndex:     20,
          }} />

          {/* TikTok UI chrome */}
          <div style={{
            position:   'absolute',
            top:        0,
            left:       0,
            right:      0,
            bottom:     0,
            zIndex:     10,
            pointerEvents: 'none',
          }}>
            {/* Bottom bar */}
            <div style={{
              position:   'absolute',
              bottom:     0,
              left:       0,
              right:      0,
              padding:    '12px 16px 20px',
              background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)',
            }}>
              {/* Username */}
              <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 6 }}>
                @creative_os
              </div>
              {/* Caption */}
              <div style={{
                fontSize:     12,
                color:        'rgba(255,255,255,0.88)',
                lineHeight:   1.4,
                maxWidth:     220,
                display:      '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow:     'hidden',
              }}>
                {caption}
              </div>
              {/* Audio pill */}
              <div style={{
                display:      'flex',
                alignItems:   'center',
                gap:          6,
                marginTop:    8,
                fontSize:     10,
                color:        'rgba(255,255,255,0.6)',
              }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: 'rgba(255,255,255,0.3)' }} />
                Original Sound
              </div>
            </div>

            {/* Right action column */}
            <div style={{
              position:       'absolute',
              right:          12,
              bottom:         80,
              display:        'flex',
              flexDirection:  'column',
              alignItems:     'center',
              gap:            20,
            }}>
              {[
                { icon: '♥', label: '24.1K' },
                { icon: '💬', label: '1.2K' },
                { icon: '↗', label: 'Share' },
              ].map((item) => (
                <div key={item.icon} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: '#fff' }}>
                    {item.icon}
                  </div>
                  <span style={{ fontSize: 10, color: '#fff', fontWeight: 500 }}>{item.label}</span>
                </div>
              ))}
            </div>

            {/* Top nav */}
            <div style={{
              position:       'absolute',
              top:            36,
              left:           0,
              right:          0,
              display:        'flex',
              justifyContent: 'center',
              gap:            20,
              padding:        '0 16px',
            }}>
              {['Following', 'For You'].map((tab, i) => (
                <span key={tab} style={{
                  fontSize:     13,
                  fontWeight:   i === 1 ? 700 : 400,
                  color:        i === 1 ? '#fff' : 'rgba(255,255,255,0.5)',
                  paddingBottom: 4,
                  borderBottom: i === 1 ? '2px solid #fff' : 'none',
                }}>
                  {tab}
                </span>
              ))}
            </div>
          </div>

          {children}
        </div>
      </div>
    );
  }

  if (platform === 'instagram') {
    return (
      <div style={{ width: 340, background: '#000', borderRadius: 12, border: '1px solid #2a2a2a', overflow: 'hidden' }}>
        {/* Instagram header */}
        <div style={{
          display:        'flex',
          alignItems:     'center',
          gap:            10,
          padding:        '10px 14px',
          borderBottom:   '1px solid #2a2a2a',
        }}>
          <div style={{
            width:        32,
            height:       32,
            borderRadius: '50%',
            background:   'linear-gradient(135deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)',
            padding:      2,
          }}>
            <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: '#000' }} />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>creative_os</div>
            <div style={{ fontSize: 10, color: '#888' }}>Sponsored</div>
          </div>
          <div style={{ marginLeft: 'auto', fontSize: 18, color: '#888' }}>···</div>
        </div>

        {/* Content */}
        {children}

        {/* Instagram footer */}
        <div style={{ padding: '10px 14px 14px' }}>
          <div style={{ display: 'flex', gap: 14, marginBottom: 8 }}>
            {['♥', '💬', '↗'].map(icon => (
              <span key={icon} style={{ fontSize: 22, color: '#fff', cursor: 'pointer' }}>{icon}</span>
            ))}
            <span style={{ marginLeft: 'auto', fontSize: 22, color: '#fff', cursor: 'pointer' }}>⊕</span>
          </div>
          <div style={{ fontSize: 12, color: '#aaa', lineHeight: 1.4 }}>
            <span style={{ color: '#fff', fontWeight: 600 }}>creative_os </span>
            {caption.slice(0, 100)}{caption.length > 100 ? '...' : ''}
          </div>
        </div>
      </div>
    );
  }

  // Facebook
  return (
    <div style={{
      width:        380,
      background:   '#1a1a1a',
      borderRadius: 10,
      border:       '1px solid #2a2a2a',
      overflow:     'hidden',
    }}>
      {/* Facebook post header */}
      <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#1877f2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: '#fff' }}>
          C
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#e4e6eb' }}>Creative OS</div>
          <div style={{ fontSize: 11, color: '#65676b', display: 'flex', alignItems: 'center', gap: 4 }}>
            Sponsored · <span style={{ fontSize: 13 }}>🌐</span>
          </div>
        </div>
        <div style={{ marginLeft: 'auto', fontSize: 18, color: '#65676b' }}>···</div>
      </div>

      {/* Caption */}
      <div style={{ padding: '0 16px 10px', fontSize: 13, color: '#e4e6eb', lineHeight: 1.5 }}>
        {caption.slice(0, 120)}
      </div>

      {/* Content */}
      {children}

      {/* Facebook reaction bar */}
      <div style={{
        padding:      '8px 16px',
        borderTop:    '1px solid #3a3a3a',
        display:      'flex',
        gap:          16,
      }}>
        {['👍 Like', '💬 Comment', '↗ Share'].map(item => (
          <button key={item} style={{
            fontSize:   12,
            color:      '#65676b',
            background: 'none',
            border:     'none',
            cursor:     'pointer',
            fontWeight: 600,
          }}>
            {item}
          </button>
        ))}
      </div>
    </div>
  );
}
