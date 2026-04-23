'use client';

import type { PerformanceRow } from '@/lib/api/creator-client';

interface Props {
  row: PerformanceRow;
}

export function RowExpandedDetails({ row }: Props) {
  const fmtPct  = (n: number) => `${(n * 100).toFixed(2)}%`;
  const fmtNum  = (n: number) => n.toLocaleString();
  const fmtMoney = (n: number) => n > 0 ? `$${n.toFixed(2)}` : '—';

  return (
    <div style={{
      padding:    '14px 16px',
      background: 'rgba(255,255,255,0.02)',
      borderTop:  '1px solid #1e2330',
      display:    'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: 20,
    }}>

      {/* Ad Details */}
      <Section title="Ad Details">
        <Field label="Ad name"     value={row.adName       || '—'} />
        <Field label="Campaign"    value={row.campaignName  || '—'} />
        {row.url && (
          <Field
            label="URL"
            value={
              <span style={{ fontSize: 11, wordBreak: 'break-all', color: '#555' }}>{row.url}</span>
            }
          />
        )}
        {row.extractedTrackingId && (
          <Field
            label="Tracking ID"
            value={
              <code style={{ fontSize: 11, background: 'rgba(99,102,241,0.1)', padding: '1px 6px', borderRadius: 4, color: '#a5b4fc' }}>
                {row.extractedTrackingId}
              </code>
            }
          />
        )}
      </Section>

      {/* Match */}
      <Section title="Match">
        {row.matchedCreative ? (
          <>
            <Field label="Creative"  value={row.matchedCreative.label} />
            <Field
              label="Method"
              value={
                <span style={{ color: '#22c55e', fontSize: 11, fontWeight: 600 }}>
                  ✓ Matched via tracking ID
                </span>
              }
            />
          </>
        ) : (
          <Field
            label="Status"
            value={
              <span style={{ color: '#ef4444', fontSize: 11, fontWeight: 600 }}>
                ✕ Not matched — assign a creative below
              </span>
            }
          />
        )}
      </Section>

      {/* Metrics */}
      <Section title="Metrics">
        <Field label="Impressions"  value={fmtNum(row.metrics.impressions)} />
        <Field label="Clicks"       value={fmtNum(row.metrics.clicks)} />
        <Field label="CTR"          value={fmtPct(row.metrics.ctr)} />
        <Field label="Conversions"  value={fmtNum(row.metrics.conversions)} />
        {row.metrics.revenue > 0 && (
          <Field label="Revenue"    value={fmtMoney(row.metrics.revenue)} />
        )}
      </Section>

    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#333', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{children}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 10, color: '#444' }}>{label}</span>
      <span style={{ fontSize: 13, color: '#ccc' }}>{value}</span>
    </div>
  );
}
