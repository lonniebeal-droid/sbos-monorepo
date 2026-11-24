import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AuditAction, ClaimStatus } from '@sbos/database';
import { describe, expect, it, vi } from 'vitest';

import { ClaimsService } from './claims.service';
import { ClaimStatusDto } from './dto/claim.dto';
import type { AuditService } from '../../audit/audit.service';
import type { PrismaService } from '../../prisma/prisma.service';

function makeService(overrides?: {
  claim?: Record<string, ReturnType<typeof vi.fn>>;
}) {
  const prisma = {
    client: {
      findFirst: vi.fn().mockResolvedValue({ id: 'c1' }),
    },
    claim: {
      create: vi.fn().mockImplementation(({ data }) =>
        Promise.resolve({ id: 'claim1', ...data }),
      ),
      findFirst: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      update: vi.fn(),
      ...overrides?.claim,
    },
  } as unknown as PrismaService;
  const audit = { record: vi.fn() } as unknown as AuditService;

  return { service: new ClaimsService(prisma, audit), prisma, audit };
}

const baseDto = {
  clientId: 'c1',
  billedAmount: 150,
  serviceDate: '2026-07-24',
};

describe('ClaimsService', () => {
  describe('create', () => {
    it('creates a DRAFT claim with a CLM-XXXXXXXX number and a parsed service date', async () => {
      const { service, prisma, audit } = makeService();

      const result = await service.create('org1', 'actor1', baseDto);

      const createCall = (prisma.claim.create as ReturnType<typeof vi.fn>).mock
        .calls[0][0];
      expect(createCall.data.status).toBe(ClaimStatus.DRAFT);
      expect(createCall.data.claimNumber).toMatch(/^CLM-[0-9A-F]{8}$/);
      expect(createCall.data.serviceDate).toEqual(new Date('2026-07-24'));
      expect(createCall.data.icd10Codes).toEqual([]);
      expect(result.id).toBe('claim1');
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: 'org1',
          actorId: 'actor1',
          action: AuditAction.CREATE,
          entityType: 'Claim',
          entityId: 'claim1',
          metadata: expect.objectContaining({ billedAmount: 150 }),
        }),
      );
    });

    it('preserves given icd10Codes instead of defaulting to an empty array', async () => {
      const { service, prisma } = makeService();

      await service.create('org1', 'actor1', { ...baseDto, icd10Codes: ['F41.1', 'F32.9'] });

      const createCall = (prisma.claim.create as ReturnType<typeof vi.fn>).mock
        .calls[0][0];
      expect(createCall.data.icd10Codes).toEqual(['F41.1', 'F32.9']);
    });
  });

  describe('findAll', () => {
    it('paginates without a search filter', async () => {
      const { service, prisma } = makeService();

      await service.findAll('org1', { page: 2, limit: 10 });

      expect(prisma.claim.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: 'org1' },
          skip: 10,
          take: 10,
        }),
      );
    });

    it('filters by a case-insensitive claim number search', async () => {
      const { service, prisma } = makeService();

      await service.findAll('org1', { page: 1, limit: 20, search: 'CLM-ABC' });

      expect(prisma.claim.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            organizationId: 'org1',
            claimNumber: { contains: 'CLM-ABC', mode: 'insensitive' },
          },
        }),
      );
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when the claim does not exist in this org', async () => {
      const { service } = makeService({ claim: { findFirst: vi.fn().mockResolvedValue(null) } });

      await expect(service.findOne('org1', 'missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('submit', () => {
    it('propagates NotFoundException without updating when the claim is missing', async () => {
      const { service, prisma } = makeService({ claim: { findFirst: vi.fn().mockResolvedValue(null) } });

      await expect(service.submit('org1', 'actor1', 'missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.claim.update).not.toHaveBeenCalled();
    });

    it('sets status SUBMITTED with a timestamp and audits the previous status', async () => {
      const existing = { id: 'claim1', status: ClaimStatus.DRAFT, claimNumber: 'CLM-AAAAAAAA' };
      const { service, prisma, audit } = makeService({
        claim: {
          findFirst: vi.fn().mockResolvedValue(existing),
          update: vi.fn().mockResolvedValue({ ...existing, status: ClaimStatus.SUBMITTED }),
        },
      });

      await service.submit('org1', 'actor1', 'claim1');

      expect(prisma.claim.update).toHaveBeenCalledWith({
        where: { id: 'claim1' },
        data: { status: ClaimStatus.SUBMITTED, submittedAt: expect.any(Date) },
      });
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.SUBMIT,
          metadata: expect.objectContaining({
            claimNumber: 'CLM-AAAAAAAA',
            previousStatus: ClaimStatus.DRAFT,
          }),
        }),
      );
    });
  });

  describe('updateStatus', () => {
    it('propagates NotFoundException without updating when the claim is missing', async () => {
      const { service, prisma } = makeService({ claim: { findFirst: vi.fn().mockResolvedValue(null) } });

      await expect(
        service.updateStatus('org1', 'actor1', 'missing', { status: ClaimStatusDto.DENIED }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.claim.update).not.toHaveBeenCalled();
    });

    it('records a denial with its reason and no paidAt', async () => {
      const existing = { id: 'claim1', status: ClaimStatus.SUBMITTED, claimNumber: 'CLM-AAAAAAAA' };
      const { service, prisma } = makeService({
        claim: { findFirst: vi.fn().mockResolvedValue(existing), update: vi.fn().mockResolvedValue({}) },
      });

      await service.updateStatus('org1', 'actor1', 'claim1', {
        status: ClaimStatusDto.DENIED,
        denialReason: 'CO-97 duplicate claim',
      });

      const updateCall = (prisma.claim.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(updateCall.data.status).toBe(ClaimStatusDto.DENIED);
      expect(updateCall.data.denialReason).toBe('CO-97 duplicate claim');
      expect(updateCall.data.paidAt).toBeUndefined();
      expect(updateCall.data.paidAmount).toBeUndefined();
    });

    it('sets paidAt and paidAmount when the status transitions to PAID', async () => {
      const existing = { id: 'claim1', status: ClaimStatus.ACCEPTED, claimNumber: 'CLM-AAAAAAAA' };
      const { service, prisma, audit } = makeService({
        claim: { findFirst: vi.fn().mockResolvedValue(existing), update: vi.fn().mockResolvedValue({}) },
      });

      await service.updateStatus('org1', 'actor1', 'claim1', {
        status: ClaimStatusDto.PAID,
        paidAmount: 120,
      });

      const updateCall = (prisma.claim.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(updateCall.data.status).toBe(ClaimStatusDto.PAID);
      expect(updateCall.data.paidAmount).toBe(120);
      expect(updateCall.data.paidAt).toEqual(expect.any(Date));
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.UPDATE,
          metadata: expect.objectContaining({
            previousStatus: ClaimStatus.ACCEPTED,
            newStatus: ClaimStatusDto.PAID,
            paidAmount: 120,
          }),
        }),
      );
    });
  });
});

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

  it('throws NotFoundException and never inserts when clientId is outside the org', async () => {
    const prisma = {
      client: { findFirst: vi.fn().mockResolvedValue(null) },
      claim: { create: vi.fn() },
    } as any;
    const audit = { record: vi.fn() } as any;
    const svc2 = new ClaimsService(prisma, audit);
    const dto = {
      clientId: 'foreign-client',
      appointmentId: 'a1',
      billedAmount: 50,
      serviceDate: '2026-08-23',
    } as any;

    await expect(svc2.create('org1', 'actor1', dto)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.claim.create).not.toHaveBeenCalled();
  });
});
