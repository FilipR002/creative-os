import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector }      from '@nestjs/core';
import * as jwt           from 'jsonwebtoken';
import * as crypto        from 'crypto';
import { IS_PUBLIC_KEY }  from '../decorators/public.decorator';
import { RequestContext } from '../interfaces/request-context.interface';

/**
 * UserGuard — Verifies Supabase JWTs on every request.
 *
 * Supports both algorithms Supabase uses:
 *   • HS256 — older projects, verified with SUPABASE_JWT_SECRET
 *   • ES256 — newer projects, verified via JWKS public key fetched
 *             from <supabase-url>/auth/v1/.well-known/jwks.json
 *
 * JWKS keys are cached for 10 minutes to avoid hammering Supabase.
 * If JWKS fetch fails the request is rejected (fail-closed).
 */

const BLOCKED_ROLES = new Set(['anon', 'service_role']);
const JWKS_CACHE_MS = 10 * 60 * 1000; // 10 minutes

@Injectable()
export class UserGuard implements CanActivate {
  private readonly jwtSecret: string;

  // JWKS cache — keyed by JWKS URL so we handle multi-tenant edge cases
  private jwksCache = new Map<string, { keys: crypto.KeyObject[]; fetchedAt: number }>();

  constructor(private readonly reflector: Reflector) {
    this.jwtSecret = process.env.SUPABASE_JWT_SECRET ?? '';
    if (!this.jwtSecret) {
      console.warn('[UserGuard] SUPABASE_JWT_SECRET not set — HS256 tokens will be rejected.');
    }
  }

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    // ── Allow @Public() routes ──────────────────────────────────────────────
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest();

    // ── Extract Bearer token ────────────────────────────────────────────────
    const authHeader = req.headers['authorization'] as string | undefined;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Authentication required.');
    }
    const token = authHeader.slice(7);

    // ── Peek at the header (no verification yet) to decide algorithm ────────
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded || typeof decoded === 'string') {
      throw new UnauthorizedException('Malformed token.');
    }

    const alg = (decoded.header as { alg?: string }).alg ?? 'HS256';

    let payload: {
      sub?:          string;
      email?:        string;
      role?:         string;
      iss?:          string;
      app_metadata?: { role?: string };
    };

    try {
      if (alg === 'HS256') {
        // ── Symmetric verification ────────────────────────────────────────
        if (!this.jwtSecret) {
          throw new UnauthorizedException('Server misconfiguration: JWT secret not set.');
        }
        // Supabase cloud base64-encodes the secret; try decoded bytes first
        try {
          payload = jwt.verify(token, Buffer.from(this.jwtSecret, 'base64')) as typeof payload;
        } catch {
          payload = jwt.verify(token, this.jwtSecret) as typeof payload;
        }

      } else if (alg === 'ES256' || alg === 'RS256') {
        // ── Asymmetric verification via JWKS ──────────────────────────────
        const iss = (decoded.payload as { iss?: string }).iss;
        if (!iss) throw new UnauthorizedException('Token missing issuer (iss).');

        const jwksUrl = `${iss}/.well-known/jwks.json`;
        const publicKeys = await this.getJWKSKeys(jwksUrl);

        let lastErr: unknown;
        let verified = false;
        for (const key of publicKeys) {
          try {
            payload = jwt.verify(token, key) as typeof payload;
            verified = true;
            break;
          } catch (e) { lastErr = e; }
        }
        if (!verified) {
          const msg = lastErr instanceof Error ? lastErr.message : String(lastErr);
          throw new UnauthorizedException(`Token verification failed: ${msg}`);
        }

      } else {
        throw new UnauthorizedException(`Unsupported JWT algorithm: ${alg}`);
      }
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[UserGuard] Verification error | alg=${alg} | ${msg}`);
      throw new UnauthorizedException('Invalid or expired token. Please sign in again.');
    }

    // ── CRIT-1: reject non-user tokens ───────────────────────────────────────
    if (!payload!.sub || BLOCKED_ROLES.has(payload!.role ?? '')) {
      throw new UnauthorizedException('Token does not represent an authenticated user.');
    }

    const appRole = (payload!.app_metadata?.role ?? 'user') as 'user' | 'admin';
    req.context = {
      userId: payload!.sub,
      email:  payload!.email ?? null,
      role:   appRole,
    } satisfies RequestContext;

    return true;
  }

  // ── JWKS helpers ────────────────────────────────────────────────────────────

  private async getJWKSKeys(url: string): Promise<crypto.KeyObject[]> {
    const cached = this.jwksCache.get(url);
    if (cached && Date.now() - cached.fetchedAt < JWKS_CACHE_MS) {
      return cached.keys;
    }

    console.log(`[UserGuard] Fetching JWKS from ${url}`);
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new UnauthorizedException(`JWKS fetch failed: HTTP ${res.status}`);

    const { keys } = await res.json() as { keys: object[] };
    const cryptoKeys = keys.map(jwk =>
      crypto.createPublicKey({ format: 'jwk', key: jwk as Parameters<typeof crypto.createPublicKey>[0] extends { key: infer K } ? K : never })
    );

    this.jwksCache.set(url, { keys: cryptoKeys, fetchedAt: Date.now() });
    console.log(`[UserGuard] Cached ${cryptoKeys.length} JWKS key(s) from ${url}`);
    return cryptoKeys;
  }
}
