'use client';
import { useEffect, useState } from 'react';
import { Sidebar } from '@/components/Sidebar';
import {
  getCostSummary,
  getProfitZones,
  getAutonomyLevel,
  type CostSummary,
  type ProfitZonesResult,
  type AutonomyInfo,
} from '@/lib/api/creator-client';

function fmt$(n: number) { return `$${n.toFixed(2)}`; }

export default function FinancialOsOverviewPage() {
  const [cost,     setCost]     = useState<CostSummary | null>(null);
  const [zones,    setZones]    = useState<ProfitZonesResult | null>(null);
  const [autonomy, setAutonomy] = useState<AutonomyInfo | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getCostSummary(), getProfitZones(), getAutonomyLevel()])
      .then(([c, z, a]) => { setCost(c); setZones(z); setAutonomy(a); })
      .catch(e => setError(e?.message ?? 'Failed to load data'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-main">
        <div className="page-content">

          <div style={{ marginBottom: 24 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', margin: '0 0 4px' }}>Financial OS — Overview</h1>
            <p style={{ fontSize: 12, color: 'var(--sub)', margin: 0 }}>Live snapshot of costs, profit zones, and AI autonomy</p>
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
              {cost && (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>Cost</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                    {[
                      { label: 'Today',      value: fmt$(cost.totalToday)      },
                      { label: 'This Month', value: fmt$(cost.totalThisMonth)  },
                      { label: 'All Time',   value: fmt$(cost.totalAllTime)    },
                    ].map(m => (
                      <div key={m.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', textAlign: 'center' }}>
                        <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>{m.label}</div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', fontFamily: 'var(--mono)' }}>{m.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {zones && (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>Profit Zones</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
                    {[
                      { label: 'Campaigns',      value: String(zones.summary.totalCampaigns),                color: 'var(--text)'     },
                      { label: 'Scale potential', value: `$${zones.summary.scalePotential.toFixed(0)}`,      color: 'var(--emerald)'  },
                      { label: 'Total waste',     value: `$${zones.summary.totalWaste.toFixed(0)}`,          color: 'var(--rose)'     },
                      { label: 'Gate level',      value: `L${zones.executionGate.level}`,                   color: 'var(--indigo-l)' },
                    ].map(m => (
                      <div key={m.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', textAlign: 'center' }}>
                        <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>{m.label}</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: m.color, fontFamily: 'var(--mono)' }}>{m.value}</div>
                      </div>
                    ))}
                  </div>
                  {zones.executionGate.requiresApproval && (
                    <div style={{ marginTop: 10, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--amber)' }}>
                      Approval required: {zones.executionGate.message}
                    </div>
                  )}
                </div>
              )}

              {autonomy && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>Autonomy</div>
                  <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 20 }}>
                    <div style={{ fontSize: 32, fontWeight: 900, color: 'var(--indigo-l)', fontFamily: 'var(--mono)' }}>L{autonomy.level}</div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{autonomy.label}</div>
                      <div style={{ fontSize: 12, color: 'var(--sub)' }}>{autonomy.desc}</div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
