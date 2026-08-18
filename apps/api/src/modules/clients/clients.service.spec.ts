import { NotFoundException } from '@nestjs/common';
import { AuditAction } from '@sbos/database';
import { describe, expect, it, vi } from 'vitest';

import { ClientsService } from './clients.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { AuditService } from '../../audit/audit.service';
import type { EmailProvider } from '../../channels/email.provider';

function makeService(overrides?: { prisma?: Partial<PrismaService> }) {
  const prisma = (overrides?.prisma ?? {}) as PrismaService;
  const audit = { record: vi.fn() } as unknown as AuditService;
  const email = { send: vi.fn() } as unknown as EmailProvider;
  return { service: new ClientsService(prisma, audit, email), audit };
}

describe('ClientsService.remove (soft-delete)', () => {
  it('soft-deletes via update(deletedAt) instead of delete(), and audits it', async () => {
    const existing = { id: 'c1', mrn: 'MRN-1' };
    const prisma = {
      client: {
        findFirst: vi.fn().mockResolvedValue(existing),
        update: vi.fn().mockResolvedValue({ ...existing, deletedAt: new Date() }),
        delete: vi.fn(),
      },
    } as unknown as PrismaService;
    const { service, audit } = makeService({ prisma });

    const result = await service.remove('org1', 'actor1', 'c1');

    expect(prisma.client.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { deletedAt: expect.any(Date) },
    });
    expect(prisma.client.delete).not.toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org1',
        actorId: 'actor1',
        action: AuditAction.DELETE,
        entityType: 'Client',
        entityId: 'c1',
        metadata: expect.objectContaining({ mrn: 'MRN-1', softDelete: true }),
      }),
    );
    expect(result).toEqual({ success: true });
  });

  it('throws NotFoundException when the client is already soft-deleted', async () => {
    const prisma = {
      client: { findFirst: vi.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;
    const { service, audit } = makeService({ prisma });

    await expect(service.remove('org1', 'actor1', 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(audit.record).not.toHaveBeenCalled();
  });
});

describe('ClientsService.findOne (soft-delete visibility)', () => {
  it('excludes soft-deleted clients by default', async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const prisma = { client: { findFirst } } as unknown as PrismaService;
    const { service } = makeService({ prisma });

    await expect(service.findOne('org1', 'c1')).rejects.toBeInstanceOf(NotFoundException);
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'c1', organizationId: 'org1', deletedAt: null }),
      }),
    );
  });

  it('includes soft-deleted clients when includeDeleted=true', async () => {
    const client = { id: 'c1', deletedAt: new Date() };
    const findFirst = vi.fn().mockResolvedValue(client);
    const prisma = { client: { findFirst } } as unknown as PrismaService;
    const { service } = makeService({ prisma });

    const result = await service.findOne('org1', 'c1', true);

    expect(result).toBe(client);
    const where = findFirst.mock.calls[0][0].where;
    expect(where).not.toHaveProperty('deletedAt');
  });
});

describe('ClientsService.findAll (soft-delete filtering)', () => {
  it('excludes soft-deleted clients by default', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const count = vi.fn().mockResolvedValue(0);
    const prisma = { client: { findMany, count } } as unknown as PrismaService;
    const { service } = makeService({ prisma });

    await service.findAll('org1', { page: 1, limit: 20 } as never);

    const where = findMany.mock.calls[0][0].where;
    expect(where.deletedAt).toBeNull();
  });

  it('omits the deletedAt filter when includeDeleted=true', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const count = vi.fn().mockResolvedValue(0);
    const prisma = { client: { findMany, count } } as unknown as PrismaService;
    const { service } = makeService({ prisma });

    await service.findAll('org1', { page: 1, limit: 20 } as never, true);

    const where = findMany.mock.calls[0][0].where;
    expect(where).not.toHaveProperty('deletedAt');
  });
});
