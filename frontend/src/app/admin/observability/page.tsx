'use client';
// ─── Admin Observability Hub ──────────────────────────────────────────────────
// 10-tab dashboard connecting every backend intelligence system.
// Tabs: Autonomous Loop | Orchestrator | Memory Engine | Global Memory |
//       Reality Engine  | Angle Insights | Admin Analytics | Product API |
//       System Health   | Autonomous Mode

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  // Autonomous loop
  getAutonomousLoopState, getAllAutonomousLoopStates,
  // Orchestrator
  getOrchestratorRules,
  // Memory
  getMemoryBestAngles, getMemoryFormatStats, getMemoryWinRates, getMemoryWeights,
  // Global Memory
  getGlobalMemory,
  type MemoryAngle, type MemoryFormatStat, type MemoryWinRate,
  // Reality
  getRealityAggregate, getRealityEvents,
  // Angle Insights
  getAngleInsightsSummary,
  // Admin Analytics
  getAdminOverview, getAdminLearningState, getAdminRealtimeFeed, getAdminSystemHealth,
  // Observability
  getCampaignTraces,
  // Types
  type AutonomousLoopState,
  type OrchestratorRule,
  type MemoryWeights,
  type AngleInsightSummary,
  type AdminOverview,
  type AdminLearningState,
  type AdminRealtimeFeedEntry,
  type AdminSystemHealth,
} from '@/lib/api/creator-client';

// ─── Tab definitions ──────────────────────────────────────────────────────────

const TABS = [
  { id: 'autonomous-loop',  label: '🔄 Autonomous Loop'  },
  { id: 'orchestrator',     label: '🧭 Orchestrator'      },
  { id: 'memory-engine',    label: '🧠 Memory Engine'     },
  { id: 'global-memory',    label: '🌐 Global Memory'     },
  { id: 'reality-engine',   label: '🌍 Reality Engine'    },
  { id: 'angle-insights',   label: '💡 Angle Insights'    },
  { id: 'admin-analytics',  label: '📊 Admin Analytics'   },
  { id: 'product-surface',  label: '📦 Product Surface'   },
  { id: 'system-health',    label: '❤️ System Health'     },
  { id: 'autonomous-mode',  label: '🤖 Autonomous Mode'   },
] as const;

type TabId = typeof TABS[number]['id'];

// ─── Shared components ────────────────────────────────────────────────────────

function KV({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid #0f1014' }}>
      <span style={{ fontSize: 12, color: '#555' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: color ?? '#c0c0c0' }}>{value}</span>
    </div>
  );
}

