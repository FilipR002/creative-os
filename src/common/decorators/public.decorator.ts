import { SetMetadata } from '@nestjs/common';

/**
 * @Public() — marks a route as public (skips UserGuard).
 *
 * Use ONLY on endpoints that must work without authentication:
 *   - POST /api/auth/login
 *   - POST /api/auth/refresh
 *
 * Everything else is protected by default via the global UserGuard.
 */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
