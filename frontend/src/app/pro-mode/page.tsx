'use client';
import { useEffect, useState, useCallback } from 'react';
import { Sidebar } from '@/components/Sidebar';
import {
  getOrchestratorRules, getMemoryWeights, getHookStrategy,
  getAdminAuditLog, getSelfLearningLog, getEvolutionLog, getFatigueAll,
  getExplorationStatus, getAutoWinnerStatus, getHookBoosterStatus,
  getSceneRewriterStatus, mirofishLearningStatus, getEmergenceState,
  type OrchestratorRule, type MemoryWeights, type HookStrategyConfig,
  type AdminAuditEntry, type SelfLearningEntry,
} from '@/lib/api/creator-client';

type Tab = 'evolution' | 'orchestrator' | 'memory' | 'hook' | 'fatigue' | 'exploration' | 'audit' | 'learning';

function WeightBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="weight-bar-row">
      <div className="weight-bar-labels">
        <span className="weight-bar-label">{label}</span>
        <span className="weight-bar-value" style={{ color }}>{(value * 100).toFixed(0)}%</span>
      </div>
      <div className="weight-bar-track">
        <div className="weight-bar-fill" style={{ width: `${value * 100}%`, background: color }} />
      </div>
    </div>
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  return <span className="badge" style={{ color, background: `${color}18` }}>{label}</span>;
}

