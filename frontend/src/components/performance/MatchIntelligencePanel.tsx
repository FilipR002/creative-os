'use client';

interface Stats {
  total:      number;
  matched:    number;
  unmatched:  number;
  confidence: number;
}

interface Props {
  stats:         Stats;
  selectedCount: number;
  ignoredCount:  number;
  onConfirm:     () => void;
  confirming:    boolean;
}

export function MatchIntelligencePanel({ stats, selectedCount, ignoredCount, onConfirm, confirming }: Props) {
  const pct       = Math.round(stats.confidence * 100);
  const readyRows = stats.matched + selectedCount;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Match summary */}
      <div style={{
        background:   '#0d0e14',
        border:       '1px solid #1e2330',
        borderRadius: 12,
        padding:      '18px 20px',
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#333', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>
          Match Analysis
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <StatRow label="Total rows"  value={stats.total}     color="#888" />
          <StatRow label="Auto-matched" value={stats.matched}  color="#22c55e" />
          <StatRow label="Unmatched"   value={stats.unmatched} color="#ef4444" />
          {selectedCount > 0 && (
            <StatRow label="Manually assigned" value={selectedCount} color="#6366f1" />
          )}
          {ignoredCount > 0 && (
            <StatRow label="Ignored" value={ignoredCount} color="#555" />
          )}
        </div>
      </div>

      {/* Confidence bar */}
      <div style={{
        background:   '#0d0e14',
        border:       '1px solid #1e2330',
        borderRadius: 12,
        padding:      '18px 20px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#333', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Confidence
          </div>
          <div style={{
            fontSize:   18,
            fontWeight: 800,
            color:      pct >= 80 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444',
          }}>
            {pct}%
          </div>
        </div>

        <div style={{ height: 6, background: '#1e2330', borderRadius: 99, overflow: 'hidden' }}>
          <div style={{
            height:     '100%',
            width:      `${pct}%`,
            background: pct >= 80 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444',
            borderRadius: 99,
            transition: 'width 0.6s cubic-bezier(0.4,0,0.2,1)',
          }} />
        </div>

        <div style={{ marginTop: 8, fontSize: 11, color: '#444' }}>
          {pct >= 80
            ? 'Excellent — most ads have tracking IDs'
            : pct >= 50
            ? 'Partial — add tracking IDs to improve matching'
            : 'Low — add ?co_id= to your ad landing page URLs'}
        </div>
      </div>

      {/* Tracking tip */}
      {stats.unmatched > 0 && (
        <div style={{
          background:   'rgba(99,102,241,0.06)',
          border:       '1px solid rgba(99,102,241,0.15)',
          borderRadius: 12,
          padding:      '14px 16px',
          fontSize:     12,
          color:        '#666',
          lineHeight:   1.6,
        }}>
          <div style={{ fontWeight: 600, color: '#a5b4fc', marginBottom: 4 }}>💡 Add tracking to future ads</div>
          Append <code style={{ background: '#0a0b10', padding: '1px 5px', borderRadius: 4, color: '#a5b4fc' }}>?co_id=YOUR_CREATIVE_ID</code> to landing page URLs to auto-match next time.
        </div>
      )}

      {/* Confirm button */}
      <button
        onClick={onConfirm}
        disabled={confirming || readyRows === 0}
        style={{
          width:        '100%',
          padding:      '14px',
          background:   readyRows > 0 ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : '#1a1b22',
          border:       'none',
          borderRadius: 10,
          color:        readyRows > 0 ? '#fff' : '#333',
          fontWeight:   700,
          fontSize:     14,
          cursor:       confirming || readyRows === 0 ? 'not-allowed' : 'pointer',
          transition:   'all 0.2s',
          fontFamily:   'inherit',
        }}
      >
        {confirming ? 'Submitting…' : `Confirm Import (${readyRows} rows)`}
      </button>

    </div>
  );
}

function StatRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 13, color: '#555' }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 700, color }}>{value}</span>
    </div>
  );
}
