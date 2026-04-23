import type { FatigueLevel } from '@/lib/types/view-models';

const CLASS: Record<FatigueLevel, string> = {
  HEALTHY:  'badge badge-healthy',
  WARMING:  'badge badge-warming',
  FATIGUED: 'badge badge-fatigued',
  BLOCKED:  'badge badge-blocked',
};

export function FatigueBadge({ level }: { level: FatigueLevel }) {
  return <span className={CLASS[level]}>{level}</span>;
}
