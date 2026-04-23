'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Sidebar } from '@/components/Sidebar';
import {
  getRegistryEndpoints, runSystemAudit, resolveEndpoint, resolveAllOrphans,
  type RegistryEndpoint, type RegistryResponse,
  type AuditReport, type AuditEndpoint, type ResolveStrategy, type ResolveResult,
} from '@/lib/api/creator-client';

// ─── Types ────────────────────────────────────────────────────────────────────

type AuditTab = 'orphans' | 'missing' | 'generated' | 'registry';
type Classification = 'CONNECTED' | 'ADMIN' | 'INTERNAL' | 'ORPHAN';

// ─── Constants ────────────────────────────────────────────────────────────────

const CLS_COLOR: Record<Classification, string> = {
  CONNECTED: 'var(--emerald)', ADMIN: 'var(--indigo)', INTERNAL: '#555', ORPHAN: 'var(--rose)',
};
const CLS_HEX: Record<Classification, string> = {
  CONNECTED: '#10b981', ADMIN: '#6366f1', INTERNAL: '#555', ORPHAN: '#ef4444',
};
const METHOD_HEX: Record<string, string> = {
  GET: '#10b981', POST: '#6366f1', PATCH: '#f59e0b', PUT: '#f59e0b', DELETE: '#ef4444',
};
const STRATEGY_META: Record<ResolveStrategy, { label: string; color: string; desc: string }> = {
  wire_ui:        { label: '⚡ Wire UI',       color: 'var(--indigo)',  desc: 'Mark as connected — maps to existing page' },
  classify_admin: { label: '🔬 Admin',         color: 'var(--purple)',  desc: 'Move to Pro Diagnostics tab' },
  mark_internal:  { label: '🔒 Internal',      color: 'var(--muted)',   desc: 'Hide from UI — internal only' },
  generate_ui:    { label: '✦ Generate UI',    color: 'var(--emerald)', desc: 'Auto-create a viewer page' },
};

function classify(ep: RegistryEndpoint): Classification {
  if (ep.uiExposure === 'HIDDEN_INTERNAL') return 'INTERNAL';
  if (ep.uiExposure === 'ADMIN_UI')        return 'ADMIN';
  if (ep.connected)                        return 'CONNECTED';
  return 'ORPHAN';
}

