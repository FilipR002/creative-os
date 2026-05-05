// ─── API Docs — Admin only (Server Component) ────────────────────────────────
// Auth + admin check enforced server-side. The page HTML is never sent to
// unauthenticated or non-admin users — same gate as /admin/* routes.

import { redirect }                  from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import type { Metadata }             from 'next';
import SwaggerUI                     from './SwaggerUI';

export const metadata: Metadata = {
  title: 'API Docs — Creative OS',
};

export default async function ApiDocsPage() {
  const supabase = await createSupabaseServerClient();

  // 1. Must be authenticated
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/api-docs');

  // 2. Must be an admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  if (!profile?.is_admin) redirect('/dashboard');

  return (
    <div className="min-h-screen bg-white">
      <SwaggerUI />
    </div>
  );
}
