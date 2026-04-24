'use client';
import { useEffect, useState } from 'react';
import { Sidebar } from '@/components/Sidebar';
import {
  getProfitZones,
  executeProfitAction,
  type ProfitZonesResult,
  type ProfitProfile,
} from '@/lib/api/creator-client';

function zoneBadge(zone: string) {
  if (zone === 'SCALE') return { bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.25)', color: 'var(--emerald)', label: 'SCALE' };
  if (zone === 'FIX')   return { bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.25)', color: 'var(--amber)',   label: 'FIX'   };
  return                       { bg: 'rgba(239,68,68,0.1)',  border: 'rgba(239,68,68,0.25)',  color: 'var(--rose)',    label: 'KILL'  };
}

function CampaignRow({ c, requiresApproval }: { c: ProfitProfile; requiresApproval: boolean }) {
  const zone = zoneBadge(c.zone);
  const [acting, setActing] = useState(false);

  async function act(action: 'scale' | 'fix' | 'kill') {
    setActing(true);
    try { await executeProfitAction(c.campaignId, action); }
    catch {}
    finally { setActing(false); }
  }

  return (
    <div style={{ background: 'var(--surface)', border: `1px solid ${zone.border}`, borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 16 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--sub)', marginBottom: 4 }}>{c.campaignId.slice(0,8)}</div>
        <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.4 }}>{c.recommendation}</div>
      </div>
      <div style={{ display: 'flex', gap: 16, flexShrink: 0 }}>
        {[
          { label: 'ROAS',  value: `${c.roas.toFixed(2)}x`, color: c.roas >= 2 ? 'var(--emerald)' : c.roas >= 1 ? 'var(--amber)' : 'var(--rose)' },
          { label: 'ROI',   value: `${c.roi.toFixed(1)}%`,  color: c.roi >= 0 ? 'var(--emerald)' : 'var(--rose)' },
          { label: 'Spend', value: `$${c.spend.toFixed(0)}`, color: 'var(--text)' },
        ].map(m => (
          <div key={m.label} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 2 }}>{m.label}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: m.color, fontFamily: 'var(--mono)' }}>{m.value}</div>
          </div>
        ))}
      </div>
      <span style={{ background: zone.bg, border: `1px solid ${zone.border}`, color: zone.color, fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 5 }}>
        {zone.label}
      </span>
      {!requiresApproval && (
        <div style={{ display: 'flex', gap: 6 }}>
          {(['scale', 'fix', 'kill'] as const).map(a => (
            <button
              key={a}
              disabled={acting}
              onClick={() => act(a)}
              style={{
                fontSize: 10, fontWeight: 700, padding: '4px 8px', borderRadius: 5, cursor: acting ? 'default' : 'pointer',
                background: a === 'scale' ? 'rgba(16,185,129,0.1)' : a === 'fix' ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)',
                border: `1px solid ${a === 'scale' ? 'rgba(16,185,129,0.3)' : a === 'fix' ? 'rgba(245,158,11,0.3)' : 'rgba(239,68,68,0.3)'}`,
                color: a === 'scale' ? 'var(--emerald)' : a === 'fix' ? 'var(--amber)' : 'var(--rose)',
              }}
            >
              {a.toUpperCase()}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ProfitZonesPage() {
  const [data,    setData]    = useState<ProfitZonesResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    getProfitZones()
      .then(setData)
      .catch(e => setError(e?.message ?? 'Failed to load data'))
      .finally(() => setLoading(false));
  }, []);

  const ZONE_ORDER: Array<'SCALE' | 'FIX' | 'KILL'> = ['SCALE', 'FIX', 'KILL'];

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-main">
        <div className="page-content">

          <div style={{ marginBottom: 24 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', margin: '0 0 4px' }}>Profit Zones</h1>
            <p style={{ fontSize: 12, color: 'var(--sub)', margin: 0 }}>
              Scale winners, fix underperformers, kill waste
            </p>
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
          ) : data && (
            <>
              {/* Summary */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 20 }}>
                {[
                  { label: 'Scale potential', value: `$${data.summary.scalePotential.toFixed(0)}`, color: 'var(--emerald)' },
                  { label: 'Total waste',     value: `$${data.summary.totalWaste.toFixed(0)}`,     color: 'var(--rose)'    },
                  { label: 'Campaigns',       value: String(data.summary.totalCampaigns),           color: 'var(--text)'    },
                ].map(m => (
                  <div key={m.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>{m.label}</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: m.color, fontFamily: 'var(--mono)' }}>{m.value}</div>
                  </div>
                ))}
              </div>

              {data.executionGate.requiresApproval && (
                <div style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: 'var(--amber)' }}>
                  Approval required (L{data.executionGate.level}): {data.executionGate.message}
                </div>
              )}

              {/* Zone sections */}
              {ZONE_ORDER.map(z => {
                const items: ProfitProfile[] = data.zones[z] ?? [];
                if (items.length === 0) return null;
                const badge = zoneBadge(z);
                return (
                  <div key={z} style={{ marginBottom: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <span style={{ background: badge.bg, border: `1px solid ${badge.border}`, color: badge.color, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 5 }}>{badge.label}</span>
                      <span style={{ fontSize: 11, color: 'var(--muted)' }}>{items.length} campaign{items.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {items.map(c => (
                        <CampaignRow key={c.campaignId} c={c} requiresApproval={data.executionGate.requiresApproval} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
