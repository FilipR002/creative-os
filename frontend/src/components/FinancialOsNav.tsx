'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const MODULES = [
  { href: '/financial-os',          label: '⊙ Overview',         icon: '💰' },
  { href: '/financial-os/cost',     label: 'Cost Tracking',      icon: '📊' },
  { href: '/financial-os/optimizer',label: 'Optimizer',           icon: '📉' },
  { href: '/financial-os/profit',   label: 'Profit Zones',       icon: '⚠' },
  { href: '/financial-os/cfo',      label: 'AI CFO',             icon: '🧠' },
  { href: '/financial-os/budget',   label: 'Budget',             icon: '🔁' },
  { href: '/financial-os/revenue',  label: 'Revenue',            icon: '📈' },
  { href: '/financial-os/learning', label: 'Self-Learning',      icon: '🧬' },
  { href: '/financial-os/ceo',      label: 'AI CEO',             icon: '🏢' },
  { href: '/financial-os/unit-economics', label: 'Unit Economics', icon: '💎' },
];

interface Props {
  level: number;
  onLevelClick: () => void;
}

const LEVEL_META: Record<number, { color: string; label: string }> = {
  0: { color: '#ef4444', label: '🔴 L0 Analyst'   },
  1: { color: '#f59e0b', label: '🟡 L1 Advisor'   },
  2: { color: '#f97316', label: '🟠 L2 Hybrid'    },
  3: { color: '#10b981', label: '🟢 L3 Autonomous' },
};

export function FinancialOsNav({ level, onLevelClick }: Props) {
  const pathname = usePathname();
  const lm       = LEVEL_META[level] ?? LEVEL_META[0];

  function isActive(href: string) {
    if (href === '/financial-os') return pathname === href;
    return pathname.startsWith(href);
  }

  return (
    <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '0 32px', display: 'flex', alignItems: 'center', gap: 2, overflowX: 'auto' }}>
      {MODULES.map(m => (
        <Link key={m.href} href={m.href}
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '10px 12px', fontSize: 12, fontWeight: isActive(m.href) ? 700 : 500, color: isActive(m.href) ? 'var(--accent-l)' : 'var(--sub)', borderBottom: isActive(m.href) ? '2px solid var(--accent)' : '2px solid transparent', textDecoration: 'none', whiteSpace: 'nowrap', marginBottom: -1, transition: 'color 0.15s' }}>
          <span style={{ fontSize: 13 }}>{m.icon}</span>
          {m.label}
        </Link>
      ))}
      {/* Autonomy level badge — clickable */}
      <button onClick={onLevelClick}
        style={{ marginLeft: 'auto', padding: '4px 12px', borderRadius: 20, background: `${lm.color}18`, border: `1px solid ${lm.color}44`, color: lm.color, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0 }}>
        {lm.label}
      </button>
    </div>
  );
}
