/**
 * Single source of truth for admin identity.
 *
 * Upgrade path: when JWTs land, role will be embedded in the token payload
 * and this constant becomes a seeding utility only. No other file changes needed.
 */
export const ADMIN_EMAIL = 'filipradonjic1@gmail.com';

/** Derive role from a user's email. Pure function — no DB, no side effects. */
export function computeRole(email: string | null | undefined): 'admin' | 'user' {
  return email === ADMIN_EMAIL ? 'admin' : 'user';
}