function Card({ title, children, accent = '#6366f1' }: { title: string; children: React.ReactNode; accent?: string }) {
  return (
    <div style={{ background: '#0d0e14', border: '1px solid #1e2330', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: '10px 16px', borderBottom: '1px solid #111318', background: `linear-gradient(90deg,${accent}0a,transparent)` }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#f0f0f0' }}>{title}</span>
      </div>
      <div style={{ padding: '14px 16px' }}>{children}</div>
    </div>
  );
}

function EmptyState({ msg }: { msg: string }) {
  return <div style={{ fontSize: 12, color: '#333', padding: '12px 0' }}>{msg}</div>;
}

function JsonBlock({ data }: { data: unknown }) {
  return (
    <pre style={{ fontSize: 11, color: '#666', fontFamily: 'monospace', background: '#0a0b10', padding: 12, borderRadius: 6, overflow: 'auto', maxHeight: 260, lineHeight: 1.5, margin: 0, border: '1px solid #111318' }}>
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

// ─── Tab panels ───────────────────────────────────────────────────────────────

function AutonomousLoopTab() {
  const [state,  setState]  = useState<AutonomousLoopState | null>(null);
  const [states, setStates] = useState<AutonomousLoopState[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getAutonomousLoopState().then(setState).catch(() => {}),
      getAllAutonomousLoopStates().then(d => setStates(Array.isArray(d) ? d : [])).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  if (loading) return <EmptyState msg="Loading autonomous loop data…" />;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      <Card title="Current State" accent="#6366f1">
        {state ? <JsonBlock data={state} /> : <EmptyState msg="No state — run a cycle first" />}
      </Card>
      <Card title="All Loop States" accent="#6366f1">
        {states.length === 0 ? <EmptyState msg="No states yet" /> : (
          <div style={{ maxHeight: 280, overflowY: 'auto' }}>
            {states.map((s, i) => (
              <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid #0f1014', fontSize: 12, color: '#888' }}>
                <span style={{ fontWeight: 700, color: '#c0c0c0' }}>{String(s.userId ?? `state-${i}`)}</span>
                {' — '}
                <span style={{ color: '#555' }}>{String(s.status ?? 'unknown')}</span>
                {s.cycleCount !== undefined && <span style={{ marginLeft: 8, color: '#444' }}>{String(s.cycleCount)} cycles</span>}
              </div>
            ))}
          </div>
        )}
      </Card>
      <Card title="Endpoints" accent="#6366f1">
        {[
          'GET /api/autonomous-loop/state',
          'GET /api/autonomous-loop/states',
          'GET /api/autonomous-loop/policy/:userId',
          'POST /api/autonomous-loop/evaluate/:userId',
        ].map(e => (
          <div key={e} style={{ fontSize: 11, color: '#22c55e', fontFamily: 'monospace', padding: '3px 0' }}>✓ {e}</div>
        ))}
      </Card>
    </div>
  );
}

function OrchestratorTab() {
  const [rules,   setRules]   = useState<OrchestratorRule[]>([]);
  const [status,  setStatus]  = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getOrchestratorRules().then(d => setRules(Array.isArray(d) ? d : [])).catch(() => {}),
      fetch('/api/orchestrator/status').then(r => r.json()).then(setStatus).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  if (loading) return <EmptyState msg="Loading orchestrator data…" />;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      <Card title="Decision Rules" accent="#f59e0b">
        {rules.length === 0 ? <EmptyState msg="No rules" /> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {rules.map(r => (
              <div key={r.id} style={{ padding: '10px 12px', background: '#0a0b10', borderRadius: 7, border: `1px solid ${r.enabled ? '#1e2330' : '#111318'}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: r.enabled ? '#22c55e' : '#333', flexShrink: 0 }} />
                  <span style={{ fontSize: 10, color: '#444', fontWeight: 700 }}>Priority {r.priority}</span>
                  <span style={{ fontSize: 10, color: r.enabled ? '#22c55e' : '#444' }}>{r.enabled ? 'ENABLED' : 'DISABLED'}</span>
                </div>
                <div style={{ fontSize: 11, color: '#888', fontFamily: 'monospace' }}>
                  IF <span style={{ color: '#f59e0b' }}>{r.condition}</span>
                </div>
                <div style={{ fontSize: 11, color: '#888', fontFamily: 'monospace' }}>
                  → <span style={{ color: '#6ee7b7' }}>{r.action}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
      <Card title="Orchestrator Status" accent="#f59e0b">
        {status ? <JsonBlock data={status} /> : <EmptyState msg="Status unavailable" />}
        <div style={{ marginTop: 12 }}>
          <a href="/admin/observability/self-improving-loop" style={{ fontSize: 12, color: '#a5b4fc', textDecoration: 'none' }}>
            → Edit Rules in Self-Improving Loop
          </a>
        </div>
      </Card>
    </div>
  );
}

function MemoryEngineTab() {
  const [best,    setBest]    = useState<{ angles: MemoryAngle[] } | null>(null);
  const [formats, setFormats] = useState<{ stats: MemoryFormatStat[] } | null>(null);
  const [wins,    setWins]    = useState<MemoryWinRate[]>([]);
  const [weights, setWeights] = useState<MemoryWeights | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getMemoryBestAngles().then(setBest).catch(() => {}),
      getMemoryFormatStats().then(setFormats).catch(() => {}),
      getMemoryWinRates().then(d => setWins(Array.isArray(d) ? d : [])).catch(() => {}),
      getMemoryWeights().then(setWeights).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  if (loading) return <EmptyState msg="Loading memory engine data…" />;

  const bestAngles  = best?.angles  ?? [];
  const formatStats = formats?.stats ?? [];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
      <Card title="Best Angles" accent="#22c55e">
        {bestAngles.length === 0 ? <EmptyState msg="No memory data" /> : bestAngles.slice(0, 10).map(a => (
          <KV key={a.slug} label={a.slug} value={`w:${a.weight.toFixed(3)} (${a.uses})`} color="#22c55e" />
        ))}
      </Card>
      <Card title="Format Stats" accent="#22c55e">
        {formatStats.length === 0 ? <EmptyState msg="No format data" /> : formatStats.map(f => (
          <KV key={f.format} label={f.format} value={`w:${f.weight.toFixed(3)}`} />
        ))}
      </Card>
      <Card title="Win Rates" accent="#22c55e">
        {wins.length === 0 ? <EmptyState msg="No win rate data" /> : wins.slice(0, 10).map(w => (
          <KV
            key={w.angleSlug}
            label={w.angleSlug}
            value={`${(w.winRate * 100).toFixed(1)}% (${w.wins}/${w.total})`}
            color={w.winRate > 0.5 ? '#22c55e' : w.winRate > 0.3 ? '#f59e0b' : '#ef4444'}
          />
        ))}
      </Card>
      {weights && (
        <Card title="Active Scoring Weights" accent="#22c55e">
          <KV label="CTR"        value={`${(weights.ctr        * 100).toFixed(0)}%`} color="#6ee7b7" />
          <KV label="Conversion" value={`${(weights.conversion * 100).toFixed(0)}%`} color="#6ee7b7" />
          <KV label="Engagement" value={`${(weights.engagement * 100).toFixed(0)}%`} color="#6ee7b7" />
          <KV label="Clarity"    value={`${(weights.clarity    * 100).toFixed(0)}%`} color="#6ee7b7" />
          <div style={{ fontSize: 11, color: '#333', marginTop: 8 }}>Updated: {new Date(weights.updatedAt).toLocaleString()}</div>
          <a href="/admin/observability/self-improving-loop" style={{ fontSize: 12, color: '#a5b4fc', textDecoration: 'none', display: 'block', marginTop: 6 }}>
            → Edit Weights
          </a>
        </Card>
      )}
    </div>
  );
}

function GlobalMemoryTab() {
  const [data, setData]     = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getGlobalMemory()
      .then(d => setData(d as Record<string, unknown>))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <EmptyState msg="Loading global memory…" />;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      <Card title="Global Memory State" accent="#a78bfa">
        {data ? <JsonBlock data={data} /> : <EmptyState msg="No global memory data" />}
      </Card>
      <Card title="Endpoints" accent="#a78bfa">
        {[
          'GET /api/global-memory',
          'POST /api/global-memory/learn',
        ].map(e => (
          <div key={e} style={{ fontSize: 11, color: '#22c55e', fontFamily: 'monospace', padding: '3px 0' }}>✓ {e}</div>
        ))}
      </Card>
    </div>
  );
}

function RealityEngineTab() {
  const [campaignId, setCampaignId] = useState('');
  const [aggregate,  setAggregate]  = useState<Record<string, unknown> | null>(null);
  const [events,     setEvents]     = useState<unknown[]>([]);
  const [loading,    setLoading]    = useState(false);

  const fetch_ = useCallback(async () => {
    if (!campaignId) return;
    setLoading(true);
    await Promise.all([
      getRealityAggregate(campaignId).then(setAggregate).catch(() => {}),
      getRealityEvents(campaignId).then(e => setEvents(Array.isArray(e) ? e : [])).catch(() => {}),
    ]);
    setLoading(false);
  }, [campaignId]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 10 }}>
        <input
          value={campaignId}
          onChange={e => setCampaignId(e.target.value)}
          placeholder="Campaign ID…"
          style={{ flex: 1, padding: '8px 12px', background: '#0d0e14', border: '1px solid #1e2330', borderRadius: 7, color: '#f0f0f0', fontSize: 13, fontFamily: 'inherit', outline: 'none' }}
        />
        <button onClick={fetch_} disabled={!campaignId || loading} style={{ padding: '8px 16px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 7, color: '#4ade80', fontSize: 13, cursor: campaignId ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>
          {loading ? 'Loading…' : '↻ Load'}
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Card title="Aggregate Metrics" accent="#3b82f6">
          {aggregate ? <JsonBlock data={aggregate} /> : <EmptyState msg="Enter a campaign ID above" />}
        </Card>
        <Card title="Raw Events" accent="#3b82f6">
          {events.length === 0 ? <EmptyState msg="No events" /> : (
            <div style={{ maxHeight: 280, overflowY: 'auto' }}>
              {(events as Record<string, unknown>[]).slice(0, 20).map((ev, i) => (
                <div key={i} style={{ fontSize: 11, color: '#555', padding: '4px 0', borderBottom: '1px solid #0f1014', fontFamily: 'monospace' }}>
                  {JSON.stringify(ev).slice(0, 100)}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function AngleInsightsTab() {
  const [summary, setSummary] = useState<AngleInsightSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAngleInsightsSummary().then(d => setSummary(Array.isArray(d) ? d : [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <EmptyState msg="Loading angle insights…" />;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
      {summary.length === 0 ? (
        <div style={{ gridColumn: '1/-1' }}><EmptyState msg="No angle insights — run synthesize first" /></div>
      ) : (
        summary.map(s => (
          <Card key={s.angleSlug} title={s.angleSlug} accent="#ec4899">
            <KV label="Insights count" value={s.count} />
            {s.topThemes?.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 10, color: '#444', marginBottom: 4 }}>Top Themes</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {s.topThemes.slice(0, 4).map(t => (
                    <span key={t} style={{ fontSize: 10, padding: '2px 7px', background: 'rgba(236,72,153,0.08)', border: '1px solid rgba(236,72,153,0.15)', borderRadius: 4, color: '#f472b6' }}>{t}</span>
                  ))}
                </div>
              </div>
            )}
          </Card>
        ))
      )}
    </div>
  );
}

function AdminAnalyticsTab() {
  const [overview, setOverview]   = useState<AdminOverview | null>(null);
  const [learning, setLearning]   = useState<AdminLearningState | null>(null);
  const [feed,     setFeed]       = useState<AdminRealtimeFeedEntry[]>([]);
  const [health,   setHealth]     = useState<AdminSystemHealth | null>(null);
  const [loading,  setLoading]    = useState(true);

  useEffect(() => {
    Promise.all([
      getAdminOverview().then(setOverview).catch(() => {}),
      getAdminLearningState().then(setLearning).catch(() => {}),
      getAdminRealtimeFeed(30).then(d => setFeed(Array.isArray(d) ? d : [])).catch(() => {}),
      getAdminSystemHealth().then(setHealth).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  if (loading) return <EmptyState msg="Loading admin analytics…" />;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      <Card title="System Overview" accent="#6366f1">
        {overview ? (
          Object.entries(overview).map(([k, v]) => (
            <KV key={k} label={k} value={typeof v === 'number' ? v.toLocaleString() : String(v)} />
          ))
        ) : <EmptyState msg="Unavailable" />}
      </Card>

      <Card title="System Health" accent="#22c55e">
        {health ? (
          <>
            <KV label="Status"           value={String(health.status ?? '—')} color={health.status === 'healthy' ? '#22c55e' : '#f59e0b'} />
            {health.learningRate    !== undefined && <KV label="Learning Rate"    value={String(health.learningRate)}    />}
            {health.improvementGain !== undefined && <KV label="Improvement Gain" value={String(health.improvementGain)} />}
            {health.recommendation && (
              <div style={{ marginTop: 10, padding: '8px 10px', background: 'rgba(99,102,241,0.06)', borderRadius: 6, fontSize: 12, color: '#a5b4fc' }}>
                💡 {String(health.recommendation)}
              </div>
            )}
          </>
        ) : <EmptyState msg="Unavailable" />}
      </Card>

      <Card title="AI Learning State" accent="#f59e0b">
        {learning ? <JsonBlock data={learning} /> : <EmptyState msg="Unavailable" />}
      </Card>

      <Card title="Realtime Feed" accent="#3b82f6">
        {feed.length === 0 ? <EmptyState msg="No events" /> : (
          <div style={{ maxHeight: 260, overflowY: 'auto' }}>
            {feed.map((ev, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, padding: '5px 0', borderBottom: '1px solid #0f1014', alignItems: 'flex-start' }}>
                <span style={{ fontSize: 10, color: '#6366f1', fontWeight: 700, flexShrink: 0 }}>{String(ev.type ?? '—')}</span>
                <span style={{ fontSize: 11, color: '#555', flex: 1 }}>{typeof (ev.detail ?? ev.entityId) === 'object' ? JSON.stringify(ev.detail ?? ev.entityId).slice(0, 80) : String(ev.detail ?? ev.entityId ?? '—')}</span>
                <span style={{ fontSize: 10, color: '#333', flexShrink: 0 }}>{ev.at ? new Date(String(ev.at)).toLocaleTimeString() : ''}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function ProductSurfaceTab() {
  const [campaignId, setCampaignId] = useState('');
  const [data,       setData]       = useState<Record<string, Record<string, unknown>>>({});
  const [dashboard,  setDashboard]  = useState<Record<string, unknown> | null>(null);
  const [loading,    setLoading]    = useState(false);
  const [dashLoading, setDashLoading] = useState(true);

  // Load product dashboard on mount (no campaign ID needed)
  useEffect(() => {
    import('@/lib/api/creator-client').then(({ getProductDashboard }) =>
      getProductDashboard().then(setDashboard).catch(() => setDashboard(null))
    ).finally(() => setDashLoading(false));
  }, []);

  const fetchAll = useCallback(async () => {
    if (!campaignId) return;
    setLoading(true);
    const [campaign, insights, angles, creatives] = await Promise.allSettled([
      import('@/lib/api/creator-client').then(({ getProductCampaign  }) => getProductCampaign(campaignId)),
      import('@/lib/api/creator-client').then(({ getProductInsights  }) => getProductInsights(campaignId)),
      import('@/lib/api/creator-client').then(({ getProductAngles    }) => getProductAngles(campaignId)),
      import('@/lib/api/creator-client').then(({ getProductCreatives }) => getProductCreatives(campaignId)),
    ]);
    const results: Record<string, Record<string, unknown>> = {};
    if (campaign.status  === 'fulfilled') results['campaign']  = campaign.value  as Record<string, unknown>;
    if (insights.status  === 'fulfilled') results['insights']  = insights.value  as Record<string, unknown>;
    if (angles.status    === 'fulfilled') results['angles']    = angles.value    as Record<string, unknown>;
    if (creatives.status === 'fulfilled') results['creatives'] = creatives.value as Record<string, unknown>;
    setData(results);
    setLoading(false);
  }, [campaignId]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 10 }}>
        <input
          value={campaignId}
          onChange={e => setCampaignId(e.target.value)}
          placeholder="Campaign ID…"
          style={{ flex: 1, padding: '8px 12px', background: '#0d0e14', border: '1px solid #1e2330', borderRadius: 7, color: '#f0f0f0', fontSize: 13, fontFamily: 'inherit', outline: 'none' }}
        />
        <button onClick={fetchAll} disabled={!campaignId || loading} style={{ padding: '8px 16px', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 7, color: '#a5b4fc', fontSize: 13, cursor: campaignId ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>
          {loading ? 'Loading…' : '↻ Load All'}
        </button>
      </div>
      {/* Product Dashboard — no campaign ID needed */}
      <Card title="GET /api/product/dashboard" accent="#a78bfa">
        {dashLoading ? <EmptyState msg="Loading dashboard…" /> :
          dashboard ? <JsonBlock data={dashboard as Record<string, unknown>} /> :
          <EmptyState msg="Product dashboard unavailable" />}
      </Card>

      {/* Per-campaign product data */}
      {Object.keys(data).length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {Object.entries(data).map(([k, v]) => (
            <Card key={k} title={`GET /api/product/${k}/:id`} accent="#a78bfa">
              <JsonBlock data={v} />
            </Card>
          ))}
        </div>
      ) : (
        <Card title="Per-Campaign Product Endpoints" accent="#a78bfa">
          <div style={{ fontSize: 12, color: '#444', lineHeight: 2 }}>
            {[
              'GET /api/product/campaign/:id',
              'GET /api/product/insights/:id',
              'GET /api/product/angles/:id',
              'GET /api/product/creatives/:id',
            ].map(e => <div key={e} style={{ fontFamily: 'monospace', fontSize: 11, color: '#555' }}>{e}</div>)}
          </div>
          <div style={{ marginTop: 10, fontSize: 12, color: '#444' }}>Enter a campaign ID above to inspect live data.</div>
        </Card>
      )}
    </div>
  );
}

// ── System Health tab — polls all status endpoints for a full health matrix ──

type ServiceStatus = { label: string; endpoint: string; active?: boolean; version?: string; ok?: boolean; error?: boolean; raw?: Record<string, unknown> };

function SystemHealthTab() {
  const [services,   setServices]   = useState<ServiceStatus[]>([]);
  const [traces,     setTraces]     = useState<unknown[]>([]);
  const [campaignId, setCampaignId] = useState('');
  const [costMetrics, setCostMetrics] = useState<Record<string, unknown> | null>(null);
  const [loading,    setLoading]    = useState(true);

  useEffect(() => {
    // UserGuard runs globally on every NestJS route — must send a Bearer JWT.
    // Use the same auth + base-URL pattern as creator-client.
    const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';
    const BASE    = API_URL && !API_URL.includes('localhost') ? API_URL : '';

    const CHECKS: { label: string; endpoint: string }[] = [
      { label: 'Observability',  endpoint: '/api/observability/status'    },
      { label: 'Auto-Winner',    endpoint: '/api/auto-winner/status'      },
      { label: 'Hook Booster',   endpoint: '/api/hook-booster/status'     },
      { label: 'Scene Rewriter', endpoint: '/api/scene-rewriter/status'   },
      { label: 'Exploration',    endpoint: '/api/exploration/status'      },
      { label: 'Orchestrator',   endpoint: '/api/orchestrator/status'     },
      { label: 'MIROFISH Learn', endpoint: '/api/mirofish/learning/status' },
      { label: 'Global Memory',  endpoint: '/api/global-memory/status'    },
      { label: 'Evolution',      endpoint: '/api/evolution/status'        },
      { label: 'Emergence',      endpoint: '/api/emergence/state'         },
    ];

    // Get Supabase Bearer token first, then fire all health checks in parallel
    import('@/lib/supabase').then(({ getSupabase }) =>
      getSupabase().auth.getSession()
    ).then(({ data: { session } }) => {
      const h: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) h['Authorization'] = `Bearer ${session.access_token}`;

      return Promise.allSettled(
        CHECKS.map(c =>
          fetch(`${BASE}${c.endpoint}`, { headers: h })
            .then(r => r.ok ? r.json() : Promise.reject(r.status))
            .then(raw => ({ label: c.label, endpoint: c.endpoint, active: true,  ok: true,  raw } as ServiceStatus))
            .catch(() => ({ label: c.label, endpoint: c.endpoint, active: false, error: true } as ServiceStatus))
        )
      );
    }).then(results => {
      setServices(results.map(r => r.status === 'fulfilled' ? r.value : { label: '?', endpoint: '?', error: true }));
      setLoading(false);

      // Cost metrics — reuse same auth headers if session available
      import('@/lib/supabase').then(({ getSupabase }) =>
        getSupabase().auth.getSession()
      ).then(({ data: { session } }) => {
        const h: Record<string, string> = { 'Content-Type': 'application/json' };
        if (session?.access_token) h['Authorization'] = `Bearer ${session.access_token}`;
        fetch(`${BASE}/api/optimization/metrics`, { headers: h })
          .then(r => r.json()).then(setCostMetrics).catch(() => {});
      });
    }).catch(() => setLoading(false));
  }, []);

  const loadTraces = useCallback(async () => {
    if (!campaignId) return;
    const t = await getCampaignTraces(campaignId).catch(() => []);
    setTraces(t);
  }, [campaignId]);

  if (loading) return <EmptyState msg="Polling all service endpoints…" />;

  const up   = services.filter(s => s.ok).length;
  const down = services.filter(s => s.error).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Summary bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        {[
          { label: 'Services UP',   value: up,   color: '#22c55e' },
          { label: 'Services DOWN', value: down, color: down > 0 ? '#ef4444' : '#22c55e' },
          { label: 'Total Checks',  value: services.length, color: '#6366f1' },
        ].map(stat => (
          <div key={stat.label} style={{ padding: '14px 16px', background: '#0d0e14', border: `1px solid ${stat.color}22`, borderRadius: 10, textAlign: 'center' }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: stat.color }}>{stat.value}</div>
            <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Service grid */}
      <Card title="Service Health Matrix" accent="#22c55e">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {services.map(s => (
            <div key={s.endpoint} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: s.ok ? 'rgba(34,197,94,0.04)' : 'rgba(239,68,68,0.04)', border: `1px solid ${s.ok ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)'}`, borderRadius: 7 }}>
              <span style={{ fontSize: 16 }}>{s.ok ? '🟢' : '🔴'}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: s.ok ? '#4ade80' : '#f87171' }}>{s.label}</div>
                <div style={{ fontSize: 10, color: '#444', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.endpoint}</div>
              </div>
              {s.raw?.version != null && <span style={{ fontSize: 10, color: '#555' }}>v{String(s.raw.version)}</span>}
            </div>
          ))}
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Cost Metrics */}
        <Card title="Cost Optimization Metrics" accent="#f59e0b">
          {costMetrics ? (
            Object.entries(costMetrics).slice(0, 8).map(([k, v]) => (
              <KV key={k} label={k} value={String(v)} />
            ))
          ) : <EmptyState msg="Cost metrics unavailable" />}
        </Card>

        {/* Trace Explorer */}
        <Card title="Trace Explorer" accent="#22c55e">
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input
              value={campaignId}
              onChange={e => setCampaignId(e.target.value)}
              placeholder="Campaign ID…"
              style={{ flex: 1, padding: '7px 10px', background: '#0a0b10', border: '1px solid #1e2330', borderRadius: 6, color: '#f0f0f0', fontSize: 12, fontFamily: 'inherit', outline: 'none' }}
            />
            <button onClick={loadTraces} style={{ padding: '7px 12px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 6, color: '#4ade80', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>↻</button>
          </div>
          {traces.length === 0 ? <EmptyState msg="No traces — enter a campaign ID" /> : (
            <div style={{ maxHeight: 200, overflowY: 'auto' }}>
              {(traces as Record<string, unknown>[]).map((t, i) => (
                <div key={i} style={{ fontSize: 11, color: '#555', padding: '4px 0', borderBottom: '1px solid #0f1014', fontFamily: 'monospace' }}>
                  {String(t.traceId ?? i)} — {String(t.createdAt ?? '—').slice(0, 16)}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function AutonomousModeTabContent() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{
        padding: '20px 24px',
        background: 'rgba(99,102,241,0.06)',
        border: '1px solid rgba(99,102,241,0.2)',
        borderRadius: 12,
      }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#a5b4fc', marginBottom: 8 }}>🤖 Autonomous Mode Engine</div>
        <p style={{ fontSize: 13, color: '#555', margin: 0, lineHeight: 1.6 }}>
          Control MANUAL / HYBRID / AUTONOMOUS mode, decision queue, audit trail, emergency controls.
        </p>
        <a
          href="/admin/observability/autonomous-mode"
          style={{
            display: 'inline-flex', alignItems: 'center', marginTop: 16, padding: '9px 18px',
            background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)',
            borderRadius: 8, color: '#a5b4fc', fontSize: 13, fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          Open Autonomous Mode →
        </a>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        {[
          { href: '/admin/observability/self-improving-loop', label: '🔧 Self-Improving Loop', desc: 'Evolution controls, memory weight editor, orchestrator rules, hook strategy' },
          { href: '/admin/observability/live-debug',          label: '🐛 Live Debug Mode',      desc: 'Decision replay timeline, simulation engine, decision diff viewer'         },
          { href: '/admin/observability#system-health',        label: '❤️ System Health',         desc: 'Full endpoint coverage map, connection status, service health matrix'      },
        ].map(item => (
          <a key={item.href} href={item.href} style={{ padding: '14px 16px', background: '#0d0e14', border: '1px solid #1e2330', borderRadius: 10, textDecoration: 'none' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#f0f0f0', marginBottom: 6 }}>{item.label}</div>
            <div style={{ fontSize: 12, color: '#555', lineHeight: 1.5 }}>{item.desc}</div>
          </a>
        ))}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ObservabilityPage() {
  const [activeTab, setActiveTab] = useState<TabId>('admin-analytics');

  const tabContent: Record<TabId, React.ReactNode> = {
    'autonomous-loop': <AutonomousLoopTab />,
    'orchestrator':    <OrchestratorTab />,
    'memory-engine':   <MemoryEngineTab />,
    'global-memory':   <GlobalMemoryTab />,
    'reality-engine':  <RealityEngineTab />,
    'angle-insights':  <AngleInsightsTab />,
    'admin-analytics': <AdminAnalyticsTab />,
    'product-surface': <ProductSurfaceTab />,
    'system-health':   <SystemHealthTab />,
    'autonomous-mode': <AutonomousModeTabContent />,
  };

  return (
    <div style={{ maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 4 }}>
          👁 Observability Hub
        </h1>
        <p style={{ fontSize: 13, color: '#555' }}>
          Full visibility into every backend intelligence system — live data, no ghost endpoints.
        </p>
      </div>

      {/* Tab bar */}
      <div style={{
        display: 'flex', gap: 2, padding: '4px',
        background: '#0a0b10', border: '1px solid #1e2330',
        borderRadius: 10, marginBottom: 24, flexWrap: 'wrap',
      }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '7px 12px', borderRadius: 7, border: 'none', cursor: 'pointer',
              background: activeTab === tab.id ? '#1e2330' : 'transparent',
              color: activeTab === tab.id ? '#f0f0f0' : '#555',
              fontSize: 12, fontWeight: activeTab === tab.id ? 600 : 400,
              fontFamily: 'inherit', whiteSpace: 'nowrap',
              transition: 'all 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>{tabContent[activeTab]}</div>
    </div>
  );
}
