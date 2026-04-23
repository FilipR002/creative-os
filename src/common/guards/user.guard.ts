import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { Reflector }        from '@nestjs/core';
import * as jwt             from 'jsonwebtoken';
import { RequestContext }   from '../interfaces/request-context.interface';
import { IS_PUBLIC_KEY }    from '../decorators/public.decorator';

/**
 * UserGuard — Verifies Supabase JWT on every request.
 *
 * Primary:  Authorization: Bearer <supabase_access_token>
 * Fallback: x-user-id header (backwards compat during migration)
 *
 * SUPABASE_JWT_SECRET = Supabase Dashboard → Settings → API → JWT Secret
 *
 * Skips automatically for routes decorated with @Public().
 * Sets req.context (RequestContext) for downstream use.
 */
@Injectable()
export class UserGuard implements CanActivate {
  private readonly jwtSecret: string;

  constructor(private readonly reflector: Reflector) {
    this.jwtSecret = process.env.SUPABASE_JWT_SECRET ?? '';
  }

  canActivate(ctx: ExecutionContext): boolean {
    // ── Allow @Public() routes through ───────────────────────────────────
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest();

    // ── Primary: JWT verification ─────────────────────────────────────────
    const authHeader = req.headers['authorization'] as string | undefined;

    if (authHeader?.startsWith('Bearer ') && this.jwtSecret) {
      const token = authHeader.slice(7);
      try {
        const payload = jwt.verify(token, this.jwtSecret) as {
          sub:           string;
          email?:        string;
          role?:         string;
          app_metadata?: { role?: string };
        };

        req.context = {
          userId: payload.sub,
          email:  payload.email ?? null,
          role:   (payload.app_metadata?.role ?? payload.role ?? 'user') as 'user' | 'admin',
        } satisfies RequestContext;

        return true;
      } catch {
        throw new UnauthorizedException('Invalid or expired token. Please sign in again.');
      }
    }

    // ── Fallback: x-user-id (remove after full migration) ────────────────
    const userId = req.headers['x-user-id'];
    if (userId && typeof userId === 'string' && userId.trim()) {
      req.context = {
        userId: userId.trim(),
        email:  null,
        role:   'user',
      } satisfies RequestContext;
      return true;
    }

    // ── Nothing provided ──────────────────────────────────────────────────
    throw new BadRequestException(
      'Authentication required. Provide Authorization: Bearer <token> header.',
    );
  }
}
