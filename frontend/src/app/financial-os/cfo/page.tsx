'use client';
import { useEffect, useState } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { FinancialOsNav } from '@/components/FinancialOsNav';
import {
  getCfoForecast, getCfoInsights,
  type CfoForecast, type CfoInsight,
} from '@/lib/api/creator-client';

function trendMeta(trend: CfoForecast['trend']) {
  if (trend === 'GROWING')   return { label: 'GROWING',   color: '#10b981', bg: 'rgba(16,185,129,0.1)',   border: 'rgba(16,185,129,0.25)' };
  if (trend === 'DECLINING') return { label: 'DECLINING', color: '#ef4444', bg: 'rgba(239,68,68,0.1)',    border: 'rgba(239,68,68,0.25)'  };
  return                            { label: 'STABLE',    color: '#6366f1', bg: 'rgba(99,102,241,0.1)',   border: 'rgba(99,102,241,0.25)' };
}

function impactMeta(impact: CfoInsight['impact']) {
  if (impact === 'HIGH')   return { color: 'var(--rose)',    bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.2)'   };
  if (impact === 'MEDIUM') return { color: 'var(--amber)',   bg: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.2)'  };
  return                          { color: 'var(--emerald)', bg: 'rgba(16,185,129,0.08)',  border: 'rgba(16,185,129,0.2)'  };
}

function catColor(cat: CfoInsight['category']): string {
  const m: Record<string, string> = {
    ROI: 'var(--emerald)', COST: 'var(--amber)', SCALING: 'var(--indigo-l)',
    RISK: 'var(--rose)', OPPORTUNITY: 'var(--purple)',
  };
  return m[cat] ?? 'var(--sub)';
}

function fmtDate(s: string) {
  try { return new Date(s).toLocaleDateString([], { month: 'short', day: 'numeric' }); } catch { return s; }
}

