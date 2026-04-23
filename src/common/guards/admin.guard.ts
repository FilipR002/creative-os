import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ADMIN_EMAIL } from '../constants/roles';

// Re-export so existing imports don't break
export { ADMIN_EMAIL };

/**
 * AdminGuard — runs AFTER UserGuard (which already validated the userId).
 *
 * 1. Looks up the user's email in the DB by req.context.userId.
 * 2. If email === ADMIN_EMAIL → sets req.context.role = 'admin' and allows.
 * 3. Otherwise → 403 Forbidden.
 *
 * Applied with @UseGuards(AdminGuard) on the AdminAnalyticsController.
 * Not global — only admin routes pay the DB lookup cost.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req    = ctx.switchToHttp().getRequest();
    const userId = req.context?.userId;

    if (!userId) throw new ForbiddenException('Authentication required.');

    const user = await this.prisma.user.findUnique({
      where:  { id: userId },
      select: { email: true },
    });

    if (!user) throw new ForbiddenException('User not found.');

    if (user.email !== ADMIN_EMAIL) {
      throw new ForbiddenException('Admin access required.');
    }

    // Upgrade role in context for downstream use
    req.context.role  = 'admin';
    req.context.email = user.email;

    return true;
  }
}
