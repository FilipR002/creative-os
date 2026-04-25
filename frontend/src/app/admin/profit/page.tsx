'use client';

import { useEffect, useState, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Dashboard {
  period:           string;
  totalCostUsd:     number;
  totalRevenueUsd:  number;
  profitUsd:        number;
  marginPct:        number;
  apiCallCount:     number;
  revenueEventCount: number;
  costBreakdown: {
    byProvider:  Record<string, number>;
    byOperation: Record<string, number>;
    failureCount: number;
    successRate:  number;
  };
  revenueBreakdown: {
    byType: Record<string, number>;
  };
  snapshots: Array<{
    date: string;
    totalCostUsd:    number;
    totalRevenueUsd: number;
    profitUsd:       number;
    marginPct:       number;
    apiCallCount:    number;
  }>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function usd(val: number): string {
  return `$${val.toFixed(2)}`;
}

function pct(val: number): string {
  return `${val.toFixed(1)}%`;
}

const API = process.env.NEXT_PUBLIC_API_URL ?? '';

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { credentials: 'include' });
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return res.json();
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, color, icon,
}: {
  label: string; value: string; sub?: string; color?: string; icon: string;
}) {
  return (
    <div style={{
      background:   '#0d0f16',
      border:       `1px solid ${color ?? '#1e2330'}`,
      borderRadius: 14,
      padding:      '20px 22px',
      display:      'flex',
      flexDirection: 'column',
      gap:          6,
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
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#556', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {entries.map(([key, val]) => (
          <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#0d0f16', border: '1px solid #1a1c24', borderRadius: 8 }}>
            <span style={{ fontSize: 12, color: '#aaa', fontWeight: 500 }}>{key}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#f0f0f0' }}>{usd(val)}</span>
          </div>
        ))}
      </div>
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
  const [data,      setData]      = useState<Dashboard | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [days,      setDays]      = useState(30);
  const [snapping,  setSnapping]  = useState(false);
  const [snapMsg,   setSnapMsg]   = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await fetchJson<Dashboard>(`/api/admin/profit/dashboard?days=${days}`);
      setData(d);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { load(); }, [load]);

  const takeSnapshot = async () => {
    setSnapping(true);
    setSnapMsg('');
    try {
      await fetch(`${API}/api/admin/profit/snapshot`, { method: 'POST', credentials: 'include' });
      setSnapMsg('✓ Snapshot saved');
      await load();
    } catch {
      setSnapMsg('✗ Failed');
    } finally {
      setSnapping(false);
    }
  };

  const profitColor = data && data.profitUsd >= 0 ? '#4ade80' : '#f87171';

  return (
    <div style={{ maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#f0f0f0', margin: 0 }}>💰 Profit Dashboard</h1>
          <p style={{ fontSize: 13, color: '#556', margin: '4px 0 0' }}>API costs · Stripe revenue · P&L — admin only</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {/* Period selector */}
          {[7, 30, 90].map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              style={{
                padding:      '7px 14px',
                background:   days === d ? 'rgba(99,102,241,0.15)' : '#0d0f16',
                border:       `1px solid ${days === d ? '#6366f1' : '#1e2330'}`,
                borderRadius: 8,
                color:        days === d ? '#a5b4fc' : '#556',
                fontSize:     12,
                fontWeight:   600,
                cursor:       'pointer',
              }}
            >
              {d}d
            </button>
          ))}
          <button
            onClick={load}
            disabled={loading}
            style={{ padding: '7px 14px', background: '#0d0f16', border: '1px solid #1e2330', borderRadius: 8, color: '#556', fontSize: 12, cursor: 'pointer' }}
          >
            {loading ? '↻' : '↻ Refresh'}
          </button>
          <button
            onClick={takeSnapshot}
            disabled={snapping}
            style={{ padding: '7px 16px', background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 8, color: '#a5b4fc', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
          >
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
        <div style={{ color: '#556', fontSize: 13, padding: '40px 0', textAlign: 'center' }}>Loading profit data…</div>
      )}

      {data && (
        <>
          {/* KPI row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
            <KpiCard icon="💸" label="Total Cost"    value={usd(data.totalCostUsd)}    sub={`${data.apiCallCount} API calls`}          color="#1e2330" />
            <KpiCard icon="💰" label="Total Revenue" value={usd(data.totalRevenueUsd)} sub={`${data.revenueEventCount} Stripe events`}  color="rgba(74,222,128,0.15)" />
            <KpiCard icon="📈" label="Profit"        value={usd(data.profitUsd)}        sub={`Margin: ${pct(data.marginPct)}`}           color={`rgba(${data.profitUsd >= 0 ? '74,222,128' : '248,113,113'},0.2)`} />
            <KpiCard icon="🎯" label="API Success"   value={pct(data.costBreakdown.successRate)} sub={`${data.costBreakdown.failureCount} failures`} color="#1e2330" />
          </div>

          {/* P&L bar */}
          {data.totalRevenueUsd > 0 && (
            <div style={{ marginBottom: 24, background: '#0d0f16', border: '1px solid #1e2330', borderRadius: 12, padding: '18px 22px' }}>
              <div style={{ fontSize: 11, color: '#556', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>P&L Bar</div>
              <div style={{ height: 10, background: '#12141a', borderRadius: 5, overflow: 'hidden', position: 'relative' }}>
                <div style={{
                  position:    'absolute', left: 0, top: 0, bottom: 0,
                  width:       `${Math.min(100, (data.totalCostUsd / data.totalRevenueUsd) * 100)}%`,
                  background:  '#f87171',
                  borderRadius: 5,
                }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                <span style={{ fontSize: 11, color: '#f87171' }}>Cost {pct(data.totalRevenueUsd > 0 ? (data.totalCostUsd / data.totalRevenueUsd) * 100 : 100)}</span>
                <span style={{ fontSize: 11, color: profitColor }}>Profit {pct(data.marginPct)}</span>
              </div>
            </div>
          )}

          {/* Breakdown row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
            <div style={{ background: '#0d0f16', border: '1px solid #1e2330', borderRadius: 12, padding: '18px 22px' }}>
              <BreakdownTable title="Cost by Provider" data={data.costBreakdown.byProvider} />
              {Object.keys(data.costBreakdown.byProvider).length === 0 && (
                <p style={{ fontSize: 13, color: '#556', margin: 0 }}>No API calls logged yet. Video generation will log costs automatically.</p>
              )}
            </div>
            <div style={{ background: '#0d0f16', border: '1px solid #1e2330', borderRadius: 12, padding: '18px 22px' }}>
              <BreakdownTable title="Revenue by Event Type" data={data.revenueBreakdown.byType} />
              {Object.keys(data.revenueBreakdown.byType).length === 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#556', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Revenue by Event Type</div>
                  <p style={{ fontSize: 13, color: '#556', margin: 0 }}>No Stripe revenue logged yet. Configure <code style={{ fontSize: 11, background: '#12141a', padding: '2px 5px', borderRadius: 4, color: '#aaa' }}>STRIPE_SECRET_KEY</code> + <code style={{ fontSize: 11, background: '#12141a', padding: '2px 5px', borderRadius: 4, color: '#aaa' }}>STRIPE_WEBHOOK_SECRET</code> to activate.</p>
                </div>
              )}
            </div>
          </div>

          {/* Cost by operation */}
          {Object.keys(data.costBreakdown.byOperation).length > 0 && (
            <div style={{ background: '#0d0f16', border: '1px solid #1e2330', borderRadius: 12, padding: '18px 22px', marginBottom: 24 }}>
              <BreakdownTable title="Cost by Operation" data={data.costBreakdown.byOperation} />
            </div>
          )}

          {/* Daily snapshots */}
          <div style={{ background: '#0d0f16', border: '1px solid #1e2330', borderRadius: 12, padding: '18px 22px', marginBottom: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#556', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>Daily Profit Snapshots</div>
            <SnapshotTable rows={data.snapshots} />
          </div>

          {/* Setup instructions when Stripe not configured */}
          {data.totalRevenueUsd === 0 && data.revenueEventCount === 0 && (
            <div style={{ background: '#0d0f16', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 12, padding: '20px 24px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#a5b4fc', marginBottom: 12 }}>🔌 Stripe Setup</div>
              <ol style={{ fontSize: 13, color: '#778', lineHeight: 1.8, margin: 0, paddingLeft: 20 }}>
                <li>Get your Stripe secret key from <strong style={{ color: '#aaa' }}>dashboard.stripe.com/apikeys</strong></li>
                <li>Add <code style={{ fontSize: 11, background: '#12141a', padding: '2px 5px', borderRadius: 4, color: '#aaa' }}>STRIPE_SECRET_KEY=sk_live_...</code> to your <code style={{ fontSize: 11, background: '#12141a', padding: '2px 5px', borderRadius: 4, color: '#aaa' }}>.env</code></li>
                <li>Set up a webhook endpoint pointing to <code style={{ fontSize: 11, background: '#12141a', padding: '2px 5px', borderRadius: 4, color: '#aaa' }}>POST /api/billing/stripe-webhook</code></li>
                <li>Add <code style={{ fontSize: 11, background: '#12141a', padding: '2px 5px', borderRadius: 4, color: '#aaa' }}>STRIPE_WEBHOOK_SECRET=whsec_...</code> to your <code style={{ fontSize: 11, background: '#12141a', padding: '2px 5px', borderRadius: 4, color: '#aaa' }}>.env</code></li>
                <li>Restart the backend — Stripe revenue will appear here automatically</li>
              </ol>
            </div>
          )}
        </>
      )}
    </div>
  );
}
