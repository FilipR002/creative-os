'use client';
import { useEffect, useState } from 'react';
import { Sidebar } from '@/components/Sidebar';
import {
  getFeatureProfits,
  getUnitEconomics,
  getProfitTrends,
  getProfitIntelSummary,
  type FeatureProfitEntry,
  type UnitEconomicsEntry,
  type ProfitTrendPoint,
  type ProfitIntelSummary,
} from '@/lib/api/creator-client';

type Tab = 'features' | 'unit' | 'trends';

function fmt$(n: number) { return `$${n.toFixed(2)}`; }
function fmtPct(n: number) { return `${(n * 100).toFixed(1)}%`; }

export default function UnitEconomicsPage() {
  const [tab, setTab]           = useState<Tab>('unit');
  const [features, setFeatures] = useState<FeatureProfitEntry[]>([]);
  const [units, setUnits]       = useState<UnitEconomicsEntry[]>([]);
  const [trends, setTrends]     = useState<ProfitTrendPoint[]>([]);
  const [summary, setSummary]   = useState<ProfitIntelSummary | null>(null);
  const [range, setRange]       = useState<'7d' | '30d'>('7d');
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      getFeatureProfits(),
      getUnitEconomics(),
      getProfitTrends(range),
      getProfitIntelSummary(),
    ])
      .then(([f, u, t, s]) => { setFeatures(f); setUnits(u); setTrends(t); setSummary(s); })
      .catch(e => setError(e?.message ?? 'Failed to load data'))
      .finally(() => setLoading(false));
  }, [range]);

  const TABS: { id: Tab; label: string }[] = [
    { id: 'unit',     label: 'Unit Economics' },
    { id: 'features', label: 'Feature Profits' },
    { id: 'trends',   label: 'Profit Trends'  },
  ];

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-main">
        <div className="page-content">

          {/* Header */}
          <div style={{ marginBottom: 20 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', margin: '0 0 4px' }}>Unit Economics Intelligence</h1>
            <p style={{ fontSize: 12, color: 'var(--sub)', margin: 0 }}>
              Per-unit cost, revenue, and margin across features and campaigns
            </p>
          </div>

          {/* Summary bar */}
          {summary && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10, marginBottom: 20 }}>
              {[
                { label: 'Revenue',    value: fmt$(summary.totalRevenueAttributed), color: 'var(--emerald)' },
                { label: 'Cost',       value: fmt$(summary.totalCost),              color: 'var(--rose)'    },
                { label: 'Profit',     value: fmt$(summary.totalProfit),             color: summary.totalProfit >= 0 ? 'var(--emerald)' : 'var(--rose)' },
                { label: 'Margin',     value: fmtPct(summary.profitMargin),          color: 'var(--indigo-l)' },
                { label: 'ROI',        value: fmtPct(summary.roi),                   color: 'var(--amber)'   },
              ].map(m => (
                <div key={m.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>{m.label}</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: m.color, fontFamily: 'var(--mono)' }}>{m.value}</div>
                </div>
              ))}
            </div>
          )}

          {/* Tabs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <div className="tab-bar">
              {TABS.map(t => (
                <button key={t.id} className={`tab-btn${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)}>
                  {t.label}
                </button>
              ))}
            </div>
            {tab === 'trends' && (
              <div className="tab-bar" style={{ marginLeft: 'auto' }}>
                {(['7d', '30d'] as const).map(r => (
                  <button key={r} className={`tab-btn${range === r ? ' active' : ''}`} onClick={() => setRange(r)}>{r}</button>
                ))}
              </div>
            )}
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
          ) : (
            <>
              {/* Unit Economics tab */}
              {tab === 'unit' && (
                <div>
                  {units.length === 0 ? (
                    <div className="intel-panel" style={{ textAlign: 'center', padding: 48, color: 'var(--muted)', fontSize: 13 }}>No unit economics data available yet</div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                      {units.map(u => (
                        <div key={u.feature} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 16 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                            <span style={{ fontSize: 20 }}>{u.icon}</span>
                            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{u.label}</span>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8 }}>
                            {[
                              { label: 'Cost / use',    value: fmt$(u.avgCostPerUse),    color: 'var(--rose)'    },
                              { label: 'Revenue / use', value: fmt$(u.avgRevenuePerUse), color: 'var(--emerald)' },
                              { label: 'Profit / use',  value: fmt$(u.profitPerUse),     color: u.profitPerUse >= 0 ? 'var(--emerald)' : 'var(--rose)' },
                              { label: 'Uses',          value: u.usageCount.toLocaleString(), color: 'var(--text)' },
                            ].map(m => (
                              <div key={m.label} style={{ textAlign: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: 6, padding: '8px 4px' }}>
                                <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 2 }}>{m.label}</div>
                                <div style={{ fontSize: 13, fontWeight: 700, color: m.color, fontFamily: 'var(--mono)' }}>{m.value}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Feature Profits tab */}
              {tab === 'features' && (
                <div>
                  {features.length === 0 ? (
                    <div className="intel-panel" style={{ textAlign: 'center', padding: 48, color: 'var(--muted)', fontSize: 13 }}>No feature profit data available yet</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {features.map(f => (
                        <div key={f.feature} style={{
                          background: 'var(--surface)',
                          border: `1px solid ${f.status === 'profitable' ? 'rgba(16,185,129,0.2)' : f.status === 'break-even' ? 'rgba(245,158,11,0.2)' : 'rgba(239,68,68,0.2)'}`,
                          borderRadius: 10, padding: '14px 16px',
                          display: 'flex', alignItems: 'center', gap: 16,
                        }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>{f.label}</div>
                            <div style={{ fontSize: 11, color: 'var(--muted)' }}>{f.usageCount.toLocaleString()} uses · {fmtPct(f.attributionConfidence)} confidence</div>
                          </div>
                          <div style={{ display: 'flex', gap: 20 }}>
                            {[
                              { label: 'Revenue', value: fmt$(f.revenueAttributed), color: 'var(--emerald)' },
                              { label: 'Cost',    value: fmt$(f.cost),              color: 'var(--rose)'    },
                              { label: 'Profit',  value: fmt$(f.profit),            color: f.profit >= 0 ? 'var(--emerald)' : 'var(--rose)' },
                              { label: 'ROI',     value: fmtPct(f.roi),             color: 'var(--indigo-l)' },
                              { label: 'Margin',  value: fmtPct(f.profitMargin),    color: 'var(--amber)'   },
                            ].map(m => (
                              <div key={m.label} style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 2 }}>{m.label}</div>
                                <div style={{ fontSize: 13, fontWeight: 700, color: m.color, fontFamily: 'var(--mono)' }}>{m.value}</div>
                              </div>
                            ))}
                          </div>
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 5,
                            background: f.status === 'profitable' ? 'rgba(16,185,129,0.1)' : f.status === 'break-even' ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)',
                            color: f.status === 'profitable' ? 'var(--emerald)' : f.status === 'break-even' ? 'var(--amber)' : 'var(--rose)',
                            border: `1px solid ${f.status === 'profitable' ? 'rgba(16,185,129,0.25)' : f.status === 'break-even' ? 'rgba(245,158,11,0.25)' : 'rgba(239,68,68,0.25)'}`,
                          }}>
                            {f.status.toUpperCase().replace('-', ' ')}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Profit Trends tab */}
              {tab === 'trends' && (
                <div>
                  {trends.length === 0 ? (
                    <div className="intel-panel" style={{ textAlign: 'center', padding: 48, color: 'var(--muted)', fontSize: 13 }}>No trend data available yet</div>
                  ) : (
                    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                          <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border)' }}>
                            {['Date', 'Cost', 'Revenue', 'Profit'].map(h => (
                              <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: 'var(--muted)', fontWeight: 700, fontSize: 11 }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {trends.map((t, i) => (
                            <tr key={t.date} style={{ borderBottom: i < trends.length - 1 ? '1px solid var(--border)' : 'none' }}>
                              <td style={{ padding: '10px 14px', color: 'var(--sub)', fontFamily: 'var(--mono)' }}>{t.date}</td>
                              <td style={{ padding: '10px 14px', color: 'var(--rose)',    fontFamily: 'var(--mono)', fontWeight: 600 }}>{fmt$(t.totalCost)}</td>
                              <td style={{ padding: '10px 14px', color: 'var(--emerald)', fontFamily: 'var(--mono)', fontWeight: 600 }}>{fmt$(t.totalRevenue)}</td>
                              <td style={{ padding: '10px 14px', color: t.profit >= 0 ? 'var(--emerald)' : 'var(--rose)', fontFamily: 'var(--mono)', fontWeight: 700 }}>{fmt$(t.profit)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
