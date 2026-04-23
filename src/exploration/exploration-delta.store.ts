// ─── Exploration Delta Store — injectable persistence abstraction ─────────────
//
// Decouples EWMA state from the in-process Map so production deployments can
// swap to a shared store (Redis, DB) without touching ExplorationService logic.
//
// Default: InMemoryExplorationDeltaStore (suitable for single-instance / dev).
// Production: provide a Redis- or DB-backed class via NestJS DI override.

export abstract class ExplorationDeltaStore {
  abstract get(key: string): Promise<number | undefined>;
  abstract set(key: string, value: number): Promise<void>;
}

export class InMemoryExplorationDeltaStore extends ExplorationDeltaStore {
  private readonly map = new Map<string, number>();
  async get(key: string): Promise<number | undefined> { return this.map.get(key); }
  async set(key: string, value: number): Promise<void>  { this.map.set(key, value); }
}
