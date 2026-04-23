'use client';
import { useEffect, useState } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { FinancialOsNav } from '@/components/FinancialOsNav';
import {
  getProfitZones, executeProfitAction, approveProfitAction, rejectProfitAction,
  type ProfitZonesResult, type ProfitProfile,
} from '@/lib/api/creator-client';

type ActionStatus = 'idle' | 'loading' | 'queued' | 'executed' | 'advisory' | 'error';

interface ZoneConfig {
  key: 'SCALE' | 'FIX' | 'KILL';
  label: string;
  icon: string;
  color: string;
  bg: string;
  border: string;
  action: 'scale' | 'fix' | 'kill' | null;
}

const ZONES: ZoneConfig[] = [
  { key: 'SCALE', label: 'SCALE',  icon: '🟢', color: '#10b981', bg: 'rgba(16,185,129,0.06)',  border: 'rgba(16,185,129,0.22)', action: 'scale' },
  { key: 'FIX',   label: 'FIX',    icon: '🟡', color: '#f59e0b', bg: 'rgba(245,158,11,0.06)',  border: 'rgba(245,158,11,0.22)', action: 'fix'   },
  { key: 'KILL',  label: 'KILL',   icon: '🔴', color: '#ef4444', bg: 'rgba(239,68,68,0.06)',   border: 'rgba(239,68,68,0.22)', action: 'kill'  },
];

function levelLabel(level: number) {
  if (level <= 1) return 'Advisory Only';
  if (level === 2) return 'Queued for Approval';
  return 'Executed';
}

