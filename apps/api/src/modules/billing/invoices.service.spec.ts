import { NotFoundException } from '@nestjs/common';
import { AuditAction, InvoiceStatus } from '@sbos/database';
import { describe, expect, it, vi } from 'vitest';

import { InvoicesService } from './invoices.service';
import type { AuditService } from '../../audit/audit.service';
import type { PrismaService } from '../../prisma/prisma.service';

function makeService(overrides?: {
  invoice?: Record<string, ReturnType<typeof vi.fn>>;
}) {
  const prisma = {
    invoice: {
      create: vi.fn().mockImplementation(({ data }) =>
        Promise.resolve({ id: 'inv1', ...data, lineItems: data.lineItems.create }),
      ),
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn(),
      ...overrides?.invoice,
    },
  } as unknown as PrismaService;
  const audit = { record: vi.fn() } as unknown as AuditService;

  return { service: new InvoicesService(prisma, audit), prisma, audit };
}

describe('InvoicesService', () => {
  describe('create', () => {
    it('defaults quantity to 1 and computes subtotal/total with no tax', async () => {
      const { service, prisma } = makeService();

      const result = await service.create('org1', 'actor1', {
        clientId: 'c1',
        lineItems: [{ description: 'Psychotherapy, 45 minutes', unitPrice: 150 }],
      });

      const createCall = (prisma.invoice.create as ReturnType<typeof vi.fn>).mock
        .calls[0][0];
      expect(createCall.data.lineItems.create).toEqual([
        {
          description: 'Psychotherapy, 45 minutes',
          cptCode: undefined,
          quantity: 1,
          unitPrice: 150,
          amount: 150,
        },
      ]);
      expect(createCall.data).toMatchObject({
        subtotal: 150,
        tax: 0,
        total: 150,
        amountPaid: 0,
        balanceDue: 150,
        status: InvoiceStatus.OPEN,
      });
      expect(result.id).toBe('inv1');
    });

    it('sums multiple line items with explicit quantities and adds tax to the total', async () => {
      const { service, prisma } = makeService();

      await service.create('org1', 'actor1', {
        clientId: 'c1',
        tax: 12.5,
        lineItems: [
          { description: 'Intake assessment', unitPrice: 200, quantity: 1 },
          { description: 'Follow-up session', unitPrice: 90, quantity: 2 },
        ],
      });

      const createCall = (prisma.invoice.create as ReturnType<typeof vi.fn>).mock
        .calls[0][0];
      expect(createCall.data.lineItems.create).toEqual([
        expect.objectContaining({ amount: 200 }),
        expect.objectContaining({ amount: 180 }),
      ]);
      expect(createCall.data.subtotal).toBe(380);
      expect(createCall.data.tax).toBe(12.5);
      expect(createCall.data.total).toBe(392.5);
    });

    it('avoids floating-point drift when summing fractional-cent line items', async () => {
      const { service, prisma } = makeService();

      await service.create('org1', 'actor1', {
        clientId: 'c1',
        lineItems: [
          { description: 'A', unitPrice: 0.1, quantity: 1 },
          { description: 'B', unitPrice: 0.1, quantity: 1 },
          { description: 'C', unitPrice: 0.1, quantity: 1 },
        ],
      });

      const createCall = (prisma.invoice.create as ReturnType<typeof vi.fn>).mock
        .calls[0][0];
      // 0.1 + 0.1 + 0.1 is 0.30000000000000004 in raw floating point.
      expect(createCall.data.subtotal).toBe(0.3);
      expect(createCall.data.total).toBe(0.3);
    });

    it('parses a provided dueDate and omits it when absent', async () => {
      const { service, prisma } = makeService();

      await service.create('org1', 'actor1', {
        clientId: 'c1',
        dueDate: '2026-09-01',
        lineItems: [{ description: 'x', unitPrice: 10 }],
      });
      const withDueDate = (prisma.invoice.create as ReturnType<typeof vi.fn>).mock
        .calls[0][0];
      expect(withDueDate.data.dueDate).toEqual(new Date('2026-09-01'));

      await service.create('org1', 'actor1', {
        clientId: 'c1',
        lineItems: [{ description: 'x', unitPrice: 10 }],
      });
      const withoutDueDate = (prisma.invoice.create as ReturnType<typeof vi.fn>).mock
        .calls[1][0];
      expect(withoutDueDate.data.dueDate).toBeUndefined();
    });

    it('generates an INV-XXXXXXXX invoice number and records a CREATE audit entry', async () => {
      const { service, prisma, audit } = makeService();

      await service.create('org1', 'actor1', {
        clientId: 'c1',
        lineItems: [{ description: 'x', unitPrice: 10 }],
      });

      const createCall = (prisma.invoice.create as ReturnType<typeof vi.fn>).mock
        .calls[0][0];
      expect(createCall.data.invoiceNumber).toMatch(/^INV-[0-9A-F]{8}$/);
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: 'org1',
          actorId: 'actor1',
          action: AuditAction.CREATE,
          entityType: 'Invoice',
          entityId: 'inv1',
          metadata: expect.objectContaining({ total: 10 }),
        }),
      );
    });
  });

  describe('findForClient', () => {
    it('lists a client\'s invoices newest first with line items included', async () => {
      const { service, prisma } = makeService();

      await service.findForClient('org1', 'c1');

      expect(prisma.invoice.findMany).toHaveBeenCalledWith({
        where: { organizationId: 'org1', clientId: 'c1' },
        orderBy: { createdAt: 'desc' },
        include: { lineItems: true },
      });
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when the invoice does not exist in this org', async () => {
      const { service } = makeService({ invoice: { findFirst: vi.fn().mockResolvedValue(null) } });

      await expect(service.findOne('org1', 'missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('returns the invoice scoped to the organization with line items and payments', async () => {
      const record = { id: 'inv1' };
      const { service, prisma } = makeService({
        invoice: { findFirst: vi.fn().mockResolvedValue(record) },
      });

      const result = await service.findOne('org1', 'inv1');

      expect(result).toEqual(record);
      expect(prisma.invoice.findFirst).toHaveBeenCalledWith({
        where: { id: 'inv1', organizationId: 'org1' },
        include: { lineItems: true, payments: true },
      });
    });
  });
});
