'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Sidebar }             from '@/components/Sidebar';
import { EditableBlock }       from '@/components/EditableBlock';
import { ImprovePanel }        from '@/components/ImprovePanel';
import { FeedbackTags }        from '@/components/FeedbackTags';
import { StyleProfilePanel }   from '@/components/StyleProfilePanel';
import { BranchTabs }          from '@/components/BranchTabs';
import {
  loadRunResult,
  runCampaign,
  saveRunResult,
  loadGenerationId,
  saveGenerationId,
  refineBlock as apiRefineBlock,
  type RunResult,
} from '@/lib/api/run-client';
import {
  getCampaign,
  createGeneration,
  getGeneration,
  updateGenerationBlock,
  improveGenerationBlock,
  sendFeedback,
  listGenerationVersions,
  restoreGenerationVersion,
  fetchStyleProfile,
  getCampaignScoreBoard,
  runCampaignImprovement,
  getLearningStatus,
  getGlobalStats,
  submitRealMetrics,
  getImprovementHistory,
  getOutcomeWeights,
  saveManualSnapshot,
  boostHook,
  runLearningCycle,
  hookBoosterGenerate,
  hookBoosterBoost,
  sceneRewrite,
  autoWinnerEvaluate,
  type BoostHookResult,
  type CampaignWithConcept,
  type GenerationResult,
  type GenerationVersion,
  type CreativeScoreResult,
  type ImprovementResult,
  type LearningStatus,
  type GlobalStats,
  type HookBoosterOutput,
  type HookBoosterV2Output,
  type SceneRewriteResult,
  type AutoWinnerResult,
} from '@/lib/api/creator-client';
import { generateCreativeCopy, type StructuredCopy } from '@/lib/creative-copy';
import {
  initEditorState,
  saveVersion,
  revertToVersion,
  updateBlock,
  branchFromBlock,
  switchBranch,
  deleteBranch,
  getActiveBranchAnchor,
  canAddBranch,
  blockTypeLabel,
  versionLabel,
  type EditorState,
} from '@/lib/creative-editor';
import {
  loadProfile, ingestSignal, ingestStabilitySignals, buildAdaptations, buildStyleContext, signalFromEdit,
  type SignalType,
} from '@/lib/style-profile';

// ── Perf / insight helpers ────────────────────────────────────────────────────

function perfLabel(score: number | null): 'High' | 'Medium' | 'Low' {
  if (score === null) return 'Medium';
  if (score >= 0.65)  return 'High';
  if (score >= 0.40)  return 'Medium';
  return 'Low';
}

function formatIcon(fmt: string) {
  if (fmt === 'video')    return '🎬';
  if (fmt === 'carousel') return '🖼';
  return '⬛';
}

interface Insight { icon: string; title: string; sub: string; }

function outcomeInsights(weights: Record<string, number>): string[] {
  const entries = Object.entries(weights).sort((a, b) => b[1] - a[1]);
  if (entries.length < 2) return [];
  const insights: string[] = [];
  const top = entries[0];
  const second = entries[1];
  const diff = Math.round((top[1] - second[1]) * 100);
  const fmt = (s: string) => s.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  if (diff > 0) insights.push(`${fmt(top[0])} is outperforming ${fmt(second[0])} by +${diff}%`);
  const declining = entries.filter((_, i) => i > entries.length / 2);
  if (declining.length > 0) insights.push(`${fmt(declining[0][0])} is declining in performance`);
  return insights.slice(0, 3);
}

function deriveInsights(result: RunResult): Insight[] {
  const winner = result.scoring.find(s => s.isWinner);
  const insights: Insight[] = [];

  if (result.concept.goal === 'conversion') {
    insights.push({ icon: '🎯', title: 'Optimized for conversions', sub: 'Creative structure and messaging are tuned to drive action.' });
  } else if (result.concept.goal === 'awareness') {
    insights.push({ icon: '📡', title: 'Built for reach', sub: 'Format and tone maximized for broad audience recognition.' });
  } else {
    insights.push({ icon: '💬', title: 'Designed to spark engagement', sub: 'Content flow encourages interaction and sharing.' });
  }

  if (winner) {
    insights.push(winner.engagement >= 0.55
      ? { icon: '⚡', title: 'Strong emotional hook', sub: 'The opening grabs attention and creates an emotional connection.' }
      : { icon: '💡', title: 'Clear value proposition', sub: 'The core benefit is communicated directly and memorably.' }
    );
    insights.push(winner.ctrScore >= 0.55
      ? { icon: '✅', title: 'High click potential', sub: 'Visual and copy alignment is strong — ideal for performance campaigns.' }
      : { icon: '🔄', title: 'Matches audience behavior', sub: 'Format and pacing are calibrated to how your audience consumes content.' }
    );
  } else {
    insights.push(
      { icon: '💡', title: 'Clear value proposition', sub: 'Core benefit communicated directly.' },
      { icon: '🔄', title: 'Matches audience behavior', sub: 'Format calibrated to audience patterns.' },
    );
  }

  insights.push({
    icon:  result.evolutionTriggered ? '🚀' : '📈',
    title: result.evolutionTriggered ? 'System improved from this run' : 'Performance tracked for improvement',
    sub:   'Every generation makes the system smarter for your next campaign.',
  });

  return insights.slice(0, 4);
}

// ── Version bar ───────────────────────────────────────────────────────────────

