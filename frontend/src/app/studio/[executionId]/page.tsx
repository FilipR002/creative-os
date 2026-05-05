'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams }                         from 'next/navigation';
import Link                                  from 'next/link';

import { Sidebar }                           from '@/components/Sidebar';
import { PlatformSelector }                  from '@/components/studio/PlatformSelector';
import { CreativePreview, PreviewSkeleton }  from '@/components/studio/CreativePreview';
import { CopyPanel }                         from '@/components/studio/CopyPanel';

import { loadRunResult, type RunResult }     from '@/lib/api/run-client';
import {
  fetchCreativeContent,
  buildSyntheticCopy,
  type CreativeContent,
  type Platform,
} from '@/lib/api/creative-client';

// ─── Types ────────────────────────────────────────────────────────────────────

type ViewState = 'loading' | 'processing' | 'done' | 'failed';
type StudioTab = 'strategy' | 'production' | 'system';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildContentFromRun(
  result:    RunResult,
  creative:  RunResult['creatives'][0],
): CreativeContent {
  const score    = result.scoring.find(s => s.creativeId === creative.creativeId);
  const isWinner = result.winner?.creativeId === creative.creativeId;

  return {
    id:           creative.creativeId,
    format:       creative.format as CreativeContent['format'],
    angleSlug:    creative.angleSlug,
    score:        score?.totalScore,
    isWinner,
    copy:         buildSyntheticCopy({
      brief:     result.concept.brief,
      angleSlug: creative.angleSlug,
      format:    creative.format as CreativeContent['format'],
    }),
    slides: creative.format === 'carousel'
      ? Array.from({ length: 5 }, (_, i) => ({
          index:    i,
          headline: i === 0 ? result.concept.brief : `Slide ${i + 1}`,
          subtext:  i === 0 ? creative.angleSlug.replace(/_/g, ' ') : undefined,
          cta:      i === 4 ? 'Shop Now' : undefined,
        }))
      : undefined,
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TabButton({
  label,
  active,
  onClick,
}: {
  label:   string;
  active:  boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width:        '100%',
        display:      'flex',
        alignItems:   'center',
        padding:      '8px 12px',
        borderRadius: 8,
        border:       'none',
        background:   active ? 'var(--surface-3)' : 'transparent',
        color:        active ? 'var(--text)' : 'var(--sub)',
        fontSize:     12,
        fontWeight:   active ? 600 : 400,
        cursor:       'pointer',
        textAlign:    'left',
        transition:   'background 0.15s, color 0.15s',
      }}
    >
      {label}
    </button>
  );
}

