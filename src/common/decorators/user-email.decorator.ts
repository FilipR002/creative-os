import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * @UserEmail() — extracts req.context.email (from the Supabase JWT) into a
 * controller parameter. May be null if the JWT has no email claim.
 *
 * Use alongside @UserId() when you need the verified email for role computation.
 */
export const UserEmail = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | null => {
    return ctx.switchToHttp().getRequest().context.email ?? null;
  },
);
