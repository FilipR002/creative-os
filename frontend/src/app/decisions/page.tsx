'use client';

// ─── Phase 6.2 — Decisions Page (Streaming UX) ───────────────────────────────
// "Watching intelligence think in real time."
// Uses useExecution hook + ExecutionStreamCard + ExecutionTimeline.

import { useState } from 'react';
import { useExecution } from '@/lib/hooks/useExecution';
import { ExecutionStreamCard } from '@/components/ExecutionStreamCard';
import { ExecutionTimeline }   from '@/components/ExecutionTimeline';

export default function DecisionsPage() {
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
        <h1 className="page-title">Decisions</h1>
        <p className="page-sub">Watch the AI engine think in real time</p>
      </div>

      {/* ── Parameters ── */}
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
                style={{ width: '100%', padding: '8px 10px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13 }}
                onKeyDown={e => e.key === 'Enter' && !running && handleRun()}
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

      {/* ── Live execution stream card ── */}
      {state && (
        <div className="anim-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <ExecutionStreamCard state={state} />

          {/* Timeline shown after completion */}
          {isDone && state.timeline.length > 0 && (
            <ExecutionTimeline entries={state.timeline} startedAt={state.startedAt} />
          )}
        </div>
      )}
    </div>
  );
}
