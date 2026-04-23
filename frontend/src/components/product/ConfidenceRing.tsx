// Confidence as a circular SVG arc. No numbers if confidence is 0.

interface Props { value: number; size?: number; }

export function ConfidenceRing({ value, size = 64 }: Props) {
  const r   = (size - 8) / 2;
  const c   = size / 2;
  const len = 2 * Math.PI * r;
  const arc = (value / 100) * len;

  const color = value >= 70 ? '#22c55e' : value >= 45 ? '#f59e0b' : '#6366f1';

  return (
    <div className="confidence-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={c} cy={c} r={r} fill="none" stroke="#1e2330" strokeWidth={6} />
        <circle
          cx={c} cy={c} r={r}
          fill="none"
          stroke={color}
          strokeWidth={6}
          strokeDasharray={`${arc} ${len - arc}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.6s cubic-bezier(0.22, 1, 0.36, 1)' }}
        />
      </svg>
      <div style={{
        position:  'absolute',
        inset:     0,
        display:   'flex',
        alignItems:'center',
        justifyContent: 'center',
        fontSize:  value > 0 ? 14 : 12,
        fontWeight: 700,
        color,
      }}>
        {value > 0 ? `${value}%` : '—'}
      </div>
    </div>
  );
}
