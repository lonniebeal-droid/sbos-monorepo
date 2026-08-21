import { NotFoundException } from '@nestjs/common';
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
