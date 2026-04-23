'use client';

// ─── Phase 6.2 — Explanation Stream Panel ────────────────────────────────────
// Typewriter reveal while explanation is loading; locks on completion.

import { useEffect, useState } from 'react';
import type { DecisionExplanation } from '@/lib/types/view-models';

function useTypewriter(text: string | null, speed = 18) {
  const [displayed, setDisplayed] = useState('');
  useEffect(() => {
    if (!text) { setDisplayed(''); return; }
    let i = 0;
    setDisplayed('');
    const id = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [text, speed]);
  return displayed;
}

interface Props {
  explanation?: DecisionExplanation;
  loading?:     boolean;
  locked?:      boolean;
}

export function ExplanationStreamPanel({ explanation, loading, locked }: Props) {
  const reasoning = useTypewriter(explanation?.finalReasoning ?? null);
  const isDone    = !!locked && reasoning.length === (explanation?.finalReasoning?.length ?? 0);

  if (loading || !explanation) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="shimmer" style={{ height: 12, width: '90%', borderRadius: 4 }} />
        <div className="shimmer" style={{ height: 12, width: '70%', borderRadius: 4 }} />
        <div className="shimmer" style={{ height: 12, width: '50%', borderRadius: 4 }} />
      </div>
    );
  }

  const INFLUENCES: [string, number][] = [
    ['Memory',    explanation.memoryInfluence],
    ['Scoring',   explanation.scoringInfluence],
    ['MIROFISH',  explanation.mirofishInfluence],
    ['Blending',  explanation.blendingInfluence],
    ['Explore',   explanation.explorationInfluence],
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Typewriter reasoning */}
      <p
        className={isDone ? undefined : 'typewriter-cursor'}
        style={{ fontSize: 13, lineHeight: 1.65, color: 'var(--text)', minHeight: 40 }}
      >
        {reasoning}
      </p>

      {/* Confidence note */}
      {isDone && (
        <p className="anim-fade-in" style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic' }}>
          {explanation.confidenceNote}
        </p>
      )}

      {/* Influence breakdown */}
      {isDone && (
        <div className="anim-fade-in" style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 4 }}>
          {INFLUENCES.map(([label, val]) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text)' }}>
                {(val * 100).toFixed(0)}%
              </div>
              <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {label}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
