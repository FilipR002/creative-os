'use client';
// ─── Observatory Panel — admin-only tab embedded in product dashboard ──────────

import { useState } from 'react';
import { LiveDashboard }        from '@/components/LiveDashboard';
import { ExecutionStreamCard }  from '@/components/ExecutionStreamCard';
import { ExecutionTimeline }    from '@/components/ExecutionTimeline';
import { FatigueBadge }         from '@/components/FatigueBadge';
import { SignalBreakdownBars }  from '@/components/SignalBreakdownBars';
import { useExecution }         from '@/lib/hooks/useExecution';
import { runDecision, fetchMemory } from '@/lib/api/client';
import type { DecisionPageViewModel, MemorySnapshot } from '@/lib/types/view-models';

type ObsTab = 'live' | 'decisions' | 'analytics' | 'experiments';

export function ObservatoryPanel() {
  const [tab, setTab] = useState<ObsTab>('live');

  return (
    <div style={{ marginTop: 8 }}>
      {/* Sub-tab bar */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 28, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {([
          ['live',        '⚡ Live'],
          ['decisions',   '🧠 Decisions'],
          ['analytics',   '📊 Analytics'],
          ['experiments', '🧪 Experiments'],
        ] as [ObsTab, string][]).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '8px 18px',
              background: 'none',
              border: 'none',
              borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
              color: tab === t ? 'var(--accent)' : 'var(--muted)',
              fontWeight: tab === t ? 700 : 500,
              fontSize: 13,
              cursor: 'pointer',
              transition: 'color 0.15s',
              marginBottom: -1,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'live'        && <LiveTab />}
      {tab === 'decisions'   && <DecisionsTab />}
      {tab === 'analytics'   && <AnalyticsTab />}
      {tab === 'experiments' && <ExperimentsTab />}
    </div>
  );
}

// ── Live Dashboard tab ─────────────────────────────────────────────────────────
function LiveTab() {
  return (
    <div>
      <div className="page-header">
        <h2 className="page-title" style={{ fontSize: 18 }}>Live AI Dashboard</h2>
        <p className="page-sub">Real-time decision observability</p>
      </div>
      <LiveDashboard />
    </div>
  );
}

// ── Decisions tab ──────────────────────────────────────────────────────────────
function DecisionsTab() {
  const { state, running, run } = useExecution();
  const [clientId, setClientId] = useState('');
  const [goal,     setGoal]     = useState('');
  const [emotion,  setEmotion]  = useState('');
  const [format,   setFormat]   = useState('');
  const [error,    setError]    = useState<string | null>(null);

  async function handleRun() {
    if (!clientId.trim()) { setError('client_id is required'); return; }
    setError(null);
    await run({ client_id: clientId, goal: goal || undefined, emotion: emotion || undefined, format: format || undefined });
  }

  const isDone = state?.status === 'completed' || state?.status === 'failed';

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title" style={{ fontSize: 18 }}>Decisions</h2>
        <p className="page-sub">Watch the AI engine think in real time</p>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-title">Parameters</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
          {([
            ['Client ID *', clientId, setClientId],
            ['Goal',        goal,     setGoal],
            ['Emotion',     emotion,  setEmotion],
            ['Format',      format,   setFormat],
          ] as [string, string, (v: string) => void][]).map(([label, value, setter]) => (
            <div key={label}>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>{label}</label>
              <input
                value={value}
                onChange={e => setter(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !running && handleRun()}
                style={{ width: '100%', padding: '8px 10px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13 }}
              />
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={handleRun}
            disabled={running}
            style={{ padding: '8px 20px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: running ? 'not-allowed' : 'pointer', opacity: running ? 0.6 : 1 }}
          >
            {running ? 'Executing…' : state ? 'Run Again' : 'Run Decision'}
          </button>
          {state && !running && (
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>
              {state.executionId.slice(0, 8)}… · {state.durationMs != null ? `${state.durationMs}ms` : 'in progress'}
            </span>
          )}
        </div>
        {error && <p style={{ marginTop: 12, fontSize: 12, color: 'var(--danger)' }}>{error}</p>}
      </div>

      {state && (
        <div className="anim-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <ExecutionStreamCard state={state} />
          {isDone && state.timeline.length > 0 && (
            <ExecutionTimeline entries={state.timeline} startedAt={state.startedAt} />
          )}
        </div>
      )}
    </div>
  );
}

// ── Analytics tab ──────────────────────────────────────────────────────────────
function AnalyticsTab() {
  const [clientId, setClientId] = useState('');
  const [angle,    setAngle]    = useState('');
  const [snapshot, setSnapshot] = useState<MemorySnapshot | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  async function handleFetch() {
    if (!clientId.trim()) { setError('client_id is required'); return; }
    setLoading(true); setError(null);
    try {
      setSnapshot(await fetchMemory(clientId, undefined, angle || undefined));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title" style={{ fontSize: 18 }}>Analytics</h2>
        <p className="page-sub">Global memory snapshot and learning insights</p>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-title">Memory Query</div>
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          {([
            ['Client ID *', clientId, setClientId],
            ['Angle Slug',  angle,    setAngle],
          ] as [string, string, (v: string) => void][]).map(([label, value, setter]) => (
            <div key={label}>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>{label}</label>
              <input
                value={value}
                onChange={e => setter(e.target.value)}
                style={{ width: 200, padding: '8px 10px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13 }}
              />
            </div>
          ))}
        </div>
        <button
          onClick={handleFetch}
          disabled={loading}
          style={{ padding: '8px 20px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}
        >
          {loading ? 'Loading…' : 'Fetch Memory'}
        </button>
        {error && <p style={{ marginTop: 12, fontSize: 12, color: 'var(--danger)' }}>{error}</p>}
      </div>

      {snapshot && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {snapshot.insights.length > 0 && (
            <div className="card">
              <div className="card-title">Insights</div>
              <ul style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {snapshot.insights.map((ins, i) => (
                  <li key={i} style={{ fontSize: 13, lineHeight: 1.5 }}>{ins}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="grid-2">
            <div className="card">
              <div className="card-title">Angle Memory Updates ({(snapshot.angle_memory_updates as unknown[]).length})</div>
              <pre style={{ fontSize: 11, color: 'var(--muted)', overflow: 'auto', maxHeight: 200 }}>
                {JSON.stringify(snapshot.angle_memory_updates, null, 2)}
              </pre>
            </div>
            <div className="card">
              <div className="card-title">System Memory Updates ({(snapshot.system_memory_updates as unknown[]).length})</div>
              <pre style={{ fontSize: 11, color: 'var(--muted)', overflow: 'auto', maxHeight: 200 }}>
                {JSON.stringify(snapshot.system_memory_updates, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Experiments tab ────────────────────────────────────────────────────────────
function ExperimentsTab() {
  const [clientId, setClientId] = useState('');
  const [variantA, setVariantA] = useState('');
  const [variantB, setVariantB] = useState('');
  const [resultA,  setResultA]  = useState<DecisionPageViewModel | null>(null);
  const [resultB,  setResultB]  = useState<DecisionPageViewModel | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  async function handleCompare() {
    if (!clientId.trim()) { setError('client_id is required'); return; }
    setLoading(true); setError(null);
    try {
      const [a, b] = await Promise.all([
        runDecision({ client_id: clientId, goal: variantA || undefined }),
        runDecision({ client_id: clientId, goal: variantB || undefined }),
      ]);
      setResultA((a as any).viewModel ?? null);
      setResultB((b as any).viewModel ?? null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const primaryA = resultA?.angles.find(a => a.angle === resultA.primaryAngle);
  const primaryB = resultB?.angles.find(a => a.angle === resultB.primaryAngle);

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title" style={{ fontSize: 18 }}>A/B Experiments</h2>
        <p className="page-sub">Compare decision outcomes across goals or configurations</p>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-title">Experiment Setup</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
          {([
            ['Client ID *',    clientId, setClientId],
            ['Variant A Goal', variantA, setVariantA],
            ['Variant B Goal', variantB, setVariantB],
          ] as [string, string, (v: string) => void][]).map(([label, value, setter]) => (
            <div key={label}>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>{label}</label>
              <input
                value={value}
                onChange={e => setter(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13 }}
              />
            </div>
          ))}
        </div>
        <button
          onClick={handleCompare}
          disabled={loading}
          style={{ padding: '8px 20px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}
        >
          {loading ? 'Comparing…' : 'Run Comparison'}
        </button>
        {error && <p style={{ marginTop: 12, fontSize: 12, color: 'var(--danger)' }}>{error}</p>}
      </div>

      {resultA && resultB && primaryA && primaryB && (
        <>
          <div className="grid-2" style={{ marginBottom: 16 }}>
            {([['A', resultA, primaryA, variantA], ['B', resultB, primaryB, variantB]] as const).map(([label, result, primary, goal]) => (
              <div key={label} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                      Variant {label}{goal ? ` — ${goal}` : ''}
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 700 }}>{primary.angle}</div>
                  </div>
                  <div style={{ fontSize: 36, fontWeight: 700, color: primary.score >= 70 ? 'var(--success)' : 'var(--warning)' }}>
                    {primary.score}
                  </div>
                </div>
                <FatigueBadge level={primary.fatigueLevel} />
                <div style={{ marginTop: 16 }}>
                  <SignalBreakdownBars breakdown={primary.breakdown} />
                </div>
                <div style={{ marginTop: 12, fontSize: 12, color: 'var(--muted)', fontStyle: 'italic' }}>
                  {primary.explanation.finalReasoning}
                </div>
              </div>
            ))}
          </div>

          <div className="card">
            <div className="card-title">Score Delta</div>
            <div style={{ fontSize: 28, fontWeight: 700 }}>
              {primaryA.score > primaryB.score
                ? <span style={{ color: 'var(--success)' }}>A wins +{primaryA.score - primaryB.score}</span>
                : primaryB.score > primaryA.score
                ? <span style={{ color: 'var(--warning)' }}>B wins +{primaryB.score - primaryA.score}</span>
                : <span style={{ color: 'var(--muted)' }}>Tie</span>
              }
            </div>
          </div>
        </>
      )}
    </div>
  );
}
