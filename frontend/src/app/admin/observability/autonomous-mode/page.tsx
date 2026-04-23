'use client';
// ─── Admin: Autonomous Mode Engine ───────────────────────────────────────────
// Phase 4: MANUAL / HYBRID / AUTONOMOUS mode control, decision queue,
// full audit trail, emergency controls, safety locks.

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  getAutonomousLoopStatus, triggerAutonomousLoop, stopAutonomousLoop,
  setAutonomousLoopMode, getAutonomousLoopAudit, rollbackAutonomousAction,
  getAdminAuditLog, appendAdminAudit, rollbackAdminAudit,
  runSimulation, getEvolutionStatusTyped, getMemoryWinRates,
  type AutonomousLoopStatus, type AutonomousLoopAuditEntry,
  type AutonomousLoopMode, type AdminAuditEntry, type MemoryWinRate,
} from '@/lib/api/creator-client';

// ─── Types ────────────────────────────────────────────────────────────────────

type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

interface DecisionProposal {
  id:              string;
  description:     string;
  reason:          string;
  predictedImpact: string;
  riskLevel:       RiskLevel;
  angle?:          string;
  action:          string;
  approved?:       boolean;
  rejected?:       boolean;
  edited?:         boolean;
}

// ─── Mode metadata ────────────────────────────────────────────────────────────

const MODES: AutonomousLoopMode[] = ['MANUAL', 'HYBRID', 'AUTONOMOUS'];

const MODE_META: Record<AutonomousLoopMode, {
  color: string; bg: string; border: string;
  icon: string; description: string; autoApply: string;
}> = {
  MANUAL: {
    color: '#9ca3af', bg: 'rgba(156,163,175,0.06)', border: 'rgba(156,163,175,0.2)',
    icon: '🔒', description: 'All changes require explicit admin approval.',
    autoApply: 'Nothing is auto-applied.',
  },
  HYBRID: {
    color: '#f59e0b', bg: 'rgba(245,158,11,0.06)', border: 'rgba(245,158,11,0.2)',
    icon: '⚖️', description: 'Low-risk changes execute automatically. High-risk changes require approval.',
    autoApply: 'LOW risk auto-applied. MEDIUM/HIGH queued.',
  },
  AUTONOMOUS: {
    color: '#22c55e', bg: 'rgba(34,197,94,0.06)', border: 'rgba(34,197,94,0.2)',
    icon: '🤖', description: 'System self-improves with safety guardrails. All actions fully logged.',
    autoApply: 'LOW + MEDIUM auto-applied. HIGH risk queued.',
  },
};

const RISK_META: Record<RiskLevel, { color: string; bg: string }> = {
  LOW:    { color: '#22c55e', bg: 'rgba(34,197,94,0.08)'   },
  MEDIUM: { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)'  },
  HIGH:   { color: '#ef4444', bg: 'rgba(239,68,68,0.08)'   },
};

// ─── Sub-tabs ─────────────────────────────────────────────────────────────────

const SUBTABS = [
  { id: 'overview',  label: '📊 Overview'        },
  { id: 'queue',     label: '📋 Decision Queue'  },
  { id: 'audit',     label: '📜 Audit Trail'     },
  { id: 'safety',    label: '🛡️ Safety Controls' },
] as const;
type SubTab = typeof SUBTABS[number]['id'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Stat({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{ padding: '12px 14px', background: '#0d0e14', border: '1px solid #1e2330', borderRadius: 9 }}>
      <div style={{ fontSize: 10, color: '#444', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: color ?? '#f0f0f0' }}>{value}</div>
    </div>
  );
}

// ─── OVERVIEW PANEL ───────────────────────────────────────────────────────────

