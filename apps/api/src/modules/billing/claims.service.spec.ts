import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { ClaimsService } from './claims.service';
import { ClaimStatus } from '@sbos/database';

describe('ClaimsService (transitions)', () => {
  const mockPrisma: any = {
    claim: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  };
  const mockAudit: any = { record: vi.fn() };

  const svc = new ClaimsService(mockPrisma as any, mockAudit as any);

  it('rejects backward transition (PAID -> DRAFT)', async () => {
    const claim = { id: 'c1', status: ClaimStatus.PAID };
    mockPrisma.claim.findFirst.mockResolvedValueOnce(claim);
    await expect(
      svc.updateStatus('org', 'actor', 'c1', { status: ClaimStatus.DRAFT as any }),
    ).rejects.toThrow(BadRequestException);
  });

  it('requires paidAmount when marking PAID', async () => {
    const claim = { id: 'c2', status: ClaimStatus.SUBMITTED };
    mockPrisma.claim.findFirst.mockResolvedValueOnce(claim);
    await expect(
      svc.updateStatus('org', 'actor', 'c2', { status: ClaimStatus.PAID as any }),
    ).rejects.toThrow(BadRequestException);
  });

  it('allows forward transition (DRAFT -> SUBMITTED)', async () => {
    const claim = { id: 'c3', status: ClaimStatus.DRAFT };
    mockPrisma.claim.findFirst.mockResolvedValueOnce(claim);
    mockPrisma.claim.update.mockResolvedValueOnce({ ...claim, status: ClaimStatus.SUBMITTED });
    const updated = await svc.updateStatus('org', 'actor', 'c3', { status: ClaimStatus.SUBMITTED as any });
    expect(updated.status).toBe(ClaimStatus.SUBMITTED);
  });
});

describe('ClaimsService.create — tenant ownership of clientId', () => {
  it('rejects create when clientId is not in the actor organization', async () => {
    const prisma = {
      client: { findFirst: vi.fn().mockResolvedValue(null) },
      claim: { create: vi.fn() },
    } as any;
    const audit = { record: vi.fn() } as any;
    const svc = new ClaimsService(prisma, audit);
    const dto = {
      clientId: 'client-other-org',
      billedAmount: 50,
      serviceDate: '2026-08-23',
    } as any;

    await expect(svc.create('org1', 'actor1', dto)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.claim.create).not.toHaveBeenCalled();
    expect(prisma.client.findFirst).toHaveBeenCalledWith({
      where: { id: 'client-other-org', organizationId: 'org1', deletedAt: null },
      select: { id: true },
    });
  });

  it('rejects create when appointmentId is not in the actor organization', async () => {
    const prisma = {
      client: { findFirst: vi.fn().mockResolvedValue({ id: 'c1' }) },
      appointment: { findFirst: vi.fn().mockResolvedValue(null) },
      claim: { create: vi.fn() },
    } as any;
    const audit = { record: vi.fn() } as any;
    const svc = new ClaimsService(prisma, audit);
    const dto = {
      clientId: 'c1',
      appointmentId: 'appt-other-org',
      billedAmount: 50,
      serviceDate: '2026-08-23',
    } as any;

    await expect(svc.create('org1', 'actor1', dto)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.claim.create).not.toHaveBeenCalled();
  });

  it('rejects create when insurancePolicyId is not in the actor organization', async () => {
    const prisma = {
      client: { findFirst: vi.fn().mockResolvedValue({ id: 'c1' }) },
      insurancePolicy: { findFirst: vi.fn().mockResolvedValue(null) },
      claim: { create: vi.fn() },
    } as any;
    const audit = { record: vi.fn() } as any;
    const svc = new ClaimsService(prisma, audit);
    const dto = {
      clientId: 'c1',
      insurancePolicyId: 'pol-other-org',
      billedAmount: 50,
      serviceDate: '2026-08-23',
    } as any;

    await expect(svc.create('org1', 'actor1', dto)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.claim.create).not.toHaveBeenCalled();
    expect(prisma.insurancePolicy.findFirst).toHaveBeenCalledWith({
      where: { id: 'pol-other-org', organizationId: 'org1' },
      select: { id: true },
    });
  });

  it('creates and audits when client, appointment, and policy belong to the organization', async () => {
    const created = { id: 'c-new', claimNumber: 'CLM-999', billedAmount: 50 };
    const prisma = {
      client: { findFirst: vi.fn().mockResolvedValue({ id: 'c1' }) },
      appointment: { findFirst: vi.fn().mockResolvedValue({ id: 'a1' }) },
      insurancePolicy: { findFirst: vi.fn().mockResolvedValue({ id: 'pol1' }) },
      claim: { create: vi.fn().mockResolvedValue(created) },
    } as any;
    const audit = { record: vi.fn() } as any;
    const svc = new ClaimsService(prisma, audit);
    const dto = {
      clientId: 'c1',
      appointmentId: 'a1',
      insurancePolicyId: 'pol1',
      billedAmount: 50,
      serviceDate: '2026-08-23',
    } as any;

    const result = await svc.create('org1', 'actor1', dto);
    expect(prisma.claim.create).toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: expect.any(String),
        entityType: 'Claim',
        entityId: created.id,
      }),
    );
    expect(result).toBe(created);
  });
});
