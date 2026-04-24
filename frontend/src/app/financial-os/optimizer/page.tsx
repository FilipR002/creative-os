'use client';
import { useEffect, useState } from 'react';
import { Sidebar } from '@/components/Sidebar';
import {
  getProfitZones,
  type ProfitProfile,
} from '@/lib/api/creator-client';

function effLabel(score: number) {
  if (score >= 60) return { label: 'Excellent', color: 'var(--emerald)' };
  if (score >= 40) return { label: 'Good',      color: 'var(--indigo-l)' };
  if (score >= 20) return { label: 'Fair',       color: 'var(--amber)'   };
  return                  { label: 'Waste',      color: 'var(--rose)'    };
}

function zoneBadge(zone: string) {
  if (zone === 'SCALE') return { bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.25)', color: 'var(--emerald)', label: 'SCALE' };
  if (zone === 'FIX')   return { bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.25)', color: 'var(--amber)',   label: 'FIX'   };
  return                       { bg: 'rgba(239,68,68,0.1)',  border: 'rgba(239,68,68,0.25)',  color: 'var(--rose)',    label: 'KILL'  };
}

export default function CostOptimizerPage() {
  const [campaigns, setCampaigns] = useState<ProfitProfile[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [sortBy,    setSortBy]    = useState<'efficiency' | 'roas' | 'spend'>('efficiency');

  useEffect(() => {
    getProfitZones()
      .then(r => {
        const all = [
          ...(r.zones.SCALE ?? []),
          ...(r.zones.FIX ?? []),
          ...(r.zones.KILL ?? []),
        ];
        setCampaigns(all);
      })
      .catch(e => setError(e?.message ?? 'Failed to load data'))
      .finally(() => setLoading(false));
  }, []);

  const sorted = [...campaigns].sort((a, b) => {
    if (sortBy === 'efficiency') return b.efficiencyScore - a.efficiencyScore;
    if (sortBy === 'roas')       return b.roas - a.roas;
    return b.spend - a.spend;
  });

  const wasteList = campaigns.filter(c => c.efficiencyScore < 20);

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-main">
        <div className="page-content">

          <div style={{ marginBottom: 24 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', margin: '0 0 4px' }}>Cost vs Performance Optimizer</h1>
            <p style={{ fontSize: 12, color: 'var(--sub)', margin: 0 }}>
              Efficiency Score = performanceScore / cost — higher is better
            </p>
          </div>

          <div style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.18)', borderRadius: 10, padding: '12px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontSize: 13, color: 'var(--indigo-l)', fontWeight: 700, fontFamily: 'var(--mono)' }}>efficiencyScore = performanceScore / cost</span>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>· scores below 20 flagged as waste</span>
          </div>

          {error && (
            <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.22)', borderRadius: 10, padding: '14px 18px', marginBottom: 16, fontSize: 13, color: 'var(--rose)' }}>
              {error}
            </div>
          )}

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
              <div className="spin" style={{ width: 36, height: 36, border: '3px solid var(--border)', borderTopColor: 'var(--indigo)', borderRadius: '50%' }} />
            </div>
          ) : (
            <>
              {wasteList.length > 0 && (
                <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.22)', borderRadius: 10, padding: '12px 18px', marginBottom: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--rose)', marginBottom: 8 }}>
                    Waste Detected — {wasteList.length} campaign{wasteList.length !== 1 ? 's' : ''} with efficiencyScore &lt; 20
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {wasteList.map(c => (
                      <span key={c.campaignId} style={{ fontSize: 11, fontFamily: 'var(--mono)', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 5, padding: '2px 8px', color: 'var(--rose)' }}>
                        {c.campaignId.slice(0, 8)} · eff: {c.efficiencyScore.toFixed(1)}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>Sort by:</span>
                <div className="tab-bar">
                  {(['efficiency', 'roas', 'spend'] as const).map(s => (
                    <button key={s} className={`tab-btn${sortBy === s ? ' active' : ''}`} onClick={() => setSortBy(s)}>
                      {s === 'efficiency' ? 'Efficiency' : s === 'roas' ? 'ROAS' : 'Spend'}
                    </button>
                  ))}
                </div>
                <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--muted)' }}>{sorted.length} campaigns</span>
              </div>

              {sorted.length === 0 ? (
                <div className="intel-panel" style={{ textAlign: 'center', padding: 48, color: 'var(--muted)', fontSize: 13 }}>
                  No campaign data available yet
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
                  {sorted.map(c => {
                    const eff    = effLabel(c.efficiencyScore);
                    const zone   = zoneBadge(c.zone);
                    const isWaste = c.efficiencyScore < 20;
                    return (
                      <div
                        key={c.campaignId}
                        style={{
                          background: 'var(--surface)',
                          border: `1px solid ${isWaste ? 'rgba(239,68,68,0.3)' : 'var(--border)'}`,
                          borderRadius: 10,
                          padding: 16,
                          transition: 'border-color 0.15s',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                          <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--sub)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {c.campaignId.slice(0, 8)}
                          </span>
                          <span className="badge" style={{ background: zone.bg, border: `1px solid ${zone.border}`, color: zone.color, fontSize: 10 }}>
                            {zone.label}
                          </span>
                          {isWaste && (
                            <span className="badge" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--rose)', fontSize: 10 }}>
                              WASTE
                            </span>
                          )}
                        </div>

                        <div style={{ marginBottom: 12 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{ fontSize: 11, color: 'var(--muted)' }}>Efficiency Score</span>
                            <span style={{ fontSize: 12, fontWeight: 700, color: eff.color }}>{c.efficiencyScore.toFixed(1)}</span>
                          </div>
                          <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${Math.min(c.efficiencyScore, 100)}%`, background: isWaste ? 'var(--rose)' : 'var(--indigo)', borderRadius: 3, transition: 'width 0.4s' }} />
                          </div>
                          <div style={{ fontSize: 10, color: eff.color, marginTop: 3, fontWeight: 600 }}>{eff.label}</div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                          {[
                            { label: 'ROAS',        value: `${c.roas.toFixed(2)}x`,   color: c.roas >= 2 ? 'var(--emerald)' : c.roas >= 1 ? 'var(--amber)' : 'var(--rose)' },
                            { label: 'Performance', value: c.performanceScore.toFixed(1), color: 'var(--indigo-l)' },
                            { label: 'Spend',       value: `$${c.spend.toFixed(2)}`,  color: 'var(--text)' },
                          ].map(m => (
                            <div key={m.label} style={{ textAlign: 'center' }}>
                              <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 2 }}>{m.label}</div>
                              <div style={{ fontSize: 13, fontWeight: 700, color: m.color, fontFamily: 'var(--mono)' }}>{m.value}</div>
                            </div>
                          ))}
                        </div>

                        <div style={{ marginTop: 10, fontSize: 11, color: 'var(--sub)', background: 'rgba(255,255,255,0.03)', borderRadius: 6, padding: '6px 10px', lineHeight: 1.4 }}>
                          {c.recommendation}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
