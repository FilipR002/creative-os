'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Dashboard {
  period:            string;
  totalCostUsd:      number;
  totalRevenueUsd:   number;
  profitUsd:         number;
  marginPct:         number;
  apiCallCount:      number;
  revenueEventCount: number;
  costBreakdown: {
    byProvider:   Record<string, number>;
    byOperation:  Record<string, number>;
    failureCount: number;
    successRate:  number;
  };
  revenueBreakdown: {
    byType: Record<string, number>;
  };
  snapshots: Array<{
    date:            string;
    totalCostUsd:    number;
    totalRevenueUsd: number;
    profitUsd:       number;
    marginPct:       number;
    apiCallCount:    number;
  }>;
}

interface ApiLog {
  id:           string;
  provider:     string;
  operation:    string;
  userId:       string | null;
  costUsd:      number;
  latencyMs:    number | null;
  statusCode:   number | null;
  success:      boolean;
  errorMessage: string | null;
  createdAt:    string;
}

interface TrendPoint {
  date: string;
  cost: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function usd(val: number): string { return `$${val.toFixed(2)}`; }
function pct(val: number): string { return `${val.toFixed(1)}%`; }
function ms(val: number | null): string { return val != null ? `${val}ms` : '—'; }

const PROVIDER_COLOR: Record<string, string> = {
  claude: '#a78bfa',
  kling:  '#f97316',
  veo:    '#22d3ee',
  gemini: '#4ade80',
};

const API = process.env.NEXT_PUBLIC_API_URL ?? '';

async function getAuthHeaders(): Promise<Record<string, string>> {
  try {
    const { getSupabase } = await import('@/lib/supabase');
    const { data: { session } } = await getSupabase().auth.getSession();
    if (session?.access_token) {
      return { 'Authorization': `Bearer ${session.access_token}` };
    }
  } catch { /* fall through */ }
  return {};
}

async function fetchJson<T>(path: string): Promise<T> {
  const authHeaders = await getAuthHeaders();
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json', ...authHeaders },
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return res.json();
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, color, icon }: {
  label: string; value: string; sub?: string; color?: string; icon: string;
}) {
  return (
    <div style={{
      background: '#0d0f16', border: `1px solid ${color ?? '#1e2330'}`,
      borderRadius: 14, padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <span style={{ fontSize: 11, color: '#556', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, color: color ?? '#f0f0f0', letterSpacing: '-0.03em' }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: '#556' }}>{sub}</div>}
    </div>
  );
}

