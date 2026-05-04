'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import { useRequireAuth } from '@/lib/hooks/useRequireAuth';

// ─── Nav structure ────────────────────────────────────────────────────────────

const MAIN_NAV = [
  { label: 'Dashboard',      icon: '⊙', href: '/dashboard'    },
  { label: 'Create',         icon: '✦', href: '/create'        },
  { label: 'My Campaigns',   icon: '⊞', href: '/campaigns'     },
  { label: 'Resources',      icon: '◑', href: '/resources'     },
  { label: 'Analytics',      icon: '▦', href: '/analytics'     },
  { label: 'Ad Performance', icon: '↗', href: '/ad-performance'},
  { label: 'Billing',        icon: '◈', href: '/billing'       },
  { label: 'Settings',       icon: '⚙', href: '/settings'      },
  { label: 'Observatory',    icon: '◎', href: '/observatory'   },
];

const INTELLIGENCE_NAV = [
  { label: 'Autonomous System', href: '/autonomous'              },
  { label: 'AI Brain Stream',   href: '/ai-stream'               },
  { label: 'Pro Diagnostics',   href: '/pro-mode'                },
  { label: 'System Audit',      href: '/system-audit'            },
  { label: 'Competitor Intel',  href: '/competitor-intelligence'   },
  { label: 'Trend Prediction',  href: '/trends'                  },
  { label: 'Ad Intelligence',   href: '/ad-intelligence'         },
];

const FINANCIAL_NAV = [
  { label: 'Overview',        href: '/financial-os'                  },
  { label: 'Cost Tracking',   href: '/financial-os/cost'             },
  { label: 'Optimizer',       href: '/financial-os/optimizer'        },
  { label: 'Profit Zones',    href: '/financial-os/profit'           },
  { label: 'AI CFO',          href: '/financial-os/cfo'              },
  { label: 'Budget',          href: '/financial-os/budget'           },
  { label: 'Revenue',         href: '/financial-os/revenue'          },
  { label: 'Self-Learning',   href: '/financial-os/learning'         },
  { label: 'AI CEO',          href: '/financial-os/ceo'              },
  { label: 'Unit Economics',  href: '/financial-os/unit-economics'   },
];

const TOOLS_NAV = [
  { label: 'Generated Tools', href: '/system-generated' },
];

// ─── Chevron icon ─────────────────────────────────────────────────────────────

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="12" height="12" viewBox="0 0 12 12" fill="none"
      style={{ transition: 'transform 0.2s', transform: open ? 'rotate(90deg)' : 'rotate(0deg)', flexShrink: 0 }}
    >
      <path d="M4 2.5L7.5 6L4 9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Collapsible section ──────────────────────────────────────────────────────

