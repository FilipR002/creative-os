'use client';

export type ParsingPhase = 'idle' | 'reading' | 'detecting' | 'matching' | 'done';

interface Props {
  phase: ParsingPhase;
  filename?: string;
}

const PHASES: { key: ParsingPhase; label: string }[] = [
  { key: 'reading',   label: 'Reading file…'          },
  { key: 'detecting', label: 'Detecting structure…'   },
  { key: 'matching',  label: 'Matching creatives…'    },
  { key: 'done',      label: 'Analysis complete'       },
];

const ORDER: ParsingPhase[] = ['reading', 'detecting', 'matching', 'done'];

export function ParsingStatus({ phase, filename }: Props) {
  if (phase === 'idle') return null;

  const currentIdx = ORDER.indexOf(phase);

  return (
    <div style={{
      padding:      '20px 24px',
      background:   'rgba(99,102,241,0.06)',
      border:       '1px solid rgba(99,102,241,0.15)',
      borderRadius: 12,
      marginBottom: 24,
    }}>
      {filename && (
        <div style={{ fontSize: 12, color: '#555', marginBottom: 12 }}>
          📄 {filename}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {PHASES.map(({ key, label }, idx) => {
          const done    = ORDER.indexOf(key) < currentIdx;
          const active  = key === phase;
          const pending = ORDER.indexOf(key) > currentIdx;

          return (
            <div
              key={key}
              style={{
                display:    'flex',
                alignItems: 'center',
                gap:        10,
                fontSize:   13,
                color:      pending ? '#2a2f3e' : active ? '#a5b4fc' : '#22c55e',
                transition: 'color 0.3s',
              }}
            >
              <span style={{ width: 16, textAlign: 'center', flexShrink: 0 }}>
                {done    ? '✓' :
                 active  ? <PulsingDot /> :
                 '○'}
              </span>
              {label}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PulsingDot() {
  return (
    <span style={{
      display:     'inline-block',
      width:       8,
      height:      8,
      background:  '#6366f1',
      borderRadius: '50%',
      animation:   'cos-pulse 1s ease-in-out infinite',
    }}>
      <style>{`@keyframes cos-pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.4;transform:scale(0.75)} }`}</style>
    </span>
  );
}
