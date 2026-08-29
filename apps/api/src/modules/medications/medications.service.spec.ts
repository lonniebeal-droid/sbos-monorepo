import { NotFoundException } from '@nestjs/common';
import { AuditAction } from '@sbos/database';
import { describe, expect, it, vi } from 'vitest';

import { MedicationsService } from './medications.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { AuditService } from '../../audit/audit.service';

function makeService(overrides?: { prisma?: Partial<PrismaService> }) {
  const prisma = (overrides?.prisma ?? {}) as PrismaService;
  const audit = { record: vi.fn() } as unknown as AuditService;
  return { service: new MedicationsService(prisma, audit), audit };
}

describe('MedicationsService.create', () => {
  it('creates a medication only after confirming the client belongs to the org', async () => {
    const created = {
      id: 'm1',
      organizationId: 'org1',
      clientId: 'c1',
      name: 'Sertraline',
    };
    const prisma = {
      client: {
        findFirst: vi.fn().mockResolvedValue({ id: 'c1' }),
      },
      medication: {
        create: vi.fn().mockResolvedValue(created),
      },
    } as unknown as PrismaService;
    const { service } = makeService({ prisma });

    const result = await service.create('org1', {
      clientId: 'c1',
      name: 'Sertraline',
    } as never);

    expect(prisma.client.findFirst).toHaveBeenCalledWith({
      where: { id: 'c1', organizationId: 'org1', deletedAt: null },
      select: { id: true },
    });
    expect(prisma.medication.create).toHaveBeenCalled();
    expect(result).toEqual(created);
  });

  it('throws NotFoundException and never inserts when clientId is outside the org', async () => {
    const prisma = {
      client: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      medication: {
        create: vi.fn(),
      },
    } as unknown as PrismaService;
    const { service } = makeService({ prisma });

    await expect(
      service.create('org1', {
        clientId: 'foreign-client',
        name: 'Sertraline',
      } as never),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.medication.create).not.toHaveBeenCalled();
  });
});

describe('MedicationsService.remove', () => {
  it('deletes the medication and records a DELETE audit entry', async () => {
    const existing = { id: 'm1', clientId: 'c1', name: 'Sertraline' };
    const prisma = {
      medication: {
        findFirst: vi.fn().mockResolvedValue(existing),
        delete: vi.fn().mockResolvedValue(existing),
      },
    } as unknown as PrismaService;
    const { service, audit } = makeService({ prisma });

    const result = await service.remove('org1', 'actor1', 'm1');

    expect(prisma.medication.delete).toHaveBeenCalledWith({ where: { id: 'm1' } });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org1',
        actorId: 'actor1',
        action: AuditAction.DELETE,
        entityType: 'Medication',
        entityId: 'm1',
        metadata: expect.objectContaining({ clientId: 'c1', name: 'Sertraline' }),
      }),
    );
    expect(result).toEqual({ success: true });
  });

  it('throws NotFoundException and never deletes/audits when the medication is missing', async () => {
    const prisma = {
      medication: { findFirst: vi.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;
    const { service, audit } = makeService({ prisma });

    await expect(service.remove('org1', 'actor1', 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(audit.record).not.toHaveBeenCalled();
  });
});