function VersionBar({ state, onRevert }: { state: EditorState; onRevert: (n: number) => void }) {
  if (state.versions.length <= 1) return null;
  return (
    <div className="version-bar">
      <span className="version-bar-label">History</span>
      {state.versions.map(v => (
        <button
          key={v.num}
          className={`version-dot${state.currentVersion === v.num ? ' active' : ''}`}
          onClick={() => onRevert(v.num)}
          title={v.label}
        >
          v{v.num}
          <span className="version-dot-tooltip">{v.label}</span>
        </button>
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ResultPage() {
  const { executionId } = useParams<{ executionId: string }>();
  const router = useRouter();

  const [result,      setResult]      = useState<RunResult | null>(null);
  const [trackUrl,    setTrackUrl]    = useState('');
  const [trackCopied, setTrackCopied] = useState(false);
  const [copy,        setCopy]        = useState<StructuredCopy | null>(null);
  const [editor,      setEditor]      = useState<EditorState | null>(null);
  const [notFound,    setNotFound]    = useState(false);
  const [rerunning,   setRerunning]   = useState(false);
  const [adaptations, setAdaptations] = useState<string[]>([]);
  const [showProfile, setShowProfile] = useState(false);
  const [campaign,    setCampaign]    = useState<CampaignWithConcept | null>(null);
  const [override,    setOverride]    = useState({ goal: '', angle: '', persona: '', tone: '' });
  const [generation,        setGeneration]        = useState<GenerationResult | null>(null);
  const [genLoading,        setGenLoading]        = useState(false);
  const [backendVersions,   setBackendVersions]   = useState<GenerationVersion[]>([]);
  const [detailedScores,    setDetailedScores]    = useState<CreativeScoreResult[]>([]);
  const [improving,         setImproving]         = useState(false);
  const [improvementResult, setImprovementResult] = useState<ImprovementResult[] | null>(null);
  const [showImprovement,   setShowImprovement]   = useState(false);
  const [learningStatus,      setLearningStatus]      = useState<LearningStatus | null>(null);
  const [globalStats,         setGlobalStats]         = useState<GlobalStats | null>(null);
  const [improvementHistory,  setImprovementHistory]  = useState<ImprovementResult[]>([]);
  const [outcomeWeights,      setOutcomeWeights]      = useState<Record<string, number>>({});
  const [showImpHistory,      setShowImpHistory]      = useState(false);
  const [showMetrics,         setShowMetrics]         = useState(false);

  // Pro Mode
  const [proMode,             setProMode]             = useState(false);
  const [savingSnapshot,      setSavingSnapshot]      = useState(false);
  const [snapshotSaved,       setSnapshotSaved]       = useState(false);
  const [boostResult,         setBoostResult]         = useState<BoostHookResult | null>(null);
  const [boosting,            setBoosting]            = useState(false);
  const [learningRunning,     setLearningRunning]     = useState(false);
  const [learningDone,        setLearningDone]        = useState(false);
  const [showScoreBreakdown,  setShowScoreBreakdown]  = useState(false);
  const [depthTab,             setDepthTab]             = useState<'score' | 'insights' | 'history' | null>(null);
  const [metricsCtr,        setMetricsCtr]        = useState('');
  const [metricsConv,       setMetricsConv]       = useState('');
  const [metricsRetention,  setMetricsRetention]  = useState('');
  const [metricsSubmitted,  setMetricsSubmitted]  = useState(false);

  // ── Phase 1 — Ghost system state ─────────────────────────────────────────
  const [hookBoosterV1,      setHookBoosterV1]      = useState<HookBoosterOutput | null>(null);
  const [hookBoosterV2,      setHookBoosterV2]      = useState<HookBoosterV2Output | null>(null);
  const [generatingHooks,    setGeneratingHooks]    = useState(false);
  const [boostingHooks,      setBoostingHooks]      = useState(false);
  const [sceneRewriteResult, setSceneRewriteResult] = useState<SceneRewriteResult | null>(null);
  const [rewritingScene,     setRewritingScene]     = useState(false);
  const [autoWinnerResult,   setAutoWinnerResult]   = useState<AutoWinnerResult | null>(null);
  const [runningAutoWinner,  setRunningAutoWinner]  = useState(false);

  // ImprovePanel state
  const [panelBlock,   setPanelBlock]   = useState<string | null>(null);
  const [panelAnchor,  setPanelAnchor]  = useState<HTMLElement | null>(null);
  const [improvingId,  setImprovingId]  = useState<string | null>(null);

  // Track previous block values for manual-edit signal detection
  const prevBlockValues = useRef<Record<string, string>>({});
  // Track which blocks were actually changed this session (for stability signals)
  const editedBlockIds  = useRef<Set<string>>(new Set());

  useEffect(() => {
    const r = loadRunResult(executionId);
    if (r) {
      setResult(r);
      const c = generateCreativeCopy(r);
      setCopy(c);
      const es = initEditorState(c);
      setEditor(es);
      prevBlockValues.current = { ...es.blocks };
      // Fetch backend style profile for adaptations (best-effort, falls back to local)
      fetchStyleProfile()
        .then(bp => { if (bp.adaptations?.length) setAdaptations(bp.adaptations); else setAdaptations(buildAdaptations(loadProfile())); })
        .catch(() => setAdaptations(buildAdaptations(loadProfile())));

      if (r.campaignId) {
        getCampaign(r.campaignId).then(setCampaign).catch(() => {});
        // Map backend scores.{ctr,…} shape → flat CreativeScoreResult shape expected by UI
        getCampaignScoreBoard(r.campaignId).then(data => setDetailedScores(
          data.map(e => ({
            creativeId:  e.creativeId,
            format:      e.format,
            isWinner:    e.isWinner,
            ctrScore:    e.scores.ctr,
            engagement:  e.scores.engagement,
            conversion:  e.scores.conversion,
            clarity:     e.scores.clarity,
            totalScore:  e.scores.total,
            dimensions:  e.scores as unknown as Record<string, number>,
          }))
        )).catch(() => {});
      }
      // Learning + global intelligence — non-blocking, best-effort
      getLearningStatus().then(setLearningStatus).catch(() => {});
      getGlobalStats().then(setGlobalStats).catch(() => {});
      getOutcomeWeights().then(setOutcomeWeights).catch(() => {});
      if (r.campaignId) {
        // Backend returns { records: ImprovementRecord[] } — extract array
        getImprovementHistory(r.campaignId).then(res => setImprovementHistory(
          (res.records ?? []).map(r2 => ({
            originalCreativeId: r2.originalCreativeId,
            improvedCreativeId: r2.improvedCreativeId ?? '',
            improvementTypes:   r2.types ?? [],
            scoreBefore:        r2.scoreBefore,
            scoreAfter:         r2.scoreAfter ?? r2.scoreBefore,
            delta:              r2.delta ?? 0,
            changesApplied:     null,
          }))
        )).catch(() => {});
      }

      function loadVersionsForGen(genId: string) {
        listGenerationVersions(genId).then(setBackendVersions).catch(() => {});
      }

      // Load existing generation or create one from the run result
      const storedGenId = loadGenerationId(executionId);
      if (storedGenId) {
        getGeneration(storedGenId)
          .then(gen => { setGeneration(gen); applyGenerationToEditor(gen); loadVersionsForGen(gen.id); })
          .catch(() => {});
      } else if (r.campaignId) {
        setGenLoading(true);
        createGeneration({ campaign_id: r.campaignId, brief: r.concept.brief })
          .then(gen => {
            setGeneration(gen);
            saveGenerationId(executionId, gen.id);
            applyGenerationToEditor(gen);
            loadVersionsForGen(gen.id);
          })
          .catch(() => {})
          .finally(() => setGenLoading(false));
      }
    } else {
      setNotFound(true);
    }
  }, [executionId]); // eslint-disable-line react-hooks/exhaustive-deps

  function applyGenerationToEditor(gen: GenerationResult) {
    setEditor(prev => {
      if (!prev) return prev;
      const updated: Record<string, string> = {
        ...prev.blocks,
        hook: gen.hook,
        copy: gen.body,
        cta:  gen.cta,
      };
      if (gen.variations[0]) {
        updated['varA-hook'] = gen.variations[0].content.hook;
        updated['varA-copy'] = gen.variations[0].content.body;
        updated['varA-cta']  = gen.variations[0].content.cta;
      }
      if (gen.variations[1]) {
        updated['varB-hook'] = gen.variations[1].content.hook;
        updated['varB-copy'] = gen.variations[1].content.body;
        updated['varB-cta']  = gen.variations[1].content.cta;
      }
      const seedVersion = { ...prev.versions[0], blocks: { ...updated } };
      return {
        ...prev,
        blocks:   updated,
        versions: [seedVersion],
        branches: prev.branches.map(br =>
          br.id === 'main' ? { ...br, blocks: { ...updated } } : br,
        ),
      };
    });
  }

  // ── Stability signal — fire for unedited blocks after 15 s idle ──────────────

  useEffect(() => {
    if (!editor) return;

    function fireStability() {
      const allIds    = Object.keys(editor!.blocks);
      const unedited  = allIds.filter(id => !editedBlockIds.current.has(id));
      if (unedited.length === 0) return;
      const updated = ingestStabilitySignals(unedited);
      setAdaptations(buildAdaptations(updated));
    }

    const timer = setTimeout(fireStability, 15_000);

    function onUnload() { fireStability(); }
    window.addEventListener('beforeunload', onUnload);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('beforeunload', onUnload);
    };
  // Re-run whenever the active branch changes (new set of blocks)
  }, [editor?.activeBranchId, !!editor]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Block editing ─────────────────────────────────────────────────────────

  const handleBlockChange = useCallback((blockId: string, value: string) => {
    const prev = prevBlockValues.current[blockId] ?? '';
    const signal = signalFromEdit(blockId, prev, value);
    if (signal) {
      ingestSignal(signal);
      setAdaptations(buildAdaptations(loadProfile()));
    }
    prevBlockValues.current[blockId] = value;
    editedBlockIds.current.add(blockId);
    setEditor(s => s ? updateBlock(s, blockId, value) : s);

    // Persist generation block edit to backend
    const genBlockMap: Record<string, 'hook' | 'body' | 'cta'> = {
      hook: 'hook', copy: 'body', cta: 'cta',
    };
    const genField = genBlockMap[blockId];
    if (generation && genField) {
      updateGenerationBlock(generation.id, { block: genField, value }).catch(() => {});
      sendFeedback({ generation_id: generation.id, signal_type: 'edit', block: genField, change_type: 'manual' }).catch(() => {});
    }
  }, [generation]);

  const handleImproveOpen = useCallback((blockId: string, anchorEl: HTMLElement) => {
    setPanelBlock(blockId);
    setPanelAnchor(anchorEl);
  }, []);

  const handleImproveClose = useCallback(() => {
    setPanelBlock(null);
    setPanelAnchor(null);
  }, []);

  const handleImproveApply = useCallback(async (blockId: string, instruction: string) => {
    if (!editor || !result) return;
    setImprovingId(blockId);

    const knownPresets: SignalType[] = [
      'shorter','more_emotional','add_urgency','more_premium',
      'simpler','stronger_cta','bolder','conversational',
    ];
    if (knownPresets.includes(instruction as SignalType)) {
      ingestSignal(instruction as SignalType);
      setAdaptations(buildAdaptations(loadProfile()));
    }

    try {
      let newValue: string;

      // Use generation endpoint for main blocks (hook / body / cta)
      const genBlockMap: Record<string, 'hook' | 'body' | 'cta'> = {
        hook: 'hook', copy: 'body', cta: 'cta',
      };
      const genField = genBlockMap[blockId];

      if (generation && genField) {
        const res = await improveGenerationBlock(generation.id, {
          block:       genField,
          instruction,
          context: {
            campaign_id:      result.campaignId,
            keyObjection:     campaign?.concept?.keyObjection     || undefined,
            valueProposition: campaign?.concept?.valueProposition || undefined,
          },
        });
        newValue = res.updated_block;
        setGeneration(prev => prev ? { ...prev, [genField]: newValue } : prev);
        sendFeedback({ generation_id: generation.id, signal_type: 'edit', block: genField, change_type: instruction }).catch(() => {});
      } else {
        // Fallback for variation / scene / slide blocks
        const winnerSlug = result.angles.find(a => a.slug === (result.winner?.angleSlug ?? result.scoring[0]?.angleSlug))?.slug;
        newValue = await apiRefineBlock({
          blockType:    blockTypeLabel(blockId).toLowerCase(),
          currentValue: editor.blocks[blockId] ?? '',
          instruction,
          brief:        result.concept.brief,
          angleSlug:    winnerSlug,
        });
      }

      editedBlockIds.current.add(blockId);
      setEditor(s => {
        if (!s) return s;
        const updated = updateBlock(s, blockId, newValue);
        return saveVersion(updated, versionLabel(blockId, instruction));
      });
      setPanelBlock(null);
      setPanelAnchor(null);
    } catch {
      // keep existing value on failure — silent
    } finally {
      setImprovingId(null);
    }
  }, [editor, result, generation]);

  const handleRevert = useCallback((versionNum: number) => {
    setEditor(s => s ? revertToVersion(s, versionNum) : s);
  }, []);

  const handleRestoreBackendVersion = useCallback(async (v: GenerationVersion) => {
    if (!generation) return;
    try {
      const restored = await restoreGenerationVersion(v.id);
      setGeneration(restored);
      applyGenerationToEditor(restored);
      listGenerationVersions(generation.id).then(setBackendVersions).catch(() => {});
    } catch { /* keep current state on failure */ }
  }, [generation]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleBranch = useCallback((blockId: string) => {
    setEditor(s => s && canAddBranch(s) ? branchFromBlock(s, blockId) : s);
  }, []);

  const handleSwitchBranch = useCallback((branchId: string) => {
    setEditor(s => s ? switchBranch(s, branchId) : s);
  }, []);

  const handleDeleteBranch = useCallback((branchId: string) => {
    setEditor(s => s ? deleteBranch(s, branchId) : s);
  }, []);

  // ── Improvement ───────────────────────────────────────────────────────────

  async function handleImprove() {
    if (!result?.campaignId || improving) return;
    setImproving(true);
    try {
      const res = await runCampaignImprovement(result.campaignId);
      // Map run result to ImprovementResult[] shape the UI expects
      const mapped = (res.results ?? [])
        .filter(r2 => r2.accepted && r2.improvedCreativeId)
        .map(r2 => ({
          originalCreativeId: r2.originalCreativeId,
          improvedCreativeId: r2.improvedCreativeId ?? '',
          improvementTypes:   r2.types ?? [],
          scoreBefore:        r2.scoreBefore,
          scoreAfter:         r2.scoreAfter ?? r2.scoreBefore,
          delta:              r2.delta ?? 0,
          changesApplied:     null,
        }));
      setImprovementResult(mapped);
      setShowImprovement(true);
      // Refresh history after run
      if (result.campaignId) {
        getImprovementHistory(result.campaignId).then(h => setImprovementHistory(
          (h.records ?? []).map(r2 => ({
            originalCreativeId: r2.originalCreativeId,
            improvedCreativeId: r2.improvedCreativeId ?? '',
            improvementTypes:   r2.types ?? [],
            scoreBefore:        r2.scoreBefore,
            scoreAfter:         r2.scoreAfter ?? r2.scoreBefore,
            delta:              r2.delta ?? 0,
            changesApplied:     null,
          }))
        )).catch(() => {});
      }
    } catch { /* silent — button returns to normal state */ }
    finally { setImproving(false); }
  }

  function applyImprovement(imp: ImprovementResult) {
    const changes = imp.changesApplied;
    if (changes && (changes.hook || changes.body || changes.cta)) {
      setEditor(prev => {
        if (!prev) return prev;
        let s = prev;
        if (changes.hook) s = updateBlock(s, 'hook', changes.hook);
        if (changes.body) s = updateBlock(s, 'copy', changes.body);
        if (changes.cta)  s = updateBlock(s, 'cta',  changes.cta);
        return saveVersion(s, 'AI Improvement');
      });
      if (generation) {
        if (changes.hook) updateGenerationBlock(generation.id, { block: 'hook', value: changes.hook }).catch(() => {});
        if (changes.body) updateGenerationBlock(generation.id, { block: 'body', value: changes.body }).catch(() => {});
        if (changes.cta)  updateGenerationBlock(generation.id, { block: 'cta',  value: changes.cta  }).catch(() => {});
        // Refresh version list after applying
        listGenerationVersions(generation.id).then(setBackendVersions).catch(() => {});
      }
    }
    setShowImprovement(false);
    setImprovementResult(null);
  }

  // ── Pro Mode handlers ─────────────────────────────────────────────────────

  async function handleSaveSnapshot() {
    if (!generation || savingSnapshot) return;
    setSavingSnapshot(true);
    try {
      const snap = await saveManualSnapshot(generation.id, {
        hook: editor?.blocks.hook ?? generation.hook,
        body: editor?.blocks.copy ?? generation.body,
        cta:  editor?.blocks.cta  ?? generation.cta,
      });
      setBackendVersions(v => [snap, ...v]);
      setSnapshotSaved(true);
      setTimeout(() => setSnapshotSaved(false), 2500);
    } catch { /* best-effort */ }
    finally { setSavingSnapshot(false); }
  }

  async function handleBoostHook() {
    if (!editor || boosting) return;
    setBoosting(true); setBoostResult(null);
    try {
      const res = await boostHook({
        hook:     editor.blocks.hook,
        angle:    campaign?.angle ?? (result?.concept as any)?.angle ?? undefined,
        platform: (result?.concept as any)?.platform ?? undefined,
      });
      setBoostResult(res);
    } catch { /* best-effort */ }
    finally { setBoosting(false); }
  }

  async function handleRunLearningCycle() {
    if (!result?.campaignId || learningRunning) return;
    setLearningRunning(true); setLearningDone(false);
    try {
      await runLearningCycle(result.campaignId);
      getLearningStatus().then(setLearningStatus).catch(() => {});
      setLearningDone(true);
      setTimeout(() => setLearningDone(false), 3000);
    } catch { /* best-effort */ }
    finally { setLearningRunning(false); }
  }

  // ── Real metrics ──────────────────────────────────────────────────────────

  async function handleSubmitMetrics() {
    const creativeId = result?.creatives[0]?.creativeId;
    if (!creativeId) return;
    const ctr  = parseFloat(metricsCtr)  / 100;
    const conv = parseFloat(metricsConv) / 100;
    const ret  = parseFloat(metricsRetention) / 100 || 0.5;
    if (isNaN(ctr) || isNaN(conv)) return;
    try {
      await submitRealMetrics({ creativeId, ctr, retention: ret, conversion: conv });
      setMetricsSubmitted(true);
      setTimeout(() => { setShowMetrics(false); setMetricsSubmitted(false); setMetricsCtr(''); setMetricsConv(''); setMetricsRetention(''); }, 3000);
    } catch { /* silent */ }
  }

  // ── Phase 1: Hook Booster, Scene Rewriter, Auto-Winner ───────────────────

  async function handleGenerateHooks() {
    if (!result || generatingHooks) return;
    setGeneratingHooks(true);
    try {
      const fmt      = (result.creatives[0]?.format ?? 'video') as 'video' | 'carousel' | 'banner';
      const angle    = campaign?.angle ?? 'emotional';
      const emotion  = 'curiosity';
      const goal     = result.concept.goal ?? 'conversion';
      const v1 = await hookBoosterGenerate({
        format:          fmt,
        primary_angle:   angle,
        emotion,
        goal,
        product_context: result.concept.brief ?? null,
      });
      setHookBoosterV1(v1);
    } catch { /* silent */ }
    finally { setGeneratingHooks(false); }
  }

  async function handleBoostHooksV2() {
    if (!hookBoosterV1 || boostingHooks) return;
    setBoostingHooks(true);
    try {
      const fmt   = (result?.creatives[0]?.format ?? 'video') as 'video' | 'carousel' | 'banner';
      const angle = campaign?.angle ?? 'emotional';
      const v2 = await hookBoosterBoost({
        format:                     fmt,
        primary_angle:              angle,
        emotion:                    'curiosity',
        goal:                       result?.concept.goal ?? 'conversion',
        hook_v1_outputs:            hookBoosterV1,
        memory_signal:              0.5,
        fatigue_signal:             0.2,
        exploration_pressure_delta: 0.05,
      });
      setHookBoosterV2(v2);
    } catch { /* silent */ }
    finally { setBoostingHooks(false); }
  }

  async function handleRewriteScene() {
    if (!result || rewritingScene) return;
    const hookText = editor?.blocks['hook'] ?? '';
    if (!hookText) return;
    setRewritingScene(true);
    try {
      const fmt   = (result.creatives[0]?.format ?? 'video') as 'video' | 'carousel' | 'banner';
      const angle = campaign?.angle ?? 'emotional';
      const winner = detailedScores.find(s => s.isWinner) ?? detailedScores[0];
      const rewrite = await sceneRewrite({
        format:                 fmt,
        creative_segment:       hookText,
        original_hook_or_scene: hookText,
        performance_signal: {
          ctr:       winner?.ctrScore  ?? 0.5,
          retention: winner?.engagement ?? 0.5,
          conversion: winner?.conversion ?? 0.5,
        },
        angle_context:    { primary: angle },
        emotion_context:  'curiosity',
      });
      setSceneRewriteResult(rewrite);
    } catch { /* silent */ }
    finally { setRewritingScene(false); }
  }

  async function handleAutoWinner() {
    if (!result || runningAutoWinner || !generation) return;
    setRunningAutoWinner(true);
    try {
      const fmt   = (result.creatives[0]?.format ?? 'video') as 'video' | 'carousel' | 'banner';
      const angle = campaign?.angle ?? 'emotional';
      const variants = [
        { id: 'main', content: { hook: generation.hook, body: generation.body, cta: generation.cta } },
        ...generation.variations.map(v => ({ id: v.id, content: v.content })),
      ].filter((_, i) => i < 5);
      if (variants.length < 2) return;
      const res = await autoWinnerEvaluate({ format: fmt, creative_variants: variants, angle_context: { primary: angle } });
      setAutoWinnerResult(res);
    } catch { /* silent */ }
    finally { setRunningAutoWinner(false); }
  }

  // ── Regenerate ────────────────────────────────────────────────────────────

  async function handleRerun(modifier?: 'alt') {
    if (!result || rerunning) return;
    setRerunning(true);
    try {
      const effectiveGoal = modifier === 'alt'
        ? (result.concept.goal === 'conversion' ? 'awareness' : 'conversion') as any
        : (override.goal || result.concept.goal) as any;
      const styleContext = buildStyleContext(loadProfile()) || undefined;
      const newResponse = await runCampaign({
        brief:      result.concept.brief,
        format:     result.creatives[0]?.format as any ?? 'video',
        goal:       effectiveGoal,
        campaignId: result.campaignId,
        styleContext,
      });
      if ((newResponse as any).status === 'queued') return; // async video — skip inline handling
      const newResult = newResponse as import('@/lib/api/run-client').RunResult;
      saveRunResult(newResult, result.concept.brief, newResult.creatives[0]?.format as any ?? 'video');
      // Fire generation with overrides (angle + persona) for the new result
      if (newResult.campaignId) {
        createGeneration({
          campaign_id:       newResult.campaignId,
          brief:             newResult.concept.brief,
          override_settings: {
            goal:    effectiveGoal,
            angle:   override.angle   || undefined,
            persona: override.persona || undefined,
            tone:    override.tone    || campaign?.tone || undefined,
            format:  result.creatives[0]?.format || undefined,
          },
        }).then(gen => saveGenerationId(newResult.executionId, gen.id)).catch(() => {});
      }
      router.push(`/result/${newResult.executionId}`);
    } catch {
      setRerunning(false);
    }
  }

  // ── Guards ────────────────────────────────────────────────────────────────

  if (notFound) {
    return (
      <div className="app-shell">
        <Sidebar />
        <main className="app-main">
          <div className="empty-page">
            <div className="empty-page-icon">🔍</div>
            <div className="empty-page-title">Result not found</div>
            <div className="empty-page-sub">This session may have expired.</div>
            <Link href="/campaigns/new" className="empty-page-cta">← New Campaign</Link>
          </div>
        </main>
      </div>
    );
  }

  if (!result || !copy || !editor) {
    return (
      <div className="app-shell">
        <Sidebar />
        <main className="app-main" style={{ alignItems: 'center', justifyContent: 'center' }}>
          <div className="loading-spinner" />
        </main>
      </div>
    );
  }

  const winner  = result.scoring.find(s => s.isWinner) ?? result.scoring[0] ?? null;
  const insights = deriveInsights(result);
  const format  = result.creatives[0]?.format ?? 'video';
  const perf    = perfLabel(winner?.totalScore ?? null);
  const perfCls = perf === 'High' ? 'perf-high' : perf === 'Medium' ? 'perf-medium' : 'perf-low';

  const b           = editor.blocks;
  const anchorBlock = getActiveBranchAnchor(editor);
  const canBranch   = canAddBranch(editor);

  function branchProps(blockId: string) {
    return {
      isAnchor: anchorBlock === blockId,
      onBranch: canBranch ? handleBranch : undefined,
    };
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-main" style={{ position: 'relative' }}>
        {rerunning && (
          <div className="loading-overlay">
            <div className="loading-inner">
              <div className="loading-spinner-wrap">
                <div className="loading-spinner" />
                <div className="loading-spinner-icon">✦</div>
              </div>
              <p style={{ fontSize: 14, color: 'var(--sub)' }}>Regenerating your campaign…</p>
            </div>
          </div>
        )}

        <div className="result-page">

          {/* ── FULL-WIDTH HEADER ──────────────────────────────────────────── */}
          <div className="result-page-header">
            <div className="result-page-header-row">
              <span className="result-tag">✦ Best performing version</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className={`perf-badge ${perfCls}`}>{perf} performance</span>
                <button
                  onClick={() => setProMode(v => !v)}
                  style={{ background: proMode ? 'rgba(99,102,241,0.12)' : 'transparent', border: `1px solid ${proMode ? '#6366f1' : '#1e2330'}`, borderRadius: 6, color: proMode ? '#a5b4fc' : '#444', fontSize: 11, fontWeight: 700, padding: '3px 10px', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}
                >
                  ⚡ Pro{proMode ? ': ON' : ''}
                </button>
              </div>
            </div>
            <h2 className="result-page-title">Your campaign is ready</h2>
            <p className="result-page-sub">
              {formatIcon(format)} {format.charAt(0).toUpperCase() + format.slice(1)} · {copy.angleLabel} strategy
              <span className="result-edit-hint-inline"> · Hover any block → ✦ to refine with AI</span>
            </p>
          </div>

          {/* Branch tabs + version bar */}
          <BranchTabs
            branches={editor.branches}
            activeBranchId={editor.activeBranchId}
            onSwitch={handleSwitchBranch}
            onDelete={handleDeleteBranch}
            canAdd={canBranch}
          />
          <VersionBar state={editor} onRevert={handleRevert} />

          {/* Backend version history — auto-snapshots from edits/improve calls */}
          {backendVersions.length > 1 && (
            <div className="version-bar">
              <span className="version-bar-label">Saved</span>
              {backendVersions.slice(0, 8).map((v, i) => (
                <button
                  key={v.id}
                  className="version-dot"
                  onClick={() => handleRestoreBackendVersion(v)}
                  title={`${v.createdFrom} · ${new Date(v.createdAt).toLocaleTimeString()}`}
                >
                  v{backendVersions.length - i}
                  <span className="version-dot-tooltip">{v.createdFrom} · {new Date(v.createdAt).toLocaleTimeString()}</span>
                </button>
              ))}
            </div>
          )}

          {/* Generation loading indicator */}
          {genLoading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 8, marginBottom: 12, fontSize: 12, color: '#6366f1' }}>
              <div style={{ width: 12, height: 12, border: '2px solid rgba(99,102,241,0.3)', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
              AI generating hook, copy &amp; variations…
            </div>
          )}

          {/* Personalization banner */}
          {adaptations.length > 0 && (
            <div className="personalization-banner">
              <div className="personalization-banner-left">
                <span className="personalization-banner-icon">◎</span>
                <div>
                  <div className="personalization-banner-title">Personalized for you</div>
                  <div className="personalization-banner-reasons">
                    {adaptations.map((r, i) => <span key={i} className="personalization-reason">{r}</span>)}
                  </div>
                </div>
              </div>
              <button className="personalization-profile-btn" onClick={() => setShowProfile(v => !v)}>
                {showProfile ? 'Hide profile' : 'Your style profile →'}
              </button>
            </div>
          )}
          {showProfile && <StyleProfilePanel onClose={() => setShowProfile(false)} />}

          {/* ── 3-ZONE GRID ───────────────────────────────────────────────── */}
          <div className="result-3col">

            {/* ── LEFT: Primary creative ──────────────────────────────────── */}
            <div className="result-col-left">
              <div className="result-primary-card">
                <div className="result-primary-top">
                  <span className="result-angle-badge">{copy.angleLabel}</span>
                  {/* 🏆 Top Performer badge — shown when this creative is the winner */}
                  {(winner?.isWinner || (detailedScores.length > 0 && detailedScores[0]?.isWinner)) && (
                    <span style={{
                      marginLeft:   'auto',
                      fontSize:     11,
                      fontWeight:   700,
                      color:        '#fbbf24',
                      background:   'rgba(251,191,36,0.1)',
                      border:       '1px solid rgba(251,191,36,0.25)',
                      borderRadius: 99,
                      padding:      '3px 10px',
                      letterSpacing: '0.03em',
                      display:      'flex',
                      alignItems:   'center',
                      gap:          4,
                    }}>
                      🏆 Top Performer
                    </span>
                  )}
                </div>
                <EditableBlock blockId="hook" value={b.hook} onChange={handleBlockChange} onImprove={handleImproveOpen} className="result-hook-text" improving={improvingId === 'hook'} {...branchProps('hook')} />

                {/* Boost Hook — Pro Mode only */}
                {proMode && (
                  <div style={{ marginBottom: 10 }}>
                    {!boostResult ? (
                      <button
                        onClick={handleBoostHook}
                        disabled={boosting}
                        style={{ fontSize: 11, fontWeight: 700, color: boosting ? '#555' : '#f59e0b', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 6, padding: '4px 12px', cursor: boosting ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 5, transition: 'all 0.15s' }}
                      >
                        {boosting ? <><MiniSpinner /> Boosting…</> : '⚡ Boost Hook'}
                      </button>
                    ) : (
                      <div style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, padding: '10px 14px' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>⚡ Boosted Hook</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#f0f0f0', marginBottom: 6, lineHeight: 1.4 }}>{boostResult.boostedHook}</div>
                        {boostResult.improvement && (
                          <div style={{ fontSize: 11, color: '#666', marginBottom: 10, fontStyle: 'italic' }}>{boostResult.improvement}</div>
                        )}
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            onClick={() => { handleBlockChange('hook', boostResult.boostedHook); setBoostResult(null); }}
                            style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: '#f59e0b', border: 'none', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontFamily: 'inherit' }}
                          >Accept</button>
                          <button
                            onClick={() => setBoostResult(null)}
                            style={{ fontSize: 11, color: '#555', background: 'none', border: '1px solid #1e2330', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontFamily: 'inherit' }}
                          >Discard</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <EditableBlock blockId="copy" value={b.copy} onChange={handleBlockChange} onImprove={handleImproveOpen} className="result-copy-text" improving={improvingId === 'copy'} multiline {...branchProps('copy')} />
                <div className="result-cta-row">
                  <EditableBlock blockId="cta" value={b.cta} onChange={handleBlockChange} onImprove={handleImproveOpen} className="result-cta-pill" improving={improvingId === 'cta'} {...branchProps('cta')} />
                </div>

                {/* ── Intel strip: score · insights · history depth tabs ───── */}
                {(() => {
                  const scoreEntry = detailedScores.find(s => s.isWinner) ?? detailedScores[0] ?? null;
                  const total      = scoreEntry?.totalScore ?? winner?.totalScore ?? null;
                  const scoreColor = total === null ? '#555' : total >= 0.65 ? '#22c55e' : total >= 0.40 ? '#f59e0b' : '#ef4444';
                  const hasScore   = total !== null;
                  const hasHistory = improvementHistory.length > 0;
                  return (
                    <div style={{ borderTop: '1px solid #1e2330', marginTop: 16 }}>
                      {/* Tab strip — always visible */}
                      <div style={{ display: 'flex', borderBottom: '1px solid #1e2330' }}>
                        {hasScore && (
                          <button
                            onClick={() => setDepthTab(d => d === 'score' ? null : 'score')}
                            style={{ flex: 1, padding: '9px 12px', background: depthTab === 'score' ? 'rgba(99,102,241,0.06)' : 'transparent', border: 'none', borderBottom: depthTab === 'score' ? '2px solid #6366f1' : '2px solid transparent', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, transition: 'all 0.13s', marginBottom: -1 }}
                          >
                            <span style={{ fontSize: 15, fontWeight: 800, color: scoreColor, lineHeight: 1 }}>{Math.round(total! * 100)}</span>
                            <span style={{ fontSize: 10, fontWeight: 700, color: depthTab === 'score' ? '#a5b4fc' : '#555', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Score</span>
                          </button>
                        )}
                        <button
                          onClick={() => setDepthTab(d => d === 'insights' ? null : 'insights')}
                          style={{ flex: 1, padding: '9px 12px', background: depthTab === 'insights' ? 'rgba(99,102,241,0.06)' : 'transparent', border: 'none', borderBottom: depthTab === 'insights' ? '2px solid #6366f1' : '2px solid transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, fontWeight: 700, color: depthTab === 'insights' ? '#a5b4fc' : '#555', transition: 'all 0.13s', marginBottom: -1 }}
                        >
                          ✦ Why it works
                        </button>
                        {hasHistory && (
                          <button
                            onClick={() => setDepthTab(d => d === 'history' ? null : 'history')}
                            style={{ flex: 1, padding: '9px 12px', background: depthTab === 'history' ? 'rgba(99,102,241,0.06)' : 'transparent', border: 'none', borderBottom: depthTab === 'history' ? '2px solid #6366f1' : '2px solid transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, fontWeight: 700, color: depthTab === 'history' ? '#a5b4fc' : '#555', transition: 'all 0.13s', marginBottom: -1 }}
                          >
                            ◎ {improvementHistory.length} learned
                          </button>
                        )}
                      </div>

                      {/* Score depth */}
                      {depthTab === 'score' && hasScore && (() => {
                        const fb     = winner;
                        const total2 = scoreEntry?.totalScore ?? fb?.totalScore ?? null;
                        if (total2 === null) return null;
                        const ctr     = scoreEntry?.ctrScore   ?? fb?.ctrScore   ?? null;
                        const eng     = scoreEntry?.engagement ?? fb?.engagement ?? null;
                        const conv    = scoreEntry?.conversion ?? fb?.conversion ?? null;
                        const clarity = scoreEntry?.clarity    ?? null;
                        const isWin   = scoreEntry?.isWinner   ?? fb?.isWinner   ?? false;
                        const c2      = total2 >= 0.65 ? '#22c55e' : total2 >= 0.40 ? '#f59e0b' : '#ef4444';
                        const lbl     = (v: number) => v >= 0.65 ? 'High' : v >= 0.40 ? 'Med' : 'Low';
                        return (
                          <div style={{ padding: '14px 16px' }}>
                            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
                              <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                                <span style={{ fontSize: 30, fontWeight: 800, color: c2, lineHeight: 1 }}>{Math.round(total2 * 100)}</span>
                                <span style={{ fontSize: 12, color: '#444' }}>/100</span>
                                {isWin && <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, color: '#fbbf24', background: 'rgba(251,191,36,0.1)', padding: '2px 8px', borderRadius: 99 }}>🏆 Top Performer</span>}
                              </div>
                              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                                {([
                                  { label: 'CTR',        val: ctr,     color: '#6366f1' },
                                  { label: 'Engagement', val: eng,     color: '#8b5cf6' },
                                  { label: 'Conversion', val: conv,    color: '#10b981' },
                                  { label: 'Clarity',    val: clarity, color: '#f59e0b' },
                                ] as { label: string; val: number | null; color: string }[])
                                  .filter(r => r.val !== null)
                                  .map(row => (
                                    <div key={row.label} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                      <span style={{ fontSize: 10, color: '#444', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>{row.label}</span>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                        <div style={{ width: 28, height: 3, background: '#1e2330', borderRadius: 99 }}>
                                          <div style={{ width: `${Math.round(row.val! * 100)}%`, height: '100%', background: row.color, borderRadius: 99 }} />
                                        </div>
                                        <span style={{ fontSize: 11, fontWeight: 700, color: row.val! >= 0.65 ? '#22c55e' : row.val! >= 0.40 ? '#f59e0b' : '#ef4444' }}>{lbl(row.val!)}</span>
                                      </div>
                                    </div>
                                  ))}
                              </div>
                            </div>
                            {scoreEntry?.dimensions && Object.keys(scoreEntry.dimensions).length > 0 && (
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px 16px' }}>
                                {Object.entries(scoreEntry.dimensions).slice(0, proMode ? undefined : 4).map(([k, v]) => (
                                  <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                    <span style={{ fontSize: 10, color: '#444', flex: 1, textTransform: 'capitalize' }}>{k.replace(/([A-Z])/g, ' $1').toLowerCase()}</span>
                                    <div style={{ width: 32, height: 2, background: '#1e2330', borderRadius: 99 }}>
                                      <div style={{ width: `${Math.round(v * 100)}%`, height: '100%', background: v >= 0.65 ? '#22c55e' : v >= 0.40 ? '#f59e0b' : '#6366f1', borderRadius: 99 }} />
                                    </div>
                                    <span style={{ fontSize: 10, fontWeight: 700, color: '#555', minWidth: 20, textAlign: 'right' }}>{Math.round(v * 100)}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            {!proMode && scoreEntry?.dimensions && Object.keys(scoreEntry.dimensions).length > 4 && (
                              <div style={{ fontSize: 10, color: '#333', marginTop: 6 }}>+{Object.keys(scoreEntry.dimensions).length - 4} more in Pro Mode</div>
                            )}
                          </div>
                        );
                      })()}

                      {/* Insights depth */}
                      {depthTab === 'insights' && (
                        <div style={{ padding: '14px 16px' }}>
                          {(generation?.reasoning || copy.angleReason) && (
                            <p style={{ fontSize: 12, color: '#666', lineHeight: 1.55, margin: '0 0 12px 0' }}>{generation?.reasoning || copy.angleReason}</p>
                          )}
                          {insights.map((ins, i) => (
                            <div key={ins.title} style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'flex-start' }}>
                              <span style={{ fontSize: 15, lineHeight: 1, flexShrink: 0 }}>{ins.icon}</span>
                              <div>
                                <div style={{ fontSize: 12, fontWeight: 600, color: '#e0e0e0', marginBottom: 2 }}>{ins.title}</div>
                                <div style={{ fontSize: 11, color: '#555', lineHeight: 1.5 }}>{ins.sub}</div>
                              </div>
                            </div>
                          ))}
                          {generation?.intentSnapshot && (
                            <div style={{ marginTop: 10, borderTop: '1px solid #1e2330', paddingTop: 10 }}>
                              <div style={{ fontSize: 10, fontWeight: 700, color: '#444', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 7 }}>Generated with</div>
                              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                                {([
                                  { label: generation.intentSnapshot.goal,    color: '#6366f1' },
                                  { label: generation.intentSnapshot.angle,   color: '#a5b4fc' },
                                  { label: generation.intentSnapshot.tone,    color: '#f59e0b' },
                                  { label: generation.intentSnapshot.persona, color: '#22c55e' },
                                ] as { label: string | undefined; color: string }[]).filter(r => r.label).map((r, idx) => (
                                  <span key={idx} style={{ fontSize: 11, fontWeight: 600, color: r.color, background: `${r.color}18`, padding: '2px 9px', borderRadius: 99, textTransform: 'capitalize' }}>{r.label}</span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* History depth */}
                      {depthTab === 'history' && hasHistory && (
                        <div style={{ padding: '14px 16px' }}>
                          {improvementHistory.slice(0, proMode ? 20 : 5).map((imp, i) => {
                            const histSlice = improvementHistory.slice(0, proMode ? 20 : 5);
                            const delta = imp.delta ?? (imp.scoreAfter - imp.scoreBefore);
                            const dStr  = delta > 0 ? `+${Math.round(delta * 100)}` : `${Math.round(delta * 100)}`;
                            const dCol  = delta > 0 ? '#22c55e' : '#ef4444';
                            return (
                              <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', paddingBottom: i < histSlice.length - 1 ? 10 : 0, marginBottom: i < histSlice.length - 1 ? 10 : 0, borderBottom: i < histSlice.length - 1 ? '1px solid #1e2330' : 'none' }}>
                                <div style={{ textAlign: 'center', flexShrink: 0, minWidth: 32 }}>
                                  <div style={{ fontSize: 13, fontWeight: 800, color: dCol }}>{dStr}</div>
                                  <div style={{ fontSize: 9, color: '#444' }}>pts</div>
                                </div>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontSize: 11, color: '#555', marginBottom: 4 }}>
                                    <span style={{ color: '#f87171' }}>{Math.round(imp.scoreBefore * 100)}</span>
                                    {' → '}
                                    <span style={{ color: '#22c55e' }}>{Math.round(imp.scoreAfter * 100)}</span>
                                  </div>
                                  {imp.improvementTypes.length > 0 && (
                                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                      {imp.improvementTypes.map(t => (
                                        <span key={t} style={{ fontSize: 10, color: '#6366f1', background: 'rgba(99,102,241,0.08)', padding: '1px 6px', borderRadius: 99, textTransform: 'capitalize' }}>{t}</span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                          {!proMode && improvementHistory.length > 5 && (
                            <div style={{ fontSize: 10, color: '#333', marginTop: 4 }}>+{improvementHistory.length - 5} more in Pro Mode</div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Format-specific */}
              {format === 'video' && copy.videoScript && (
                <div className="result-script-section">
                  <div className="result-section-label">Scene-by-Scene Script</div>
                  <div className="result-scenes-list">
                    {copy.videoScript.scenes.map((scene, i) => (
                      <div key={i} className="result-scene-item">
                        <div className="result-scene-label">{scene.label}</div>
                        <EditableBlock blockId={`scene-${i}`} value={b[`scene-${i}`] ?? scene.direction} onChange={handleBlockChange} onImprove={handleImproveOpen} className="result-scene-direction" improving={improvingId === `scene-${i}`} multiline {...branchProps(`scene-${i}`)} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {format === 'carousel' && copy.carouselSlides && (
                <div className="result-script-section">
                  <div className="result-section-label">Carousel Slides</div>
                  <div className="result-slides-list">
                    {copy.carouselSlides.map(slide => (
                      <div key={slide.slideNum} className="result-slide-item">
                        <div className="result-slide-num">Slide {slide.slideNum}</div>
                        <EditableBlock blockId={`slide-${slide.slideNum}-headline`} value={b[`slide-${slide.slideNum}-headline`] ?? slide.headline} onChange={handleBlockChange} onImprove={handleImproveOpen} className="result-slide-headline" improving={improvingId === `slide-${slide.slideNum}-headline`} {...branchProps(`slide-${slide.slideNum}-headline`)} />
                        <EditableBlock blockId={`slide-${slide.slideNum}-body`} value={b[`slide-${slide.slideNum}-body`] ?? slide.body} onChange={handleBlockChange} onImprove={handleImproveOpen} className="result-slide-body" improving={improvingId === `slide-${slide.slideNum}-body`} multiline {...branchProps(`slide-${slide.slideNum}-body`)} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {format === 'banner' && copy.bannerCopy && (
                <div className="result-script-section">
                  <div className="result-section-label">Banner Layout</div>
                  <div className="result-banner-card">
                    <div className="result-banner-inner">
                      <EditableBlock blockId="banner-headline" value={b['banner-headline'] ?? copy.bannerCopy.headline} onChange={handleBlockChange} onImprove={handleImproveOpen} className="result-banner-headline" improving={improvingId === 'banner-headline'} {...branchProps('banner-headline')} />
                      <EditableBlock blockId="banner-sub" value={b['banner-sub'] ?? copy.bannerCopy.subheadline} onChange={handleBlockChange} onImprove={handleImproveOpen} className="result-banner-sub" improving={improvingId === 'banner-sub'} multiline {...branchProps('banner-sub')} />
                      <div className="result-banner-cta-wrap">
                        <EditableBlock blockId="banner-cta" value={b['banner-cta'] ?? copy.bannerCopy.cta} onChange={handleBlockChange} onImprove={handleImproveOpen} className="result-banner-cta" improving={improvingId === 'banner-cta'} {...branchProps('banner-cta')} />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <FeedbackTags
                onFeedback={type => {
                  if (generation) {
                    sendFeedback({
                      generation_id: generation.id,
                      signal_type:   type === 'worked' ? 'accept' : 'reject',
                    }).catch(() => {});
                  }
                }}
              />

              <div className="result-footer-actions">
                <Link
                  href={`/studio/${executionId}`}
                  className="result-btn primary"
                  style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'var(--grad)', color: '#fff', border: 'none' }}
                >
                  Preview Creative
                </Link>
                <button className="result-btn primary" onClick={() => handleRerun()} disabled={rerunning}>Regenerate</button>
                <button className="result-btn secondary" onClick={() => handleRerun('alt')} disabled={rerunning}>Alternate Goal</button>
                <button className="result-btn secondary" onClick={handleImprove} disabled={improving || !result?.campaignId}>
                  {improving ? 'Optimizing...' : 'Improve this ad'}
                </button>
                <Link href="/campaigns/new" className="result-btn secondary" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>New Campaign</Link>
                {proMode && (
                  <>
                    <button
                      className="result-btn secondary"
                      onClick={handleSaveSnapshot}
                      disabled={savingSnapshot || !generation}
                      style={{ borderColor: snapshotSaved ? '#22c55e' : undefined, color: snapshotSaved ? '#22c55e' : undefined }}
                    >
                      {snapshotSaved ? '✅ Saved' : savingSnapshot ? 'Saving…' : '📌 Save Snapshot'}
                    </button>
                    <button
                      className="result-btn secondary"
                      onClick={handleRunLearningCycle}
                      disabled={learningRunning || !result?.campaignId}
                      style={{ borderColor: learningDone ? '#22c55e' : undefined, color: learningDone ? '#22c55e' : undefined }}
                    >
                      {learningDone ? '✅ Done' : learningRunning ? '⚙ Running…' : '🔁 Run Learning Cycle'}
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* ── CENTER: Variations ──────────────────────────────────────── */}
            <div className="result-col-center">
              <div className="result-section-label" style={{ marginBottom: 14 }}>Variations</div>

              <div className="result-var-card">
                <div className="result-var-header">
                  <span className="result-var-label">Variation A</span>
                  <span className="result-var-badge">Punchy</span>
                </div>
                <EditableBlock blockId="varA-hook" value={b['varA-hook']} onChange={handleBlockChange} onImprove={handleImproveOpen} className="result-var-hook" improving={improvingId === 'varA-hook'} {...branchProps('varA-hook')} />
                <EditableBlock blockId="varA-copy" value={b['varA-copy']} onChange={handleBlockChange} onImprove={handleImproveOpen} className="result-var-copy" improving={improvingId === 'varA-copy'} multiline {...branchProps('varA-copy')} />
                <div className="result-var-cta-row">
                  <EditableBlock blockId="varA-cta" value={b['varA-cta']} onChange={handleBlockChange} onImprove={handleImproveOpen} className="result-var-cta" improving={improvingId === 'varA-cta'} {...branchProps('varA-cta')} />
                </div>
              </div>

              <div className="result-var-card" style={{ marginTop: 12 }}>
                <div className="result-var-header">
                  <span className="result-var-label">Variation B</span>
                  <span className="result-var-badge">Emotional</span>
                </div>
                <EditableBlock blockId="varB-hook" value={b['varB-hook']} onChange={handleBlockChange} onImprove={handleImproveOpen} className="result-var-hook" improving={improvingId === 'varB-hook'} {...branchProps('varB-hook')} />
                <EditableBlock blockId="varB-copy" value={b['varB-copy']} onChange={handleBlockChange} onImprove={handleImproveOpen} className="result-var-copy" improving={improvingId === 'varB-copy'} multiline {...branchProps('varB-copy')} />
                <div className="result-var-cta-row">
                  <EditableBlock blockId="varB-cta" value={b['varB-cta']} onChange={handleBlockChange} onImprove={handleImproveOpen} className="result-var-cta" improving={improvingId === 'varB-cta'} {...branchProps('varB-cta')} />
                </div>
              </div>
            </div>

            {/* ── RIGHT: Context panel ────────────────────────────────────── */}
            <aside className="result-col-right">

              {/* Active campaign summary */}
              {campaign && (
                <div className="result-ctx-card">
                  <div className="result-ctx-title">Active Campaign</div>
                  <div className="result-ctx-name">{campaign.name ?? `Campaign ${campaign.id.slice(0, 6)}`}</div>
                  <div className="result-ctx-pills">
                    {campaign.goal   && <span className="result-ctx-pill result-ctx-pill--goal">{campaign.goal}</span>}
                    {campaign.angle  && <span className="result-ctx-pill result-ctx-pill--angle">{campaign.angle}</span>}
                    {campaign.tone   && <span className="result-ctx-pill result-ctx-pill--tone">{campaign.tone}</span>}
                  </div>
                  {campaign.persona && (
                    <div className="result-ctx-persona">{campaign.persona}</div>
                  )}
                </div>
              )}

              {/* Concept intelligence — keyObjection + valueProposition */}
              {campaign?.concept && (campaign.concept.keyObjection || campaign.concept.valueProposition) && (
                <div className="result-ctx-card">
                  <div className="result-ctx-title">Concept intelligence</div>
                  {campaign.concept.keyObjection && (
                    <div className="result-ctx-field">
                      <label className="result-ctx-label">Key objection</label>
                      <div style={{ fontSize: 11, color: '#666', lineHeight: 1.5 }}>{campaign.concept.keyObjection}</div>
                    </div>
                  )}
                  {campaign.concept.valueProposition && (
                    <div className="result-ctx-field">
                      <label className="result-ctx-label">Value proposition</label>
                      <div style={{ fontSize: 11, color: '#666', lineHeight: 1.5 }}>{campaign.concept.valueProposition}</div>
                    </div>
                  )}
                </div>
              )}

              {/* Quick edit override */}
              <div className="result-ctx-card">
                <div className="result-ctx-title">Try a different strategy</div>
                <div className="result-ctx-hint">Override applies to this regeneration only</div>
                <div className="result-ctx-field">
                  <label className="result-ctx-label">Goal</label>
                  <select
                    className="result-ctx-select"
                    value={override.goal}
                    onChange={e => setOverride(o => ({ ...o, goal: e.target.value }))}
                  >
                    <option value="">— same as campaign —</option>
                    <option value="conversion">Conversions</option>
                    <option value="awareness">Awareness</option>
                    <option value="engagement">Engagement</option>
                  </select>
                </div>
                <div className="result-ctx-field">
                  <label className="result-ctx-label">Angle</label>
                  <select
                    className="result-ctx-select"
                    value={override.angle}
                    onChange={e => setOverride(o => ({ ...o, angle: e.target.value }))}
                  >
                    <option value="">— same as campaign —</option>
                    <option value="urgency">Urgency</option>
                    <option value="emotional">Emotional</option>
                    <option value="premium">Premium</option>
                    <option value="price-focused">Price-focused</option>
                    <option value="storytelling">Storytelling</option>
                    <option value="pain-point">Pain point</option>
                  </select>
                </div>
                <div className="result-ctx-field">
                  <label className="result-ctx-label">Persona</label>
                  <input
                    className="result-ctx-input"
                    placeholder="e.g. busy moms aged 30–40"
                    value={override.persona}
                    onChange={e => setOverride(o => ({ ...o, persona: e.target.value }))}
                  />
                </div>
                <button
                  className="result-ctx-apply-btn"
                  onClick={() => handleRerun()}
                  disabled={rerunning}
                >
                  {rerunning ? 'Regenerating…' : 'Apply to this generation only →'}
                </button>
              </div>

              {/* Learning Status — top performing angles + global signals */}
              {learningStatus && learningStatus.rankedAngles.length > 0 && (
                <div className="result-ctx-card">
                  <div className="result-ctx-title">System learning</div>
                  <div style={{ fontSize: 10, color: '#444', marginBottom: 10 }}>
                    {learningStatus.system.totalLearningCycles} cycles · health:&nbsp;
                    <span style={{ color: learningStatus.system.learningHealth === 'healthy' ? '#22c55e' : '#f59e0b', fontWeight: 700 }}>
                      {learningStatus.system.learningHealth}
                    </span>
                  </div>
                  {learningStatus.rankedAngles.slice(0, 4).map((a, i) => {
                    const conf = a.sampleCount >= 10 ? 'High' : a.sampleCount >= 4 ? 'Medium' : 'Building…';
                    const confColor = conf === 'High' ? '#22c55e' : conf === 'Medium' ? '#f59e0b' : '#444';
                    const barW = Math.round(a.smoothedScore * 100);
                    return (
                      <div key={a.slug} style={{ marginBottom: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                          <span style={{ fontSize: 11, color: '#888', textTransform: 'capitalize' }}>
                            {i + 1}. {a.label || a.slug.replace(/-/g, ' ')}
                          </span>
                          <span style={{ fontSize: 10, fontWeight: 700, color: confColor }}>{conf}</span>
                        </div>
                        <div style={{ height: 3, background: '#1e2330', borderRadius: 99 }}>
                          <div style={{ width: `${barW}%`, height: '100%', background: i === 0 ? '#6366f1' : '#2d3148', borderRadius: 99 }} />
                        </div>
                      </div>
                    );
                  })}
                  {globalStats?.topAngles && globalStats.topAngles.length > 0 && (
                    <div style={{ borderTop: '1px solid #1e2330', paddingTop: 8, marginTop: 4, fontSize: 10, color: '#444' }}>
                      Global top:&nbsp;
                      <span style={{ color: '#a5b4fc', fontWeight: 600, textTransform: 'capitalize' }}>
                        {globalStats.topAngles[0].label ?? globalStats.topAngles[0].slug}
                      </span>
                    </div>
                  )}
                  {outcomeInsights(outcomeWeights).length > 0 && (
                    <div style={{ borderTop: '1px solid #1e2330', paddingTop: 8, marginTop: 4 }}>
                      {outcomeInsights(outcomeWeights).map((ins, i) => (
                        <div key={i} style={{ fontSize: 11, color: '#666', lineHeight: 1.5, marginBottom: 3, display: 'flex', gap: 5 }}>
                          <span style={{ color: i === 0 ? '#22c55e' : '#f59e0b', fontWeight: 700, flexShrink: 0 }}>◎</span>
                          <span>{ins}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── Track this ad ──────────────────────────────────────── */}
              {result.creatives[0]?.creativeId && (() => {
                const coId   = result.creatives[0].creativeId;
                const param  = `?co_id=${coId}`;
                const full   = trackUrl ? (trackUrl.includes('?') ? `${trackUrl}&co_id=${coId}` : `${trackUrl}?co_id=${coId}`) : param;
                const copy   = () => { navigator.clipboard.writeText(full).catch(() => {}); setTrackCopied(true); setTimeout(() => setTrackCopied(false), 2000); };
                return (
                  <div className="result-ctx-card">
                    <div className="result-ctx-title">Track this ad</div>
                    <p style={{ fontSize: 11, color: '#555', lineHeight: 1.55, margin: '0 0 10px 0' }}>
                      Add this to your landing page URL so the system can match CSV performance data to this exact creative.
                    </p>
                    {/* Paste-your-URL helper */}
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#444', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Your landing page (optional)</div>
                      <input
                        type="url"
                        placeholder="https://yourstore.com/product"
                        value={trackUrl}
                        onChange={e => setTrackUrl(e.target.value)}
                        style={{ width: '100%', padding: '7px 10px', background: '#080910', border: '1px solid #1e2330', borderRadius: 6, color: '#f0f0f0', fontSize: 12, boxSizing: 'border-box' as const, fontFamily: 'inherit' }}
                      />
                    </div>
                    {/* Generated tracked URL */}
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <div style={{ flex: 1, padding: '7px 10px', background: '#080910', border: '1px solid #1e2330', borderRadius: 6, fontSize: 11, color: '#a5b4fc', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {full}
                      </div>
                      <button
                        onClick={copy}
                        style={{ flexShrink: 0, padding: '7px 12px', background: trackCopied ? 'rgba(34,197,94,0.1)' : 'rgba(99,102,241,0.1)', border: `1px solid ${trackCopied ? 'rgba(34,197,94,0.3)' : 'rgba(99,102,241,0.3)'}`, borderRadius: 6, fontSize: 11, fontWeight: 700, color: trackCopied ? '#22c55e' : '#a5b4fc', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}
                      >
                        {trackCopied ? '✓ Copied' : 'Copy'}
                      </button>
                    </div>
                    <div style={{ marginTop: 10, fontSize: 10, color: '#333', lineHeight: 1.5 }}>
                      Tracking ID: <span style={{ fontFamily: 'monospace', color: '#555' }}>{coId.slice(0, 12)}…</span>
                      &nbsp;·&nbsp;
                      <a href="/app/import" style={{ color: '#6366f1', textDecoration: 'none', fontWeight: 600 }}>Import CSV →</a>
                    </div>
                  </div>
                );
              })()}

            </aside>
          </div>
        {/* Improvement result panel */}
        {showImprovement && improvementResult && improvementResult.length > 0 && (
          <div style={{ marginTop: 28, border: '1px solid rgba(99,102,241,0.35)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ background: 'rgba(99,102,241,0.08)', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#a5b4fc' }}>✦ AI Optimization Result</span>
                <span style={{ fontSize: 11, color: '#555', marginLeft: 10 }}>{improvementResult.length} improvement{improvementResult.length > 1 ? 's' : ''} found</span>
              </div>
              <button onClick={() => setShowImprovement(false)} style={{ background: 'none', border: 'none', color: '#444', fontSize: 16, cursor: 'pointer', lineHeight: 1 }}>✕</button>
            </div>
            {improvementResult.map((imp, i) => (
              <div key={i} style={{ padding: '16px 20px', borderTop: i > 0 ? '1px solid #1e2330' : undefined }}>
                {/* Score delta */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14 }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: '#555' }}>{Math.round(imp.scoreBefore * 100)}</div>
                    <div style={{ fontSize: 10, color: '#444' }}>Before</div>
                  </div>
                  <div style={{ flex: 1, height: 2, background: '#1e2330', position: 'relative' }}>
                    <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', background: imp.delta > 0 ? 'rgba(34,197,94,0.15)' : '#1e2330', border: `1px solid ${imp.delta > 0 ? '#22c55e' : '#333'}`, borderRadius: 99, padding: '2px 10px', fontSize: 11, fontWeight: 700, color: imp.delta > 0 ? '#22c55e' : '#555', whiteSpace: 'nowrap' }}>
                      {imp.delta > 0 ? `+${Math.round(imp.delta * 100)}` : Math.round(imp.delta * 100)} pts
                    </div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: imp.scoreAfter > imp.scoreBefore ? '#22c55e' : '#f0f0f0' }}>{Math.round(imp.scoreAfter * 100)}</div>
                    <div style={{ fontSize: 10, color: '#444' }}>After</div>
                  </div>
                </div>
                {/* Improvement types */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
                  {imp.improvementTypes.map(t => (
                    <span key={t} style={{ fontSize: 10, fontWeight: 700, color: '#6366f1', background: 'rgba(99,102,241,0.1)', padding: '2px 8px', borderRadius: 99, textTransform: 'capitalize' }}>{t}</span>
                  ))}
                </div>
                {/* Actions */}
                <div style={{ display: 'flex', gap: 8 }}>
                  {imp.changesApplied && (imp.changesApplied.hook || imp.changesApplied.body || imp.changesApplied.cta) ? (
                    <button
                      onClick={() => applyImprovement(imp)}
                      style={{ padding: '8px 18px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                    >
                      Apply improved version
                    </button>
                  ) : (
                    <span style={{ fontSize: 11, color: '#555', alignSelf: 'center' }}>Campaign concept updated — regenerate to see effect</span>
                  )}
                  <button
                    onClick={() => { setShowImprovement(false); setImprovementResult(null); }}
                    style={{ padding: '8px 14px', background: 'none', border: '1px solid #1e2330', borderRadius: 7, fontSize: 12, color: '#555', cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    Discard
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}


        {/* Report real performance */}
        <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
          {!showMetrics ? (
            <button
              onClick={() => setShowMetrics(true)}
              style={{ background: 'none', border: '1px solid #1e2330', borderRadius: 7, color: '#444', fontSize: 11, padding: '5px 14px', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              📊 Report real performance
            </button>
          ) : (
            <div style={{ background: '#0d0e14', border: '1px solid #1e2330', borderRadius: 10, padding: '16px 18px', width: '100%', maxWidth: 480 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#a5b4fc', marginBottom: 12 }}>Report real ad performance</div>
              {metricsSubmitted ? (
                <div style={{ fontSize: 12, color: '#22c55e', padding: '8px 0' }}>✅ Learning updated from real performance data</div>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
                    {[
                      { label: 'CTR %',          val: metricsCtr,        set: setMetricsCtr,        ph: 'e.g. 3.2' },
                      { label: 'Conversion %',   val: metricsConv,       set: setMetricsConv,       ph: 'e.g. 1.8' },
                      { label: 'Retention %',    val: metricsRetention,  set: setMetricsRetention,  ph: 'optional' },
                    ].map(f => (
                      <div key={f.label}>
                        <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#444', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{f.label}</label>
                        <input
                          type="number" min="0" max="100" step="0.1"
                          value={f.val} onChange={e => f.set(e.target.value)}
                          placeholder={f.ph}
                          style={{ width: '100%', padding: '6px 10px', background: '#080910', border: '1px solid #1e2330', borderRadius: 6, color: '#f0f0f0', fontSize: 12, boxSizing: 'border-box' as const, fontFamily: 'inherit' }}
                        />
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={handleSubmitMetrics}
                      disabled={!metricsCtr || !metricsConv}
                      style={{ padding: '7px 18px', background: (!metricsCtr || !metricsConv) ? '#1e2330' : '#6366f1', color: (!metricsCtr || !metricsConv) ? '#444' : '#fff', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: (!metricsCtr || !metricsConv) ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
                    >
                      Submit &amp; update learning
                    </button>
                    <button onClick={() => setShowMetrics(false)} style={{ padding: '7px 12px', background: 'none', border: '1px solid #1e2330', borderRadius: 7, fontSize: 12, color: '#555', cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        </div>

        {/* Global ImprovePanel — positioned fixed below the active block */}
        {panelBlock && (
          <ImprovePanel
            blockId={panelBlock}
            anchorEl={panelAnchor}
            loading={improvingId === panelBlock}
            onApply={handleImproveApply}
            onClose={handleImproveClose}
          />
        )}

        {/* ── PHASE 1: Ghost Systems ───────────────────────────────────────── */}
        {result && (
          <div style={{ marginTop: 32, display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* ⚡ Hook Booster v1 + v2 */}
            <div style={{ background: '#0d0e14', border: '1px solid #1e2330', borderRadius: 12, padding: '18px 20px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#444', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
                ⚡ Hook Booster — Generate & Optimize Hooks
              </div>
              <div style={{ fontSize: 12, color: '#555', marginBottom: 14, lineHeight: 1.5 }}>
                Generate 3 hook variants (v1) then run the memory + fatigue pipeline to produce EXPLOIT / HYBRID / EXPLORE optimized hooks (v2).
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
                <button
                  onClick={handleGenerateHooks}
                  disabled={generatingHooks}
                  style={{
                    padding: '8px 18px',
                    background: generatingHooks ? 'rgba(245,158,11,0.05)' : 'rgba(245,158,11,0.12)',
                    border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8,
                    color: generatingHooks ? '#444' : '#fbbf24', fontSize: 12, fontWeight: 700,
                    cursor: generatingHooks ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  {generatingHooks
                    ? <><span style={{ width: 12, height: 12, border: '2px solid rgba(255,255,255,0.2)', borderTopColor: '#fbbf24', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />Generating…</>
                    : '⚡ Generate Hooks (v1)'}
                </button>
                {hookBoosterV1 && (
                  <button
                    onClick={handleBoostHooksV2}
                    disabled={boostingHooks}
                    style={{
                      padding: '8px 18px',
                      background: boostingHooks ? 'rgba(99,102,241,0.05)' : 'rgba(99,102,241,0.15)',
                      border: '1px solid rgba(99,102,241,0.3)', borderRadius: 8,
                      color: boostingHooks ? '#444' : '#a5b4fc', fontSize: 12, fontWeight: 700,
                      cursor: boostingHooks ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                      display: 'flex', alignItems: 'center', gap: 6,
                    }}
                  >
                    {boostingHooks
                      ? <><span style={{ width: 12, height: 12, border: '2px solid rgba(255,255,255,0.2)', borderTopColor: '#a5b4fc', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />Boosting…</>
                      : '🚀 Boost to v2 (Memory + Fatigue)'}
                  </button>
                )}
              </div>

              {/* v1 results */}
              {hookBoosterV1 && (
                <div style={{ marginBottom: hookBoosterV2 ? 16 : 0 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#444', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
                    v1 Hooks — {hookBoosterV1.format}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {hookBoosterV1.hooks.map((h, i) => (
                      <div
                        key={i}
                        style={{
                          padding: '10px 14px',
                          background: i === hookBoosterV1.best_hook_index ? 'rgba(245,158,11,0.07)' : 'rgba(255,255,255,0.025)',
                          border: `1px solid ${i === hookBoosterV1.best_hook_index ? 'rgba(245,158,11,0.25)' : '#1a1b24'}`,
                          borderRadius: 8,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, color: '#e0e0e0', lineHeight: 1.5, marginBottom: 4 }}>{h.hook}</div>
                            <div style={{ display: 'flex', gap: 8 }}>
                              <span style={{ fontSize: 9, color: '#555', textTransform: 'uppercase', fontWeight: 700, background: '#111', padding: '1px 6px', borderRadius: 99 }}>{h.strategy}</span>
                              <span style={{ fontSize: 9, color: '#444' }}>strength: <span style={{ color: '#888', fontWeight: 700 }}>{Math.round(h.strength_score * 100)}</span></span>
                            </div>
                          </div>
                          {i === hookBoosterV1.best_hook_index && (
                            <span style={{ fontSize: 9, color: '#fbbf24', fontWeight: 700, background: 'rgba(245,158,11,0.15)', padding: '2px 8px', borderRadius: 99, flexShrink: 0 }}>BEST</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  {hookBoosterV1.reasoning && (
                    <div style={{ fontSize: 11, color: '#444', marginTop: 10, lineHeight: 1.5, fontStyle: 'italic' }}>{hookBoosterV1.reasoning}</div>
                  )}
                </div>
              )}

              {/* v2 results */}
              {hookBoosterV2 && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#a5b4fc', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
                    v2 Optimized Hooks (Memory + Fatigue + Exploration)
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {hookBoosterV2.hooks.map((h, i) => {
                      const stratColor = h.strategy === 'EXPLOIT' ? '#22c55e' : h.strategy === 'EXPLORE' ? '#f59e0b' : '#8b5cf6';
                      return (
                        <div
                          key={i}
                          style={{
                            padding: '10px 14px',
                            background: i === hookBoosterV2.best_hook_index ? 'rgba(99,102,241,0.07)' : 'rgba(255,255,255,0.02)',
                            border: `1px solid ${i === hookBoosterV2.best_hook_index ? 'rgba(99,102,241,0.25)' : '#1a1b24'}`,
                            borderRadius: 8,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 13, color: '#e0e0e0', lineHeight: 1.5, marginBottom: 5 }}>{h.hook}</div>
                              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                <span style={{ fontSize: 9, color: stratColor, fontWeight: 700, background: `${stratColor}18`, padding: '1px 7px', borderRadius: 99 }}>{h.strategy}</span>
                                {h.memory_bias_applied && <span style={{ fontSize: 9, color: '#6366f1', background: 'rgba(99,102,241,0.12)', padding: '1px 6px', borderRadius: 99 }}>memory</span>}
                                {h.fatigue_adjusted && <span style={{ fontSize: 9, color: '#f59e0b', background: 'rgba(245,158,11,0.1)', padding: '1px 6px', borderRadius: 99 }}>fatigue adj</span>}
                                <span style={{ fontSize: 9, color: '#444' }}>strength: <span style={{ color: '#888', fontWeight: 700 }}>{Math.round(h.strength_score * 100)}</span></span>
                              </div>
                            </div>
                            {i === hookBoosterV2.best_hook_index && (
                              <span style={{ fontSize: 9, color: '#a5b4fc', fontWeight: 700, background: 'rgba(99,102,241,0.15)', padding: '2px 8px', borderRadius: 99, flexShrink: 0 }}>BEST v2</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* ✏️ Scene Rewriter */}
            <div style={{ background: '#0d0e14', border: '1px solid #1e2330', borderRadius: 12, padding: '18px 20px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#444', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
                ✏️ Scene Rewriter — Micro-Rewrite Hook / Scene
              </div>
              <div style={{ fontSize: 12, color: '#555', marginBottom: 14, lineHeight: 1.5 }}>
                Generates 3 targeted rewrites of your current hook — CLARITY, EMOTIONAL, PERFORMANCE — based on the creative's performance signals.
              </div>
              <button
                onClick={handleRewriteScene}
                disabled={rewritingScene || !editor?.blocks['hook']}
                style={{
                  padding: '8px 18px',
                  background: rewritingScene ? 'rgba(16,185,129,0.05)' : 'rgba(16,185,129,0.12)',
                  border: '1px solid rgba(16,185,129,0.3)', borderRadius: 8,
                  color: rewritingScene ? '#444' : '#34d399', fontSize: 12, fontWeight: 700,
                  cursor: rewritingScene ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14,
                }}
              >
                {rewritingScene
                  ? <><span style={{ width: 12, height: 12, border: '2px solid rgba(255,255,255,0.2)', borderTopColor: '#34d399', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />Rewriting…</>
                  : '✏️ Rewrite Scene (3 Variants)'}
              </button>
              {sceneRewriteResult && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {sceneRewriteResult.rewrites.map((r, i) => {
                    const typeColor = r.improvement_type === 'CLARITY' ? '#6366f1' : r.improvement_type === 'EMOTIONAL' ? '#f59e0b' : '#22c55e';
                    return (
                      <div
                        key={i}
                        style={{
                          padding: '12px 14px',
                          background: i === sceneRewriteResult.best_rewrite_index ? `${typeColor}08` : 'rgba(255,255,255,0.025)',
                          border: `1px solid ${i === sceneRewriteResult.best_rewrite_index ? `${typeColor}30` : '#1a1b24'}`,
                          borderRadius: 9,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          <span style={{ fontSize: 9, fontWeight: 700, color: typeColor, background: `${typeColor}18`, padding: '2px 8px', borderRadius: 99 }}>{r.improvement_type}</span>
                          <span style={{ fontSize: 10, color: '#444' }}>impact: <span style={{ color: typeColor, fontWeight: 700 }}>{Math.round(r.impact_score * 100)}</span></span>
                          {i === sceneRewriteResult.best_rewrite_index && (
                            <span style={{ marginLeft: 'auto', fontSize: 9, color: typeColor, fontWeight: 700, background: `${typeColor}15`, padding: '1px 8px', borderRadius: 99 }}>BEST</span>
                          )}
                        </div>
                        <div style={{ fontSize: 13, color: '#ddd', lineHeight: 1.55, marginBottom: 6 }}>{r.rewritten_segment}</div>
                        <div style={{ fontSize: 11, color: '#444', lineHeight: 1.5, fontStyle: 'italic' }}>{r.reason}</div>
                      </div>
                    );
                  })}
                  {sceneRewriteResult.reasoning && (
                    <div style={{ fontSize: 11, color: '#333', padding: '6px 12px', borderTop: '1px solid #1a1b24', lineHeight: 1.5 }}>{sceneRewriteResult.reasoning}</div>
                  )}
                </div>
              )}
            </div>

            {/* 🏆 Auto-Winner — Variation Comparison */}
            {generation && generation.variations.length > 0 && (
              <div style={{ background: '#0d0e14', border: '1px solid #1e2330', borderRadius: 12, padding: '18px 20px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#444', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
                  🏆 Auto-Winner — Weighted Variation Comparison
                </div>
                <div style={{ fontSize: 12, color: '#555', marginBottom: 14, lineHeight: 1.5 }}>
                  Evaluates all variations using weighted scoring: CTR 30% · Retention 30% · Conversion 25% · Clarity 15%.
                </div>
                <button
                  onClick={handleAutoWinner}
                  disabled={runningAutoWinner}
                  style={{
                    padding: '8px 18px',
                    background: runningAutoWinner ? 'rgba(99,102,241,0.05)' : 'rgba(99,102,241,0.15)',
                    border: '1px solid rgba(99,102,241,0.3)', borderRadius: 8,
                    color: runningAutoWinner ? '#444' : '#a5b4fc', fontSize: 12, fontWeight: 700,
                    cursor: runningAutoWinner ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                    display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14,
                  }}
                >
                  {runningAutoWinner
                    ? <><span style={{ width: 12, height: 12, border: '2px solid rgba(255,255,255,0.2)', borderTopColor: '#a5b4fc', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />Evaluating…</>
                    : '🏆 Evaluate All Variations'}
                </button>
                {autoWinnerResult && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {autoWinnerResult.variants.map((v, i) => {
                      const isWinner = v.id === autoWinnerResult.winner.id;
                      return (
                        <div
                          key={v.id}
                          style={{
                            padding: '12px 14px',
                            background: isWinner ? 'rgba(99,102,241,0.07)' : 'rgba(255,255,255,0.02)',
                            border: `1px solid ${isWinner ? 'rgba(99,102,241,0.25)' : '#1a1b24'}`,
                            borderRadius: 9,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: isWinner ? '#a5b4fc' : '#666' }}>
                              {isWinner && '🏆 '}{v.id === 'main' ? 'Main' : `Variation ${i}`}
                            </span>
                            <span style={{
                              marginLeft: 'auto',
                              fontSize: 16, fontWeight: 800,
                              color: v.final_score >= 65 ? '#22c55e' : v.final_score >= 45 ? '#f59e0b' : '#ef4444',
                            }}>
                              {Math.round(v.final_score)}
                            </span>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                            {([
                              ['CTR',        v.breakdown.ctr,        '#6366f1'],
                              ['Retention',  v.breakdown.retention,  '#8b5cf6'],
                              ['Conversion', v.breakdown.conversion, '#10b981'],
                              ['Clarity',    v.breakdown.clarity,    '#f59e0b'],
                            ] as [string, number, string][]).map(([dim, val, color]) => (
                              <div key={dim}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                                  <span style={{ fontSize: 8, color: '#444', textTransform: 'uppercase' }}>{dim}</span>
                                  <span style={{ fontSize: 8, color, fontWeight: 700 }}>{Math.round(val)}</span>
                                </div>
                                <div style={{ height: 3, background: '#1e2330', borderRadius: 99, overflow: 'hidden' }}>
                                  <div style={{ width: `${Math.round(val)}%`, height: '100%', background: color, borderRadius: 99 }} />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                    {autoWinnerResult.reasoning && (
                      <div style={{ fontSize: 11, color: '#444', padding: '8px 12px', borderTop: '1px solid #1a1b24', lineHeight: 1.5 }}>{autoWinnerResult.reasoning}</div>
                    )}
                  </div>
                )}
              </div>
            )}

          </div>
        )}

      </main>
    </div>
  );
}

function MiniSpinner() {
  return <span style={{ width: 10, height: 10, border: '2px solid rgba(245,158,11,0.3)', borderTopColor: '#f59e0b', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />;
}
