import { AuditAction } from '@sbos/database';
import { describe, expect, it, vi } from 'vitest';

import { OrganizationsService } from './organizations.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { AuditService } from '../../audit/audit.service';

function makeService(overrides?: { prisma?: Partial<PrismaService> }) {
  const prisma = (overrides?.prisma ?? {}) as PrismaService;
  const audit = { record: vi.fn() } as unknown as AuditService;
  return { service: new OrganizationsService(prisma, audit), audit };
}

describe('OrganizationsService.stats', () => {
  it('excludes soft-deleted clients from the client count', async () => {
    const clientCount = vi.fn().mockResolvedValue(0);
    const prisma = {
      client: { count: clientCount },
      clinician: { count: vi.fn().mockResolvedValue(0) },
      appointment: { count: vi.fn().mockResolvedValue(0) },
      user: { count: vi.fn().mockResolvedValue(0) },
    } as unknown as PrismaService;
    const { service } = makeService({ prisma });

    await service.stats('org1');

    expect(clientCount).toHaveBeenCalledWith({
      where: { organizationId: 'org1', deletedAt: null },
    });
  });
});

describe('OrganizationsService.updateCurrent', () => {
  it('updates the org and records an UPDATE audit entry with before/after context', async () => {
    const before = {
      id: 'org1',
      name: 'Old Name',
      email: 'old@example.com',
      phone: '555-0000',
      timezone: 'America/New_York',
    };
    const after = {
      ...before,
      name: 'New Name',
      email: 'new@example.com',
    };
    const prisma = {
      organization: {
        findUnique: vi.fn().mockResolvedValue(before),
        update: vi.fn().mockResolvedValue(after),
      },
    } as unknown as PrismaService;
    const { service, audit } = makeService({ prisma });

    const result = await service.updateCurrent('org1', 'actor1', {
      name: 'New Name',
      email: 'new@example.com',
    });

    expect(prisma.organization.update).toHaveBeenCalledWith({
      where: { id: 'org1' },
      data: { name: 'New Name', email: 'new@example.com' },
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org1',
        actorId: 'actor1',
        action: AuditAction.UPDATE,
        entityType: 'Organization',
        entityId: 'org1',
        metadata: expect.objectContaining({
          changedFields: expect.arrayContaining(['name', 'email']),
          before: expect.objectContaining({ name: 'Old Name' }),
          after: expect.objectContaining({ name: 'New Name' }),
        }),
      }),
    );
    expect(result).toEqual(after);
  });
});
