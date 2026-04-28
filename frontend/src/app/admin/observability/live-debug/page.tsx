'use client';
// ─── Admin: Live Debug Mode ───────────────────────────────────────────────────
// Phase 2: Decision Replay Timeline + Simulation Engine + Decision Diff Viewer
// + Live Debug Stream

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  getDebugGenerations, replayGeneration, runSimulation,
  getAdminRealtimeFeed,
  type RecentGeneration, type ReplayResult, type ReplayStep,
  type SimulationInput, type SimulationOutput,
  type AdminRealtimeFeedEntry,
} from '@/lib/api/creator-client';

// ─── Sub-section tabs ─────────────────────────────────────────────────────────

const SUBTABS = [
  { id: 'replay',     label: '▶ Decision Replay' },
  { id: 'simulate',   label: '🔬 Simulation'      },
  { id: 'diff',       label: '⚡ Decision Diff'    },
  { id: 'stream',     label: '📡 Live Stream'      },
] as const;
type SubTab = typeof SUBTABS[number]['id'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STEP_COLORS: Record<string, string> = {
  brief_received:      '#6366f1',
  memory_retrieval:    '#22c55e',
  orchestrator_decision: '#f59e0b',
  generation:          '#3b82f6',
  scoring:             '#ec4899',
  memory_write:        '#a78bfa',
};

const ANGLES = ['emotional', 'urgency', 'premium', 'storytelling', 'price-focused', 'pain-point', 'curiosity', 'rational'];

function StepCard({ step, isLast }: { step: ReplayStep; isLast: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const color = STEP_COLORS[step.name] ?? '#555';
  return (
    <div style={{ display: 'flex', gap: 12 }}>
      {/* Timeline spine */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: `${color}22`, border: `2px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color, flexShrink: 0 }}>
          {step.step}
        </div>
        {!isLast && <div style={{ width: 2, flex: 1, background: '#1e2330', minHeight: 20 }} />}
      </div>
      {/* Card */}
      <div style={{ flex: 1, paddingBottom: isLast ? 0 : 16 }}>
        <div
          onClick={() => setExpanded(v => !v)}
          style={{
            padding: '12px 14px', background: '#0d0e14',
            border: `1px solid ${color}33`, borderRadius: 9, cursor: 'pointer',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#f0f0f0' }}>{step.label}</div>
              <div style={{ fontSize: 11, color: '#444', fontFamily: 'monospace', marginTop: 2 }}>{step.name}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {step.durationMs > 0 && (
                <span style={{ fontSize: 10, color: '#555', background: '#0a0b10', padding: '2px 7px', borderRadius: 4 }}>
                  {step.durationMs}ms
                </span>
              )}
              <span style={{ fontSize: 12, color: '#333' }}>{expanded ? '▲' : '▼'}</span>
            </div>
          </div>
          {expanded && (
            <pre style={{ marginTop: 10, fontSize: 11, color: '#888', fontFamily: 'monospace', background: '#0a0b10', padding: 10, borderRadius: 6, overflow: 'auto', maxHeight: 200, lineHeight: 1.5, border: '1px solid #111318' }}>
              {JSON.stringify(step.data, null, 2)}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── REPLAY PANEL ─────────────────────────────────────────────────────────────

function ReplayPanel() {
  const [generations, setGenerations] = useState<RecentGeneration[]>([]);
  const [selected,    setSelected]    = useState<string>('');
  const [replay,      setReplay]      = useState<ReplayResult | null>(null);
  const [loading,     setLoading]     = useState(false);
  const [loadingList, setLoadingList] = useState(true);

  useEffect(() => {
    getDebugGenerations(30).then(setGenerations).catch(() => {}).finally(() => setLoadingList(false));
  }, []);

  const handleReplay = useCallback(async () => {
    if (!selected) return;
    setLoading(true);
    setReplay(null);
    const r = await replayGeneration(selected).catch(() => null);
    setReplay(r);
    setLoading(false);
  }, [selected]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20, alignItems: 'start' }}>
      {/* Generation picker */}
      <div style={{ background: '#0d0e14', border: '1px solid #1e2330', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid #111318', fontSize: 13, fontWeight: 700, color: '#f0f0f0' }}>
          Recent Generations
        </div>
        <div style={{ maxHeight: 480, overflowY: 'auto' }}>
          {loadingList && <div style={{ padding: '16px 14px', fontSize: 12, color: '#333' }}>Loading…</div>}
          {!loadingList && generations.length === 0 && (
            <div style={{ padding: '16px 14px', fontSize: 12, color: '#333' }}>No generations yet</div>
          )}
          {generations.map(g => (
            <div
              key={g.id}
              onClick={() => setSelected(g.id)}
              style={{
                padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #0f1014',
                background: selected === g.id ? 'rgba(99,102,241,0.08)' : 'transparent',
                borderLeft: selected === g.id ? '2px solid #6366f1' : '2px solid transparent',
              }}
            >
              <div style={{ fontSize: 11, color: '#c0c0c0', fontFamily: 'monospace', marginBottom: 2 }}>
                {g.id.slice(0, 16)}…
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <span style={{ fontSize: 10, color: '#6366f1', background: 'rgba(99,102,241,0.1)', padding: '1px 5px', borderRadius: 3 }}>{g.format ?? '—'}</span>
                {g.angle && <span style={{ fontSize: 10, color: '#f59e0b', background: 'rgba(245,158,11,0.1)', padding: '1px 5px', borderRadius: 3 }}>{typeof g.angle === 'string' ? g.angle : (g.angle as any)?.slug ?? (g.angle as any)?.label ?? '—'}</span>}
              </div>
              <div style={{ fontSize: 10, color: '#333', marginTop: 2 }}>{new Date(g.createdAt).toLocaleDateString()}</div>
            </div>
          ))}
        </div>
        <div style={{ padding: 12, borderTop: '1px solid #111318' }}>
          <button
            onClick={handleReplay}
            disabled={!selected || loading}
            style={{
              width: '100%', padding: '9px', background: selected && !loading ? 'rgba(99,102,241,0.12)' : '#0a0b10',
              border: '1px solid rgba(99,102,241,0.25)', borderRadius: 7,
              color: selected && !loading ? '#a5b4fc' : '#333',
              fontSize: 13, fontWeight: 600, cursor: selected && !loading ? 'pointer' : 'not-allowed',
              fontFamily: 'inherit',
            }}
          >
            {loading ? 'Replaying…' : '▶ Replay Decision'}
          </button>
        </div>
      </div>

      {/* Timeline */}
      <div>
        {!replay && !loading && (
          <div style={{ padding: '48px 24px', textAlign: 'center', background: '#0d0e14', border: '1px dashed #1e2330', borderRadius: 12, color: '#333', fontSize: 13 }}>
            Select a generation and click Replay Decision to see the full decision trace.
          </div>
        )}
        {loading && (
          <div style={{ padding: '48px 24px', textAlign: 'center', background: '#0d0e14', border: '1px solid #1e2330', borderRadius: 12, color: '#555', fontSize: 13 }}>
            Replaying decision…
          </div>
        )}
        {replay && (
          <div>
            {/* Summary bar */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
              {[
                { label: 'Generation',     value: replay.generationId.slice(0, 12) + '…', color: '#c0c0c0' },
                { label: 'Total Time',     value: `${replay.totalMs}ms`,                   color: '#22c55e' },
                { label: 'Steps',          value: String(replay.steps.length),             color: '#f0f0f0' },
                { label: 'Found in DB',    value: replay.found ? '✓ Yes' : '✗ No',        color: replay.found ? '#22c55e' : '#ef4444' },
              ].map(s => (
                <div key={s.label} style={{ padding: '10px 14px', background: '#0d0e14', border: '1px solid #1e2330', borderRadius: 8, minWidth: 100 }}>
                  <div style={{ fontSize: 10, color: '#444', marginBottom: 2 }}>{s.label}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>

            {/* Steps timeline */}
            <div style={{ padding: '20px 20px', background: '#0d0e14', border: '1px solid #1e2330', borderRadius: 12 }}>
              {replay.steps.map((step, i) => (
                <StepCard key={step.step} step={step} isLast={i === replay.steps.length - 1} />
              ))}
            </div>

            {/* Weights applied */}
            <div style={{ marginTop: 14, padding: '12px 16px', background: '#0a0b10', border: '1px solid #1e2330', borderRadius: 8 }}>
              <div style={{ fontSize: 11, color: '#444', marginBottom: 6 }}>Memory Weights Applied</div>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                {Object.entries(replay.memoryWeightsApplied).filter(([k]) => k !== 'updatedAt').map(([k, v]) => (
                  <div key={k} style={{ fontSize: 11, color: '#888' }}>
                    <span style={{ color: '#6ee7b7' }}>{k}</span>: {(Number(v) * 100).toFixed(0)}%
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── SIMULATION PANEL ─────────────────────────────────────────────────────────

function SimulationPanel() {
  const [angle,     setAngle]     = useState('emotional');
  const [persona,   setPersona]   = useState('');
  const [emotional, setEmotional] = useState(0.30);
  const [urgency,   setUrgency]   = useState(0.25);
  const [rational,  setRational]  = useState(0.25);
  const [curiosity, setCuriosity] = useState(0.20);
  const [result,    setResult]    = useState<SimulationOutput | null>(null);
  const [running,   setRunning]   = useState(false);

  const handleRun = useCallback(async () => {
    setRunning(true);
    setResult(null);
    const input: SimulationInput = {
      angle,
      persona:       persona || undefined,
      hookStrategy:  { emotional, urgency, rational, curiosity },
    };
    const r = await runSimulation(input).catch(() => null);
    setResult(r);
    setRunning(false);
  }, [angle, persona, emotional, urgency, rational, curiosity]);

  function SliderRow({ label, value, onChange, color }: { label: string; value: number; onChange: (v: number) => void; color: string }) {
    return (
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
          <span style={{ fontSize: 12, color: '#888' }}>{label}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color }}>{(value * 100).toFixed(0)}%</span>
        </div>
        <input
          type="range" min={0} max={1} step={0.01} value={value}
          onChange={e => onChange(parseFloat(e.target.value))}
          style={{ width: '100%', accentColor: color, cursor: 'pointer' }}
        />
      </div>
    );
  }

  const deltaColor = result ? (result.output.delta_vs_current > 0 ? '#22c55e' : result.output.delta_vs_current < 0 ? '#ef4444' : '#888') : '#888';

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 20, alignItems: 'start' }}>
      {/* Config panel */}
      <div style={{ background: '#0d0e14', border: '1px solid #1e2330', borderRadius: 12, padding: '18px 20px' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#f0f0f0', marginBottom: 16 }}>Simulation Config</div>

        {/* Angle */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: '#444', marginBottom: 6 }}>Angle</div>
          <select
            value={angle}
            onChange={e => setAngle(e.target.value)}
            style={{ width: '100%', padding: '8px 10px', background: '#0a0b10', border: '1px solid #1e2330', borderRadius: 7, color: '#f0f0f0', fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' }}
          >
            {ANGLES.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>

        {/* Persona */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: '#444', marginBottom: 6 }}>Persona (optional)</div>
          <input
            value={persona}
            onChange={e => setPersona(e.target.value)}
            placeholder="e.g. SaaS founder, 35-44…"
            style={{ width: '100%', padding: '8px 10px', background: '#0a0b10', border: '1px solid #1e2330', borderRadius: 7, color: '#f0f0f0', fontSize: 12, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>

        {/* Hook strategy sliders */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: '#444', marginBottom: 10 }}>Hook Strategy Mix</div>
          <SliderRow label="Emotional"  value={emotional}  onChange={setEmotional}  color="#ec4899" />
          <SliderRow label="Urgency"    value={urgency}    onChange={setUrgency}    color="#ef4444" />
          <SliderRow label="Rational"   value={rational}   onChange={setRational}   color="#3b82f6" />
          <SliderRow label="Curiosity"  value={curiosity}  onChange={setCuriosity}  color="#a78bfa" />
          <div style={{ fontSize: 10, color: `${Math.abs((emotional+urgency+rational+curiosity)-1) < 0.02 ? '#22c55e' : '#ef4444'}`, marginTop: 4 }}>
            Sum: {((emotional+urgency+rational+curiosity)*100).toFixed(0)}%
            {Math.abs((emotional+urgency+rational+curiosity)-1) < 0.02 ? ' ✓' : ' ⚠ should be ~100%'}
          </div>
        </div>

        <button
          onClick={handleRun}
          disabled={running}
          style={{
            width: '100%', padding: '10px', background: running ? '#1a1b22' : 'rgba(99,102,241,0.12)',
            border: '1px solid rgba(99,102,241,0.3)', borderRadius: 8,
            color: running ? '#444' : '#a5b4fc', fontWeight: 600, fontSize: 13,
            cursor: running ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
          }}
        >
          {running ? 'Simulating…' : '▶ Run Simulation'}
        </button>
      </div>

      {/* Result */}
      <div>
        {!result && !running && (
          <div style={{ padding: '48px 24px', textAlign: 'center', background: '#0d0e14', border: '1px dashed #1e2330', borderRadius: 12, color: '#333', fontSize: 13 }}>
            Configure parameters and click Run Simulation to see predicted outcomes.
          </div>
        )}
        {running && (
          <div style={{ padding: '48px 24px', textAlign: 'center', background: '#0d0e14', border: '1px solid #1e2330', borderRadius: 12, color: '#555', fontSize: 13 }}>
            Running simulation…
          </div>
        )}
        {result && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Headline metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
              {[
                { label: 'Predicted CTR',        value: `${(result.output.predicted_ctr * 100).toFixed(3)}%`,        color: '#22c55e'  },
                { label: 'Predicted Conversion',  value: `${(result.output.predicted_conversion * 100).toFixed(3)}%`, color: '#6ee7b7'  },
                { label: 'Predicted Engagement',  value: `${(result.output.predicted_engagement * 100).toFixed(1)}%`, color: '#a5b4fc'  },
                { label: 'Δ vs Current',          value: `${result.output.delta_vs_current > 0 ? '+' : ''}${(result.output.delta_vs_current * 100).toFixed(3)}%`, color: deltaColor },
              ].map(m => (
                <div key={m.label} style={{ padding: '12px 14px', background: '#0d0e14', border: '1px solid #1e2330', borderRadius: 9, textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: '#444', marginBottom: 4 }}>{m.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: m.color }}>{m.value}</div>
                </div>
              ))}
            </div>

            {/* Confidence + risk */}
            <div style={{ padding: '12px 16px', background: '#0d0e14', border: '1px solid #1e2330', borderRadius: 9 }}>
              <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 11, color: '#444', marginBottom: 2 }}>Confidence</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#f59e0b' }}>{(result.output.confidence * 100).toFixed(0)}%</div>
                </div>
                {result.output.risk_flags.length > 0 && (
                  <div style={{ fontSize: 12, color: '#f59e0b', padding: '6px 10px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 6 }}>
                    ⚠ {result.output.risk_flags.join(' · ')}
                  </div>
                )}
                {result.output.risk_flags.length === 0 && (
                  <div style={{ fontSize: 12, color: '#22c55e', padding: '6px 10px', background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: 6 }}>
                    ✓ No risk flags
                  </div>
                )}
              </div>
            </div>

            {/* Applied configs */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ padding: '12px 14px', background: '#0a0b10', border: '1px solid #1e2330', borderRadius: 8 }}>
                <div style={{ fontSize: 11, color: '#444', marginBottom: 6 }}>Memory Weights Applied</div>
                {Object.entries(result.weights_applied).filter(([k]) => k !== 'updatedAt').map(([k, v]) => (
                  <div key={k} style={{ fontSize: 11, color: '#888', display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                    <span>{k}</span><span style={{ color: '#6ee7b7' }}>{(Number(v) * 100).toFixed(0)}%</span>
                  </div>
                ))}
              </div>
              <div style={{ padding: '12px 14px', background: '#0a0b10', border: '1px solid #1e2330', borderRadius: 8 }}>
                <div style={{ fontSize: 11, color: '#444', marginBottom: 6 }}>Hook Strategy Applied</div>
                {Object.entries(result.hook_strategy_applied).filter(([k]) => k !== 'updatedAt').map(([k, v]) => (
                  <div key={k} style={{ fontSize: 11, color: '#888', display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                    <span>{k}</span><span style={{ color: '#a5b4fc' }}>{(Number(v) * 100).toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── DECISION DIFF PANEL ──────────────────────────────────────────────────────

function DiffPanel() {
  const [idA,      setIdA]      = useState('');
  const [idB,      setIdB]      = useState('');
  const [replayA,  setReplayA]  = useState<ReplayResult | null>(null);
  const [replayB,  setReplayB]  = useState<ReplayResult | null>(null);
  const [loading,  setLoading]  = useState(false);

  const handleCompare = useCallback(async () => {
    if (!idA || !idB) return;
    setLoading(true);
    const [a, b] = await Promise.all([
      replayGeneration(idA).catch(() => null),
      replayGeneration(idB).catch(() => null),
    ]);
    setReplayA(a);
    setReplayB(b);
    setLoading(false);
  }, [idA, idB]);

  function diffValue(a: unknown, b: unknown): 'same' | 'changed' {
    return JSON.stringify(a) === JSON.stringify(b) ? 'same' : 'changed';
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* ID inputs */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 10 }}>
        <div>
          <div style={{ fontSize: 11, color: '#444', marginBottom: 4 }}>Generation A (actual)</div>
          <input
            value={idA}
            onChange={e => setIdA(e.target.value)}
            placeholder="Generation ID A…"
            style={{ width: '100%', padding: '8px 12px', background: '#0d0e14', border: '1px solid #1e2330', borderRadius: 7, color: '#f0f0f0', fontSize: 12, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
        <div>
          <div style={{ fontSize: 11, color: '#444', marginBottom: 4 }}>Generation B (alternative)</div>
          <input
            value={idB}
            onChange={e => setIdB(e.target.value)}
            placeholder="Generation ID B…"
            style={{ width: '100%', padding: '8px 12px', background: '#0d0e14', border: '1px solid #1e2330', borderRadius: 7, color: '#f0f0f0', fontSize: 12, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <button
            onClick={handleCompare}
            disabled={!idA || !idB || loading}
            style={{ padding: '8px 18px', background: (!idA || !idB) ? '#1a1b22' : 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 7, color: (!idA || !idB) ? '#333' : '#a5b4fc', fontSize: 13, cursor: (!idA || !idB) ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontWeight: 600 }}
          >
            {loading ? 'Comparing…' : 'Compare →'}
          </button>
        </div>
      </div>

      {!replayA && !replayB && !loading && (
        <div style={{ padding: '40px 24px', textAlign: 'center', background: '#0d0e14', border: '1px dashed #1e2330', borderRadius: 12, color: '#333', fontSize: 13 }}>
          Enter two generation IDs to compare their decision traces side-by-side.
        </div>
      )}

      {loading && (
        <div style={{ padding: '40px 24px', textAlign: 'center', background: '#0d0e14', border: '1px solid #1e2330', borderRadius: 12, color: '#555', fontSize: 13 }}>
          Loading traces for comparison…
        </div>
      )}

      {replayA && replayB && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Header row */}
          <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr 1fr', gap: 10 }}>
            <div style={{ fontSize: 11, color: '#333', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center' }}>Step</div>
            <div style={{ padding: '8px 12px', background: '#0d0e14', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 7, fontSize: 12, fontWeight: 700, color: '#a5b4fc' }}>
              A — {replayA.generationId.slice(0, 12)}…
            </div>
            <div style={{ padding: '8px 12px', background: '#0d0e14', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 7, fontSize: 12, fontWeight: 700, color: '#fbbf24' }}>
              B — {replayB.generationId.slice(0, 12)}…
            </div>
          </div>

          {/* Step diffs */}
          {replayA.steps.map((stepA, i) => {
            const stepB   = replayB.steps[i];
            const isDiff  = stepB ? diffValue(stepA.data, stepB.data) === 'changed' : false;
            return (
              <div key={stepA.step} style={{ display: 'grid', gridTemplateColumns: '160px 1fr 1fr', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: isDiff ? '#f59e0b' : '#22c55e', flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: '#888' }}>{stepA.label}</span>
                </div>
                <div style={{ padding: '10px 12px', background: '#0d0e14', border: `1px solid ${isDiff ? 'rgba(99,102,241,0.3)' : '#1e2330'}`, borderRadius: 7 }}>
                  <pre style={{ fontSize: 10, color: '#555', fontFamily: 'monospace', margin: 0, overflow: 'auto', maxHeight: 120, lineHeight: 1.5 }}>
                    {JSON.stringify(stepA.data, null, 2)}
                  </pre>
                </div>
                <div style={{ padding: '10px 12px', background: '#0d0e14', border: `1px solid ${isDiff ? 'rgba(245,158,11,0.3)' : '#1e2330'}`, borderRadius: 7 }}>
                  {stepB ? (
                    <pre style={{ fontSize: 10, color: isDiff ? '#fbbf24' : '#555', fontFamily: 'monospace', margin: 0, overflow: 'auto', maxHeight: 120, lineHeight: 1.5 }}>
                      {JSON.stringify(stepB.data, null, 2)}
                    </pre>
                  ) : (
                    <span style={{ fontSize: 11, color: '#333' }}>—</span>
                  )}
                </div>
              </div>
            );
          })}

          {/* Total time diff */}
          <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr 1fr', gap: 10 }}>
            <div style={{ fontSize: 12, color: '#888', display: 'flex', alignItems: 'center' }}>Total time</div>
            <div style={{ padding: '8px 12px', background: '#0a0b10', border: '1px solid #1e2330', borderRadius: 7, fontSize: 12, fontWeight: 700, color: '#22c55e' }}>{replayA.totalMs}ms</div>
            <div style={{ padding: '8px 12px', background: '#0a0b10', border: '1px solid #1e2330', borderRadius: 7, fontSize: 12, fontWeight: 700, color: '#fbbf24' }}>{replayB.totalMs}ms</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── LIVE STREAM PANEL ────────────────────────────────────────────────────────

function LiveStreamPanel() {
  const [events,   setEvents]   = useState<AdminRealtimeFeedEntry[]>([]);
  const [paused,   setPaused]   = useState(false);
  const [loading,  setLoading]  = useState(false);
  const intervalRef             = useRef<ReturnType<typeof setInterval> | null>(null);

  const poll = useCallback(async () => {
    const data = await getAdminRealtimeFeed(50).catch(() => null);
    if (data) setEvents(data);
  }, []);

  useEffect(() => {
    poll();
  }, [poll]);

  useEffect(() => {
    if (!paused) {
      intervalRef.current = setInterval(poll, 5000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [paused, poll]);

  const TYPE_COLORS: Record<string, string> = {
    CREATED:       '#6366f1',
    SCORED:        '#22c55e',
    IMPROVED:      '#f59e0b',
    MEMORY_WRITTEN:'#a78bfa',
    EVOLUTION:     '#3b82f6',
    MUTATION:      '#ec4899',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Controls */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: paused ? '#444' : '#22c55e', boxShadow: paused ? 'none' : '0 0 6px rgba(34,197,94,0.6)' }} />
          <span style={{ fontSize: 12, color: paused ? '#444' : '#22c55e' }}>{paused ? 'Paused' : 'Live — polling every 5s'}</span>
        </div>
        <button
          onClick={() => setPaused(v => !v)}
          style={{ padding: '6px 14px', background: paused ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${paused ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`, borderRadius: 6, color: paused ? '#4ade80' : '#f87171', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          {paused ? '▶ Resume' : '⏸ Pause'}
        </button>
        <button
          onClick={() => { setLoading(true); poll().finally(() => setLoading(false)); }}
          disabled={loading}
          style={{ padding: '6px 14px', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 6, color: '#a5b4fc', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          ↻ Refresh
        </button>
        <div style={{ marginLeft: 'auto', fontSize: 11, color: '#333' }}>{events.length} events</div>
      </div>

      {/* Event list */}
      <div style={{ background: '#0a0b10', border: '1px solid #1e2330', borderRadius: 10, overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'grid', gridTemplateColumns: '100px 90px 1fr 120px', padding: '7px 14px', background: '#080910', borderBottom: '1px solid #1e2330', fontSize: 10, fontWeight: 700, color: '#333', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          <span>Type</span><span>User</span><span>Detail</span><span>Time</span>
        </div>
        {events.length === 0 ? (
          <div style={{ padding: '24px 14px', fontSize: 12, color: '#333', textAlign: 'center' }}>No events yet — waiting for activity…</div>
        ) : (
          events.map((ev, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '100px 90px 1fr 120px', padding: '8px 14px', borderBottom: '1px solid #0f1014', alignItems: 'center' }}>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                background: `${TYPE_COLORS[ev.type] ?? '#444'}18`,
                color: TYPE_COLORS[ev.type] ?? '#888',
                border: `1px solid ${TYPE_COLORS[ev.type] ?? '#444'}33`,
              }}>
                {ev.type}
              </span>
              <span style={{ fontSize: 11, color: '#555', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {String(ev.userId ?? '—').slice(0, 8)}
              </span>
              <span style={{ fontSize: 12, color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {ev.detail ?? ev.entityId ?? '—'}
              </span>
              <span style={{ fontSize: 11, color: '#333' }}>
                {ev.at ? new Date(ev.at).toLocaleTimeString() : '—'}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Event type legend */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {Object.entries(TYPE_COLORS).map(([type, color]) => (
          <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
            <span style={{ fontSize: 10, color: '#444' }}>{type}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function LiveDebugPage() {
  const [subTab, setSubTab] = useState<SubTab>('replay');

  const panels: Record<SubTab, React.ReactNode> = {
    replay:   <ReplayPanel />,
    simulate: <SimulationPanel />,
    diff:     <DiffPanel />,
    stream:   <LiveStreamPanel />,
  };

  return (
    <div style={{ maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <a href="/admin/observability" style={{ fontSize: 13, color: '#444', textDecoration: 'none' }}>← Observability Hub</a>
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 4 }}>🐛 Live Debug Mode</h1>
        <p style={{ fontSize: 13, color: '#555' }}>Replay every AI decision step-by-step, simulate alternatives, diff executions, watch the live stream.</p>
      </div>

      {/* Sub-tab bar */}
      <div style={{ display: 'flex', gap: 2, padding: 4, background: '#0a0b10', border: '1px solid #1e2330', borderRadius: 9, marginBottom: 22, width: 'fit-content' }}>
        {SUBTABS.map(t => (
          <button key={t.id} onClick={() => setSubTab(t.id)} style={{ padding: '7px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', background: subTab === t.id ? '#1e2330' : 'transparent', color: subTab === t.id ? '#f0f0f0' : '#555', fontSize: 12, fontWeight: subTab === t.id ? 600 : 400, fontFamily: 'inherit', whiteSpace: 'nowrap', transition: 'all 0.15s' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Panel */}
      {panels[subTab]}
    </div>
  );
}
