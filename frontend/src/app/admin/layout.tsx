// ─── Admin Layout (Server Component) ─────────────────────────────────────────
// Auth + admin check enforced server-side — no client JS can bypass this.
// The page HTML is never sent to unauthenticated or non-admin users.

import { redirect }                  from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import AdminNav                       from './_nav';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();

  // 1. Must be authenticated
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login?next=/admin');
  }

  // 2. Must be an admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  if (!profile?.is_admin) {
    redirect('/dashboard');
  }

  return (
    <div style={{ minHeight: '100vh', background: '#080910', fontFamily: 'system-ui, sans-serif', color: '#f0f0f0', display: 'flex' }}>
      <AdminNav />
      <main style={{ flex: 1, marginLeft: 228, padding: '36px 44px', minHeight: '100vh', maxWidth: 'calc(100vw - 228px)' }}>
        {children}
      </main>
    </div>
  );
}
