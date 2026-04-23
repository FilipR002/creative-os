/**
 * RequestContext — single source of truth for caller identity on every request.
 *
 * Populated ONCE by UserGuard before any controller or service runs.
 * Controllers extract via @UserId() decorator.
 * Services receive userId as an explicit string parameter — never re-extract.
 *
 * Future: when JWT replaces the header, only UserGuard changes.
 * Controllers and services are untouched.
 */
export interface RequestContext {
  userId: string;
  email:  string | null;  // null in MVP (header-only); populated from JWT claims later
  role:   'admin' | 'user';  // set by UserGuard default='user'; AdminGuard upgrades to 'admin'
}

/**
 * Augment Express Request so TypeScript knows req.context exists.
 * Import this file once (already done in UserGuard) — the augmentation is global.
 */
declare global {
  namespace Express {
    interface Request {
      context: RequestContext;
    }
  }
}
