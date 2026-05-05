'use client';
import { useEffect, useState } from 'react';
import {
  getCfoForecast,
  getCfoInsights,
  type CfoForecast,
  type CfoInsight,
} from '@/lib/api/creator-client';

const IMPACT_COLOR: Record<string, string> = {
  HIGH:   'var(--rose)',
  MEDIUM: 'var(--amber)',
  LOW:    'var(--indigo-l)',
};
const CATEGORY_LABEL: Record<string, string> = {
  ROI:         'ROI',
  COST:        'Cost',
  SCALING:     'Scaling',
  RISK:        'Risk',
  OPPORTUNITY: 'Opportunity',
};

export default function AICFOPage() {
  const [forecast, setForecast] = useState<CfoForecast | null>(null);
  const [insights, setInsights] = useState<CfoInsight[]>([]);
  const [days,     setDays]     = useState(30);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([getCfoForecast(days), getCfoInsights()])
      .then(([f, i]) => { setForecast(f); setInsights(i); })
      .catch(e => setError(e?.message ?? 'Failed to load data'))
      .finally(() => setLoading(false));
  }, [days]);

  function fmt$(n: number | undefined | null) { return `$${(n ?? 0).toFixed(2)}`; }
  function fmtPct(n: number | undefined | null) { return `${((n ?? 0) * 100).toFixed(1)}%`; }

  return (
        <div className="page-content">

          <div style={{ marginBottom: 20 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', margin: '0 0 4px' }}>AI CFO</h1>
            <p style={{ fontSize: 12, color: 'var(--sub)', margin: 0 }}>Revenue forecast and strategic financial insights</p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>Forecast window:</span>
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
          ) : (
            <>
              {forecast && (
                <div style={{ marginBottom: 24 }}>
                  {/* KPIs */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10, marginBottom: 16 }}>
                    {[
                      { label: 'Revenue',   value: fmt$(forecast.predictedRevenue), color: 'var(--emerald)' },
                      { label: 'Spend',     value: fmt$(forecast.predictedSpend),   color: 'var(--rose)'    },
                      { label: 'Profit',    value: fmt$(forecast.predictedProfit),  color: forecast.predictedProfit >= 0 ? 'var(--emerald)' : 'var(--rose)' },
                      { label: 'ROI',       value: fmtPct(forecast.predictedROI),   color: 'var(--indigo-l)' },
                      { label: 'Confidence',value: fmtPct(forecast.confidence),     color: 'var(--amber)'   },
                    ].map(m => (
                      <div key={m.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', textAlign: 'center' }}>
                        <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>{m.label}</div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: m.color, fontFamily: 'var(--mono)' }}>{m.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Trend badge */}
                  <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 6,
                      background: forecast.trend === 'GROWING' ? 'rgba(16,185,129,0.1)' : forecast.trend === 'STABLE' ? 'rgba(99,102,241,0.1)' : 'rgba(239,68,68,0.1)',
                      border: `1px solid ${forecast.trend === 'GROWING' ? 'rgba(16,185,129,0.25)' : forecast.trend === 'STABLE' ? 'rgba(99,102,241,0.25)' : 'rgba(239,68,68,0.25)'}`,
                      color: forecast.trend === 'GROWING' ? 'var(--emerald)' : forecast.trend === 'STABLE' ? 'var(--indigo-l)' : 'var(--rose)',
                    }}>
                      {forecast.trend}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--muted)', alignSelf: 'center' }}>
                      {forecast.forecastPeriodDays}-day window · {forecast.dailyForecast.length} data points
                    </span>
                  </div>

                  {/* Risk + Opportunities */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    {forecast.riskFactors.length > 0 && (
                      <div style={{ background: 'var(--surface)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: 16 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--rose)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Risk Factors</div>
                        {forecast.riskFactors.map((r, i) => (
                          <div key={i} style={{ fontSize: 12, color: 'var(--sub)', marginBottom: 6, paddingLeft: 8, borderLeft: '2px solid rgba(239,68,68,0.3)', lineHeight: 1.4 }}>{r}</div>
                        ))}
                      </div>
                    )}
                    {forecast.opportunities.length > 0 && (
                      <div style={{ background: 'var(--surface)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 10, padding: 16 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--emerald)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Opportunities</div>
                        {forecast.opportunities.map((o, i) => (
                          <div key={i} style={{ fontSize: 12, color: 'var(--sub)', marginBottom: 6, paddingLeft: 8, borderLeft: '2px solid rgba(16,185,129,0.3)', lineHeight: 1.4 }}>{o}</div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Insights */}
              {insights.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
                    AI Insights ({insights.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {insights.map(ins => (
                      <div key={ins.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', color: 'var(--indigo-l)' }}>
                            {CATEGORY_LABEL[ins.category] ?? ins.category}
                          </span>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                            background: ins.impact === 'HIGH' ? 'rgba(239,68,68,0.1)' : ins.impact === 'MEDIUM' ? 'rgba(245,158,11,0.1)' : 'rgba(99,102,241,0.1)',
                            border: `1px solid ${ins.impact === 'HIGH' ? 'rgba(239,68,68,0.25)' : ins.impact === 'MEDIUM' ? 'rgba(245,158,11,0.25)' : 'rgba(99,102,241,0.25)'}`,
                            color: IMPACT_COLOR[ins.impact] ?? 'var(--text)',
                          }}>
                            {ins.impact}
                          </span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', flex: 1 }}>{ins.title}</span>
                          <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--mono)' }}>{(ins.confidence * 100).toFixed(0)}% conf</span>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--sub)', lineHeight: 1.5 }}>{ins.body}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
  );
}
