'use client';

// ─── Phase 7 — Product Output Card ───────────────────────────────────────────
// Shows AI recommendation in human language only.
// No signals, no weights, no execution details.

import { useState } from 'react';
import type { ProductOutput } from '@/lib/types/product';
import { ConfidenceRing }    from './ConfidenceRing';

interface Props {
  output:    ProductOutput;
  isPrimary: boolean;
  onRegenerate?: () => void;
}

export function ProductOutputCard({ output, isPrimary, onRegenerate }: Props) {
  const [copied, setCopied] = useState(false);

  function copyTitle() {
    navigator.clipboard.writeText(output.primaryRecommendation).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className={`output-card ${isPrimary ? 'primary-output' : ''}`}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 20 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            {isPrimary && (
              <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em', background: 'rgba(99,102,241,0.12)', padding: '3px 8px', borderRadius: 99 }}>
                Best Option
              </span>
            )}
            <span className="category-chip">{output.category}</span>
          </div>
          <h2 style={{ fontSize: isPrimary ? 22 : 18, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
            {output.title}
          </h2>
        </div>
        <ConfidenceRing value={output.confidence} />
      </div>

      {/* Primary recommendation */}
      <p style={{ fontSize: 15, lineHeight: 1.65, color: 'var(--text)', marginBottom: 16 }}>
        {output.primaryRecommendation}
      </p>

      {/* Why this works */}
      <div className="why-section">
        <div className="why-label">Why this works</div>
        <p style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.6 }}>
          {output.explanation}
        </p>
      </div>

      {/* Alternatives */}
      {output.alternatives.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div className="why-label">Alternative approaches</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
            {output.alternatives.map((alt, i) => (
              <span key={i} className="alt-pill">{alt}</span>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      {isPrimary && (
        <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
          <button className="btn-ghost" onClick={copyTitle} style={{ fontSize: 12 }}>
            {copied ? '✓ Copied' : 'Copy recommendation'}
          </button>
          {onRegenerate && (
            <button className="btn-ghost" onClick={onRegenerate} style={{ fontSize: 12 }}>
              Regenerate
            </button>
          )}
        </div>
      )}
    </div>
  );
}
