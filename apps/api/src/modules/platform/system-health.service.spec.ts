import { describe, expect, it, vi } from 'vitest';

import { SystemHealthService } from './system-health.service';
import type { PrismaService } from '../../prisma/prisma.service';

describe('SystemHealthService.snapshot', () => {
  it('excludes soft-deleted clients from the client count', async () => {
    const clientCount = vi.fn().mockResolvedValue(0);
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
      user: { count: vi.fn().mockResolvedValue(0) },
      client: { count: clientCount },
      appointment: { count: vi.fn().mockResolvedValue(0) },
      note: { count: vi.fn().mockResolvedValue(0) },
      claim: { count: vi.fn().mockResolvedValue(0) },
    } as unknown as PrismaService;
    const service = new SystemHealthService(prisma);

    await service.snapshot('org1');

    expect(clientCount).toHaveBeenCalledWith({
      where: { organizationId: 'org1', deletedAt: null },
    });
  });
});
