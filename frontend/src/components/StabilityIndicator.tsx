import type { StabilityState } from '@/lib/types/view-models';

const LABEL: Record<StabilityState, string> = {
  stable:   'Stable',
  warming:  'Warming',
  unstable: 'Unstable',
};

export function StabilityIndicator({ state }: { state: StabilityState }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: 13 }}>
      <span className={`stability-dot ${state}`} />
      {LABEL[state]}
    </span>
  );
}
