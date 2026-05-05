'use client';
import { useEffect, useState } from 'react';
import {
  getCeoPortfolio,
  getCeoStrategy,
  getCapitalAllocation,
  type CeoPortfolio,
  type CeoStrategy,
} from '@/lib/api/creator-client';

function fmt$(n: number | undefined | null) { return `$${(n ?? 0).toFixed(2)}`; }

const URGENCY_COLOR: Record<string, string> = {
  HIGH:   'var(--rose)',
  MEDIUM: 'var(--amber)',
  LOW:    'var(--indigo-l)',
};

export default function AICEOPage() {
  const [portfolio, setPortfolio] = useState<CeoPortfolio | null>(null);
  const [strategy,  setStrategy]  = useState<CeoStrategy  | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getCeoPortfolio(), getCeoStrategy()])
      .then(([p, s]) => { setPortfolio(p); setStrategy(s); })
      .catch(e => setError(e?.message ?? 'Failed to load data'))
      .finally(() => setLoading(false));
  }, []);

  return (
        <div className="page-content">

          <div style={{ marginBottom: 24 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', margin: '0 0 4px' }}>AI CEO</h1>
            <p style={{ fontSize: 12, color: 'var(--sub)', margin: 0 }}>Portfolio overview, strategic decisions, and capital allocation</p>
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
              {/* Portfolio KPIs */}
              {portfolio && (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 10, marginBottom: 14 }}>
                    {[
                      { label: 'Revenue',     value: fmt$(portfolio.totalRevenue),                 color: 'var(--emerald)'  },
                      { label: 'Spend',       value: fmt$(portfolio.totalSpend),                   color: 'var(--rose)'     },
                      { label: 'ROAS',        value: `${(portfolio.portfolioROAS ?? 0).toFixed(2)}x`,     color: portfolio.portfolioROAS >= 2 ? 'var(--emerald)' : portfolio.portfolioROAS >= 1 ? 'var(--amber)' : 'var(--rose)' },
                      { label: 'Active',      value: String(portfolio.activeCount),                color: 'var(--text)'     },
                      { label: 'Champions',   value: String(portfolio.championCount),              color: 'var(--emerald)'  },
                      { label: 'Declining',   value: String(portfolio.decliningCount),             color: 'var(--rose)'     },
                    ].map(m => (
                      <div key={m.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', textAlign: 'center' }}>
                        <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>{m.label}</div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: m.color, fontFamily: 'var(--mono)' }}>{m.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Alerts */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                    {portfolio.topOpportunity && (
                      <div style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--emerald)' }}>
                        <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Top Opportunity</div>
                        {portfolio.topOpportunity}
                      </div>
                    )}
                    {portfolio.biggestRisk && (
                      <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--rose)' }}>
                        <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Biggest Risk</div>
                        {portfolio.biggestRisk}
                      </div>
                    )}
                  </div>

                  {/* Campaign rankings */}
                  {portfolio.campaigns.length > 0 && (
                    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', marginBottom: 24 }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                          <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border)' }}>
                            {['Rank', 'Campaign', 'ROAS', 'Status', 'Capital'].map(h => (
                              <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: 'var(--muted)', fontWeight: 700, fontSize: 11 }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {portfolio.campaigns.map((c, i) => (
                            <tr key={c.campaignId} style={{ borderBottom: i < portfolio.campaigns.length - 1 ? '1px solid var(--border)' : 'none' }}>
                              <td style={{ padding: '10px 14px', color: 'var(--muted)', fontFamily: 'var(--mono)', fontWeight: 700 }}>#{c.rank}</td>
                              <td style={{ padding: '10px 14px', color: 'var(--sub)', fontFamily: 'var(--mono)', fontSize: 11 }}>{c.name ?? c.campaignId.slice(0,8)}</td>
                              <td style={{ padding: '10px 14px', fontFamily: 'var(--mono)', fontWeight: 700, color: c.roas >= 2 ? 'var(--emerald)' : c.roas >= 1 ? 'var(--amber)' : 'var(--rose)' }}>{(c.roas ?? 0).toFixed(2)}x</td>
                              <td style={{ padding: '10px 14px', color: 'var(--muted)' }}>{c.status}</td>
                              <td style={{ padding: '10px 14px', color: 'var(--sub)', fontSize: 11 }}>{c.capitalSuggestion}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Strategy */}
              {strategy && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>Strategic Decisions</div>

                  {/* Quarter goal & budget priority */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Quarter Goal</div>
                      <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.4 }}>{strategy.quarterGoal}</div>
                    </div>
                    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Budget Priority</div>
                      <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.4 }}>{strategy.budgetPriority}</div>
                    </div>
                  </div>

                  {strategy.riskAlert && (
                    <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: 'var(--rose)' }}>
                      Risk Alert: {strategy.riskAlert}
                    </div>
                  )}

                  {strategy.decisions.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {strategy.decisions.map(d => (
                        <div key={d.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', flex: 1 }}>{d.title}</span>
                            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                              background: d.urgency === 'HIGH' ? 'rgba(239,68,68,0.1)' : d.urgency === 'MEDIUM' ? 'rgba(245,158,11,0.1)' : 'rgba(99,102,241,0.1)',
                              border: `1px solid ${d.urgency === 'HIGH' ? 'rgba(239,68,68,0.25)' : d.urgency === 'MEDIUM' ? 'rgba(245,158,11,0.25)' : 'rgba(99,102,241,0.25)'}`,
                              color: URGENCY_COLOR[d.urgency] ?? 'var(--text)',
                            }}>
                              {d.urgency}
                            </span>
                            <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--emerald)' }}>
                              +{(d.expectedROI * 100).toFixed(0)}% ROI
                            </span>
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--sub)', marginBottom: 4, lineHeight: 1.4 }}>{d.rationale}</div>
                          <div style={{ fontSize: 11, color: 'var(--muted)' }}>Impact: {d.impact}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
  );
}
