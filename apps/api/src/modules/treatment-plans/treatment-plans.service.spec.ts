import { NotFoundException } from '@nestjs/common';
import { AuditAction } from '@sbos/database';
import { describe, expect, it, vi } from 'vitest';

import { TreatmentPlansService } from './treatment-plans.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { AuditService } from '../../audit/audit.service';

function makeService(overrides?: { prisma?: Partial<PrismaService> }) {
  const prisma = (overrides?.prisma ?? {}) as PrismaService;
  const audit = { record: vi.fn() } as unknown as AuditService;
  return { service: new TreatmentPlansService(prisma, audit), audit };
}

describe('TreatmentPlansService.remove', () => {
  it('deletes the plan and records a DELETE audit entry with goal count', async () => {
    const existing = {
      id: 'p1',
      clientId: 'c1',
      title: 'Anxiety management',
      goals: [{ id: 'g1' }, { id: 'g2' }],
    };
    const prisma = {
      treatmentPlan: {
        findFirst: vi.fn().mockResolvedValue(existing),
        delete: vi.fn().mockResolvedValue(existing),
      },
    } as unknown as PrismaService;
    const { service, audit } = makeService({ prisma });

    const result = await service.remove('org1', 'actor1', 'p1');

    expect(prisma.treatmentPlan.delete).toHaveBeenCalledWith({ where: { id: 'p1' } });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org1',
        actorId: 'actor1',
        action: AuditAction.DELETE,
        entityType: 'TreatmentPlan',
        entityId: 'p1',
        metadata: expect.objectContaining({
          clientId: 'c1',
          title: 'Anxiety management',
          goalCount: 2,
        }),
      }),
    );
    expect(result).toEqual({ success: true });
  });

  it('throws NotFoundException and never deletes/audits when the plan is missing', async () => {
    const prisma = {
      treatmentPlan: { findFirst: vi.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;
    const { service, audit } = makeService({ prisma });

    await expect(service.remove('org1', 'actor1', 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(audit.record).not.toHaveBeenCalled();
  });
});
