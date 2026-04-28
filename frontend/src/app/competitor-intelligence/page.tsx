'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Sidebar } from '@/components/Sidebar';
import {
  getCIAutonomy, setCIAutonomy, startCompetitorAnalysis,
  listCompetitorJobs, getCompetitorResult, exportIntelToBuilder,
  getCompetitorExports, enableCIMonitoring, disableCIMonitoring,
  getCIMonitoringStatus,
  type CIJob, type CIResult, type CICluster, type CIAdItem,
  type CIAutonomyMeta, type CIMonitoringState, type CIExportedIntel,
} from '@/lib/api/creator-client';
import {
  scanCompetitor, getCompetitors, deleteCompetitor,
  type Competitor,
} from '@/lib/api/resources-client';

// ─── Constants ────────────────────────────────────────────────────────────────

const CLUSTER_META: Record<string, { color: string; icon: string }> = {
  winning_hooks:      { color: 'var(--emerald)', icon: '🏆' },
  winning_formats:    { color: 'var(--indigo-l)', icon: '🎯' },
  saturated_patterns: { color: 'var(--rose)',    icon: '⚠' },
  emerging_trends:    { color: 'var(--amber)',   icon: '🚀' },
};

const EMOTION_COLOR: Record<string, string> = {
  urgency:      '#f97316', fear: '#ef4444', desire: '#ec4899',
  social_proof: '#10b981', curiosity: '#8b5cf6', authority: '#06b6d4',
  value:        '#f59e0b', neutral: '#6b7280',
};

const STATUS_LABEL: Record<string, string> = {
  pending: 'Queued', scraping: 'Scraping pages', normalizing: 'Extracting intel',
  scoring: 'Scoring patterns', clustering: 'Clustering', insights: 'Generating insights',
  complete: 'Complete', failed: 'Failed',
};

const INDUSTRIES = [
  'E-commerce', 'SaaS', 'DTC / CPG', 'Finance', 'Health & Wellness',
  'Education', 'Real Estate', 'Agency / Services', 'Other',
];

const LEVEL_META = [
  { level: 0, color: '#ef4444', label: '🔴 L0 Manual Only',       desc: 'User initiates everything. Zero background activity.' },
  { level: 1, color: '#f59e0b', label: '🟡 L1 Suggest Insights',  desc: 'Surface recommendations. No automatic usage.' },
  { level: 2, color: '#f97316', label: '🟠 L2 Approval Required', desc: 'System proposes, admin approves before any use.' },
  { level: 3, color: '#10b981', label: '🟢 L3 Full Autonomous',   desc: 'Auto-monitors + injects approved patterns. ADMIN ONLY.' },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function ProgressBar({ value, color = 'var(--indigo)' }: { value: number; color?: string }) {
  return (
    <div style={{ background: 'var(--border)', borderRadius: 99, height: 4, overflow: 'hidden' }}>
      <div style={{ width: `${value}%`, height: '100%', background: color, borderRadius: 99, transition: 'width 0.4s ease' }} />
    </div>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontSize: 10, color: 'var(--muted)' }}>{label}</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text)' }}>{(value * 100).toFixed(0)}%</span>
      </div>
      <ProgressBar value={value * 100} color={value > 0.65 ? 'var(--emerald)' : value > 0.35 ? 'var(--amber)' : 'var(--rose)'} />
    </div>
  );
}

function AdCard({ ad, selected, onToggle }: { ad: CIAdItem; selected: boolean; onToggle: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const ec = EMOTION_COLOR[ad.emotionalTrigger] ?? '#6b7280';
  return (
    <div style={{
      background: 'var(--surface)', border: `1px solid ${selected ? 'var(--indigo)' : 'var(--border)'}`,
      borderRadius: 10, padding: 14, cursor: 'pointer',
      outline: selected ? '2px solid var(--indigo)30' : 'none',
      transition: 'border-color 0.15s',
    }} onClick={() => setExpanded(e => !e)}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 8 }}>
        <input type="checkbox" checked={selected} onChange={onToggle}
          onClick={e => e.stopPropagation()}
          style={{ marginTop: 2, flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', lineHeight: 1.4, marginBottom: 4 }}>
            &quot;{ad.hook}&quot;
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <span className="badge" style={{ background: `${ec}18`, color: ec, border: `1px solid ${ec}33` }}>
              {ad.emotionalTrigger}
            </span>
            <span className="badge" style={{ background: 'var(--surface-2)', color: 'var(--muted)', border: '1px solid var(--border)' }}>
              {ad.format}
            </span>
            <span className="badge" style={{
              background: ad.performanceSignal > 0.65 ? 'rgba(16,185,129,0.12)' : ad.performanceSignal > 0.35 ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)',
              color: ad.performanceSignal > 0.65 ? 'var(--emerald)' : ad.performanceSignal > 0.35 ? 'var(--amber)' : 'var(--rose)',
              border: 'none',
            }}>
              {(ad.performanceSignal * 100).toFixed(0)}% signal
            </span>
          </div>
        </div>
      </div>
      {expanded && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 6 }}>
          {ad.copy && (
            <p style={{ fontSize: 11, color: 'var(--sub)', marginBottom: 8, lineHeight: 1.5 }}>{ad.copy}</p>
          )}
          <div style={{ display: 'flex', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>CTA: <strong style={{ color: 'var(--text)' }}>{ad.cta}</strong></span>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>Structure: <strong style={{ color: 'var(--text)' }}>{ad.landingPageStructure}</strong></span>
          </div>
          <ScoreBar label="Engagement"         value={ad.scores.engagementLikelihood} />
          <ScoreBar label="Clarity"            value={ad.scores.clarityScore} />
          <ScoreBar label="Emotional Intensity" value={ad.scores.emotionalIntensity} />
          <ScoreBar label="Novelty"            value={ad.scores.noveltyScore} />
          <div style={{ marginTop: 8, fontSize: 10, color: 'var(--muted)', wordBreak: 'break-all' }}>
            Source: <a href={ad.source} target="_blank" rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              style={{ color: 'var(--indigo-l)', textDecoration: 'none' }}>{ad.source}</a>
          </div>
        </div>
      )}
    </div>
  );
}