function NavSection({
  label,
  items,
  isActive,
  defaultOpen = false,
}: {
  label: string;
  items: { label: string; href: string }[];
  isActive: (href: string) => boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div style={{ borderTop: '1px solid var(--border)', marginTop: 4 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 12px', background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--muted)', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}
      >
        {label}
        <Chevron open={open} />
      </button>

      {open && (
        <div style={{ paddingBottom: 6 }}>
          {items.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-nav-item${isActive(item.href) ? ' active' : ''}`}
            >
              <span className="sidebar-nav-text">{item.label}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

// ─── Admin gate ───────────────────────────────────────────────────────────────

const ADMIN_IDS = (process.env.NEXT_PUBLIC_ADMIN_USER_IDS ?? '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

function isAdminUser(userId: string): boolean {
  return ADMIN_IDS.includes(userId);
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

export function Sidebar() {
  useRequireAuth();
  const pathname = usePathname();
  const [userInfo,    setUserInfo]    = useState<{ name: string; email: string; initial: string; id: string } | null>(null);
  const [generating,  setGenerating]  = useState(false);

  // ── Generation indicator — listen for cross-page events + restore on mount ──
  useEffect(() => {
    try { setGenerating(!!sessionStorage.getItem('cos_active_job')); } catch {}
    const onStart = () => setGenerating(true);
    const onEnd   = () => setGenerating(false);
    window.addEventListener('cos:generation:start', onStart);
    window.addEventListener('cos:generation:end',   onEnd);
    return () => {
      window.removeEventListener('cos:generation:start', onStart);
      window.removeEventListener('cos:generation:end',   onEnd);
    };
  }, []);

  useEffect(() => {
    const supabase = getSupabase();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        const name = (user.user_metadata?.full_name as string | undefined)
                  ?? user.email?.split('@')[0]
                  ?? 'User';
        setUserInfo({ name, email: user.email ?? '', initial: name[0]?.toUpperCase() ?? 'U', id: user.id });
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const name = (session.user.user_metadata?.full_name as string | undefined)
                  ?? session.user.email?.split('@')[0]
                  ?? 'User';
        setUserInfo({ name, email: session.user.email ?? '', initial: name[0]?.toUpperCase() ?? 'U', id: session.user.id });
      } else {
        setUserInfo(null);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleSignOut() {
    await getSupabase().auth.signOut();
    window.location.href = '/login';
  }

  function isActive(href: string) {
    if (href === '/dashboard')    return pathname === href;
    if (href === '/create')       return pathname === '/create' || pathname === '/ad-builder' || pathname === '/campaigns/new';
    if (href === '/campaigns')    return pathname === href || (pathname.startsWith('/campaigns/') && !pathname.startsWith('/campaigns/new'));
    if (href === '/financial-os') return pathname === href;
    return pathname === href || pathname.startsWith(href + '/');
  }

  // Auto-open the section that contains the current page
  const inIntelligence = INTELLIGENCE_NAV.some(i => pathname.startsWith(i.href));
  const inFinancial    = FINANCIAL_NAV.some(i => isActive(i.href));
  const inTools        = TOOLS_NAV.some(i => pathname.startsWith(i.href));

  return (
    <aside className="sidebar" style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>

      {/* Logo */}
      <Link href="/dashboard" className="sidebar-header" style={{ flexShrink: 0, textDecoration: 'none', cursor: 'pointer' }}>
        <Image src="/logo-icon.png" alt="" width={28} height={28} className="sidebar-logo-img" style={{ objectFit: 'contain' }} />
        <span className="sidebar-logo-text">Creative OS</span>
      </Link>

      {/* Scrollable nav — fills available space between logo and footer */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>

        {/* Main nav — always visible, no dropdown */}
        <nav className="sidebar-nav-section">
          <div className="sidebar-nav-label">Menu</div>
          {MAIN_NAV.map(item => (
            <Link
              key={item.label}
              href={item.href}
              className={`sidebar-nav-item${isActive(item.href) ? ' active' : ''}`}
            >
              <span className="sidebar-nav-icon">{item.icon}</span>
              <span className="sidebar-nav-text">{item.label}</span>
              {item.href === '/create' && generating && (
                <span style={{
                  marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4,
                  fontSize: 9, fontWeight: 700, color: 'var(--indigo-l)',
                  background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)',
                  borderRadius: 99, padding: '2px 7px', whiteSpace: 'nowrap',
                }}>
                  <span style={{
                    width: 5, height: 5, borderRadius: '50%', background: 'var(--indigo-l)',
                    display: 'inline-block',
                    animation: 'pulse-dot 1.2s ease-in-out infinite',
                  }} />
                  Generating
                </span>
              )}
            </Link>
          ))}
        </nav>

        {/* Collapsible sections */}
        <NavSection
          label="Intelligence"
          items={INTELLIGENCE_NAV}
          isActive={isActive}
          defaultOpen={inIntelligence}
        />
        <NavSection
          label="Financial OS"
          items={FINANCIAL_NAV}
          isActive={isActive}
          defaultOpen={inFinancial}
        />
        <NavSection
          label="Tools"
          items={TOOLS_NAV}
          isActive={isActive}
          defaultOpen={inTools}
        />

        {/* Admin OS — only visible to admin users */}
        {isAdminUser(userInfo?.id ?? '') && (
          <div style={{ borderTop: '1px solid var(--border)', marginTop: 4, padding: '8px 10px 6px' }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', padding: '0 2px', marginBottom: 4 }}>
              Admin
            </div>
            <Link
              href="/admin/profit"
              className={`sidebar-nav-item${pathname.startsWith('/admin') ? ' active' : ''}`}
            >
              <span className="sidebar-nav-icon" style={{ fontSize: 13 }}>⚙</span>
              <span className="sidebar-nav-text">Admin OS</span>
            </Link>
          </div>
        )}
      </div>

      {/* Footer — fixed at bottom, always visible */}
      <div className="sidebar-footer" style={{ flexShrink: 0 }}>
        <div className="sidebar-user">
          <div className="sidebar-avatar">{userInfo?.initial ?? '?'}</div>
          <div style={{ minWidth: 0 }}>
            <div className="sidebar-user-name">{userInfo?.name ?? '—'}</div>
            <div className="sidebar-user-email">{userInfo?.email ?? ''}</div>
          </div>
        </div>
        <button className="sidebar-signout" onClick={handleSignOut}>Sign out</button>
      </div>
    </aside>
  );
}
