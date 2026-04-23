'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';

const NAV = [
  { label: 'Dashboard',      icon: '⊙', href: '/dashboard' },
  { label: 'Create',         icon: '✦', href: '/create' },
  { label: 'My Campaigns',   icon: '⊞', href: '/campaigns' },
  { label: 'Analytics',      icon: '▦', href: '/analytics' },
  { label: 'Ad Performance', icon: '↗', href: '/ad-performance' },
  { label: 'Settings',       icon: '⚙', href: '/settings' },
  { label: 'Observatory',    icon: '◎', href: '/observatory' },
];

const INTELLIGENCE_NAV = [
  { label: '🤖 Autonomous System', href: '/autonomous'              },
  { label: '🧠 AI Brain Stream',   href: '/ai-stream'               },
  { label: '🔬 Pro Diagnostics',   href: '/pro-mode'                },
  { label: '🗂 System Audit',      href: '/system-audit'            },
  { label: '🕵️ Competitor Intel',  href: '/competitor-intelligence' },
  { label: '🔮 Trend Prediction',  href: '/trends'                  },
  { label: '🌐 Ad Intelligence',   href: '/ad-intelligence'         },
];

const FINANCIAL_OS_NAV = [
  { label: '💰 Financial OS', href: '/financial-os' },
];

const GENERATED_NAV = [
  { label: '✦ Generated Tools', href: '/system-generated' },
];

export function Sidebar() {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === '/dashboard') return pathname === href;
    if (href === '/create')    return pathname === '/create' || pathname === '/ad-builder' || pathname === '/campaigns/new';
    if (href === '/campaigns') return pathname === href || (pathname.startsWith('/campaigns/') && !pathname.startsWith('/campaigns/new'));
    return pathname === href || pathname.startsWith(href + '/');
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <Image src="/logo-icon.png" alt="" width={28} height={28} className="sidebar-logo-img" style={{ objectFit: 'contain' }} />
        <span className="sidebar-logo-text">Creative OS</span>
      </div>

      {/* Main nav */}
      <nav className="sidebar-nav-section">
        <div className="sidebar-nav-label">Menu</div>
        {NAV.map(item => (
          <Link
            key={item.label}
            href={item.href}
            className={`sidebar-nav-item${isActive(item.href) ? ' active' : ''}`}
          >
            <span className="sidebar-nav-icon">{item.icon}</span>
            <span className="sidebar-nav-text">{item.label}</span>
          </Link>
        ))}
      </nav>

      {/* Intelligence Layer */}
      <nav className="sidebar-nav-section" style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 4 }}>
        <div className="sidebar-nav-label" style={{ color: '#6366f1' }}>⚡ Intelligence</div>
        {INTELLIGENCE_NAV.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={`sidebar-nav-item${isActive(item.href) ? ' active' : ''}`}
          >
            <span className="sidebar-nav-text">{item.label}</span>
          </Link>
        ))}
      </nav>

      {/* Financial OS */}
      <nav className="sidebar-nav-section" style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 4 }}>
        <div className="sidebar-nav-label" style={{ color: '#10b981' }}>💰 Financial OS</div>
        {FINANCIAL_OS_NAV.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={`sidebar-nav-item${isActive(item.href) ? ' active' : ''}`}
          >
            <span className="sidebar-nav-text">{item.label}</span>
          </Link>
        ))}
      </nav>

      {/* Auto-Generated Tools */}
      <nav className="sidebar-nav-section" style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 4 }}>
        <div className="sidebar-nav-label" style={{ color: '#8b5cf6' }}>✦ Auto-Generated</div>
        {GENERATED_NAV.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={`sidebar-nav-item${isActive(item.href) ? ' active' : ''}`}
          >
            <span className="sidebar-nav-text">{item.label}</span>
          </Link>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-avatar">F</div>
          <div>
            <div className="sidebar-user-name">Filip Radonjic</div>
            <div className="sidebar-user-email">filipradonjic1@gmail.com</div>
          </div>
        </div>
        <button className="sidebar-signout">Sign out</button>
      </div>
    </aside>
  );
}
