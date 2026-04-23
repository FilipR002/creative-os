'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function StudioNav() {
  const path = usePathname();

  return (
    <nav className="studio-nav">
      <Link href="/" className="studio-nav-logo">
        Creative OS
      </Link>
      <ul className="studio-nav-links">
        <li>
          <Link href="/" className={path === '/' ? 'active' : ''}>
            Create
          </Link>
        </li>
        <li>
          <Link href="/history" className={path === '/history' ? 'active' : ''}>
            History
          </Link>
        </li>
        <li>
          <Link href="/insights" className={path === '/insights' ? 'active' : ''}>
            Insights
          </Link>
        </li>
      </ul>
    </nav>
  );
}
