import { describe, expect, it, vi } from 'vitest';

import { CliniciansService } from './clinicians.service';
import type { PrismaService } from '../../prisma/prisma.service';

function makeService(overrides?: {
  clinician?: Record<string, ReturnType<typeof vi.fn>>;
}) {
  const prisma = {
    clinician: {
      findMany: vi.fn().mockResolvedValue([]),
      ...overrides?.clinician,
    },
  } as unknown as PrismaService;

  return { service: new CliniciansService(prisma), prisma };
}

describe('CliniciansService', () => {
  describe('list', () => {
    it('queries clinicians for the org, ordered by createdAt, with the user name joined', async () => {
      const { service, prisma } = makeService();

      await service.list('org1');

      expect(prisma.clinician.findMany).toHaveBeenCalledWith({
        where: { organizationId: 'org1' },
        orderBy: { createdAt: 'asc' },
        include: { user: { select: { firstName: true, lastName: true } } },
      });
    });

    it('prefixes the display name with the title when present', async () => {
      const { service } = makeService({
        clinician: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: 'cl1',
              title: 'Dr.',
              credentials: ['PhD'],
              specialties: ['Anxiety'],
              isAcceptingNewClients: true,
              user: { firstName: 'Riley', lastName: 'Chen' },
            },
          ]),
        },
      });

      const result = await service.list('org1');

      expect(result[0].name).toBe('Dr. Riley Chen');
    });

    it('omits the leading space in the display name when there is no title', async () => {
      const { service } = makeService({
        clinician: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: 'cl2',
              title: null,
              credentials: [],
              specialties: [],
              isAcceptingNewClients: false,
              user: { firstName: 'Jordan', lastName: 'Mitchell' },
            },
          ]),
        },
      });

      const result = await service.list('org1');

      expect(result[0].name).toBe('Jordan Mitchell');
    });

    it('maps every field for each clinician in order', async () => {
      const { service } = makeService({
        clinician: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: 'cl1',
              title: 'Dr.',
              credentials: ['PhD'],
              specialties: ['Anxiety'],
              isAcceptingNewClients: true,
              user: { firstName: 'Riley', lastName: 'Chen' },
            },
            {
              id: 'cl2',
              title: null,
              credentials: ['LCSW'],
              specialties: ['Trauma'],
              isAcceptingNewClients: false,
              user: { firstName: 'Jordan', lastName: 'Mitchell' },
            },
          ]),
        },
      });

      const result = await service.list('org1');

      expect(result).toEqual([
        {
          id: 'cl1',
          title: 'Dr.',
          credentials: ['PhD'],
          specialties: ['Anxiety'],
          isAcceptingNewClients: true,
          name: 'Dr. Riley Chen',
        },
        {
          id: 'cl2',
          title: null,
          credentials: ['LCSW'],
          specialties: ['Trauma'],
          isAcceptingNewClients: false,
          name: 'Jordan Mitchell',
        },
      ]);
    });
  });
});
