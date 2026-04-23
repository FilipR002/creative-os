'use client';
import { useEffect, useState, useCallback } from 'react';
import { Sidebar }        from '@/components/Sidebar';
import { FinancialOsNav } from '@/components/FinancialOsNav';
import {
  getFeatureProfits,
  getProfitIntelSummary,
  getUnitEconomics,
  getProfitTrends,
  getAutonomyLevel,
  type FeatureProfitEntry,
  type ProfitIntelSummary,
  type UnitEconomicsEntry,
  type ProfitTrendPoint,
} from '@/lib/api/creator-client';

// ─── helpers ─────────────────────────────────────────────────────────────────

function usd(n: number, digits = 4) {
  return `$${Math.abs(n).toFixed(digits)}`;
}
function pct(n: number) {
  return `${(n * 100).toFixed(1)}%`;
}
function sign(n: number) {
  return n >= 0 ? '+' : '−';
}
function confBadge(c: number) {
  if (c >= 0.6) return { label: 'High',   color: '#10b981' };
  if (c >= 0.4) return { label: 'Medium', color: '#f59e0b' };
  return            { label: 'Low',    color: '#ef4444' };
}

const STATUS_META: Record<FeatureProfitEntry['status'], { color: string; bg: string; label: string }> = {
  profitable: { color: '#10b981', bg: 'rgba(16,185,129,0.10)',  label: '✓ Profitable'  },
  'break-even': { color: '#f59e0b', bg: 'rgba(245,158,11,0.10)', label: '≈ Break-even' },
  loss:       { color: '#ef4444', bg: 'rgba(239,68,68,0.10)',   label: '✗ Loss'        },
};

// ─── Trend mini-chart ─────────────────────────────────────────────────────────

function TrendBar({ points }: { points: ProfitTrendPoint[] }) {
  if (!points.length) return null;
  const maxAbs = Math.max(...points.map(p => Math.abs(p.profit)), 0.01);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 40 }}>
      {points.map((p, i) => {
        const h = Math.max((Math.abs(p.profit) / maxAbs) * 36, 2);
        return (
          <div key={i} title={`${p.date}: $${p.profit.toFixed(4)}`}
            style={{
              flex: 1, height: h, borderRadius: 2,
              background: p.profit >= 0 ? '#10b981' : '#ef4444',
              opacity: 0.7 + (i / points.length) * 0.3,
            }} />
        );
      })}
    </div>
  );
}

// ─── ROI Gauge bar ────────────────────────────────────────────────────────────

