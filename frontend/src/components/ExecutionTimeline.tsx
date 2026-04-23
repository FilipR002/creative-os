'use client';

// ─── Phase 6.2 — Execution Timeline ──────────────────────────────────────────
// Step-by-step event log with collapsible debug payload.

import { useState } from 'react';
import type { TimelineEntry } from '@/lib/types/execution-stream';
import type { ExecutionPhase } from '@/lib/types/execution';

const DOT_COLOR: Record<ExecutionPhase, string> = {
  started:     'var(--accent)',
  signals:     '#818cf8',
  decision:    '#a78bfa',
  explanation: '#c084fc',
  completed:   'var(--success)',
  failed:      'var(--danger)',
};

function relativeMs(from: number, to: number): string {
  return `+${to - from}ms`;
}

interface EntryRowProps {
  entry:     TimelineEntry;
  startedAt: number;
  debug:     boolean;
}

function EntryRow({ entry, startedAt, debug }: EntryRowProps) {
  const [open, setOpen] = useState(false);
  const hasData = debug && entry.data != null;

  return (
    <div className="timeline-entry" style={{ animationDelay: '0ms' }}>
      <div className="timeline-dot" style={{ background: DOT_COLOR[entry.phase] }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontSize: 13, fontWeight: 500 }}>{entry.label}</span>
          <span style={{ fontSize: 11, color: 'var(--muted)', flexShrink: 0, marginLeft: 12 }}>
            {relativeMs(startedAt, entry.timestamp)}
          </span>
        </div>
        {hasData && (
          <button
            onClick={() => setOpen(v => !v)}
            style={{ fontSize: 11, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: 4 }}
          >
            {open ? '▾ hide payload' : '▸ show payload'}
          </button>
        )}
        {open && hasData && (
          <pre style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6, overflow: 'auto', maxHeight: 120 }}>
            {JSON.stringify(entry.data, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}

interface Props {
  entries:   TimelineEntry[];
  startedAt: number;
}

export function ExecutionTimeline({ entries, startedAt }: Props) {
  const [debug,     setDebug]     = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div className="card-title" style={{ margin: 0 }}>Execution Timeline</div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={() => setDebug(v => !v)}
            style={{ fontSize: 11, color: debug ? 'var(--accent)' : 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
          >
            {debug ? 'DEBUG ON' : 'DEBUG'}
          </button>
          <button
            onClick={() => setCollapsed(v => !v)}
            style={{ fontSize: 11, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            {collapsed ? 'expand' : 'collapse'}
          </button>
        </div>
      </div>
      {!collapsed && (
        <div>
          {entries.map((entry, i) => (
            <EntryRow key={i} entry={entry} startedAt={startedAt} debug={debug} />
          ))}
          {entries.length === 0 && (
            <p style={{ fontSize: 12, color: 'var(--muted)' }}>Waiting for events…</p>
          )}
        </div>
      )}
    </div>
  );
}
