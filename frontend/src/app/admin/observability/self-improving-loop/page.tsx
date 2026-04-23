'use client';
// ─── Admin: Self-Improving Loop ───────────────────────────────────────────────
// Phase 3: Evolution Controls + Memory Weight Editor + Orchestrator Rules Editor
//          + Hook Strategy Controls + Self-Learning Injection

import { useEffect, useState, useCallback } from 'react';
import {
  // Evolution
  getEvolutionStatusTyped, getEvolutionLogTyped, runEvolutionCycle, forceMutateAngle,
  type EvolutionStatusResult, type EvolutionLogEntry,
  // Memory weights
  getMemoryWeights, updateMemoryWeights, type MemoryWeights,
  // Orchestrator rules
  getOrchestratorRules, upsertOrchestratorRule, updateOrchestratorRules,
  type OrchestratorRule,
  // Hook strategy
  getHookStrategy, updateHookStrategy, type HookStrategyConfig,
  // Self-learning
  injectLearning, getSelfLearningLog, type SelfLearningEntry,
  // Autonomous loop control
  getAutonomousLoopStatus, triggerAutonomousLoop, stopAutonomousLoop, setAutonomousLoopMode,
  getAutonomousLoopAudit, rollbackAutonomousAction,
  type AutonomousLoopStatus, type AutonomousLoopAuditEntry, type AutonomousLoopMode,
} from '@/lib/api/creator-client';

// ─── Sub-tabs ─────────────────────────────────────────────────────────────────

const SUBTABS = [
  { id: 'evolution',     label: '⚙️ Evolution Engine'      },
  { id: 'weights',       label: '⚖️ Memory Weights'         },
  { id: 'rules',         label: '📋 Orchestrator Rules'     },
  { id: 'hook-strategy', label: '🪝 Hook Strategy'          },
  { id: 'self-learning', label: '🧬 Self-Learning'          },
  { id: 'loop-control',  label: '🔄 Loop Control'           },
] as const;
type SubTab = typeof SUBTABS[number]['id'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Label({ text }: { text: string }) {
  return <div style={{ fontSize: 11, color: '#444', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{text}</div>;
}

function ActionBtn({
  onClick, disabled, label, loadingLabel, color = '#6366f1',
}: { onClick: () => void; disabled: boolean; label: string; loadingLabel: string; color?: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '9px 18px', background: disabled ? '#1a1b22' : `${color}1a`,
        border: `1px solid ${disabled ? '#222' : `${color}44`}`,
        borderRadius: 8, color: disabled ? '#444' : color,
        fontWeight: 600, fontSize: 13, cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: 'inherit',
      }}
    >
      {disabled ? loadingLabel : label}
    </button>
  );
}

function SliderWithLabel({ label, value, onChange, color, min = 0, max = 1 }: { label: string; value: number; onChange: (v: number) => void; color: string; min?: number; max?: number }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={{ fontSize: 13, color: '#888' }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color }}>{(value * 100).toFixed(0)}%</span>
      </div>
      <div style={{ position: 'relative' }}>
        <input
          type="range" min={min} max={max} step={0.01} value={value}
          onChange={e => onChange(parseFloat(e.target.value))}
          style={{ width: '100%', accentColor: color, cursor: 'pointer', height: 4 }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
          <span style={{ fontSize: 9, color: '#333' }}>0%</span>
          <span style={{ fontSize: 9, color: '#333' }}>100%</span>
        </div>
      </div>
    </div>
  );
}

const OUTCOME_COLORS: Record<string, string> = { success: '#22c55e', failure: '#ef4444', skipped: '#6b7280', rolled_back: '#f59e0b' };

// ─── EVOLUTION PANEL ──────────────────────────────────────────────────────────

