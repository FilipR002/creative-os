'use client';
import { useEffect, useState } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { FinancialOsNav } from '@/components/FinancialOsNav';
import {
  getBudgetStatus, triggerRebalance,
  approveRebalanceProposal, rejectRebalanceProposal,
  type BudgetStatus, type RebalanceProposal, type BudgetAllocation,
} from '@/lib/api/creator-client';

function fmtTs(s: string | null) {
  if (!s) return 'Never';
  try {
    return new Date(s).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return s; }
}

function DeltaBadge({ delta, pct }: { delta: number; pct: number }) {
  const positive = delta >= 0;
  return (
    <span style={{
      fontSize: 11,
      fontWeight: 700,
      color: positive ? '#10b981' : '#ef4444',
      background: positive ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
      border: `1px solid ${positive ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
      borderRadius: 5,
      padding: '2px 7px',
      fontFamily: 'var(--mono)',
    }}>
      {positive ? '+' : ''}{delta.toFixed(2)} ({positive ? '+' : ''}{pct.toFixed(1)}%)
    </span>
  );
}

function AllocationRow({ alloc }: { alloc: BudgetAllocation }) {
  return (
    <tr style={{ borderBottom: '1px solid var(--border)' }}>
      <td style={{ padding: '8px 14px', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--sub)' }}>
        {alloc.campaignId.slice(0, 8)}
      </td>
      <td style={{ padding: '8px 14px', fontSize: 12, color: 'var(--text)', fontFamily: 'var(--mono)' }}>
        ${alloc.currentBudget.toFixed(2)}
      </td>
      <td style={{ padding: '8px 14px', fontSize: 12, fontFamily: 'var(--mono)' }}>
        <span style={{ color: alloc.proposedBudget > alloc.currentBudget ? '#10b981' : '#ef4444' }}>
          ${alloc.proposedBudget.toFixed(2)}
        </span>
      </td>
      <td style={{ padding: '8px 14px' }}>
        <DeltaBadge delta={alloc.delta} pct={alloc.deltaPercent} />
      </td>
      <td style={{ padding: '8px 14px', fontSize: 12, color: alloc.roas >= 2 ? '#10b981' : alloc.roas >= 1 ? '#f59e0b' : '#ef4444', fontWeight: 700, fontFamily: 'var(--mono)' }}>
        {alloc.roas.toFixed(2)}x
      </td>
      <td style={{ padding: '8px 14px', fontSize: 11, color: 'var(--muted)', maxWidth: 200 }}>
        {alloc.reason}
      </td>
    </tr>
  );
}

export default function BudgetPage() {
  const [status, setStatus]       = useState<BudgetStatus | null>(null);
  const [loading, setLoading]     = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [triggerMsg, setTriggerMsg] = useState('');
  const [proposalStates, setProposalStates] = useState<Record<string, 'idle' | 'loading' | 'done'>>({});

  async function load() {
    setLoading(true);
    getBudgetStatus()
      .then(s => setStatus(s))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function handleTrigger() {
    setTriggering(true);
    setTriggerMsg('');
    try {
      const result = await triggerRebalance();
      setTriggerMsg('Rebalance triggered — check pending proposals below');
      await load();
      void result;
    } catch (e: unknown) {
      setTriggerMsg(e instanceof Error ? e.message : 'Trigger failed');
    } finally {
      setTriggering(false);
    }
  }

  async function handleApprove(id: string) {
    setProposalStates(p => ({ ...p, [id]: 'loading' }));
    try {
      await approveRebalanceProposal(id);
      setProposalStates(p => ({ ...p, [id]: 'done' }));
      await load();
    } catch {
      setProposalStates(p => ({ ...p, [id]: 'idle' }));
    }
  }

  async function handleReject(id: string) {
    setProposalStates(p => ({ ...p, [id]: 'loading' }));
    try {
      await rejectRebalanceProposal(id);
      setProposalStates(p => ({ ...p, [id]: 'done' }));
      await load();
    } catch {
      setProposalStates(p => ({ ...p, [id]: 'idle' }));
    }
  }

  const gate = status?.autonomyGate;
  const pending = (status?.pendingProposals ?? []).filter(p => p.status === 'PENDING');

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-main">
        <FinancialOsNav level={gate?.level ?? 0} onLevelClick={() => {}} />
        <div className="page-content">

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', margin: '0 0 4px' }}>🔁 Autonomous Budget Rebalancer</h1>
              <p style={{ fontSize: 12, color: 'var(--sub)', margin: 0 }}>
                ROI-driven budget reallocation · Last rebalanced: {fmtTs(status?.lastRebalancedAt ?? null)}
              </p>
            </div>
            <button
              onClick={handleTrigger}
              disabled={triggering}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 8, background: 'var(--indigo)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: triggering ? 'default' : 'pointer', fontFamily: 'inherit', opacity: triggering ? 0.7 : 1 }}
            >
              {triggering ? (
                <span className="spin" style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block' }} />
              ) : '🔁'}
              {triggering ? 'Running…' : 'Trigger Rebalance'}
            </button>
          </div>

          {triggerMsg && (
            <div style={{ marginBottom: 16, padding: '10px 16px', borderRadius: 8, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', fontSize: 12, color: 'var(--emerald)' }}>
              {triggerMsg}
            </div>
          )}

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
              <div className="spin" style={{ width: 36, height: 36, border: '3px solid var(--border)', borderTopColor: 'var(--indigo)', borderRadius: '50%' }} />
            </div>
          ) : (
            <>
              {/* Gate status */}
              {gate && (
                <div style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 8, padding: '10px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--indigo-l)' }}>Autonomy Level {gate.level}</span>
                  <span style={{ fontSize: 12, color: 'var(--sub)' }}>{gate.message}</span>
                </div>
              )}

              {/* Current Allocations */}
              <div className="intel-panel" style={{ marginBottom: 16 }}>
                <div className="intel-panel-header">
                  <span className="section-label" style={{ margin: 0 }}>Current Budget Allocations</span>
                  <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--muted)' }}>
                    {status?.currentAllocations?.length ?? 0} campaigns
                  </span>
                </div>
                <div className="scroll-pane" style={{ maxHeight: 320 }}>
                  {!status?.currentAllocations?.length ? (
                    <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', padding: 32 }}>No allocations yet</div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'var(--surface)' }}>
                          {['Campaign', 'Current', 'Proposed', 'Delta', 'ROAS', 'Reason'].map(h => (
                            <th key={h} style={{ padding: '8px 14px', textAlign: 'left', color: 'var(--muted)', fontWeight: 600, fontSize: 11 }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {status.currentAllocations.map(a => (
                          <AllocationRow key={a.campaignId} alloc={a} />
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* Pending Proposals */}
              {pending.length > 0 && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <span className="section-label" style={{ margin: 0 }}>Pending Proposals</span>
                    <span className="badge" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', color: 'var(--amber)', fontSize: 11 }}>{pending.length}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {pending.map(p => {
                      const ps = proposalStates[p.id] ?? 'idle';
                      return (
                        <div key={p.id} className="intel-panel">
                          {/* Proposal header */}
                          <div className="intel-panel-header">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--sub)' }}>{p.id.slice(0, 8)}</span>
                              <span style={{ fontSize: 11, color: 'var(--muted)' }}>Total: <b style={{ color: 'var(--text)' }}>${p.totalBudget.toFixed(2)}</b></span>
                              <span style={{ fontSize: 11, color: 'var(--muted)' }}>ROI improvement: <b style={{ color: 'var(--emerald)' }}>+{(p.expectedROIImprovement * 100).toFixed(1)}%</b></span>
                              <span style={{ fontSize: 11, color: 'var(--muted)' }}>Confidence: <b style={{ color: 'var(--indigo-l)' }}>{(p.confidence * 100).toFixed(0)}%</b></span>
                              <span style={{ fontSize: 11, color: 'var(--muted)' }}>Risk: <b style={{ color: p.riskScore > 0.6 ? 'var(--rose)' : p.riskScore > 0.3 ? 'var(--amber)' : 'var(--emerald)' }}>{(p.riskScore * 100).toFixed(0)}%</b></span>
                            </div>
                            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                              <button
                                onClick={() => handleApprove(p.id)}
                                disabled={ps !== 'idle'}
                                style={{ padding: '5px 14px', borderRadius: 6, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981', fontSize: 12, cursor: ps !== 'idle' ? 'default' : 'pointer', fontFamily: 'inherit', fontWeight: 700, opacity: ps !== 'idle' ? 0.6 : 1 }}
                              >
                                {ps === 'loading' ? '…' : ps === 'done' ? '✓' : 'Approve'}
                              </button>
                              <button
                                onClick={() => handleReject(p.id)}
                                disabled={ps !== 'idle'}
                                style={{ padding: '5px 14px', borderRadius: 6, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', fontSize: 12, cursor: ps !== 'idle' ? 'default' : 'pointer', fontFamily: 'inherit', fontWeight: 700, opacity: ps !== 'idle' ? 0.6 : 1 }}
                              >
                                {ps === 'loading' ? '…' : ps === 'done' ? '✓' : 'Reject'}
                              </button>
                            </div>
                          </div>
                          {/* Allocation deltas */}
                          <div style={{ padding: '8px 0' }}>
                            {p.allocations.map(a => (
                              <div key={a.campaignId} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 16px', borderBottom: '1px solid var(--border)' }}>
                                <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--sub)', width: 80 }}>{a.campaignId.slice(0, 8)}</span>
                                <span style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--mono)' }}>${a.currentBudget.toFixed(2)}</span>
                                <span style={{ fontSize: 12, color: 'var(--muted)' }}>→</span>
                                <span style={{ fontSize: 12, color: 'var(--text)', fontFamily: 'var(--mono)', fontWeight: 600 }}>${a.proposedBudget.toFixed(2)}</span>
                                <DeltaBadge delta={a.delta} pct={a.deltaPercent} />
                                <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--muted)' }}>{a.reason}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
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
