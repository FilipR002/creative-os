// ─── Next.js Middleware — Auth + Route Protection ────────────────────────────
// Runs on EVERY request matched by config.matcher.
// Validates Supabase session via cookie (server-side, not client JS).
// Protects /dashboard, /create, /admin and all sub-routes.

import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseMiddlewareClient }  from '@/lib/supabase-server';

// Routes that don't require auth
const PUBLIC_PATHS = ['/', '/login', '/signup', '/api/auth', '/auth/callback'];

// Routes that require is_admin = true
const ADMIN_PATHS = ['/admin', '/api/admin'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Pass through to Next.js with the pathname forwarded as a header
  // so server layouts can read it without moving files into route groups.
  const response = NextResponse.next({ request });
  response.headers.set('x-pathname', pathname);

  // Skip public paths — no session needed
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return response;
  }

  const supabase = createSupabaseMiddlewareClient(request, response);

  // getSession() reads the JWT from the cookie without a network round-trip.
  // More reliable than getUser() in edge middleware (no Supabase API call that
  // can time out or fail silently). Token signature is still validated locally.
  let session = null;
  try {
    const result = await supabase.auth.getSession();
    session = result.data.session;
  } catch {
    // On any error, treat as unauthenticated
    session = null;
  }

  // Not authenticated → redirect to login
  if (!session) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Admin route protection
  if (ADMIN_PATHS.some(p => pathname.startsWith(p))) {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', session.user.id)
        .single();

      if (!profile?.is_admin) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
    } catch {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    // Explicit root + all sub-paths for every protected section.
    // Both forms are required: Next.js /:path* may not match the bare root
    // depending on the version, so we list each root explicitly as well.
    '/dashboard', '/dashboard/:path*',
    '/create',    '/create/:path*',
    '/campaigns', '/campaigns/:path*',
    '/analytics', '/analytics/:path*',
    '/admin',     '/admin/:path*',
    '/autonomous',   '/autonomous/:path*',
    '/financial-os', '/financial-os/:path*',
    '/observatory',  '/observatory/:path*',
    '/settings',     '/settings/:path*',
    '/app',          '/app/:path*',
  ],
};
