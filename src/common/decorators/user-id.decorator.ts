import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * @UserId() — extracts req.context.userId into a controller parameter.
 *
 * This is the ONLY way controllers should access user identity.
 * Never read req.headers, req.user, or req.userId directly.
 *
 * Usage:
 *   @Get()
 *   findAll(@UserId() userId: string) { ... }
 *
 * The value is guaranteed non-empty — UserGuard rejects the request before
 * this decorator runs if userId is missing or malformed.
 */
export const UserId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    return ctx.switchToHttp().getRequest().context.userId;
  },
);
