import { NotFoundException } from '@nestjs/common';
import { AuditAction } from '@sbos/database';
import { describe, expect, it, vi, type Mock } from 'vitest';

import { AssessmentsService } from './assessments.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { AuditService } from '../../audit/audit.service';

function makeService(prisma: PrismaService) {
  const audit = { record: vi.fn() } as unknown as AuditService;
  return { service: new AssessmentsService(prisma, audit), audit };
}

describe('AssessmentsService', () => {
  describe('create', () => {
    it('creates assessment with JSON responses and returns it', async () => {
      const expected = { id: 'a1', instrument: 'PHQ-9', score: 12 };
      const create = vi.fn().mockResolvedValue(expected);
      const prisma = { assessment: { create } } as unknown as PrismaService;
      const { service } = makeService(prisma);

      const result = await service.create('org1', 'actor1', {
        clientId: 'c1',
        instrument: 'PHQ-9',
        score: 12,
        severity: 'Moderate',
        responses: { q1: 2, q2: 2 },
      });

      expect(create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          clientId: 'c1',
          organizationId: 'org1',
          instrument: 'PHQ-9',
          score: 12,
          severity: 'Moderate',
          responses: { q1: 2, q2: 2 },
          administeredAt: expect.any(Date),
        }),
      });
      expect(result).toEqual(expected);
    });

    it('defaults administeredAt to now when omitted', async () => {
      const create = vi.fn().mockResolvedValue({ id: 'a2' });
      const prisma = { assessment: { create } } as unknown as PrismaService;
      const { service } = makeService(prisma);

      await service.create('org1', 'actor1', {
        clientId: 'c1',
        instrument: 'GAD-7',
        score: 8,
        severity: 'Mild',
      });

      const callData = (create as unknown as Mock).mock.calls[0][0].data;
      expect(callData.administeredAt).toBeInstanceOf(Date);
      expect(callData.responses).toBeUndefined();
    });
  });

  describe('findForClient', () => {
    it('returns assessments ordered by administeredAt desc', async () => {
      const assessments = [{ id: 'a1' }, { id: 'a2' }];
      const findMany = vi.fn().mockResolvedValue(assessments);
      const prisma = { assessment: { findMany } } as unknown as PrismaService;
      const { service } = makeService(prisma);

      const result = await service.findForClient('org1', 'c1');

      expect(findMany).toHaveBeenCalledWith({
        where: { organizationId: 'org1', clientId: 'c1' },
        orderBy: { administeredAt: 'desc' },
      });
      expect(result).toEqual(assessments);
    });
  });

  describe('update', () => {
    it('updates assessment fields and returns updated record', async () => {
      const existing = { id: 'a1', instrument: 'PHQ-9', score: 12 };
      const updated = { ...existing, score: 15, severity: 'Moderately Severe' };
      const findFirst = vi.fn().mockResolvedValue(existing);
      const update = vi.fn().mockResolvedValue(updated);
      const prisma = { assessment: { findFirst, update } } as unknown as PrismaService;
      const { service } = makeService(prisma);

      const result = await service.update('org1', 'a1', {
        score: 15,
        severity: 'Moderately Severe',
      });

      expect(update).toHaveBeenCalledWith({
        where: { id: 'a1' },
        data: { score: 15, severity: 'Moderately Severe' },
      });
      expect(result).toEqual(updated);
    });

    it('throws NotFoundException when assessment does not exist', async () => {
      const findFirst = vi.fn().mockResolvedValue(null);
      const prisma = { assessment: { findFirst } } as unknown as PrismaService;
      const { service } = makeService(prisma);

      await expect(
        service.update('org1', 'nonexistent', { score: 10 }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('hard-deletes assessment and audits it', async () => {
      const existing = { id: 'a1', clientId: 'c1', instrument: 'PHQ-9', score: 12 };
      const findFirst = vi.fn().mockResolvedValue(existing);
      const deleteFn = vi.fn().mockResolvedValue(existing);
      const prisma = { assessment: { findFirst, delete: deleteFn } } as unknown as PrismaService;
      const { service, audit } = makeService(prisma);

      const result = await service.remove('org1', 'actor1', 'a1');

      expect(deleteFn).toHaveBeenCalledWith({
        where: { id: 'a1' },
      });
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: 'org1',
          actorId: 'actor1',
          action: AuditAction.DELETE,
          entityType: 'Assessment',
          entityId: 'a1',
        }),
      );
      expect(result).toEqual({ success: true });
    });

    it('throws NotFoundException when assessment does not exist', async () => {
      const findFirst = vi.fn().mockResolvedValue(null);
      const prisma = { assessment: { findFirst } } as unknown as PrismaService;
      const { service } = makeService(prisma);

      await expect(service.remove('org1', 'actor1', 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
