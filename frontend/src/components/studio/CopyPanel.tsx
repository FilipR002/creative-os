'use client';

import { useState } from 'react';
import type { Platform } from './PlatformSelector';
import type { CreativeContent } from '@/lib/api/creative-client';

interface Props {
  content:  CreativeContent;
  platform: Platform;
}

const PLATFORM_LABELS: Record<Platform, string> = {
  tiktok:    'TikTok',
  instagram: 'Instagram',
  facebook:  'Facebook',
  google:    'Google Display',
};

function CopyField({
  label,
  value,
  multiline = false,
}: {
  label:     string;
  value:     string;
  multiline?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div style={{
      background:   'var(--surface)',
      border:       '1px solid var(--border)',
      borderRadius: 10,
      padding:      '12px 14px',
    }}>
      <div style={{
        display:        'flex',
        justifyContent: 'space-between',
        alignItems:     'center',
        marginBottom:   8,
      }}>
        <span style={{
          fontSize:    10,
          fontWeight:  600,
          color:       'var(--muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}>
          {label}
        </span>
        <button
          onClick={copy}
          style={{
            fontSize:     11,
            fontWeight:   600,
            color:        copied ? 'var(--accent)' : 'var(--sub)',
            background:   copied ? 'rgba(0,201,122,0.08)' : 'rgba(255,255,255,0.04)',
            border:       `1px solid ${copied ? 'rgba(0,201,122,0.2)' : 'var(--border)'}`,
            borderRadius: 5,
            padding:      '3px 8px',
            cursor:       'pointer',
            transition:   'color 0.15s, background 0.15s',
          }}
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <div style={{
        fontSize:   13,
        color:      'var(--text)',
        lineHeight: 1.5,
        wordBreak:  'break-word',
        ...(multiline ? {} : { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }),
      }}>
        {value || <span style={{ color: 'var(--muted)', fontStyle: 'italic' }}>Not available</span>}
      </div>
    </div>
  );
}

export function CopyPanel({ content, platform }: Props) {
  const { copy } = content;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

      {/* Platform badge */}
      <div style={{
        display:      'flex',
        alignItems:   'center',
        gap:          8,
        marginBottom: 4,
      }}>
        <div style={{
          fontSize:     10,
          fontWeight:   700,
          color:        'var(--muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
        }}>
          Copy — {PLATFORM_LABELS[platform]}
        </div>
      </div>

      <CopyField label="Headline" value={copy.headline} />
      <CopyField label="Caption"  value={copy.caption}  multiline />
      <CopyField label="CTA"      value={copy.cta} />
      <CopyField label="Hashtags" value={copy.hashtags} multiline />

      {/* Creative metadata */}
      <div style={{
        marginTop:    8,
        padding:      '12px 14px',
        background:   'var(--surface)',
        border:       '1px solid var(--border)',
        borderRadius: 10,
      }}>
        <div style={{
          fontSize:     10,
          fontWeight:   600,
          color:        'var(--muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          marginBottom: 10,
        }}>
          Creative Info
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[
            { key: 'Angle',  val: content.angleSlug.replace(/_/g, ' ') },
            { key: 'Engine', val: content.engine ?? 'kling'             },
            { key: 'Mode',   val: content.executionMode ?? 'ugc'        },
            ...(content.score != null
              ? [{ key: 'Score', val: `${Math.round(content.score * 100)}%` }]
              : []),
          ].map(({ key, val }) => (
            <div key={key} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>{key}</span>
              <span style={{
                fontSize:  12,
                color:     key === 'Score' ? 'var(--success)' : 'var(--sub)',
                fontWeight: key === 'Score' ? 600 : 400,
                fontFamily: key === 'Score' ? 'var(--mono)' : 'var(--font)',
              }}>
                {val}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Winner badge */}
      {content.isWinner && (
        <div style={{
          display:      'flex',
          alignItems:   'center',
          gap:          8,
          padding:      '10px 14px',
          background:   'rgba(0,201,122,0.06)',
          border:       '1px solid rgba(0,201,122,0.2)',
          borderRadius: 10,
        }}>
          <div style={{
            width:        6,
            height:       6,
            borderRadius: '50%',
            background:   'var(--accent)',
            flexShrink:   0,
          }} />
          <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>
            Top performing variant
          </span>
        </div>
      )}
    </div>
  );
}
