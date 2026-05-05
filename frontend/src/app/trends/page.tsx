'use client';
import { useState, useEffect, useRef } from 'react';
import {
  runTrendPrediction, getPredictedTrends, getTrendSummary, getTrendHistory,
  type PredictedTrend, type TrendSummary, type TrendStage, type TrendHistoryEntry,
} from '@/lib/api/creator-client';

// ─── Constants ────────────────────────────────────────────────────────────────

const STAGE_META: Record<TrendStage, { label: string; color: string; icon: string; pos: number }> = {
  early:      { label: 'Early Signal',  color: '#10b981', icon: '🌱', pos: 10  },
  emerging:   { label: 'Emerging',      color: '#06b6d4', icon: '📡', pos: 32  },
  rising:     { label: 'Rising',        color: '#8b5cf6', icon: '🚀', pos: 56  },
  peak:       { label: 'Peak',          color: '#f97316', icon: '🏔',  pos: 78  },
  saturating: { label: 'Saturating',    color: '#ef4444', icon: '⚠',  pos: 95  },
};

const EMOTION_COLOR: Record<string, string> = {
  urgency: '#f97316', fear: '#ef4444', desire: '#ec4899',
  social_proof: '#10b981', curiosity: '#8b5cf6', authority: '#06b6d4',
  value: '#f59e0b', neutral: '#6b7280',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function LifecycleTrack({ stage }: { stage: TrendStage }) {
  const stages: TrendStage[] = ['early', 'emerging', 'rising', 'peak', 'saturating'];
  return (
    <div style={{ position: 'relative', height: 28, margin: '8px 0' }}>
      {/* Track */}
      <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 3, background: 'var(--border)', borderRadius: 99, transform: 'translateY(-50%)' }}>
        <div style={{
          height: '100%', borderRadius: 99, background: 'linear-gradient(90deg, #10b981, #06b6d4, #8b5cf6, #f97316, #ef4444)',
          width: `${STAGE_META[stage].pos}%`, transition: 'width 0.5s ease',
        }} />
      </div>
      {/* Stage markers */}
      {stages.map(s => (
        <div key={s} style={{
          position: 'absolute', top: '50%', left: `${STAGE_META[s].pos}%`,
          transform: 'translate(-50%, -50%)', width: s === stage ? 12 : 7, height: s === stage ? 12 : 7,
          borderRadius: '50%', background: s === stage ? STAGE_META[s].color : 'var(--border)',
          border: `2px solid ${s === stage ? STAGE_META[s].color : 'var(--surface)'}`,
          transition: 'all 0.3s ease', zIndex: 2,
          boxShadow: s === stage ? `0 0 8px ${STAGE_META[s].color}66` : 'none',
        }} />
      ))}
    </div>
  );
}

