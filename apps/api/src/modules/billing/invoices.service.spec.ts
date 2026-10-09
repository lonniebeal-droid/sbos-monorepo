import { NotFoundException } from '@nestjs/common';
import { AuditAction } from '@sbos/database';
import { describe, expect, it, vi } from 'vitest';

import { InvoicesService } from './invoices.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { AuditService } from '../../audit/audit.service';

function makeService(overrides?: { prisma?: Partial<PrismaService> }) {
  const defaultPrisma = {
    client: { findFirst: vi.fn().mockResolvedValue({ id: 'c1' }) },
    invoice: { create: vi.fn(), findFirst: vi.fn(), findMany: vi.fn() },
  };
  const prisma = {
    ...defaultPrisma,
    ...(overrides?.prisma ?? {}),
  } as unknown as PrismaService;
  if (overrides?.prisma) {
    Object.assign(prisma, overrides.prisma);
  }
  const audit = { record: vi.fn() } as unknown as AuditService;
  return { service: new InvoicesService(prisma, audit), audit, prisma };
}

const baseDto = {
  clientId: 'c1',
  lineItems: [{ description: 'Session', unitPrice: 150 }],
};

describe('InvoicesService.create — tenant ownership of clientId', () => {
  it('rejects create when clientId is not in the actor organization', async () => {
    const prisma = {
      client: { findFirst: vi.fn().mockResolvedValue(null) },
      invoice: { create: vi.fn() },
    } as unknown as PrismaService;
    const { service } = makeService({ prisma });

    await expect(service.create('org1', 'actor1', baseDto)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.invoice.create).not.toHaveBeenCalled();
    expect(prisma.client.findFirst).toHaveBeenCalledWith({
      where: { id: 'c1', organizationId: 'org1', deletedAt: null },
      select: { id: true },
    });
  });

  it('creates when client belongs to the organization and records CREATE audit', async () => {
    const created = {
      id: 'inv1',
      invoiceNumber: 'INV-TEST',
      total: 150,
      lineItems: [],
    };
    const prisma = {
      client: { findFirst: vi.fn().mockResolvedValue({ id: 'c1' }) },
      invoice: { create: vi.fn().mockResolvedValue(created) },
    } as unknown as PrismaService;
    const { service, audit } = makeService({ prisma });

    const result = await service.create('org1', 'actor1', baseDto);
    expect(prisma.invoice.create).toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org1',
        actorId: 'actor1',
        action: AuditAction.CREATE,
        entityType: 'Invoice',
        entityId: 'inv1',
      }),
    );
    expect(result).toBe(created);
  });
});
