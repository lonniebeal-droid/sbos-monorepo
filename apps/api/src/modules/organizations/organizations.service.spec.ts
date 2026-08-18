import { describe, expect, it, vi } from 'vitest';

import { OrganizationsService } from './organizations.service';
import type { PrismaService } from '../../prisma/prisma.service';

describe('OrganizationsService.stats', () => {
  it('excludes soft-deleted clients from the client count', async () => {
    const clientCount = vi.fn().mockResolvedValue(0);
    const prisma = {
      client: { count: clientCount },
      clinician: { count: vi.fn().mockResolvedValue(0) },
      appointment: { count: vi.fn().mockResolvedValue(0) },
      user: { count: vi.fn().mockResolvedValue(0) },
    } as unknown as PrismaService;
    const service = new OrganizationsService(prisma);

    await service.stats('org1');

    expect(clientCount).toHaveBeenCalledWith({
      where: { organizationId: 'org1', deletedAt: null },
    });
  });
});
