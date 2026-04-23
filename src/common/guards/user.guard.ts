import {
  CanActivate,
  ExecutionContext,
  Injectable,
  BadRequestException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RequestContext } from '../interfaces/request-context.interface';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * UserGuard — THE ONLY PLACE that reads caller identity from the transport layer.
 *
 * MVP mode  : reads x-user-id header (token = userId UUID).
 * Production: swap header read for JWT decode here — zero other files change.
 *
 * Skips automatically for routes decorated with @Public().
 * Sets req.context (RequestContext) — consumed via @UserId() decorator.
 */
@Injectable()
export class UserGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    // ── Allow @Public() routes through without auth ───────────────────────
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req    = ctx.switchToHttp().getRequest();
    const userId = req.headers['x-user-id'];

    if (!userId || typeof userId !== 'string' || !userId.trim()) {
      throw new BadRequestException(
        'x-user-id header is required. Pass your user UUID with every request.',
      );
    }

    // ── Single assignment — only write to request identity ────────────────
    const context: RequestContext = {
      userId: userId.trim(),
      email:  null,   // populated from JWT claims in production
      role:   'user', // AdminGuard upgrades this to 'admin' for /api/admin/* routes
    };

    req.context = context;
    return true;
  }
}