function ServiceCard({ name, status, error }: { name: string; status: 'loading' | 'ok' | 'error'; error?: string }) {
  const color = status === 'ok' ? 'var(--emerald)' : status === 'error' ? 'var(--rose)' : 'var(--amber)';
  const colorHex = status === 'ok' ? '#10b981' : status === 'error' ? '#ef4444' : '#f59e0b';
  return (
    <div className="service-card" style={{ border: `1px solid ${colorHex}22` }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{name}</span>
      <div>
        <Badge label={status === 'ok' ? 'OK' : status === 'error' ? 'ERROR' : '…'} color={color} />
        {error && <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{error.slice(0, 35)}</div>}
      </div>
    </div>
  );
}

const TABS: { key: Tab; label: string }[] = [
  { key: 'evolution',    label: '🔄 Evolution'     },
  { key: 'orchestrator', label: '⚡ Orchestrator'  },
  { key: 'memory',       label: '🧠 Memory'        },
  { key: 'hook',         label: '🎣 Hook Strategy' },
  { key: 'fatigue',      label: '😴 Fatigue'       },
  { key: 'exploration',  label: '🔭 Exploration'   },
  { key: 'audit',        label: '📋 Audit Log'     },
  { key: 'learning',     label: '📚 Self-Learning' },
];

export default function ProModePage() {
  const [tab,             setTab]             = useState<Tab>('evolution');
  const [orchRules,       setOrchRules]       = useState<OrchestratorRule[] | null>(null);
  const [memWeights,      setMemWeights]      = useState<MemoryWeights | null>(null);
  const [hookCfg,         setHookCfg]         = useState<HookStrategyConfig | null>(null);
  const [auditLog,        setAuditLog]        = useState<AdminAuditEntry[] | null>(null);
  const [learningLog,     setLearningLog]     = useState<SelfLearningEntry[] | null>(null);
  const [fatigueData,     setFatigueData]     = useState<unknown>(null);
  const [explorationData, setExplorationData] = useState<unknown>(null);
  const [evolutionData,   setEvolutionData]   = useState<unknown>(null);
  const [services, setServices] = useState<Record<string, { status: 'loading' | 'ok' | 'error'; error?: string }>>({
    'Auto-Winner': { status: 'loading' }, 'Hook Booster': { status: 'loading' },
    'Scene Rewriter': { status: 'loading' }, 'Mirofish': { status: 'loading' }, 'Emergence': { status: 'loading' },
  });

  const probe = useCallback(async (name: string, fn: () => Promise<unknown>) => {
    try { await fn(); setServices(p => ({ ...p, [name]: { status: 'ok' } })); }
    catch (e) { setServices(p => ({ ...p, [name]: { status: 'error', error: e instanceof Error ? e.message : 'Failed' } })); }
  }, []);

  useEffect(() => {
    getOrchestratorRules().then(setOrchRules).catch(() => setOrchRules([]));
    getMemoryWeights().then(setMemWeights).catch(() => {});
    getHookStrategy().then(setHookCfg).catch(() => {});
    getAdminAuditLog(50).then(setAuditLog).catch(() => setAuditLog([]));
    getSelfLearningLog().then(setLearningLog).catch(() => setLearningLog([]));
    getFatigueAll().then(setFatigueData).catch(() => {});
    getExplorationStatus().then(setExplorationData).catch(() => {});
    getEvolutionLog(10).then(setEvolutionData).catch(() => {});
    probe('Auto-Winner',    () => getAutoWinnerStatus());
    probe('Hook Booster',   () => getHookBoosterStatus());
    probe('Scene Rewriter', () => getSceneRewriterStatus());
    probe('Mirofish',       () => mirofishLearningStatus());
    probe('Emergence',      () => getEmergenceState());
  }, [probe]);

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-main">
        <div className="page-content">
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>🔬 Pro Diagnostics</h1>
          <p style={{ fontSize: 13, color: 'var(--sub)', marginBottom: 24 }}>All internal subsystems. Real API calls only.</p>

          {/* Service health */}
          <div className="section-label">Service Health</div>
          <div className="intel-stats-grid intel-stats-grid-5" style={{ marginBottom: 24 }}>
            {Object.entries(services).map(([n, s]) => <ServiceCard key={n} name={n} status={s.status} error={s.error} />)}
          </div>

          {/* Tabs */}
          <div className="tab-bar">
            {TABS.map(t => (
              <button key={t.key} className={`tab-btn${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {(tab === 'evolution' || tab === 'fatigue' || tab === 'exploration') && (
            <pre style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 16, fontSize: 11, fontFamily: 'var(--mono)', color: tab === 'fatigue' ? 'var(--rose)' : tab === 'exploration' ? 'var(--purple)' : 'var(--indigo-l)', overflow: 'auto', maxHeight: 500 }}>
              {JSON.stringify(tab === 'evolution' ? evolutionData : tab === 'fatigue' ? fatigueData : explorationData, null, 2) ?? 'Loading…'}
            </pre>
          )}

          {tab === 'orchestrator' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {orchRules == null ? <span style={{ color: 'var(--muted)', fontSize: 13 }}>Loading…</span>
               : orchRules.length === 0 ? <span style={{ color: 'var(--muted)', fontSize: 13 }}>No rules configured.</span>
               : orchRules.map((r, i) => (
                <div key={r.id ?? i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px', display: 'grid', gridTemplateColumns: 'auto 1fr 1fr auto', gap: 12, alignItems: 'center', opacity: r.enabled ? 1 : 0.4 }}>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>#{r.priority}</span>
                  <div><div style={{ fontSize: 10, color: 'var(--muted)' }}>Condition</div><code style={{ fontSize: 12, color: '#a5b4fc' }}>{r.condition}</code></div>
                  <div><div style={{ fontSize: 10, color: 'var(--muted)' }}>Action</div><code style={{ fontSize: 12, color: '#f59e0b' }}>{r.action}</code></div>
                  <Badge label={r.enabled ? 'ON' : 'OFF'} color={r.enabled ? '#10b981' : '#555'} />
                </div>
              ))}
            </div>
          )}

          {tab === 'memory' && (
            <div style={{ maxWidth: 400 }}>
              {memWeights == null ? <span style={{ color: 'var(--muted)', fontSize: 13 }}>Loading…</span> : <>
                <WeightBar label="CTR"        value={memWeights.ctr}        color="#6366f1" />
                <WeightBar label="Conversion" value={memWeights.conversion} color="#10b981" />
                <WeightBar label="Engagement" value={memWeights.engagement} color="#f59e0b" />
                <WeightBar label="Clarity"    value={memWeights.clarity}    color="#ec4899" />
                <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 6 }}>Updated: {memWeights.updatedAt}</div>
              </>}
            </div>
          )}

          {tab === 'hook' && (
            <div style={{ maxWidth: 400 }}>
              {hookCfg == null ? <span style={{ color: 'var(--muted)', fontSize: 13 }}>Loading…</span> : <>
                <WeightBar label="Emotional" value={hookCfg.emotional} color="#ec4899" />
                <WeightBar label="Urgency"   value={hookCfg.urgency}   color="#ef4444" />
                <WeightBar label="Rational"  value={hookCfg.rational}  color="#3b82f6" />
                <WeightBar label="Curiosity" value={hookCfg.curiosity} color="#8b5cf6" />
                <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 6 }}>Updated: {hookCfg.updatedAt}</div>
              </>}
            </div>
          )}

          {tab === 'audit' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {auditLog == null ? <span style={{ color: 'var(--muted)', fontSize: 13 }}>Loading…</span>
               : auditLog.length === 0 ? <span style={{ color: 'var(--muted)', fontSize: 13 }}>No audit entries yet.</span>
               : auditLog.map(e => {
                const rc = e.riskLevel === 'HIGH' ? '#ef4444' : e.riskLevel === 'MEDIUM' ? '#f59e0b' : '#10b981';
                return (
                  <div key={e.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', display: 'grid', gridTemplateColumns: 'auto 1fr auto auto', gap: 10, alignItems: 'center' }}>
                    <span style={{ fontSize: 10, color: 'var(--muted)' }}>{new Date(e.timestamp).toLocaleTimeString()}</span>
                    <div><div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{e.decision}</div><div style={{ fontSize: 11, color: 'var(--muted)' }}>{e.triggerSource} · {e.predictedImpact}</div></div>
                    <Badge label={e.riskLevel} color={rc} />
                    <Badge label={e.applied ? 'APPLIED' : 'PENDING'} color={e.applied ? '#10b981' : '#555'} />
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'learning' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {learningLog == null ? <span style={{ color: 'var(--muted)', fontSize: 13 }}>Loading…</span>
               : learningLog.length === 0 ? <span style={{ color: 'var(--muted)', fontSize: 13 }}>No entries yet.</span>
               : learningLog.map(e => (
                <div key={e.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px' }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 10, color: 'var(--muted)' }}>{new Date(e.timestamp).toLocaleString()}</span>
                    <Badge label={e.applied ? 'APPLIED' : 'QUEUED'} color={e.applied ? '#10b981' : '#f59e0b'} />
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text)', marginBottom: 4 }}>{e.instruction}</div>
                  {e.result && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{e.result}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
