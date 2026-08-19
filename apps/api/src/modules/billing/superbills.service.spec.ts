import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { SuperbillsService } from './superbills.service';
import type { PrismaService } from '../../prisma/prisma.service';

const CLIENT = {
  id: 'c1',
  firstName: 'Jordan',
  lastName: 'Mitchell',
  mrn: 'MRN-001',
  dateOfBirth: new Date('1990-01-01'),
};

const ORGANIZATION = {
  id: 'org1',
  name: 'Success Brand Behavioral Health',
  npi: '1234567890',
  taxId: '12-3456789',
  addressLine1: '100 Main St',
  city: 'Austin',
  state: 'TX',
};

function makeService(overrides?: {
  organization?: Record<string, ReturnType<typeof vi.fn>>;
  client?: Record<string, ReturnType<typeof vi.fn>>;
  claim?: Record<string, ReturnType<typeof vi.fn>>;
}) {
  const prisma = {
    organization: {
      findUnique: vi.fn().mockResolvedValue(ORGANIZATION),
      ...overrides?.organization,
    },
    client: {
      findFirst: vi.fn().mockResolvedValue(CLIENT),
      ...overrides?.client,
    },
    claim: {
      findMany: vi.fn().mockResolvedValue([]),
      ...overrides?.claim,
    },
  } as unknown as PrismaService;

  return { service: new SuperbillsService(prisma), prisma };
}

describe('SuperbillsService', () => {
  describe('generate', () => {
    it('rejects an invalid from/to date without querying the database', async () => {
      const { service, prisma } = makeService();

      await expect(
        service.generate('org1', 'c1', 'not-a-date', '2026-08-01'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.client.findFirst).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the client does not exist in this org', async () => {
      const { service } = makeService({
        client: { findFirst: vi.fn().mockResolvedValue(null) },
      });

      await expect(
        service.generate('org1', 'missing', '2026-07-01', '2026-08-01'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('maps claims to line items and sums the billed total', async () => {
      const claims = [
        {
          serviceDate: new Date('2026-07-01'),
          cptCode: '90834',
          icd10Codes: ['F41.1'],
          billedAmount: 150,
          paidAmount: 120,
        },
        {
          serviceDate: new Date('2026-07-08'),
          cptCode: '90834',
          icd10Codes: ['F41.1'],
          billedAmount: 150,
          paidAmount: 0,
        },
      ];
      const { service } = makeService({ claim: { findMany: vi.fn().mockResolvedValue(claims) } });

      const result = await service.generate('org1', 'c1', '2026-07-01', '2026-08-01');

      expect(result.lineItems).toEqual([
        {
          serviceDate: claims[0].serviceDate,
          cptCode: '90834',
          diagnoses: ['F41.1'],
          billedAmount: 150,
          paidAmount: 120,
        },
        {
          serviceDate: claims[1].serviceDate,
          cptCode: '90834',
          diagnoses: ['F41.1'],
          billedAmount: 150,
          paidAmount: 0,
        },
      ]);
      expect(result.total).toBe(300);
    });

    it('avoids floating-point drift when summing fractional-cent billed amounts', async () => {
      const claims = [
        { serviceDate: new Date(), cptCode: '90834', icd10Codes: [], billedAmount: 0.1, paidAmount: 0 },
        { serviceDate: new Date(), cptCode: '90834', icd10Codes: [], billedAmount: 0.1, paidAmount: 0 },
        { serviceDate: new Date(), cptCode: '90834', icd10Codes: [], billedAmount: 0.1, paidAmount: 0 },
      ];
      const { service } = makeService({ claim: { findMany: vi.fn().mockResolvedValue(claims) } });

      const result = await service.generate('org1', 'c1', '2026-07-01', '2026-08-01');

      expect(result.total).toBe(0.3);
    });

    it('returns an empty superbill with a zero total when there are no claims in range', async () => {
      const { service } = makeService();

      const result = await service.generate('org1', 'c1', '2026-07-01', '2026-08-01');

      expect(result.lineItems).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('includes provider details when the organization exists', async () => {
      const { service } = makeService();

      const result = await service.generate('org1', 'c1', '2026-07-01', '2026-08-01');

      expect(result.provider).toEqual({
        name: 'Success Brand Behavioral Health',
        npi: '1234567890',
        taxId: '12-3456789',
        address: '100 Main St',
        city: 'Austin',
        state: 'TX',
      });
      expect(result.client).toEqual({
        name: 'Jordan Mitchell',
        mrn: 'MRN-001',
        dateOfBirth: CLIENT.dateOfBirth,
      });
    });

    it('returns a null provider when the organization record is missing', async () => {
      const { service } = makeService({
        organization: { findUnique: vi.fn().mockResolvedValue(null) },
      });

      const result = await service.generate('org1', 'c1', '2026-07-01', '2026-08-01');

      expect(result.provider).toBeNull();
    });
  });
});
