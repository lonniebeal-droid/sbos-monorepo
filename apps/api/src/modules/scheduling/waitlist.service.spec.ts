import { NotFoundException } from '@nestjs/common';
import { AuditAction } from '@sbos/database';
import { describe, expect, it, vi } from 'vitest';

import { WaitlistService } from './waitlist.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { AuditService } from '../../audit/audit.service';

function makeService(overrides?: { prisma?: Partial<PrismaService> }) {
  const defaultPrisma = {
    client: { findFirst: vi.fn().mockResolvedValue({ id: 'c1' }) },
    clinician: { findFirst: vi.fn().mockResolvedValue({ id: 'cl1' }) },
    waitlistEntry: {
      findFirst: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
  };
  const prisma = {
    ...defaultPrisma,
    ...(overrides?.prisma ?? {}),
  } as unknown as PrismaService;
  if (overrides?.prisma) {
    Object.assign(prisma, overrides.prisma);
  }
  const audit = { record: vi.fn() } as unknown as AuditService;
  return { service: new WaitlistService(prisma, audit), audit, prisma };
}

describe('WaitlistService.remove', () => {
  it('deletes the waitlist entry and records a DELETE audit entry', async () => {
    const existing = { id: 'w1', clientId: 'c1' };
    const prisma = {
      waitlistEntry: {
        findFirst: vi.fn().mockResolvedValue(existing),
        delete: vi.fn().mockResolvedValue(existing),
      },
    } as unknown as PrismaService;
    const { service, audit } = makeService({ prisma });

    const result = await service.remove('org1', 'actor1', 'w1');

    expect(prisma.waitlistEntry.delete).toHaveBeenCalledWith({ where: { id: 'w1' } });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org1',
        actorId: 'actor1',
        action: AuditAction.DELETE,
        entityType: 'WaitlistEntry',
        entityId: 'w1',
        metadata: expect.objectContaining({ clientId: 'c1' }),
      }),
    );
    expect(result).toEqual({ success: true });
  });

  it('throws NotFoundException and never deletes/audits when the entry is missing', async () => {
    const prisma = {
      waitlistEntry: { findFirst: vi.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;
    const { service, audit } = makeService({ prisma });

    await expect(service.remove('org1', 'actor1', 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(audit.record).not.toHaveBeenCalled();
  });
});

describe('WaitlistService.create — tenant ownership', () => {
  it('rejects when clientId is not in the actor organization', async () => {
    const prisma = {
      client: { findFirst: vi.fn().mockResolvedValue(null) },
      waitlistEntry: { create: vi.fn() },
    } as unknown as PrismaService;
    const { service } = makeService({ prisma });

    await expect(
      service.create('org1', { clientId: 'c-other' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.waitlistEntry.create).not.toHaveBeenCalled();
  });

  it('rejects when clinicianId is not in the actor organization', async () => {
    const prisma = {
      client: { findFirst: vi.fn().mockResolvedValue({ id: 'c1' }) },
      clinician: { findFirst: vi.fn().mockResolvedValue(null) },
      waitlistEntry: { create: vi.fn() },
    } as unknown as PrismaService;
    const { service } = makeService({ prisma });

    await expect(
      service.create('org1', { clientId: 'c1', clinicianId: 'cl-other' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.waitlistEntry.create).not.toHaveBeenCalled();
  });

  it('creates when client and optional clinician belong to the organization', async () => {
    const created = { id: 'w1' };
    const prisma = {
      client: { findFirst: vi.fn().mockResolvedValue({ id: 'c1' }) },
      clinician: { findFirst: vi.fn().mockResolvedValue({ id: 'cl1' }) },
      waitlistEntry: { create: vi.fn().mockResolvedValue(created) },
    } as unknown as PrismaService;
    const { service } = makeService({ prisma });

    const result = await service.create('org1', {
      clientId: 'c1',
      clinicianId: 'cl1',
    });
    expect(prisma.waitlistEntry.create).toHaveBeenCalled();
    expect(result).toBe(created);
  });
});