function suggestStrategy(ep: AuditEndpoint): ResolveStrategy {
  const p = ep.path.toLowerCase();
  if (p.includes('/routing/') || p.includes('/internal') || p.includes('/signal') || p.includes('/feedback')) return 'mark_internal';
  if (p.includes('/admin') || p.includes('/audit') || p.includes('/log') || p.includes('/debug') ||
      p.includes('/memory') || p.includes('/learning') || p.includes('/fatigue') || p.includes('/cost') ||
      p.includes('/observability') || p.includes('/emergence') || p.includes('/exploration'))
    return 'classify_admin';
  if (ep.clientFn && ep.uiLocation && ep.uiLocation !== 'none') return 'wire_ui';
  return 'generate_ui';
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ResolveButton({
  ep, onResolved,
}: {
  ep: AuditEndpoint;
  onResolved: (r: ResolveResult) => void;
}) {
  const [busy,      setBusy]      = useState(false);
  const [strategy,  setStrategy]  = useState<ResolveStrategy>(suggestStrategy(ep));
  const [preview,   setPreview]   = useState(false);
  const [result,    setResult]    = useState<ResolveResult | null>(null);

  const meta = STRATEGY_META[strategy];

  async function handleResolve() {
    setBusy(true);
    try {
      const r = await resolveEndpoint(ep.path, ep.method, strategy);
      setResult(r);
      if (r.success) onResolved(r);
    } catch (e) {
      setResult({ success: false, strategy, endpointPath: ep.path, method: ep.method, action: e instanceof Error ? e.message : 'Request failed' });
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: result.success ? 'var(--emerald)' : 'var(--rose)' }}>
          {result.success ? '✓ Resolved' : '✗ Failed'}
        </span>
        {result.previewUrl && (
          <Link href={result.previewUrl} style={{ fontSize: 10, color: 'var(--indigo-l)', textDecoration: 'none' }}>
            View →
          </Link>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
      {/* Strategy selector */}
      <div style={{ display: 'flex', gap: 3 }}>
        {(Object.keys(STRATEGY_META) as ResolveStrategy[]).map(s => (
          <button key={s} onClick={() => setStrategy(s)}
            style={{ padding: '2px 6px', fontSize: 9, fontWeight: strategy === s ? 700 : 500, borderRadius: 4, cursor: 'pointer', fontFamily: 'inherit', background: strategy === s ? `${STRATEGY_META[s].color.includes('var') ? '#6366f1' : STRATEGY_META[s].color}20` : 'transparent', border: `1px solid ${strategy === s ? STRATEGY_META[s].color : 'var(--border)'}`, color: strategy === s ? STRATEGY_META[s].color : 'var(--muted)' }}>
            {s === 'wire_ui' ? '⚡' : s === 'classify_admin' ? '🔬' : s === 'mark_internal' ? '🔒' : '✦'}
          </button>
        ))}
      </div>
      {/* Preview toggle */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {preview && (
          <span style={{ fontSize: 9, color: 'var(--muted)', maxWidth: 160, lineHeight: 1.3 }}>{meta.desc}</span>
        )}
        <button onClick={() => setPreview(v => !v)}
          style={{ fontSize: 9, color: 'var(--muted)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}>
          {preview ? '▲' : 'preview'}
        </button>
        <button onClick={handleResolve} disabled={busy}
          style={{ padding: '4px 10px', fontSize: 10, fontWeight: 700, borderRadius: 6, cursor: busy ? 'not-allowed' : 'pointer', fontFamily: 'inherit', background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.4)', color: 'var(--indigo-l)', opacity: busy ? 0.5 : 1, whiteSpace: 'nowrap' }}>
          {busy ? '…' : 'Resolve →'}
        </button>
      </div>
    </div>
  );
}

function OrphanRow({ ep, onResolved }: { ep: AuditEndpoint; onResolved: (r: ResolveResult) => void }) {
  const mh = METHOD_HEX[ep.method] ?? '#888';
  const suggested = suggestStrategy(ep);
  const meta = STRATEGY_META[suggested];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '55px 1fr auto 160px', gap: 10, padding: '10px 14px', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
      <span className="badge" style={{ color: mh, background: `${mh}14` }}>{ep.method}</span>
      <div style={{ minWidth: 0 }}>
        <code style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--purple)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ep.path}</code>
        <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{ep.label} · <span style={{ color: 'var(--sub)' }}>{ep.module}</span></div>
        {ep.notes && <div style={{ fontSize: 9, color: 'var(--rose)', marginTop: 2 }}>{ep.notes}</div>}
      </div>
      <div style={{ textAlign: 'center' }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: meta.color, background: `${mh}12`, padding: '2px 6px', borderRadius: 4, whiteSpace: 'nowrap' }}>
          {meta.label}
        </span>
      </div>
      <ResolveButton ep={ep} onResolved={onResolved} />
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SystemAuditPage() {
  const [registry,     setRegistry]     = useState<RegistryResponse | null>(null);
  const [auditReport,  setAuditReport]  = useState<AuditReport | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [auditLoading, setAuditLoading] = useState(false);
  const [batchBusy,    setBatchBusy]    = useState(false);
  const [batchResults, setBatchResults] = useState<{ resolved: number; skipped: number; failed: number } | null>(null);
  const [tab,          setTab]          = useState<AuditTab>('orphans');
  const [search,       setSearch]       = useState('');
  const [filterClass,  setFilterClass]  = useState<Classification | 'ALL'>('ALL');
  const [filterMod,    setFilterMod]    = useState('ALL');
  const [resolvedPaths, setResolvedPaths] = useState<Set<string>>(new Set());

  // Load registry
  useEffect(() => {
    Promise.all([
      getRegistryEndpoints().catch(() => null),
      runSystemAudit().catch(() => null),
    ]).then(([reg, audit]) => {
      if (reg)   setRegistry(reg);
      if (audit) setAuditReport(audit);
      setLoading(false);
    });
  }, []);

  const refreshAudit = useCallback(async () => {
    setAuditLoading(true);
    try {
      const [reg, audit] = await Promise.all([
        getRegistryEndpoints().catch(() => null),
        runSystemAudit().catch(() => null),
      ]);
      if (reg)   setRegistry(reg);
      if (audit) setAuditReport(audit);
    } finally {
      setAuditLoading(false);
    }
  }, []);

  function handleResolved(result: ResolveResult) {
    setResolvedPaths(prev => new Set([...prev, `${result.method}:${result.endpointPath}`]));
    // Refresh audit counts after a short delay
    setTimeout(refreshAudit, 600);
  }

  async function handleResolveAll() {
    setBatchBusy(true);
    try {
      const { summary } = await resolveAllOrphans();
      setBatchResults(summary);
      await refreshAudit();
    } catch { /* silent */ }
    finally { setBatchBusy(false); }
  }

  // Registry tab filters
  const all = registry?.endpoints ?? [];
  const classified = all.map(ep => ({ ep, cls: classify(ep) }));
  const counts = { CONNECTED: 0, ADMIN: 0, INTERNAL: 0, ORPHAN: 0 } as Record<Classification, number>;
  classified.forEach(({ cls }) => counts[cls]++);
  const modules = ['ALL', ...Array.from(new Set(all.map(e => e.module))).sort()];
  const coverage = all.length > 0 ? Math.round((counts.CONNECTED / all.length) * 100) : 0;
  const visible = classified.filter(({ ep, cls }) => {
    if (filterClass !== 'ALL' && cls !== filterClass) return false;
    if (filterMod !== 'ALL' && ep.module !== filterMod) return false;
    if (search) { const q = search.toLowerCase(); return ep.path.toLowerCase().includes(q) || ep.label.toLowerCase().includes(q) || ep.module.toLowerCase().includes(q); }
    return true;
  });

  if (loading) return (
    <div className="app-shell"><Sidebar />
      <main className="app-main"><div className="page-content" style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
        <div className="spin" style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--indigo)', borderRadius: '50%' }} />
      </div></main>
    </div>
  );

  const orphans   = auditReport?.orphanEndpoints   ?? [];
  const missing   = auditReport?.missingUIBindings ?? [];
  const generated = auditReport?.generatedTools    ?? [];
  const stats     = auditReport?.stats;

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-main">
        <div className="page-content">

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 6 }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: 0 }}>🗂 Self-Healing System Audit</h1>
              <p style={{ fontSize: 13, color: 'var(--sub)', marginTop: 4 }}>
                Detect → classify → resolve orphan endpoints in one click.
              </p>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
              <button onClick={refreshAudit} disabled={auditLoading}
                style={{ padding: '6px 12px', borderRadius: 7, background: 'transparent', border: '1px solid var(--border)', color: 'var(--sub)', fontSize: 11, fontFamily: 'inherit', cursor: auditLoading ? 'not-allowed' : 'pointer', opacity: auditLoading ? 0.5 : 1 }}>
                {auditLoading ? '…' : '↺ Refresh'}
              </button>
              {tab === 'orphans' && orphans.length > 0 && (
                <button onClick={handleResolveAll} disabled={batchBusy}
                  style={{ padding: '6px 14px', borderRadius: 7, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.4)', color: 'var(--indigo-l)', fontSize: 11, fontWeight: 700, fontFamily: 'inherit', cursor: batchBusy ? 'not-allowed' : 'pointer', opacity: batchBusy ? 0.5 : 1 }}>
                  {batchBusy ? '…' : `⚡ Resolve ALL ${orphans.length} Orphans`}
                </button>
              )}
            </div>
          </div>

          {/* Batch result banner */}
          {batchResults && (
            <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, display: 'flex', gap: 20, alignItems: 'center' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--emerald)' }}>✓ Batch complete</span>
              <span style={{ fontSize: 11, color: 'var(--sub)' }}>{batchResults.resolved} resolved · {batchResults.skipped} skipped · {batchResults.failed} failed</span>
              <button onClick={() => setBatchResults(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 13 }}>×</button>
            </div>
          )}

          {/* Stat row */}
          <div className="intel-stats-grid intel-stats-grid-5" style={{ marginBottom: 20 }}>
            {[
              ['Total Endpoints', stats?.total ?? all.length,     'var(--sub)',     '#888'    ],
              ['Connected',       stats?.connected ?? counts.CONNECTED, 'var(--emerald)', '#10b981' ],
              ['Orphans',         stats?.orphans ?? orphans.length,    'var(--rose)',    '#ef4444' ],
              ['Admin Only',      stats?.adminOnly ?? counts.ADMIN,    'var(--indigo)',  '#6366f1' ],
              ['Internal',        stats?.internal ?? counts.INTERNAL,  'var(--muted)',   '#555'    ],
            ].map(([l, v, c, ch]) => (
              <div key={l as string} style={{ background: `${ch as string}10`, border: `1px solid ${ch as string}28`, borderRadius: 8, padding: '10px 14px', textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: c as string }}>{v as number}</div>
                <div className="intel-stat-label" style={{ marginBottom: 0, marginTop: 2 }}>{l as string}</div>
              </div>
            ))}
          </div>

          {/* Coverage bar */}
          <div className="intel-panel" style={{ padding: '12px 16px', marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span className="section-label" style={{ margin: 0 }}>UI Coverage</span>
              <span style={{ fontWeight: 800, color: coverage > 70 ? 'var(--emerald)' : coverage > 40 ? 'var(--amber)' : 'var(--rose)' }}>{coverage}%</span>
            </div>
            <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, display: 'flex', overflow: 'hidden' }}>
              {(['CONNECTED', 'ADMIN', 'INTERNAL', 'ORPHAN'] as Classification[]).map(cls => (
                <div key={cls} style={{ height: '100%', width: `${all.length > 0 ? (counts[cls] / all.length) * 100 : 0}%`, background: CLS_HEX[cls] }} />
              ))}
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
              {(['CONNECTED', 'ADMIN', 'INTERNAL', 'ORPHAN'] as Classification[]).map(cls => (
                <div key={cls} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: CLS_HEX[cls] }} />
                  <span style={{ fontSize: 10, color: 'var(--muted)' }}>{cls} {counts[cls]}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Tab bar */}
          <div className="tab-bar">
            {([
              { key: 'orphans',   label: `⚠ Orphans`,          count: orphans.length   },
              { key: 'missing',   label: `⊘ Missing Bindings`, count: missing.length   },
              { key: 'generated', label: `✦ Generated Tools`,  count: generated.length },
              { key: 'registry',  label: `◎ Full Registry`,    count: all.length       },
            ] as { key: AuditTab; label: string; count: number }[]).map(t => (
              <button key={t.key} className={`tab-btn${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>
                {t.label}
                {t.count > 0 && <span style={{ marginLeft: 5, fontSize: 9, opacity: 0.7, fontWeight: 700 }}>{t.count}</span>}
              </button>
            ))}
          </div>

          {/* ── ORPHANS TAB ── */}
          {tab === 'orphans' && (
            <div className="intel-panel">
              {/* Table header */}
              <div style={{ display: 'grid', gridTemplateColumns: '55px 1fr auto 160px', gap: 10, padding: '7px 14px', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                {['Method', 'Path · Label · Module', 'Suggested Action', 'Resolve'].map(h => (
                  <div key={h} style={{ fontSize: 9, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</div>
                ))}
              </div>
              <div className="scroll-pane" style={{ maxHeight: 'calc(100vh - 520px)' }}>
                {orphans.length === 0 ? (
                  <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>✓</div>
                    <div style={{ fontSize: 13, color: 'var(--emerald)', fontWeight: 700 }}>No orphan endpoints</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>Every non-internal endpoint is connected to the UI.</div>
                  </div>
                ) : (
                  orphans
                    .filter(ep => !resolvedPaths.has(`${ep.method}:${ep.path}`))
                    .map((ep, i) => <OrphanRow key={`${ep.method}-${ep.path}-${i}`} ep={ep} onResolved={handleResolved} />)
                )}
              </div>
            </div>
          )}

          {/* ── MISSING BINDINGS TAB ── */}
          {tab === 'missing' && (
            <div className="intel-panel">
              <div style={{ display: 'grid', gridTemplateColumns: '55px 1fr auto 160px', gap: 10, padding: '7px 14px', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                {['Method', 'Path · Label', 'Client Fn', 'Resolve'].map(h => (
                  <div key={h} style={{ fontSize: 9, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</div>
                ))}
              </div>
              <div className="scroll-pane" style={{ maxHeight: 'calc(100vh - 520px)' }}>
                {missing.length === 0 ? (
                  <div style={{ padding: '40px 20px', textAlign: 'center', fontSize: 13, color: 'var(--muted)' }}>No missing UI bindings detected.</div>
                ) : (
                  missing.map((ep, i) => {
                    const mh = METHOD_HEX[ep.method] ?? '#888';
                    return (
                      <div key={i} style={{ display: 'grid', gridTemplateColumns: '55px 1fr auto 160px', gap: 10, padding: '10px 14px', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
                        <span className="badge" style={{ color: mh, background: `${mh}14` }}>{ep.method}</span>
                        <div>
                          <code style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--purple)' }}>{ep.path}</code>
                          <div style={{ fontSize: 10, color: 'var(--muted)' }}>{ep.label}</div>
                        </div>
                        <code style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--amber)' }}>{ep.clientFn ?? '—'}</code>
                        <ResolveButton ep={ep} onResolved={handleResolved} />
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* ── GENERATED TOOLS TAB ── */}
          {tab === 'generated' && (
            <div className="intel-panel">
              {generated.length === 0 ? (
                <div style={{ padding: '48px 24px', textAlign: 'center' }}>
                  <div style={{ fontSize: 32, marginBottom: 10 }}>✦</div>
                  <div style={{ fontSize: 14, color: 'var(--sub)', fontWeight: 600 }}>No auto-generated tools yet</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>
                    Click <strong style={{ color: 'var(--indigo-l)' }}>✦ Generate UI</strong> on any orphan endpoint to auto-create a viewer page.
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', fontSize: 11, color: 'var(--muted)' }}>
                    {generated.length} tool{generated.length !== 1 ? 's' : ''} auto-generated · accessible at <code style={{ fontFamily: 'var(--mono)', color: 'var(--indigo-l)' }}>/system-generated/[name]</code>
                  </div>
                  {generated.map(tool => (
                    <div key={tool.name} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>✦</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{tool.label}</div>
                        <div style={{ display: 'flex', gap: 6, marginTop: 3 }}>
                          <code style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--purple)' }}>{tool.method} {tool.endpointPath}</code>
                          <span className="badge tag-indigo">{tool.uiType}</span>
                          <span style={{ fontSize: 10, color: 'var(--muted)' }}>{tool.module}</span>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <Link href={`/system-generated/${tool.name}`}
                          style={{ display: 'inline-block', padding: '4px 12px', borderRadius: 6, background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)', color: 'var(--indigo-l)', fontSize: 11, fontWeight: 700, textDecoration: 'none' }}>
                          Open →
                        </Link>
                        <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>
                          {new Date(tool.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {/* ── FULL REGISTRY TAB ── */}
          {tab === 'registry' && (
            <>
              {/* Filters */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
                <input type="text" placeholder="Search path, label, module…" value={search} onChange={e => setSearch(e.target.value)}
                  style={{ flex: '1 1 200px', padding: '7px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text)', fontSize: 12, fontFamily: 'inherit', outline: 'none' }} />
                <div style={{ display: 'flex', gap: 4 }}>
                  {(['ALL', 'CONNECTED', 'ADMIN', 'INTERNAL', 'ORPHAN'] as const).map(c => (
                    <button key={c} onClick={() => setFilterClass(c)}
                      style={{ padding: '5px 9px', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', fontSize: 10, fontWeight: filterClass === c ? 700 : 500, background: filterClass === c ? `${CLS_HEX[c as Classification] ?? '#888'}18` : 'transparent', border: `1px solid ${filterClass === c ? (CLS_HEX[c as Classification] ?? '#888') + '44' : 'var(--border)'}`, color: filterClass === c ? (CLS_COLOR[c as Classification] ?? 'var(--muted)') : 'var(--muted)' }}>
                      {c}
                    </button>
                  ))}
                </div>
                <select value={filterMod} onChange={e => setFilterMod(e.target.value)}
                  style={{ padding: '6px 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--muted)', fontSize: 12, fontFamily: 'inherit', cursor: 'pointer' }}>
                  {modules.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 'auto' }}>{visible.length} shown</span>
              </div>

              {/* Table */}
              <div className="intel-panel">
                <div style={{ display: 'grid', gridTemplateColumns: '70px 55px 1fr 130px 110px 110px', gap: 8, padding: '7px 14px', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                  {['Status', 'Method', 'Path · Label', 'Module', 'UI Exposure', 'Client Fn'].map(h => (
                    <div key={h} style={{ fontSize: 9, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</div>
                  ))}
                </div>
                <div className="scroll-pane" style={{ maxHeight: 'calc(100vh - 520px)' }}>
                  {visible.map(({ ep, cls }, i) => {
                    const mh = METHOD_HEX[ep.method] ?? '#888';
                    const cc = CLS_COLOR[cls];
                    const ch = CLS_HEX[cls];
                    return (
                      <div key={`${ep.method}-${ep.path}-${i}`} style={{ display: 'grid', gridTemplateColumns: '70px 55px 1fr 130px 110px 110px', gap: 8, padding: '8px 14px', borderBottom: '1px solid var(--border)', alignItems: 'center', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                        <span className="badge" style={{ color: cc, background: `${ch}14` }}>{cls}</span>
                        <span className="badge" style={{ color: mh, background: `${mh}14` }}>{ep.method}</span>
                        <div style={{ minWidth: 0 }}>
                          <code style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--purple)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ep.path}</code>
                          <div style={{ fontSize: 10, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ep.label}</div>
                        </div>
                        <span style={{ fontSize: 10, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ep.module}</span>
                        <span style={{ fontSize: 9, fontWeight: 600, color: ep.uiExposure === 'VISIBLE_UI' ? 'var(--emerald)' : ep.uiExposure === 'ADMIN_UI' ? 'var(--indigo)' : 'var(--muted)' }}>{ep.uiExposure}</span>
                        {ep.clientFn ? <code style={{ fontSize: 9, fontFamily: 'var(--mono)', color: 'var(--indigo-l)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ep.clientFn}</code> : <span style={{ fontSize: 9, color: 'var(--border)', fontStyle: 'italic' }}>NOT WIRED</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

        </div>
      </main>
    </div>
  );
}
