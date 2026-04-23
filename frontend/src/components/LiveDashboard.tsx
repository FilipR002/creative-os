'use client';

// ─── Phase 6.2 — Live Dashboard ───────────────────────────────────────────────
// Real-time view: accepts current execution state from parent.
// Shows system status + live execution card + recent timeline.

import { useEffect, useState } from 'react';
import { fetchStatus } from '@/lib/api/client';
import type { SystemStatus } from '@/lib/types/view-models';
import type { ExecutionStreamState } from '@/lib/types/execution-stream';
import { StabilityIndicator } from './StabilityIndicator';
import { ExecutionStreamCard } from './ExecutionStreamCard';
import { ExecutionTimeline }   from './ExecutionTimeline';

interface Props {
  execution?: ExecutionStreamState | null;
}

export function LiveDashboard({ execution }: Props) {
  const [status, setStatus] = useState<SystemStatus | null>(null);

  useEffect(() => {
    fetchStatus().then(setStatus).catch(() => null);
    const id = setInterval(() => fetchStatus().then(setStatus).catch(() => null), 15_000);
    return () => clearInterval(id);
  }, []);

  const hasExecution = !!execution;
  const isDone       = execution?.status === 'completed' || execution?.status === 'failed';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ── System health bar ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <div className="card">
          <div className="card-title">System</div>
          {status
            ? <StabilityIndicator state={status.system_stability} />
            : <span className="shimmer" style={{ display: 'block', height: 16, width: 80, borderRadius: 4 }} />
          }
        </div>
        <div className="card">
          <div className="card-title">Active Angles</div>
          <div style={{ fontSize: 26, fontWeight: 700 }}>
            {status?.angles_active
              ?? <span className="shimmer" style={{ display: 'inline-block', height: 26, width: 40, borderRadius: 4 }} />
            }
          </div>
        </div>
        <div className="card">
          <div className="card-title">Learning</div>
          <div style={{ fontSize: 13, color: status?.learning_active ? 'var(--success)' : 'var(--muted)' }}>
            {status ? (status.learning_active ? 'Active' : 'Inactive') : '—'}
          </div>
        </div>
        <div className="card">
          <div className="card-title">MIROFISH</div>
          <div style={{ fontSize: 13, color: status?.mirofish_active ? 'var(--success)' : 'var(--muted)' }}>
            {status ? (status.mirofish_active ? 'Active' : 'Inactive') : '—'}
          </div>
        </div>
      </div>

      {/* ── Live execution area ── */}
      {hasExecution ? (
        <>
          <ExecutionStreamCard state={execution!} />
          {isDone && execution!.timeline.length > 0 && (
            <ExecutionTimeline
              entries={execution!.timeline}
              startedAt={execution!.startedAt}
            />
          )}
        </>
      ) : (
        <div className="card" style={{ textAlign: 'center', padding: '40px 24px' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⚡</div>
          <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
            System ready
          </p>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>
            Run a decision from the <a href="/decisions" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Decisions</a> page to see live intelligence here.
          </p>
        </div>
      )}
    </div>
  );
}
