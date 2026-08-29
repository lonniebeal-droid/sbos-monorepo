import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { PaymentsService } from './payments.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { AuditService } from '../../audit/audit.service';
import type { PaymentProvider } from '../../payments/payment-provider.interface';

function makeService(overrides?: {
  prisma?: Partial<PrismaService>;
  provider?: Partial<PaymentProvider>;
}) {
  const defaultPrisma = {
    client: { findFirst: vi.fn().mockResolvedValue({ id: 'c1' }) },
    invoice: { findFirst: vi.fn().mockResolvedValue({ id: 'inv1' }) },
    claim: { findFirst: vi.fn().mockResolvedValue({ id: 'clm1' }) },
    payment: { create: vi.fn().mockResolvedValue({ id: 'pay1' }) },
  };
  const prisma = {
    ...defaultPrisma,
    ...(overrides?.prisma ?? {}),
  } as unknown as PrismaService;
  if (overrides?.prisma) {
    Object.assign(prisma, overrides.prisma);
  }
  const audit = { record: vi.fn() } as unknown as AuditService;
  const provider = {
    charge: vi.fn().mockResolvedValue({
      status: 'SUCCEEDED',
      processorRef: 'ref-1',
    }),
    ...(overrides?.provider ?? {}),
  } as unknown as PaymentProvider;
  return {
    service: new PaymentsService(prisma, audit, provider),
    prisma,
    audit,
    provider,
  };
}

const baseDto = {
  clientId: 'c1',
  method: 'CASH' as const,
  amount: 25,
};

describe('PaymentsService.record — tenant ownership before charge', () => {
  it('rejects when claimId is not in the actor organization; no charge and no create', async () => {
    const { service, prisma, provider } = makeService({
      prisma: {
        client: { findFirst: vi.fn().mockResolvedValue({ id: 'c1' }) },
        claim: { findFirst: vi.fn().mockResolvedValue(null) },
        payment: { create: vi.fn() },
      } as never,
    });

    await expect(
      service.record('org1', 'actor1', {
        ...baseDto,
        claimId: 'clm-other',
      } as never),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(provider.charge).not.toHaveBeenCalled();
    expect(prisma.payment.create).not.toHaveBeenCalled();
    expect(prisma.claim.findFirst).toHaveBeenCalledWith({
      where: { id: 'clm-other', organizationId: 'org1' },
      select: { id: true },
    });
  });

  it('rejects when clientId is not in org; no charge and no create', async () => {
    const { service, prisma, provider } = makeService({
      prisma: {
        client: { findFirst: vi.fn().mockResolvedValue(null) },
        payment: { create: vi.fn() },
      } as never,
    });

    await expect(service.record('org1', 'actor1', baseDto as never)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(provider.charge).not.toHaveBeenCalled();
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });

  it('rejects when invoiceId is not in org; no charge and no create', async () => {
    const { service, prisma, provider } = makeService({
      prisma: {
        client: { findFirst: vi.fn().mockResolvedValue({ id: 'c1' }) },
        invoice: { findFirst: vi.fn().mockResolvedValue(null) },
        payment: { create: vi.fn() },
      } as never,
    });

    await expect(
      service.record('org1', 'actor1', {
        ...baseDto,
        invoiceId: 'inv-other',
      } as never),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(provider.charge).not.toHaveBeenCalled();
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });

  it('charges and creates when client, optional invoice, and claim belong to org', async () => {
    const created = { id: 'pay1', amount: 25 };
    const { service, prisma, provider, audit } = makeService({
      prisma: {
        client: { findFirst: vi.fn().mockResolvedValue({ id: 'c1' }) },
        invoice: { findFirst: vi.fn().mockResolvedValue({ id: 'inv1' }) },
        claim: { findFirst: vi.fn().mockResolvedValue({ id: 'clm1' }) },
        payment: { create: vi.fn().mockResolvedValue(created) },
      } as never,
    });

    const result = await service.record('org1', 'actor1', {
      ...baseDto,
      invoiceId: 'inv1',
      claimId: 'clm1',
    } as never);

    expect(provider.charge).toHaveBeenCalled();
    expect(prisma.payment.create).toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalled();
    expect(result).toBe(created);
  });
});
