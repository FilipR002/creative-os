'use client';
import { useEffect, useState } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { FinancialOsNav } from '@/components/FinancialOsNav';
import {
  getCeoPortfolio,
  getCeoStrategy,
  getCapitalAllocation,
  type CeoPortfolio,
  type CeoStrategy,
} from '@/lib/api/creator-client';

// ── Local types ───────────────────────────────────────────────────────────────
interface CapitalAllocationRow {
  campaignId:   string;
  currentShare: number;  // %
  idealShare:   number;  // %
  action:       string;
  rationale:    string;
}

interface PortfolioCampaign {
  campaignId:        string;
  name?:             string;
  roas:              number;
  performanceScore?: number;
  status:            'CHAMPION' | 'ACTIVE' | 'DECLINING' | 'PAUSED' | string;
  rank:              number;
  capitalSuggestion: 'INCREASE' | 'MAINTAIN' | 'REDUCE' | 'EXIT' | string;
}

// ── Colour helpers ────────────────────────────────────────────────────────────
const STATUS_COLOR: Record<string, string> = {
  CHAMPION:  'var(--emerald)',
  ACTIVE:    'var(--indigo-l)',
  DECLINING: 'var(--rose)',
  PAUSED:    'var(--muted)',
};
const STATUS_BG: Record<string, string> = {
  CHAMPION:  'rgba(16,185,129,0.1)',
  ACTIVE:    'rgba(99,102,241,0.1)',
  DECLINING: 'rgba(239,68,68,0.1)',
  PAUSED:    'rgba(255,255,255,0.04)',
};
const STATUS_BORDER: Record<string, string> = {
  CHAMPION:  'rgba(16,185,129,0.25)',
  ACTIVE:    'rgba(99,102,241,0.25)',
  DECLINING: 'rgba(239,68,68,0.25)',
  PAUSED:    'var(--border)',
};

const SUGGEST_COLOR: Record<string, string> = {
  INCREASE: 'var(--emerald)',
  MAINTAIN: 'var(--muted)',
  REDUCE:   'var(--amber)',
  EXIT:     'var(--rose)',
};
const SUGGEST_BG: Record<string, string> = {
  INCREASE: 'rgba(16,185,129,0.1)',
  MAINTAIN: 'rgba(255,255,255,0.04)',
  REDUCE:   'rgba(245,158,11,0.1)',
  EXIT:     'rgba(239,68,68,0.1)',
};
const SUGGEST_BORDER: Record<string, string> = {
  INCREASE: 'rgba(16,185,129,0.25)',
  MAINTAIN: 'var(--border)',
  REDUCE:   'rgba(245,158,11,0.25)',
  EXIT:     'rgba(239,68,68,0.25)',
};

const URGENCY_COLOR: Record<string, string> = {
  IMMEDIATE:  'var(--rose)',
  THIS_WEEK:  'var(--amber)',
  THIS_MONTH: 'var(--emerald)',
};
const URGENCY_BG: Record<string, string> = {
  IMMEDIATE:  'rgba(239,68,68,0.1)',
  THIS_WEEK:  'rgba(245,158,11,0.1)',
  THIS_MONTH: 'rgba(16,185,129,0.1)',
};
const URGENCY_BORDER: Record<string, string> = {
  IMMEDIATE:  'rgba(239,68,68,0.25)',
  THIS_WEEK:  'rgba(245,158,11,0.25)',
  THIS_MONTH: 'rgba(16,185,129,0.25)',
};

const IMPACT_COLOR: Record<string, string> = {
  HIGH:   'var(--rose)',
  MEDIUM: 'var(--amber)',
  LOW:    'var(--emerald)',
};
const IMPACT_BG: Record<string, string> = {
  HIGH:   'rgba(239,68,68,0.1)',
  MEDIUM: 'rgba(245,158,11,0.1)',
  LOW:    'rgba(16,185,129,0.1)',
};
const IMPACT_BORDER: Record<string, string> = {
  HIGH:   'rgba(239,68,68,0.25)',
  MEDIUM: 'rgba(245,158,11,0.25)',
  LOW:    'rgba(16,185,129,0.25)',
};