function TrendCard({ trend, onUse }: { trend: PredictedTrend; onUse: (t: PredictedTrend) => void }) {
  const [expanded, setExpanded] = useState(false);
  const sm    = STAGE_META[trend.currentStage];
  const ec    = EMOTION_COLOR[trend.emotionalDriver] ?? '#6b7280';
  const isHot = trend.currentStage === 'early' || trend.currentStage === 'emerging';

  return (
    <div className="intel-panel" style={{ border: `1px solid ${sm.color}33`, cursor: 'pointer' }}
      onClick={() => setExpanded(e => !e)}>
      <div className="intel-panel-header">
        <span style={{ fontSize: 18 }}>{sm.icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{trend.trendName}</div>
          <div style={{ display: 'flex', gap: 6, marginTop: 3 }}>
            <span className="badge" style={{ background: `${sm.color}18`, color: sm.color }}>{sm.label}</span>
            <span className="badge" style={{ background: `${ec}18`, color: ec }}>{trend.emotionalDriver}</span>
            {isHot && <span className="badge" style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--rose)' }}>🔥 Act Now</span>}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: sm.color }}>
            {(trend.viralityScore * 100).toFixed(0)}
          </div>
          <div style={{ fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase' }}>Virality</div>
        </div>
      </div>
      <div style={{ padding: '10px 14px' }}>
        <LifecycleTrack stage={trend.currentStage} />
        <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 11, color: 'var(--muted)' }}>
          <span>Peak: <strong style={{ color: 'var(--text)' }}>{trend.predictedPeakTime}</strong></span>
          <span>Confidence: <strong style={{ color: 'var(--text)' }}>{(trend.confidence * 100).toFixed(0)}%</strong></span>
          <span>Saturation risk: <strong style={{ color: trend.riskOfSaturation > 0.6 ? 'var(--rose)' : 'var(--emerald)' }}>{(trend.riskOfSaturation * 100).toFixed(0)}%</strong></span>
          <span>{trend.competitors} competitors</span>
        </div>

        {expanded && (
          <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 6 }}>
              HOOK PATTERN
            </div>
            <div style={{ fontSize: 12, color: 'var(--sub)', fontStyle: 'italic', marginBottom: 10 }}>
              "{trend.hookPattern}"
            </div>
            {trend.supportingExamples.length > 0 && (
              <>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 6 }}>
                  SUPPORTING EXAMPLES
                </div>
                {trend.supportingExamples.slice(0, 3).map((ex, i) => (
                  <div key={i} style={{ fontSize: 11, color: 'var(--sub)', padding: '3px 0', borderBottom: '1px solid var(--border)' }}>
                    • "{ex.slice(0, 90)}"
                  </div>
                ))}
              </>
            )}
            <button
              onClick={e => { e.stopPropagation(); onUse(trend); }}
              style={{ marginTop: 12, width: '100%', padding: '8px 0', borderRadius: 7, background: sm.color, border: 'none', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              🚀 Use Before Peak
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function MiniSparkline({ snapshots }: { snapshots: { viralityScore: number }[] }) {
  if (snapshots.length < 2) return <span style={{ fontSize: 10, color: 'var(--muted)' }}>–</span>;
  const max   = Math.max(...snapshots.map(s => s.viralityScore), 0.01);
  const w     = 60;
  const h     = 24;
  const pts   = snapshots.slice(-8).map((s, i, arr) => {
    const x = (i / (arr.length - 1)) * w;
    const y = h - (s.viralityScore / max) * h;
    return `${x},${y}`;
  }).join(' ');
  const last  = snapshots[snapshots.length - 1].viralityScore;
  const prev  = snapshots[snapshots.length - 2]?.viralityScore ?? last;
  const color = last >= prev ? '#10b981' : '#ef4444';
  return (
    <svg width={w} height={h} style={{ overflow: 'visible' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} />
    </svg>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TrendsPage() {
  const [tab, setTab]             = useState<'feed' | 'lifecycle' | 'history'>('feed');
  const [summary, setSummary]     = useState<TrendSummary | null>(null);
  const [trends, setTrends]       = useState<PredictedTrend[]>([]);
  const [history, setHistory]     = useState<TrendHistoryEntry[]>([]);
  const [loading, setLoading]     = useState(true);
  const [running, setRunning]     = useState(false);
  const [stageFilter, setStageFilter] = useState<TrendStage | 'all'>('all');
  const [usedTrend, setUsedTrend] = useState<PredictedTrend | null>(null);

  useEffect(() => {
    Promise.all([
      getPredictedTrends().catch(() => ({ trends: [], summary: null as unknown as TrendSummary })),
      getTrendHistory().catch(() => ({ history: [] })),
    ]).then(([t, h]) => {
      setTrends(t.trends ?? []);
      if (t.summary) setSummary(t.summary);
      setHistory(h.history ?? []);
      setLoading(false);
    });
  }, []);

  async function handleRun() {
    setRunning(true);
    const data = await runTrendPrediction().catch(() => null);
    if (data) {
      setTrends(data.trends ?? []);
      if (data.summary) setSummary(data.summary);
    }
    const h = await getTrendHistory().catch(() => ({ history: [] as TrendHistoryEntry[] }));
    setHistory(h.history ?? []);
    setRunning(false);
  }

  const filtered = stageFilter === 'all' ? trends : trends.filter(t => t.currentStage === stageFilter);
  const stages: TrendStage[] = ['early', 'emerging', 'rising', 'peak', 'saturating'];

  return (
        {/* Nav */}
        <div className="tab-bar" style={{ padding: '0 32px', background: 'var(--surface)', margin: 0, borderBottom: '1px solid var(--border)' }}>
          {(['feed', 'lifecycle', 'history'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`tab-btn${tab === t ? ' active' : ''}`} style={{ textTransform: 'capitalize' }}>
              {t === 'feed' ? '🔮 Trend Feed' : t === 'lifecycle' ? '📊 Lifecycle' : '📜 History'}
            </button>
          ))}
          <button onClick={handleRun} disabled={running}
            style={{ marginLeft: 'auto', padding: '4px 14px', borderRadius: 6, background: 'var(--indigo)', border: 'none', color: '#fff', fontSize: 12, fontWeight: 700, cursor: running ? 'not-allowed' : 'pointer', opacity: running ? 0.7 : 1, fontFamily: 'inherit', marginBottom: 2 }}>
            {running ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="spin" style={{ width: 10, height: 10, border: '2px solid #ffffff44', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block' }} /> Running…
              </span>
            ) : '⟳ Run Prediction'}
          </button>
        </div>

        <div className="page-content">
          {/* Header */}
          <div style={{ marginBottom: 20 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', margin: '0 0 4px' }}>
              🔮 Trend Prediction Engine
            </h1>
            <p style={{ fontSize: 12, color: 'var(--sub)' }}>
              Predicts viral ad trends before they peak · confidence-scored · lifecycle-tracked · never auto-applied
            </p>
          </div>

          {/* KPI row */}
          {summary && (
            <div className="intel-stats-grid intel-stats-grid-5" style={{ marginBottom: 20 }}>
              {[
                { label: 'Total Trends',   value: summary.total,        color: 'var(--indigo-l)' },
                { label: 'Early Signals',  value: summary.earlySignals, color: 'var(--emerald)'  },
                { label: 'Emerging',       value: summary.emerging,     color: 'var(--cyan)'     },
                { label: 'Rising',         value: summary.rising,       color: 'var(--purple)'   },
                { label: 'Saturating',     value: summary.saturating,   color: 'var(--rose)'     },
              ].map(k => (
                <div key={k.label} className="intel-stat-card">
                  <div className="intel-stat-label">{k.label}</div>
                  <div className="intel-stat-value" style={{ fontSize: 20, color: k.color }}>{k.value}</div>
                </div>
              ))}
            </div>
          )}

          {/* "Used trend" toast */}
          {usedTrend && (
            <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 8, padding: '10px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--emerald)' }}>✓ Trend queued for builder</span>
              <span style={{ fontSize: 11, color: 'var(--sub)' }}>"{usedTrend.trendName}" — {usedTrend.creativeFormat} format ready to inject</span>
              <button onClick={() => setUsedTrend(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 13 }}>✕</button>
            </div>
          )}

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
              <div className="spin" style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--indigo)', borderRadius: '50%' }} />
            </div>
          ) : (
            <>
              {/* ─── TAB: FEED ──────────────────────────────────────────────── */}
              {tab === 'feed' && (
                <>
                  {/* Stage filter */}
                  <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                    <button onClick={() => setStageFilter('all')}
                      className={`tab-btn${stageFilter === 'all' ? ' active' : ''}`}
                      style={{ fontSize: 11, padding: '4px 12px' }}>All</button>
                    {stages.map(s => {
                      const sm = STAGE_META[s];
                      return (
                        <button key={s} onClick={() => setStageFilter(s)}
                          style={{ padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                            background: stageFilter === s ? `${sm.color}18` : 'var(--surface)',
                            border: `1px solid ${stageFilter === s ? sm.color : 'var(--border)'}`,
                            color: stageFilter === s ? sm.color : 'var(--muted)' }}>
                          {sm.icon} {sm.label}
                        </button>
                      );
                    })}
                  </div>

                  {filtered.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)' }}>
                      <div style={{ fontSize: 36, marginBottom: 8 }}>🔮</div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>No trends predicted yet</div>
                      <div style={{ fontSize: 11, marginBottom: 16 }}>Run competitor analysis first, then click "Run Prediction"</div>
                      <button onClick={handleRun} disabled={running}
                        style={{ padding: '8px 20px', borderRadius: 7, background: 'var(--indigo)', border: 'none', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                        ⟳ Run Prediction Now
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
                      {filtered.map(trend => (
                        <TrendCard key={trend.id} trend={trend} onUse={t => setUsedTrend(t)} />
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* ─── TAB: LIFECYCLE ─────────────────────────────────────────── */}
              {tab === 'lifecycle' && (
                <>
                  <div className="section-label" style={{ marginBottom: 12 }}>Trend Lifecycle Map</div>
                  {/* Lifecycle header */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 1, marginBottom: 20, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
                    {stages.map((s, i) => {
                      const sm    = STAGE_META[s];
                      const count = trends.filter(t => t.currentStage === s).length;
                      return (
                        <div key={s} style={{ background: `${sm.color}0d`, padding: '12px 16px', borderRight: i < 4 ? '1px solid var(--border)' : 'none' }}>
                          <div style={{ fontSize: 20, marginBottom: 4 }}>{sm.icon}</div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: sm.color }}>{sm.label}</div>
                          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>{count}</div>
                        </div>
                      );
                    })}
                  </div>
                  {/* Trends by stage */}
                  {stages.map(s => {
                    const stageTrends = trends.filter(t => t.currentStage === s);
                    if (!stageTrends.length) return null;
                    const sm = STAGE_META[s];
                    return (
                      <div key={s} style={{ marginBottom: 20 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                          <span style={{ fontSize: 16 }}>{sm.icon}</span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: sm.color }}>{sm.label}</span>
                          <span className="badge" style={{ background: `${sm.color}18`, color: sm.color }}>{stageTrends.length}</span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
                          {stageTrends.map(t => (
                            <div key={t.id} className="intel-panel" style={{ border: `1px solid ${sm.color}22` }}>
                              <div style={{ padding: 12 }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{t.trendName}</div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                  <span style={{ fontSize: 10, color: 'var(--muted)' }}>Virality</span>
                                  <span style={{ fontSize: 14, fontWeight: 800, color: sm.color }}>{(t.viralityScore * 100).toFixed(0)}%</span>
                                </div>
                                <div style={{ background: 'var(--border)', borderRadius: 99, height: 3 }}>
                                  <div style={{ width: `${t.viralityScore * 100}%`, height: '100%', background: sm.color, borderRadius: 99 }} />
                                </div>
                                <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 6 }}>
                                  Peak: {t.predictedPeakTime} · {t.competitors} competitors
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  {trends.length === 0 && (
                    <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)' }}>
                      <div style={{ fontSize: 36, marginBottom: 8 }}>📊</div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>No lifecycle data yet</div>
                    </div>
                  )}
                </>
              )}

              {/* ─── TAB: HISTORY ───────────────────────────────────────────── */}
              {tab === 'history' && (
                <>
                  <div className="section-label" style={{ marginBottom: 12 }}>Trend History ({history.length})</div>
                  {history.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)' }}>
                      <div style={{ fontSize: 36, marginBottom: 8 }}>📜</div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>No history yet</div>
                      <div style={{ fontSize: 11 }}>Run predictions over time to build a trend history</div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {history.slice(0, 20).map(h => {
                        const sm = STAGE_META[h.trend.currentStage];
                        return (
                          <div key={h.trend.id} className="intel-panel">
                            <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 14 }}>
                              <span style={{ fontSize: 16 }}>{sm.icon}</span>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{h.trend.trendName}</div>
                                <div style={{ fontSize: 10, color: 'var(--muted)' }}>
                                  {h.snapshots.length} snapshots · first detected {new Date(h.trend.detectedAt).toLocaleDateString()}
                                </div>
                              </div>
                              <MiniSparkline snapshots={h.snapshots} />
                              <div style={{ textAlign: 'right', minWidth: 50 }}>
                                <div style={{ fontSize: 16, fontWeight: 800, color: sm.color }}>{(h.trend.viralityScore * 100).toFixed(0)}%</div>
                                <span className="badge" style={{ background: `${sm.color}18`, color: sm.color }}>{sm.label}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
  );
}