export default function CfoDashboardPage() {
  const [forecast, setForecast] = useState<CfoForecast | null>(null);
  const [insights, setInsights] = useState<CfoInsight[]>([]);
  const [loading, setLoading]   = useState(true);
  const [days, setDays]         = useState(7);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getCfoForecast(days),
      getCfoInsights(),
    ])
      .then(([f, ins]) => {
        setForecast(f);
        setInsights(ins);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [days]);

  const daily = forecast?.dailyForecast ?? [];
  const maxRev = Math.max(...daily.map(d => d.revenue), 0.001);

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-main">
        <FinancialOsNav level={0} onLevelClick={() => {}} />
        <div className="page-content">

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', margin: '0 0 4px' }}>🧠 AI CFO Dashboard</h1>
              <p style={{ fontSize: 12, color: 'var(--sub)', margin: 0 }}>Predictive financial intelligence powered by your campaign data</p>
            </div>
            <div className="tab-bar">
              {([7, 14, 30] as const).map(d => (
                <button key={d} className={`tab-btn${days === d ? ' active' : ''}`} onClick={() => setDays(d)}>
                  {d}d
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
              <div className="spin" style={{ width: 36, height: 36, border: '3px solid var(--border)', borderTopColor: 'var(--indigo)', borderRadius: '50%' }} />
            </div>
          ) : (
            <>
              {/* Trend badge + confidence */}
              {forecast && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                  {(() => {
                    const tm = trendMeta(forecast.trend);
                    return (
                      <span style={{ padding: '5px 14px', borderRadius: 20, background: tm.bg, border: `1px solid ${tm.border}`, color: tm.color, fontSize: 12, fontWeight: 800, letterSpacing: '0.05em' }}>
                        {tm.label}
                      </span>
                    );
                  })()}
                  <div style={{ flex: 1, maxWidth: 200 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={{ fontSize: 11, color: 'var(--muted)' }}>Model Confidence</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)' }}>{(forecast.confidence * 100).toFixed(0)}%</span>
                    </div>
                    <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${forecast.confidence * 100}%`, background: 'var(--indigo)', borderRadius: 3, transition: 'width 0.4s' }} />
                    </div>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>{forecast.forecastPeriodDays}-day forecast</span>
                </div>
              )}

              {/* 4 stat cards */}
              {forecast && (
                <div className="intel-stats-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 20 }}>
                  {[
                    { label: 'Predicted Revenue', value: `$${forecast.predictedRevenue.toFixed(2)}`,             color: 'var(--emerald)'  },
                    { label: 'Predicted Spend',   value: `$${forecast.predictedSpend.toFixed(2)}`,               color: 'var(--amber)'    },
                    { label: 'Predicted Profit',  value: `$${forecast.predictedProfit.toFixed(2)}`,              color: forecast.predictedProfit >= 0 ? 'var(--emerald)' : 'var(--rose)' },
                    { label: 'Predicted ROI',     value: `${(forecast.predictedROI * 100).toFixed(1)}%`,         color: 'var(--indigo-l)' },
                  ].map(card => (
                    <div key={card.label} className="intel-stat-card">
                      <div className="intel-stat-label">{card.label}</div>
                      <div className="intel-stat-value" style={{ fontSize: 20, color: card.color }}>{card.value}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Daily forecast mini chart */}
              {daily.length > 0 && (
                <div className="intel-panel" style={{ marginBottom: 16 }}>
                  <div className="intel-panel-header">
                    <span className="section-label" style={{ margin: 0 }}>Daily Forecast — Revenue vs Spend</span>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginLeft: 'auto' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--muted)' }}>
                        <span style={{ width: 10, height: 10, background: 'var(--emerald)', borderRadius: 2, display: 'inline-block', opacity: 0.7 }} /> Revenue
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--muted)' }}>
                        <span style={{ width: 10, height: 10, background: 'var(--amber)', borderRadius: 2, display: 'inline-block', opacity: 0.7 }} /> Spend
                      </span>
                    </div>
                  </div>
                  <div style={{ padding: '16px 16px 8px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 100 }}>
                      {daily.map((d, i) => {
                        const revPct = maxRev > 0 ? (d.revenue / maxRev) * 90 : 0;
                        const spPct  = maxRev > 0 ? (d.spend  / maxRev) * 90 : 0;
                        return (
                          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                            <div style={{ width: '100%', display: 'flex', gap: 1, alignItems: 'flex-end', height: 90 }}>
                              <div title={`Rev $${d.revenue.toFixed(2)}`} style={{ flex: 1, height: `${Math.max(revPct, 2)}%`, background: '#10b981', borderRadius: '2px 2px 0 0', opacity: 0.8, minHeight: 2 }} />
                              <div title={`Spend $${d.spend.toFixed(2)}`} style={{ flex: 1, height: `${Math.max(spPct, 2)}%`, background: '#f59e0b', borderRadius: '2px 2px 0 0', opacity: 0.8, minHeight: 2 }} />
                            </div>
                            <span style={{ fontSize: 9, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', maxWidth: '100%', textAlign: 'center' }}>{fmtDate(d.date)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Risk + Opportunities */}
              {forecast && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
                  <div className="intel-panel">
                    <div className="intel-panel-header">
                      <span className="section-label" style={{ margin: 0 }}>⚠ Risk Factors</span>
                    </div>
                    <div style={{ padding: '8px 0' }}>
                      {forecast.riskFactors.length === 0 ? (
                        <div style={{ fontSize: 12, color: 'var(--muted)', padding: '12px 16px' }}>No risk factors identified</div>
                      ) : forecast.riskFactors.map((r, i) => (
                        <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 16px', borderBottom: '1px solid var(--border)' }}>
                          <span style={{ color: 'var(--amber)', fontSize: 13, flexShrink: 0, marginTop: 1 }}>⚠</span>
                          <span style={{ fontSize: 12, color: 'var(--sub)', lineHeight: 1.5 }}>{r}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="intel-panel">
                    <div className="intel-panel-header">
                      <span className="section-label" style={{ margin: 0 }}>→ Opportunities</span>
                    </div>
                    <div style={{ padding: '8px 0' }}>
                      {forecast.opportunities.length === 0 ? (
                        <div style={{ fontSize: 12, color: 'var(--muted)', padding: '12px 16px' }}>No opportunities identified yet</div>
                      ) : forecast.opportunities.map((o, i) => (
                        <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 16px', borderBottom: '1px solid var(--border)' }}>
                          <span style={{ color: 'var(--emerald)', fontSize: 13, flexShrink: 0, marginTop: 1 }}>→</span>
                          <span style={{ fontSize: 12, color: 'var(--sub)', lineHeight: 1.5 }}>{o}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* CFO Insights */}
              <div className="section-label">CFO Insights</div>
              {insights.length === 0 ? (
                <div className="intel-panel" style={{ textAlign: 'center', padding: 40, color: 'var(--muted)', fontSize: 12 }}>
                  No insights available — import campaign outcomes to enable analysis
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 12 }}>
                  {insights.map(ins => {
                    const im = impactMeta(ins.impact);
                    return (
                      <div key={ins.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                          <span className="badge" style={{ background: im.bg, border: `1px solid ${im.border}`, color: im.color, fontSize: 10 }}>
                            {ins.impact}
                          </span>
                          <span style={{ fontSize: 10, fontWeight: 700, color: catColor(ins.category), textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {ins.category}
                          </span>
                          <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--muted)' }}>
                            {(ins.confidence * 100).toFixed(0)}% conf · {ins.dataPoints} pts
                          </span>
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 6, lineHeight: 1.4 }}>{ins.title}</div>
                        <div style={{ fontSize: 12, color: 'var(--sub)', lineHeight: 1.6 }}>{ins.body}</div>
                        <div style={{ marginTop: 10, fontSize: 10, color: 'var(--muted)' }}>
                          {fmtDate(ins.generatedAt)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
