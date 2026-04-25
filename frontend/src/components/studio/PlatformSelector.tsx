'use client';

export type Platform = 'tiktok' | 'instagram' | 'facebook' | 'google';

const PLATFORMS: { id: Platform; label: string; aspect: string }[] = [
  { id: 'tiktok',     label: 'TikTok',   aspect: '9:16' },
  { id: 'instagram',  label: 'Instagram', aspect: '4:5'  },
  { id: 'facebook',   label: 'Facebook',  aspect: '4:5'  },
  { id: 'google',     label: 'Google',    aspect: 'Grid' },
];

interface Props {
  selected:  Platform;
  onChange:  (p: Platform) => void;
  format:    'video' | 'carousel' | 'banner';
}

export function PlatformSelector({ selected, onChange, format }: Props) {
  // Banner only makes sense on Google Display; video on TikTok/Instagram; carousel on all
  const available = format === 'banner'
    ? PLATFORMS.filter(p => p.id === 'google' || p.id === 'facebook' || p.id === 'instagram')
    : PLATFORMS;

  return (
    <div style={{
      display:      'flex',
      gap:          4,
      background:   'var(--surface)',
      border:       '1px solid var(--border)',
      borderRadius: 10,
      padding:      4,
    }}>
      {available.map(p => (
        <button
          key={p.id}
          onClick={() => onChange(p.id)}
          style={{
            display:      'flex',
            alignItems:   'center',
            gap:          6,
            padding:      '6px 14px',
            borderRadius: 7,
            border:       'none',
            background:   selected === p.id ? 'var(--surface-3)' : 'transparent',
            color:        selected === p.id ? 'var(--text)' : 'var(--sub)',
            fontSize:     12,
            fontWeight:   selected === p.id ? 600 : 400,
            cursor:       'pointer',
            transition:   'background 0.15s, color 0.15s',
            boxShadow:    selected === p.id ? '0 1px 3px rgba(0,0,0,0.3)' : 'none',
            whiteSpace:   'nowrap',
          }}
        >
          <PlatformDot id={p.id} active={selected === p.id} />
          {p.label}
          <span style={{
            fontSize:   10,
            color:      selected === p.id ? 'var(--muted)' : 'rgba(255,255,255,0.12)',
            fontWeight: 400,
          }}>
            {p.aspect}
          </span>
        </button>
      ))}
    </div>
  );
}

function PlatformDot({ id, active }: { id: Platform; active: boolean }) {
  const colors: Record<Platform, string> = {
    tiktok:    '#ff2d55',
    instagram: '#e1306c',
    facebook:  '#1877f2',
    google:    '#4285f4',
  };

  return (
    <span style={{
      display:      'inline-block',
      width:        6,
      height:       6,
      borderRadius: '50%',
      background:   active ? colors[id] : 'var(--muted)',
      flexShrink:   0,
      transition:   'background 0.15s',
    }} />
  );
}
