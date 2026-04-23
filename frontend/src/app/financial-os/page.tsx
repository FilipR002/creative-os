'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Sidebar } from '@/components/Sidebar';
import { FinancialOsNav } from '@/components/FinancialOsNav';
import {
  getAutonomyLevel, setAutonomyLevel, getCostSummary, getProfitZones, getCfoInsights,
  getCeoPortfolio, getCeoStrategy, getProfitModel,
  type AutonomyInfo, type CostSummary, type CfoInsight, type CeoPortfolio, type CeoStrategy,
} from '@/lib/api/creator-client';

const LEVEL_META = [
  { level: 0, color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.3)',   label: '🔴 L0 — Analyst Only',    desc: 'Read-only intelligence. No execution.' },
  { level: 1, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.3)',  label: '🟡 L1 — Advisor Mode',    desc: 'Recommendations only. Changes are advisory.' },
  { level: 2, color: '#f97316', bg: 'rgba(249,115,22,0.1)',  border: 'rgba(249,115,22,0.3)',  label: '🟠 L2 — Hybrid Approval', desc: 'AI proposes → admin approves → executes.' },
  { level: 3, color: '#10b981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.3)', label: '🟢 L3 — Autonomous',       desc: 'Full execution with safety checks + rollback.' },
];

const MODULES = [
  { href: '/financial-os/cost',     icon: '📊', label: 'Cost Tracking',      desc: 'Real-time spend by campaign & type',           color: '#6366f1' },
  { href: '/financial-os/optimizer',icon: '📉', label: 'Cost Optimizer',      desc: 'Efficiency scores + waste detection',          color: '#8b5cf6' },
  { href: '/financial-os/profit',   icon: '⚠',  label: 'Profit Zones',       desc: 'SCALE / FIX / KILL classification',            color: '#f59e0b' },
  { href: '/financial-os/cfo',      icon: '🧠', label: 'AI CFO',             desc: '30-day profit forecast + strategic insights',  color: '#06b6d4' },
  { href: '/financial-os/budget',   icon: '🔁', label: 'Budget Rebalancer',  desc: 'ROI-driven budget reallocation',               color: '#ec4899' },
  { href: '/financial-os/revenue',  icon: '📈', label: 'Revenue Forecast',   desc: 'Per-campaign + portfolio predictions',         color: '#10b981' },
  { href: '/financial-os/learning', icon: '🧬', label: 'Self-Learning Brain',desc: 'Adaptive thresholds from real performance',    color: '#a78bfa' },
  { href: '/financial-os/ceo',      icon: '🏢', label: 'AI CEO Dashboard',   desc: 'Portfolio strategy + capital allocation',      color: '#f97316' },
];