function BreakdownTable({ title, data }: { title: string; data: Record<string, number> }) {
  const entries = Object.entries(data).sort(([, a], [, b]) => b - a);
  if (entries.length === 0) return null;
  const max = entries[0][1];
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#556', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {entries.map(([key, val]) => {
          const prov = PROVIDER_COLOR[key];
          return (
            <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '8px 12px', background: '#0d0f16', border: '1px solid #1a1c24', borderRadius: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: prov ?? '#aaa', fontWeight: 600 }}>{key}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#f0f0f0' }}>{usd(val)}</span>
              </div>
              <div style={{ height: 3, background: '#12141a', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ width: `${(val / max) * 100}%`, height: '100%', background: prov ?? '#6366f1', borderRadius: 2 }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TrendChart({ points }: { points: TrendPoint[] }) {
  if (points.length === 0) return (
    <div style={{ fontSize: 12, color: '#556', padding: '20px 0', textAlign: 'center' }}>No trend data yet — API calls will populate this chart.</div>
  );
  const max = Math.max(...points.map(p => p.cost), 0.001);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {[...points].reverse().map(p => (
        <div key={p.date} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 10, color: '#556', width: 80, flexShrink: 0, textAlign: 'right' }}>{p.date.slice(5)}</span>
          <div style={{ flex: 1, height: 16, background: '#12141a', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
              width: `${Math.max(2, (p.cost / max) * 100)}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #6366f1, #a78bfa)',
              borderRadius: 3,
              transition: 'width 0.4s ease',
            }} />
          </div>
          <span style={{ fontSize: 10, color: '#aaa', width: 52, textAlign: 'right', flexShrink: 0 }}>{usd(p.cost)}</span>
        </div>
      ))}
    </div>
  );
}

function LiveLogTable({ logs }: { logs: ApiLog[] }) {
  if (logs.length === 0) return (
    <div style={{ fontSize: 12, color: '#556', padding: '20px 0', textAlign: 'center' }}>No API calls logged yet. Generate an ad to see live data.</div>
  );
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #1e2330' }}>
            {['Time', 'Provider', 'Operation', 'Cost', 'Latency', 'Status'].map(h => (
              <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: '#556', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {logs.map(log => {
            const provColor = PROVIDER_COLOR[log.provider] ?? '#aaa';
            const time = new Date(log.createdAt);
            return (
              <tr key={log.id} style={{ borderBottom: '1px solid #12141a' }}>
                <td style={{ padding: '7px 10px', color: '#445', whiteSpace: 'nowrap' }}>
                  {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </td>
                <td style={{ padding: '7px 10px' }}>
                  <span style={{ background: `${provColor}18`, color: provColor, border: `1px solid ${provColor}33`, borderRadius: 4, padding: '2px 7px', fontSize: 10, fontWeight: 700 }}>
                    {log.provider}
                  </span>
                </td>
                <td style={{ padding: '7px 10px', color: '#778', fontFamily: 'monospace' }}>{log.operation}</td>
                <td style={{ padding: '7px 10px', color: log.success ? '#f0f0f0' : '#445', fontWeight: log.success ? 600 : 400 }}>
                  {log.success ? usd(log.costUsd) : '—'}
                </td>
                <td style={{ padding: '7px 10px', color: '#556' }}>{ms(log.latencyMs)}</td>
                <td style={{ padding: '7px 10px' }}>
                  {log.success
                    ? <span style={{ color: '#4ade80', fontWeight: 700, fontSize: 10 }}>✓ OK</span>
                    : <span style={{ color: '#f87171', fontWeight: 700, fontSize: 10 }} title={log.errorMessage ?? ''}>✗ FAIL</span>
                  }
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SnapshotTable({ rows }: { rows: Dashboard['snapshots'] }) {
  if (rows.length === 0) return <div style={{ fontSize: 13, color: '#556', padding: '16px 0' }}>No daily snapshots yet. Click "Save Snapshot" to capture today.</div>;
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #1e2330' }}>
            {['Date', 'Cost', 'Revenue', 'Profit', 'Margin', 'API Calls'].map(h => (
              <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: '#556', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.date} style={{ borderBottom: '1px solid #12141a' }}>
              <td style={{ padding: '10px 12px', color: '#aaa' }}>{r.date}</td>
              <td style={{ padding: '10px 12px', color: '#f87171' }}>{usd(r.totalCostUsd)}</td>
              <td style={{ padding: '10px 12px', color: '#4ade80' }}>{usd(r.totalRevenueUsd)}</td>
              <td style={{ padding: '10px 12px', color: r.profitUsd >= 0 ? '#4ade80' : '#f87171', fontWeight: 700 }}>{usd(r.profitUsd)}</td>
              <td style={{ padding: '10px 12px', color: r.marginPct >= 0 ? '#4ade80' : '#f87171' }}>{pct(r.marginPct)}</td>
              <td style={{ padding: '10px 12px', color: '#aaa' }}>{r.apiCallCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminProfitPage() {
  const [data,         setData]         = useState<Dashboard | null>(null);
  const [logs,         setLogs]         = useState<ApiLog[]>([]);
  const [trend,        setTrend]        = useState<TrendPoint[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [logsLoading,  setLogsLoading]  = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [days,         setDays]         = useState(30);
  const [snapping,     setSnapping]     = useState(false);
  const [snapMsg,      setSnapMsg]      = useState('');
  const [autoRefresh,  setAutoRefresh]  = useState(false);
  const [lastRefresh,  setLastRefresh]  = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [d, l, t] = await Promise.all([
        fetchJson<Dashboard>(`/api/admin/profit/dashboard?days=${days}`),
        fetchJson<ApiLog[]>('/api/admin/profit/api-logs?limit=100').catch(() => [] as ApiLog[]),
        fetchJson<TrendPoint[]>('/api/admin/profit/api-trend?days=14').catch(() => [] as TrendPoint[]),
      ]);
      setData(d);
      setLogs(Array.isArray(l) ? l : []);
      setTrend(Array.isArray(t) ? t : []);
      setLastRefresh(new Date());
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
      setLogsLoading(false);
    }
  }, [days]);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 30s
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (autoRefresh) {
      timerRef.current = setInterval(() => { load(); }, 30_000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [autoRefresh, load]);

  const takeSnapshot = async () => {
    setSnapping(true);
    setSnapMsg('');
    try {
      const authHeaders = await getAuthHeaders();
      await fetch(`${API}/api/admin/profit/snapshot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        credentials: 'include',
      });
      setSnapMsg('✓ Snapshot saved');
      await load();
    } catch {
      setSnapMsg('✗ Failed');
    } finally {
      setSnapping(false);
    }
  };

  const profitColor = data && data.profitUsd >= 0 ? '#4ade80' : '#f87171';

  // Live pulse indicator
  const claudeCalls = logs.filter(l => l.provider === 'claude').length;
  const claudeCost  = logs.filter(l => l.provider === 'claude').reduce((s, l) => s + l.costUsd, 0);

  return (
    <div style={{ maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#f0f0f0', margin: 0 }}>💰 Live API Cost Dashboard</h1>
          <p style={{ fontSize: 13, color: '#556', margin: '4px 0 0' }}>
            API costs · Stripe revenue · P&L · Live call log — admin only
            {lastRefresh && <span style={{ marginLeft: 12 }}>Last refreshed {lastRefresh.toLocaleTimeString()}</span>}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {/* Period selector */}
          {[7, 30, 90].map(d => (
            <button key={d} onClick={() => setDays(d)} style={{
              padding: '7px 14px',
              background: days === d ? 'rgba(99,102,241,0.15)' : '#0d0f16',
              border: `1px solid ${days === d ? '#6366f1' : '#1e2330'}`,
              borderRadius: 8, color: days === d ? '#a5b4fc' : '#556',
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}>{d}d</button>
          ))}
          {/* Auto-refresh toggle */}
          <button onClick={() => setAutoRefresh(v => !v)} style={{
            padding: '7px 14px',
            background: autoRefresh ? 'rgba(74,222,128,0.1)' : '#0d0f16',
            border: `1px solid ${autoRefresh ? 'rgba(74,222,128,0.3)' : '#1e2330'}`,
            borderRadius: 8, color: autoRefresh ? '#4ade80' : '#556',
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>
            {autoRefresh ? '● Live' : '○ Auto-refresh'}
          </button>
          <button onClick={load} disabled={loading} style={{
            padding: '7px 14px', background: '#0d0f16', border: '1px solid #1e2330',
            borderRadius: 8, color: '#556', fontSize: 12, cursor: 'pointer',
          }}>
            {loading ? '↻' : '↻ Refresh'}
          </button>
          <button onClick={takeSnapshot} disabled={snapping} style={{
            padding: '7px 16px', background: 'rgba(99,102,241,0.12)',
            border: '1px solid rgba(99,102,241,0.3)', borderRadius: 8,
            color: '#a5b4fc', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>
            {snapping ? 'Saving…' : 'Save Snapshot'}
          </button>
          {snapMsg && <span style={{ fontSize: 12, color: snapMsg.startsWith('✓') ? '#4ade80' : '#f87171' }}>{snapMsg}</span>}
        </div>
      </div>

      {error && (
        <div style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 10, padding: '14px 18px', color: '#f87171', fontSize: 13, marginBottom: 20 }}>
          ⚠ {error} — ensure you are logged in as admin and the backend is running.
        </div>
      )}

      {loading && !data && (
        <div style={{ color: '#556', fontSize: 13, padding: '40px 0', textAlign: 'center' }}>Loading cost data…</div>
      )}

      {data && (
        <>
          {/* ── KPI row ──────────────────────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
            <KpiCard icon="💸" label="Total Cost"    value={usd(data.totalCostUsd)}    sub={`${data.apiCallCount} API calls`}          color="#1e2330" />
            <KpiCard icon="💰" label="Total Revenue" value={usd(data.totalRevenueUsd)} sub={`${data.revenueEventCount} Stripe events`}  color="rgba(74,222,128,0.15)" />
            <KpiCard icon="📈" label="Profit"        value={usd(data.profitUsd)}        sub={`Margin: ${pct(data.marginPct)}`}           color={`rgba(${data.profitUsd >= 0 ? '74,222,128' : '248,113,113'},0.2)`} />
            <KpiCard icon="🎯" label="API Success"   value={pct(data.costBreakdown.successRate)} sub={`${data.costBreakdown.failureCount} failures`} color="#1e2330" />
          </div>

          {/* ── Claude highlight bar ─────────────────────────────────────── */}
          {claudeCalls > 0 && (
            <div style={{ background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: 12, padding: '14px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 24 }}>
              <span style={{ fontSize: 14 }}>🤖</span>
              <div>
                <div style={{ fontSize: 11, color: '#a78bfa', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Claude (Anthropic) — Now Tracked</div>
                <div style={{ fontSize: 12, color: '#778', marginTop: 2 }}>
                  {claudeCalls} calls in last 100 logs · estimated cost {usd(claudeCost)}
                </div>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 20 }}>
                {(['ad_copy', 'hooks', 'video_script', 'image_prompts', 'refine'] as const).map(op => {
                  const count = logs.filter(l => l.provider === 'claude' && l.operation === op).length;
                  if (!count) return null;
                  return (
                    <div key={op} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: '#a78bfa' }}>{count}</div>
                      <div style={{ fontSize: 9, color: '#556', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{op.replace('_', ' ')}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── P&L bar ──────────────────────────────────────────────────── */}
          {data.totalRevenueUsd > 0 && (
            <div style={{ marginBottom: 24, background: '#0d0f16', border: '1px solid #1e2330', borderRadius: 12, padding: '18px 22px' }}>
              <div style={{ fontSize: 11, color: '#556', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>P&L Bar</div>
              <div style={{ height: 10, background: '#12141a', borderRadius: 5, overflow: 'hidden', position: 'relative' }}>
                <div style={{
                  position: 'absolute', left: 0, top: 0, bottom: 0,
                  width: `${Math.min(100, (data.totalCostUsd / data.totalRevenueUsd) * 100)}%`,
                  background: '#f87171', borderRadius: 5,
                }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                <span style={{ fontSize: 11, color: '#f87171' }}>Cost {pct(data.totalRevenueUsd > 0 ? (data.totalCostUsd / data.totalRevenueUsd) * 100 : 100)}</span>
                <span style={{ fontSize: 11, color: profitColor }}>Profit {pct(data.marginPct)}</span>
              </div>
            </div>
          )}

          {/* ── Cost & Revenue breakdown ─────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div style={{ background: '#0d0f16', border: '1px solid #1e2330', borderRadius: 12, padding: '18px 22px' }}>
              <BreakdownTable title="Cost by Provider" data={data.costBreakdown.byProvider} />
              {Object.keys(data.costBreakdown.byProvider).length === 0 && (
                <p style={{ fontSize: 13, color: '#556', margin: 0 }}>No API calls logged yet. Video generation or ad generation will populate this.</p>
              )}
            </div>
            <div style={{ background: '#0d0f16', border: '1px solid #1e2330', borderRadius: 12, padding: '18px 22px' }}>
              <BreakdownTable title="Revenue by Event Type" data={data.revenueBreakdown.byType} />
              {Object.keys(data.revenueBreakdown.byType).length === 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#556', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Revenue by Event Type</div>
                  <p style={{ fontSize: 13, color: '#556', margin: 0 }}>No Stripe revenue logged yet. Configure <code style={{ fontSize: 11, background: '#12141a', padding: '2px 5px', borderRadius: 4, color: '#aaa' }}>STRIPE_SECRET_KEY</code> to activate.</p>
                </div>
              )}
            </div>
          </div>

          {/* ── Cost by operation ────────────────────────────────────────── */}
          {Object.keys(data.costBreakdown.byOperation).length > 0 && (
            <div style={{ background: '#0d0f16', border: '1px solid #1e2330', borderRadius: 12, padding: '18px 22px', marginBottom: 20 }}>
              <BreakdownTable title="Cost by Operation" data={data.costBreakdown.byOperation} />
            </div>
          )}

          {/* ── 14-day API cost trend ────────────────────────────────────── */}
          <div style={{ background: '#0d0f16', border: '1px solid #1e2330', borderRadius: 12, padding: '18px 22px', marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#556', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>14-Day API Cost Trend</div>
            <TrendChart points={trend} />
          </div>

          {/* ── Live API call log ────────────────────────────────────────── */}
          <div style={{ background: '#0d0f16', border: '1px solid #1e2330', borderRadius: 12, padding: '18px 22px', marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#556', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Live API Call Log
                {logsLoading && <span style={{ marginLeft: 8, color: '#a78bfa' }}>↻</span>}
              </div>
              <span style={{ fontSize: 11, color: '#445' }}>Last 100 calls</span>
            </div>
            <LiveLogTable logs={logs} />
          </div>

          {/* ── Daily snapshots ──────────────────────────────────────────── */}
          <div style={{ background: '#0d0f16', border: '1px solid #1e2330', borderRadius: 12, padding: '18px 22px', marginBottom: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#556', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>Daily Profit Snapshots</div>
            <SnapshotTable rows={Array.isArray(data.snapshots) ? data.snapshots : []} />
          </div>

          {/* ── Stripe setup guide (only when empty) ────────────────────── */}
          {data.totalRevenueUsd === 0 && data.revenueEventCount === 0 && (
            <div style={{ background: '#0d0f16', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 12, padding: '20px 24px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#a5b4fc', marginBottom: 12 }}>🔌 Stripe Setup</div>
              <ol style={{ fontSize: 13, color: '#778', lineHeight: 1.8, margin: 0, paddingLeft: 20 }}>
                <li>Get your Stripe secret key from <strong style={{ color: '#aaa' }}>dashboard.stripe.com/apikeys</strong></li>
                <li>Add <code style={{ fontSize: 11, background: '#12141a', padding: '2px 5px', borderRadius: 4, color: '#aaa' }}>STRIPE_SECRET_KEY=sk_live_...</code> to your <code style={{ fontSize: 11, background: '#12141a', padding: '2px 5px', borderRadius: 4, color: '#aaa' }}>.env</code></li>
                <li>Set up a webhook pointing to <code style={{ fontSize: 11, background: '#12141a', padding: '2px 5px', borderRadius: 4, color: '#aaa' }}>POST /api/billing/stripe-webhook</code></li>
                <li>Add <code style={{ fontSize: 11, background: '#12141a', padding: '2px 5px', borderRadius: 4, color: '#aaa' }}>STRIPE_WEBHOOK_SECRET=whsec_...</code> and restart</li>
              </ol>
            </div>
          )}
        </>
      )}
    </div>
  );
}
