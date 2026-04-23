'use client';

import type { PerformanceRow } from '@/lib/api/creator-client';
import { MatchRow } from './MatchRow';

interface Props {
  rows:            PerformanceRow[];
  ignoredIds:      Set<string>;
  onAssign:        (rowId: string, creative: { id: string; label: string }) => void;
  onIgnoreToggle:  (rowId: string) => void;
  onIgnoreAll:     () => void;
}

export function MatchTable({ rows, ignoredIds, onAssign, onIgnoreToggle, onIgnoreAll }: Props) {
  const unmatchedCount = rows.filter(r => r.status === 'unmatched' && !ignoredIds.has(r.id)).length;

  return (
    <div style={{
      background:   '#0d0e14',
      border:       '1px solid #1e2330',
      borderRadius: 12,
      overflow:     'hidden',
    }}>
      {/* Table header */}
      <div style={{
        display:               'grid',
        gridTemplateColumns:   '1fr 140px 80px 80px 200px 90px',
        gap:                   12,
        padding:               '10px 16px',
        borderBottom:          '1px solid #1e2330',
        background:            '#080910',
      }}>
        <ColHead>Ad Name</ColHead>
        <ColHead right>CTR</ColHead>
        <ColHead right>Conv.</ColHead>
        <ColHead right>Impr.</ColHead>
        <ColHead>Status</ColHead>
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
          {unmatchedCount > 0 && (
            <button
              onClick={onIgnoreAll}
              style={{
                fontSize:   10,
                color:      '#444',
                background: 'none',
                border:     'none',
                cursor:     'pointer',
                fontFamily: 'inherit',
                padding:    '2px 6px',
              }}
            >
              Ignore all
            </button>
          )}
        </div>
      </div>

      {/* Rows */}
      {rows.length === 0 ? (
        <div style={{ padding: '32px', textAlign: 'center', color: '#333', fontSize: 13 }}>
          No rows to display.
        </div>
      ) : (
        rows.map(row => (
          <MatchRow
            key={row.id}
            row={row}
            isIgnored={ignoredIds.has(row.id)}
            onAssign={onAssign}
            onIgnoreToggle={onIgnoreToggle}
          />
        ))
      )}
    </div>
  );
}

function ColHead({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <div style={{
      fontSize:   10,
      fontWeight: 700,
      color:      '#333',
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      textAlign:  right ? 'right' : 'left',
    }}>
      {children}
    </div>
  );
}
