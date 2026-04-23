'use client';
import { useEffect, useState, useCallback } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { FinancialOsNav } from '@/components/FinancialOsNav';
import {
  getProfitModel,
  triggerProfitLearning,
  getLearningInsights,
  getLearningHistory,
  type ProfitModel,
} from '@/lib/api/creator-client';

// ── Local types ───────────────────────────────────────────────────────────────
interface LearnedPattern {
  type:        string;
  label:       string;
  description: string;
  strength:    number;   // 0–1
  sampleCount: number;
}

interface LearningCycleResult {
  cycleId:          string;
  samplesUsed:      number;
  modelUpdated:     boolean;
  changes:          string[];
  newAccuracy:      number;
  previousAccuracy: number;
}

interface TriggerResult {
  cycleId:          string;
  samplesUsed:      number;
  modelUpdated:     boolean;
  changes:          string[];
  newAccuracy:      number;
  previousAccuracy: number;
}

const PATTERN_ICONS: Record<string, string> = {
  HIGH_ROAS_ANGLE:      '🚀',
  LOW_ROAS_ANGLE:       '⚠',
  FATIGUE:              '😴',
  SCALING_OPPORTUNITY:  '📈',
};

function patternIcon(type: string) {
  return PATTERN_ICONS[type] ?? '🔬';
}

function fmt(n: number, decimals = 1) {
  return n.toFixed(decimals);
}

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60)  return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs  < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── Threshold bar (0–5x ROAS scale) ─────────────────────────────────────────
function ThresholdBar({ label, value, color }: { label: string; value: number; color: string }) {
  const MAX_ROAS = 5;
  const pct = Math.min(100, (value / MAX_ROAS) * 100);
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={{ fontSize: 12, color: 'var(--sub)', fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 800, color }}>{fmt(value, 2)}x ROAS</span>
      </div>
      <div className="weight-bar-track" style={{ height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.06)' }}>
        <div
          className="weight-bar-fill"
          style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.6s ease' }}
        />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
        <span style={{ fontSize: 10, color: 'var(--muted)' }}>0x</span>
        <span style={{ fontSize: 10, color: 'var(--muted)' }}>5x</span>
      </div>
    </div>
  );
}

