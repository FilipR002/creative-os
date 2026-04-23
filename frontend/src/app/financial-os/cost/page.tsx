'use client';
import { useEffect, useState, useCallback } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { FinancialOsNav } from '@/components/FinancialOsNav';
import {
  getCostSummary, getCostEvents,
  type CostSummary,
} from '@/lib/api/creator-client';

const OP_ICONS: Record<string, string> = {
  GENERATION: '⚡',
  ANALYSIS:   '🔍',
  SCORING:    '📊',
  FORECAST:   '📈',
  LEARNING:   '🧬',
  REBALANCE:  '🔁',
};

function fmt(n: number) {
  return n.toFixed(4);
}

function fmtTime(ts: string) {
  try {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return ts;
  }
}

function fmtDate(ts: string) {
  try {
    return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch {
    return ts;
  }
}

export default function CostTrackingPage() {
  const [summary, setSummary] = useState<CostSummary | null>(null);
  const [events, setEvents]   = useState<CostSummary['recentEvents']>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const [s, e] = await Promise.all([
        getCostSummary(),
        getCostEvents(50),
      ]);
      setSummary(s);
      setEvents(e.events ?? []);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const trend = summary?.costTrend ?? [];
  const maxTrend = Math.max(...trend.map(t => t.cost), 0.0001);

  const byOp = Object.entries(summary?.byOperationType ?? {}).sort((a, b) => b[1] - a[1]);
  const avgPerCampaign = summary?.avgCostPerCampaign ??
    (summary && Object.keys(summary.byCampaign).length > 0
      ? summary.totalAllTime / Object.keys(summary.byCampaign).length
      : 0);

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-main">
        <FinancialOsNav level={0} onLevelClick={() => {}} />
        <div className="page-content">

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', margin: '0 0 4px' }}>📊 Cost Tracking Dashboard</h1>
              <p style={{ fontSize: 12, color: 'var(--sub)', margin: 0 }}>Real-time AI operation spend across all campaigns</p>
            </div>
            <button
              onClick={() => load(true)}
              disabled={refreshing}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 7, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              {refreshing ? <span className="spin" style={{ width: 12, height: 12, border: '2px solid var(--border)', borderTopColor: 'var(--indigo)', borderRadius: '50%', display: 'inline-block' }} /> : '↻'}
              Refresh
            </button>
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 80 }}>
              <div className="spin" style={{ width: 36, height: 36, border: '3px solid var(--border)', borderTopColor: 'var(--indigo)', borderRadius: '50%' }} />
            </div>
          ) : (
            <>
              {/* Stat Cards */}
              <div className="intel-stats-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 24 }}>
                {[
                  { label: 'Total Today',         value: `$${fmt(summary?.totalToday ?? 0)}`,        color: 'var(--amber)'    },
                  { label: 'Total This Month',     value: `$${fmt(summary?.totalThisMonth ?? 0)}`,   color: 'var(--indigo-l)' },
                  { label: 'Total All-Time',       value: `$${fmt(summary?.totalAllTime ?? 0)}`,     color: 'var(--rose)'     },
                  { label: 'Avg per Campaign',     value: `$${fmt(avgPerCampaign)}`,                  color: 'var(--emerald)'  },
                ].map(card => (
                  <div key={card.label} className="intel-stat-card">
                    <div className="intel-stat-label">{card.label}</div>
                    <div className="intel-stat-value" style={{ fontSize: 20, color: card.color }}>{card.value}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>

                {/* 7-day cost trend chart */}
                <div className="intel-panel">
                  <div className="intel-panel-header">
                    <span className="section-label" style={{ margin: 0 }}>7-Day Cost Trend</span>
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>{trend.length} data points</span>
                  </div>
                  <div style={{ padding: '16px 16px 8px' }}>
                    {trend.length === 0 ? (
                      <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', padding: 24 }}>No trend data yet</div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 120 }}>
                        {trend.slice(-7).map((point, i) => {
                          const pct = maxTrend > 0 ? (point.cost / maxTrend) * 100 : 0;
                          return (
                            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                              <div
                                title={`$${point.cost.toFixed(4)}`}
                                style={{
                                  width: '100%',
                                  height: `${Math.max(pct, 4)}%`,
                                  background: 'var(--indigo)',
                                  borderRadius: '4px 4px 0 0',
                                  opacity: 0.75 + (i / trend.length) * 0.25,
                                  transition: 'height 0.3s',
                                  minHeight: 4,
                                }}
                              />
                              <span style={{ fontSize: 9, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{fmtDate(point.date)}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* By Operation Type */}
                <div className="intel-panel">
                  <div className="intel-panel-header">
                    <span className="section-label" style={{ margin: 0 }}>By Operation Type</span>
                  </div>
                  <div style={{ padding: '0 0 8px' }}>
                    {byOp.length === 0 ? (
                      <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', padding: 24 }}>No operation data yet</div>
                    ) : (
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--border)' }}>
                            <th style={{ padding: '8px 16px', textAlign: 'left', color: 'var(--muted)', fontWeight: 600, fontSize: 11 }}>Type</th>
                            <th style={{ padding: '8px 16px', textAlign: 'right', color: 'var(--muted)', fontWeight: 600, fontSize: 11 }}>Cost</th>
                          </tr>
                        </thead>
                        <tbody>
                          {byOp.map(([type, cost]) => (
                            <tr key={type} style={{ borderBottom: '1px solid var(--border)' }}>
                              <td style={{ padding: '8px 16px', color: 'var(--text)' }}>
                                <span style={{ marginRight: 8 }}>{OP_ICONS[type] ?? '⚙'}</span>
                                {type}
                              </td>
                              <td style={{ padding: '8px 16px', textAlign: 'right', color: 'var(--indigo-l)', fontFamily: 'var(--mono)', fontWeight: 600 }}>
                                ${fmt(cost)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>

              </div>

              {/* Recent Cost Events */}
              <div className="intel-panel">
                <div className="intel-panel-header">
                  <span className="section-label" style={{ margin: 0 }}>Recent Cost Events</span>
                  <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 'auto' }}>{events.length} events</span>
                </div>
                <div className="scroll-pane" style={{ maxHeight: 340 }}>
                  {events.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', padding: 32 }}>No recent events</div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'var(--surface)' }}>
                          <th style={{ padding: '8px 16px', textAlign: 'left', color: 'var(--muted)', fontWeight: 600, fontSize: 11 }}>Time</th>
                          <th style={{ padding: '8px 16px', textAlign: 'left', color: 'var(--muted)', fontWeight: 600, fontSize: 11 }}>Campaign</th>
                          <th style={{ padding: '8px 16px', textAlign: 'left', color: 'var(--muted)', fontWeight: 600, fontSize: 11 }}>Operation</th>
                          <th style={{ padding: '8px 16px', textAlign: 'right', color: 'var(--muted)', fontWeight: 600, fontSize: 11 }}>Cost</th>
                        </tr>
                      </thead>
                      <tbody>
                        {events.map((ev, i) => (
                          <tr key={ev.id ?? i} style={{ borderBottom: '1px solid var(--border)', opacity: 1 }}>
                            <td style={{ padding: '7px 16px', color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: 11 }}>
                              {fmtTime(ev.timestamp)}
                            </td>
                            <td style={{ padding: '7px 16px', color: 'var(--sub)', fontFamily: 'var(--mono)', fontSize: 11 }}>
                              {ev.campaignId?.slice(0, 8) ?? '—'}
                            </td>
                            <td style={{ padding: '7px 16px' }}>
                              <span className="badge" style={{ background: 'rgba(99,102,241,0.1)', color: 'var(--indigo-l)', border: '1px solid rgba(99,102,241,0.2)', fontSize: 10 }}>
                                {OP_ICONS[ev.operationType] ?? '⚙'} {ev.operationType}
                              </span>
                            </td>
                            <td style={{ padding: '7px 16px', textAlign: 'right', color: 'var(--amber)', fontFamily: 'var(--mono)', fontWeight: 600, fontSize: 12 }}>
                              ${fmt(ev.cost)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
