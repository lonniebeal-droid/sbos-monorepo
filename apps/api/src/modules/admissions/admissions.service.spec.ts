import { NotFoundException } from '@nestjs/common';
import { AuditAction } from '@sbos/database';
import { describe, expect, it, vi } from 'vitest';

import { AdmissionsService } from './admissions.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { AuditService } from '../../audit/audit.service';

function makeService(prisma: PrismaService) {
  const audit = { record: vi.fn() } as unknown as AuditService;
  return { service: new AdmissionsService(prisma, audit), audit };
}

describe('AdmissionsService', () => {
  describe('create', () => {
    it('creates admission after verifying client belongs to org', async () => {
      const expected = {
        id: 'adm1',
        clientId: 'c1',
        program: 'Outpatient',
        status: 'ADMITTED',
      };
      const create = vi.fn().mockResolvedValue(expected);
      const prisma = {
        client: { findFirst: vi.fn().mockResolvedValue({ id: 'c1' }) },
        admission: { create },
      } as unknown as PrismaService;
      const { service, audit } = makeService(prisma);

      const result = await service.create('org1', 'actor1', {
        clientId: 'c1',
        program: 'Outpatient',
        levelOfCare: 'IOP',
      });

      expect(prisma.client.findFirst).toHaveBeenCalledWith({
        where: { id: 'c1', organizationId: 'org1', deletedAt: null },
        select: { id: true },
      });
      expect(create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          clientId: 'c1',
          organizationId: 'org1',
          program: 'Outpatient',
          levelOfCare: 'IOP',
          admittedAt: expect.any(Date),
        }),
      });
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.CREATE,
          entityType: 'Admission',
          entityId: 'adm1',
        }),
      );
      expect(result).toEqual(expected);
    });

    it('rejects foreign-org client before any write', async () => {
      const create = vi.fn();
      const prisma = {
        client: { findFirst: vi.fn().mockResolvedValue(null) },
        admission: { create },
      } as unknown as PrismaService;
      const { service } = makeService(prisma);

      await expect(
        service.create('org1', 'actor1', {
          clientId: 'foreign-client',
          program: 'PHP',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('updates status and records discharge', async () => {
      const existing = {
        id: 'adm1',
        clientId: 'c1',
        program: 'Outpatient',
        status: 'ADMITTED',
      };
      const updated = {
        ...existing,
        status: 'DISCHARGED',
        dischargedAt: new Date('2026-09-20T12:00:00Z'),
      };
      const prisma = {
        admission: {
          findFirst: vi.fn().mockResolvedValue(existing),
          update: vi.fn().mockResolvedValue(updated),
        },
      } as unknown as PrismaService;
      const { service, audit } = makeService(prisma);

      const result = await service.update('org1', 'actor1', 'adm1', {
        status: 'DISCHARGED' as any,
        dischargedAt: '2026-09-20T12:00:00Z',
        dischargeReason: 'Completed program',
      });

      expect(prisma.admission.update).toHaveBeenCalled();
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.UPDATE,
          entityType: 'Admission',
        }),
      );
      expect(result.status).toBe('DISCHARGED');
    });

    it('404s for missing admission', async () => {
      const prisma = {
        admission: { findFirst: vi.fn().mockResolvedValue(null) },
      } as unknown as PrismaService;
      const { service } = makeService(prisma);

      await expect(
        service.update('org1', 'actor1', 'missing', { program: 'x' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('remove', () => {
    it('deletes and audits', async () => {
      const existing = {
        id: 'adm1',
        clientId: 'c1',
        program: 'Outpatient',
        status: 'ADMITTED',
      };
      const prisma = {
        admission: {
          findFirst: vi.fn().mockResolvedValue(existing),
          delete: vi.fn().mockResolvedValue(existing),
        },
      } as unknown as PrismaService;
      const { service, audit } = makeService(prisma);

      const result = await service.remove('org1', 'actor1', 'adm1');
      expect(result).toEqual({ success: true });
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.DELETE,
          entityType: 'Admission',
          entityId: 'adm1',
        }),
      );
    });
  });
});
