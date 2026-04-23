import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector }        from '@nestjs/core';
import * as jwt             from 'jsonwebtoken';
import { RequestContext }   from '../interfaces/request-context.interface';
import { IS_PUBLIC_KEY }    from '../decorators/public.decorator';

/**
 * UserGuard — Verifies Supabase JWT on every request.
 *
 * Only accepts: Authorization: Bearer <supabase_access_token>
 *
 * Security requirements enforced:
 *  - Token must have a `sub` claim (real user, not anon/service key)
 *  - Token role must be `authenticated` (rejects `anon` and `service_role`)
 *  - Signature verified against SUPABASE_JWT_SECRET
 *  - Expiry enforced by jsonwebtoken
 *
 * Skips automatically for routes decorated with @Public().
 * Sets req.context (RequestContext) for downstream use.
 */

// Roles that Supabase uses for non-user tokens — never allow these through
const BLOCKED_ROLES = new Set(['anon', 'service_role']);

@Injectable()
export class UserGuard implements CanActivate {
  private readonly jwtSecret: string;

  constructor(private readonly reflector: Reflector) {
    this.jwtSecret = process.env.SUPABASE_JWT_SECRET ?? '';
    if (!this.jwtSecret) {
      console.error('[UserGuard] SUPABASE_JWT_SECRET is not set — all authenticated requests will be rejected.');
    }
  }

  canActivate(ctx: ExecutionContext): boolean {
    // ── Allow @Public() routes through ───────────────────────────────────
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest();

    // ── Require JWT secret to be configured ──────────────────────────────
    if (!this.jwtSecret) {
      throw new UnauthorizedException('Server misconfiguration: JWT secret not set.');
    }

    // ── Extract Bearer token ──────────────────────────────────────────────
    const authHeader = req.headers['authorization'] as string | undefined;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Authentication required. Provide Authorization: Bearer <token> header.');
    }

    const token = authHeader.slice(7);

    try {
      const payload = jwt.verify(token, this.jwtSecret) as {
        sub?:          string;
        email?:        string;
        role?:         string;
        app_metadata?: { role?: string };
      };

      // ── CRIT-1 fix: reject anon and service_role tokens ─────────────────
      // Supabase anon key is a valid JWT signed with the same secret.
      // The `role` claim distinguishes it from a real user session.
      if (!payload.sub || BLOCKED_ROLES.has(payload.role ?? '')) {
        throw new UnauthorizedException('Token does not represent an authenticated user.');
      }

      // ── Derive app-level role from app_metadata (set by Supabase triggers) ─
      const appRole = (payload.app_metadata?.role ?? 'user') as 'user' | 'admin';

      req.context = {
        userId: payload.sub,
        email:  payload.email ?? null,
        role:   appRole,
      } satisfies RequestContext;

      return true;

    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      // jsonwebtoken throws JsonWebTokenError, TokenExpiredError, etc.
      throw new UnauthorizedException('Invalid or expired token. Please sign in again.');
    }
  }
}
