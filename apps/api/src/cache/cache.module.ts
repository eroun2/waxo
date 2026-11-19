import { Global, Injectable, Logger, Module, OnApplicationShutdown } from '@nestjs/common';
import IORedis from 'ioredis';

/** Fail-fast Redis cache: if Redis is down, queries just run uncached instead of hanging. */
@Injectable()
export class CacheService implements OnApplicationShutdown {
  private log = new Logger('Cache');
  private redis = new IORedis(process.env.REDIS_URL!, { maxRetriesPerRequest: 1, enableOfflineQueue: false, lazyConnect: false })
    .on('error', (e) => this.log.warn(`Redis: ${e.message}`));

  async remember<T>(key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T> {
    const k = `waxo:${key}`;
    try {
      const hit = await this.redis.get(k);
      if (hit) return JSON.parse(hit) as T;
    } catch { /* uncached */ }
    const value = await fn();
    try { await this.redis.set(k, JSON.stringify(value), 'EX', ttlSeconds); } catch { /* ignore */ }
    return value;
  }

  /** Drop cached discovery data after admin changes (featured items, districts, genres). */
  async invalidate() {
    try {
      const keys = await this.redis.keys('waxo:*');
      if (keys.length) await this.redis.del(...keys);
    } catch { /* cache is best-effort */ }
  }

  async onApplicationShutdown() { this.redis.disconnect(); }
}

@Global()
@Module({ providers: [CacheService], exports: [CacheService] })
export class CacheModule {}
