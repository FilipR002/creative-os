'use client';

import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';

// Routes that should NOT have the sidebar (public / auth pages)
const PUBLIC_PREFIXES = ['/', '/login', '/signup', '/onboarding', '/auth', '/api-docs'];

function isPublicRoute(pathname: string) {
  if (pathname === '/') return true;
  return PUBLIC_PREFIXES.slice(1).some(p => pathname === p || pathname.startsWith(p + '/'));
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (isPublicRoute(pathname)) {
    return <>{children}</>;
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-main">{children}</main>
    </div>
  );
}
