import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import type { ThrottlerStorage } from '@nestjs/throttler';

interface ThrottlerStorageRecord {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
}

interface RedisConfig {
  url?: string;
  enabled: boolean;
  connectTimeout: number;
  maxRetriesPerRequest: number;
}

@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage, OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisThrottlerStorage.name);
  private redis: Redis | null = null;
  private readonly memoryStore = new Map<string, ThrottlerStorageRecord>();
  private useMemoryFallback = false;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const redisConfig = this.configService.get<RedisConfig>('redis', { infer: true });

    if (!redisConfig?.enabled || !redisConfig?.url) {
      this.logger.log('Redis rate limiting disabled or REDIS_URL not set. Using in-memory fallback.');
      this.useMemoryFallback = true;
      return;
    }

    try {
      this.redis = new Redis(redisConfig.url, {
        maxRetriesPerRequest: redisConfig.maxRetriesPerRequest ?? 3,
        connectTimeout: redisConfig.connectTimeout ?? 5000,
        lazyConnect: true,
        retryStrategy: (times) => {
          if (times > (redisConfig.maxRetriesPerRequest ?? 3)) {
            this.logger.warn('Redis connection max retries reached. Falling back to in-memory storage.');
            this.useMemoryFallback = true;
            return null;
          }
          return Math.min(times * 200, 2000);
        },
      });

      this.redis.on('error', (err) => {
        this.logger.error(`Redis connection error: ${err.message}. Using in-memory fallback.`);
        this.useMemoryFallback = true;
      });

      this.redis.on('connect', () => {
        this.logger.log('Redis connected for distributed rate limiting');
        this.useMemoryFallback = false;
      });

      await this.redis.connect();
    } catch (error) {
      this.logger.warn(`Failed to initialize Redis: ${error instanceof Error ? error.message : String(error)}. Using in-memory fallback.`);
      this.useMemoryFallback = true;
      if (this.redis) {
        await this.redis.quit().catch(() => {});
        this.redis = null;
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.redis) {
      await this.redis.quit().catch(() => {});
      this.redis = null;
    }
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const prefixedKey = `throttler:${throttlerName}:${key}`;

    if (this.useMemoryFallback || !this.redis) {
      return this.incrementMemory(prefixedKey, ttl, limit, blockDuration);
    }

    try {
      return await this.incrementRedis(prefixedKey, ttl, limit, blockDuration);
    } catch (error) {
      this.logger.warn(`Redis increment failed: ${error instanceof Error ? error.message : String(error)}. Falling back to in-memory.`);
      this.useMemoryFallback = true;
      return this.incrementMemory(prefixedKey, ttl, limit, blockDuration);
    }
  }

  private async incrementRedis(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
  ): Promise<ThrottlerStorageRecord> {
    const now = Date.now();
    const windowStart = now - ttl;

    const multi = this.redis!.multi();

    multi.zremrangebyscore(key, 0, windowStart);
    multi.zcard(key);
    multi.zadd(key, now, `${now}:${Math.random()}`);
    multi.expire(key, Math.ceil(ttl / 1000) + 1);

    const results = await multi.exec();

    if (!results) {
      throw new Error('Redis multi exec returned null');
    }

    const totalHits = (results[1]?.[1] as number) + 1;
    const isBlocked = totalHits > limit;
    let timeToBlockExpire = 0;

    if (isBlocked) {
      await this.redis!.zrem(key, `${now}:${Math.random()}`);
      timeToBlockExpire = blockDuration;
    }

    const oldestEntry = await this.redis!.zrange(key, 0, 0, 'WITHSCORES');
    const timeToExpire = oldestEntry.length >= 2 ? parseInt(oldestEntry[1], 10) + ttl - now : ttl;

    return {
      totalHits,
      timeToExpire: Math.max(0, timeToExpire),
      isBlocked,
      timeToBlockExpire,
    };
  }

  private incrementMemory(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
  ): ThrottlerStorageRecord {
    const now = Date.now();
    const windowStart = now - ttl;

    let record = this.memoryStore.get(key);

    if (!record || record.timeToExpire <= 0) {
      record = {
        totalHits: 0,
        timeToExpire: ttl,
        isBlocked: false,
        timeToBlockExpire: 0,
      };
    }

    if (record.isBlocked && record.timeToBlockExpire > 0) {
      record.timeToBlockExpire -= Math.min(100, record.timeToBlockExpire);
      if (record.timeToBlockExpire <= 0) {
        record.isBlocked = false;
        record.totalHits = 0;
      }
    }

    record.totalHits += 1;
    record.timeToExpire = ttl;

    if (record.totalHits > limit) {
      record.isBlocked = true;
      record.timeToBlockExpire = blockDuration;
    }

    this.memoryStore.set(key, record);

    if (this.memoryStore.size > 10000) {
      const entries = Array.from(this.memoryStore.entries());
      entries.sort((a, b) => a[1].timeToExpire - b[1].timeToExpire);
      for (let i = 0; i < entries.length / 2; i++) {
        this.memoryStore.delete(entries[i][0]);
      }
    }

    return record;
  }
}