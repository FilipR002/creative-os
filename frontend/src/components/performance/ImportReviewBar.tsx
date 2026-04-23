'use client';

interface Props {
  autoMatched:    number;
  manualMatched:  number;
  ignored:        number;
  onConfirm:      () => void;
  confirming:     boolean;
}

export function ImportReviewBar({ autoMatched, manualMatched, ignored, onConfirm, confirming }: Props) {
  const total = autoMatched + manualMatched + ignored;
  const ready = autoMatched + manualMatched;

  return (
    <div style={{
      position:     'sticky',
      bottom:       0,
      background:   'rgba(8,9,16,0.95)',
      backdropFilter: 'blur(12px)',
      borderTop:    '1px solid #1e2330',
      padding:      '16px 0',
      marginTop:    32,
    }}>
      <div style={{
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        gap:            20,
      }}>
        {/* Summary pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, color: '#555', fontWeight: 500 }}>Ready to import:</span>

          {autoMatched > 0 && (
            <Pill color="#22c55e">✔ {autoMatched} auto-matched</Pill>
          )}
          {manualMatched > 0 && (
            <Pill color="#6366f1">✔ {manualMatched} manually matched</Pill>
          )}
          {ignored > 0 && (
            <Pill color="#555">⚠ {ignored} ignored</Pill>
          )}
          {ready === 0 && (
            <span style={{ fontSize: 13, color: '#333' }}>No rows selected yet</span>
          )}
        </div>

        {/* Confirm button */}
        <button
          onClick={onConfirm}
          disabled={confirming || ready === 0}
          style={{
            padding:      '12px 32px',
            background:   ready > 0 ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : '#1a1b22',
            border:       'none',
            borderRadius: 10,
            color:        ready > 0 ? '#fff' : '#333',
            fontWeight:   700,
            fontSize:     14,
            cursor:       confirming || ready === 0 ? 'not-allowed' : 'pointer',
            flexShrink:   0,
            fontFamily:   'inherit',
            transition:   'opacity 0.2s',
          }}
        >
          {confirming ? 'Submitting…' : 'Confirm Import'}
        </button>
      </div>
    </div>
  );
}

function Pill({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span style={{
      fontSize:   12,
      fontWeight: 600,
      color,
      background: `${color}14`,
      border:     `1px solid ${color}30`,
      padding:    '4px 10px',
      borderRadius: 99,
    }}>
      {children}
    </span>
  );
}