function StrategySidebar({
  result,
  selected,
  onSelect,
}: {
  result:   RunResult;
  selected: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{
        fontSize:      10,
        fontWeight:    700,
        color:         'var(--muted)',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        padding:       '0 4px',
        marginBottom:  6,
      }}>
        Angles
      </div>
      {result.creatives.map(c => {
        const score    = result.scoring.find(s => s.creativeId === c.creativeId);
        const isWinner = result.winner?.creativeId === c.creativeId;

        return (
          <button
            key={c.creativeId}
            onClick={() => onSelect(c.creativeId)}
            style={{
              display:      'flex',
              flexDirection: 'column',
              gap:          3,
              padding:      '8px 10px',
              borderRadius: 8,
              border:       `1px solid ${selected === c.creativeId ? 'rgba(0,201,122,0.25)' : 'var(--border)'}`,
              background:   selected === c.creativeId ? 'rgba(0,201,122,0.05)' : 'var(--surface)',
              cursor:       'pointer',
              textAlign:    'left',
              transition:   'border-color 0.15s, background 0.15s',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {isWinner && (
                <span style={{
                  width:        6,
                  height:       6,
                  borderRadius: '50%',
                  background:   'var(--accent)',
                  flexShrink:   0,
                }} />
              )}
              <span style={{
                fontSize:   11,
                fontWeight: selected === c.creativeId ? 600 : 400,
                color:      selected === c.creativeId ? 'var(--text)' : 'var(--sub)',
                overflow:   'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {c.angleSlug.replace(/_/g, ' ')}
              </span>
            </div>
            {score && (
              <span style={{
                fontSize:   10,
                color:      'var(--muted)',
                fontFamily: 'var(--mono)',
              }}>
                {Math.round(score.totalScore * 100)}% score
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function ProductionSidebar({ result }: { result: RunResult }) {
  const rows = [
    { label: 'Format',     val: result.creatives[0]?.format ?? '—' },
    { label: 'Angles',     val: String(result.angles.length) },
    { label: 'Creatives',  val: String(result.creatives.length) },
    { label: 'Learning',   val: result.learningUpdateStatus },
    { label: 'Evolution',  val: result.evolutionTriggered ? 'Triggered' : 'Stable' },
    { label: 'Execution',  val: result.executionId.slice(0, 8) + '...' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{
        fontSize:      10,
        fontWeight:    700,
        color:         'var(--muted)',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        padding:       '0 4px',
        marginBottom:  6,
      }}>
        Run Info
      </div>
      {rows.map(({ label, val }) => (
        <div key={label} style={{
          display:        'flex',
          justifyContent: 'space-between',
          gap:            8,
          padding:        '6px 10px',
          borderRadius:   6,
          background:     'var(--surface)',
          border:         '1px solid var(--border)',
        }}>
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>{label}</span>
          <span style={{
            fontSize:   11,
            color:      'var(--sub)',
            fontFamily: label === 'Execution' ? 'var(--mono)' : 'var(--font)',
            fontWeight: 500,
          }}>
            {val}
          </span>
        </div>
      ))}
    </div>
  );
}

function SystemSidebar({ result }: { result: RunResult }) {
  const winner = result.winner;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{
        fontSize:      10,
        fontWeight:    700,
        color:         'var(--muted)',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        padding:       '0 4px',
        marginBottom:  2,
      }}>
        Scoring
      </div>
      {result.scoring.map(s => (
        <div key={s.creativeId} style={{
          padding:      '8px 10px',
          background:   'var(--surface)',
          border:       `1px solid ${s.isWinner ? 'rgba(0,201,122,0.25)' : 'var(--border)'}`,
          borderRadius: 8,
        }}>
          <div style={{ fontSize: 11, color: 'var(--sub)', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {s.angleSlug.replace(/_/g, ' ')}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
            {[
              { k: 'CTR',   v: s.ctrScore   },
              { k: 'Eng',   v: s.engagement },
              { k: 'Conv',  v: s.conversion },
              { k: 'Total', v: s.totalScore },
            ].map(({ k, v }) => (
              <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{k}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{
                    flex:         1,
                    height:       3,
                    background:   'var(--surface-3)',
                    borderRadius: 2,
                    overflow:     'hidden',
                  }}>
                    <div style={{
                      height:     '100%',
                      width:      `${Math.round(v * 100)}%`,
                      background: v >= 0.7 ? 'var(--accent)' : v >= 0.5 ? 'var(--warning)' : 'var(--muted)',
                      borderRadius: 2,
                    }} />
                  </div>
                  <span style={{ fontSize: 10, color: 'var(--sub)', fontFamily: 'var(--mono)', minWidth: 24, textAlign: 'right' }}>
                    {Math.round(v * 100)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function StateOverlay({ state, error }: { state: ViewState; error?: string }) {
  if (state === 'loading') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
        <PreviewSkeleton format="video" />
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>Loading creative...</div>
      </div>
    );
  }

  if (state === 'processing') {
    return (
      <div style={{
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        gap:            20,
        minHeight:      400,
      }}>
        <div style={{
          width:        64,
          height:       64,
          borderRadius: '50%',
          border:       '3px solid var(--surface-3)',
          borderTop:    '3px solid var(--accent)',
          animation:    'spin 1s linear infinite',
        }} />
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
            Rendering
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
            Your creative is being processed. This takes 1–3 minutes.
          </div>
        </div>
        <div style={{
          width:        200,
          height:       4,
          background:   'var(--surface-3)',
          borderRadius: 2,
          overflow:     'hidden',
        }}>
          <div style={{
            height:     '100%',
            background: 'var(--grad)',
            borderRadius: 2,
            animation:  'progress-indeterminate 2s ease-in-out infinite',
          }} />
        </div>
      </div>
    );
  }

  if (state === 'failed') {
    return (
      <div style={{
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        gap:            12,
        minHeight:      300,
        textAlign:      'center',
      }}>
        <div style={{
          width:        48,
          height:       48,
          borderRadius: '50%',
          background:   'rgba(255,71,87,0.1)',
          border:       '1px solid rgba(255,71,87,0.2)',
          display:      'flex',
          alignItems:   'center',
          justifyContent: 'center',
          fontSize:     20,
          color:        'var(--danger)',
        }}>
          ✕
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Generation failed</div>
        {error && (
          <div style={{ fontSize: 12, color: 'var(--muted)', maxWidth: 300, lineHeight: 1.5 }}>{error}</div>
        )}
        <Link href="/create" style={{
          fontSize:     12,
          fontWeight:   600,
          color:        'var(--accent)',
          padding:      '8px 16px',
          background:   'rgba(0,201,122,0.08)',
          border:       '1px solid rgba(0,201,122,0.2)',
          borderRadius: 8,
        }}>
          Try again
        </Link>
      </div>
    );
  }

  return null;
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function StudioPage() {
  const params      = useParams<{ executionId: string }>();
  const executionId = params.executionId;

  const [runResult,  setRunResult]  = useState<RunResult | null>(null);
  const [content,    setContent]    = useState<CreativeContent | null>(null);
  const [viewState,  setViewState]  = useState<ViewState>('loading');
  const [error,      setError]      = useState<string | undefined>();
  const [activeTab,  setActiveTab]  = useState<StudioTab>('strategy');
  const [platform,   setPlatform]   = useState<Platform>('tiktok');
  const [selectedId, setSelectedId] = useState<string>('');

  // Load run result from session storage
  useEffect(() => {
    const result = loadRunResult(executionId);
    if (!result) {
      setViewState('failed');
      setError('Run result not found. Please generate a new creative.');
      return;
    }
    setRunResult(result);

    // Select winner by default, or first creative
    const defaultCreative = result.winner
      ? result.creatives.find(c => c.creativeId === result.winner!.creativeId) ?? result.creatives[0]
      : result.creatives[0];

    if (!defaultCreative) {
      setViewState('failed');
      setError('No creatives were generated.');
      return;
    }

    setSelectedId(defaultCreative.creativeId);
  }, [executionId]);

  // Load creative content when selection changes
  const loadCreative = useCallback(async (creativeId: string, result: RunResult) => {
    setViewState('loading');
    const creative = result.creatives.find(c => c.creativeId === creativeId);
    if (!creative) { setViewState('failed'); return; }

    // Try fetching real content from backend
    const real = await fetchCreativeContent(creativeId);

    if (real) {
      // Backend returned content — use it
      setContent(real);
      if (real.videoUrl || real.stitchedVideoUrl || real.slides?.length || real.banners?.length) {
        setViewState('done');
      } else {
        setViewState('processing');
      }
    } else {
      // Backend unreachable or creative not rendered yet — build from run metadata
      const synthetic = buildContentFromRun(result, creative);
      setContent(synthetic);
      // Video creatives may still be processing
      setViewState(creative.format === 'video' ? 'processing' : 'done');
    }
  }, []);

  useEffect(() => {
    if (!selectedId || !runResult) return;
    loadCreative(selectedId, runResult);
  }, [selectedId, runResult, loadCreative]);

  // Auto-set platform based on format
  useEffect(() => {
    if (!content) return;
    if (content.format === 'banner') setPlatform('google');
    else setPlatform('tiktok');
  }, [content?.format]);

  const format = content?.format ?? runResult?.creatives[0]?.format ?? 'video';

  return (
          <main className="app-main" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* ── Top bar ───────────────────────────────────────────────────────── */}
        <div style={{
          display:        'flex',
          alignItems:     'center',
          gap:            16,
          padding:        '12px 24px',
          borderBottom:   '1px solid var(--border)',
          background:     'var(--sidebar)',
          flexShrink:     0,
        }}>
          <Link href="/dashboard" style={{
            display:      'flex',
            alignItems:   'center',
            gap:          6,
            fontSize:     12,
            color:        'var(--muted)',
            padding:      '4px 8px',
            borderRadius: 6,
            border:       '1px solid var(--border)',
            background:   'var(--surface)',
            transition:   'color 0.15s',
          }}>
            ← Back
          </Link>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {runResult?.concept.brief ?? 'Creative Studio'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>
              {executionId.slice(0, 8)} · {runResult?.creatives.length ?? 0} variant{(runResult?.creatives.length ?? 0) !== 1 ? 's' : ''}
            </div>
          </div>

          {/* Platform selector */}
          <PlatformSelector
            selected={platform}
            onChange={setPlatform}
            format={format as 'video' | 'carousel' | 'banner'}
          />
        </div>

        {/* ── Three-panel body ──────────────────────────────────────────────── */}
        <div style={{
          display:    'flex',
          flex:       1,
          overflow:   'hidden',
          minHeight:  0,
        }}>

          {/* ── LEFT: Strategy / Production / System ──────────────────────── */}
          <div style={{
            width:        220,
            flexShrink:   0,
            borderRight:  '1px solid var(--border)',
            background:   'var(--sidebar)',
            display:      'flex',
            flexDirection: 'column',
          }}>
            {/* Tab switcher */}
            <div style={{
              display:      'flex',
              gap:          2,
              padding:      '12px 12px 8px',
              borderBottom: '1px solid var(--border)',
            }}>
              {(['strategy', 'production', 'system'] as StudioTab[]).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    flex:         1,
                    padding:      '5px 0',
                    borderRadius: 6,
                    border:       'none',
                    background:   activeTab === tab ? 'var(--surface)' : 'transparent',
                    color:        activeTab === tab ? 'var(--text)' : 'var(--muted)',
                    fontSize:     10,
                    fontWeight:   activeTab === tab ? 700 : 500,
                    cursor:       'pointer',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    transition:   'background 0.15s, color 0.15s',
                  }}
                >
                  {tab.slice(0, 4)}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
              {runResult && (
                <>
                  {activeTab === 'strategy'   && (
                    <StrategySidebar
                      result={runResult}
                      selected={selectedId}
                      onSelect={setSelectedId}
                    />
                  )}
                  {activeTab === 'production' && <ProductionSidebar result={runResult} />}
                  {activeTab === 'system'     && <SystemSidebar result={runResult} />}
                </>
              )}
            </div>
          </div>

          {/* ── CENTER: Preview ───────────────────────────────────────────── */}
          <div style={{
            flex:           1,
            display:        'flex',
            flexDirection:  'column',
            alignItems:     'center',
            justifyContent: 'center',
            overflowY:      'auto',
            padding:        '32px 24px',
            gap:            24,
            background:     'var(--bg)',
            minWidth:       0,
          }}>
            {viewState === 'done' && content
              ? <CreativePreview content={content} platform={platform} />
              : <StateOverlay state={viewState} error={error} />
            }
          </div>

          {/* ── RIGHT: Copy panel ─────────────────────────────────────────── */}
          <div style={{
            width:        280,
            flexShrink:   0,
            borderLeft:   '1px solid var(--border)',
            background:   'var(--sidebar)',
            overflowY:    'auto',
            padding:      '20px 16px',
          }}>
            {content ? (
              <CopyPanel content={content} platform={platform} />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[70, 90, 55, 80].map((w, i) => (
                  <div key={i} style={{
                    height:       48,
                    borderRadius: 8,
                    background:   'var(--surface)',
                    border:       '1px solid var(--border)',
                    opacity:      0.5,
                    width:        `${w}%`,
                  }} />
                ))}
              </div>
            )}
          </div>

        </div>
  );
}
