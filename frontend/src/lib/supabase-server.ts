// ─── Supabase Server Client ───────────────────────────────────────────────────
// Used in Server Components, Route Handlers, and Middleware.
// Reads/writes cookies so sessions persist across SSR.

import { createServerClient } from '@supabase/ssr';
import { cookies }            from 'next/headers';
import type { NextRequest, NextResponse } from 'next/server';

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL  ?? 'https://ienzclyxaciygfnzckkb.supabase.co';
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImllbnpjbHl4YWNpeWdmbnpja2tiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5NzM2NjAsImV4cCI6MjA5MjU0OTY2MH0.Ka-m0sOjpcFeumUBzMPNJv07bqkpRVfXCCqmCkMwXfw';

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    SUPABASE_URL,
    SUPABASE_ANON,
    {
      cookies: {
        getAll:  ()           => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll called from a Server Component — safe to ignore
          }
        },
      },
    },
  );
}

// Used specifically inside Next.js middleware (has access to req/res)
export function createSupabaseMiddlewareClient(
  request:  NextRequest,
  response: NextResponse,
) {
  return createServerClient(
    SUPABASE_URL,
    SUPABASE_ANON,
    {
      cookies: {
        getAll:  ()            => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    },
  );
}
