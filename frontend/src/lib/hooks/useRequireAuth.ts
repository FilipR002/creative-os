'use client';
// ─── useRequireAuth ───────────────────────────────────────────────────────────
// Drop this in any protected client component.
// If Supabase session is missing → immediate redirect to /login.
// Acts as a reliable client-side gate independent of middleware.

import { useEffect } from 'react';
import { getSupabase } from '@/lib/supabase';

export function useRequireAuth() {
  useEffect(() => {
    getSupabase().auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        const next = encodeURIComponent(window.location.pathname);
        window.location.replace(`/login?next=${next}`);
      }
    });

    // Also listen for sign-out events mid-session
    const { data: { subscription } } = getSupabase().auth.onAuthStateChange(
      (_event, session) => {
        if (!session) {
          const next = encodeURIComponent(window.location.pathname);
          window.location.replace(`/login?next=${next}`);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);
}
