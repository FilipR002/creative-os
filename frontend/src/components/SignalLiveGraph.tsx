'use client';

// ─── Phase 6.2 — Signal Live Graph ───────────────────────────────────────────
// Bars animate from 0 → value on mount (staggered).
// Shows shimmer skeleton when loading === true.

import { useEffect, useState } from 'react';
import type { SignalBreakdown } from '@/lib/types/view-models';

const ROWS: [keyof SignalBreakdown, string, string][] = [
  ['memory',      'Memory',      'var(--accent)'],
  ['scoring',     'Scoring',     '#818cf8'],
  ['mirofish',    'MIROFISH',    '#a78bfa'],
  ['blending',    'Blending',    '#c084fc'],
  ['exploration', 'Explore',     '#e879f9'],
];

interface Props {
  breakdown?: SignalBreakdown;
  loading?:   boolean;
}

export function SignalLiveGraph({ breakdown, loading }: Props) {
  // Trigger animation after first paint so transitions run
  const [ready, setReady] = useState(false);
  useEffect(() => { const id = requestAnimationFrame(() => setReady(true)); return () => cancelAnimationFrame(id); }, []);

  if (loading || !breakdown) {
    return (
      <div className="signal-bar-wrap">
        {ROWS.map(([key]) => (
          <div key={key} className="signal-bar-row">
            <span className="signal-bar-label" style={{ color: 'var(--border)' }}>
              <span className="shimmer" style={{ display: 'block', width: 48, height: 10, borderRadius: 4 }} />
            </span>
            <div className="signal-bar-track">
              <div className="shimmer" style={{ height: '100%', width: '60%', borderRadius: 99 }} />
            </div>
            <span style={{ width: 36 }} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="signal-bar-wrap">
      {ROWS.map(([key, label, color], i) => {
        const value = breakdown[key];
        return (
          <div key={key} className="signal-bar-row">
            <span className="signal-bar-label">{label}</span>
            <div className="signal-bar-track">
              <div
                className={ready ? 'bar-animated' : undefined}
                style={{
                  height:           '100%',
                  width:            `${value * 100}%`,
                  background:       color,
                  borderRadius:     99,
                  animationDelay:   `${i * 80}ms`,
                  transition:       ready ? 'none' : undefined,
                }}
              />
            </div>
            <span className="signal-bar-value">{(value * 100).toFixed(0)}%</span>
          </div>
        );
      })}
    </div>
  );
}