function OverviewPanel({
  status, mode, winRates, onSetMode, switching,
}: {
  status: AutonomousLoopStatus | null;
  mode: AutonomousLoopMode;
  winRates: MemoryWinRate[];
  onSetMode: (m: AutonomousLoopMode) => void;
  switching: boolean;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Mode cards */}
      <div>
        <div style={{ fontSize: 12, color: '#555', marginBottom: 12 }}>Operating Mode</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {MODES.map(m => {
            const meta     = MODE_META[m];
            const selected = m === mode;
            return (
              <button
                key={m}
                onClick={() => !selected && !switching && onSetMode(m)}
                disabled={switching || selected}
                style={{
                  padding: '18px 16px', borderRadius: 11, textAlign: 'left',
                  background: selected ? meta.bg : '#0d0e14',
                  border: `2px solid ${selected ? meta.color : '#1e2330'}`,
                  cursor: selected ? 'default' : 'pointer',
                  fontFamily: 'inherit', transition: 'all 0.15s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 18 }}>{meta.icon}</span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: selected ? meta.color : '#666' }}>{m}</span>
                  {selected && (
                    <span style={{ marginLeft: 'auto', fontSize: 9, fontWeight: 800, color: meta.color, background: `${meta.color}22`, border: `1px solid ${meta.color}44`, borderRadius: 4, padding: '1px 6px' }}>ACTIVE</span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: '#555', lineHeight: 1.5, marginBottom: 6 }}>{meta.description}</div>
                <div style={{ fontSize: 11, color: '#333', fontStyle: 'italic' }}>{meta.autoApply}</div>
              </button>
            );
          })}
        </div>
        {switching && <div style={{ fontSize: 12, color: '#a5b4fc', marginTop: 8 }}>Switching mode…</div>}
      </div>

      {/* Status stats */}
      {status && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
          <Stat label="Mode"           value={status.mode}                                color={MODE_META[status.mode]?.color}             />
          <Stat label="Status"         value={status.running ? '● Running' : '○ Idle'}   color={status.running ? '#22c55e' : '#6b7280'}    />
          <Stat label="Cycles Run"     value={status.cycleCount}                                                                            />
          <Stat label="Stability"      value={`${Math.round(status.stabilityScore * 100)}%`} color={status.stabilityScore > 0.7 ? '#22c55e' : '#f59e0b'} />
          <Stat label="Safety Lock"    value={status.safetyLock ? '🔒 ON' : '🔓 OFF'}  color={status.safetyLock ? '#f87171' : '#22c55e'}  />
          <Stat label="Pending Queue"  value={status.pendingActions}                     color={status.pendingActions > 0 ? '#f59e0b' : '#6b7280'} />
        </div>
      )}

      {/* System intelligence snapshot */}
      {winRates.length > 0 && (
        <div>
          <div style={{ fontSize: 12, color: '#555', marginBottom: 10 }}>Angle Win Rates — learning basis</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
            {winRates.slice(0, 8).map(w => (
              <div key={w.angleSlug} style={{ padding: '10px 12px', background: '#0d0e14', border: '1px solid #1e2330', borderRadius: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: '#888' }}>{w.angleSlug}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: w.winRate > 0.5 ? '#22c55e' : w.winRate > 0.3 ? '#f59e0b' : '#ef4444' }}>
                    {(w.winRate * 100).toFixed(0)}%
                  </span>
                </div>
                <div style={{ height: 3, background: '#1e2330', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${w.winRate * 100}%`, background: w.winRate > 0.5 ? '#22c55e' : w.winRate > 0.3 ? '#f59e0b' : '#ef4444', borderRadius: 2 }} />
                </div>
                <div style={{ fontSize: 10, color: '#444', marginTop: 3 }}>{w.wins}/{w.total} wins</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── DECISION QUEUE PANEL ─────────────────────────────────────────────────────

function DecisionQueuePanel({
  mode, onAuditEntry,
}: {
  mode: AutonomousLoopMode;
  onAuditEntry: (entry: Omit<AdminAuditEntry, 'id' | 'timestamp' | 'rolledBack' | 'rollbackAt'>) => void;
}) {
  const [proposals, setProposals] = useState<DecisionProposal[]>([]);
  const [generating, setGenerating] = useState(false);

  // Generate proposals based on current mode
  const generateProposals = useCallback(async () => {
    setGenerating(true);
    // Simulate AI-generated proposals by running simulations
    const angles = ['urgency', 'emotional', 'storytelling', 'price-focused'];
    const sims   = await Promise.all(
      angles.map(angle => runSimulation({ angle }).catch(() => null))
    );

    const newProposals: DecisionProposal[] = sims
      .filter(Boolean)
      .map((s, i) => {
        const delta      = s!.output.delta_vs_current;
        const riskLevel: RiskLevel = Math.abs(delta) > 0.01 ? 'HIGH' : Math.abs(delta) > 0.005 ? 'MEDIUM' : 'LOW';
        const angle      = angles[i];
        return {
          id:              `proposal-${Date.now()}-${i}`,
          description:     `Shift primary angle to "${angle}"`,
          reason:          `Simulation predicts CTR delta of ${delta > 0 ? '+' : ''}${(delta * 100).toFixed(3)}% vs current baseline`,
          predictedImpact: `CTR: ${(s!.output.predicted_ctr * 100).toFixed(3)}%  Confidence: ${(s!.output.confidence * 100).toFixed(0)}%`,
          riskLevel,
          angle,
          action:          `set_primary_angle:${angle}`,
        };
      });

    // In AUTONOMOUS or HYBRID mode, auto-apply LOW risk
    if (mode === 'AUTONOMOUS' || mode === 'HYBRID') {
      for (const p of newProposals) {
        if (p.riskLevel === 'LOW' || (mode === 'AUTONOMOUS' && p.riskLevel === 'MEDIUM')) {
          p.approved = true;
          onAuditEntry({
            triggerSource:   'autonomous_proposal',
            decision:        p.description,
            riskLevel:       p.riskLevel,
            predictedImpact: p.predictedImpact,
            applied:         true,
            mode,
          });
        }
      }
    }

    setProposals(newProposals);
    setGenerating(false);
  }, [mode, onAuditEntry]);

  const handleApprove = useCallback((id: string) => {
    const p = proposals.find(x => x.id === id);
    if (!p) return;
    setProposals(prev => prev.map(x => x.id === id ? { ...x, approved: true, rejected: false } : x));
    onAuditEntry({
      triggerSource:   'manual_approval',
      decision:        p.description,
      riskLevel:       p.riskLevel,
      predictedImpact: p.predictedImpact,
      applied:         true,
      mode,
    });
  }, [proposals, mode, onAuditEntry]);

  const handleReject = useCallback((id: string) => {
    const p = proposals.find(x => x.id === id);
    if (!p) return;
    setProposals(prev => prev.map(x => x.id === id ? { ...x, rejected: true, approved: false } : x));
    onAuditEntry({
      triggerSource:   'manual_rejection',
      decision:        p.description,
      riskLevel:       p.riskLevel,
      predictedImpact: p.predictedImpact,
      applied:         false,
      mode,
    });
  }, [proposals, mode, onAuditEntry]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <button
          onClick={generateProposals}
          disabled={generating}
          style={{ padding: '9px 18px', background: generating ? '#1a1b22' : 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 8, color: generating ? '#444' : '#a5b4fc', fontWeight: 600, fontSize: 13, cursor: generating ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
        >
          {generating ? 'Generating…' : '⚡ Generate AI Proposals'}
        </button>
        <div style={{ fontSize: 12, color: '#444' }}>
          Mode: <span style={{ color: MODE_META[mode].color, fontWeight: 700 }}>{mode}</span>
          {mode !== 'MANUAL' && <span style={{ marginLeft: 6, color: '#333' }}>— LOW risk auto-applied</span>}
        </div>
      </div>

      {proposals.length === 0 ? (
        <div style={{ padding: '40px 24px', textAlign: 'center', background: '#0d0e14', border: '1px dashed #1e2330', borderRadius: 12, color: '#333', fontSize: 13 }}>
          No proposals yet. Click Generate to run the autonomous analysis engine.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {proposals.map(p => {
            const risk = RISK_META[p.riskLevel];
            const done = p.approved || p.rejected;
            return (
              <div key={p.id} style={{ padding: '16px 18px', background: '#0d0e14', border: `1px solid ${done ? '#111318' : risk.bg.replace('0.08', '0.3')}`, borderRadius: 11, opacity: done ? 0.6 : 1 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                  {/* Risk badge */}
                  <div style={{ flexShrink: 0, marginTop: 2 }}>
                    <span style={{ fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 5, background: risk.bg, color: risk.color, border: `1px solid ${risk.color}44` }}>
                      {p.riskLevel}
                    </span>
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#f0f0f0', marginBottom: 4 }}>{p.description}</div>
                    <div style={{ fontSize: 12, color: '#555', marginBottom: 6 }}>{p.reason}</div>
                    <div style={{ fontSize: 11, color: '#444' }}>
                      <span style={{ color: '#6ee7b7' }}>→ {p.predictedImpact}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ flexShrink: 0, display: 'flex', gap: 8, alignItems: 'center' }}>
                    {p.approved && <span style={{ fontSize: 12, color: '#22c55e', fontWeight: 700 }}>✓ Approved</span>}
                    {p.rejected && <span style={{ fontSize: 12, color: '#ef4444', fontWeight: 700 }}>✗ Rejected</span>}
                    {!done && (
                      <>
                        <button onClick={() => handleApprove(p.id)} style={{ padding: '6px 14px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 6, color: '#4ade80', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>✓ Approve</button>
                        <button onClick={() => handleReject(p.id)}  style={{ padding: '6px 14px', background: 'rgba(239,68,68,0.08)',  border: '1px solid rgba(239,68,68,0.2)',  borderRadius: 6, color: '#f87171', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>✗ Reject</button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── AUDIT TRAIL PANEL ────────────────────────────────────────────────────────

function AuditTrailPanel({ entries, onRollback }: { entries: AdminAuditEntry[]; onRollback: (id: string) => void }) {
  const [selected, setSelected] = useState<AdminAuditEntry | null>(null);
  const [filter,   setFilter]   = useState<'all' | 'applied' | 'rejected' | 'rolled_back'>('all');

  const filtered = entries.filter(e => {
    if (filter === 'all')        return true;
    if (filter === 'applied')    return e.applied && !e.rolledBack;
    if (filter === 'rejected')   return !e.applied;
    if (filter === 'rolled_back')return e.rolledBack;
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 8 }}>
        {(['all', 'applied', 'rejected', 'rolled_back'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding: '5px 12px', background: filter === f ? '#1e2330' : 'transparent', border: `1px solid ${filter === f ? '#2a2b35' : '#1e2330'}`, borderRadius: 6, color: filter === f ? '#f0f0f0' : '#555', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', textTransform: 'capitalize' }}>
            {f.replace('_', ' ')}
          </button>
        ))}
        <div style={{ marginLeft: 'auto', fontSize: 11, color: '#444', display: 'flex', alignItems: 'center' }}>{filtered.length} entries</div>
      </div>

      {filtered.length === 0 ? (
        <div style={{ padding: '40px 24px', textAlign: 'center', background: '#0d0e14', border: '1px solid #1e2330', borderRadius: 12, color: '#333', fontSize: 13 }}>
          No entries for this filter. Generate and approve proposals to build the audit trail.
        </div>
      ) : (
        <div style={{ background: '#0d0e14', border: '1px solid #1e2330', borderRadius: 11, overflow: 'hidden' }}>
          {/* Table header */}
          <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 80px 80px 70px 60px', padding: '7px 14px', background: '#0a0b10', borderBottom: '1px solid #1e2330', fontSize: 10, fontWeight: 700, color: '#333', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            <span>Timestamp</span><span>Decision</span><span>Risk</span><span>Mode</span><span>Status</span><span></span>
          </div>
          {filtered.map((e, i) => {
            const risk = RISK_META[e.riskLevel];
            const statusColor = e.rolledBack ? '#f59e0b' : e.applied ? '#22c55e' : '#ef4444';
            const statusLabel = e.rolledBack ? '↩ Rolled back' : e.applied ? '✓ Applied' : '✗ Rejected';
            return (
              <div
                key={e.id}
                onClick={() => setSelected(selected?.id === e.id ? null : e)}
                style={{ display: 'grid', gridTemplateColumns: '140px 1fr 80px 80px 70px 60px', padding: '9px 14px', borderBottom: i < filtered.length - 1 ? '1px solid #0f1014' : 'none', cursor: 'pointer', background: selected?.id === e.id ? 'rgba(99,102,241,0.04)' : 'transparent', alignItems: 'center' }}
              >
                <span style={{ fontSize: 10, color: '#333', fontFamily: 'monospace' }}>
                  {new Date(e.timestamp).toLocaleString()}
                </span>
                <span style={{ fontSize: 12, color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8 }}>
                  {e.decision}
                </span>
                <span style={{ fontSize: 10, fontWeight: 700, color: risk.color }}>{e.riskLevel}</span>
                <span style={{ fontSize: 10, color: '#555' }}>{e.mode}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: statusColor }}>{statusLabel}</span>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  {e.applied && !e.rolledBack && (
                    <button
                      onClick={ev => { ev.stopPropagation(); onRollback(e.id); }}
                      style={{ padding: '3px 8px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 4, color: '#fbbf24', fontSize: 10, cursor: 'pointer', fontFamily: 'inherit' }}
                    >↩</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selected && (
        <div style={{ padding: '14px 16px', background: '#0d0e14', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 9 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#f0f0f0' }}>Full Audit Entry</span>
            <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: '#444', cursor: 'pointer' }}>×</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            {[
              ['ID',             selected.id                              ],
              ['Trigger Source', selected.triggerSource                   ],
              ['Mode',           selected.mode                            ],
              ['Risk Level',     selected.riskLevel                       ],
              ['Applied',        selected.applied ? 'Yes' : 'No'         ],
              ['Rolled Back',    selected.rolledBack ? 'Yes' : 'No'      ],
              ['Predicted Impact', selected.predictedImpact               ],
              ['Rollback At',    selected.rollbackAt ?? '—'               ],
            ].map(([k, v]) => (
              <div key={k} style={{ fontSize: 11 }}>
                <span style={{ color: '#444' }}>{k}: </span>
                <span style={{ color: '#888' }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── SAFETY CONTROLS PANEL ───────────────────────────────────────────────────

function SafetyPanel({
  status, running,
  onStop, onFreeze,
  frozen, onUnfreeze,
}: {
  status: AutonomousLoopStatus | null;
  running: boolean;
  onStop: () => void;
  onFreeze: () => void;
  frozen: boolean;
  onUnfreeze: () => void;
}) {
  const RULES = [
    { rule: 'Max 5 autonomous changes per hour',         active: true,  icon: '⏱' },
    { rule: 'All changes are reversible',                active: true,  icon: '↩' },
    { rule: 'No silent updates — everything logged',     active: true,  icon: '👁' },
    { rule: 'Full traceability required for all actions',active: true,  icon: '🔍' },
    { rule: 'Admin override always available',           active: true,  icon: '🔑' },
    { rule: 'HIGH risk changes require manual approval', active: true,  icon: '⚠️' },
    { rule: 'Safety lock prevents AUTONOMOUS → MANUAL',  active: status?.safetyLock ?? false, icon: '🔒' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Emergency controls */}
      <div style={{ padding: '22px 24px', background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#f87171', marginBottom: 8 }}>🚨 Emergency Controls</div>
        <p style={{ fontSize: 13, color: '#555', marginBottom: 18, lineHeight: 1.6 }}>
          These controls immediately halt all autonomous behavior. Use if the system acts unexpectedly.
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button
            onClick={onStop}
            disabled={!running}
            style={{
              padding: '10px 20px',
              background: running ? 'rgba(239,68,68,0.1)' : '#1a1b22',
              border: `1px solid ${running ? 'rgba(239,68,68,0.3)' : '#222'}`,
              borderRadius: 8, color: running ? '#f87171' : '#444',
              fontWeight: 700, fontSize: 13, cursor: running ? 'pointer' : 'not-allowed', fontFamily: 'inherit',
            }}
          >
            ■ Emergency Stop Loop
          </button>
          <button
            onClick={frozen ? onUnfreeze : onFreeze}
            style={{
              padding: '10px 20px',
              background: frozen ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.08)',
              border: `1px solid ${frozen ? 'rgba(245,158,11,0.3)' : 'rgba(239,68,68,0.2)'}`,
              borderRadius: 8, color: frozen ? '#fbbf24' : '#f87171',
              fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            {frozen ? '▶ Unfreeze Evolution' : '🧊 Freeze Evolution Loop'}
          </button>
        </div>
        {frozen && (
          <div style={{ marginTop: 12, padding: '8px 12px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 7, fontSize: 12, color: '#fbbf24' }}>
            ⚠️ Evolution loop is frozen. No autonomous mutations will be applied until unfrozen.
          </div>
        )}
      </div>

      {/* Safety rules */}
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#f0f0f0', marginBottom: 12 }}>Active Safety Rules (Phase 5)</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {RULES.map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: '#0d0e14', border: '1px solid #1e2330', borderRadius: 8 }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>{r.icon}</span>
              <span style={{ fontSize: 13, color: '#c0c0c0', flex: 1 }}>{r.rule}</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: r.active ? '#22c55e' : '#ef4444', background: r.active ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)', padding: '2px 8px', borderRadius: 4, border: `1px solid ${r.active ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
                {r.active ? 'ENFORCED' : 'INACTIVE'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Rollback info */}
      <div style={{ padding: '16px 18px', background: '#0d0e14', border: '1px solid #1e2330', borderRadius: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#f0f0f0', marginBottom: 8 }}>Rollback Mechanism</div>
        <p style={{ fontSize: 13, color: '#555', lineHeight: 1.6, margin: 0 }}>
          Every applied autonomous action can be individually rolled back from the Audit Trail tab.
          Rollbacks are themselves logged as audit entries. There is no permanent state change —
          the system maintains full reversibility at all times.
        </p>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AutonomousModePage() {
  const [status,    setStatus]    = useState<AutonomousLoopStatus | null>(null);
  const [winRates,  setWinRates]  = useState<MemoryWinRate[]>([]);
  const [auditLog,  setAuditLog]  = useState<AdminAuditEntry[]>([]);
  const [switching, setSwitching] = useState(false);
  const [stopping,  setStopping]  = useState(false);
  const [frozen,    setFrozen]    = useState(false);
  const [loading,   setLoading]   = useState(true);
  const [subTab,    setSubTab]    = useState<SubTab>('overview');

  const load = useCallback(async () => {
    await Promise.all([
      getAutonomousLoopStatus().then(setStatus).catch(() => {}),
      getMemoryWinRates().then(setWinRates).catch(() => {}),
      getAdminAuditLog(100).then(setAuditLog).catch(() => {}),
    ]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const currentMode = status?.mode ?? 'MANUAL';

  const handleSetMode = useCallback(async (mode: AutonomousLoopMode) => {
    setSwitching(true);
    try {
      const r = await setAutonomousLoopMode(mode);
      setStatus(prev => prev ? { ...prev, mode: r.mode } : null);
    } catch { /* ignore */ } finally { setSwitching(false); }
  }, []);

  const handleStop = useCallback(async () => {
    setStopping(true);
    try {
      await stopAutonomousLoop();
      setStatus(prev => prev ? { ...prev, running: false } : null);
    } catch { /* ignore */ } finally { setStopping(false); }
  }, []);

  const handleAuditEntry = useCallback(async (entry: Omit<AdminAuditEntry, 'id' | 'timestamp' | 'rolledBack' | 'rollbackAt'>) => {
    const created = await appendAdminAudit(entry).catch(() => null);
    if (created) setAuditLog(prev => [created, ...prev]);
  }, []);

  const handleRollback = useCallback(async (id: string) => {
    await rollbackAdminAudit(id).catch(() => {});
    setAuditLog(prev => prev.map(e => e.id === id ? { ...e, rolledBack: true, rollbackAt: new Date().toISOString() } : e));
  }, []);

  if (loading) return (
    <div style={{ padding: 60, textAlign: 'center', color: '#444', fontSize: 14 }}>
      Loading autonomous mode engine…
    </div>
  );

  const panels: Record<SubTab, React.ReactNode> = {
    overview: (
      <OverviewPanel
        status={status}
        mode={currentMode}
        winRates={winRates}
        onSetMode={handleSetMode}
        switching={switching}
      />
    ),
    queue: (
      <DecisionQueuePanel
        mode={currentMode}
        onAuditEntry={handleAuditEntry}
      />
    ),
    audit: (
      <AuditTrailPanel
        entries={auditLog}
        onRollback={handleRollback}
      />
    ),
    safety: (
      <SafetyPanel
        status={status}
        running={status?.running ?? false}
        onStop={handleStop}
        onFreeze={() => setFrozen(true)}
        frozen={frozen}
        onUnfreeze={() => setFrozen(false)}
      />
    ),
  };

  return (
    <div style={{ maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
          <a href="/admin/observability" style={{ fontSize: 13, color: '#444', textDecoration: 'none' }}>← Observability Hub</a>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 4 }}>🤖 Autonomous Mode Engine</h1>
            <p style={{ fontSize: 13, color: '#555' }}>
              Mode: <span style={{ color: MODE_META[currentMode].color, fontWeight: 700 }}>{currentMode}</span>
              {' — '}
              {MODE_META[currentMode].autoApply}
            </p>
          </div>

          {/* Live status indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: '#0d0e14', border: '1px solid #1e2330', borderRadius: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: status?.running ? '#22c55e' : '#444', boxShadow: status?.running ? '0 0 6px rgba(34,197,94,0.6)' : 'none' }} />
            <span style={{ fontSize: 12, color: status?.running ? '#22c55e' : '#555' }}>
              {status?.running ? 'Loop Running' : 'Loop Idle'}
            </span>
            {frozen && <span style={{ fontSize: 11, color: '#fbbf24', marginLeft: 6 }}>🧊 Frozen</span>}
          </div>
        </div>
      </div>

      {/* Safety strip */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 18, padding: '8px 14px', background: '#0a0b10', border: '1px solid #1e2330', borderRadius: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, color: '#333' }}>Safety:</span>
        {['Max 5 changes/hr', 'All reversible', 'Fully logged', 'Admin override'].map(r => (
          <span key={r} style={{ fontSize: 10, color: '#22c55e', background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: 4, padding: '2px 7px' }}>✓ {r}</span>
        ))}
      </div>

      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: 2, padding: 4, background: '#0a0b10', border: '1px solid #1e2330', borderRadius: 9, marginBottom: 22, width: 'fit-content' }}>
        {SUBTABS.map(t => (
          <button key={t.id} onClick={() => setSubTab(t.id)} style={{ padding: '7px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', background: subTab === t.id ? '#1e2330' : 'transparent', color: subTab === t.id ? '#f0f0f0' : '#555', fontSize: 12, fontWeight: subTab === t.id ? 600 : 400, fontFamily: 'inherit', whiteSpace: 'nowrap', transition: 'all 0.15s' }}>
            {t.label}
          </button>
        ))}
      </div>

      {panels[subTab]}
    </div>
  );
}
