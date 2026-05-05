'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { getGeneratedTool, type GeneratedToolConfig } from '@/lib/api/creator-client';

const METHOD_HEX: Record<string, string> = {
  GET: '#10b981', POST: '#6366f1', PATCH: '#f59e0b', PUT: '#f59e0b', DELETE: '#ef4444',
};

// ─── Render panels based on uiType ────────────────────────────────────────────

function MetricPanel({ config }: { config: GeneratedToolConfig }) {
  const [data, setData] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (config.method !== 'GET') { setLoading(false); return; }
    fetch(config.endpointPath, { headers: { 'x-user-id': 'system-generated' } })
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [config.endpointPath, config.method]);

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
      <div className="spin" style={{ width: 24, height: 24, border: '2px solid var(--border)', borderTopColor: 'var(--indigo)', borderRadius: '50%' }} />
    </div>
  );

  if (error) return <div style={{ color: 'var(--rose)', fontSize: 12, padding: 16 }}>⚠ {error}</div>;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
      {data && typeof data === 'object' && !Array.isArray(data) ? (
        Object.entries(data as Record<string, unknown>).slice(0, 12).map(([k, v]) => (
          <div key={k} className="intel-stat-card">
            <div className="intel-stat-label">{k}</div>
            <div className="intel-stat-value" style={{ fontSize: 16, color: 'var(--indigo-l)', wordBreak: 'break-all' }}>
              {typeof v === 'boolean' ? (v ? '✓' : '✗') : String(v ?? '—').slice(0, 24)}
            </div>
          </div>
        ))
      ) : (
        <pre style={{ fontSize: 11, color: 'var(--indigo-l)', fontFamily: 'var(--mono)', background: 'var(--surface-2)', padding: 12, borderRadius: 8, overflow: 'auto', gridColumn: '1 / -1' }}>
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}

function DataPanel({ config }: { config: GeneratedToolConfig }) {
  const [data, setData] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (config.method !== 'GET') { setLoading(false); return; }
    fetch(config.endpointPath, { headers: { 'x-user-id': 'system-generated' } })
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [config.endpointPath, config.method]);

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
      <div className="spin" style={{ width: 24, height: 24, border: '2px solid var(--border)', borderTopColor: 'var(--indigo)', borderRadius: '50%' }} />
    </div>
  );

  if (error) return <div style={{ color: 'var(--rose)', fontSize: 12, padding: 16 }}>⚠ {error}</div>;

  const rows = Array.isArray(data) ? data : (data && typeof data === 'object' ? [data] : []);

  return (
    <div>
      {rows.length === 0 ? (
        <div style={{ padding: '40px 20px', textAlign: 'center', fontSize: 12, color: 'var(--muted)' }}>No data returned.</div>
      ) : (
        <>
          {/* Column headers */}
          {rows.length > 0 && typeof rows[0] === 'object' && rows[0] !== null && (
            <div style={{ display: 'flex', gap: 8, padding: '6px 14px', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
              {Object.keys(rows[0] as object).slice(0, 6).map(k => (
                <span key={k} style={{ flex: 1, fontSize: 9, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{k}</span>
              ))}
            </div>
          )}
          {rows.slice(0, 50).map((row, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, padding: '8px 14px', borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
              {typeof row === 'object' && row !== null ? (
                Object.values(row as object).slice(0, 6).map((v, j) => (
                  <span key={j} style={{ flex: 1, fontSize: 11, color: 'var(--sub)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {String(v ?? '—').slice(0, 40)}
                  </span>
                ))
              ) : (
                <span style={{ flex: 1, fontSize: 11, color: 'var(--sub)' }}>{String(row)}</span>
              )}
            </div>
          ))}
          {rows.length > 50 && (
            <div style={{ padding: '8px 14px', fontSize: 11, color: 'var(--muted)', textAlign: 'center' }}>… and {rows.length - 50} more</div>
          )}
        </>
      )}
    </div>
  );
}

function ActionPanel({ config }: { config: GeneratedToolConfig }) {
  const [payload,  setPayload]  = useState('{}');
  const [response, setResponse] = useState<unknown>(null);
  const [busy,     setBusy]     = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  async function handleRun() {
    setBusy(true);
    setError(null);
    try {
      const body = payload.trim() ? JSON.parse(payload) : {};
      const r = await fetch(config.endpointPath, {
        method: config.method,
        headers: { 'Content-Type': 'application/json', 'x-user-id': 'system-generated' },
        body: JSON.stringify(body),
      });
      setResponse(await r.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <div className="section-label">Request Body (JSON)</div>
        <textarea value={payload} onChange={e => setPayload(e.target.value)}
          style={{ width: '100%', minHeight: 100, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: 12, color: 'var(--text)', fontSize: 12, fontFamily: 'var(--mono)', resize: 'vertical', outline: 'none' }} />
      </div>
      <div>
        <button onClick={handleRun} disabled={busy}
          style={{ padding: '8px 20px', borderRadius: 8, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.4)', color: 'var(--indigo-l)', fontWeight: 700, fontSize: 12, cursor: busy ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: busy ? 0.5 : 1 }}>
          {busy ? '…' : `▶ Run ${config.method} ${config.endpointPath}`}
        </button>
      </div>
      {error && <div style={{ color: 'var(--rose)', fontSize: 11 }}>⚠ {error}</div>}
      {response !== null && (
        <pre style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: 12, fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--emerald)', overflow: 'auto', maxHeight: 300 }}>
          {JSON.stringify(response, null, 2)}
        </pre>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function GeneratedToolPage() {
  const params = useParams<{ name: string }>();
  const name   = params?.name ?? '';

  const [config,  setConfig]  = useState<GeneratedToolConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    if (!name) return;
    getGeneratedTool(name)
      .then(c => { setConfig(c); setLoading(false); })
      .catch(e => { setError(e instanceof Error ? e.message : 'Not found'); setLoading(false); });
  }, [name]);

  return (
        <div className="page-content">

          {/* Breadcrumb */}
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Link href="/system-audit" style={{ color: 'var(--indigo-l)', textDecoration: 'none' }}>System Audit</Link>
            <span>›</span>
            <span>Generated</span>
            <span>›</span>
            <code style={{ fontFamily: 'var(--mono)', color: 'var(--sub)' }}>{name}</code>
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
              <div className="spin" style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--indigo)', borderRadius: '50%' }} />
            </div>
          ) : error ? (
            <div style={{ textAlign: 'center', padding: 60 }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>⚠</div>
              <div style={{ fontSize: 14, color: 'var(--rose)', fontWeight: 700 }}>Tool not found</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>{error}</div>
              <Link href="/system-audit" style={{ display: 'inline-block', marginTop: 16, fontSize: 12, color: 'var(--indigo-l)' }}>← Back to System Audit</Link>
            </div>
          ) : config ? (
            <>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 20 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>✦</div>
                <div>
                  <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: '0 0 4px 0' }}>{config.label}</h1>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span className="badge" style={{ color: METHOD_HEX[config.method] ?? '#888', background: `${METHOD_HEX[config.method] ?? '#888'}14` }}>{config.method}</span>
                    <code style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--purple)' }}>{config.endpointPath}</code>
                    <span className="badge tag-indigo">{config.uiType}</span>
                    <span style={{ fontSize: 10, color: 'var(--muted)' }}>{config.module}</span>
                    <span style={{ fontSize: 10, color: 'var(--muted)', marginLeft: 'auto' }}>Generated {new Date(config.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              {/* ── Auto-Generated UI Panel ── */}
              <div className="intel-panel">
                <div className="intel-panel-header">
                  <span className="section-label" style={{ margin: 0 }}>
                    {config.uiType === 'metric'  ? '📊 Metrics'
                     : config.uiType === 'action' ? '▶ Action Runner'
                     : config.uiType === 'stream' ? '📡 Stream Viewer'
                     : '📋 Data Panel'}
                  </span>
                  <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--muted)', fontStyle: 'italic' }}>Auto-generated by System Audit</span>
                </div>
                <div style={{ padding: 16 }}>
                  {config.method === 'GET' && (config.uiType === 'metric' || config.uiType === 'toggle')
                    ? <MetricPanel config={config} />
                    : config.method === 'GET'
                    ? <DataPanel config={config} />
                    : <ActionPanel config={config} />
                  }
                </div>
              </div>

              {/* Raw config */}
              <details style={{ marginTop: 16 }}>
                <summary style={{ fontSize: 11, color: 'var(--muted)', cursor: 'pointer', userSelect: 'none' }}>View raw config</summary>
                <pre style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--indigo-l)', background: 'var(--surface-2)', padding: 12, borderRadius: 8, overflow: 'auto', marginTop: 8 }}>
                  {JSON.stringify(config, null, 2)}
                </pre>
              </details>
            </>
          ) : null}

        </div>
  );
}
