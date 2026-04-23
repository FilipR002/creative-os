import { Inject, Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../../redis/redis.module';
import { ExplorationDeltaStore } from '../exploration-delta.store';

const TTL_SECONDS = 86_400;
const DELTA_MIN   = -0.10;
const DELTA_MAX   =  0.25;
const KEY_PREFIX  = 'explore:delta';

@Injectable()
export class RedisExplorationDeltaStore extends ExplorationDeltaStore {
  private readonly logger = new Logger(RedisExplorationDeltaStore.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {
    super();
  }

  async get(key: string): Promise<number | undefined> {
    try {
      const raw = await this.redis.get(`${KEY_PREFIX}:${key}`);
      if (raw === null) return undefined;
      const parsed = parseFloat(raw);
      return isFinite(parsed) ? parsed : undefined;
    } catch (err) {
      this.logger.warn(`GET failed (${key}): ${(err as Error).message}`);
      return undefined;
    }
  }

  async set(key: string, value: number): Promise<void> {
    const safe = Math.min(DELTA_MAX, Math.max(DELTA_MIN, value));
    try {
      await this.redis.set(`${KEY_PREFIX}:${key}`, safe.toString(), 'EX', TTL_SECONDS);
    } catch (err) {
      this.logger.warn(`SET failed (${key}): ${(err as Error).message}`);
    }
  }
}
