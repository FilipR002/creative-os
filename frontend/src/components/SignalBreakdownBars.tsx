import type { SignalBreakdown } from '@/lib/types/view-models';

const LABELS: [keyof SignalBreakdown, string][] = [
  ['memory',      'Memory'],
  ['scoring',     'Scoring'],
  ['mirofish',    'MIROFISH'],
  ['blending',    'Blending'],
  ['exploration', 'Explore'],
];

export function SignalBreakdownBars({ breakdown }: { breakdown: SignalBreakdown }) {
  return (
    <div className="signal-bar-wrap">
      {LABELS.map(([key, label]) => {
        const value = breakdown[key];
        return (
          <div key={key} className="signal-bar-row">
            <span className="signal-bar-label">{label}</span>
            <div className="signal-bar-track">
              <div className="signal-bar-fill" style={{ width: `${value * 100}%` }} />
            </div>
            <span className="signal-bar-value">{(value * 100).toFixed(0)}%</span>
          </div>
        );
      })}
    </div>
  );
}
