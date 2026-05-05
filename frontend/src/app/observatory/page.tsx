'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  getEvolutionStatus,
  getEvolutionHealth,
  getEvolutionLog,
  getEvolutionMutations,
  runEvolutionCycle,
  forceMutateAngle,
  listAngles,
  type AngleDefinition,
} from '@/lib/api/creator-client';

// ── Types ─────────────────────────────────────────────────────────────────────

interface EvolutionStatus {
  totalMutations:  number;
  activeMutations: number;
  prunedAngles:    number;
  champions:       number;
  lastCycleAt:     string | null;
}
interface EvolutionHealth { angleSlug: string; status: string; avgScore?: number; [k: string]: unknown; }
interface EvolutionLogEntry { id: string; event: string; angleSlug: string; reason: string; createdAt: string; }
interface MutationEntry { id: string; parentSlug: string; mutantSlug: string; mutationReason: string; status: string; avgPerfScore?: number; createdAt: string; }

function healthColor(s: string) {
  const v = (s ?? '').toLowerCase();
  if (v === 'champion')  return '#22c55e';
  if (v === 'healthy')   return '#6366f1';
  if (v === 'optimizing' || v === 'active') return '#f59e0b';
  if (v === 'weak' || v === 'at-risk')      return '#f87171';
  return '#555';
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

type Tab = 'live' | 'decisions' | 'analytics' | 'engine';

export default function ObservatoryPage() {
  const [tab,     setTab]     = useState<Tab>('live');
  const [proMode, setProMode] = useState(false);

  useEffect(() => {
    setProMode(localStorage.getItem('obs_pro_mode') === '1');
  }, []);

  function togglePro() {
    setProMode(v => {
      const next = !v;
      localStorage.setItem('obs_pro_mode', next ? '1' : '0');
      return next;
    });
  }

  return (
        <div className="page-content">
          <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h1 className="page-title">◎ Observatory</h1>
              <p className="page-sub">Live AI decision observability — system diagnostics.</p>
            </div>
            <button
              onClick={togglePro}
              style={{
                fontSize: 12, fontWeight: 700,
                color:      proMode ? '#a5b4fc' : '#444',
                background: proMode ? 'rgba(99,102,241,0.12)' : 'transparent',
                border:     `1px solid ${proMode ? '#6366f1' : '#1e2330'}`,
                borderRadius: 6, padding: '5px 14px',
                cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
              }}
            >
              ⚡ Pro Mode: {proMode ? 'ON' : 'OFF'}
            </button>
          </div>

          {/* Tab bar */}
          <div className="tab-underline-strip">
            {([
              ['live',      '⚡ Live'],
              ['decisions', '● Decisions'],
              ['analytics', '▦ Analytics'],
              ['engine',    '🧬 Engine'],
            ] as [Tab, string][]).map(([t, label]) => (
              <button
                key={t}
                className={`tab-underline${tab === t ? ' active' : ''}`}
                onClick={() => setTab(t)}
                style={t === 'engine' ? { color: tab === t ? '#a5b4fc' : '#555' } : undefined}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Live tab */}
          {tab === 'live' && (
            <>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Live AI Dashboard</h2>
              <p style={{ fontSize: 13, color: 'var(--sub)', marginBottom: 20 }}>Real-time decision observability</p>
              <div className="obs-stats-grid">
                {['System', 'Active Angles', 'Learning', 'Signals'].map(label => (
                  <div key={label} className="obs-stat-card">
                    <div className="obs-stat-label">{label}</div>
                    <div className="obs-stat-value">—</div>
                  </div>
                ))}
              </div>
              <div className="obs-ready-panel">
                <div className="obs-ready-icon">⚡</div>
                <div className="obs-ready-title">System ready</div>
                <p className="obs-ready-sub">Run a campaign to see live intelligence here.</p>
              </div>
            </>
          )}

          {/* Decisions tab */}
          {tab === 'decisions' && (
            <div style={{ padding: '40px 0', textAlign: 'center', color: '#444', fontSize: 14 }}>
              Decision log coming soon.
            </div>
          )}

          {/* Analytics tab */}
          {tab === 'analytics' && (
            <div style={{ padding: '40px 0', textAlign: 'center', color: '#444', fontSize: 14 }}>
              See the <a href="/analytics" style={{ color: '#6366f1' }}>Analytics page</a> for full angle performance data.
            </div>
          )}

          {/* Engine tab — gated */}
          {tab === 'engine' && (
            proMode
              ? <EvolutionDiagnosticsPanel />
              : <EvolutionLockedState onEnable={togglePro} />
          )}
        </div>
      </main>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ── Locked State ──────────────────────────────────────────────────────────────

function EvolutionLockedState({ onEnable }: { onEnable: () => void }) {
  return (
    <div style={{ background: '#0d0e14', border: '1px solid #1e2330', borderRadius: 14, padding: '56px 32px', textAlign: 'center', marginTop: 20 }}>
      <div style={{ fontSize: 40, marginBottom: 16, opacity: 0.25 }}>🧬</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: '#555', marginBottom: 8 }}>Evolution Engine Diagnostics</div>
      <p style={{ fontSize: 13, color: '#333', lineHeight: 1.7, maxWidth: 400, margin: '0 auto 24px' }}>
        View angle mutation history, evolution cycles, system health, and run advanced controls.
        Requires Pro Mode.
      </p>
      <button
        onClick={onEnable}
        style={{ padding: '10px 28px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
      >
        Enable Pro Mode →
      </button>
    </div>
  );
}

// ── Evolution Diagnostics Panel ───────────────────────────────────────────────

function EvolutionDiagnosticsPanel() {
  const [subTab, setSubTab] = useState<'status' | 'log' | 'mutations' | 'controls'>('status');

  const [status,    setStatus]    = useState<EvolutionStatus | null>(null);
  const [health,    setHealth]    = useState<EvolutionHealth[]>([]);
  const [log,       setLog]       = useState<EvolutionLogEntry[]>([]);
  const [mutations, setMutations] = useState<MutationEntry[]>([]);
  const [angles,    setAngles]    = useState<AngleDefinition[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);

  const [cycleRunning, setCycleRunning] = useState(false);
  const [cycleResult,  setCycleResult]  = useState<string | null>(null);
  const [mutateSlug,   setMutateSlug]   = useState('');
  const [mutateScore,  setMutateScore]  = useState('0.30');
  const [mutating,     setMutating]     = useState(false);
  const [mutateResult, setMutateResult] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [s, h, l, m, a] = await Promise.all([
        getEvolutionStatus()    as Promise<EvolutionStatus>,
        getEvolutionHealth()    as unknown as Promise<EvolutionHealth[]>,
        getEvolutionLog(30)     as Promise<EvolutionLogEntry[]>,
        getEvolutionMutations() as Promise<MutationEntry[]>,
        listAngles().catch(() => [] as AngleDefinition[]),
      ]);
      setStatus(s);
      setHealth(Array.isArray(h) ? h : []);
      setLog(Array.isArray(l)   ? l : []);
      setMutations(Array.isArray(m) ? m : []);
      setAngles(a);
    } catch (e) { setError((e as Error).message); }
    finally     { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleRunCycle() {
    if (cycleRunning) return;
    setCycleRunning(true); setCycleResult(null);
    try {
      const r = await runEvolutionCycle() as { cycleId?: string; evaluated?: number; mutated?: string[]; promoted?: string[] };
      const parts = [
        r.cycleId            ? `Cycle ${r.cycleId.slice(0, 8)}` : null,
        r.evaluated != null  ? `${r.evaluated} evaluated`        : null,
        r.mutated?.length    ? `${r.mutated.length} mutated`     : null,
        r.promoted?.length   ? `${r.promoted.length} promoted`   : null,
      ].filter(Boolean);
      setCycleResult(parts.length ? parts.join(' · ') : 'Cycle complete');
      await load();
    } catch (e) { setCycleResult(`Error: ${(e as Error).message}`); }
    finally { setCycleRunning(false); }
  }

  async function handleForceMutate() {
    if (!mutateSlug || mutating) return;
    setMutating(true); setMutateResult(null);
    try {
      await forceMutateAngle(mutateSlug, parseFloat(mutateScore) || 0.30);
      setMutateResult(`Mutation triggered for "${mutateSlug}"`);
      setMutateSlug('');
      await load();
    } catch (e) { setMutateResult(`Error: ${(e as Error).message}`); }
    finally { setMutating(false); }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '48px 0', color: '#555', fontSize: 13 }}>
        <div style={{ width: 16, height: 16, border: '2px solid #1e2330', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        Loading Evolution Engine…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ marginTop: 20, background: '#1a0a0a', border: '1px solid #3a1010', borderRadius: 10, padding: '16px 20px', color: '#f87171', fontSize: 13, display: 'flex', alignItems: 'center', gap: 12 }}>
        ⚠ {error}
        <button onClick={load} style={{ fontSize: 11, color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline' }}>Retry</button>
      </div>
    );
  }

  const card: React.CSSProperties = { background: '#0d0e14', border: '1px solid #1e2330', borderRadius: 12, overflow: 'hidden' };
  const cardHdr: React.CSSProperties = { padding: '11px 16px', borderBottom: '1px solid #1e2330', fontSize: 11, fontWeight: 700, color: '#444', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
  const row: React.CSSProperties = { padding: '10px 16px', borderTop: '1px solid #0f1018', display: 'flex', alignItems: 'center', gap: 12 };

  return (
    <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Sub-tab bar */}
      <div style={{ display: 'flex', gap: 4, background: '#080910', borderRadius: 9, padding: 3, width: 'fit-content', border: '1px solid #1e2330' }}>
        {([
          ['status',   '◎ Status'],
          ['log',      '📋 Event Log'],
          ['mutations','🧬 Mutations'],
          ['controls', '⚡ Controls'],
        ] as const).map(([t, label]) => (
          <button key={t} onClick={() => setSubTab(t)} style={{ padding: '6px 14px', borderRadius: 7, border: 'none', fontWeight: 600, fontSize: 11, background: subTab === t ? '#1e2330' : 'transparent', color: subTab === t ? '#a5b4fc' : '#555', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Status & Health ── */}
      {subTab === 'status' && (
        <>
          {status && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 10 }}>
              {[
                { label: 'Total Mutations',  value: status.totalMutations  ?? 0 },
                { label: 'Active',           value: status.activeMutations ?? 0 },
                { label: 'Champions',        value: status.champions       ?? 0 },
                { label: 'Pruned',           value: status.prunedAngles    ?? 0 },
              ].map(t => (
                <div key={t.label} style={{ background: '#0d0e14', border: '1px solid #1e2330', borderRadius: 10, padding: '14px 16px' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#444', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>{t.label}</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: '#f0f0f0', lineHeight: 1 }}>{t.value}</div>
                </div>
              ))}
            </div>
          )}
          {status?.lastCycleAt && (
            <div style={{ fontSize: 11, color: '#444' }}>
              Last cycle: <span style={{ color: '#555' }}>{new Date(status.lastCycleAt).toLocaleString()}</span>
            </div>
          )}
          {health.length > 0 && (
            <div style={card}>
              <div style={cardHdr}><span>Angle Health</span><span style={{ fontWeight: 400, color: '#333' }}>{health.length} angles</span></div>
              {health.map((h, i) => (
                <div key={h.angleSlug} style={{ ...row, borderTop: i === 0 ? undefined : '1px solid #0f1018' }}>
                  <span style={{ fontSize: 12, color: '#888', flex: 1, textTransform: 'capitalize' }}>{h.angleSlug.replace(/-/g, ' ')}</span>
                  {typeof h.avgScore === 'number' && <span style={{ fontSize: 11, color: '#444' }}>{Math.round(h.avgScore * 100)}/100</span>}
                  <span style={{ fontSize: 10, fontWeight: 700, color: healthColor(h.status), background: `${healthColor(h.status)}18`, padding: '2px 9px', borderRadius: 99, textTransform: 'capitalize' }}>{h.status}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Event Log ── */}
      {subTab === 'log' && (
        <div style={card}>
          <div style={cardHdr}><span>Recent Evolution Events</span><span style={{ fontWeight: 400, color: '#333' }}>{log.length} entries</span></div>
          {log.length === 0 && <div style={{ padding: '24px', fontSize: 13, color: '#333', textAlign: 'center' }}>No events yet.</div>}
          {log.map((entry, i) => (
            <div key={entry.id} style={{ ...row, borderTop: i === 0 ? undefined : '1px solid #0f1018', alignItems: 'flex-start' }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#6366f1', background: 'rgba(99,102,241,0.08)', padding: '2px 8px', borderRadius: 99, flexShrink: 0, marginTop: 2 }}>{entry.event}</span>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#a5b4fc', textTransform: 'capitalize' }}>{entry.angleSlug.replace(/-/g, ' ')}</span>
                {entry.reason && <div style={{ fontSize: 11, color: '#555', marginTop: 2, lineHeight: 1.5 }}>{entry.reason}</div>}
              </div>
              <span style={{ fontSize: 10, color: '#333', flexShrink: 0 }}>{new Date(entry.createdAt).toLocaleTimeString()}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Mutations ── */}
      {subTab === 'mutations' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {mutations.length === 0 && <div style={{ ...card, padding: '24px', fontSize: 13, color: '#333', textAlign: 'center' }}>No mutations recorded yet.</div>}
          {mutations.map(m => (
            <div key={m.id} style={{ ...card, padding: '14px 16px' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#f0f0f0', textTransform: 'capitalize' }}>{m.parentSlug.replace(/-/g, ' ')}</span>
                <span style={{ fontSize: 11, color: '#444' }}>→</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#a5b4fc', textTransform: 'capitalize' }}>{m.mutantSlug.replace(/-/g, ' ')}</span>
                <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, color: healthColor(m.status), background: `${healthColor(m.status)}18`, padding: '2px 9px', borderRadius: 99, textTransform: 'capitalize' }}>{m.status}</span>
              </div>
              {m.mutationReason && <div style={{ fontSize: 12, color: '#555', lineHeight: 1.55, marginBottom: 6 }}>{m.mutationReason}</div>}
              <div style={{ display: 'flex', gap: 12 }}>
                {typeof m.avgPerfScore === 'number' && <span style={{ fontSize: 11, color: '#444' }}>Score: <span style={{ color: '#888', fontWeight: 600 }}>{Math.round(m.avgPerfScore * 100)}</span></span>}
                <span style={{ fontSize: 10, color: '#333' }}>{new Date(m.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Advanced Controls ── */}
      {subTab === 'controls' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.18)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#92400e' }}>
            ⚠ Advanced / Experimental — these actions modify the learning system directly. Results are immediate.
          </div>

          {/* Run Evolution Cycle */}
          <div style={{ ...card, padding: '18px 20px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#f0f0f0', marginBottom: 4 }}>Run Evolution Cycle</div>
            <p style={{ fontSize: 12, color: '#444', margin: '0 0 14px', lineHeight: 1.6 }}>
              Re-evaluates all angles, promotes champions, prunes underperformers, and triggers mutations where performance is low.
            </p>
            <button
              onClick={handleRunCycle}
              disabled={cycleRunning}
              style={{ padding: '9px 20px', background: cycleRunning ? '#1e2330' : '#6366f1', color: cycleRunning ? '#555' : '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: cycleRunning ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 8, transition: 'all 0.15s' }}
            >
              {cycleRunning
                ? <><span style={{ width: 12, height: 12, border: '2px solid #333', borderTopColor: '#6366f1', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />Running…</>
                : '🔁 Run Evolution Cycle'}
            </button>
            {cycleResult && (
              <FeedbackBox text={cycleResult} />
            )}
          </div>

          {/* Force Mutate */}
          <div style={{ ...card, padding: '18px 20px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#f0f0f0', marginBottom: 4 }}>Force Angle Mutation</div>
            <p style={{ fontSize: 12, color: '#444', margin: '0 0 14px', lineHeight: 1.6 }}>
              Manually trigger a mutation for a specific angle below a given performance score threshold.
            </p>
            <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: 2, minWidth: 160 }}>
                <CtrlLabel>Angle</CtrlLabel>
                <select value={mutateSlug} onChange={e => setMutateSlug(e.target.value)} style={selectStyle}>
                  <option value="">— select angle —</option>
                  {(angles.length > 0 ? angles.map(a => ({ slug: a.slug, label: a.label })) : health.map(h => ({ slug: h.angleSlug, label: h.angleSlug.replace(/-/g, ' ') })))
                    .map(a => <option key={a.slug} value={a.slug}>{a.label}</option>)}
                </select>
              </div>
              <div style={{ flex: 1, minWidth: 100 }}>
                <CtrlLabel>Score threshold (0–1)</CtrlLabel>
                <input type="number" min="0" max="1" step="0.05" value={mutateScore} onChange={e => setMutateScore(e.target.value)} style={{ ...selectStyle, fontFamily: 'inherit' }} />
              </div>
            </div>
            <button
              onClick={handleForceMutate}
              disabled={!mutateSlug || mutating}
              style={{ padding: '9px 20px', background: !mutateSlug || mutating ? '#1e2330' : 'rgba(245,158,11,0.1)', color: !mutateSlug || mutating ? '#444' : '#f59e0b', border: `1px solid ${!mutateSlug || mutating ? '#1e2330' : 'rgba(245,158,11,0.25)'}`, borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: !mutateSlug || mutating ? 'not-allowed' : 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}
            >
              {mutating ? 'Mutating…' : '🧬 Force Mutate Angle'}
            </button>
            {mutateResult && <FeedbackBox text={mutateResult} />}
          </div>

          <button onClick={load} style={{ alignSelf: 'flex-start', fontSize: 11, color: '#444', background: 'none', border: '1px solid #1e2330', borderRadius: 6, padding: '5px 14px', cursor: 'pointer', fontFamily: 'inherit' }}>
            ↺ Refresh data
          </button>
        </div>
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function CtrlLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 10, fontWeight: 700, color: '#444', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>{children}</div>;
}

function FeedbackBox({ text }: { text: string }) {
  const isError = text.startsWith('Error');
  return (
    <div style={{ marginTop: 10, fontSize: 12, color: isError ? '#f87171' : '#22c55e', background: isError ? 'rgba(248,113,113,0.06)' : 'rgba(34,197,94,0.06)', border: `1px solid ${isError ? 'rgba(248,113,113,0.2)' : 'rgba(34,197,94,0.2)'}`, borderRadius: 6, padding: '7px 12px' }}>
      {text}
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px',
  background: '#111', border: '1px solid #1e2330',
  borderRadius: 7, color: '#f0f0f0', fontSize: 13, cursor: 'pointer',
  boxSizing: 'border-box',
};
