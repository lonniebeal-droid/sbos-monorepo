import { NotFoundException } from '@nestjs/common';
import { AuditAction } from '@sbos/database';
import { describe, expect, it, vi } from 'vitest';

import { MedicationsService } from './medications.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { AuditService } from '../../audit/audit.service';

function makeService(overrides?: { prisma?: Partial<PrismaService> }) {
  const defaultPrisma = {
    client: { findFirst: vi.fn().mockResolvedValue({ id: 'c1' }) },
    clinician: { findFirst: vi.fn().mockResolvedValue({ id: 'cl1' }) },
    medication: { create: vi.fn(), findFirst: vi.fn(), delete: vi.fn() },
  };
  const prisma = {
    ...defaultPrisma,
    ...(overrides?.prisma ?? {}),
  } as unknown as PrismaService;
  if (overrides?.prisma) {
    Object.assign(prisma, overrides.prisma);
  }
  const audit = { record: vi.fn() } as unknown as AuditService;
  return { service: new MedicationsService(prisma, audit), audit, prisma };
}

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

describe('MedicationsService.create — tenant ownership of clientId/prescriberId', () => {
  const baseDto = {
    clientId: 'c1',
    name: 'Sertraline',
  };

  it('rejects create when clientId is not in the actor organization', async () => {
    const prisma = {
      client: { findFirst: vi.fn().mockResolvedValue(null) },
      medication: { create: vi.fn() },
    } as unknown as PrismaService;
    const { service } = makeService({ prisma });

    await expect(service.create('org1', baseDto)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.medication.create).not.toHaveBeenCalled();
    expect(prisma.client.findFirst).toHaveBeenCalledWith({
      where: { id: 'c1', organizationId: 'org1', deletedAt: null },
      select: { id: true },
    });
  });

  it('rejects create when prescriberId is not in the actor organization', async () => {
    const prisma = {
      client: { findFirst: vi.fn().mockResolvedValue({ id: 'c1' }) },
      clinician: { findFirst: vi.fn().mockResolvedValue(null) },
      medication: { create: vi.fn() },
    } as unknown as PrismaService;
    const { service } = makeService({ prisma });

    await expect(
      service.create('org1', { ...baseDto, prescriberId: 'cl-other' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.medication.create).not.toHaveBeenCalled();
  });

  it('creates when client (and optional prescriber) belong to the organization', async () => {
    const created = { id: 'm1', name: 'Sertraline' };
    const prisma = {
      client: { findFirst: vi.fn().mockResolvedValue({ id: 'c1' }) },
      clinician: { findFirst: vi.fn().mockResolvedValue({ id: 'cl1' }) },
      medication: { create: vi.fn().mockResolvedValue(created) },
    } as unknown as PrismaService;
    const { service } = makeService({ prisma });

    const result = await service.create('org1', {
      ...baseDto,
      prescriberId: 'cl1',
    });
    expect(prisma.medication.create).toHaveBeenCalled();
    expect(result).toBe(created);
  });
});
