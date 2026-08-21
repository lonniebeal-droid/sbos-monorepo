import { describe, expect, it, vi } from 'vitest';

import { FeatureFlagsService } from './feature-flags.service';
import type { PrismaService } from '../../prisma/prisma.service';

function makeService(overrides?: {
  featureFlag?: Record<string, ReturnType<typeof vi.fn>>;
}) {
  const prisma = {
    featureFlag: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      upsert: vi.fn().mockResolvedValue({}),
      ...overrides?.featureFlag,
    },
  } as unknown as PrismaService;

  return { service: new FeatureFlagsService(prisma), prisma };
}

describe('FeatureFlagsService', () => {
  describe('list', () => {
    it('lists flags for the org ordered by key', async () => {
      const { service, prisma } = makeService();

      await service.list('org1');

      expect(prisma.featureFlag.findMany).toHaveBeenCalledWith({
        where: { organizationId: 'org1' },
        orderBy: { key: 'asc' },
      });
    });
  });

  describe('upsert', () => {
    it('creates or updates a flag by its composite key', async () => {
      const { service, prisma } = makeService();

      await service.upsert('org1', {
        key: 'new-billing-ui',
        isEnabled: true,
        description: 'Rollout of the new billing screen',
      });

      expect(prisma.featureFlag.upsert).toHaveBeenCalledWith({
        where: { organizationId_key: { organizationId: 'org1', key: 'new-billing-ui' } },
        create: {
          organizationId: 'org1',
          key: 'new-billing-ui',
          isEnabled: true,
          description: 'Rollout of the new billing screen',
        },
        update: { isEnabled: true, description: 'Rollout of the new billing screen' },
      });
    });
  });

  describe('isEnabled', () => {
    it('returns true when the flag exists and is enabled', async () => {
      const { service } = makeService({
        featureFlag: { findUnique: vi.fn().mockResolvedValue({ isEnabled: true }) },
      });

      await expect(service.isEnabled('org1', 'new-billing-ui')).resolves.toBe(true);
    });

    it('returns false when the flag exists and is disabled', async () => {
      const { service } = makeService({
        featureFlag: { findUnique: vi.fn().mockResolvedValue({ isEnabled: false }) },
      });

      await expect(service.isEnabled('org1', 'new-billing-ui')).resolves.toBe(false);
    });

    it('defaults to false when the flag does not exist', async () => {
      const { service } = makeService({
        featureFlag: { findUnique: vi.fn().mockResolvedValue(null) },
      });

      await expect(service.isEnabled('org1', 'unknown-flag')).resolves.toBe(false);
    });
  });
});
