'use client';
import { useEffect, useRef, useState } from 'react';
import {
  connectAutonomousStream, pauseAutonomousSystem, resumeAutonomousSystem,
  type AIBrainEvent,
} from '@/lib/api/creator-client';

const EVENT_COLORS: Record<string, string> = {
  ANGLE_SELECT:'#6366f1', MUTATION:'#f59e0b', CREATIVE_EVAL:'#10b981',
  FATIGUE_DETECT:'#ef4444', EXPLORATION_TRIGGER:'#8b5cf6', IMPROVEMENT:'#3b82f6',
  LEARNING:'#ec4899', DECISION:'#06b6d4',
};
const TYPE_ICONS: Record<string, string> = {
  ANGLE_SELECT:'🎯', MUTATION:'🧬', CREATIVE_EVAL:'📊', FATIGUE_DETECT:'⚠️',
  EXPLORATION_TRIGGER:'🔭', IMPROVEMENT:'⬆️', LEARNING:'📚', DECISION:'⚡',
};
const ALL_TYPES = ['ALL','ANGLE_SELECT','MUTATION','CREATIVE_EVAL','FATIGUE_DETECT','EXPLORATION_TRIGGER','IMPROVEMENT','LEARNING','DECISION'];

export default function AIStreamPage() {
  const [events,        setEvents]        = useState<AIBrainEvent[]>([]);
  const [connected,     setConnected]     = useState(false);
  const [paused,        setPaused]        = useState(false);
  const [filter,        setFilter]        = useState('ALL');
  const [autoScroll,    setAutoScroll]    = useState(true);
  const [totalReceived, setTotalReceived] = useState(0);
  const bufferRef = useRef<AIBrainEvent[]>([]);
  const feedRef   = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return connectAutonomousStream(
      ev => { setConnected(true); setTotalReceived(n => n + 1); bufferRef.current = [ev, ...bufferRef.current].slice(0, 200); setEvents([...bufferRef.current]); },
      ()  => setConnected(false),
    );
  }, []);

  useEffect(() => { if (autoScroll && feedRef.current) feedRef.current.scrollTop = 0; }, [events, autoScroll]);

  const filtered = filter === 'ALL' ? events : events.filter(e => e.type === filter);

  return (
        <div className="page-content">

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: 0 }}>🧠 AI Brain Stream</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
              <div className={connected ? 'pulse-dot' : ''} style={{ width: 8, height: 8, borderRadius: '50%', background: connected ? 'var(--emerald)' : 'var(--rose)' }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: connected ? 'var(--emerald)' : 'var(--rose)' }}>{connected ? 'LIVE' : 'DISCONNECTED'}</span>
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>· {totalReceived} received</span>
            </div>
          </div>
          <p style={{ fontSize: 13, color: 'var(--sub)', marginBottom: 20 }}>Live SSE feed from <code style={{ color: '#6366f1' }}>/api/autonomous/stream</code></p>

          {/* Toolbar */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            <button onClick={async () => { if (paused) { await resumeAutonomousSystem(); setPaused(false); } else { await pauseAutonomousSystem(); setPaused(true); } }}
              style={{ padding: '6px 14px', border: `1px solid ${paused ? '#10b981' : '#f59e0b'}44`, borderRadius: 7, background: paused ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)', color: paused ? '#10b981' : '#f59e0b', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
              {paused ? '▶ Resume' : '⏸ Pause'} AI
            </button>
            <button onClick={() => setAutoScroll(v => !v)}
              style={{ padding: '6px 14px', border: `1px solid ${autoScroll ? '#6366f1' : 'var(--border)'}44`, borderRadius: 7, background: autoScroll ? 'rgba(99,102,241,0.1)' : 'transparent', color: autoScroll ? '#a5b4fc' : 'var(--muted)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
              📌 {autoScroll ? 'Auto-scroll ON' : 'Auto-scroll OFF'}
            </button>
            <button onClick={() => { bufferRef.current = []; setEvents([]); }}
              style={{ padding: '6px 14px', border: '1px solid var(--border)', borderRadius: 7, background: 'transparent', color: 'var(--muted)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
              🗑 Clear
            </button>
          </div>

          {/* Type filters */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
            {ALL_TYPES.map(t => {
              const color = EVENT_COLORS[t] ?? '#6366f1';
              const count = t === 'ALL' ? events.length : events.filter(e => e.type === t).length;
              return (
                <button key={t} onClick={() => setFilter(t)}
                  style={{ padding: '4px 10px', borderRadius: 20, border: filter === t ? `1px solid ${color}66` : '1px solid var(--border)', background: filter === t ? `${color}18` : 'transparent', color: filter === t ? color : 'var(--muted)', fontSize: 11, fontWeight: filter === t ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {t === 'ALL' ? 'ALL' : `${TYPE_ICONS[t] ?? ''} ${t.replace('_', ' ')}`} {count > 0 && <span style={{ opacity: 0.6 }}>({count})</span>}
                </button>
              );
            })}
          </div>

          {/* Feed */}
          <div ref={feedRef} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', maxHeight: 'calc(100vh - 340px)', overflowY: 'auto' }}>
            {!connected && filtered.length === 0 && (
              <div style={{ padding: '60px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>🧠</div>
                <div style={{ fontSize: 14, color: 'var(--sub)' }}>Connecting to AI brain stream…</div>
              </div>
            )}
            {filtered.map((ev, i) => {
              const color = EVENT_COLORS[ev.type] ?? '#888';
              const icon  = TYPE_ICONS[ev.type]  ?? '⚡';
              return (
                <div key={ev.id} className={i === 0 ? 'slide-in' : ''} style={{ display: 'flex', gap: 12, padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: `${color}18`, border: `1.5px solid ${color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>{icon}</div>
                    {i < filtered.length - 1 && <div style={{ width: 1, flex: 1, background: 'var(--border)', minHeight: 12, marginTop: 4 }} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0, paddingBottom: 4 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', lineHeight: 1.3 }}>{ev.title}</span>
                      <span style={{ flexShrink: 0, fontSize: 9, fontWeight: 800, color, background: `${color}18`, padding: '2px 6px', borderRadius: 4, marginTop: 1 }}>{ev.type}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--sub)', marginBottom: 6 }}>{ev.detail}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ flex: 1, maxWidth: 120, height: 3, background: 'var(--border)', borderRadius: 2 }}>
                        <div style={{ height: '100%', width: `${Math.round(ev.confidence * 100)}%`, background: color }} />
                      </div>
                      <span style={{ fontSize: 10, color: 'var(--muted)' }}>{(ev.confidence * 100).toFixed(0)}% conf</span>
                      {ev.angleSlug && <span style={{ fontSize: 10, color: 'var(--muted)' }}>· {ev.angleSlug}</span>}
                      <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--muted)' }}>{new Date(ev.timestamp).toLocaleTimeString()}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: 10, fontSize: 11, color: 'var(--muted)', display: 'flex', gap: 16 }}>
            <span>Total: {events.length}</span>
            <span>Filtered: {filtered.length}</span>
            <span>Session: {totalReceived}</span>
          </div>
        </div>
  );
}
