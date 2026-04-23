// ─── Auth Callback Route ──────────────────────────────────────────────────────
// Supabase redirects here after email confirmation with a `code` param.
// We exchange it for a session, then redirect the user into the app.

import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClient }     from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/app/dashboard';

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Redirect to the app — use production origin if behind a proxy
      const forwardedHost = request.headers.get('x-forwarded-host');
      const isLocalEnv    = process.env.NODE_ENV === 'development';

      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`);
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`);
      } else {
        return NextResponse.redirect(`${origin}${next}`);
      }
    }
  }

  // Something went wrong — send to login with an error hint
  return NextResponse.redirect(`${origin}/login?error=confirmation_failed`);
}
