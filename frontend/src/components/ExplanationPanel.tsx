import type { DecisionExplanation } from '@/lib/types/view-models';

export function ExplanationPanel({ explanation }: { explanation: DecisionExplanation }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <p style={{ fontSize: 13, lineHeight: 1.6 }}>{explanation.finalReasoning}</p>
      <p style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic' }}>
        {explanation.confidenceNote}
      </p>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 4 }}>
        {([
          ['Memory',    explanation.memoryInfluence],
          ['Scoring',   explanation.scoringInfluence],
          ['MIROFISH',  explanation.mirofishInfluence],
          ['Blending',  explanation.blendingInfluence],
          ['Explore',   explanation.explorationInfluence],
        ] as [string, number][]).map(([label, val]) => (
          <div key={label} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em' }}>
              {(val * 100).toFixed(0)}%
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