// ── Strength bar ─────────────────────────────────────────────────────────────
function StrengthBar({ value }: { value: number }) {
  const pct = Math.min(100, value * 100);
  const color = value >= 0.7 ? 'var(--emerald)' : value >= 0.4 ? 'var(--amber)' : 'var(--rose)';
  return (
    <div className="weight-bar-row" style={{ gap: 10, alignItems: 'center' }}>
      <span className="weight-bar-label" style={{ width: 56, flexShrink: 0, color: 'var(--muted)', fontSize: 10 }}>strength</span>
      <div className="weight-bar-track" style={{ flex: 1, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)' }}>
        <div className="weight-bar-fill" style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3 }} />
      </div>
      <span className="weight-bar-value" style={{ width: 32, textAlign: 'right', fontSize: 11, color }}>{fmt(pct, 0)}%</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function LearningPage() {
  const [model,      setModel]      = useState<ProfitModel | null>(null);
  const [patterns,   setPatterns]   = useState<LearnedPattern[]>([]);
  const [history,    setHistory]    = useState<LearningCycleResult[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [running,    setRunning]    = useState(false);
  const [lastResult, setLastResult] = useState<TriggerResult | null>(null);
  const [error,      setError]      = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      getProfitModel().catch(() => null),
      getLearningInsights().catch(() => []),
      getLearningHistory().catch(() => ({ cycles: [] })),
    ]).then(([m, p, h]) => {
      if (m) setModel(m);
      setPatterns((p as LearnedPattern[]) ?? []);
      setHistory(((h as { cycles: LearningCycleResult[] }).cycles ?? []) as LearningCycleResult[]);
      setLoading(false);
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleRunCycle() {
    setRunning(true);
    setError(null);
    setLastResult(null);
    try {
      const result = await triggerProfitLearning() as TriggerResult;
      setLastResult(result);
      // Refresh model + history after cycle
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Learning cycle failed');
      setLoading(false);
    } finally {
      setRunning(false);
    }
  }

  const accuracyPct = model ? model.accuracy * 100 : 0;
  const accuracyColor =
    accuracyPct >= 75 ? 'var(--emerald)' :
    accuracyPct >= 50 ? 'var(--amber)'   : 'var(--rose)';

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-main">
        <FinancialOsNav level={0} onLevelClick={() => {}} />
        <div className="page-content">

          {/* Header */}
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', margin: '0 0 4px' }}>
              🧬 Self-Learning Profit Brain
            </h1>
            <p style={{ fontSize: 13, color: 'var(--sub)', margin: 0 }}>
              Adaptive thresholds learned from real campaign performance. Each cycle refines SCALE / KILL logic.
            </p>
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 64 }}>
              <div className="spin" style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--purple)', borderRadius: '50%' }} />
            </div>
          ) : (
            <>
              {/* Top row: Model status + Thresholds */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>

                {/* Model Status Card */}
                <div className="intel-panel">
                  <div className="intel-panel-header">
                    <span className="section-label" style={{ margin: 0 }}>Model Status</span>
                    {model && (
                      <span className="badge" style={{ marginLeft: 'auto', background: 'rgba(139,92,246,0.12)', color: 'var(--purple)', border: '1px solid rgba(139,92,246,0.25)' }}>
                        v{model.version}
                      </span>
                    )}
                  </div>
                  <div style={{ padding: '12px 14px' }}>
                    {model ? (
                      <>
                        {/* Accuracy bar */}
                        <div style={{ marginBottom: 16 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                            <span style={{ fontSize: 12, color: 'var(--sub)', fontWeight: 600 }}>Model Accuracy</span>
                            <span style={{ fontSize: 14, fontWeight: 800, color: accuracyColor }}>{fmt(accuracyPct, 1)}%</span>
                          </div>
                          <div style={{ height: 10, borderRadius: 5, background: 'rgba(255,255,255,0.06)' }}>
                            <div style={{ width: `${accuracyPct}%`, height: '100%', background: accuracyColor, borderRadius: 5, transition: 'width 0.6s ease' }} />
                          </div>
                        </div>

                        {/* Stats grid */}
                        <div className="intel-stats-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                          <div className="intel-stat-card" style={{ padding: '8px 10px' }}>
                            <div className="intel-stat-label">Total Cycles</div>
                            <div className="intel-stat-value" style={{ fontSize: 18, color: 'var(--indigo-l)' }}>{model.totalCycles}</div>
                          </div>
                          <div className="intel-stat-card" style={{ padding: '8px 10px' }}>
                            <div className="intel-stat-label">Confidence Floor</div>
                            <div className="intel-stat-value" style={{ fontSize: 18, color: 'var(--amber)' }}>{fmt(model.confidenceFloor * 100, 0)}%</div>
                          </div>
                          <div className="intel-stat-card" style={{ padding: '8px 10px' }}>
                            <div className="intel-stat-label">Last Updated</div>
                            <div className="intel-stat-value" style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>{relTime(model.lastUpdatedAt)}</div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div style={{ fontSize: 12, color: 'var(--muted)', padding: '8px 0' }}>
                        No model data available. Run a learning cycle to initialise.
                      </div>
                    )}
                  </div>
                </div>

                {/* Thresholds */}
                <div className="intel-panel">
                  <div className="intel-panel-header">
                    <span className="section-label" style={{ margin: 0 }}>Learned Thresholds</span>
                    <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--muted)' }}>0 – 5× ROAS scale</span>
                  </div>
                  <div style={{ padding: '12px 14px' }}>
                    {model ? (
                      <>
                        <ThresholdBar label="Scale Threshold (ROAS ≥ → SCALE)" value={model.scaleThreshold} color="var(--emerald)" />
                        <ThresholdBar label="Kill Threshold  (ROAS ≤ → KILL)"  value={model.killThreshold}  color="var(--rose)"    />
                        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6, lineHeight: 1.5 }}>
                          Campaigns with ROAS above the scale threshold are promoted; below kill threshold are exited. These values self-update each learning cycle.
                        </div>
                      </>
                    ) : (
                      <div style={{ fontSize: 12, color: 'var(--muted)', padding: '8px 0' }}>
                        Thresholds will appear after the first learning cycle.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Run Learning Cycle */}
              <div className="intel-panel" style={{ marginBottom: 20 }}>
                <div className="intel-panel-header">
                  <span className="section-label" style={{ margin: 0 }}>Run Learning Cycle</span>
                </div>
                <div style={{ padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                    <button
                      onClick={handleRunCycle}
                      disabled={running}
                      style={{
                        padding: '9px 22px',
                        borderRadius: 7,
                        background: running ? 'rgba(139,92,246,0.18)' : 'var(--purple)',
                        color: '#fff',
                        border: 'none',
                        fontFamily: 'inherit',
                        fontWeight: 700,
                        fontSize: 13,
                        cursor: running ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        opacity: running ? 0.8 : 1,
                        transition: 'opacity 0.15s',
                      }}
                    >
                      {running && (
                        <div className="spin" style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%' }} />
                      )}
                      {running ? 'Running cycle…' : '🧬 Run Learning Cycle'}
                    </button>
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                      Analyses recent campaign outcomes and updates adaptive thresholds + patterns.
                    </span>
                  </div>

                  {error && (
                    <div style={{ marginTop: 12, padding: '8px 12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 7, fontSize: 12, color: 'var(--rose)' }}>
                      ⚠ {error}
                    </div>
                  )}

                  {lastResult && (
                    <div style={{ marginTop: 14, padding: '12px 14px', background: 'rgba(139,92,246,0.07)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 8 }}>
                      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
                        <span className="badge" style={{ background: lastResult.modelUpdated ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.06)', color: lastResult.modelUpdated ? 'var(--emerald)' : 'var(--muted)', border: `1px solid ${lastResult.modelUpdated ? 'rgba(16,185,129,0.25)' : 'var(--border)'}` }}>
                          {lastResult.modelUpdated ? '✓ Model Updated' : '— No Change'}
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--sub)' }}>
                          {lastResult.samplesUsed} samples used
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--sub)' }}>
                          Accuracy: {fmt(lastResult.previousAccuracy * 100, 1)}% → <strong style={{ color: lastResult.newAccuracy >= lastResult.previousAccuracy ? 'var(--emerald)' : 'var(--rose)' }}>{fmt(lastResult.newAccuracy * 100, 1)}%</strong>
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 'auto' }}>
                          cycle #{lastResult.cycleId.slice(0, 8)}
                        </span>
                      </div>
                      {lastResult.changes.length > 0 && (
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--sub)', marginBottom: 6 }}>Changes applied:</div>
                          <ul style={{ margin: 0, paddingLeft: 18, listStyle: 'disc' }}>
                            {lastResult.changes.map((c, i) => (
                              <li key={i} style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.6 }}>{c}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Learning Cycle History */}
              <div className="intel-panel" style={{ marginBottom: 20 }}>
                <div className="intel-panel-header">
                  <span className="section-label" style={{ margin: 0 }}>Cycle History</span>
                  <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--muted)' }}>{history.length} cycles recorded</span>
                </div>
                {history.length === 0 ? (
                  <div style={{ padding: '20px 14px', fontSize: 12, color: 'var(--muted)' }}>
                    No cycles recorded yet. Run a learning cycle to populate history.
                  </div>
                ) : (
                  <div className="scroll-pane" style={{ maxHeight: 280, overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)' }}>
                          {['Cycle ID', 'Samples', 'Prev Acc', 'New Acc', 'Delta', 'Updated', 'Changes'].map(h => (
                            <th key={h} style={{ padding: '7px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--muted)', fontSize: 11, whiteSpace: 'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {history.map((row, idx) => {
                          const delta = row.newAccuracy - row.previousAccuracy;
                          const deltaColor = delta > 0 ? 'var(--emerald)' : delta < 0 ? 'var(--rose)' : 'var(--muted)';
                          return (
                            <tr key={row.cycleId ?? idx} style={{ borderBottom: '1px solid var(--border)' }}>
                              <td style={{ padding: '8px 12px', color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: 11 }}>
                                {row.cycleId ? row.cycleId.slice(0, 8) + '…' : '—'}
                              </td>
                              <td style={{ padding: '8px 12px', color: 'var(--text)', textAlign: 'right' }}>{row.samplesUsed ?? '—'}</td>
                              <td style={{ padding: '8px 12px', color: 'var(--sub)', textAlign: 'right' }}>{fmt((row.previousAccuracy ?? 0) * 100, 1)}%</td>
                              <td style={{ padding: '8px 12px', color: 'var(--sub)', textAlign: 'right' }}>{fmt((row.newAccuracy ?? 0) * 100, 1)}%</td>
                              <td style={{ padding: '8px 12px', fontWeight: 700, color: deltaColor, textAlign: 'right' }}>
                                {delta > 0 ? '+' : ''}{fmt(delta * 100, 1)}%
                              </td>
                              <td style={{ padding: '8px 12px' }}>
                                <span className="badge" style={{
                                  background: row.modelUpdated ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.04)',
                                  color: row.modelUpdated ? 'var(--emerald)' : 'var(--muted)',
                                  border: `1px solid ${row.modelUpdated ? 'rgba(16,185,129,0.2)' : 'var(--border)'}`,
                                }}>
                                  {row.modelUpdated ? 'Yes' : 'No'}
                                </span>
                              </td>
                              <td style={{ padding: '8px 12px', maxWidth: 260 }}>
                                {row.changes && row.changes.length > 0 ? (
                                  <ul style={{ margin: 0, paddingLeft: 14, listStyle: 'disc' }}>
                                    {row.changes.map((c, ci) => (
                                      <li key={ci} style={{ fontSize: 11, color: 'var(--sub)', lineHeight: 1.5 }}>{c}</li>
                                    ))}
                                  </ul>
                                ) : (
                                  <span style={{ color: 'var(--muted)', fontSize: 11 }}>—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Learned Patterns */}
              <div>
                <div className="section-label">Learned Patterns</div>
                {(model?.learnedPatterns ?? patterns).length === 0 ? (
                  <div style={{ padding: '20px 0', fontSize: 12, color: 'var(--muted)' }}>
                    No patterns learned yet. Patterns emerge after the model processes sufficient campaign cycles.
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                    {(model?.learnedPatterns ?? patterns).map((p, i) => (
                      <div
                        key={`${p.type}-${i}`}
                        className="intel-panel"
                        style={{ padding: 0 }}
                      >
                        <div style={{ padding: '12px 14px' }}>
                          {/* Header */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                            <span style={{ fontSize: 22, lineHeight: 1 }}>{patternIcon(p.type)}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {p.label}
                              </div>
                              <span className="badge" style={{ fontSize: 10, color: 'var(--indigo-l)', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}>
                                {p.type.replace(/_/g, ' ')}
                              </span>
                            </div>
                          </div>
                          {/* Description */}
                          <p style={{ fontSize: 11, color: 'var(--sub)', lineHeight: 1.55, margin: '0 0 10px' }}>
                            {p.description}
                          </p>
                          {/* Strength bar */}
                          <StrengthBar value={p.strength} />
                          {/* Sample count */}
                          <div style={{ marginTop: 8, fontSize: 11, color: 'var(--muted)' }}>
                            {p.sampleCount.toLocaleString()} samples analysed
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

        </div>
      </main>
    </div>
  );
}
