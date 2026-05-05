'use client';
import { useState, useEffect } from 'react';
import {
  aggregateAdIntel, getAdPlatformAnalysis, getUnifiedAdInsights, getAllNormalizedAds,
  generateMultiPlatformAd,
  type NormalizedAd, type PlatformAnalysis, type UnifiedAdInsight, type AdPlatform,
} from '@/lib/api/creator-client';

// ─── Constants ────────────────────────────────────────────────────────────────

const PLATFORM_META: Record<AdPlatform, { label: string; icon: string; color: string }> = {
  meta:    { label: 'Meta',    icon: '📘', color: '#1877f2' },
  tiktok:  { label: 'TikTok', icon: '🎵', color: '#fe2c55' },
  google:  { label: 'Google', icon: '🔍', color: '#4285f4' },
  youtube: { label: 'YouTube',icon: '▶',  color: '#ff0000' },
  web:     { label: 'Web',    icon: '🌐', color: '#6b7280' },
};

const EMOTION_COLOR: Record<string, string> = {
  urgency: '#f97316', fear: '#ef4444', desire: '#ec4899',
  social_proof: '#10b981', curiosity: '#8b5cf6', authority: '#06b6d4',
  value: '#f59e0b', neutral: '#6b7280',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function PlatformCard({ pa }: { pa: PlatformAnalysis }) {
  const pm = PLATFORM_META[pa.platform];
  return (
    <div className="intel-panel" style={{ border: `1px solid ${pm.color}33` }}>
      <div className="intel-panel-header">
        <span style={{ fontSize: 20 }}>{pm.icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: pm.color }}>{pm.label}</div>
          <div style={{ fontSize: 10, color: 'var(--muted)' }}>{pa.totalAds} ads analyzed</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>
            {(pa.avgPerformance * 100).toFixed(0)}%
          </div>
          <div style={{ fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase' }}>Avg score</div>
        </div>
      </div>
      <div style={{ padding: '10px 14px' }}>
        {/* Saturation bar */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
            <span style={{ fontSize: 10, color: 'var(--muted)' }}>Saturation</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: pa.saturationIndex > 0.6 ? 'var(--rose)' : 'var(--emerald)' }}>
              {(pa.saturationIndex * 100).toFixed(0)}%
            </span>
          </div>
          <div style={{ background: 'var(--border)', borderRadius: 99, height: 3 }}>
            <div style={{ width: `${pa.saturationIndex * 100}%`, height: '100%', borderRadius: 99, background: pa.saturationIndex > 0.6 ? '#ef4444' : '#10b981' }} />
          </div>
        </div>
        {/* Top emotions */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
          {pa.topEmotions.slice(0, 3).map(e => (
            <span key={e.emotion} className="badge"
              style={{ background: `${EMOTION_COLOR[e.emotion] ?? '#6b7280'}18`, color: EMOTION_COLOR[e.emotion] ?? '#6b7280' }}>
              {e.emotion} ×{e.count}
            </span>
          ))}
        </div>
        {/* Top hook */}
        {pa.topHooks[0] && (
          <div style={{ fontSize: 11, color: 'var(--sub)', fontStyle: 'italic' }}>
            "{pa.topHooks[0].slice(0, 70)}"
          </div>
        )}
      </div>
    </div>
  );
}

function AdRow({ ad }: { ad: NormalizedAd }) {
  const pm = PLATFORM_META[ad.platform];
  const ec = EMOTION_COLOR[ad.emotionalTrigger] ?? '#6b7280';
  return (
    <div style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <span style={{ fontSize: 16, flexShrink: 0 }}>{pm.icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{ad.hook.slice(0, 90)}</div>
        <div style={{ display: 'flex', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
          <span className="badge" style={{ background: `${pm.color}18`, color: pm.color }}>{pm.label}</span>
          <span className="badge" style={{ background: `${ec}18`, color: ec }}>{ad.emotionalTrigger}</span>
          <span className="badge" style={{ background: 'var(--surface-2)', color: 'var(--muted)', border: '1px solid var(--border)' }}>{ad.creativeFormat}</span>
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: ad.estimatedPerformance > 0.65 ? 'var(--emerald)' : ad.estimatedPerformance > 0.35 ? 'var(--amber)' : 'var(--rose)' }}>
          {(ad.estimatedPerformance * 100).toFixed(0)}%
        </div>
        <div style={{ fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase' }}>Score</div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdIntelligencePage() {
  const [tab, setTab]           = useState<'overview' | 'platforms' | 'patterns' | 'generator'>('overview');
  const [platforms, setPlatforms] = useState<PlatformAnalysis[]>([]);
  const [insights, setInsights] = useState<UnifiedAdInsight | null>(null);
  const [ads, setAds]           = useState<NormalizedAd[]>([]);
  const [loading, setLoading]   = useState(true);
  const [aggregating, setAggregating] = useState(false);

  // Generator form
  const [genHook, setGenHook]         = useState('');
  const [genEmotion, setGenEmotion]   = useState('curiosity');
  const [genBrand, setGenBrand]       = useState('');
  const [genResult, setGenResult]     = useState<Record<AdPlatform, string> | null>(null);
  const [generating, setGenerating]   = useState(false);

  useEffect(() => {
    Promise.all([
      getAdPlatformAnalysis().catch(() => ({ platforms: [] })),
      getUnifiedAdInsights().catch(() => null),
      getAllNormalizedAds().catch(() => ({ ads: [] })),
    ]).then(([p, ins, a]) => {
      setPlatforms(p.platforms ?? []);
      setInsights(ins);
      setAds(a.ads ?? []);
      setLoading(false);
    });
  }, []);

  async function handleAggregate() {
    setAggregating(true);
    await aggregateAdIntel([]).catch(() => null);
    // Re-fetch after a short delay
    await new Promise(r => setTimeout(r, 1200));
    const [p, ins, a] = await Promise.all([
      getAdPlatformAnalysis().catch(() => ({ platforms: [] })),
      getUnifiedAdInsights().catch(() => null),
      getAllNormalizedAds().catch(() => ({ ads: [] })),
    ]);
    setPlatforms(p.platforms ?? []);
    setInsights(ins);
    setAds(a.ads ?? []);
    setAggregating(false);
  }

  async function handleGenerate() {
    if (!genHook.trim() || !genBrand.trim()) return;
    setGenerating(true);
    const r = await generateMultiPlatformAd(genHook, genEmotion, genBrand).catch(() => null);
    if (r) setGenResult(r.variants as Record<AdPlatform, string>);
    setGenerating(false);
  }

  const platforms5: AdPlatform[] = ['meta', 'tiktok', 'google', 'youtube', 'web'];

  return (
        {/* Nav */}
        <div className="tab-bar" style={{ padding: '0 32px', background: 'var(--surface)', margin: 0, borderBottom: '1px solid var(--border)' }}>
          {(['overview', 'platforms', 'patterns', 'generator'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`tab-btn${tab === t ? ' active' : ''}`}>
              {t === 'overview'   ? '🌐 Overview'         : ''}
              {t === 'platforms'  ? '📊 Platform Analysis' : ''}
              {t === 'patterns'   ? '🧠 Cross-Platform'    : ''}
              {t === 'generator'  ? '🚀 Multi-Platform Gen' : ''}
            </button>
          ))}
          <button onClick={handleAggregate} disabled={aggregating}
            style={{ marginLeft: 'auto', padding: '4px 14px', borderRadius: 6, background: 'var(--indigo)', border: 'none', color: '#fff', fontSize: 12, fontWeight: 700, cursor: aggregating ? 'not-allowed' : 'pointer', opacity: aggregating ? 0.7 : 1, fontFamily: 'inherit', marginBottom: 2 }}>
            {aggregating ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="spin" style={{ width: 10, height: 10, border: '2px solid #ffffff44', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block' }} /> Aggregating…
              </span>
            ) : '⟳ Aggregate'}
          </button>
        </div>

        <div className="page-content">
          {/* Header */}
          <div style={{ marginBottom: 20 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', margin: '0 0 4px' }}>
              🌐 Multi-Platform Ad Intelligence
            </h1>
            <p style={{ fontSize: 12, color: 'var(--sub)' }}>
              Unified intelligence across Meta · TikTok · Google · YouTube · Landing Pages — tagged{' '}
              <code style={{ fontSize: 10, background: 'var(--surface-2)', padding: '1px 5px', borderRadius: 3 }}>
                source: multi_platform_intelligence
              </code>
            </p>
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
              <div className="spin" style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--indigo)', borderRadius: '50%' }} />
            </div>
          ) : (
            <>
              {/* ─── TAB: OVERVIEW ───────────────────────────────────────────── */}
              {tab === 'overview' && (
                <>
                  {/* Platform summary grid */}
                  <div className="intel-stats-grid intel-stats-grid-5" style={{ marginBottom: 20 }}>
                    {platforms5.map(platform => {
                      const pa = platforms.find(p => p.platform === platform);
                      const pm = PLATFORM_META[platform];
                      return (
                        <div key={platform} className="intel-stat-card"
                          style={{ border: `1px solid ${pm.color}33`, cursor: 'pointer' }}
                          onClick={() => setTab('platforms')}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                            <span style={{ fontSize: 18 }}>{pm.icon}</span>
                            <span className="intel-stat-label">{pm.label}</span>
                          </div>
                          <div className="intel-stat-value" style={{ fontSize: 18, color: pm.color }}>
                            {pa ? pa.totalAds : '—'}
                          </div>
                          {pa && <div style={{ fontSize: 9, color: 'var(--muted)', marginTop: 2 }}>
                            {(pa.avgPerformance * 100).toFixed(0)}% avg · {(pa.saturationIndex * 100).toFixed(0)}% sat
                          </div>}
                        </div>
                      );
                    })}
                  </div>

                  {/* Two-column: global score + top patterns */}
                  {insights && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16, marginBottom: 20 }}>
                      <div className="intel-panel">
                        <div className="intel-panel-header">
                          <span className="section-label" style={{ margin: 0 }}>🏆 Global Score</span>
                        </div>
                        <div style={{ padding: 20, textAlign: 'center' }}>
                          <div style={{ fontSize: 48, fontWeight: 900, color: 'var(--indigo-l)', lineHeight: 1 }}>
                            {(insights.globalPerformanceScore * 100).toFixed(0)}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>/ 100 cross-platform score</div>
                          {insights.recommendedPlatforms.slice(0, 2).map(rp => (
                            <div key={rp.platform} style={{ marginTop: 12, padding: '6px 10px', background: `${PLATFORM_META[rp.platform].color}0d`, border: `1px solid ${PLATFORM_META[rp.platform].color}22`, borderRadius: 6 }}>
                              <div style={{ fontSize: 11, fontWeight: 700, color: PLATFORM_META[rp.platform].color }}>
                                {PLATFORM_META[rp.platform].icon} {PLATFORM_META[rp.platform].label} recommended
                              </div>
                              <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{rp.reason}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="intel-panel">
                        <div className="intel-panel-header">
                          <span className="section-label" style={{ margin: 0 }}>🧠 Universal Hooks</span>
                        </div>
                        <div style={{ padding: '8px 14px' }}>
                          {insights.topUniversalHooks.slice(0, 6).map((hook, i) => (
                            <div key={i} style={{ padding: '6px 0', borderBottom: '1px solid var(--border)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                              <span style={{ fontSize: 11, color: 'var(--indigo-l)', fontWeight: 700, flexShrink: 0 }}>#{i + 1}</span>
                              <span style={{ fontSize: 11, color: 'var(--sub)', fontStyle: 'italic' }}>"{hook.slice(0, 100)}"</span>
                            </div>
                          ))}
                          {insights.topUniversalHooks.length === 0 && (
                            <div style={{ fontSize: 11, color: 'var(--muted)', padding: '8px 0' }}>
                              Aggregate data to see cross-platform patterns
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Top ads table */}
                  <div className="section-label" style={{ marginBottom: 10 }}>
                    Top Performing Ads — All Platforms ({ads.length})
                  </div>
                  <div className="intel-panel">
                    <div style={{ padding: '0 14px' }}>
                      {ads.length === 0 ? (
                        <div style={{ fontSize: 12, color: 'var(--muted)', padding: '16px 0', textAlign: 'center' }}>
                          No ads yet — run competitor analysis first, then click Aggregate
                        </div>
                      ) : (
                        ads.slice(0, 15).map(ad => <AdRow key={ad.id} ad={ad} />)
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* ─── TAB: PLATFORMS ──────────────────────────────────────────── */}
              {tab === 'platforms' && (
                <>
                  <div className="section-label" style={{ marginBottom: 12 }}>Platform Comparison Grid</div>
                  {platforms.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)' }}>
                      <div style={{ fontSize: 36, marginBottom: 8 }}>📊</div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>No platform data yet</div>
                      <div style={{ fontSize: 11, marginBottom: 16 }}>Run competitor analysis then click Aggregate</div>
                      <button onClick={handleAggregate} disabled={aggregating}
                        style={{ padding: '8px 20px', borderRadius: 7, background: 'var(--indigo)', border: 'none', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                        ⟳ Aggregate Now
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
                      {platforms.map(pa => <PlatformCard key={pa.platform} pa={pa} />)}
                    </div>
                  )}
                  {/* Saturation map */}
                  {platforms.length > 0 && (
                    <>
                      <div className="section-label" style={{ margin: '24px 0 12px' }}>⚠ Platform Saturation Map</div>
                      <div className="intel-panel">
                        <div style={{ padding: 14 }}>
                          {platforms.map(pa => {
                            const pm = PLATFORM_META[pa.platform];
                            return (
                              <div key={pa.platform} style={{ marginBottom: 12 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                  <span style={{ fontSize: 12, fontWeight: 600, color: pm.color }}>
                                    {pm.icon} {pm.label}
                                  </span>
                                  <span style={{ fontSize: 11, fontWeight: 700, color: pa.saturationIndex > 0.6 ? 'var(--rose)' : pa.saturationIndex > 0.4 ? 'var(--amber)' : 'var(--emerald)' }}>
                                    {pa.saturationIndex > 0.6 ? '⚠ Saturated' : pa.saturationIndex > 0.4 ? '⟳ Filling' : '✓ Opportunity'}
                                  </span>
                                </div>
                                <div style={{ background: 'var(--border)', borderRadius: 99, height: 6 }}>
                                  <div style={{ width: `${pa.saturationIndex * 100}%`, height: '100%', borderRadius: 99, background: pa.saturationIndex > 0.6 ? '#ef4444' : pa.saturationIndex > 0.4 ? '#f59e0b' : '#10b981' }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}

              {/* ─── TAB: PATTERNS ───────────────────────────────────────────── */}
              {tab === 'patterns' && (
                <>
                  <div className="section-label" style={{ marginBottom: 12 }}>Cross-Platform Pattern Viewer</div>
                  {(!insights || insights.crossPlatformPatterns.length === 0) ? (
                    <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)' }}>
                      <div style={{ fontSize: 36, marginBottom: 8 }}>🧠</div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>No cross-platform patterns yet</div>
                      <div style={{ fontSize: 11 }}>Needs data from at least 2 different platforms</div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {insights.crossPlatformPatterns.map((m, i) => {
                        const ec = EMOTION_COLOR[m.emotionalTrigger] ?? '#6b7280';
                        return (
                          <div key={i} className="intel-panel">
                            <div className="intel-panel-header">
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
                                  "{m.hookPattern.slice(0, 90)}"
                                </div>
                                <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                                  <span className="badge" style={{ background: `${ec}18`, color: ec }}>{m.emotionalTrigger}</span>
                                  {m.platforms.map(p => (
                                    <span key={p} className="badge" style={{ background: `${PLATFORM_META[p].color}18`, color: PLATFORM_META[p].color }}>
                                      {PLATFORM_META[p].icon} {PLATFORM_META[p].label}
                                    </span>
                                  ))}
                                </div>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--indigo-l)' }}>
                                  {(m.universalScore * 100).toFixed(0)}%
                                </div>
                                <div style={{ fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase' }}>Universal</div>
                              </div>
                            </div>
                            <div style={{ padding: '8px 14px', display: 'flex', gap: 16, alignItems: 'center' }}>
                              <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                                Migration: <span style={{ color: 'var(--text)', fontWeight: 600 }}>{m.migrationChain}</span>
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                                {m.occurrences} occurrences · {m.platforms.length} platforms
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}

              {/* ─── TAB: GENERATOR ──────────────────────────────────────────── */}
              {tab === 'generator' && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 20 }}>
                    <div>
                      <div className="section-label">Generate Multi-Platform Ad</div>
                      <div className="intel-panel">
                        <div style={{ padding: 16 }}>
                          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>HOOK</label>
                          <input value={genHook} onChange={e => setGenHook(e.target.value)}
                            placeholder="e.g. Stop wasting money on ineffective ads"
                            style={{ width: '100%', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box', marginBottom: 12 }} />
                          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>EMOTIONAL TRIGGER</label>
                          <select value={genEmotion} onChange={e => setGenEmotion(e.target.value)}
                            style={{ width: '100%', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box', marginBottom: 12 }}>
                            {['urgency','fear','desire','social_proof','curiosity','authority','value','neutral'].map(e => (
                              <option key={e} value={e}>{e.replace('_', ' ')}</option>
                            ))}
                          </select>
                          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>BRAND NAME</label>
                          <input value={genBrand} onChange={e => setGenBrand(e.target.value)}
                            placeholder="e.g. Creative OS"
                            style={{ width: '100%', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box', marginBottom: 16 }} />
                          <button onClick={handleGenerate} disabled={generating || !genHook.trim() || !genBrand.trim()}
                            style={{ width: '100%', padding: '10px 0', borderRadius: 8, background: 'var(--indigo)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: generating ? 'not-allowed' : 'pointer', opacity: generating ? 0.7 : 1, fontFamily: 'inherit' }}>
                            {generating ? '⟳ Generating...' : '🚀 Generate Multi-Platform Ad'}
                          </button>
                          <div style={{ marginTop: 12, fontSize: 10, color: 'var(--muted)', lineHeight: 1.5 }}>
                            Generates platform-optimized variants for Meta, TikTok, Google, YouTube + Web. Tagged source: multi_platform_intelligence.
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      {genResult ? (
                        <>
                          <div className="section-label" style={{ marginBottom: 12 }}>Generated Variants</div>
                          {(['meta', 'tiktok', 'google', 'youtube', 'web'] as AdPlatform[]).map(platform => {
                            const pm  = PLATFORM_META[platform];
                            const txt = genResult[platform] ?? '';
                            return (
                              <div key={platform} className="intel-panel" style={{ marginBottom: 12, border: `1px solid ${pm.color}33` }}>
                                <div className="intel-panel-header">
                                  <span style={{ fontSize: 18 }}>{pm.icon}</span>
                                  <span style={{ fontSize: 13, fontWeight: 700, color: pm.color }}>{pm.label}</span>
                                  <span className="badge" style={{ marginLeft: 'auto', background: `${pm.color}18`, color: pm.color }}>
                                    {platform === 'meta'    ? 'Feed Ad'       : ''}
                                    {platform === 'tiktok'  ? 'TikTok Video'  : ''}
                                    {platform === 'google'  ? 'Search Ad'     : ''}
                                    {platform === 'youtube' ? 'Pre-Roll'      : ''}
                                    {platform === 'web'     ? 'Landing Page'  : ''}
                                  </span>
                                </div>
                                <div style={{ padding: '10px 14px' }}>
                                  <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6, margin: 0, fontStyle: 'italic' }}>
                                    "{txt}"
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 300, color: 'var(--muted)', gap: 8 }}>
                          <span style={{ fontSize: 36 }}>🚀</span>
                          <span style={{ fontSize: 13, fontWeight: 600 }}>Multi-Platform Ad Generator</span>
                          <span style={{ fontSize: 11 }}>Enter a hook + trigger + brand → get optimized variants for all platforms</span>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
  );
}
