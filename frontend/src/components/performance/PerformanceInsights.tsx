'use client';

import { useEffect, useState } from 'react';
import { getPerformanceInsights, type PerformanceInsights as InsightsData } from '@/lib/api/creator-client';

interface Props {
  campaignId?: string;
}

export function PerformanceInsights({ campaignId }: Props) {
  const [data,    setData]    = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    getPerformanceInsights(campaignId)
      .then(setData)
      .catch(e => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [campaignId]);

  if (loading) {
    return (
      <div style={{ padding: '24px', color: '#333', fontSize: 13 }}>Loading insights…</div>
    );
  }

  if (error || !data || data.performers.length === 0) {
    return (
      <div style={{
        padding:      '24px',
        background:   '#0d0e14',
        border:       '1px solid #1e2330',
        borderRadius: 12,
        color:        '#333',
        fontSize:     13,
        textAlign:    'center',
      }}>
        No performance data yet. Import your first CSV to see insights.
      </div>
    );
  }

  const fmtPct   = (n: number) => `${(n * 100).toFixed(2)}%`;
  const fmtScore = (n: number) => `${Math.round(n * 100)}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>

        {/* Top performer */}
        {data.topPerformer && (
          <Card accent="#22c55e">
            <CardIcon>🏆</CardIcon>
            <CardTitle color="#22c55e">Top Performer</CardTitle>
            <CardLabel>{data.topPerformer.label}</CardLabel>
            <CardMetrics>
              <Metric label="CTR"         value={fmtPct(data.topPerformer.ctr)} />
              <Metric label="Conversions" value={String(Math.round(data.topPerformer.conversions))} />
              <Metric label="Score"       value={fmtScore(data.topPerformer.totalScore)} />
            </CardMetrics>
          </Card>
        )}

        {/* Weak performer */}
        {data.weakPerformer && data.weakPerformer.id !== data.topPerformer?.id && (
          <Card accent="#f59e0b">
            <CardIcon>⚠</CardIcon>
            <CardTitle color="#f59e0b">Needs Attention</CardTitle>
            <CardLabel>{data.weakPerformer.label}</CardLabel>
            <CardMetrics>
              <Metric label="CTR"         value={fmtPct(data.weakPerformer.ctr)} />
              <Metric label="Conversions" value={String(Math.round(data.weakPerformer.conversions))} />
              <Metric label="Score"       value={fmtScore(data.weakPerformer.totalScore)} />
            </CardMetrics>
          </Card>
        )}

        {/* AI insight */}
        {data.insight && (
          <Card accent="#6366f1">
            <CardIcon>🧠</CardIcon>
            <CardTitle color="#a5b4fc">Insight</CardTitle>
            <div style={{ fontSize: 14, color: '#ccc', lineHeight: 1.6, marginTop: 6 }}>
              {data.insight}
            </div>
          </Card>
        )}

      </div>

      {/* All performers table */}
      {data.performers.length > 2 && (
        <div style={{
          background:   '#0d0e14',
          border:       '1px solid #1e2330',
          borderRadius: 12,
          overflow:     'hidden',
        }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #1e2330', display: 'grid', gridTemplateColumns: '1fr 100px 100px 80px', gap: 12 }}>
            <ColH>Creative</ColH>
            <ColH right>CTR</ColH>
            <ColH right>Conversions</ColH>
            <ColH right>Score</ColH>
          </div>
          {data.performers.map((p, i) => (
            <div
              key={p.id}
              style={{
                padding:     '10px 16px',
                borderBottom: i < data.performers.length - 1 ? '1px solid #0d0e14' : 'none',
                display:     'grid',
                gridTemplateColumns: '1fr 100px 100px 80px',
                gap:         12,
                alignItems:  'center',
              }}
            >
              <span style={{ fontSize: 13, color: i === 0 ? '#4ade80' : '#888' }}>{p.label}</span>
              <span style={{ fontSize: 13, color: '#888', textAlign: 'right' }}>{fmtPct(p.ctr)}</span>
              <span style={{ fontSize: 13, color: '#888', textAlign: 'right' }}>{Math.round(p.conversions)}</span>
              <span style={{ fontSize: 13, color: '#888', textAlign: 'right' }}>{fmtScore(p.totalScore)}</span>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Card({ children, accent }: { children: React.ReactNode; accent: string }) {
  return (
    <div style={{
      background:   '#0d0e14',
      border:       `1px solid ${accent}28`,
      borderRadius: 12,
      padding:      '18px 20px',
      display:      'flex',
      flexDirection: 'column',
      gap:          6,
    }}>
      {children}
    </div>
  );
}

function CardIcon({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 18, marginBottom: 2 }}>{children}</div>;
}

function CardTitle({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
      {children}
    </div>
  );
}

function CardLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 15, fontWeight: 700, color: '#f0f0f0', marginTop: 2 }}>{children}</div>
  );
}

function CardMetrics({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>{children}</div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: '#444' }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: '#e0e0e0' }}>{value}</div>
    </div>
  );
}

function ColH({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, color: '#333', textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: right ? 'right' : 'left' }}>
      {children}
    </div>
  );
}