function EvolutionPanel() {
  const [status,  setStatus]  = useState<EvolutionStatusResult | null>(null);
  const [log,     setLog]     = useState<EvolutionLogEntry[]>([]);
  const [slug,    setSlug]    = useState('');
  const [running, setRunning] = useState(false);
  const [mutating,setMutating]= useState(false);
  const [msg,     setMsg]     = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getEvolutionStatusTyped().then(setStatus).catch(() => {}),
      getEvolutionLogTyped(20).then(setLog).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  const handleRunCycle = useCallback(async () => {
    setRunning(true); setMsg(null);
    try {
      const r = await runEvolutionCycle();
      setMsg('✓ Cycle triggered — ' + JSON.stringify(r).slice(0, 60));
      const [s, l] = await Promise.all([getEvolutionStatusTyped().catch(() => null), getEvolutionLogTyped(20).catch(() => [])]);
      if (s) setStatus(s);
      setLog(l);
    } catch (e) { setMsg('✗ ' + (e as Error).message); }
    finally { setRunning(false); }
  }, []);

  const handleForceMutate = useCallback(async () => {
    if (!slug) return;
    setMutating(true); setMsg(null);
    try {
      const r = await forceMutateAngle(slug);
      setMsg('✓ Mutation triggered — ' + JSON.stringify(r).slice(0, 60));
      setLog(await getEvolutionLogTyped(20).catch(() => []));
    } catch (e) { setMsg('✗ ' + (e as Error).message); }
    finally { setMutating(false); }
  }, [slug]);

  if (loading) return <div style={{ fontSize: 12, color: '#333', padding: 20 }}>Loading…</div>;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
      {/* Status + controls */}
      <div style={{ background: '#0d0e14', border: '1px solid #1e2330', borderRadius: 12, padding: '18px 20px' }}>
        <Label text="Evolution Status" />
        {status && (
          <div style={{ marginBottom: 16 }}>
            {Object.entries(status).slice(0, 6).map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #0f1014' }}>
                <span style={{ fontSize: 12, color: '#555' }}>{k}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#c0c0c0' }}>{String(v)}</span>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
          <ActionBtn onClick={handleRunCycle} disabled={running} label="▶ Run Evolution Cycle" loadingLabel="Running…" color="#22c55e" />
        </div>
        <Label text="Force Mutation" />
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={slug}
            onChange={e => setSlug(e.target.value)}
            placeholder="angle slug…"
            style={{ flex: 1, padding: '8px 10px', background: '#0a0b10', border: '1px solid #1e2330', borderRadius: 6, color: '#f0f0f0', fontSize: 12, fontFamily: 'inherit', outline: 'none' }}
          />
          <ActionBtn onClick={handleForceMutate} disabled={mutating || !slug} label="Mutate" loadingLabel="…" color="#f59e0b" />
        </div>
        {msg && (
          <div style={{ marginTop: 10, fontSize: 12, color: msg.startsWith('✓') ? '#22c55e' : '#f87171', padding: '8px 10px', background: msg.startsWith('✓') ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.06)', borderRadius: 6, border: `1px solid ${msg.startsWith('✓') ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)'}` }}>
            {msg}
          </div>
        )}
      </div>

      {/* Log */}
      <div style={{ background: '#0d0e14', border: '1px solid #1e2330', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '10px 16px', borderBottom: '1px solid #111318', fontSize: 13, fontWeight: 700, color: '#f0f0f0' }}>Evolution Log</div>
        <div style={{ maxHeight: 380, overflowY: 'auto' }}>
          {log.length === 0 ? (
            <div style={{ padding: '16px', fontSize: 12, color: '#333' }}>No log entries yet</div>
          ) : log.map(e => (
            <div key={e.id} style={{ padding: '10px 14px', borderBottom: '1px solid #0f1014' }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 3 }}>
                <span style={{ fontSize: 10, color: '#6366f1', fontWeight: 700 }}>{e.event}</span>
                <span style={{ fontSize: 10, color: '#f59e0b' }}>{e.angleSlug}</span>
              </div>
              <div style={{ fontSize: 10, color: '#333' }}>{new Date(e.createdAt).toLocaleString()}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── MEMORY WEIGHTS PANEL ─────────────────────────────────────────────────────

function WeightsPanel() {
  const [ctr,        setCtr]        = useState(0.30);
  const [conversion, setConversion] = useState(0.25);
  const [engagement, setEngagement] = useState(0.30);
  const [clarity,    setClarity]    = useState(0.15);
  const [saving,     setSaving]     = useState(false);
  const [saved,      setSaved]      = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [loading,    setLoading]    = useState(true);

  useEffect(() => {
    getMemoryWeights()
      .then(w => { setCtr(w.ctr); setConversion(w.conversion); setEngagement(w.engagement); setClarity(w.clarity); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const total = ctr + conversion + engagement + clarity;
  const valid = Math.abs(total - 1) < 0.02;

  const handleSave = useCallback(async () => {
    if (!valid || saving) return;
    setSaving(true); setSaved(false); setError(null);
    try {
      await updateMemoryWeights({ ctr, conversion, engagement, clarity });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  }, [valid, saving, ctr, conversion, engagement, clarity]);

  if (loading) return <div style={{ fontSize: 12, color: '#333', padding: 20 }}>Loading weights…</div>;

  return (
    <div style={{ maxWidth: 560 }}>
      <div style={{ background: '#0d0e14', border: '1px solid #1e2330', borderRadius: 12, padding: '22px 24px' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#f0f0f0', marginBottom: 20 }}>Memory Scoring Weights</div>
        <p style={{ fontSize: 13, color: '#555', marginBottom: 20, lineHeight: 1.6 }}>
          These weights determine how the AI balances CTR, conversions, engagement and clarity when ranking creative memory signals.
        </p>

        <SliderWithLabel label="CTR Weight"        value={ctr}        onChange={setCtr}        color="#22c55e" />
        <SliderWithLabel label="Conversion Weight" value={conversion} onChange={setConversion} color="#3b82f6" />
        <SliderWithLabel label="Engagement Weight" value={engagement} onChange={setEngagement} color="#a78bfa" />
        <SliderWithLabel label="Clarity Weight"    value={clarity}    onChange={setClarity}    color="#f59e0b" />

        {/* Sum indicator */}
        <div style={{ padding: '10px 14px', background: valid ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.06)', border: `1px solid ${valid ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.2)'}`, borderRadius: 8, marginBottom: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, color: '#888' }}>Total</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: valid ? '#22c55e' : '#ef4444' }}>
              {(total * 100).toFixed(0)}% {valid ? '✓' : '⚠ must be 100%'}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <ActionBtn onClick={handleSave} disabled={!valid || saving} label="💾 Save Weights" loadingLabel="Saving…" color="#6366f1" />
          {saved && <span style={{ fontSize: 12, color: '#22c55e' }}>✓ Saved</span>}
          {error && <span style={{ fontSize: 12, color: '#f87171' }}>✗ {error}</span>}
        </div>
      </div>
    </div>
  );
}

// ─── ORCHESTRATOR RULES PANEL ─────────────────────────────────────────────────

function RulesPanel() {
  const [rules,   setRules]   = useState<OrchestratorRule[]>([]);
  const [saving,  setSaving]  = useState(false);
  const [msg,     setMsg]     = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getOrchestratorRules().then(setRules).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleToggle = useCallback(async (id: string) => {
    const rule = rules.find(r => r.id === id);
    if (!rule) return;
    const updated = { ...rule, enabled: !rule.enabled };
    setRules(prev => prev.map(r => r.id === id ? updated : r));
    await upsertOrchestratorRule(updated).catch(() => {});
  }, [rules]);

  const handleSaveAll = useCallback(async () => {
    setSaving(true); setMsg(null);
    try {
      const r = await updateOrchestratorRules(rules);
      setRules(r);
      setMsg('✓ Rules saved');
      setTimeout(() => setMsg(null), 3000);
    } catch (e) { setMsg('✗ ' + (e as Error).message); }
    finally { setSaving(false); }
  }, [rules]);

  const handleAddRule = useCallback(() => {
    const newRule: OrchestratorRule = {
      id:        `rule-${Date.now()}`,
      condition: 'new_condition == true',
      action:    'new_action',
      priority:  rules.length + 1,
      enabled:   false,
    };
    setRules(prev => [...prev, newRule]);
  }, [rules]);

  const handleEdit = useCallback((id: string, field: keyof OrchestratorRule, value: string | number | boolean) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  }, []);

  if (loading) return <div style={{ fontSize: 12, color: '#333', padding: 20 }}>Loading rules…</div>;

  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#f0f0f0', marginBottom: 6 }}>Orchestrator Decision Rules</div>
      <p style={{ fontSize: 13, color: '#555', marginBottom: 18, lineHeight: 1.6 }}>
        IF/THEN rules that govern angle selection, fallback logic, and priority overrides.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
        {rules.map(r => (
          <div key={r.id} style={{ background: '#0d0e14', border: `1px solid ${r.enabled ? '#1e2330' : '#111318'}`, borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '32px 40px 1fr 1fr 60px', gap: 10, alignItems: 'center' }}>
              {/* Enable toggle */}
              <button
                onClick={() => handleToggle(r.id)}
                style={{ width: 28, height: 16, borderRadius: 8, background: r.enabled ? '#22c55e' : '#333', border: 'none', cursor: 'pointer', position: 'relative', flexShrink: 0 }}
              >
                <span style={{ position: 'absolute', top: 2, left: r.enabled ? 14 : 2, width: 12, height: 12, borderRadius: '50%', background: '#fff', transition: 'left 0.15s' }} />
              </button>

              {/* Priority */}
              <input
                type="number" min={1} max={99} value={r.priority}
                onChange={e => handleEdit(r.id, 'priority', parseInt(e.target.value))}
                style={{ width: '100%', padding: '5px 6px', background: '#0a0b10', border: '1px solid #1e2330', borderRadius: 5, color: '#c0c0c0', fontSize: 12, fontFamily: 'inherit', outline: 'none', textAlign: 'center' }}
              />

              {/* Condition */}
              <div>
                <div style={{ fontSize: 9, color: '#333', marginBottom: 2 }}>IF</div>
                <input
                  value={r.condition}
                  onChange={e => handleEdit(r.id, 'condition', e.target.value)}
                  style={{ width: '100%', padding: '6px 8px', background: '#0a0b10', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 5, color: '#fbbf24', fontSize: 11, fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              {/* Action */}
              <div>
                <div style={{ fontSize: 9, color: '#333', marginBottom: 2 }}>THEN</div>
                <input
                  value={r.action}
                  onChange={e => handleEdit(r.id, 'action', e.target.value)}
                  style={{ width: '100%', padding: '6px 8px', background: '#0a0b10', border: '1px solid rgba(110,231,183,0.2)', borderRadius: 5, color: '#6ee7b7', fontSize: 11, fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              {/* Delete */}
              <button
                onClick={() => setRules(prev => prev.filter(x => x.id !== r.id))}
                style={{ padding: '5px 8px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 5, color: '#f87171', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <button onClick={handleAddRule} style={{ padding: '8px 16px', background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 7, color: '#a5b4fc', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
          + Add Rule
        </button>
        <ActionBtn onClick={handleSaveAll} disabled={saving} label="💾 Save All Rules" loadingLabel="Saving…" color="#6366f1" />
        {msg && <span style={{ fontSize: 12, color: msg.startsWith('✓') ? '#22c55e' : '#f87171' }}>{msg}</span>}
      </div>
    </div>
  );
}

// ─── HOOK STRATEGY PANEL ──────────────────────────────────────────────────────

function HookStrategyPanel() {
  const [cfg,     setCfg]     = useState<HookStrategyConfig | null>(null);
  const [emotional, setEmotional] = useState(0.30);
  const [urgency,   setUrgency]   = useState(0.25);
  const [rational,  setRational]  = useState(0.25);
  const [curiosity, setCuriosity] = useState(0.20);
  const [saving,  setSaving]  = useState(false);
  const [msg,     setMsg]     = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getHookStrategy()
      .then(c => { setCfg(c); setEmotional(c.emotional); setUrgency(c.urgency); setRational(c.rational); setCuriosity(c.curiosity); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true); setMsg(null);
    try {
      const r = await updateHookStrategy({ emotional, urgency, rational, curiosity });
      setCfg(r);
      setMsg('✓ Hook strategy saved');
      setTimeout(() => setMsg(null), 3000);
    } catch (e) { setMsg('✗ ' + (e as Error).message); }
    finally { setSaving(false); }
  }, [emotional, urgency, rational, curiosity, saving]);

  if (loading) return <div style={{ fontSize: 12, color: '#333', padding: 20 }}>Loading hook strategy…</div>;

  return (
    <div style={{ maxWidth: 560 }}>
      <div style={{ background: '#0d0e14', border: '1px solid #1e2330', borderRadius: 12, padding: '22px 24px' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#f0f0f0', marginBottom: 8 }}>Hook Strategy Controls</div>
        <p style={{ fontSize: 13, color: '#555', marginBottom: 20, lineHeight: 1.6 }}>
          Control the probability weighting for each hook emotional register. Higher urgency = more scarcity/deadline hooks.
        </p>

        <SliderWithLabel label="😢 Emotional"  value={emotional}  onChange={setEmotional}  color="#ec4899" />
        <SliderWithLabel label="⚡ Urgency"    value={urgency}    onChange={setUrgency}    color="#ef4444" />
        <SliderWithLabel label="🧮 Rational"   value={rational}   onChange={setRational}   color="#3b82f6" />
        <SliderWithLabel label="🔍 Curiosity"  value={curiosity}  onChange={setCuriosity}  color="#a78bfa" />

        {/* Visual bars */}
        <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: 18 }}>
          {[
            { v: emotional, color: '#ec4899' },
            { v: urgency,   color: '#ef4444' },
            { v: rational,  color: '#3b82f6' },
            { v: curiosity, color: '#a78bfa' },
          ].map((s, i) => (
            <div key={i} style={{ flex: s.v, background: s.color, transition: 'flex 0.2s' }} />
          ))}
        </div>

        {cfg && (
          <div style={{ fontSize: 11, color: '#333', marginBottom: 14 }}>
            Last updated: {new Date(cfg.updatedAt).toLocaleString()}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <ActionBtn onClick={handleSave} disabled={saving} label="💾 Save Strategy" loadingLabel="Saving…" color="#6366f1" />
          {msg && <span style={{ fontSize: 12, color: msg.startsWith('✓') ? '#22c55e' : '#f87171' }}>{msg}</span>}
        </div>
      </div>
    </div>
  );
}

// ─── SELF-LEARNING PANEL ──────────────────────────────────────────────────────

function SelfLearningPanel() {
  const [instruction, setInstruction] = useState('');
  const [log,         setLog]         = useState<SelfLearningEntry[]>([]);
  const [injecting,   setInjecting]   = useState(false);
  const [msg,         setMsg]         = useState<string | null>(null);
  const [loading,     setLoading]     = useState(true);

  useEffect(() => {
    getSelfLearningLog().then(setLog).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleInject = useCallback(async () => {
    if (!instruction.trim() || injecting) return;
    setInjecting(true); setMsg(null);
    try {
      const entry = await injectLearning(instruction.trim());
      setLog(prev => [entry, ...prev]);
      setInstruction('');
      setMsg('✓ Instruction injected into next evolution cycle');
      setTimeout(() => setMsg(null), 4000);
    } catch (e) { setMsg('✗ ' + (e as Error).message); }
    finally { setInjecting(false); }
  }, [instruction, injecting]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: 20, alignItems: 'start' }}>
      {/* Input */}
      <div style={{ background: '#0d0e14', border: '1px solid #1e2330', borderRadius: 12, padding: '20px 22px' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#f0f0f0', marginBottom: 8 }}>Inject Learning Instruction</div>
        <p style={{ fontSize: 13, color: '#555', marginBottom: 16, lineHeight: 1.6 }}>
          Write a natural-language instruction that will be applied during the next evolution cycle.
        </p>

        <div style={{ marginBottom: 10 }}>
          <Label text="Instruction" />
          <textarea
            value={instruction}
            onChange={e => setInstruction(e.target.value)}
            placeholder={`e.g. "Increase urgency hooks for SaaS campaigns"\ne.g. "Deprioritize price-focused angle for premium brands"\ne.g. "When fatigue > 0.7, force exploration on top 3 angles"`}
            rows={5}
            style={{ width: '100%', padding: '10px 12px', background: '#0a0b10', border: '1px solid #1e2330', borderRadius: 8, color: '#f0f0f0', fontSize: 13, fontFamily: 'inherit', outline: 'none', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.6 }}
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: '#444', marginBottom: 6 }}>Example instructions:</div>
          {[
            'Increase urgency hooks for SaaS',
            'Deprioritize price-focused for luxury brands',
            'Boost exploration when win rate < 30%',
            'Use storytelling angle for B2B campaigns',
          ].map(ex => (
            <button
              key={ex}
              onClick={() => setInstruction(ex)}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '5px 8px', marginBottom: 4, background: '#0a0b10', border: '1px solid #1e2330', borderRadius: 5, color: '#555', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              → {ex}
            </button>
          ))}
        </div>

        <ActionBtn onClick={handleInject} disabled={!instruction.trim() || injecting} label="🧬 Inject Instruction" loadingLabel="Injecting…" color="#22c55e" />
        {msg && <div style={{ marginTop: 10, fontSize: 12, color: msg.startsWith('✓') ? '#22c55e' : '#f87171' }}>{msg}</div>}
      </div>

      {/* Log */}
      <div style={{ background: '#0d0e14', border: '1px solid #1e2330', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '10px 16px', borderBottom: '1px solid #111318', fontSize: 13, fontWeight: 700, color: '#f0f0f0' }}>
          Injection History
        </div>
        {loading ? (
          <div style={{ padding: 16, fontSize: 12, color: '#333' }}>Loading…</div>
        ) : log.length === 0 ? (
          <div style={{ padding: 16, fontSize: 12, color: '#333' }}>No injections yet</div>
        ) : (
          <div style={{ maxHeight: 440, overflowY: 'auto' }}>
            {log.map(entry => (
              <div key={entry.id} style={{ padding: '12px 16px', borderBottom: '1px solid #0f1014' }}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: entry.applied ? '#22c55e' : '#f59e0b' }}>{entry.applied ? '✓ APPLIED' : '⏳ PENDING'}</span>
                  <span style={{ fontSize: 10, color: '#333' }}>{new Date(entry.timestamp).toLocaleString()}</span>
                </div>
                <div style={{ fontSize: 13, color: '#c0c0c0', marginBottom: entry.result ? 4 : 0 }}>{entry.instruction}</div>
                {entry.result && <div style={{ fontSize: 11, color: '#555', fontStyle: 'italic' }}>{entry.result}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── LOOP CONTROL PANEL (autonomous loop mode + audit) ───────────────────────

function LoopControlPanel() {
  const [status,    setStatus]   = useState<AutonomousLoopStatus | null>(null);
  const [audit,     setAudit]    = useState<AutonomousLoopAuditEntry[]>([]);
  const [switching, setSwitching]= useState(false);
  const [loading,   setLoading]  = useState(true);
  const [selected,  setSelected] = useState<AutonomousLoopAuditEntry | null>(null);

  const MODE_META: Record<AutonomousLoopMode, { color: string; bg: string }> = {
    MANUAL:     { color: '#6b7280', bg: 'rgba(107,114,128,0.08)' },
    HYBRID:     { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)'  },
    AUTONOMOUS: { color: '#22c55e', bg: 'rgba(34,197,94,0.08)'   },
  };

  useEffect(() => {
    Promise.all([
      getAutonomousLoopStatus().then(setStatus).catch(() => {}),
      getAutonomousLoopAudit(50).then(setAudit).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  const handleSetMode = useCallback(async (mode: AutonomousLoopMode) => {
    setSwitching(true);
    try {
      const r = await setAutonomousLoopMode(mode);
      setStatus(prev => prev ? { ...prev, mode: r.mode } : null);
    } catch { /* ignore */ } finally { setSwitching(false); }
  }, []);

  const handleRollback = useCallback(async (id: string) => {
    await rollbackAutonomousAction(id).catch(() => {});
    const updated = await getAutonomousLoopAudit(50).catch(() => []);
    setAudit(updated);
  }, []);

  if (loading) return <div style={{ fontSize: 12, color: '#333', padding: 20 }}>Loading…</div>;

  const currentMode = status?.mode ?? 'MANUAL';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Mode selector */}
      <div>
        <Label text="Operating Mode" />
        <div style={{ display: 'flex', gap: 10 }}>
          {(['MANUAL', 'HYBRID', 'AUTONOMOUS'] as AutonomousLoopMode[]).map(mode => {
            const meta     = MODE_META[mode];
            const selected = currentMode === mode;
            return (
              <button
                key={mode}
                onClick={() => !selected && !switching && handleSetMode(mode)}
                disabled={switching || selected}
                style={{
                  padding: '10px 20px', borderRadius: 8, fontFamily: 'inherit',
                  background: selected ? meta.bg : '#0d0e14',
                  border: `2px solid ${selected ? meta.color : '#1e2330'}`,
                  color: selected ? meta.color : '#555',
                  fontWeight: selected ? 700 : 400,
                  fontSize: 13, cursor: selected ? 'default' : 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {mode}
                {selected && <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 800, background: `${meta.color}22`, padding: '1px 5px', borderRadius: 3 }}>ACTIVE</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Status row */}
      {status && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
          {[
            { label: 'Running',       value: status.running ? '● Yes' : '○ No',               color: status.running ? '#22c55e' : '#555' },
            { label: 'Cycles',        value: String(status.cycleCount),                         color: '#c0c0c0' },
            { label: 'Stability',     value: `${Math.round(status.stabilityScore * 100)}%`,     color: status.stabilityScore > 0.7 ? '#22c55e' : '#f59e0b' },
            { label: 'Safety Lock',   value: status.safetyLock ? '🔒 ON' : '🔓 OFF',           color: status.safetyLock ? '#f87171' : '#22c55e' },
            { label: 'Pending',       value: String(status.pendingActions),                     color: status.pendingActions > 0 ? '#f59e0b' : '#555' },
          ].map(s => (
            <div key={s.label} style={{ padding: '10px 12px', background: '#0d0e14', border: '1px solid #1e2330', borderRadius: 8 }}>
              <div style={{ fontSize: 10, color: '#444', marginBottom: 2 }}>{s.label}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Audit log */}
      <div>
        <Label text={`Audit Log (${audit.length} entries)`} />
        {audit.length === 0 ? (
          <div style={{ padding: '24px', background: '#0d0e14', border: '1px solid #1e2330', borderRadius: 10, fontSize: 12, color: '#333', textAlign: 'center' }}>
            No audit entries yet
          </div>
        ) : (
          <div style={{ background: '#0d0e14', border: '1px solid #1e2330', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 80px 80px 60px', padding: '7px 14px', background: '#0a0b10', borderBottom: '1px solid #1e2330', fontSize: 10, fontWeight: 700, color: '#333', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              <span>Time</span><span>Action</span><span>Outcome</span><span>Risk</span><span></span>
            </div>
            {audit.map((e, i) => {
              const oc = OUTCOME_COLORS[e.outcome] ?? '#888';
              return (
                <div
                  key={e.id}
                  onClick={() => setSelected(selected?.id === e.id ? null : e)}
                  style={{ display: 'grid', gridTemplateColumns: '140px 1fr 80px 80px 60px', padding: '9px 14px', borderBottom: i < audit.length - 1 ? '1px solid #0f1014' : 'none', cursor: 'pointer', background: selected?.id === e.id ? 'rgba(99,102,241,0.04)' : 'transparent', alignItems: 'center' }}
                >
                  <span style={{ fontSize: 10, color: '#333', fontFamily: 'monospace' }}>{new Date(e.timestamp).toLocaleTimeString()}</span>
                  <span style={{ fontSize: 12, color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.action}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: oc }}>{e.outcome}</span>
                  <span style={{ fontSize: 10, color: '#555' }}>{(e as { riskLevel?: string }).riskLevel ?? '—'}</span>
                  {e.outcome === 'success' && (
                    <button onClick={ev => { ev.stopPropagation(); handleRollback(e.id); }} style={{ padding: '3px 8px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 4, color: '#fbbf24', fontSize: 10, cursor: 'pointer', fontFamily: 'inherit' }}>↩</button>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {selected && (
          <div style={{ marginTop: 10, padding: '14px 16px', background: '#0d0e14', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#f0f0f0' }}>Decision Trace</span>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: '#444', cursor: 'pointer' }}>×</button>
            </div>
            <pre style={{ fontSize: 11, color: '#888', fontFamily: 'monospace', background: '#0a0b10', padding: 12, borderRadius: 6, overflow: 'auto', maxHeight: 240, lineHeight: 1.5, margin: 0 }}>
              {JSON.stringify(selected, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SelfImprovingLoopPage() {
  const [subTab, setSubTab] = useState<SubTab>('evolution');

  const panels: Record<SubTab, React.ReactNode> = {
    'evolution':     <EvolutionPanel />,
    'weights':       <WeightsPanel />,
    'rules':         <RulesPanel />,
    'hook-strategy': <HookStrategyPanel />,
    'self-learning': <SelfLearningPanel />,
    'loop-control':  <LoopControlPanel />,
  };

  return (
    <div style={{ maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
          <a href="/admin/observability" style={{ fontSize: 13, color: '#444', textDecoration: 'none' }}>← Observability Hub</a>
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 4 }}>🔧 Self-Improving Loop</h1>
        <p style={{ fontSize: 13, color: '#555' }}>Evolution engine controls, memory weight editor, orchestrator rules, hook strategy, self-learning injection.</p>
      </div>

      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: 2, padding: 4, background: '#0a0b10', border: '1px solid #1e2330', borderRadius: 9, marginBottom: 22, flexWrap: 'wrap', width: 'fit-content' }}>
        {SUBTABS.map(t => (
          <button key={t.id} onClick={() => setSubTab(t.id)} style={{ padding: '7px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', background: subTab === t.id ? '#1e2330' : 'transparent', color: subTab === t.id ? '#f0f0f0' : '#555', fontSize: 12, fontWeight: subTab === t.id ? 600 : 400, fontFamily: 'inherit', whiteSpace: 'nowrap', transition: 'all 0.15s' }}>
            {t.label}
          </button>
        ))}
      </div>

      {panels[subTab]}
    </div>
  );
}
