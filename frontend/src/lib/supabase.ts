// ─── Supabase Browser Client ──────────────────────────────────────────────────
// Used in Client Components ('use client') only.
// For Server Components / Route Handlers use supabase-server.ts

import { createBrowserClient } from '@supabase/ssr';

export type UserProfile = {
  id:         string;
  email:      string | null;
  is_admin:   boolean;
  role:       string;
  created_at: string;
};

export function createSupabaseClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

// Singleton for client components
let _client: ReturnType<typeof createSupabaseClient> | null = null;
export function getSupabase() {
  if (!_client) _client = createSupabaseClient();
  return _client;
}
