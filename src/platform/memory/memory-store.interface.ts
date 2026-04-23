import { ClientContext } from '../context/client-context.interface';

export interface IMemoryStore {
  get(ctx: ClientContext, key: string): Promise<unknown>;
  set(ctx: ClientContext, key: string, value: unknown, ttlSeconds?: number): Promise<void>;
  query(ctx: ClientContext, filter: MemoryFilter): Promise<unknown[]>;
  delete(ctx: ClientContext, key: string): Promise<void>;
}

export interface MemoryFilter {
  keyPrefix?:  string;
  after?:      Date;
  limit?:      number;
  tags?:       string[];
}

/** Injection token — use instead of the class to allow swapping implementations. */
export const MEMORY_STORE = 'MEMORY_STORE';
