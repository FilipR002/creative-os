'use client';
import { useEffect, useState } from 'react';
import { getCostSummary, getCostEvents, type CostSummary } from '@/lib/api/creator-client';

function fmt$(n: number | undefined | null) { return `$${(n ?? 0).toFixed(4)}`; }
function fmtShort$(n: number | undefined | null) { return `$${(n ?? 0).toFixed(2)}`; }

export default function CostTrackingPage() {
  const [summary, setSummary] = useState<CostSummary | null>(null);
  const [events,  setEvents]  = useState<CostSummary['recentEvents']>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getCostSummary(), getCostEvents(50)])
      .then(([s, e]) => { setSummary(s); setEvents(e.events ?? s.recentEvents); })
      .catch(err => setError(err?.message ?? 'Failed to load data'))
      .finally(() => setLoading(false));
  }, []);

  return (
        <div className="page-content">

          <div style={{ marginBottom: 24 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', margin: '0 0 4px' }}>Cost Tracking</h1>
            <p style={{ fontSize: 12, color: 'var(--sub)', margin: 0 }}>
              Per-operation AI cost breakdown across all campaigns
            </p>
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
          ) : summary && (
            <>
              {/* KPIs */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 24 }}>
                {[
                  { label: 'Today',      value: fmtShort$(summary.totalToday)      },
                  { label: 'This Month', value: fmtShort$(summary.totalThisMonth)  },
                  { label: 'All Time',   value: fmtShort$(summary.totalAllTime)    },
                  { label: 'Avg / Campaign', value: fmtShort$(summary.avgCostPerCampaign) },
                ].map(m => (
                  <div key={m.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>{m.label}</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', fontFamily: 'var(--mono)' }}>{m.value}</div>
                  </div>
                ))}
              </div>

              {/* By Operation */}
              {Object.keys(summary.byOperationType).length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>By Operation Type</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {Object.entries(summary.byOperationType).map(([op, cost]) => (
                      <div key={op} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 11, color: 'var(--sub)', fontFamily: 'var(--mono)' }}>{op}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--mono)' }}>{fmtShort$(cost)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Events */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
                  Recent Events <span style={{ fontWeight: 400, color: 'var(--muted)' }}>({events.length})</span>
                </div>
                {events.length === 0 ? (
                  <div className="intel-panel" style={{ textAlign: 'center', padding: 40, color: 'var(--muted)', fontSize: 13 }}>No cost events recorded yet</div>
                ) : (
                  <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border)' }}>
                          {['Campaign', 'Operation', 'Cost', 'Time'].map(h => (
                            <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: 'var(--muted)', fontWeight: 700, fontSize: 11 }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {events.map((ev, i) => (
                          <tr key={ev.id} style={{ borderBottom: i < events.length - 1 ? '1px solid var(--border)' : 'none' }}>
                            <td style={{ padding: '10px 14px', color: 'var(--sub)', fontFamily: 'var(--mono)', fontSize: 11 }}>{ev.campaignId.slice(0,8)}</td>
                            <td style={{ padding: '10px 14px', color: 'var(--text)' }}>{ev.operationType}</td>
                            <td style={{ padding: '10px 14px', color: 'var(--rose)', fontFamily: 'var(--mono)', fontWeight: 700 }}>{fmt$(ev.cost)}</td>
                            <td style={{ padding: '10px 14px', color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: 11 }}>
                              {new Date(ev.timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
  );
}
