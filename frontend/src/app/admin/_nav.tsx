'use client';
// ─── Admin Sidebar Nav (Client Component) ────────────────────────────────────
// Kept as a client component because it uses usePathname for active link styling.

import { usePathname } from 'next/navigation';

const NAV: { section: string; items: { href: string; label: string }[] }[] = [
  {
    section: 'Observability',
    items: [
      { href: '/admin/observability',                     label: '👁 Obs Hub'            },
      { href: '/admin/observability/live-debug',          label: '🐛 Live Debug'          },
      { href: '/admin/observability/self-improving-loop', label: '🔧 Self-Improving Loop' },
      { href: '/admin/observability/autonomous-mode',     label: '🤖 Autonomous Mode'     },
      { href: '/admin/observability/pro-mode',            label: '🔬 Pro Mode'            },
    ],
  },
  {
    section: 'Registry',
    items: [
      { href: '/app/admin/registry-ui', label: '🗂 Endpoint Registry' },
    ],
  },
];

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <aside style={{ width: 228, flexShrink: 0, background: '#0d0e14', borderRight: '1px solid #1e2330', display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 20 }}>
      {/* Logo */}
      <div style={{ padding: '18px 16px 14px', borderBottom: '1px solid #1e2330' }}>
        <a href="/dashboard" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{ width: 26, height: 26, background: 'linear-gradient(135deg,#ef4444,#f59e0b)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#fff' }}>A</div>
          <span style={{ fontSize: 13, fontWeight: 800, color: '#f0f0f0', letterSpacing: '-0.02em' }}>Admin OS v3</span>
        </a>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 10px', overflowY: 'auto' }}>
        {NAV.map(section => (
          <div key={section.section} style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#2a2b30', textTransform: 'uppercase', letterSpacing: '0.1em', padding: '0 8px', marginBottom: 6 }}>
              {section.section}
            </div>
            {section.items.map(item => {
              const active = pathname === item.href || (item.href !== '/admin/observability' && pathname.startsWith(item.href));
              return (
                <a
                  key={item.href}
                  href={item.href}
                  style={{
                    display: 'block', padding: '8px 10px', borderRadius: 7, marginBottom: 2,
                    background: active ? 'rgba(99,102,241,0.1)' : 'transparent',
                    color: active ? '#a5b4fc' : '#555',
                    fontWeight: active ? 600 : 400, fontSize: 12,
                    textDecoration: 'none', transition: 'all 0.15s',
                    borderLeft: active ? '2px solid #6366f1' : '2px solid transparent',
                    paddingLeft: active ? 8 : 10,
                  }}
                >
                  {item.label}
                </a>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div style={{ padding: '12px 14px', borderTop: '1px solid #1e2330' }}>
        <a href="/dashboard" style={{ display: 'block', padding: '7px 10px', background: 'rgba(255,255,255,0.03)', border: '1px solid #1e2330', borderRadius: 7, color: '#444', fontSize: 12, textDecoration: 'none', textAlign: 'center' }}>
          ← Back to App
        </a>
      </div>
    </aside>
  );
}