export default function FinancialOsHub() {
  const [autonomy,  setAutonomyState] = useState<AutonomyInfo | null>(null);
  const [cost,      setCost]          = useState<CostSummary | null>(null);
  const [zones,     setZones]         = useState<{ summary: { totalWaste: number; scalePotential: number; totalCampaigns: number } } | null>(null);
  const [insights,  setInsights]      = useState<CfoInsight[]>([]);
  const [portfolio, setPortfolio]     = useState<CeoPortfolio | null>(null);
  const [strategy,  setStrategy]      = useState<CeoStrategy | null>(null);
  const [model,     setModel]         = useState<{ accuracy: number; version: number; totalCycles: number } | null>(null);
  const [loading,   setLoading]       = useState(true);
  const [showLevelPanel, setShowLevelPanel] = useState(false);

  useEffect(() => {
    Promise.all([
      getAutonomyLevel().catch(() => null),
      getCostSummary().catch(() => null),
      getProfitZones().catch(() => null),
      getCfoInsights().catch(() => []),
      getCeoPortfolio().catch(() => null),
      getCeoStrategy().catch(() => null),
      getProfitModel().catch(() => null),
    ]).then(([aut, c, z, ins, port, strat, m]) => {
      if (aut)   setAutonomyState(aut);
      if (c)     setCost(c);
      if (z)     setZones(z as typeof zones);
      if (ins)   setInsights(ins as CfoInsight[]);
      if (port)  setPortfolio(port);
      if (strat) setStrategy(strat);
      if (m)     setModel(m as typeof model);
      setLoading(false);
    });
  }, []);

  async function handleSetLevel(l: number) {
    const r = await setAutonomyLevel(l as 0 | 1 | 2 | 3).catch(() => null);
    if (r) setAutonomyState(r);
    setShowLevelPanel(false);
  }

  const currentLevelMeta = LEVEL_META[autonomy?.level ?? 0];

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-main">
        <FinancialOsNav level={autonomy?.level ?? 0} onLevelClick={() => setShowLevelPanel(v => !v)} />
        <div className="page-content">

          {/* Header */}
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', margin: '0 0 4px' }}>💰 Autonomous Financial Intelligence OS</h1>
            <p style={{ fontSize: 13, color: 'var(--sub)' }}>Tracks money · predicts money · reallocates money · removes waste · learns continuously</p>
          </div>

          {/* Autonomy level panel */}
          {showLevelPanel && (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 24 }}>
              <div className="section-label" style={{ marginBottom: 12 }}>Select Autonomy Level</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
                {LEVEL_META.map(lm => (
                  <button key={lm.level} onClick={() => handleSetLevel(lm.level)}
                    style={{ padding: '12px 14px', borderRadius: 8, background: (autonomy?.level ?? 0) === lm.level ? lm.bg : 'transparent', border: `1.5px solid ${(autonomy?.level ?? 0) === lm.level ? lm.border : 'var(--border)'}`, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: lm.color, marginBottom: 4 }}>{lm.label}</div>
                    <div style={{ fontSize: 10, color: 'var(--muted)', lineHeight: 1.4 }}>{lm.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Current level banner */}
          <div style={{ background: `${currentLevelMeta.color}0d`, border: `1px solid ${currentLevelMeta.border}`, borderRadius: 10, padding: '10px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: currentLevelMeta.color }}>{currentLevelMeta.label}</span>
            <span style={{ fontSize: 12, color: 'var(--sub)' }}>{currentLevelMeta.desc}</span>
            <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--muted)', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => setShowLevelPanel(v => !v)}>Change level</span>
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
              <div className="spin" style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%' }} />
            </div>
          ) : (
            <>
              {/* KPI row */}
              <div className="intel-stats-grid" style={{ gridTemplateColumns: 'repeat(5,1fr)', marginBottom: 24 }}>
                {[
                  { label: 'Total Spend',       value: `$${(cost?.totalAllTime ?? 0).toFixed(2)}`,       color: 'var(--rose)'     },
                  { label: 'Monthly Spend',      value: `$${(cost?.totalThisMonth ?? 0).toFixed(2)}`,    color: 'var(--amber)'    },
                  { label: 'Scale Potential',    value: `$${(zones?.summary?.scalePotential ?? 0).toFixed(0)}`, color: 'var(--emerald)' },
                  { label: 'Waste Detected',     value: `$${(zones?.summary?.totalWaste ?? 0).toFixed(0)}`,    color: 'var(--rose)'     },
                  { label: 'Portfolio ROAS',     value: `${(portfolio?.portfolioROAS ?? 0).toFixed(2)}x`, color: 'var(--indigo-l)' },
                ].map(k => (
                  <div key={k.label} className="intel-stat-card">
                    <div className="intel-stat-label">{k.label}</div>
                    <div className="intel-stat-value" style={{ fontSize: 18, color: k.color }}>{k.value}</div>
                  </div>
                ))}
              </div>

              {/* Module grid */}
              <div className="section-label">Modules</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
                {MODULES.map(m => (
                  <Link key={m.href} href={m.href}
                    style={{ display: 'block', background: 'var(--surface)', border: `1px solid ${m.color}22`, borderRadius: 12, padding: '16px 18px', textDecoration: 'none', transition: 'border-color 0.15s' }}>
                    <div style={{ width: 32, height: 32, background: `${m.color}14`, border: `1px solid ${m.color}30`, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, marginBottom: 10 }}>{m.icon}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 3 }}>{m.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.4 }}>{m.desc}</div>
                  </Link>
                ))}
              </div>

              {/* Two-column: CFO Insights + CEO Strategy */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

                {/* CFO Insights */}
                <div className="intel-panel">
                  <div className="intel-panel-header">
                    <span className="section-label" style={{ margin: 0 }}>🧠 CFO Insights</span>
                    <Link href="/financial-os/cfo" style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--indigo-l)', textDecoration: 'none' }}>Full analysis →</Link>
                  </div>
                  <div style={{ padding: 12 }}>
                    {insights.slice(0, 3).map(ins => {
                      const ic = ins.impact === 'HIGH' ? 'var(--rose)' : ins.impact === 'MEDIUM' ? 'var(--amber)' : 'var(--emerald)';
                      return (
                        <div key={ins.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 3 }}>
                            <span className="badge" style={{ color: ic, background: `transparent`, border: `1px solid ${ic}44`, flexShrink: 0 }}>{ins.impact}</span>
                            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', lineHeight: 1.3 }}>{ins.title}</span>
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 40, lineHeight: 1.4 }}>{ins.body.slice(0, 90)}…</div>
                        </div>
                      );
                    })}
                    {insights.length === 0 && <div style={{ fontSize: 12, color: 'var(--muted)', padding: '8px 0' }}>No insights yet — import campaign outcomes to enable analysis.</div>}
                  </div>
                </div>

                {/* CEO Strategy */}
                <div className="intel-panel">
                  <div className="intel-panel-header">
                    <span className="section-label" style={{ margin: 0 }}>🏢 CEO Strategy</span>
                    <Link href="/financial-os/ceo" style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--indigo-l)', textDecoration: 'none' }}>Full view →</Link>
                  </div>
                  <div style={{ padding: 12 }}>
                    {strategy ? (
                      <>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>{strategy.quarterGoal}</div>
                        {strategy.riskAlert && (
                          <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6, padding: '6px 10px', marginBottom: 8, fontSize: 11, color: 'var(--rose)' }}>⚠ {strategy.riskAlert}</div>
                        )}
                        {strategy.decisions.slice(0, 2).map(d => (
                          <div key={d.id} style={{ padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{d.title}</div>
                            <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{d.urgency.replace('_', ' ')} · +{(d.expectedROI * 100).toFixed(0)}% ROI expected</div>
                          </div>
                        ))}
                      </>
                    ) : (
                      <div style={{ fontSize: 12, color: 'var(--muted)', padding: '8px 0' }}>Loading CEO analysis…</div>
                    )}
                  </div>
                </div>

              </div>

              {/* Learning model footer */}
              {model && (
                <div style={{ marginTop: 16, padding: '10px 16px', background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 8, display: 'flex', gap: 24, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: 'var(--purple)', fontWeight: 700 }}>🧬 Profit Brain</span>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>v{model.version} · {(model.accuracy * 100).toFixed(1)}% accuracy · {model.totalCycles} learning cycles</span>
                  <Link href="/financial-os/learning" style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--purple)', textDecoration: 'none' }}>View model →</Link>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
