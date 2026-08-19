import { NotFoundException } from '@nestjs/common';
import { AuditAction, InvoiceStatus, PaymentStatus } from '@sbos/database';
import { describe, expect, it, vi } from 'vitest';

import { PaymentsService } from './payments.service';
import { PaymentMethodDto } from './dto/invoice.dto';
import type { AuditService } from '../../audit/audit.service';
import type { PaymentProvider } from '../../payments/payment-provider.interface';
import type { PrismaService } from '../../prisma/prisma.service';

function makeService(overrides?: {
  prisma?: {
    payment?: Record<string, ReturnType<typeof vi.fn>>;
    invoice?: Record<string, ReturnType<typeof vi.fn>>;
  };
  provider?: Partial<PaymentProvider>;
}) {
  const prisma = {
    payment: {
      create: vi.fn().mockImplementation(({ data }) =>
        Promise.resolve({ id: 'payment1', ...data }),
      ),
      findMany: vi.fn().mockResolvedValue([]),
      ...overrides?.prisma?.payment,
    },
    invoice: {
      findFirst: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
      ...overrides?.prisma?.invoice,
    },
  } as unknown as PrismaService;
  const audit = { record: vi.fn() } as unknown as AuditService;
  const provider = {
    charge: vi
      .fn()
      .mockResolvedValue({ processorRef: 'ref1', status: 'SUCCEEDED', provider: 'test' }),
    refund: vi.fn(),
    ...overrides?.provider,
  } as unknown as PaymentProvider;

  return { service: new PaymentsService(prisma, audit, provider), prisma, audit, provider };
}

const baseDto = {
  clientId: 'c1',
  method: PaymentMethodDto.CARD,
  amount: 40,
};

describe('PaymentsService', () => {
  describe('record', () => {
    it('records a SUCCEEDED payment with processedAt and a CREATE audit entry', async () => {
      const { service, prisma, audit } = makeService();

      const result = await service.record('org1', 'actor1', baseDto);

      expect(result).toMatchObject({
        status: PaymentStatus.SUCCEEDED,
        processedAt: expect.any(Date),
      });
      expect(prisma.payment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          organizationId: 'org1',
          clientId: 'c1',
          method: PaymentMethodDto.CARD,
          amount: 40,
          processorRef: 'ref1',
        }),
      });
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: 'org1',
          actorId: 'actor1',
          action: AuditAction.CREATE,
          entityType: 'Payment',
          entityId: 'payment1',
        }),
      );
    });

    it('records a PENDING payment with no processedAt when the charge is not yet succeeded', async () => {
      const { service, prisma } = makeService({
        provider: {
          charge: vi
            .fn()
            .mockResolvedValue({ processorRef: 'ref1', status: 'PENDING', provider: 'test' }),
        },
      });

      await service.record('org1', 'actor1', baseDto);

      expect(prisma.payment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: PaymentStatus.PENDING,
          processedAt: undefined,
        }),
      });
    });

    it('does not touch the invoice when no invoiceId is given', async () => {
      const { service, prisma } = makeService();

      await service.record('org1', 'actor1', baseDto);

      expect(prisma.invoice.findFirst).not.toHaveBeenCalled();
      expect(prisma.invoice.update).not.toHaveBeenCalled();
    });

    it('does not apply to the invoice when the charge is only PENDING, even with an invoiceId', async () => {
      const { service, prisma } = makeService({
        provider: {
          charge: vi
            .fn()
            .mockResolvedValue({ processorRef: 'ref1', status: 'PENDING', provider: 'test' }),
        },
      });

      await service.record('org1', 'actor1', { ...baseDto, invoiceId: 'inv1' });

      expect(prisma.invoice.findFirst).not.toHaveBeenCalled();
      expect(prisma.invoice.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when applying a SUCCEEDED payment to a missing invoice', async () => {
      const { service, prisma } = makeService({
        prisma: { invoice: { findFirst: vi.fn().mockResolvedValue(null) } },
      });

      await expect(
        service.record('org1', 'actor1', { ...baseDto, invoiceId: 'missing' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.invoice.update).not.toHaveBeenCalled();
    });

    it('marks the invoice PARTIALLY_PAID and computes the remaining balance', async () => {
      const { service, prisma } = makeService({
        prisma: {
          invoice: {
            findFirst: vi
              .fn()
              .mockResolvedValue({ id: 'inv1', total: 100, amountPaid: 0, status: InvoiceStatus.OPEN }),
          },
        },
      });

      await service.record('org1', 'actor1', { ...baseDto, invoiceId: 'inv1', amount: 40 });

      expect(prisma.invoice.update).toHaveBeenCalledWith({
        where: { id: 'inv1' },
        data: {
          amountPaid: 40,
          balanceDue: 60,
          status: InvoiceStatus.PARTIALLY_PAID,
          paidAt: null,
        },
      });
    });

    it('marks the invoice PAID and sets paidAt when the balance reaches exactly zero', async () => {
      const { service, prisma } = makeService({
        prisma: {
          invoice: {
            findFirst: vi
              .fn()
              .mockResolvedValue({ id: 'inv1', total: 100, amountPaid: 0, status: InvoiceStatus.OPEN }),
          },
        },
      });

      await service.record('org1', 'actor1', { ...baseDto, invoiceId: 'inv1', amount: 100 });

      expect(prisma.invoice.update).toHaveBeenCalledWith({
        where: { id: 'inv1' },
        data: {
          amountPaid: 100,
          balanceDue: 0,
          status: InvoiceStatus.PAID,
          paidAt: expect.any(Date),
        },
      });
    });

    it('clamps balanceDue at zero on overpayment, still marking the invoice PAID', async () => {
      const { service, prisma } = makeService({
        prisma: {
          invoice: {
            findFirst: vi
              .fn()
              .mockResolvedValue({ id: 'inv1', total: 100, amountPaid: 90, status: InvoiceStatus.PARTIALLY_PAID }),
          },
        },
      });

      await service.record('org1', 'actor1', { ...baseDto, invoiceId: 'inv1', amount: 20 });

      expect(prisma.invoice.update).toHaveBeenCalledWith({
        where: { id: 'inv1' },
        data: {
          amountPaid: 110,
          balanceDue: 0,
          status: InvoiceStatus.PAID,
          paidAt: expect.any(Date),
        },
      });
    });

    it('avoids floating-point drift when accumulating fractional-cent payments', async () => {
      const { service, prisma } = makeService({
        prisma: {
          invoice: {
            findFirst: vi
              .fn()
              .mockResolvedValue({ id: 'inv1', total: 0.3, amountPaid: 0.2, status: InvoiceStatus.PARTIALLY_PAID }),
          },
        },
      });

      // 0.2 + 0.1 is 0.30000000000000004 in raw floating point.
      await service.record('org1', 'actor1', { ...baseDto, invoiceId: 'inv1', amount: 0.1 });

      expect(prisma.invoice.update).toHaveBeenCalledWith({
        where: { id: 'inv1' },
        data: {
          amountPaid: 0.3,
          balanceDue: 0,
          status: InvoiceStatus.PAID,
          paidAt: expect.any(Date),
        },
      });
    });
  });

  describe('findForClient', () => {
    it('lists a client\'s payments newest first', async () => {
      const { service, prisma } = makeService();

      await service.findForClient('org1', 'c1');

      expect(prisma.payment.findMany).toHaveBeenCalledWith({
        where: { organizationId: 'org1', clientId: 'c1' },
        orderBy: { createdAt: 'desc' },
      });
    });
  });
});
