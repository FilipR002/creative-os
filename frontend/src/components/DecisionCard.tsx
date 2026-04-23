import type { DecisionViewModel } from '@/lib/types/view-models';
import { FatigueBadge }           from './FatigueBadge';
import { SignalBreakdownBars }    from './SignalBreakdownBars';
import { ExplanationPanel }       from './ExplanationPanel';

interface Props {
  vm:        DecisionViewModel;
  isPrimary: boolean;
}

export function DecisionCard({ vm, isPrimary }: Props) {
  return (
    <div className="card" style={{ border: isPrimary ? '1px solid var(--accent)' : undefined }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            {isPrimary && (
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Primary
              </span>
            )}
            <span style={{ fontSize: 16, fontWeight: 700 }}>{vm.angle}</span>
          </div>
          <FatigueBadge level={vm.fatigueLevel} />
        </div>
        <div className="score-large" style={{ color: vm.score >= 70 ? 'var(--success)' : vm.score >= 45 ? 'var(--warning)' : 'var(--danger)' }}>
          {vm.score}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div>
          <div className="card-title">Signal Breakdown</div>
          <SignalBreakdownBars breakdown={vm.breakdown} />
        </div>
        <div>
          <div className="card-title">Explanation</div>
          <ExplanationPanel explanation={vm.explanation} />
        </div>
      </div>

      <div style={{ marginTop: 12, display: 'flex', gap: 12 }}>
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>
          Rank #{vm.rankPosition}
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>
          Confidence {(vm.confidence * 100).toFixed(0)}%
        </div>
      </div>
    </div>
  );
}
