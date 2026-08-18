import { NotFoundException } from '@nestjs/common';
import { AuditAction } from '@sbos/database';
import { describe, expect, it, vi } from 'vitest';

import { DiagnosesService } from './diagnoses.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { AuditService } from '../../audit/audit.service';

function makeService(overrides?: { prisma?: Partial<PrismaService> }) {
  const prisma = (overrides?.prisma ?? {}) as PrismaService;
  const audit = { record: vi.fn() } as unknown as AuditService;
  return { service: new DiagnosesService(prisma, audit), audit };
}

describe('DiagnosesService.remove', () => {
  it('deletes the diagnosis and records a DELETE audit entry', async () => {
    const existing = { id: 'd1', clientId: 'c1', icd10Code: 'F41.1' };
    const prisma = {
      diagnosis: {
        findFirst: vi.fn().mockResolvedValue(existing),
        delete: vi.fn().mockResolvedValue(existing),
      },
    } as unknown as PrismaService;
    const { service, audit } = makeService({ prisma });

    const result = await service.remove('org1', 'actor1', 'd1');

    expect(prisma.diagnosis.delete).toHaveBeenCalledWith({ where: { id: 'd1' } });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org1',
        actorId: 'actor1',
        action: AuditAction.DELETE,
        entityType: 'Diagnosis',
        entityId: 'd1',
        metadata: expect.objectContaining({ clientId: 'c1', icd10Code: 'F41.1' }),
      }),
    );
    expect(result).toEqual({ success: true });
  });

  it('throws NotFoundException and never deletes/audits when the diagnosis is missing', async () => {
    const prisma = {
      diagnosis: { findFirst: vi.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;
    const { service, audit } = makeService({ prisma });

    await expect(service.remove('org1', 'actor1', 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(audit.record).not.toHaveBeenCalled();
  });
});
