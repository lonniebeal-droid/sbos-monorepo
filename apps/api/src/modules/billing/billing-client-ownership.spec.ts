import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { InvoicesService } from './invoices.service';
import { PaymentsService } from './payments.service';
import { PaymentMethodDto } from './dto/invoice.dto';

describe('Billing client ownership guards', () => {
  it('rejects invoice creation for a foreign/deleted client before writing', async () => {
    const prisma = {
      client: { findFirst: vi.fn().mockResolvedValue(null) },
      invoice: { create: vi.fn() },
    };
    const audit = { record: vi.fn() };
    const service = new InvoicesService(prisma as never, audit as never);

    await expect(service.create('org-a', 'actor-1', {
      clientId: 'client-b',
      lineItems: [{ description: 'Synthetic service', unitPrice: 100 }],
    })).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.client.findFirst).toHaveBeenCalledWith({
      where: { id: 'client-b', organizationId: 'org-a', deletedAt: null },
      select: { id: true },
    });
    expect(prisma.invoice.create).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('rejects payment creation for a foreign/deleted client before charging', async () => {
    const prisma = {
      client: { findFirst: vi.fn().mockResolvedValue(null) },
      payment: { create: vi.fn() },
      invoice: { findFirst: vi.fn(), update: vi.fn() },
    };
    const audit = { record: vi.fn() };
    const provider = { charge: vi.fn() };
    const service = new PaymentsService(prisma as never, audit as never, provider as never);

    await expect(service.record('org-a', 'actor-1', {
      clientId: 'client-b', method: PaymentMethodDto.CARD, amount: 25,
    })).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.client.findFirst).toHaveBeenCalledWith({
      where: { id: 'client-b', organizationId: 'org-a', deletedAt: null },
      select: { id: true },
    });
    expect(provider.charge).not.toHaveBeenCalled();
    expect(prisma.payment.create).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });
});
