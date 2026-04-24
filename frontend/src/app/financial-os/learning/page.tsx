'use client';
import { useEffect, useState } from 'react';
import { Sidebar } from '@/components/Sidebar';
import {
  getProfitModel,
  triggerProfitLearning,
  getLearningInsights,
  getLearningHistory,
  type ProfitModel,
} from '@/lib/api/creator-client';

function fmtPct(n: number | undefined | null) { return `${((n ?? 0) * 100).toFixed(1)}%`; }

export default function SelfLearningPage() {
  const [model,    setModel]    = useState<ProfitModel | null>(null);
  const [insights, setInsights] = useState<unknown[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [running,  setRunning]  = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [m, i] = await Promise.all([getProfitModel(), getLearningInsights()]);
      setModel(m);
      setInsights(i);
    } catch (e: unknown) {
      setError((e as Error)?.message ?? 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleTrigger() {
    setRunning(true);
    try { await triggerProfitLearning(); await load(); }
    catch {}
    finally { setRunning(false); }
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-main">
        <div className="page-content">

          <div style={{ marginBottom: 24, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', margin: '0 0 4px' }}>Self-Learning</h1>
              <p style={{ fontSize: 12, color: 'var(--sub)', margin: 0 }}>Profit model evolution — thresholds, patterns, accuracy</p>
            </div>
            <button
              onClick={handleTrigger}
              disabled={running}
              style={{
                fontSize: 12, fontWeight: 700, padding: '8px 16px', borderRadius: 8, cursor: running ? 'default' : 'pointer',
                background: 'var(--indigo)', border: '1px solid rgba(99,102,241,0.4)', color: '#fff',
                opacity: running ? 0.6 : 1,
              }}
            >
              {running ? 'Running...' : 'Run Learning Cycle'}
            </button>
          </div>

          {error && (
            <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.22)', borderRadius: 10, padding: '14px 18px', marginBottom: 16, fontSize: 13, color: 'var(--rose)' }}>
              {error}
            </div>
          )}

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
              <div className="spin" style={{ width: 36, height: 36, border: '3px solid var(--border)', borderTopColor: 'var(--indigo)', borderRadius: '50%' }} />
            </div>
          ) : model && (
            <>
              {/* Model KPIs */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10, marginBottom: 24 }}>
                {[
                  { label: 'Version',         value: `v${model.version}`,                            color: 'var(--text)'     },
                  { label: 'Accuracy',         value: fmtPct(model.accuracy),                         color: 'var(--emerald)'  },
                  { label: 'Scale Threshold',  value: (model.scaleThreshold ?? 0).toFixed(2),                color: 'var(--emerald)'  },
                  { label: 'Kill Threshold',   value: (model.killThreshold ?? 0).toFixed(2),                 color: 'var(--rose)'     },
                  { label: 'Total Cycles',     value: String(model.totalCycles),                      color: 'var(--indigo-l)' },
                ].map(m => (
                  <div key={m.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>{m.label}</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: m.color, fontFamily: 'var(--mono)' }}>{m.value}</div>
                  </div>
                ))}
              </div>

              <div style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.18)', borderRadius: 8, padding: '10px 14px', marginBottom: 20, fontSize: 12, color: 'var(--muted)' }}>
                Confidence floor: {fmtPct(model.confidenceFloor)} · Last updated {model.lastUpdatedAt ? new Date(model.lastUpdatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'never'}
              </div>

              {/* Learned patterns */}
              {model.learnedPatterns.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
                    Learned Patterns ({model.learnedPatterns.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {model.learnedPatterns.map((p, i) => (
                      <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>{p.label}</div>
                          <div style={{ fontSize: 11, color: 'var(--muted)' }}>{p.description}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 16 }}>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 2 }}>Strength</div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--indigo-l)', fontFamily: 'var(--mono)' }}>{fmtPct(p.strength)}</div>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 2 }}>Samples</div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--mono)' }}>{p.sampleCount}</div>
                          </div>
                        </div>
                        <span style={{ fontSize: 10, fontFamily: 'var(--mono)', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', color: 'var(--indigo-l)', padding: '2px 8px', borderRadius: 4 }}>
                          {p.type}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Insights */}
              {insights.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
                    Learning Insights ({insights.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {insights.map((ins, i) => (
                      <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--sub)', lineHeight: 1.5 }}>
                        {typeof ins === 'string' ? ins : JSON.stringify(ins)}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
