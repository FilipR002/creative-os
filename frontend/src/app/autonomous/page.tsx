'use client';
import { useEffect, useState, useCallback } from 'react';
import {
  getAutonomousDashboard, pauseAutonomousSystem, resumeAutonomousSystem,
  stepAutonomousSystem, lockAutonomousSystem, setAutonomousMode,
  connectAutonomousStream,
  type AutonomousDashboard, type AIBrainEvent, type AutonomousMode, type SystemStatus,
} from '@/lib/api/creator-client';

const EVENT_COLORS: Record<string, string> = {
  ANGLE_SELECT:'#6366f1', MUTATION:'#f59e0b', CREATIVE_EVAL:'#10b981',
  FATIGUE_DETECT:'#ef4444', EXPLORATION_TRIGGER:'#8b5cf6', IMPROVEMENT:'#3b82f6',
  LEARNING:'#ec4899', DECISION:'#06b6d4',
};
const STATUS_COLORS: Record<string, string> = {
  ACTIVE:'#10b981', PAUSED:'#f59e0b', LOCKED:'#ef4444', STEPPING:'#6366f1',
};
const MODE_LABELS: Record<AutonomousMode, string> = {
  MANUAL:'🔒 Manual', SUGGEST:'💡 Suggest', AUTONOMOUS:'🤖 Autonomous', AUTO_DEPLOY:'🚀 Auto-Deploy',
};

