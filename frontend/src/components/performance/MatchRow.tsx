'use client';

import { useState } from 'react';
import type { PerformanceRow } from '@/lib/api/creator-client';
import { RowExpandedDetails } from './RowExpandedDetails';
import { CreativeSelectorModal } from './CreativeSelectorModal';

interface Props {
  row:           PerformanceRow;
  isIgnored:     boolean;
  onAssign:      (rowId: string, creative: { id: string; label: string }) => void;
  onIgnoreToggle: (rowId: string) => void;
}

export function MatchRow({ row, isIgnored, onAssign, onIgnoreToggle }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const fmtPct   = (n: number) => `${(n * 100).toFixed(2)}%`;
  const fmtNum   = (n: number) => n > 0 ? n.toLocaleString() : '—';

  const statusColor =
    row.status === 'matched' ? '#22c55e'
    : isIgnored             ? '#333'
    :                          '#ef4444';

  const statusIcon =
    row.status === 'matched' ? '✓'
    : isIgnored              ? '—'
    :                          '✕';

  const statusLabel =
    row.status === 'matched'
      ? row.matchedCreative?.label ?? 'Matched'
      : isIgnored
      ? 'Ignored'
      : 'Not matched';

  return (
    <>
      <div
        style={{
          borderBottom:   '1px solid #111318',
          animation:      'cos-row-in 0.25s ease-out',
          opacity:        isIgnored ? 0.4 : 1,
          transition:     'opacity 0.2s',
        }}
      >
        <style>{`@keyframes cos-row-in{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}`}</style>

        {/* Main row */}
        <div
          onClick={() => setExpanded(v => !v)}
          style={{
            display:     'grid',
            gridTemplateColumns: '1fr 140px 80px 80px 200px 90px',
            gap:         12,
            alignItems:  'center',
            padding:     '11px 16px',
            cursor:      'pointer',
            background:  expanded ? 'rgba(255,255,255,0.02)' : 'transparent',
            transition:  'background 0.15s',
          }}
        >
          {/* Ad Name */}
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#e0e0e0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {row.adName || '—'}
            </div>
            <div style={{ fontSize: 11, color: '#444', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {row.campaignName || '—'}
            </div>
          </div>

          {/* CTR */}
          <div style={{ fontSize: 13, color: '#888', textAlign: 'right' }}>
            {row.metrics.ctr > 0 ? fmtPct(row.metrics.ctr) : '—'}
          </div>

          {/* Conversions */}
          <div style={{ fontSize: 13, color: '#888', textAlign: 'right' }}>
            {fmtNum(row.metrics.conversions)}
          </div>

          {/* Impressions */}
          <div style={{ fontSize: 13, color: '#555', textAlign: 'right' }}>
            {fmtNum(row.metrics.impressions)}
          </div>

          {/* Status */}
          <div
            style={{
              display:    'flex',
              alignItems: 'center',
              gap:        7,
              overflow:   'hidden',
            }}
            title={row.status === 'matched' ? 'Matched via tracking ID' : undefined}
          >
            <span style={{ fontSize: 10, color: statusColor, flexShrink: 0 }}>{statusIcon}</span>
            <span style={{ fontSize: 12, color: row.status === 'matched' ? '#4ade80' : isIgnored ? '#555' : '#f87171', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {statusLabel}
            </span>
          </div>

          {/* Actions */}
          <div
            style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}
            onClick={e => e.stopPropagation()}
          >
            {row.status === 'unmatched' && !isIgnored && (
              <button
                onClick={() => setShowModal(true)}
                style={{
                  padding:    '4px 10px',
                  background: 'rgba(99,102,241,0.15)',
                  border:     '1px solid rgba(99,102,241,0.3)',
                  borderRadius: 6,
                  color:      '#a5b4fc',
                  fontSize:   11,
                  fontWeight: 600,
                  cursor:     'pointer',
                  fontFamily: 'inherit',
                  whiteSpace: 'nowrap',
                }}
              >
                Select
              </button>
            )}
            <button
              onClick={() => onIgnoreToggle(row.id)}
              style={{
                padding:    '4px 8px',
                background: 'transparent',
                border:     '1px solid #1e2330',
                borderRadius: 6,
                color:      '#444',
                fontSize:   11,
                cursor:     'pointer',
                fontFamily: 'inherit',
              }}
            >
              {isIgnored ? 'Restore' : 'Ignore'}
            </button>
          </div>
        </div>

        {/* Expanded details */}
        {expanded && <RowExpandedDetails row={row} />}
      </div>

      {showModal && (
        <CreativeSelectorModal
          rowAdName={row.adName}
          onClose={() => setShowModal(false)}
          onSelect={creative => {
            onAssign(row.id, creative);
            setShowModal(false);
          }}
        />
      )}
    </>
  );
}