function fmt2(n: number) { return n.toFixed(2); }
function fmtUSD(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

// ── ROAS bar (proportional to max in dataset) ─────────────────────────────────
function RoasBar({ value, max, color = 'var(--indigo-l)' }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3 }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color, minWidth: 36, textAlign: 'right' }}>{fmt2(value)}x</span>
    </div>
  );
}

// ── Allocation bar pair ───────────────────────────────────────────────────────
function AllocationBars({ current, ideal }: { current: number; ideal: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 10, color: 'var(--muted)', width: 42, flexShrink: 0 }}>Current</span>
        <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)' }}>
          <div style={{ width: `${Math.min(100, current)}%`, height: '100%', background: 'var(--indigo-l)', borderRadius: 3 }} />
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--indigo-l)', width: 36, textAlign: 'right' }}>{current.toFixed(1)}%</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 10, color: 'var(--muted)', width: 42, flexShrink: 0 }}>Ideal</span>
        <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)' }}>
          <div style={{ width: `${Math.min(100, ideal)}%`, height: '100%', background: 'var(--emerald)', borderRadius: 3 }} />
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--emerald)', width: 36, textAlign: 'right' }}>{ideal.toFixed(1)}%</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function CeoDashboardPage() {
  const [portfolio,   setPortfolio]   = useState<CeoPortfolio | null>(null);
  const [strategy,    setStrategy]    = useState<CeoStrategy | null>(null);
  const [allocation,  setAllocation]  = useState<CapitalAllocationRow[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [activeTab,   setActiveTab]   = useState<'decisions' | 'portfolio' | 'allocation'>('decisions');

  useEffect(() => {
    Promise.all([
      getCeoPortfolio().catch(() => null),
      getCeoStrategy().catch(() => null),
      getCapitalAllocation().catch(() => []),
    ]).then(([p, s, a]) => {
      if (p) setPortfolio(p);
      if (s) setStrategy(s);
      setAllocation((a as CapitalAllocationRow[]) ?? []);
      setLoading(false);
    });
  }, []);

  const campaigns = (portfolio?.campaigns ?? []) as PortfolioCampaign[];
  const maxRoas   = campaigns.length > 0 ? Math.max(...campaigns.map(c => c.roas)) : 1;

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-main">
        <FinancialOsNav level={0} onLevelClick={() => {}} />
        <div className="page-content">

          {/* Header */}
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', margin: '0 0 4px' }}>
              🏢 AI CEO Dashboard
            </h1>
            <p style={{ fontSize: 13, color: 'var(--sub)', margin: 0 }}>
              Portfolio strategy · capital allocation · autonomous decisions with expected ROI
            </p>
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 64 }}>
              <div className="spin" style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--amber)', borderRadius: '50%' }} />
            </div>
          ) : (
            <>
              {/* Quarter goal + budget priority */}
              {strategy && (
                <div style={{ marginBottom: 20, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '18px 20px' }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', marginBottom: 6, lineHeight: 1.3 }}>
                    {strategy.quarterGoal}
                  </div>
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: 'var(--sub)' }}>
                      Budget priority: <strong style={{ color: 'var(--amber)' }}>{strategy.budgetPriority}</strong>
                    </span>
                    {strategy.topAngle && (
                      <span style={{ fontSize: 12, color: 'var(--sub)' }}>
                        Top angle: <strong style={{ color: 'var(--indigo-l)' }}>{strategy.topAngle}</strong>
                      </span>
                    )}
                    {strategy.scalingTarget && (
                      <span style={{ fontSize: 12, color: 'var(--sub)' }}>
                        Scaling target: <strong style={{ color: 'var(--emerald)' }}>{strategy.scalingTarget}</strong>
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Risk alert banner */}
              {strategy?.riskAlert && (
                <div style={{ marginBottom: 20, padding: '10px 16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 16, flexShrink: 0 }}>⚠</span>
                  <span style={{ fontSize: 13, color: 'var(--rose)', fontWeight: 600, lineHeight: 1.4 }}>{strategy.riskAlert}</span>
                </div>
              )}

              {/* Portfolio KPIs */}
              {portfolio && (
                <div className="intel-stats-grid" style={{ gridTemplateColumns: 'repeat(5,1fr)', marginBottom: 20 }}>
                  {[
                    { label: 'Total Spend',    value: fmtUSD(portfolio.totalSpend),                       color: 'var(--rose)'     },
                    { label: 'Total Revenue',  value: fmtUSD(portfolio.totalRevenue),                     color: 'var(--emerald)'  },
                    { label: 'Portfolio ROAS', value: `${fmt2(portfolio.portfolioROAS)}x`,                 color: 'var(--indigo-l)' },
                    { label: 'Champions',      value: String(portfolio.championCount),                     color: 'var(--emerald)'  },
                    { label: 'Declining',      value: String(portfolio.decliningCount),                    color: 'var(--rose)'     },
                  ].map(k => (
                    <div key={k.label} className="intel-stat-card">
                      <div className="intel-stat-label">{k.label}</div>
                      <div className="intel-stat-value" style={{ fontSize: 18, color: k.color }}>{k.value}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Opportunity / Risk callouts */}
              {(portfolio?.topOpportunity || portfolio?.biggestRisk) && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                  {portfolio.topOpportunity && (
                    <div style={{ padding: '10px 14px', background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--emerald)', marginBottom: 4 }}>TOP OPPORTUNITY</div>
                      <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>{portfolio.topOpportunity}</div>
                    </div>
                  )}
                  {portfolio.biggestRisk && (
                    <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--rose)', marginBottom: 4 }}>BIGGEST RISK</div>
                      <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>{portfolio.biggestRisk}</div>
                    </div>
                  )}
                </div>
              )}

              {/* Tab bar */}
              <div className="tab-bar" style={{ marginBottom: 16 }}>
                {([
                  { id: 'decisions',  label: 'CEO Decisions'      },
                  { id: 'portfolio',  label: 'Portfolio'           },
                  { id: 'allocation', label: 'Capital Allocation'  },
                ] as const).map(t => (
                  <button
                    key={t.id}
                    className={`tab-btn${activeTab === t.id ? ' active' : ''}`}
                    onClick={() => setActiveTab(t.id)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* ── Decisions ─────────────────────────────────────────── */}
              {activeTab === 'decisions' && (
                <div>
                  {!strategy || strategy.decisions.length === 0 ? (
                    <div style={{ padding: '24px 0', fontSize: 12, color: 'var(--muted)' }}>
                      No strategic decisions available. Import campaign performance data to enable CEO analysis.
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
                      {strategy.decisions.map(d => {
                        const urgColor  = URGENCY_COLOR[d.urgency]  ?? 'var(--muted)';
                        const urgBg     = URGENCY_BG[d.urgency]     ?? 'rgba(255,255,255,0.04)';
                        const urgBorder = URGENCY_BORDER[d.urgency] ?? 'var(--border)';
                        const impColor  = IMPACT_COLOR[d.impact]    ?? 'var(--muted)';
                        const impBg     = IMPACT_BG[d.impact]       ?? 'rgba(255,255,255,0.04)';
                        const impBorder = IMPACT_BORDER[d.impact]   ?? 'var(--border)';
                        return (
                          <div key={d.id} className="intel-panel" style={{ padding: 0 }}>
                            <div style={{ padding: '14px 16px' }}>
                              {/* Badges row */}
                              <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                                <span className="badge" style={{ color: urgColor, background: urgBg, border: `1px solid ${urgBorder}`, fontWeight: 700, fontSize: 10 }}>
                                  {d.urgency.replace(/_/g, ' ')}
                                </span>
                                <span className="badge" style={{ color: impColor, background: impBg, border: `1px solid ${impBorder}`, fontWeight: 700, fontSize: 10 }}>
                                  {d.impact} IMPACT
                                </span>
                              </div>
                              {/* Title */}
                              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 6, lineHeight: 1.3 }}>
                                {d.title}
                              </div>
                              {/* Rationale */}
                              <div style={{ fontSize: 12, color: 'var(--sub)', lineHeight: 1.55, marginBottom: 12 }}>
                                {d.rationale}
                              </div>
                              {/* Expected ROI */}
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 6, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
                                <span style={{ fontSize: 11, color: 'var(--muted)' }}>Expected ROI</span>
                                <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--emerald)' }}>
                                  +{(d.expectedROI * 100).toFixed(0)}%
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ── Portfolio table ────────────────────────────────────── */}
              {activeTab === 'portfolio' && (
                <div className="intel-panel">
                  {campaigns.length === 0 ? (
                    <div style={{ padding: '20px 14px', fontSize: 12, color: 'var(--muted)' }}>
                      No campaigns in portfolio yet.
                    </div>
                  ) : (
                    <div className="scroll-pane" style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--border)' }}>
                            {['Rank', 'ID', 'Name', 'ROAS', 'Status', 'Suggestion'].map(h => (
                              <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--muted)', fontSize: 11, whiteSpace: 'nowrap' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {[...campaigns]
                            .sort((a, b) => a.rank - b.rank)
                            .map((c, idx) => {
                              const roasColor =
                                c.roas >= 3   ? 'var(--emerald)' :
                                c.roas >= 1.5 ? 'var(--amber)'   : 'var(--rose)';
                              return (
                                <tr key={c.campaignId ?? idx} style={{ borderBottom: '1px solid var(--border)' }}>
                                  <td style={{ padding: '9px 12px', color: 'var(--muted)', fontWeight: 700, textAlign: 'center' }}>
                                    #{c.rank}
                                  </td>
                                  <td style={{ padding: '9px 12px', color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: 11 }}>
                                    {c.campaignId.slice(0, 8)}
                                  </td>
                                  <td style={{ padding: '9px 12px', color: 'var(--text)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {c.name ?? '—'}
                                  </td>
                                  <td style={{ padding: '9px 12px', minWidth: 160 }}>
                                    <RoasBar value={c.roas} max={maxRoas} color={roasColor} />
                                  </td>
                                  <td style={{ padding: '9px 12px' }}>
                                    <span className="badge" style={{
                                      color:      STATUS_COLOR[c.status]  ?? 'var(--muted)',
                                      background: STATUS_BG[c.status]     ?? 'rgba(255,255,255,0.04)',
                                      border:     `1px solid ${STATUS_BORDER[c.status] ?? 'var(--border)'}`,
                                      fontWeight: 700,
                                    }}>
                                      {c.status}
                                    </span>
                                  </td>
                                  <td style={{ padding: '9px 12px' }}>
                                    <span className="badge" style={{
                                      color:      SUGGEST_COLOR[c.capitalSuggestion]  ?? 'var(--muted)',
                                      background: SUGGEST_BG[c.capitalSuggestion]     ?? 'rgba(255,255,255,0.04)',
                                      border:     `1px solid ${SUGGEST_BORDER[c.capitalSuggestion] ?? 'var(--border)'}`,
                                      fontWeight: 700,
                                    }}>
                                      {c.capitalSuggestion}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* ── Capital Allocation ─────────────────────────────────── */}
              {activeTab === 'allocation' && (
                <div>
                  {allocation.length === 0 ? (
                    <div style={{ padding: '24px 0', fontSize: 12, color: 'var(--muted)' }}>
                      Capital allocation data not yet available.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {allocation.map((row, idx) => {
                        const delta = row.idealShare - row.currentShare;
                        const deltaColor =
                          delta > 1  ? 'var(--emerald)' :
                          delta < -1 ? 'var(--rose)'    : 'var(--muted)';
                        const actionColor = SUGGEST_COLOR[row.action.toUpperCase()] ?? 'var(--muted)';
                        const actionBg    = SUGGEST_BG[row.action.toUpperCase()]    ?? 'rgba(255,255,255,0.04)';
                        const actionBorder= SUGGEST_BORDER[row.action.toUpperCase()] ?? 'var(--border)';
                        return (
                          <div key={row.campaignId ?? idx} className="intel-panel" style={{ padding: 0 }}>
                            <div style={{ padding: '12px 16px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
                                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--mono)' }}>
                                  {row.campaignId.slice(0, 8)}
                                </span>
                                <span className="badge" style={{ color: actionColor, background: actionBg, border: `1px solid ${actionBorder}`, fontWeight: 700, fontSize: 10 }}>
                                  {row.action.toUpperCase()}
                                </span>
                                <span style={{ fontSize: 12, fontWeight: 700, color: deltaColor, marginLeft: 'auto' }}>
                                  {delta > 0 ? `+${delta.toFixed(1)}%` : `${delta.toFixed(1)}%`} delta
                                </span>
                              </div>
                              <AllocationBars current={row.currentShare} ideal={row.idealShare} />
                              {row.rationale && (
                                <div style={{ marginTop: 8, fontSize: 11, color: 'var(--muted)', lineHeight: 1.5 }}>
                                  {row.rationale}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
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
