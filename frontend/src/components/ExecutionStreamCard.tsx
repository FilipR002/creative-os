'use client';

// ─── Phase 6.2 — Execution Stream Card ───────────────────────────────────────
// The main live card. Animates through all execution phases.
// Shows: state badge → live step label → leading angle reveal → full results.

import type { ExecutionStreamState } from '@/lib/types/execution-stream';
import { DecisionStateBadge }   from './DecisionStateBadge';
import { SignalLiveGraph }       from './SignalLiveGraph';
import { ExplanationStreamPanel } from './ExplanationStreamPanel';
import { FatigueBadge }           from './FatigueBadge';
import { StabilityIndicator }     from './StabilityIndicator';

interface Props {
  state: ExecutionStreamState;
}

export function ExecutionStreamCard({ state }: Props) {
  const isActive  = state.status !== 'completed' && state.status !== 'failed';
  const isLoading = isActive;
  const vm        = state.viewModel;
  const primary   = vm?.angles.find(a => a.angle === vm.primaryAngle);

  return (
    <div
      className={`card ${isActive ? 'stream-card-active' : ''}`}
      style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
    >
      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <DecisionStateBadge phase={state.status} />
          <p style={{ fontSize: 13, color: isActive ? 'var(--text)' : 'var(--muted)', fontWeight: isActive ? 500 : 400, marginTop: 2 }}>
            {state.currentStep}
          </p>
        </div>

        {/* Duration / meta */}
        <div style={{ textAlign: 'right', fontSize: 12, color: 'var(--muted)' }}>
          {state.signalCount != null && (
            <div>{state.signalCount} angles</div>
          )}
          {state.durationMs != null && (
            <div>{state.durationMs}ms total</div>
          )}
        </div>
      </div>

      {/* ── Leading angle reveal (fires on 'decision' event) ── */}
      {state.leadingAngle && (
        <div
          className="leading-angle-reveal"
          style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.2)' }}
        >
          <div style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
            {isActive ? 'Leading angle' : 'Primary angle'}
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>
            {state.leadingAngle}
          </div>
        </div>
      )}

      {/* ── Results (only after completion) ── */}
      {vm && primary && (
        <div className="anim-fade-in">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <StabilityIndicator state={vm.stabilityState} />
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
              {vm.meta.anglesEvaluated} angles evaluated · {vm.meta.computationMs}ms
            </div>
          </div>

          {/* Primary angle detail */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, padding: '16px', background: 'var(--bg)', borderRadius: 10, marginBottom: 16 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{primary.angle}</div>
                <FatigueBadge level={primary.fatigueLevel} />
                <div style={{ fontSize: 28, fontWeight: 700, marginLeft: 'auto', color: primary.score >= 70 ? 'var(--success)' : primary.score >= 45 ? 'var(--warning)' : 'var(--danger)' }}>
                  {primary.score}
                </div>
              </div>
              <SignalLiveGraph breakdown={primary.breakdown} />
            </div>
            <div>
              <div className="card-title">Explanation</div>
              <ExplanationStreamPanel
                explanation={primary.explanation}
                loading={false}
                locked={true}
              />
            </div>
          </div>

          {/* Other angles summary */}
          {vm.angles.length > 1 && (
            <div>
              <div className="card-title">All angles</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {vm.angles.map((a, i) => (
                  <div
                    key={a.angle}
                    className="anim-slide-in"
                    style={{
                      animationDelay: `${i * 60}ms`,
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '8px 12px', borderRadius: 8,
                      background: a.angle === vm.primaryAngle ? 'rgba(99,102,241,0.07)' : 'transparent',
                      border: a.angle === vm.primaryAngle ? '1px solid rgba(99,102,241,0.2)' : '1px solid transparent',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: a.angle === vm.primaryAngle ? 700 : 400 }}>{a.angle}</span>
                      {a.angle === vm.primaryAngle && (
                        <span style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 700, textTransform: 'uppercase' }}>primary</span>
                      )}
                      {a.angle === vm.secondaryAngle && (
                        <span style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase' }}>secondary</span>
                      )}
                      <FatigueBadge level={a.fatigueLevel} />
                    </div>
                    <span style={{ fontSize: 16, fontWeight: 700, color: a.score >= 70 ? 'var(--success)' : a.score >= 45 ? 'var(--warning)' : 'var(--danger)' }}>
                      {a.score}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Loading skeleton (signals phase) ── */}
      {isLoading && !state.leadingAngle && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <SignalLiveGraph loading />
        </div>
      )}

      {/* ── Error ── */}
      {state.status === 'failed' && (
        <p style={{ fontSize: 13, color: 'var(--danger)' }}>{state.error ?? 'Execution failed'}</p>
      )}
    </div>
  );
}
