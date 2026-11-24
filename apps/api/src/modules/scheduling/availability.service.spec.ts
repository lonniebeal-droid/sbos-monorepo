import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AuditAction } from '@sbos/database';
import { describe, expect, it, vi } from 'vitest';

import { AvailabilityService } from './availability.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { AuditService } from '../../audit/audit.service';

function makeService(overrides?: { prisma?: Partial<PrismaService> }) {
  const prisma = (overrides?.prisma ?? {}) as PrismaService;
  const audit = { record: vi.fn() } as unknown as AuditService;
  return { service: new AvailabilityService(prisma, audit), audit };
}

describe('AvailabilityService.createAvailability — tenant ownership', () => {
  const baseDto = {
    clinicianId: 'cl1',
    dayOfWeek: 1,
    startTime: '09:00',
    endTime: '12:00',
  };

  it('rejects when clinicianId is not in the actor organization and never creates', async () => {
    const prisma = {
      clinician: { findFirst: vi.fn().mockResolvedValue(null) },
      clinicianAvailability: { create: vi.fn() },
    } as unknown as PrismaService;
    const { service } = makeService({ prisma });

    await expect(
      service.createAvailability('org1', baseDto),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.clinicianAvailability.create).not.toHaveBeenCalled();
    expect(prisma.clinician.findFirst).toHaveBeenCalledWith({
      where: { id: 'cl1', organizationId: 'org1' },
      select: { id: true },
    });
  });

  it('rejects when locationId is not in the actor organization and never creates', async () => {
    const prisma = {
      clinician: { findFirst: vi.fn().mockResolvedValue({ id: 'cl1' }) },
      location: { findFirst: vi.fn().mockResolvedValue(null) },
      clinicianAvailability: { create: vi.fn() },
    } as unknown as PrismaService;
    const { service } = makeService({ prisma });

    await expect(
      service.createAvailability('org1', { ...baseDto, locationId: 'loc-other' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.clinicianAvailability.create).not.toHaveBeenCalled();
    expect(prisma.location.findFirst).toHaveBeenCalledWith({
      where: { id: 'loc-other', organizationId: 'org1' },
      select: { id: true },
    });
  });

  it('creates when clinician (and optional location) belong to the organization', async () => {
    const created = { id: 'a1', ...baseDto, organizationId: 'org1' };
    const prisma = {
      clinician: { findFirst: vi.fn().mockResolvedValue({ id: 'cl1' }) },
      location: { findFirst: vi.fn().mockResolvedValue({ id: 'loc1' }) },
      clinicianAvailability: { create: vi.fn().mockResolvedValue(created) },
    } as unknown as PrismaService;
    const { service } = makeService({ prisma });

    const result = await service.createAvailability('org1', {
      ...baseDto,
      locationId: 'loc1',
    });
    expect(prisma.clinicianAvailability.create).toHaveBeenCalled();
    expect(result).toBe(created);
  });
});

describe('AvailabilityService.createTimeOff — tenant ownership', () => {
  it('rejects when clinicianId is not in the actor organization and never creates', async () => {
    const prisma = {
      clinician: { findFirst: vi.fn().mockResolvedValue(null) },
      clinicianTimeOff: { create: vi.fn() },
    } as unknown as PrismaService;
    const { service } = makeService({ prisma });

    await expect(
      service.createTimeOff('org1', {
        clinicianId: 'cl-other',
        startsAt: '2026-09-01T00:00:00.000Z',
        endsAt: '2026-09-02T00:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.clinicianTimeOff.create).not.toHaveBeenCalled();
  });

  it('creates when clinician belongs to the organization', async () => {
    const created = { id: 'to1' };
    const prisma = {
      clinician: { findFirst: vi.fn().mockResolvedValue({ id: 'cl1' }) },
      clinicianTimeOff: { create: vi.fn().mockResolvedValue(created) },
    } as unknown as PrismaService;
    const { service } = makeService({ prisma });

    const result = await service.createTimeOff('org1', {
      clinicianId: 'cl1',
      startsAt: '2026-09-01T00:00:00.000Z',
      endsAt: '2026-09-02T00:00:00.000Z',
    });
    expect(prisma.clinicianTimeOff.create).toHaveBeenCalled();
    expect(result).toBe(created);
  });
});

describe('AvailabilityService.removeAvailability', () => {
  it('deletes the availability window and records a DELETE audit entry', async () => {
    const existing = { id: 'a1', clinicianId: 'cl1', dayOfWeek: 2 };
    const prisma = {
      clinicianAvailability: {
        findFirst: vi.fn().mockResolvedValue(existing),
        delete: vi.fn().mockResolvedValue(existing),
      },
    } as unknown as PrismaService;
    const { service, audit } = makeService({ prisma });

    const result = await service.removeAvailability('org1', 'actor1', 'a1');

    expect(prisma.clinicianAvailability.delete).toHaveBeenCalledWith({
      where: { id: 'a1' },
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org1',
        actorId: 'actor1',
        action: AuditAction.DELETE,
        entityType: 'ClinicianAvailability',
        entityId: 'a1',
        metadata: expect.objectContaining({ clinicianId: 'cl1', dayOfWeek: 2 }),
      }),
    );
    expect(result).toEqual({ success: true });
  });

  it('throws BadRequestException and never deletes/audits when the window is missing', async () => {
    const prisma = {
      clinicianAvailability: { findFirst: vi.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;
    const { service, audit } = makeService({ prisma });

    await expect(
      service.removeAvailability('org1', 'actor1', 'missing'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(audit.record).not.toHaveBeenCalled();
  });
});
