'use client';
import { useEffect, useState } from 'react';
import { Sidebar } from '@/components/Sidebar';
import {
  getBudgetStatus,
  triggerRebalance,
  approveRebalanceProposal,
  rejectRebalanceProposal,
  type BudgetStatus,
} from '@/lib/api/creator-client';

function fmt$(n: number | undefined | null) { return `$${(n ?? 0).toFixed(2)}`; }
function pct(n: number | undefined | null)  { const v = n ?? 0; return `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`; }

export default function BudgetPage() {
  const [data,     setData]    = useState<BudgetStatus | null>(null);
  const [loading,  setLoading] = useState(true);
  const [error,    setError]   = useState<string | null>(null);
  const [acting,   setActing]  = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try { setData(await getBudgetStatus()); }
    catch (e: unknown) { setError((e as Error)?.message ?? 'Failed to load'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function handleRebalance() {
    setActing(true);
    try { await triggerRebalance(); await load(); }
    catch {}
    finally { setActing(false); }
  }

  async function handleApprove(id: string) {
    setActing(true);
    try { await approveRebalanceProposal(id); await load(); }
    catch {}
    finally { setActing(false); }
  }

  async function handleReject(id: string) {
    setActing(true);
    try { await rejectRebalanceProposal(id); await load(); }
    catch {}
    finally { setActing(false); }
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-main">
        <div className="page-content">

          <div style={{ marginBottom: 24, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', margin: '0 0 4px' }}>Budget Manager</h1>
              <p style={{ fontSize: 12, color: 'var(--sub)', margin: 0 }}>AI-driven budget allocation and rebalancing</p>
            </div>
            <button
              onClick={handleRebalance}
              disabled={acting}
              style={{
                fontSize: 12, fontWeight: 700, padding: '8px 16px', borderRadius: 8, cursor: acting ? 'default' : 'pointer',
                background: 'var(--indigo)', border: '1px solid rgba(99,102,241,0.4)', color: '#fff',
                opacity: acting ? 0.6 : 1,
              }}
            >
              Trigger Rebalance
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
          ) : data && (
            <>
              {/* Autonomy gate */}
              <div style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.18)', borderRadius: 8, padding: '10px 14px', marginBottom: 20, fontSize: 12, color: 'var(--indigo-l)' }}>
                Autonomy L{data.autonomyGate.level} — {data.autonomyGate.message}
                {data.lastRebalancedAt && (
                  <span style={{ marginLeft: 12, color: 'var(--muted)' }}>
                    Last rebalanced {new Date(data.lastRebalancedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                )}
              </div>

              {/* Current allocations */}
              {data.currentAllocations.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
                    Current Allocations ({data.currentAllocations.length})
                  </div>
                  <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border)' }}>
                          {['Campaign', 'Current', 'Proposed', 'Delta', 'ROAS', 'Reason'].map(h => (
                            <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: 'var(--muted)', fontWeight: 700, fontSize: 11 }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {data.currentAllocations.map((a, i) => (
                          <tr key={a.campaignId} style={{ borderBottom: i < data.currentAllocations.length - 1 ? '1px solid var(--border)' : 'none' }}>
                            <td style={{ padding: '10px 14px', color: 'var(--sub)', fontFamily: 'var(--mono)', fontSize: 11 }}>{a.campaignId.slice(0,8)}</td>
                            <td style={{ padding: '10px 14px', fontFamily: 'var(--mono)', color: 'var(--text)' }}>{fmt$(a.currentBudget)}</td>
                            <td style={{ padding: '10px 14px', fontFamily: 'var(--mono)', color: 'var(--indigo-l)' }}>{fmt$(a.proposedBudget)}</td>
                            <td style={{ padding: '10px 14px', fontFamily: 'var(--mono)', color: a.delta >= 0 ? 'var(--emerald)' : 'var(--rose)', fontWeight: 700 }}>{pct(a.deltaPercent)}</td>
                            <td style={{ padding: '10px 14px', fontFamily: 'var(--mono)', color: a.roas >= 2 ? 'var(--emerald)' : a.roas >= 1 ? 'var(--amber)' : 'var(--rose)' }}>{(a.roas ?? 0).toFixed(2)}x</td>
                            <td style={{ padding: '10px 14px', color: 'var(--muted)', fontSize: 11 }}>{a.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Pending proposals */}
              {data.pendingProposals.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
                    Pending Proposals
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {data.pendingProposals.map(p => (
                      <div key={p.id} style={{ background: 'var(--surface)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 10, padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--mono)' }}>{p.id.slice(0,8)}</div>
                            <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
                              {[
                                { label: 'Budget',  value: fmt$(p.totalBudget),                 color: 'var(--text)'     },
                                { label: 'ROI est', value: `+${(p.expectedROIImprovement ?? 0).toFixed(1)}%`, color: 'var(--emerald)' },
                                { label: 'Conf',    value: `${(p.confidence * 100).toFixed(0)}%`,    color: 'var(--indigo-l)'},
                                { label: 'Risk',    value: `${(p.riskScore * 100).toFixed(0)}%`,      color: 'var(--amber)'  },
                              ].map(m => (
                                <div key={m.label}>
                                  <span style={{ fontSize: 10, color: 'var(--muted)' }}>{m.label}: </span>
                                  <span style={{ fontSize: 12, fontWeight: 700, color: m.color, fontFamily: 'var(--mono)' }}>{m.value}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={() => handleApprove(p.id)} disabled={acting}
                              style={{ fontSize: 11, fontWeight: 700, padding: '6px 14px', borderRadius: 6, cursor: 'pointer', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: 'var(--emerald)' }}>
                              Approve
                            </button>
                            <button onClick={() => handleReject(p.id)} disabled={acting}
                              style={{ fontSize: 11, fontWeight: 700, padding: '6px 14px', borderRadius: 6, cursor: 'pointer', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--rose)' }}>
                              Reject
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {data.currentAllocations.length === 0 && data.pendingProposals.length === 0 && (
                <div className="intel-panel" style={{ textAlign: 'center', padding: 48, color: 'var(--muted)', fontSize: 13 }}>
                  No budget data available yet
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
