'use client';
import { useEffect, useState, useRef } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { FinancialOsNav } from '@/components/FinancialOsNav';
import {
  getPortfolioRevenueForecast, getCampaignRevenueForecast,
  type RevenueForecast,
} from '@/lib/api/creator-client';

interface PortfolioForecast {
  predictedRevenue?: number;
  roiEstimate?:      number;
  confidence?:       number;
  forecastDays?:     number;
  [key: string]:     unknown;
}

function fmtDate(s: string) {
  try { return new Date(s).toLocaleDateString([], { month: 'short', day: 'numeric' }); } catch { return s; }
}

function confColor(c: number) {
  if (c >= 0.75) return 'var(--emerald)';
  if (c >= 0.5)  return 'var(--amber)';
  return 'var(--rose)';
}

export default function RevenueForecastPage() {
  const [portfolio, setPortfolio]   = useState<PortfolioForecast | null>(null);
  const [portLoading, setPortLoading] = useState(true);
  const [campaignId, setCampaignId] = useState('');
  const [forecast, setForecast]     = useState<RevenueForecast | null>(null);
  const [fcLoading, setFcLoading]   = useState(false);
  const [fcError, setFcError]       = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getPortfolioRevenueForecast(30)
      .then(r => setPortfolio(r as PortfolioForecast))
      .catch(() => {})
      .finally(() => setPortLoading(false));
  }, []);

  async function handleForecast() {
    const id = campaignId.trim();
    if (!id) return;
    setFcLoading(true);
    setFcError('');
    setForecast(null);
    try {
      const f = await getCampaignRevenueForecast(id, 30);
      setForecast(f);
    } catch (e: unknown) {
      setFcError(e instanceof Error ? e.message : 'Forecast failed');
    } finally {
      setFcLoading(false);
    }
  }

  const proj = forecast?.dailyProjection ?? [];
  const maxCumulative = Math.max(...proj.map(p => p.cumulative), 0.001);

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-main">
        <FinancialOsNav level={0} onLevelClick={() => {}} />
        <div className="page-content">

          {/* Header */}
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', margin: '0 0 4px' }}>📈 Revenue Forecasting Engine</h1>
            <p style={{ fontSize: 12, color: 'var(--sub)', margin: 0 }}>Portfolio-wide and per-campaign predictive revenue analysis</p>
          </div>

          {/* Portfolio Forecast */}
          <div className="intel-panel" style={{ marginBottom: 24 }}>
            <div className="intel-panel-header">
              <span className="section-label" style={{ margin: 0 }}>Portfolio Forecast (30 days)</span>
              {portLoading && (
                <span className="spin" style={{ width: 14, height: 14, border: '2px solid var(--border)', borderTopColor: 'var(--indigo)', borderRadius: '50%', display: 'inline-block', marginLeft: 10 }} />
              )}
            </div>
            <div style={{ padding: 16 }}>
              {portLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
                  <div className="spin" style={{ width: 28, height: 28, border: '3px solid var(--border)', borderTopColor: 'var(--indigo)', borderRadius: '50%' }} />
                </div>
              ) : !portfolio ? (
                <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', padding: 20 }}>Portfolio forecast unavailable</div>
              ) : (
                <div className="intel-stats-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
                  {[
                    { label: 'Predicted Revenue', value: portfolio.predictedRevenue != null ? `$${(portfolio.predictedRevenue as number).toFixed(2)}` : '—', color: 'var(--emerald)' },
                    { label: 'ROI Estimate',       value: portfolio.roiEstimate != null      ? `${((portfolio.roiEstimate as number) * 100).toFixed(1)}%` : '—', color: 'var(--indigo-l)' },
                    { label: 'Confidence',         value: portfolio.confidence != null       ? `${((portfolio.confidence as number) * 100).toFixed(0)}%`  : '—', color: confColor(portfolio.confidence as number ?? 0) },
                  ].map(c => (
                    <div key={c.label} className="intel-stat-card">
                      <div className="intel-stat-label">{c.label}</div>
                      <div className="intel-stat-value" style={{ fontSize: 20, color: c.color }}>{c.value}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Campaign Forecast Input */}
          <div className="intel-panel" style={{ marginBottom: 24 }}>
            <div className="intel-panel-header">
              <span className="section-label" style={{ margin: 0 }}>Campaign Revenue Forecast</span>
            </div>
            <div style={{ padding: 16 }}>
              <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                <input
                  ref={inputRef}
                  value={campaignId}
                  onChange={e => setCampaignId(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleForecast()}
                  placeholder="Enter Campaign ID…"
                  style={{
                    flex: 1,
                    padding: '9px 14px',
                    borderRadius: 7,
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                    color: 'var(--text)',
                    fontSize: 13,
                    fontFamily: 'var(--mono)',
                    outline: 'none',
                  }}
                />
                <button
                  onClick={handleForecast}
                  disabled={fcLoading || !campaignId.trim()}
                  style={{ padding: '9px 20px', borderRadius: 7, background: 'var(--indigo)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: fcLoading || !campaignId.trim() ? 'default' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 7, opacity: fcLoading || !campaignId.trim() ? 0.6 : 1 }}
                >
                  {fcLoading ? (
                    <span className="spin" style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block' }} />
                  ) : '📈'}
                  {fcLoading ? 'Forecasting…' : 'Forecast'}
                </button>
              </div>
              {fcError && (
                <div style={{ fontSize: 12, color: 'var(--rose)', padding: '8px 12px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6 }}>
                  {fcError}
                </div>
              )}
            </div>
          </div>

          {/* Forecast results */}
          {forecast && (
            <>
              {/* 4 Stat Cards */}
              <div className="intel-stats-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 20 }}>
                {[
                  { label: 'Predicted Revenue', value: `$${forecast.predictedRevenue.toFixed(2)}`,                         color: 'var(--emerald)'  },
                  { label: 'Best Case',          value: `$${forecast.bestCase.toFixed(2)}`,                                 color: 'var(--indigo-l)' },
                  { label: 'Worst Case',         value: `$${forecast.worstCase.toFixed(2)}`,                                color: 'var(--rose)'     },
                  { label: 'Break-Even Days',    value: forecast.breakEvenDays != null ? `${forecast.breakEvenDays}d` : '—', color: 'var(--amber)'    },
                ].map(c => (
                  <div key={c.label} className="intel-stat-card">
                    <div className="intel-stat-label">{c.label}</div>
                    <div className="intel-stat-value" style={{ fontSize: 20, color: c.color }}>{c.value}</div>
                  </div>
                ))}
              </div>

              {/* Additional summary */}
              <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                  ROI Estimate: <b style={{ color: 'var(--indigo-l)' }}>{(forecast.roiEstimate * 100).toFixed(1)}%</b>
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                  Confidence: <b style={{ color: confColor(forecast.confidence) }}>{(forecast.confidence * 100).toFixed(0)}%</b>
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                  Period: <b style={{ color: 'var(--text)' }}>{forecast.forecastDays}d</b>
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--mono)' }}>
                  Campaign: <b style={{ color: 'var(--sub)' }}>{forecast.campaignId.slice(0, 8)}</b>
                </div>
              </div>

              {/* Daily projection chart */}
              {proj.length > 0 && (
                <div className="intel-panel" style={{ marginBottom: 16 }}>
                  <div className="intel-panel-header">
                    <span className="section-label" style={{ margin: 0 }}>30-Day Cumulative Revenue Projection</span>
                  </div>
                  <div style={{ padding: '16px 16px 8px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 120 }}>
                      {proj.map((p, i) => {
                        const pct = maxCumulative > 0 ? (p.cumulative / maxCumulative) * 100 : 0;
                        const isLast = i === proj.length - 1;
                        return (
                          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                            <div
                              title={`Day ${p.day}: $${p.cumulative.toFixed(2)} cumulative`}
                              style={{
                                width: '100%',
                                height: `${Math.max(pct, 2)}%`,
                                background: `linear-gradient(180deg, var(--emerald) 0%, rgba(16,185,129,0.4) 100%)`,
                                borderRadius: isLast ? '3px 3px 0 0' : '2px 2px 0 0',
                                minHeight: 2,
                                transition: 'height 0.3s',
                                opacity: 0.6 + (i / proj.length) * 0.4,
                              }}
                            />
                            {(i === 0 || i === Math.floor(proj.length / 2) || i === proj.length - 1) && (
                              <span style={{ fontSize: 9, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{fmtDate(p.date)}</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Drivers */}
              {forecast.drivers.length > 0 && (
                <div className="intel-panel">
                  <div className="intel-panel-header">
                    <span className="section-label" style={{ margin: 0 }}>Revenue Drivers</span>
                  </div>
                  <div style={{ padding: '8px 0' }}>
                    {forecast.drivers.map((d, i) => (
                      <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 16px', borderBottom: '1px solid var(--border)' }}>
                        <span style={{ color: 'var(--emerald)', fontSize: 13, flexShrink: 0 }}>→</span>
                        <span style={{ fontSize: 12, color: 'var(--sub)', lineHeight: 1.5 }}>{d}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {!forecast && !fcLoading && !fcError && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)', fontSize: 13 }}>
              Enter a campaign ID above to generate a 30-day revenue forecast
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
