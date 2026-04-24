'use client';
import { useEffect, useState } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { getPortfolioRevenueForecast } from '@/lib/api/creator-client';

interface PortfolioForecast {
  forecastDays:     number;
  totalRevenue:     number;
  totalSpend:       number;
  totalProfit:      number;
  overallROI:       number;
  confidence:       number;
  campaignCount:    number;
  dailyAggregated?: Array<{ date: string; revenue: number; spend: number; profit: number }>;
}

function fmt$(n: number | undefined | null) { return `$${(n ?? 0).toFixed(2)}`; }
function fmtPct(n: number | undefined | null) { return `${((n ?? 0) * 100).toFixed(1)}%`; }

export default function RevenuePage() {
  const [data,    setData]    = useState<PortfolioForecast | null>(null);
  const [days,    setDays]    = useState(30);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getPortfolioRevenueForecast(days)
      .then(d => setData(d as PortfolioForecast))
      .catch(e => setError(e?.message ?? 'Failed to load data'))
      .finally(() => setLoading(false));
  }, [days]);

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-main">
        <div className="page-content">

          <div style={{ marginBottom: 20 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', margin: '0 0 4px' }}>Revenue Forecast</h1>
            <p style={{ fontSize: 12, color: 'var(--sub)', margin: 0 }}>Portfolio-wide revenue projection across all active campaigns</p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>Window:</span>
            <div className="tab-bar">
              {[7, 14, 30, 90].map(d => (
                <button key={d} className={`tab-btn${days === d ? ' active' : ''}`} onClick={() => setDays(d)}>{d}d</button>
              ))}
            </div>
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
              {/* KPIs */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10, marginBottom: 24 }}>
                {[
                  { label: 'Revenue',    value: fmt$(data.totalRevenue),    color: 'var(--emerald)' },
                  { label: 'Spend',      value: fmt$(data.totalSpend),      color: 'var(--rose)'    },
                  { label: 'Profit',     value: fmt$(data.totalProfit),     color: data.totalProfit >= 0 ? 'var(--emerald)' : 'var(--rose)' },
                  { label: 'ROI',        value: fmtPct(data.overallROI),    color: 'var(--indigo-l)' },
                  { label: 'Confidence', value: fmtPct(data.confidence),    color: 'var(--amber)'   },
                ].map(m => (
                  <div key={m.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>{m.label}</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: m.color, fontFamily: 'var(--mono)' }}>{m.value}</div>
                  </div>
                ))}
              </div>

              <div style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.18)', borderRadius: 8, padding: '10px 14px', marginBottom: 20, fontSize: 12, color: 'var(--indigo-l)' }}>
                {data.campaignCount} campaign{data.campaignCount !== 1 ? 's' : ''} · {data.forecastDays}-day window
              </div>

              {/* Daily breakdown */}
              {data.dailyAggregated && data.dailyAggregated.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>Daily Projection</div>
                  <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border)' }}>
                          {['Date', 'Revenue', 'Spend', 'Profit'].map(h => (
                            <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: 'var(--muted)', fontWeight: 700, fontSize: 11 }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {data.dailyAggregated.map((d, i) => (
                          <tr key={d.date} style={{ borderBottom: i < (data.dailyAggregated?.length ?? 0) - 1 ? '1px solid var(--border)' : 'none' }}>
                            <td style={{ padding: '10px 14px', color: 'var(--sub)', fontFamily: 'var(--mono)' }}>{d.date}</td>
                            <td style={{ padding: '10px 14px', color: 'var(--emerald)', fontFamily: 'var(--mono)', fontWeight: 600 }}>{fmt$(d.revenue)}</td>
                            <td style={{ padding: '10px 14px', color: 'var(--rose)',    fontFamily: 'var(--mono)', fontWeight: 600 }}>{fmt$(d.spend)}</td>
                            <td style={{ padding: '10px 14px', color: d.profit >= 0 ? 'var(--emerald)' : 'var(--rose)', fontFamily: 'var(--mono)', fontWeight: 700 }}>{fmt$(d.profit)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
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
