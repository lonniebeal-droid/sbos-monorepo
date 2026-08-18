import { BadRequestException } from '@nestjs/common';
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