function ExecuteButton({
  campaign,
  action,
  level,
  gateMsg,
}: {
  campaign: ProfitProfile;
  action: 'scale' | 'fix' | 'kill';
  level: number;
  gateMsg: string;
}) {
  const [status, setStatus] = useState<ActionStatus>('idle');
  const [msg, setMsg]       = useState('');

  async function handleClick() {
    if (level <= 1) {
      setStatus('advisory');
      setMsg('Advisory Only — raise autonomy level to execute');
      return;
    }
    setStatus('loading');
    try {
      const result = await executeProfitAction(campaign.campaignId, action);
      if (level === 2) {
        setStatus('queued');
        setMsg('Queued for Approval');
      } else {
        setStatus('executed');
        setMsg('Executed');
      }
      void result;
    } catch (e: unknown) {
      setStatus('error');
      setMsg(e instanceof Error ? e.message : 'Action failed');
    }
  }

  const btnColor = action === 'scale' ? '#10b981' : action === 'kill' ? '#ef4444' : '#f59e0b';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
      <button
        onClick={handleClick}
        disabled={status === 'loading' || status === 'executed' || status === 'queued'}
        style={{
          padding: '4px 12px',
          borderRadius: 6,
          border: `1px solid ${btnColor}44`,
          background: `${btnColor}14`,
          color: btnColor,
          fontSize: 11,
          fontWeight: 700,
          cursor: status === 'loading' || status === 'executed' || status === 'queued' ? 'default' : 'pointer',
          fontFamily: 'inherit',
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          opacity: status === 'executed' || status === 'queued' ? 0.7 : 1,
        }}
      >
        {status === 'loading' ? (
          <span className="spin" style={{ width: 10, height: 10, border: '2px solid transparent', borderTopColor: btnColor, borderRadius: '50%', display: 'inline-block' }} />
        ) : null}
        {status === 'executed' ? '✓ Executed' : status === 'queued' ? '⏳ Queued' : status === 'loading' ? 'Executing…' : 'Execute'}
      </button>
      {status !== 'idle' && msg && (
        <span style={{ fontSize: 10, color: status === 'error' ? 'var(--rose)' : status === 'advisory' ? 'var(--amber)' : status === 'executed' ? 'var(--emerald)' : 'var(--sub)' }}>
          {msg}
        </span>
      )}
      {status === 'idle' && level <= 1 && (
        <span className="badge" style={{ fontSize: 9, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', color: 'var(--amber)' }}>
          Advisory Only
        </span>
      )}
    </div>
  );
}

export default function ProfitPage() {
  const [data, setData]     = useState<ProfitZonesResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [level, setLevel]   = useState(0);
  const [pendingActions, setPendingActions] = useState<{ id: string; campaignId: string; action: string }[]>([]);

  useEffect(() => {
    getProfitZones()
      .then(r => {
        setData(r);
        setLevel(r.executionGate.level);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleApprove(id: string) {
    await approveProfitAction(id).catch(() => {});
    setPendingActions(p => p.filter(x => x.id !== id));
  }
  async function handleReject(id: string) {
    await rejectProfitAction(id).catch(() => {});
    setPendingActions(p => p.filter(x => x.id !== id));
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-main">
        <FinancialOsNav level={level} onLevelClick={() => {}} />
        <div className="page-content">

          <div style={{ marginBottom: 24 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', margin: '0 0 4px' }}>⚠ Profit Optimization Engine</h1>
            <p style={{ fontSize: 12, color: 'var(--sub)', margin: 0 }}>SCALE / FIX / KILL classification + autonomous execution</p>
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
              <div className="spin" style={{ width: 36, height: 36, border: '3px solid var(--border)', borderTopColor: 'var(--indigo)', borderRadius: '50%' }} />
            </div>
          ) : !data ? (
            <div style={{ textAlign: 'center', color: 'var(--muted)', padding: 48 }}>Failed to load profit zones</div>
          ) : (
            <>
              {/* Summary stats */}
              <div className="intel-stats-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginBottom: 20 }}>
                {[
                  { label: 'Total Campaigns', value: data.summary.totalCampaigns, color: 'var(--text)' },
                  { label: 'Scale Potential',  value: `$${data.summary.scalePotential.toFixed(0)}`, color: 'var(--emerald)' },
                  { label: 'Total Waste',      value: `$${data.summary.totalWaste.toFixed(0)}`,     color: 'var(--rose)' },
                ].map(s => (
                  <div key={s.label} className="intel-stat-card">
                    <div className="intel-stat-label">{s.label}</div>
                    <div className="intel-stat-value" style={{ fontSize: 20, color: s.color }}>{s.value}</div>
                  </div>
                ))}
              </div>

              {/* Gate banner */}
              <div style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 8, padding: '10px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--indigo-l)' }}>
                  Level {data.executionGate.level} — {levelLabel(data.executionGate.level)}
                </span>
                <span style={{ fontSize: 11, color: 'var(--sub)' }}>{data.executionGate.message}</span>
                {data.executionGate.requiresApproval && (
                  <span className="badge" style={{ marginLeft: 'auto', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', color: 'var(--amber)', fontSize: 10 }}>
                    Requires Approval
                  </span>
                )}
              </div>

              {/* Three zone panels */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 20 }}>
                {ZONES.map(zone => {
                  const campaigns = data.zones[zone.key] ?? [];
                  const totalSpend = campaigns.reduce((s, c) => s + c.spend, 0);
                  return (
                    <div
                      key={zone.key}
                      style={{ background: zone.bg, border: `1px solid ${zone.border}`, borderRadius: 12, overflow: 'hidden' }}
                    >
                      {/* Zone header */}
                      <div style={{ padding: '12px 16px', borderBottom: `1px solid ${zone.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 15 }}>{zone.icon}</span>
                        <span style={{ fontSize: 14, fontWeight: 800, color: zone.color }}>{zone.label}</span>
                        <span className="badge" style={{ marginLeft: 'auto', background: `${zone.color}18`, border: `1px solid ${zone.color}33`, color: zone.color, fontSize: 11 }}>
                          {campaigns.length}
                        </span>
                      </div>
                      <div style={{ padding: '8px 16px 4px', borderBottom: `1px solid ${zone.border}` }}>
                        <span style={{ fontSize: 11, color: 'var(--muted)' }}>Total Spend: </span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: zone.color }}>${totalSpend.toFixed(2)}</span>
                      </div>

                      {/* Campaign list */}
                      <div className="scroll-pane" style={{ maxHeight: 320 }}>
                        {campaigns.length === 0 ? (
                          <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', padding: 20 }}>No campaigns</div>
                        ) : (
                          campaigns.map(c => (
                            <div key={c.campaignId} style={{ padding: '10px 14px', borderBottom: `1px solid ${zone.border}` }}>
                              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--sub)', marginBottom: 2 }}>
                                    {c.campaignId.slice(0, 8)}
                                  </div>
                                  <div style={{ fontSize: 10, color: 'var(--muted)', lineHeight: 1.4 }}>{c.recommendation}</div>
                                </div>
                                {zone.action && (
                                  <ExecuteButton
                                    campaign={c}
                                    action={zone.action}
                                    level={data.executionGate.level}
                                    gateMsg={data.executionGate.message}
                                  />
                                )}
                              </div>
                              <div style={{ display: 'flex', gap: 12, fontSize: 11 }}>
                                <span>ROAS: <b style={{ color: c.roas >= 2 ? '#10b981' : c.roas >= 1 ? '#f59e0b' : '#ef4444' }}>{c.roas.toFixed(2)}x</b></span>
                                <span>Perf: <b style={{ color: 'var(--indigo-l)' }}>{c.performanceScore.toFixed(1)}</b></span>
                                <span style={{ color: 'var(--muted)' }}>Conf: {(c.confidence * 100).toFixed(0)}%</span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pending approval queue */}
              {pendingActions.length > 0 && (
                <div className="intel-panel">
                  <div className="intel-panel-header">
                    <span className="section-label" style={{ margin: 0 }}>⏳ Pending Approval Queue</span>
                    <span className="badge" style={{ marginLeft: 8, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', color: 'var(--amber)', fontSize: 11 }}>
                      {pendingActions.length}
                    </span>
                  </div>
                  <div style={{ padding: '8px 0' }}>
                    {pendingActions.map(pa => (
                      <div key={pa.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 16px', borderBottom: '1px solid var(--border)' }}>
                        <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--sub)' }}>{pa.campaignId.slice(0, 8)}</span>
                        <span className="badge" style={{ fontSize: 10, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', color: 'var(--indigo-l)' }}>{pa.action.toUpperCase()}</span>
                        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                          <button onClick={() => handleApprove(pa.id)} style={{ padding: '4px 12px', borderRadius: 5, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>Approve</button>
                          <button onClick={() => handleReject(pa.id)} style={{ padding: '4px 12px', borderRadius: 5, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>Reject</button>
                        </div>
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