function ConfBar({ value, color = '#6366f1' }: { value: number; color?: string }) {
  return (
    <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${Math.round(value * 100)}%`, background: color, borderRadius: 2, transition: 'width 0.5s' }} />
    </div>
  );
}

function EventRow({ ev, expanded, onToggle }: { ev: AIBrainEvent; expanded: boolean; onToggle: () => void }) {
  const color = EVENT_COLORS[ev.type] ?? '#888';
  return (
    <div onClick={onToggle} style={{ borderBottom: '1px solid var(--border)', padding: '10px 14px', cursor: 'pointer', background: expanded ? `${color}08` : 'transparent' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: expanded ? 4 : 0 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{ev.title}</span>
            <span style={{ fontSize: 9, fontWeight: 800, color, background: `${color}18`, padding: '1px 6px', borderRadius: 4 }}>{ev.type}</span>
          </div>
          {expanded && (
            <>
              <div style={{ fontSize: 12, color: 'var(--sub)', marginBottom: 6 }}>{ev.detail}</div>
              <ConfBar value={ev.confidence} color={color} />
              <div style={{ display: 'flex', gap: 14, marginTop: 5, fontSize: 10, color: 'var(--muted)' }}>
                <span>Confidence: {(ev.confidence * 100).toFixed(0)}%</span>
                {ev.angleSlug && <span>Angle: {ev.angleSlug}</span>}
                <span>{new Date(ev.timestamp).toLocaleTimeString()}</span>
              </div>
            </>
          )}
        </div>
        <span style={{ fontSize: 10, color: 'var(--muted)' }}>{expanded ? '▲' : '▼'}</span>
      </div>
    </div>
  );
}

export default function AutonomousPage() {
  const [dashboard,    setDashboard]    = useState<AutonomousDashboard | null>(null);
  const [events,       setEvents]       = useState<AIBrainEvent[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [expandedId,   setExpandedId]   = useState<string | null>(null);
  const [actionBusy,   setActionBusy]   = useState(false);
  const [streamOnline, setStreamOnline] = useState(false);

  const loadDashboard = useCallback(async () => {
    try {
      const d = await getAutonomousDashboard();
      setDashboard(d);
      setEvents(prev => {
        const ids = new Set(prev.map(e => e.id));
        return [...(d.recentEvents ?? []).filter(e => !ids.has(e.id)), ...prev].slice(0, 100);
      });
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    loadDashboard();
    const t = setInterval(loadDashboard, 10_000);
    return () => clearInterval(t);
  }, [loadDashboard]);

  useEffect(() => {
    return connectAutonomousStream(
      ev => { setStreamOnline(true); setEvents(p => [ev, ...p].slice(0, 100)); },
      ()  => setStreamOnline(false),
    );
  }, []);

  async function doAction(fn: () => Promise<unknown>) {
    setActionBusy(true);
    try { await fn(); await loadDashboard(); } finally { setActionBusy(false); }
  }

  const status = (dashboard?.status  ?? 'ACTIVE') as SystemStatus;
  const mode   =  dashboard?.mode    ?? 'SUGGEST';
  const health =  dashboard?.systemHealth ?? 'HEALTHY';
  const healthColor = health === 'HEALTHY' ? '#10b981' : health === 'WARNING' ? '#f59e0b' : '#ef4444';

  return (
        <div className="page-content">

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: 0 }}>🤖 Autonomous Intelligence Cockpit</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
              <div className={streamOnline ? 'pulse-dot' : ''} style={{ width: 8, height: 8, borderRadius: '50%', background: streamOnline ? 'var(--emerald)' : 'var(--muted)' }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: streamOnline ? 'var(--emerald)' : 'var(--muted)' }}>{streamOnline ? 'STREAM LIVE' : 'OFFLINE'}</span>
            </div>
          </div>
          <p style={{ fontSize: 13, color: 'var(--sub)', marginBottom: 24 }}>Real-time control of the autonomous AI brain.</p>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
              <div className="spin" style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--indigo)', borderRadius: '50%' }} />
            </div>
          ) : (
            <>
              {/* Status banner */}
              <div style={{ background: 'var(--surface)', border: `1px solid ${STATUS_COLORS[status]}44`, borderRadius: 10, padding: '12px 16px', marginBottom: 20, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: STATUS_COLORS[status] }} />
                  <span style={{ fontWeight: 700, fontSize: 13, color: STATUS_COLORS[status] }}>{status}</span>
                </div>
                <span style={{ fontSize: 12, color: 'var(--sub)' }}>Mode: <strong style={{ color: 'var(--text)' }}>{MODE_LABELS[mode as AutonomousMode]}</strong></span>
                <span style={{ fontSize: 12, color: 'var(--sub)' }}>Health: <strong style={{ color: healthColor }}>{health}</strong></span>
                {dashboard?.lastCycleAt && <span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 'auto' }}>Last cycle: {new Date(dashboard.lastCycleAt).toLocaleTimeString()}</span>}
              </div>

              {/* Stats */}
              <div className="intel-stats-grid intel-stats-grid-6" style={{ marginBottom: 24 }}>
                {[
                  { label: 'Campaigns',    value: dashboard?.activeCampaigns ?? '—', color: 'var(--indigo-l)' },
                  { label: 'Mutations',    value: dashboard?.totalMutations  ?? '—', color: 'var(--amber)'    },
                  { label: 'Champions',    value: dashboard?.champions       ?? '—', color: 'var(--emerald)'  },
                  { label: 'Queued',       value: dashboard?.queuedDecisions ?? '—', color: 'var(--cyan)'     },
                  { label: 'Confidence',   value: `${((dashboard?.confidence ?? 0) * 100).toFixed(0)}%`, color: 'var(--purple)' },
                  { label: 'Explore Rate', value: `${((dashboard?.explorationRate ?? 0) * 100).toFixed(0)}%`, color: 'var(--pink)' },
                ].map(s => (
                  <div key={s.label} className="intel-stat-card">
                    <div className="intel-stat-label">{s.label}</div>
                    <div className="intel-stat-value" style={{ color: s.color }}>{s.value}</div>
                  </div>
                ))}
              </div>

              {/* Two-column: controls + stream */}
              <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 16 }}>

                {/* Control Panel */}
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 16 }}>
                  <div className="section-label" style={{ marginBottom: 12 }}>Control Panel</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
                    {[
                      { label: '⏸ Pause',  fn: pauseAutonomousSystem,  color: '#f59e0b', disabled: status === 'PAUSED' },
                      { label: '▶ Resume', fn: resumeAutonomousSystem, color: '#10b981', disabled: status === 'ACTIVE' },
                      { label: '⏭ Step',   fn: stepAutonomousSystem,   color: '#6366f1', disabled: false },
                      { label: '🔒 Lock',  fn: lockAutonomousSystem,   color: '#ef4444', disabled: status === 'LOCKED' },
                    ].map(btn => (
                      <button key={btn.label} disabled={actionBusy || btn.disabled} onClick={() => doAction(btn.fn)}
                        style={{ padding: '8px 4px', background: `${btn.color}14`, border: `1px solid ${btn.color}33`, borderRadius: 7, color: btn.disabled ? 'var(--muted)' : btn.color, fontSize: 11, fontWeight: 700, cursor: btn.disabled || actionBusy ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: btn.disabled ? 0.4 : 1 }}>
                        {btn.label}
                      </button>
                    ))}
                  </div>
                  <div className="section-label" style={{ marginBottom: 8 }}>Mode</div>
                  {(['MANUAL', 'SUGGEST', 'AUTONOMOUS', 'AUTO_DEPLOY'] as AutonomousMode[]).map(m => (
                    <button key={m} disabled={actionBusy || mode === m} onClick={() => doAction(() => setAutonomousMode(m))}
                      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', marginBottom: 4, background: mode === m ? 'rgba(99,102,241,0.12)' : 'transparent', border: mode === m ? '1px solid rgba(99,102,241,0.35)' : '1px solid var(--border)', borderRadius: 7, color: mode === m ? '#a5b4fc' : 'var(--sub)', fontSize: 12, fontWeight: mode === m ? 700 : 500, cursor: mode === m ? 'default' : 'pointer', fontFamily: 'inherit' }}>
                      {MODE_LABELS[m]}
                    </button>
                  ))}
                  <div style={{ marginTop: 14, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
                    <div style={{ fontSize: 28, fontWeight: 800, color: '#a5b4fc', marginBottom: 6 }}>{((dashboard?.confidence ?? 0) * 100).toFixed(1)}%</div>
                    <ConfBar value={dashboard?.confidence ?? 0} color="#6366f1" />
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>System confidence</div>
                  </div>
                </div>

                {/* Event stream */}
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                  <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className="section-label" style={{ margin: 0 }}>AI Decision Stream</span>
                    <span className="badge tag-indigo">{events.length}</span>
                    <a href="/ai-stream" style={{ marginLeft: 'auto', fontSize: 11, color: '#6366f1', fontWeight: 700, textDecoration: 'none' }}>Full Stream →</a>
                  </div>
                  <div style={{ maxHeight: 480, overflowY: 'auto' }}>
                    {events.length === 0
                      ? <div style={{ padding: '32px 16px', textAlign: 'center', fontSize: 12, color: 'var(--muted)' }}>No events yet — stream is connecting…</div>
                      : events.map(ev => <EventRow key={ev.id} ev={ev} expanded={expandedId === ev.id} onToggle={() => setExpandedId(expandedId === ev.id ? null : ev.id)} />)
                    }
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
  );
}
