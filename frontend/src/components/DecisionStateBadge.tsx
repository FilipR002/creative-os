// ─── Phase 6.2 — Decision State Badge ────────────────────────────────────────
// Animated phase indicator. Pulses when execution is active.

import type { ExecutionPhase } from '@/lib/types/execution';

interface Config {
  label:  string;
  color:  string;
  active: boolean;
}

const CONFIGS: Record<ExecutionPhase, Config> = {
  started:     { label: 'INITIATED',          color: 'var(--accent)',  active: true  },
  signals:     { label: 'COMPUTING SIGNALS',  color: '#818cf8',        active: true  },
  decision:    { label: 'RESOLVING DECISION', color: '#a78bfa',        active: true  },
  explanation: { label: 'GENERATING EXPLAIN', color: '#c084fc',        active: true  },
  completed:   { label: 'COMPLETE',           color: 'var(--success)', active: false },
  failed:      { label: 'FAILED',             color: 'var(--danger)',  active: false },
};

interface Props {
  phase: ExecutionPhase;
  style?: React.CSSProperties;
}

export function DecisionStateBadge({ phase, style }: Props) {
  const cfg = CONFIGS[phase];
  return (
    <div style={{
      display:     'inline-flex',
      alignItems:  'center',
      gap:         8,
      padding:     '4px 10px',
      borderRadius: 99,
      border:      `1px solid ${cfg.color}33`,
      background:  `${cfg.color}11`,
      ...style,
    }}>
      {cfg.active && <span className="pulse-dot" style={{ background: cfg.color }} />}
      <span style={{ fontSize: 10, fontWeight: 700, color: cfg.color, letterSpacing: '0.08em' }}>
        {cfg.label}
      </span>
    </div>
  );
}
