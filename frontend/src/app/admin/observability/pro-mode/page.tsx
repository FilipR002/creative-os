'use client';
// ─── Admin Observability: Pro Mode Dashboard ──────────────────────────────────
// Full system control panel: Evolution, Fatigue, Exploration, Hook Strategy,
// MIROFISH Learning, Causal System Viewer — all on one admin page.

import { useEffect, useState, useCallback } from 'react';
import {
  getLearningStatus,
  getGlobalStats,
  getEvolutionLogTyped,
  getEvolutionMutations,
  getEvolutionStatus,
  forceMutateAngle,
  getFatigueAll,
  getExplorationPressure,
  boostExploration,
  getEmergenceState,
  refreshEmergenceState,
  mirofishLearningStatus,
  mirofishRunLearningLoop,
  type LearningStatus,
  type GlobalStats,
  type EvolutionLogEntry,
  type AngleFatigueEntry,
  type EmergenceState,
  type ExplorationPressureResult,
} from '@/lib/api/creator-client';

// ─── Shared card wrapper ──────────────────────────────────────────────────────

function Card({
  title, icon, children, accent = '#6366f1',
}: {
  title: string; icon: string; children: React.ReactNode; accent?: string;
}) {
  return (
    <div style={{
      background: '#0d0e14', border: '1px solid #1e2330',
      borderRadius: 12, overflow: 'hidden',
    }}>
      <div style={{
        padding: '12px 18px', borderBottom: '1px solid #111318',
        display: 'flex', alignItems: 'center', gap: 8,
        background: `linear-gradient(90deg, ${accent}0a, transparent)`,
      }}>
        <span>{icon}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#f0f0f0', letterSpacing: '-0.01em' }}>
          {title}
        </span>
      </div>
      <div style={{ padding: '16px 18px' }}>{children}</div>
    </div>
  );
}

function MetricRow({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid #0f1014' }}>
      <span style={{ fontSize: 12, color: '#555' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: color ?? '#f0f0f0' }}>{value}</span>
    </div>
  );
}

