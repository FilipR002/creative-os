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

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL  ?? 'https://ienzclyxaciygfnzckkb.supabase.co';
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImllbnpjbHl4YWNpeWdmbnpja2tiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5NzM2NjAsImV4cCI6MjA5MjU0OTY2MH0.Ka-m0sOjpcFeumUBzMPNJv07bqkpRVfXCCqmCkMwXfw';

export function createSupabaseClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON);
}

// Singleton for client components
let _client: ReturnType<typeof createSupabaseClient> | null = null;
export function getSupabase() {
  if (!_client) _client = createSupabaseClient();
  return _client;
}
