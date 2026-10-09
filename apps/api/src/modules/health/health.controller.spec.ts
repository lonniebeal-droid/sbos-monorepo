import { describe, expect, it, vi } from 'vitest';

import { HealthController } from './health.controller';
import type { PrismaService } from '../../prisma/prisma.service';

describe('HealthController.check', () => {
  it('returns 200 with an ok body when the database responds', async () => {
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
    } as unknown as PrismaService;
    const controller = new HealthController(prisma);
    const response = { status: vi.fn() };

    const result = await controller.check(response as never);

    expect(response.status).toHaveBeenCalledWith(200);
    expect(result).toMatchObject({
      status: 'ok',
      service: 'sbos-api',
      database: { status: 'up' },
    });
    expect(result.database.latencyMs).not.toBeNull();
  });

  it('returns 503 with a degraded body when the database check fails', async () => {
    const prisma = {
      $queryRaw: vi.fn().mockRejectedValue(new Error('db down')),
    } as unknown as PrismaService;
    const controller = new HealthController(prisma);
    const response = { status: vi.fn() };

    const result = await controller.check(response as never);

    expect(response.status).toHaveBeenCalledWith(503);
    expect(result).toMatchObject({
      status: 'degraded',
      service: 'sbos-api',
      database: { status: 'down', latencyMs: null },
    });
  });
});