const FATIGUE_COLORS: Record<string, string> = {
  HEALTHY: '#22c55e', WARMING: '#f59e0b', FATIGUED: '#ef4444', BLOCKED: '#7f1d1d',
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProModeAdminPage() {
  // Learning
  const [learningStatus,   setLearningStatus]   = useState<LearningStatus | null>(null);
  const [globalStats,      setGlobalStats]      = useState<GlobalStats | null>(null);
  const [decisionLog,      setDecisionLog]      = useState<EvolutionLogEntry[]>([]);
  const [liveLog,          setLiveLog]          = useState<EvolutionLogEntry[]>([]);

  // Evolution
  const [evMutations,      setEvMutations]      = useState<unknown[]>([]);
  const [evStatus,         setEvStatus]         = useState<Record<string, unknown> | null>(null);
  const [forceMutating,    setForceMutating]    = useState(false);
  const [forceMutateSlug,  setForceMutateSlug]  = useState('');
  const [forceMutateResult,setForceMutateResult]= useState<string | null>(null);

  // Fatigue
  const [fatigueAll,       setFatigueAll]       = useState<AngleFatigueEntry[]>([]);

  // Exploration
  const [exploration,      setExploration]      = useState<ExplorationPressureResult | null>(null);
  const [boosting,         setBoosting]         = useState(false);

  // Emergence
  const [emergence,        setEmergence]        = useState<EmergenceState | null>(null);
  const [refreshingEmergence, setRefreshingEmergence] = useState(false);

  // MIROFISH
  const [mirofishStatus,   setMirofishStatus]   = useState<Record<string, unknown> | null>(null);
  const [mirofishRunning,  setMirofishRunning]  = useState(false);
  const [mirofishCampaign, setMirofishCampaign] = useState('');

  const [loading,          setLoading]          = useState(true);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([
      getLearningStatus().then(setLearningStatus).catch(() => {}),
      getGlobalStats().then(setGlobalStats).catch(() => {}),
      getEvolutionLogTyped(20).then(setDecisionLog).catch(() => {}),
      getEvolutionLogTyped(20).then(setLiveLog).catch(() => {}),
      getEvolutionMutations().then(d => setEvMutations(Array.isArray(d) ? d as unknown[] : [])).catch(() => {}),
      getEvolutionStatus().then(d => setEvStatus(d as unknown as Record<string, unknown>)).catch(() => {}),
      getFatigueAll().then(setFatigueAll).catch(() => {}),
      getExplorationPressure().then(setExploration).catch(() => {}),
      getEmergenceState().then(setEmergence).catch(() => {}),
      mirofishLearningStatus().then(d => setMirofishStatus(d as Record<string, unknown>)).catch(() => {}),
    ]);
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleForceMutate = useCallback(async () => {
    if (forceMutating || !forceMutateSlug) return;
    setForceMutating(true);
    setForceMutateResult(null);
    try {
      const r = await forceMutateAngle(forceMutateSlug);
      setForceMutateResult(`✓ Mutation triggered — ${JSON.stringify(r).slice(0, 80)}`);
      await getEvolutionMutations().then(d => setEvMutations(Array.isArray(d) ? d as unknown[] : [])).catch(() => {});
    } catch (err) {
      setForceMutateResult(`✗ ${(err as Error).message}`);
    } finally {
      setForceMutating(false);
    }
  }, [forceMutating, forceMutateSlug]);

  const handleBoostExploration = useCallback(async () => {
    setBoosting(true);
    try {
      await boostExploration({ amount: 0.1, reason: 'manual admin boost' });
      const r = await getExplorationPressure();
      setExploration(r);
    } catch { /* ignore */ } finally {
      setBoosting(false);
    }
  }, []);

  const handleRefreshEmergence = useCallback(async () => {
    setRefreshingEmergence(true);
    try {
      const r = await refreshEmergenceState();
      setEmergence(r);
    } catch { /* ignore */ } finally {
      setRefreshingEmergence(false);
    }
  }, []);

  const handleRunMirofish = useCallback(async () => {
    if (mirofishRunning || !mirofishCampaign) return;
    setMirofishRunning(true);
    try {
      await mirofishRunLearningLoop(mirofishCampaign);
      const r = await mirofishLearningStatus();
      setMirofishStatus(r as Record<string, unknown>);
    } catch { /* ignore */ } finally {
      setMirofishRunning(false);
    }
  }, [mirofishRunning, mirofishCampaign]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: 1100 }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 6 }}>
          🔬 Pro Mode Admin Dashboard
        </h1>
        <p style={{ fontSize: 14, color: '#555' }}>
          Full system control — evolution engine, fatigue heatmap, exploration, MIROFISH learning, causal analysis.
        </p>
        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <button
            onClick={loadAll}
            disabled={loading}
            style={{
              padding: '8px 16px', background: 'rgba(99,102,241,0.1)',
              border: '1px solid rgba(99,102,241,0.25)', borderRadius: 8,
              color: loading ? '#444' : '#a5b4fc', fontSize: 13,
              cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
            }}
          >
            {loading ? 'Loading…' : '↻ Refresh All'}
          </button>
          <a href="/admin/observability/self-improving-loop" style={{
            padding: '8px 16px', background: 'transparent',
            border: '1px solid #1e2330', borderRadius: 8,
            color: '#555', fontSize: 13, textDecoration: 'none',
          }}>
            Self-Improving Loop →
          </a>
          <a href="/app/admin/registry-ui" style={{
            padding: '8px 16px', background: 'transparent',
            border: '1px solid #1e2330', borderRadius: 8,
            color: '#555', fontSize: 13, textDecoration: 'none',
          }}>
            Endpoint Registry →
          </a>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>

        {/* ── Learning Status ──────────────────────────────────────────── */}
        <Card title="Learning System" icon="🧠" accent="#6366f1">
          {learningStatus ? (
            <>
              <MetricRow label="Cycles Run"        value={learningStatus.system.totalLearningCycles} />
              <MetricRow label="Angles Tracked"    value={learningStatus.system.anglesTracked}       />
              <MetricRow label="Health"             value={learningStatus.system.learningHealth}      />
              <MetricRow label="Dominant Angle"     value={learningStatus.system.dominanceAngle}      />
              <MetricRow label="Exploration Signal" value={learningStatus.system.explorationSignal.toFixed(4)} />
            </>
          ) : (
            <div style={{ fontSize: 12, color: '#333' }}>No data</div>
          )}
        </Card>

        {/* ── Global Stats ─────────────────────────────────────────────── */}
        <Card title="Global Intelligence Stats" icon="📊" accent="#22c55e">
          {globalStats ? (
            <>
              {globalStats.globalWinner && <MetricRow label="Global Winner" value={globalStats.globalWinner} color="#22c55e" />}
              {(globalStats.topAngles ?? []).slice(0, 5).map(a => (
                <MetricRow key={a.slug} label={a.slug} value={`${a.avgScore.toFixed(3)} avg`} />
              ))}
            </>
          ) : (
            <div style={{ fontSize: 12, color: '#333' }}>No data</div>
          )}
        </Card>

        {/* ── Evolution Engine ─────────────────────────────────────────── */}
        <Card title="Evolution Engine" icon="⚙️" accent="#f59e0b">
          {evStatus && (
            <div style={{ marginBottom: 14 }}>
              {Object.entries(evStatus as Record<string, unknown>).slice(0, 4).map(([k, v]) => (
                <MetricRow key={k} label={k} value={String(v)} />
              ))}
            </div>
          )}

          {/* Force mutate control */}
          <div style={{ marginTop: 14, padding: '12px 14px', background: '#0a0b10', borderRadius: 8, border: '1px solid #1e2330' }}>
            <div style={{ fontSize: 11, color: '#444', marginBottom: 8 }}>Force Mutation</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={forceMutateSlug}
                onChange={e => setForceMutateSlug(e.target.value)}
                placeholder="angle slug…"
                style={{
                  flex: 1, padding: '7px 10px', background: '#0d0e14',
                  border: '1px solid #1e2330', borderRadius: 6, color: '#f0f0f0',
                  fontSize: 12, fontFamily: 'inherit', outline: 'none',
                }}
              />
              <button
                onClick={handleForceMutate}
                disabled={forceMutating || !forceMutateSlug}
                style={{
                  padding: '7px 14px', background: forceMutating ? '#1a1b22' : 'rgba(245,158,11,0.1)',
                  border: '1px solid rgba(245,158,11,0.3)', borderRadius: 6,
                  color: forceMutating ? '#444' : '#fbbf24', fontSize: 12,
                  cursor: forceMutating ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                }}
              >
                {forceMutating ? 'Running…' : 'Mutate'}
              </button>
            </div>
            {forceMutateResult && (
              <div style={{ marginTop: 8, fontSize: 11, color: forceMutateResult.startsWith('✓') ? '#22c55e' : '#f87171' }}>
                {forceMutateResult}
              </div>
            )}
          </div>

          {/* Recent mutations */}
          {evMutations.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 11, color: '#444', marginBottom: 8 }}>Recent Mutations ({evMutations.length})</div>
              {(evMutations as Record<string, unknown>[]).slice(0, 4).map((m, i) => (
                <div key={i} style={{ fontSize: 11, color: '#555', padding: '4px 0', borderBottom: '1px solid #0f1014' }}>
                  {m.slug ? String(m.slug) : `mutation-${i}`}
                  {Boolean(m.status) && <span style={{ marginLeft: 8, color: '#888' }}>{String(m.status)}</span>}
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* ── Emergence & Drift ────────────────────────────────────────── */}
        <Card title="Emergence & Drift" icon="🌊" accent="#3b82f6">
          {emergence ? (
            <>
              <MetricRow label="Status"    value={emergence.status}    color={emergence.status === 'stable' ? '#22c55e' : '#f59e0b'} />
              {emergence.driftScore    !== undefined && <MetricRow label="Drift Score"       value={emergence.driftScore.toFixed(3)}   />}
              {emergence.confidence    !== undefined && <MetricRow label="Confidence"        value={`${Math.round(emergence.confidence * 100)}%`} />}
              {emergence.dominantPattern && <MetricRow label="Dominant Pattern"  value={String(emergence.dominantPattern)} />}
              {emergence.warning && (
                <div style={{ marginTop: 10, padding: '8px 10px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 6, fontSize: 11, color: '#fbbf24' }}>
                  ⚠ {emergence.warning}
                </div>
              )}
            </>
          ) : (
            <div style={{ fontSize: 12, color: '#333' }}>No data</div>
          )}
          <button
            onClick={handleRefreshEmergence}
            disabled={refreshingEmergence}
            style={{
              marginTop: 14, padding: '7px 14px', background: 'rgba(59,130,246,0.08)',
              border: '1px solid rgba(59,130,246,0.2)', borderRadius: 6,
              color: refreshingEmergence ? '#444' : '#60a5fa', fontSize: 12,
              cursor: refreshingEmergence ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
            }}
          >
            {refreshingEmergence ? 'Refreshing…' : '↻ Refresh State'}
          </button>
        </Card>

        {/* ── Fatigue Heatmap ──────────────────────────────────────────── */}
        <Card title="Angle Fatigue Heatmap" icon="⚡" accent="#ef4444">
          {fatigueAll.length === 0 ? (
            <div style={{ fontSize: 12, color: '#333' }}>No fatigue data</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {fatigueAll.map(f => (
                <div key={f.slug} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: FATIGUE_COLORS[f.fatigueLevel] ?? '#444', flexShrink: 0,
                  }} />
                  <span style={{ fontSize: 12, color: '#888', flex: 1, fontFamily: 'monospace' }}>{f.slug}</span>
                  <span style={{ fontSize: 11, color: FATIGUE_COLORS[f.fatigueLevel] ?? '#444', fontWeight: 700 }}>
                    {f.fatigueLevel}
                  </span>
                  <div style={{ width: 60, height: 4, background: '#1e2330', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', width: `${Math.min(100, f.fatigueScore * 100)}%`,
                      background: FATIGUE_COLORS[f.fatigueLevel] ?? '#444', borderRadius: 2,
                    }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* ── Exploration Pressure ─────────────────────────────────────── */}
        <Card title="Exploration Pressure" icon="🔬" accent="#a78bfa">
          {exploration ? (
            <>
              <MetricRow
                label="Pressure Delta"
                value={exploration.exploration_pressure_delta.toFixed(4)}
                color={exploration.exploration_pressure_delta > 0.5 ? '#22c55e' : '#f59e0b'}
              />
              <MetricRow label="Confidence" value={`${Math.round(exploration.confidence * 100)}%`} />
              <MetricRow label="Memory"     value={exploration.breakdown.memory.toFixed(3)}  />
              <MetricRow label="Fatigue"    value={exploration.breakdown.fatigue.toFixed(3)} />
              <MetricRow label="MIROFISH"   value={exploration.breakdown.mirofish.toFixed(3)}/>
              <MetricRow label="Base"       value={exploration.breakdown.base.toFixed(3)}    />
              {exploration.risk_flags.length > 0 && (
                <div style={{ marginTop: 10, fontSize: 11, color: '#f59e0b' }}>
                  ⚠ {exploration.risk_flags.join(' · ')}
                </div>
              )}
            </>
          ) : (
            <div style={{ fontSize: 12, color: '#333' }}>No data</div>
          )}
          <button
            onClick={handleBoostExploration}
            disabled={boosting}
            style={{
              marginTop: 14, padding: '7px 14px',
              background: boosting ? '#1a1b22' : 'rgba(167,139,250,0.08)',
              border: '1px solid rgba(167,139,250,0.2)', borderRadius: 6,
              color: boosting ? '#444' : '#a78bfa', fontSize: 12,
              cursor: boosting ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
            }}
          >
            {boosting ? 'Boosting…' : '+0.1 Boost Exploration'}
          </button>
        </Card>

        {/* ── MIROFISH Learning ────────────────────────────────────────── */}
        <Card title="MIROFISH Learning Loop" icon="🐠" accent="#22c55e">
          {mirofishStatus ? (
            Object.entries(mirofishStatus as Record<string, unknown>).slice(0, 6).map(([k, v]) => (
              <MetricRow key={k} label={k} value={String(v)} />
            ))
          ) : (
            <div style={{ fontSize: 12, color: '#333' }}>No data</div>
          )}
          <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
            <input
              value={mirofishCampaign}
              onChange={e => setMirofishCampaign(e.target.value)}
              placeholder="Campaign ID…"
              style={{
                flex: 1, padding: '7px 10px', background: '#0d0e14',
                border: '1px solid #1e2330', borderRadius: 6, color: '#f0f0f0',
                fontSize: 12, fontFamily: 'inherit', outline: 'none',
              }}
            />
            <button
              onClick={handleRunMirofish}
              disabled={mirofishRunning || !mirofishCampaign}
              style={{
                padding: '7px 14px',
                background: mirofishRunning ? '#1a1b22' : 'rgba(34,197,94,0.08)',
                border: '1px solid rgba(34,197,94,0.2)', borderRadius: 6,
                color: mirofishRunning ? '#444' : '#4ade80', fontSize: 12,
                cursor: mirofishRunning ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
              }}
            >
              {mirofishRunning ? 'Running…' : '▶ Run Loop'}
            </button>
          </div>
        </Card>

        {/* ── AI Decision Log ──────────────────────────────────────────── */}
        <Card title="AI Decision Log" icon="📋" accent="#6b7280">
          {decisionLog.length === 0 ? (
            <div style={{ fontSize: 12, color: '#333' }}>No log entries</div>
          ) : (
            <div style={{ maxHeight: 240, overflowY: 'auto' }}>
              {decisionLog.slice(0, 20).map((entry, i) => (
                <div key={i} style={{ fontSize: 11, color: '#555', padding: '5px 0', borderBottom: '1px solid #0f1014', fontFamily: 'monospace' }}>
                  {JSON.stringify(entry).slice(0, 90)}
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* ── Recent Evolution Log ─────────────────────────────────────── */}
        <Card title="Recent Evolution Log" icon="📡" accent="#3b82f6">
          {liveLog.length === 0 ? (
            <div style={{ fontSize: 12, color: '#333' }}>No entries</div>
          ) : (
            <div style={{ maxHeight: 200, overflowY: 'auto' }}>
              {liveLog.slice(-20).reverse().map((entry, i) => (
                <div key={i} style={{ fontSize: 11, color: '#555', padding: '4px 0', borderBottom: '1px solid #0f1014', fontFamily: 'monospace' }}>
                  {JSON.stringify(entry).slice(0, 90)}
                </div>
              ))}
            </div>
          )}
        </Card>

      </div>
    </div>
  );
}
