// ─── Next.js Middleware — Auth + Route Protection ────────────────────────────
// Runs on EVERY request. Validates Supabase session via cookie.
// Protects /dashboard, /create, /admin and all sub-routes.

import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseMiddlewareClient }  from '@/lib/supabase-server';

// Routes that don't require auth
const PUBLIC_PATHS = ['/', '/login', '/signup', '/api/auth'];

// Routes that require is_admin = true
const ADMIN_PATHS = ['/admin', '/api/admin'];

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });
  const { pathname } = request.nextUrl;

  // Skip public paths
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return response;
  }

  const supabase = createSupabaseMiddlewareClient(request, response);

  // Validate session (refreshes token if needed)
  const { data: { user }, error } = await supabase.auth.getUser();

  // Not authenticated → redirect to login
  if (error || !user) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Admin route protection
  if (ADMIN_PATHS.some(p => pathname.startsWith(p))) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (!profile?.is_admin) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    // Match everything except static files, images, favicons
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
