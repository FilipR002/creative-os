'use client';

import { useState } from 'react';
import { runDecision } from '@/lib/api/client';
import type { DecisionPageViewModel } from '@/lib/types/view-models';
import { FatigueBadge }           from '@/components/FatigueBadge';
import { SignalBreakdownBars }    from '@/components/SignalBreakdownBars';

export default function ExperimentsPage() {
  const [clientId,   setClientId]   = useState('');
  const [variantA,   setVariantA]   = useState('');
  const [variantB,   setVariantB]   = useState('');
  const [resultA,    setResultA]    = useState<DecisionPageViewModel | null>(null);
  const [resultB,    setResultB]    = useState<DecisionPageViewModel | null>(null);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  async function handleCompare() {
    if (!clientId.trim()) { setError('client_id is required'); return; }
    setLoading(true);
    setError(null);
    try {
      const [a, b] = await Promise.all([
        runDecision({ client_id: clientId, goal: variantA || undefined }),
        runDecision({ client_id: clientId, goal: variantB || undefined }),
      ]);
      setResultA((a as any).viewModel ?? null);
      setResultB((b as any).viewModel ?? null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const primaryA = resultA?.angles.find(a => a.angle === resultA.primaryAngle);
  const primaryB = resultB?.angles.find(a => a.angle === resultB.primaryAngle);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">A/B Experiments</h1>
        <p className="page-sub">Compare decision outcomes across goals or configurations</p>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-title">Experiment Setup</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
          {([
            ['Client ID *', clientId, setClientId],
            ['Variant A Goal', variantA, setVariantA],
            ['Variant B Goal', variantB, setVariantB],
          ] as [string, string, (v: string) => void][]).map(([label, value, setter]) => (
            <div key={label}>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>{label}</label>
              <input
                value={value}
                onChange={e => setter(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13 }}
              />
            </div>
          ))}
        </div>
        <button
          onClick={handleCompare}
          disabled={loading}
          style={{ padding: '8px 20px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}
        >
          {loading ? 'Comparing…' : 'Run Comparison'}
        </button>
        {error && <p style={{ marginTop: 12, fontSize: 12, color: 'var(--danger)' }}>{error}</p>}
      </div>

      {resultA && resultB && primaryA && primaryB && (
        <div className="grid-2">
          {([['A', resultA, primaryA, variantA], ['B', resultB, primaryB, variantB]] as const).map(([label, result, primary, goal]) => (
            <div key={label} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                    Variant {label} {goal ? `— ${goal}` : ''}
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{primary.angle}</div>
                </div>
                <div style={{ fontSize: 36, fontWeight: 700, color: primary.score >= 70 ? 'var(--success)' : 'var(--warning)' }}>
                  {primary.score}
                </div>
              </div>
              <FatigueBadge level={primary.fatigueLevel} />
              <div style={{ marginTop: 16 }}>
                <SignalBreakdownBars breakdown={primary.breakdown} />
              </div>
              <div style={{ marginTop: 12, fontSize: 12, color: 'var(--muted)', fontStyle: 'italic' }}>
                {primary.explanation.finalReasoning}
              </div>
            </div>
          ))}
        </div>
      )}

      {primaryA && primaryB && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-title">Score Delta</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>
            {primaryA.score > primaryB.score
              ? <span style={{ color: 'var(--success)' }}>A wins +{primaryA.score - primaryB.score}</span>
              : primaryB.score > primaryA.score
              ? <span style={{ color: 'var(--warning)' }}>B wins +{primaryB.score - primaryA.score}</span>
              : <span style={{ color: 'var(--muted)' }}>Tie</span>
            }
          </div>
        </div>
      )}
    </div>
  );
}