function ClusterCard({ cluster, ads, onExport }: {
  cluster: CICluster;
  ads: CIAdItem[];
  onExport: (clusterId: string) => void;
}) {
  const meta    = CLUSTER_META[cluster.type] ?? { color: 'var(--sub)', icon: '◦' };
  const myAds   = ads.filter(a => cluster.items.includes(a.id));
  const topHook = myAds.sort((a, b) => b.performanceSignal - a.performanceSignal)[0]?.hook ?? '';

  return (
    <div className="intel-panel" style={{ border: `1px solid ${meta.color}33` }}>
      <div className="intel-panel-header">
        <span style={{ fontSize: 16 }}>{meta.icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: meta.color }}>{cluster.label}</div>
          <div style={{ fontSize: 10, color: 'var(--muted)' }}>
            {cluster.items.length} ads · avg score {(cluster.avgScore * 100).toFixed(0)}%
          </div>
        </div>
        <button onClick={() => onExport(cluster.id)}
          style={{ padding: '5px 12px', borderRadius: 6, background: 'var(--indigo)', border: 'none',
            color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
          ✦ Use in Builder
        </button>
      </div>
      <div style={{ padding: '10px 14px' }}>
        <ProgressBar value={cluster.avgScore * 100} color={meta.color} />
        {topHook && (
          <div style={{ marginTop: 8, fontSize: 11, color: 'var(--sub)', fontStyle: 'italic' }}>
            Top: &quot;{topHook.slice(0, 80)}&quot;
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CompetitorIntelligencePage() {
  const [tab, setTab]               = useState<'analyze' | 'results' | 'exports' | 'monitoring'>('analyze');
  const [autonomy, setAutonomyData] = useState<CIAutonomyMeta | null>(null);
  const [monitoring, setMonitoring] = useState<CIMonitoringState | null>(null);
  const [jobs, setJobs]             = useState<CIJob[]>([]);
  const [activeJob, setActiveJob]   = useState<CIJob | null>(null);
  const [result, setResult]         = useState<CIResult | null>(null);
  const [exports, setExports]       = useState<CIExportedIntel[]>([]);
  const [exportResult, setExportResult] = useState<CIExportedIntel | null>(null);
  const [selectedAds, setSelectedAds]   = useState<Set<string>>(new Set());
  const [showLevelPanel, setShowLevelPanel] = useState(false);
  const [exporting, setExporting]   = useState(false);

  // Quick scanner (Saved Intel) state
  const [savedComps,     setSavedComps]     = useState<Competitor[]>([]);
  const [savedScanUrl,   setSavedScanUrl]   = useState('');
  const [savedScanning,  setSavedScanning]  = useState(false);
  const [savedScanError, setSavedScanError] = useState<string | null>(null);
  const [expandedSaved,  setExpandedSaved]  = useState<string | null>(null);

  // Input form state
  const [form, setForm] = useState({
    competitorName: '', brandUrl: '', industry: 'E-commerce', keywords: '',
  });
  const [analyzing, setAnalyzing] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Initial load
  useEffect(() => {
    Promise.all([
      getCIAutonomy().catch(() => null),
      getCIMonitoringStatus().catch(() => null),
      listCompetitorJobs().catch(() => ({ jobs: [] })),
      getCompetitorExports().catch(() => ({ exports: [] })),
      getCompetitors().catch(() => [] as Competitor[]),
    ]).then(([aut, mon, j, exp, comps]) => {
      if (aut) setAutonomyData(aut);
      if (mon) setMonitoring(mon);
      setJobs(j?.jobs ?? []);
      setExports(exp?.exports ?? []);
      setSavedComps(comps as Competitor[]);
    });
  }, []);

  // Polling for active job
  const startPolling = useCallback((jobId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const data = await getCompetitorResult(jobId).catch(() => null);
      if (!data) return;
      if (data.job) setActiveJob(data.job);
      if (data.result) {
        setResult(data.result);
        setJobs(prev => prev.map(j => j.id === jobId ? data.job! : j));
      }
      if (data.job?.status === 'complete' || data.job?.status === 'failed') {
        if (pollRef.current) clearInterval(pollRef.current);
        setAnalyzing(false);
        if (data.job.status === 'complete') setTab('results');
      }
    }, 3000);
  }, []);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  // suppress unused warning
  void exportResult;

  async function handleQuickScan() {
    const url = savedScanUrl.trim();
    if (!url) return;
    setSavedScanning(true);
    setSavedScanError(null);
    try {
      const result = await scanCompetitor(url);
      setSavedComps(prev => [result, ...prev]);
      setSavedScanUrl('');
      setExpandedSaved(result.id);
    } catch (err: unknown) {
      setSavedScanError((err as Error)?.message ?? 'Scan failed — check the URL and try again');
    } finally {
      setSavedScanning(false);
    }
  }

  async function handleDeleteSaved(id: string) {
    if (!confirm('Remove this competitor?')) return;
    await deleteCompetitor(id).catch(() => {});
    setSavedComps(prev => prev.filter(c => c.id !== id));
    if (expandedSaved === id) setExpandedSaved(null);
  }

  async function handleAnalyze() {
    if (!form.competitorName.trim() || !form.brandUrl.trim()) return;
    setAnalyzing(true);
    setResult(null);
    setSelectedAds(new Set());
    setExportResult(null);
    try {
      const job = await startCompetitorAnalysis({
        competitorName: form.competitorName.trim(),
        brandUrl:       form.brandUrl.trim(),
        industry:       form.industry,
        keywords:       form.keywords ? form.keywords.split(',').map(k => k.trim()) : [],
      });
      setActiveJob(job);
      setJobs(prev => [job, ...prev]);
      startPolling(job.id);
    } catch {
      setAnalyzing(false);
    }
  }

  async function handleSelectJob(job: CIJob) {
    setActiveJob(job);
    if (job.status === 'complete') {
      const data = await getCompetitorResult(job.id).catch(() => null);
      if (data?.result) { setResult(data.result); setTab('results'); }
    } else if (job.status !== 'failed') {
      startPolling(job.id);
      setTab('analyze');
    }
  }

  async function handleExportCluster(clusterId: string) {
    if (!activeJob || !result) return;
    setExporting(true);
    const intel = await exportIntelToBuilder(activeJob.id, [clusterId]).catch(() => null);
    setExporting(false);
    if (intel && !('error' in intel)) {
      setExportResult(intel);
      setExports(prev => [intel, ...prev]);
      setTab('exports');
    }
  }

  async function handleExportSelected() {
    if (!activeJob || !result || selectedAds.size === 0) return;
    const selectedClusters = [...new Set(
      result.ads.filter(a => selectedAds.has(a.id)).map(a => a.clusterId).filter(Boolean)
    )];
    if (!selectedClusters.length) return;
    setExporting(true);
    const intel = await exportIntelToBuilder(activeJob.id, selectedClusters).catch(() => null);
    setExporting(false);
    if (intel && !('error' in intel)) {
      setExportResult(intel);
      setExports(prev => [intel, ...prev]);
      setTab('exports');
    }
  }

  async function handleSetLevel(l: 0|1|2|3) {
    const data = await setCIAutonomy(l).catch(() => null);
    if (data) setAutonomyData(data);
    setShowLevelPanel(false);
  }

  async function handleToggleMonitoring() {
    if (monitoring?.enabled) {
      const r = await disableCIMonitoring().catch(() => null);
      if (r) setMonitoring(prev => prev ? { ...prev, enabled: false } : prev);
    } else {
      const r = await enableCIMonitoring().catch(() => null);
      if (r) setMonitoring(prev => prev ? { ...prev, enabled: true } : prev);
    }
    const state = await getCIMonitoringStatus().catch(() => null);
    if (state) setMonitoring(state);
  }

  const currentLevel = LEVEL_META[autonomy?.current ?? 0];

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-main">

        {/* Top bar */}
        <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '0 32px', display: 'flex', alignItems: 'center', gap: 2 }}>
          {(['analyze', 'results', 'exports', 'monitoring'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`tab-btn${tab === t ? ' active' : ''}`}
              style={{ textTransform: 'capitalize' }}>
              {t === 'analyze'    ? '🔍 Analyze'    : ''}
              {t === 'results'    ? '📊 Results'    : ''}
              {t === 'exports'    ? '✦ Builder Exports' : ''}
              {t === 'monitoring' ? '📡 Monitoring' : ''}
            </button>
          ))}
          <button onClick={() => setShowLevelPanel(v => !v)}
            style={{ marginLeft: 'auto', padding: '4px 12px', borderRadius: 20, background: `${currentLevel?.color ?? '#ef4444'}18`,
              border: `1px solid ${currentLevel?.color ?? '#ef4444'}44`, color: currentLevel?.color ?? '#ef4444',
              fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            {currentLevel?.label ?? '🔴 L0 Manual Only'}
          </button>
        </div>

        <div className="page-content">
          {/* Header */}
          <div style={{ marginBottom: 20 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', margin: '0 0 4px' }}>
              🕵️ Competitor Intelligence Workspace
            </h1>
            <p style={{ fontSize: 12, color: 'var(--sub)' }}>
              Passive intelligence collector — observes public competitor data · extracts patterns · enhances creation only with your approval
            </p>
          </div>

          {/* Level panel */}
          {showLevelPanel && (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 20 }}>
              <div className="section-label" style={{ marginBottom: 10 }}>Autonomy Level</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
                {LEVEL_META.map(lm => (
                  <button key={lm.level} onClick={() => handleSetLevel(lm.level as 0|1|2|3)}
                    style={{ padding: '10px 12px', borderRadius: 8, textAlign: 'left',
                      background: (autonomy?.current ?? 0) === lm.level ? `${lm.color}18` : 'transparent',
                      border: `1.5px solid ${(autonomy?.current ?? 0) === lm.level ? lm.color : 'var(--border)'}`,
                      cursor: 'pointer', fontFamily: 'inherit' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: lm.color, marginBottom: 3 }}>{lm.label}</div>
                    <div style={{ fontSize: 10, color: 'var(--muted)', lineHeight: 1.4 }}>{lm.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Safety banner */}
          <div style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8, padding: '8px 14px', marginBottom: 20, display: 'flex', gap: 12, alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--emerald)' }}>🔒 Safety Active</span>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>
              Public data only · No private scraping · No automatic injection · All usage requires your action
            </span>
            {monitoring?.enabled && (
              <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--amber)', fontWeight: 600 }}>
                📡 Monitoring ON
              </span>
            )}
          </div>

          {/* ─── TAB: ANALYZE ──────────────────────────────────────────────── */}
          {tab === 'analyze' && (
            <div style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: 20 }}>
              {/* Input panel */}
              <div>
                <div className="section-label">Competitor Input</div>
                <div className="intel-panel" style={{ marginBottom: 16 }}>
                  <div style={{ padding: 16 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>
                      COMPETITOR NAME
                    </label>
                    <input
                      value={form.competitorName}
                      onChange={e => setForm(f => ({ ...f, competitorName: e.target.value }))}
                      placeholder="e.g. Dollar Shave Club"
                      style={{ width: '100%', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box', marginBottom: 12 }}
                    />
                    <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>
                      BRAND URL
                    </label>
                    <input
                      value={form.brandUrl}
                      onChange={e => setForm(f => ({ ...f, brandUrl: e.target.value }))}
                      placeholder="e.g. dollarshaveclub.com"
                      style={{ width: '100%', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box', marginBottom: 12 }}
                    />
                    <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>
                      INDUSTRY
                    </label>
                    <select
                      value={form.industry}
                      onChange={e => setForm(f => ({ ...f, industry: e.target.value }))}
                      style={{ width: '100%', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box', marginBottom: 12 }}>
                      {INDUSTRIES.map(i => <option key={i}>{i}</option>)}
                    </select>
                    <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>
                      KEYWORDS (optional, comma-separated)
                    </label>
                    <input
                      value={form.keywords}
                      onChange={e => setForm(f => ({ ...f, keywords: e.target.value }))}
                      placeholder="e.g. subscription, men's grooming, DTC"
                      style={{ width: '100%', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box', marginBottom: 16 }}
                    />
                    <button
                      onClick={handleAnalyze}
                      disabled={analyzing || !form.competitorName.trim() || !form.brandUrl.trim()}
                      style={{ width: '100%', padding: '10px 0', borderRadius: 8, background: 'var(--indigo)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: analyzing ? 'not-allowed' : 'pointer', opacity: analyzing ? 0.7 : 1, fontFamily: 'inherit' }}>
                      {analyzing ? '⟳ Analyzing...' : '▶ Start Analysis'}
                    </button>
                  </div>
                </div>

                {/* Previous jobs */}
                {jobs.length > 0 && (
                  <>
                    <div className="section-label">Previous Analyses</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {jobs.slice(0, 6).map(j => (
                        <button key={j.id} onClick={() => handleSelectJob(j)}
                          style={{ padding: '8px 12px', borderRadius: 8, background: activeJob?.id === j.id ? 'rgba(99,102,241,0.1)' : 'var(--surface)', border: `1px solid ${activeJob?.id === j.id ? 'var(--indigo)' : 'var(--border)'}`, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{j.input.competitorName}</span>
                            <span className="badge" style={{
                              background: j.status === 'complete' ? 'rgba(16,185,129,0.12)' : j.status === 'failed' ? 'rgba(239,68,68,0.12)' : 'rgba(99,102,241,0.12)',
                              color: j.status === 'complete' ? 'var(--emerald)' : j.status === 'failed' ? 'var(--rose)' : 'var(--indigo-l)',
                            }}>
                              {STATUS_LABEL[j.status] ?? j.status}
                            </span>
                          </div>
                          <span style={{ fontSize: 10, color: 'var(--muted)' }}>{j.input.brandUrl}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Live processing view */}
              <div>
                {activeJob ? (
                  <>
                    <div className="section-label">Live Processing</div>
                    <div className="intel-panel">
                      <div className="intel-panel-header">
                        <span style={{ fontSize: 13 }}>🔬</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                            {activeJob.input.competitorName}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--muted)' }}>{activeJob.input.brandUrl}</div>
                        </div>
                        <span className="badge" style={{
                          background: activeJob.status === 'complete' ? 'rgba(16,185,129,0.12)' : activeJob.status === 'failed' ? 'rgba(239,68,68,0.12)' : 'rgba(99,102,241,0.12)',
                          color: activeJob.status === 'complete' ? 'var(--emerald)' : activeJob.status === 'failed' ? 'var(--rose)' : 'var(--indigo-l)',
                        }}>
                          {STATUS_LABEL[activeJob.status] ?? activeJob.status}
                        </span>
                      </div>
                      <div style={{ padding: 14 }}>
                        <div style={{ marginBottom: 14 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                            <span style={{ fontSize: 11, color: 'var(--muted)' }}>Progress</span>
                            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)' }}>{activeJob.progress}%</span>
                          </div>
                          <ProgressBar value={activeJob.progress} color={
                            activeJob.status === 'complete' ? 'var(--emerald)' :
                            activeJob.status === 'failed'   ? 'var(--rose)' :
                            'var(--indigo)'
                          } />
                        </div>
                        <div className="intel-stats-grid intel-stats-grid-4" style={{ marginBottom: 14 }}>
                          {[
                            { label: 'Sources Found',   value: activeJob.sourcesFound },
                            { label: 'Ads Discovered',  value: activeJob.adsDiscovered },
                            { label: 'Clusters',        value: result?.clusters?.length ?? '—' },
                            { label: 'Insights',        value: result?.insights?.whatIsWorking?.length ?? '—' },
                          ].map(k => (
                            <div key={k.label} className="intel-stat-card">
                              <div className="intel-stat-label">{k.label}</div>
                              <div className="intel-stat-value" style={{ fontSize: 18 }}>{k.value}</div>
                            </div>
                          ))}
                        </div>
                        {/* Event log */}
                        <div className="section-label" style={{ marginBottom: 8 }}>Event Stream</div>
                        <div className="scroll-pane" style={{ background: 'var(--surface-2)', borderRadius: 6, padding: 10, maxHeight: 200, overflowY: 'auto', border: '1px solid var(--border)' }}>
                          {(activeJob.events.length > 0 ? [...activeJob.events].reverse() : ['Waiting for events...']).map((e, i) => (
                            <div key={i} style={{ fontSize: 10, color: i === 0 ? 'var(--emerald)' : 'var(--muted)', marginBottom: 3, fontFamily: 'var(--mono)' }}>
                              {e}
                            </div>
                          ))}
                        </div>
                        {activeJob.status === 'complete' && (
                          <button onClick={() => setTab('results')}
                            style={{ marginTop: 12, width: '100%', padding: '9px 0', borderRadius: 8, background: 'var(--emerald)', border: 'none', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                            View Results →
                          </button>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 300, color: 'var(--muted)', gap: 8 }}>
                    <span style={{ fontSize: 36 }}>🕵️</span>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>No active analysis</span>
                    <span style={{ fontSize: 11 }}>Enter a competitor and start analysis</span>
                  </div>
                )}
              </div>
            </div>

            {/* ─── Quick Competitor Scanner ─────────────────────────────────── */}
            <div style={{ marginTop: 28 }}>
              <div className="section-label" style={{ marginBottom: 12 }}>⚡ Quick Competitor Scan</div>
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
                <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 12px', lineHeight: 1.6 }}>
                  Paste a competitor URL to instantly extract their positioning, key messages, strengths and weaknesses — saved to your profile.
                </p>
                <div style={{ display: 'flex', gap: 10 }}>
                  <input
                    value={savedScanUrl}
                    onChange={e => { setSavedScanUrl(e.target.value); setSavedScanError(null); }}
                    onKeyDown={e => { if (e.key === 'Enter') handleQuickScan(); }}
                    placeholder="https://competitor.com"
                    disabled={savedScanning}
                    style={{
                      flex: 1, background: 'var(--surface-2)', border: '1px solid var(--border)',
                      borderRadius: 8, padding: '9px 14px', color: 'var(--text)', fontSize: 13,
                      outline: 'none', fontFamily: 'inherit',
                    }}
                  />
                  <button
                    onClick={handleQuickScan}
                    disabled={savedScanning || !savedScanUrl.trim()}
                    style={{
                      background: savedScanning ? 'var(--surface-2)' : 'var(--indigo)',
                      border: 'none', borderRadius: 8, padding: '9px 20px',
                      color: savedScanning ? 'var(--muted)' : '#fff', fontSize: 13, fontWeight: 700,
                      cursor: savedScanning || !savedScanUrl.trim() ? 'not-allowed' : 'pointer',
                      whiteSpace: 'nowrap', fontFamily: 'inherit', transition: 'background 0.15s',
                      opacity: savedScanning || !savedScanUrl.trim() ? 0.7 : 1,
                    }}
                  >
                    {savedScanning ? '⏳ Scanning…' : 'Scan Competitor'}
                  </button>
                </div>
                {savedScanError && (
                  <div style={{ marginTop: 10, fontSize: 12, color: 'var(--rose)', background: 'rgba(239,68,68,0.08)', borderRadius: 6, padding: '8px 12px', border: '1px solid rgba(239,68,68,0.2)' }}>
                    ⚠️ {savedScanError}
                  </div>
                )}
              </div>

              {/* Saved competitor cards */}
              {savedComps.length === 0 && !savedScanning ? (
                <div style={{ textAlign: 'center', padding: '24px 0', border: '1px dashed var(--border)', borderRadius: 10, color: 'var(--muted)', fontSize: 12 }}>
                  No competitors scanned yet — paste a URL above to start
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {savedComps.map(c => (
                    <div key={c.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                      <div
                        onClick={() => setExpandedSaved(expandedSaved === c.id ? null : c.id)}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', cursor: 'pointer' }}
                      >
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{c.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--muted)' }}>{c.url}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                          <button
                            onClick={e => { e.stopPropagation(); handleDeleteSaved(c.id); }}
                            style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 11, padding: '4px 8px', fontFamily: 'inherit' }}
                          >
                            Remove
                          </button>
                          <span style={{ color: 'var(--muted)', fontSize: 11 }}>{expandedSaved === c.id ? '▲' : '▼'}</span>
                        </div>
                      </div>

                      {expandedSaved === c.id && (
                        <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 14 }}>
                          <div style={{ paddingTop: 14 }}>
                            <div className="section-label" style={{ marginBottom: 4 }}>Description</div>
                            <div style={{ fontSize: 12, color: 'var(--sub)', lineHeight: 1.6 }}>{c.description}</div>
                          </div>
                          <div>
                            <div className="section-label" style={{ marginBottom: 4 }}>Positioning</div>
                            <div style={{ fontSize: 12, color: 'var(--sub)', lineHeight: 1.6 }}>{c.positioning}</div>
                          </div>
                          <div>
                            <div className="section-label" style={{ marginBottom: 4 }}>Target Audience</div>
                            <div style={{ fontSize: 12, color: 'var(--sub)' }}>{c.targetAudience}</div>
                          </div>
                          {c.keyMessages.length > 0 && (
                            <div>
                              <div className="section-label" style={{ marginBottom: 6 }}>Key Messages</div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {c.keyMessages.map((m, i) => (
                                  <span key={i} className="badge" style={{ background: 'rgba(99,102,241,0.1)', color: 'var(--indigo-l)', border: '1px solid rgba(99,102,241,0.2)' }}>{m}</span>
                                ))}
                              </div>
                            </div>
                          )}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                            <div>
                              <div className="section-label" style={{ marginBottom: 6 }}>Strengths</div>
                              {c.strengths.map((s, i) => (
                                <div key={i} style={{ fontSize: 12, color: 'var(--emerald)', display: 'flex', gap: 6, marginBottom: 3 }}>
                                  <span>✓</span>{s}
                                </div>
                              ))}
                            </div>
                            <div>
                              <div className="section-label" style={{ marginBottom: 6 }}>Weaknesses / Gaps</div>
                              {c.weaknesses.map((w, i) => (
                                <div key={i} style={{ fontSize: 12, color: 'var(--rose)', display: 'flex', gap: 6, marginBottom: 3 }}>
                                  <span>✗</span>{w}
                                </div>
                              ))}
                            </div>
                          </div>
                          <div>
                            <div className="section-label" style={{ marginBottom: 4 }}>Tone & Style</div>
                            <div style={{ fontSize: 12, color: 'var(--sub)', lineHeight: 1.6 }}>{c.tone}</div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ─── TAB: RESULTS ──────────────────────────────────────────────── */}
          {tab === 'results' && (
            <>
              {result ? (
                <>
                  {/* Insights summary */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 20 }}>
                    {/* What's working */}
                    <div className="intel-panel">
                      <div className="intel-panel-header">
                        <span style={{ fontSize: 14 }}>🔥</span>
                        <span className="section-label" style={{ margin: 0 }}>What&apos;s Working</span>
                      </div>
                      <div style={{ padding: '8px 14px' }}>
                        {result.insights.whatIsWorking.slice(0, 4).map((w, i) => (
                          <div key={i} style={{ padding: '5px 0', borderBottom: '1px solid var(--border)', fontSize: 11, color: 'var(--sub)', lineHeight: 1.5 }}>
                            <span style={{ color: 'var(--emerald)', marginRight: 6 }}>▸</span>{w}
                          </div>
                        ))}
                      </div>
                    </div>
                    {/* What's overused */}
                    <div className="intel-panel">
                      <div className="intel-panel-header">
                        <span style={{ fontSize: 14 }}>⚠</span>
                        <span className="section-label" style={{ margin: 0 }}>Saturation Warnings</span>
                      </div>
                      <div style={{ padding: '8px 14px' }}>
                        {result.insights.whatIsOverused.slice(0, 4).map((w, i) => (
                          <div key={i} style={{ padding: '5px 0', borderBottom: '1px solid var(--border)', fontSize: 11, color: 'var(--sub)', lineHeight: 1.5 }}>
                            <span style={{ color: 'var(--rose)', marginRight: 6 }}>▸</span>{w}
                          </div>
                        ))}
                        {result.insights.whatIsOverused.length === 0 && (
                          <div style={{ fontSize: 11, color: 'var(--muted)', padding: '8px 0' }}>No saturated patterns detected</div>
                        )}
                      </div>
                    </div>
                    {/* Market gaps */}
                    <div className="intel-panel">
                      <div className="intel-panel-header">
                        <span style={{ fontSize: 14 }}>📉</span>
                        <span className="section-label" style={{ margin: 0 }}>Market Gaps</span>
                      </div>
                      <div style={{ padding: '8px 14px' }}>
                        {result.insights.whatIsMissing.slice(0, 4).map((w, i) => (
                          <div key={i} style={{ padding: '5px 0', borderBottom: '1px solid var(--border)', fontSize: 11, color: 'var(--sub)', lineHeight: 1.5 }}>
                            <span style={{ color: 'var(--amber)', marginRight: 6 }}>▸</span>{w}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Strategy summary */}
                  <div style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 8, padding: '10px 16px', marginBottom: 20 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--indigo-l)' }}>🧠 Competitor Strategy Summary</span>
                    <p style={{ fontSize: 12, color: 'var(--sub)', margin: '4px 0 0', lineHeight: 1.6 }}>
                      {result.insights.competitorStrategySummary}
                    </p>
                  </div>

                  {/* Cluster grid */}
                  <div className="section-label" style={{ marginBottom: 10 }}>Pattern Clusters</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 24 }}>
                    {result.clusters.map(c => (
                      <ClusterCard key={c.id} cluster={c} ads={result.ads}
                        onExport={handleExportCluster} />
                    ))}
                  </div>

                  {/* Ad grid with selection */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div className="section-label" style={{ margin: 0 }}>
                      Winning Ads ({result.ads.length})
                    </div>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      {selectedAds.size > 0 && (
                        <button onClick={handleExportSelected} disabled={exporting}
                          style={{ padding: '6px 16px', borderRadius: 6, background: 'var(--indigo)', border: 'none', color: '#fff', fontSize: 12, fontWeight: 700, cursor: exporting ? 'not-allowed' : 'pointer', opacity: exporting ? 0.7 : 1, fontFamily: 'inherit' }}>
                          {exporting ? '⟳ Exporting...' : `✦ Use ${selectedAds.size} selected in Builder`}
                        </button>
                      )}
                      <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                        {selectedAds.size > 0 ? `${selectedAds.size} selected` : 'Click ads to select'}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                    {result.ads
                      .sort((a, b) => b.performanceSignal - a.performanceSignal)
                      .map(ad => (
                        <AdCard key={ad.id} ad={ad}
                          selected={selectedAds.has(ad.id)}
                          onToggle={() => setSelectedAds(prev => {
                            const next = new Set(prev);
                            next.has(ad.id) ? next.delete(ad.id) : next.add(ad.id);
                            return next;
                          })}
                        />
                      ))}
                  </div>

                  {/* Data sources */}
                  <div style={{ marginTop: 20, padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }}>
                    <div className="section-label" style={{ marginBottom: 8 }}>Data Sources (Public Only)</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {result.sources.map(src => (
                        <a key={src} href={src} target="_blank" rel="noopener noreferrer"
                          style={{ fontSize: 10, color: 'var(--indigo-l)', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 4, padding: '2px 8px', textDecoration: 'none' }}>
                          {src}
                        </a>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 300, color: 'var(--muted)', gap: 8 }}>
                  <span style={{ fontSize: 36 }}>📊</span>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>No results yet</span>
                  <span style={{ fontSize: 11 }}>Start an analysis to see competitor intelligence</span>
                  <button onClick={() => setTab('analyze')} style={{ marginTop: 8, padding: '7px 18px', borderRadius: 6, background: 'var(--indigo)', border: 'none', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                    Start Analysis →
                  </button>
                </div>
              )}
            </>
          )}

          {/* ─── TAB: EXPORTS ──────────────────────────────────────────────── */}
          {tab === 'exports' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Builder Exports</h2>
                  <p style={{ fontSize: 11, color: 'var(--muted)', margin: '3px 0 0' }}>
                    Intel exported to your builder — all tagged source: competitor_intelligence
                  </p>
                </div>
              </div>
              {exports.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)' }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>✦</div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>No exports yet</div>
                  <div style={{ fontSize: 11 }}>Use &quot;Use in Builder&quot; buttons from analysis results</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {exports.map((exp, i) => (
                    <div key={i} className="intel-panel">
                      <div className="intel-panel-header">
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--indigo-l)' }}>✦ competitor_intelligence</span>
                        <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--muted)' }}>
                          {new Date(exp.exportedAt).toLocaleString()}
                        </span>
                      </div>
                      <div style={{ padding: 14, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                        <div>
                          <div className="section-label" style={{ marginBottom: 8 }}>🪝 Hooks</div>
                          {exp.hooks.slice(0, 5).map((h, j) => (
                            <div key={j} style={{ fontSize: 11, color: 'var(--sub)', padding: '3px 0', borderBottom: '1px solid var(--border)', lineHeight: 1.4 }}>
                              &quot;{h.slice(0, 80)}&quot;
                            </div>
                          ))}
                        </div>
                        <div>
                          <div className="section-label" style={{ marginBottom: 8 }}>🎯 CTAs &amp; Angles</div>
                          {exp.ctas.slice(0, 5).map((c, j) => (
                            <div key={j} className="badge" style={{ background: 'rgba(99,102,241,0.1)', color: 'var(--indigo-l)', marginBottom: 4, display: 'inline-block', marginRight: 4 }}>{c}</div>
                          ))}
                          <div style={{ marginTop: 8 }}>
                            {exp.emotionalAngles.map(e => (
                              <span key={e} className="badge" style={{ background: `${EMOTION_COLOR[e] ?? '#6b7280'}18`, color: EMOTION_COLOR[e] ?? 'var(--muted)', marginRight: 4, marginBottom: 4 }}>{e}</span>
                            ))}
                          </div>
                        </div>
                        <div>
                          <div className="section-label" style={{ marginBottom: 8 }}>📋 Strategy</div>
                          <p style={{ fontSize: 11, color: 'var(--sub)', lineHeight: 1.5 }}>{exp.strategySummary.slice(0, 200)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ─── TAB: MONITORING ───────────────────────────────────────────── */}
          {tab === 'monitoring' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                {/* Control panel */}
                <div className="intel-panel">
                  <div className="intel-panel-header">
                    <span style={{ fontSize: 14 }}>📡</span>
                    <span className="section-label" style={{ margin: 0 }}>Monitoring Engine</span>
                    <span className="badge" style={{ marginLeft: 'auto', background: monitoring?.enabled ? 'rgba(16,185,129,0.12)' : 'rgba(107,114,128,0.12)', color: monitoring?.enabled ? 'var(--emerald)' : 'var(--muted)' }}>
                      {monitoring?.enabled ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                  </div>
                  <div style={{ padding: 16 }}>
                    <p style={{ fontSize: 12, color: 'var(--sub)', marginBottom: 16, lineHeight: 1.6 }}>
                      When enabled, the system will periodically re-scan tracked competitors and notify you of new patterns.
                      <strong style={{ color: 'var(--rose)' }}> No data is automatically injected into your builders.</strong>
                    </p>
                    <div className="intel-stats-grid intel-stats-grid-4" style={{ marginBottom: 16 }}>
                      {[
                        { label: 'Status',       value: monitoring?.enabled ? '● Active' : '○ Inactive' },
                        { label: 'Interval',     value: monitoring?.intervalMs ? `${(monitoring.intervalMs / 60000).toFixed(0)}m` : '—' },
                        { label: 'Tracked Jobs', value: monitoring?.jobIds?.length ?? 0 },
                        { label: 'Checks Run',   value: monitoring?.checksRun ?? 0 },
                      ].map(k => (
                        <div key={k.label} className="intel-stat-card">
                          <div className="intel-stat-label">{k.label}</div>
                          <div className="intel-stat-value" style={{ fontSize: 14, color: k.label === 'Status' ? (monitoring?.enabled ? 'var(--emerald)' : 'var(--muted)') : 'var(--text)' }}>{k.value}</div>
                        </div>
                      ))}
                    </div>
                    {monitoring?.lastCheckAt && (
                      <p style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 16 }}>
                        Last check: {new Date(monitoring.lastCheckAt).toLocaleString()}
                      </p>
                    )}
                    <button onClick={handleToggleMonitoring}
                      style={{ width: '100%', padding: '10px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
                        background: monitoring?.enabled ? 'rgba(239,68,68,0.1)' : 'var(--emerald)',
                        color: monitoring?.enabled ? 'var(--rose)' : '#fff',
                      }}>
                      {monitoring?.enabled ? '⏹ Disable Monitoring' : '▶ Enable Monitoring'}
                    </button>
                  </div>
                </div>

                {/* Safety info */}
                <div className="intel-panel">
                  <div className="intel-panel-header">
                    <span style={{ fontSize: 14 }}>🔒</span>
                    <span className="section-label" style={{ margin: 0 }}>Safety Guarantees</span>
                  </div>
                  <div style={{ padding: 16 }}>
                    {[
                      { icon: '✓', text: 'Only scrapes publicly accessible pages', color: 'var(--emerald)' },
                      { icon: '✓', text: 'Never bypasses login, auth, or paywalls',  color: 'var(--emerald)' },
                      { icon: '✓', text: 'Never auto-injects data into creative tools', color: 'var(--emerald)' },
                      { icon: '✓', text: 'Every data source is tracked + displayed', color: 'var(--emerald)' },
                      { icon: '✓', text: 'Usage always requires your explicit action', color: 'var(--emerald)' },
                      { icon: '✓', text: 'Monitoring can be stopped instantly', color: 'var(--emerald)' },
                      { icon: '✓', text: 'No private data extraction of any kind', color: 'var(--emerald)' },
                    ].map((item, i) => (
                      <div key={i} style={{ padding: '6px 0', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                        <span style={{ color: item.color, fontWeight: 700, flexShrink: 0 }}>{item.icon}</span>
                        <span style={{ fontSize: 12, color: 'var(--sub)' }}>{item.text}</span>
                      </div>
                    ))}
                    <div style={{ marginTop: 14, padding: '8px 12px', background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 6 }}>
                      <span style={{ fontSize: 11, color: 'var(--indigo-l)', fontWeight: 600 }}>
                        Behaves like a passive intelligence collector unless explicitly activated by you.
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
