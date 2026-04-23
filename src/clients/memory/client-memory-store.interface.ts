import { ClientContext } from '../../platform/context/client-context.interface';

export interface ClientMemoryStore {
  get(ctx: ClientContext, key: string): Promise<unknown | null>;
  set(ctx: ClientContext, key: string, value: unknown): Promise<void>;
  increment(ctx: ClientContext, key: string, delta: number): Promise<void>;
  query(ctx: ClientContext, filter: ClientMemoryFilter): Promise<unknown[]>;
}

export interface ClientMemoryFilter {
  type?:  string;
  slug?:  string;
  limit?: number;
}

/**
 * Canonical key format: memory:{clientId}:{type}:{slug}
 * Example: memory:client_123:angle:high_intent_hook
 */
export function memoryKey(ctx: ClientContext, type: string, slug: string): string {
  return `memory:${ctx.clientId}:${type}:${slug}`;
}

/** Injection token — swap InMemoryClientMemoryStore for Redis-backed impl without touching consumers. */
export const CLIENT_MEMORY_STORE = 'CLIENT_MEMORY_STORE';