function RoiBar({ roi }: { roi: number }) {
  // clamp to –1 … +5 range for display
  const clamped  = Math.min(Math.max(roi, -1), 5);
  const zeroX    = (1 / 6) * 100;          // 0 ROI sits at 16.7%
  const width    = Math.abs(clamped) / 6 * 100;
  const left     = clamped < 0 ? zeroX - width : zeroX;
  const color    = roi >= 0 ? '#10b981' : '#ef4444';
  return (
    <div style={{ position: 'relative', height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden', width: '100%' }}>
      {/* zero marker */}
      <div style={{ position: 'absolute', left: `${zeroX}%`, top: 0, bottom: 0, width: 1, background: 'var(--sub)', opacity: 0.4 }} />
      <div style={{ position: 'absolute', left: `${left}%`, width: `${width}%`, top: 0, bottom: 0, background: color, borderRadius: 3 }} />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = 'features' | 'unit' | 'trends';

export default function UnitEconomicsPage() {
  const [tab, setTab]         = useState<Tab>('features');
  const [features, setFeatures] = useState<FeatureProfitEntry[]>([]);
  const [summary, setSummary] = useState<ProfitIntelSummary | null>(null);
  const [unit, setUnit]       = useState<UnitEconomicsEntry[]>([]);
  const [trends, setTrends]   = useState<ProfitTrendPoint[]>([]);
  const [trendRange, setTrendRange] = useState<'7d' | '30d'>('7d');
  const [level, setLevel]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState('');

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const [f, s, u, t, a] = await Promise.all([
        getFeatureProfits(),
        getProfitIntelSummary(),
        getUnitEconomics(),
        getProfitTrends(trendRange),
        getAutonomyLevel(),
      ]);
      setFeatures(Array.isArray(f) ? f : []);
      setSummary(s as ProfitIntelSummary);
      setUnit(Array.isArray(u) ? u : []);
      setTrends(Array.isArray(t) ? t : []);
      setLevel((a as any).level ?? 0);
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [trendRange]);

  useEffect(() => { load(); }, [load]);

  function handleLevelClick() { /* read-only display */ }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <FinancialOsNav level={level} onLevelClick={handleLevelClick} />

        <div style={{ padding: '32px 40px', maxWidth: 1100 }}>

          {/* Header */}
          <div style={{ marginBottom: 28 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--fg)', margin: 0 }}>
              💎 Unit Economics Intelligence
            </h1>
            <p style={{ color: 'var(--sub)', fontSize: 13, marginTop: 6 }}>
              Feature-level profitability · AI cost → attributed MRR · Real SaaS unit economics
            </p>
          </div>

          {/* Summary cards */}
          {summary && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginBottom: 28 }}>
              {[
                { label: 'Revenue Attributed', value: `$${summary.totalRevenueAttributed.toFixed(2)}`, color: '#10b981' },
                { label: 'Total AI Cost',       value: `$${summary.totalCost.toFixed(4)}`,             color: '#ef4444' },
                { label: 'Net Profit',          value: `${sign(summary.totalProfit)}$${Math.abs(summary.totalProfit).toFixed(4)}`, color: summary.totalProfit >= 0 ? '#10b981' : '#ef4444' },
                { label: 'Profit Margin',       value: pct(summary.profitMargin),                     color: 'var(--accent-l)' },
                { label: 'ROI',                 value: summary.roi === 999 ? '∞' : `${(summary.roi * 100).toFixed(0)}%`, color: '#a78bfa' },
              ].map(c => (
                <div key={c.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 18px' }}>
                  <div style={{ fontSize: 11, color: 'var(--sub)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{c.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: c.color }}>{c.value}</div>
                </div>
              ))}
            </div>
          )}

          {/* Attribution note */}
          {summary && (
            <div style={{ background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: 8, padding: '10px 16px', marginBottom: 24, fontSize: 12, color: 'var(--sub)', lineHeight: 1.6 }}>
              📌 {summary.attributionNote}
            </div>
          )}

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
            {([
              { key: 'features', label: '📊 Feature Profits' },
              { key: 'unit',     label: '🔬 Unit Economics'  },
              { key: 'trends',   label: '📈 Profit Trends'   },
            ] as { key: Tab; label: string }[]).map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                style={{
                  padding: '8px 16px', fontSize: 12, fontWeight: tab === t.key ? 700 : 500,
                  color: tab === t.key ? 'var(--accent-l)' : 'var(--sub)',
                  background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                  borderBottom: tab === t.key ? '2px solid var(--accent)' : '2px solid transparent',
                  marginBottom: -1,
                }}>
                {t.label}
              </button>
            ))}
          </div>

          {loading && <div style={{ color: 'var(--sub)', fontSize: 13 }}>Loading…</div>}
          {err     && <div style={{ color: '#ef4444', fontSize: 13 }}>{err}</div>}

          {/* ── FEATURE PROFITS TAB ── */}
          {!loading && tab === 'features' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {features.map(f => {
                const sm  = STATUS_META[f.status];
                const cb  = confBadge(f.attributionConfidence);
                return (
                  <div key={f.feature} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '18px 22px' }}>
                    {/* Row 1: icon + label + status badge */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                      <span style={{ fontSize: 20 }}>{f.icon}</span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg)' }}>{f.label}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 20, background: sm.bg, color: sm.color, marginLeft: 4 }}>
                        {sm.label}
                      </span>
                      <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: `${cb.color}15`, color: cb.color, border: `1px solid ${cb.color}30` }}>
                        {cb.label} conf ({pct(f.attributionConfidence)})
                      </span>
                    </div>
                    {/* Row 2: metrics */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10, marginBottom: 10 }}>
                      {[
                        { label: 'AI Cost',   value: `$${f.cost.toFixed(4)}`,              color: '#ef4444' },
                        { label: 'Revenue',   value: `$${f.revenueAttributed.toFixed(2)}`,  color: '#10b981' },
                        { label: 'Profit',    value: `${sign(f.profit)}${usd(f.profit)}`,   color: f.profit >= 0 ? '#10b981' : '#ef4444' },
                        { label: 'Margin',    value: pct(f.profitMargin),                   color: 'var(--accent-l)' },
                        { label: 'Usage',     value: f.usageCount.toLocaleString(),          color: 'var(--fg)' },
                        { label: 'ROI',       value: f.roi === 999 ? '∞' : `${(f.roi * 100).toFixed(0)}%`, color: '#a78bfa' },
                      ].map(m => (
                        <div key={m.label}>
                          <div style={{ fontSize: 10, color: 'var(--sub)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{m.label}</div>
                          <div style={{ fontSize: 15, fontWeight: 700, color: m.color }}>{m.value}</div>
                        </div>
                      ))}
                    </div>
                    {/* ROI bar */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 10, color: 'var(--sub)', width: 28 }}>ROI</span>
                      <div style={{ flex: 1 }}><RoiBar roi={f.roi} /></div>
                      <span style={{ fontSize: 10, color: 'var(--sub)', width: 36, textAlign: 'right' }}>
                        {f.roi === 999 ? '∞' : `${(f.roi * 100).toFixed(0)}%`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── UNIT ECONOMICS TAB ── */}
          {!loading && tab === 'unit' && (
            <div>
              <p style={{ fontSize: 12, color: 'var(--sub)', marginBottom: 16 }}>
                Per-use economics across all-time usage. Cost and revenue per single operation.
              </p>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      {['Feature', 'Uses', 'Avg Cost/Use', 'Avg Rev/Use', 'Profit/Use', 'Gross Margin'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600, color: 'var(--sub)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {unit.map(u => {
                      const margin = u.avgRevenuePerUse > 0
                        ? ((u.avgRevenuePerUse - u.avgCostPerUse) / u.avgRevenuePerUse)
                        : 0;
                      return (
                        <tr key={u.feature} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '12px 12px' }}>
                            <span style={{ marginRight: 8 }}>{u.icon}</span>
                            <span style={{ fontWeight: 600, color: 'var(--fg)' }}>{u.label}</span>
                          </td>
                          <td style={{ padding: '12px 12px', color: 'var(--fg)', fontWeight: 700 }}>
                            {u.usageCount > 0 ? u.usageCount.toLocaleString() : <span style={{ color: 'var(--sub)' }}>—</span>}
                          </td>
                          <td style={{ padding: '12px 12px', color: '#ef4444', fontWeight: 600 }}>
                            {u.usageCount > 0 ? `$${u.avgCostPerUse.toFixed(6)}` : <span style={{ color: 'var(--sub)' }}>—</span>}
                          </td>
                          <td style={{ padding: '12px 12px', color: '#10b981', fontWeight: 600 }}>
                            {u.usageCount > 0 ? `$${u.avgRevenuePerUse.toFixed(6)}` : <span style={{ color: 'var(--sub)' }}>—</span>}
                          </td>
                          <td style={{ padding: '12px 12px', fontWeight: 700, color: u.profitPerUse >= 0 ? '#10b981' : '#ef4444' }}>
                            {u.usageCount > 0 ? `${sign(u.profitPerUse)}$${Math.abs(u.profitPerUse).toFixed(6)}` : <span style={{ color: 'var(--sub)' }}>—</span>}
                          </td>
                          <td style={{ padding: '12px 12px' }}>
                            {u.usageCount > 0 ? (
                              <span style={{ color: margin >= 0 ? '#10b981' : '#ef4444', fontWeight: 700 }}>
                                {pct(margin)}
                              </span>
                            ) : <span style={{ color: 'var(--sub)' }}>—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── TRENDS TAB ── */}
          {!loading && tab === 'trends' && (
            <div>
              {/* range toggle */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
                {(['7d', '30d'] as const).map(r => (
                  <button key={r} onClick={() => setTrendRange(r)}
                    style={{
                      padding: '5px 14px', fontSize: 12, fontWeight: 600, borderRadius: 6,
                      background: trendRange === r ? 'var(--accent)' : 'var(--surface)',
                      color: trendRange === r ? '#fff' : 'var(--sub)',
                      border: `1px solid ${trendRange === r ? 'var(--accent)' : 'var(--border)'}`,
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}>
                    {r}
                  </button>
                ))}
                <button onClick={load} style={{ padding: '5px 14px', fontSize: 12, fontWeight: 600, borderRadius: 6, background: 'var(--surface)', color: 'var(--sub)', border: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit', marginLeft: 'auto' }}>
                  ↺ Refresh
                </button>
              </div>

              {/* Chart area */}
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 24px', marginBottom: 20 }}>
                <div style={{ fontSize: 12, color: 'var(--sub)', marginBottom: 12 }}>Daily Profit ({trendRange})</div>
                <TrendBar points={trends} />
              </div>

              {/* Table */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      {['Date', 'Revenue', 'AI Cost', 'Profit'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600, color: 'var(--sub)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...trends].reverse().map(p => (
                      <tr key={p.date} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '10px 12px', color: 'var(--fg)', fontWeight: 600 }}>{p.date}</td>
                        <td style={{ padding: '10px 12px', color: '#10b981' }}>${p.totalRevenue.toFixed(4)}</td>
                        <td style={{ padding: '10px 12px', color: '#ef4444' }}>${p.totalCost.toFixed(4)}</td>
                        <td style={{ padding: '10px 12px', fontWeight: 700, color: p.profit >= 0 ? '#10b981' : '#ef4444' }}>
                          {sign(p.profit)}${Math.abs(p.profit).toFixed(4)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
