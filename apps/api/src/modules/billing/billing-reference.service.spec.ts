import { NotFoundException } from '@nestjs/common';
import { AuditAction } from '@sbos/database';
import { describe, expect, it, vi } from 'vitest';

import { BillingReferenceService } from './billing-reference.service';
import type { AuditService } from '../../audit/audit.service';
import type { PrismaService } from '../../prisma/prisma.service';

function makeService(overrides?: {
  payer?: Record<string, ReturnType<typeof vi.fn>>;
  serviceCode?: Record<string, ReturnType<typeof vi.fn>>;
}) {
  const prisma = {
    payer: {
      create: vi.fn().mockImplementation(({ data }) =>
        Promise.resolve({ id: 'payer1', ...data }),
      ),
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue({ id: 'payer1' }),
      update: vi.fn().mockResolvedValue({ id: 'payer1' }),
      ...overrides?.payer,
    },
    serviceCode: {
      create: vi.fn().mockImplementation(({ data }) =>
        Promise.resolve({ id: 'code1', ...data }),
      ),
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue({ id: 'code1' }),
      update: vi.fn().mockResolvedValue({ id: 'code1' }),
      ...overrides?.serviceCode,
    },
  } as unknown as PrismaService;
  const audit = { record: vi.fn() } as unknown as AuditService;

  return { service: new BillingReferenceService(prisma, audit), prisma, audit };
}

describe('BillingReferenceService', () => {
  describe('payers', () => {
    it('creates a payer and records a CREATE audit entry', async () => {
      const { service, prisma, audit } = makeService();

      const result = await service.createPayer('org1', 'actor1', { name: 'Aetna' });

      expect(prisma.payer.create).toHaveBeenCalledWith({
        data: { name: 'Aetna', organizationId: 'org1' },
      });
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.CREATE,
          entityType: 'Payer',
          entityId: 'payer1',
          metadata: { name: 'Aetna' },
        }),
      );
      expect(result.id).toBe('payer1');
    });

    it('lists payers ordered by name', async () => {
      const { service, prisma } = makeService();

      await service.listPayers('org1');

      expect(prisma.payer.findMany).toHaveBeenCalledWith({
        where: { organizationId: 'org1' },
        orderBy: { name: 'asc' },
      });
    });

    it('propagates NotFoundException without updating when the payer is missing', async () => {
      const { service, prisma } = makeService({
        payer: { findFirst: vi.fn().mockResolvedValue(null) },
      });

      await expect(
        service.updatePayer('org1', 'actor1', 'missing', { name: 'New Name' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.payer.update).not.toHaveBeenCalled();
    });

    it('updates a payer and audits the changed fields', async () => {
      const { service, prisma, audit } = makeService();

      await service.updatePayer('org1', 'actor1', 'payer1', { name: 'New Name' });

      expect(prisma.payer.update).toHaveBeenCalledWith({
        where: { id: 'payer1' },
        data: { name: 'New Name' },
      });
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.UPDATE,
          entityType: 'Payer',
          entityId: 'payer1',
          metadata: { changedFields: ['name'] },
        }),
      );
    });
  });

  describe('service codes', () => {
    it('creates a service code and records a CREATE audit entry', async () => {
      const { service, prisma, audit } = makeService();

      const result = await service.createServiceCode('org1', 'actor1', {
        code: '90834',
        description: 'Psychotherapy, 45 minutes',
        defaultFee: 150,
      });

      expect(prisma.serviceCode.create).toHaveBeenCalledWith({
        data: {
          code: '90834',
          description: 'Psychotherapy, 45 minutes',
          defaultFee: 150,
          organizationId: 'org1',
        },
      });
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.CREATE,
          entityType: 'ServiceCode',
          entityId: 'code1',
          metadata: { code: '90834' },
        }),
      );
      expect(result.id).toBe('code1');
    });

    it('lists service codes ordered by code', async () => {
      const { service, prisma } = makeService();

      await service.listServiceCodes('org1');

      expect(prisma.serviceCode.findMany).toHaveBeenCalledWith({
        where: { organizationId: 'org1' },
        orderBy: { code: 'asc' },
      });
    });

    it('propagates NotFoundException without updating when the service code is missing', async () => {
      const { service, prisma } = makeService({
        serviceCode: { findFirst: vi.fn().mockResolvedValue(null) },
      });

      await expect(
        service.updateServiceCode('org1', 'actor1', 'missing', { description: 'x' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.serviceCode.update).not.toHaveBeenCalled();
    });

    it('updates a service code and audits the changed fields', async () => {
      const { service, prisma, audit } = makeService();

      await service.updateServiceCode('org1', 'actor1', 'code1', { description: 'Updated' });

      expect(prisma.serviceCode.update).toHaveBeenCalledWith({
        where: { id: 'code1' },
        data: { description: 'Updated' },
      });
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.UPDATE,
          entityType: 'ServiceCode',
          entityId: 'code1',
          metadata: { changedFields: ['description'] },
        }),
      );
    });
  });
});
