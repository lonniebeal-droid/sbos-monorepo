import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { RedisThrottlerStorage } from './redis-throttler.storage';

describe('RedisThrottlerStorage', () => {
  let storage: RedisThrottlerStorage;
  let mockConfigService: Partial<ConfigService>;

  beforeEach(() => {
    mockConfigService = {
      get: vi.fn((key: string) => {
        if (key === 'redis') {
          return {
            enabled: false,
            url: undefined,
            connectTimeout: 5000,
            maxRetriesPerRequest: 3,
          };
        }
        return undefined;
      }),
    };

    storage = new RedisThrottlerStorage(mockConfigService as ConfigService);
  });

  afterEach(async () => {
    await storage.onModuleDestroy();
  });

  it('should use in-memory fallback when Redis is disabled', async () => {
    await storage.onModuleInit();

    const result = await storage.increment('test-key', 60_000, 5, 60_000, 'default');

    expect(result.totalHits).toBe(1);
    expect(result.isBlocked).toBe(false);
    expect(result.timeToExpire).toBeGreaterThan(0);
  });

  it('should increment hits correctly in memory fallback', async () => {
    await storage.onModuleInit();

    await storage.increment('test-key-2', 60_000, 5, 60_000, 'default');
    await storage.increment('test-key-2', 60_000, 5, 60_000, 'default');
    const result = await storage.increment('test-key-2', 60_000, 5, 60_000, 'default');

    expect(result.totalHits).toBe(3);
    expect(result.isBlocked).toBe(false);
  });

  it('should block when limit exceeded in memory fallback', async () => {
    await storage.onModuleInit();

    for (let i = 0; i < 5; i++) {
      await storage.increment('test-key-3', 60_000, 5, 60_000, 'default');
    }

    const result = await storage.increment('test-key-3', 60_000, 5, 60_000, 'default');

    expect(result.totalHits).toBe(6);
    expect(result.isBlocked).toBe(true);
    expect(result.timeToBlockExpire).toBe(60_000);
  });

  it('should use in-memory fallback when Redis URL is not set', async () => {
    mockConfigService.get = vi.fn((key: string) => {
      if (key === 'redis') {
        return {
          enabled: true,
          url: undefined,
          connectTimeout: 5000,
          maxRetriesPerRequest: 3,
        };
      }
      return undefined;
    });

    storage = new RedisThrottlerStorage(mockConfigService as ConfigService);
    await storage.onModuleInit();

    const result = await storage.increment('test-key-4', 60_000, 5, 60_000, 'default');

    expect(result.totalHits).toBe(1);
    expect(result.isBlocked).toBe(false);
  });
});