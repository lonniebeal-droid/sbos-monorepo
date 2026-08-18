import { describe, expect, it, vi } from 'vitest';

import { AnalyticsService } from './analytics.service';
import type { PrismaService } from '../../prisma/prisma.service';

describe('AnalyticsService.overview', () => {
  it('excludes soft-deleted clients from the activeClients KPI', async () => {
    const clientCount = vi.fn().mockResolvedValue(0);
    const prisma = {
      client: { count: clientCount },
      clinician: { count: vi.fn().mockResolvedValue(0) },
      appointment: { count: vi.fn().mockResolvedValue(0) },
      note: { count: vi.fn().mockResolvedValue(0) },
      task: { count: vi.fn().mockResolvedValue(0) },
      payment: { aggregate: vi.fn().mockResolvedValue({ _sum: { amount: null } }) },
      claim: { aggregate: vi.fn().mockResolvedValue({ _sum: { billedAmount: null } }) },
    } as unknown as PrismaService;
    const service = new AnalyticsService(prisma);

    await service.overview('org1');

    expect(clientCount).toHaveBeenCalledWith({
      where: { organizationId: 'org1', status: 'ACTIVE', deletedAt: null },
    });
  });
});
