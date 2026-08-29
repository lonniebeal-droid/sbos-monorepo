import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import * as bcrypt from 'bcryptjs';

import { UsersService } from './users.service';
import { Role } from '../../common/enums/role.enum';
import type { PrismaService } from '../../prisma/prisma.service';

function makeService(overrides?: { prisma?: Partial<PrismaService> }) {
  const prisma = (overrides?.prisma ?? {}) as PrismaService;
  return { service: new UsersService(prisma) };
}

const baseRecord = {
  id: 'u1',
  email: 'clinician@sbos.health',
  firstName: 'Riley',
  lastName: 'Chen',
  role: 'CLINICIAN',
  organizationId: 'org1',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};

describe('UsersService.validateCredentials', () => {
  it('returns the user entity for a correct password on an ACTIVE account', async () => {
    const passwordHash = await bcrypt.hash('correct-horse', 10);
    const record = { ...baseRecord, passwordHash, status: 'ACTIVE' };
    const findFirst = vi.fn().mockResolvedValue(record);
    const prisma = { user: { findFirst } } as unknown as PrismaService;
    const { service } = makeService({ prisma });

    const result = await service.validateCredentials(
      'clinician@sbos.health',
      'correct-horse',
    );

    expect(result).not.toBeNull();
    expect(result?.id).toBe('u1');
  });

  it('returns null for an incorrect password', async () => {
    const passwordHash = await bcrypt.hash('correct-horse', 10);
    const record = { ...baseRecord, passwordHash, status: 'ACTIVE' };
    const findFirst = vi.fn().mockResolvedValue(record);
    const prisma = { user: { findFirst } } as unknown as PrismaService;
    const { service } = makeService({ prisma });

    const result = await service.validateCredentials(
      'clinician@sbos.health',
      'wrong-password',
    );

    expect(result).toBeNull();
  });

  it('returns null when no user matches the email', async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const prisma = { user: { findFirst } } as unknown as PrismaService;
    const { service } = makeService({ prisma });

    const result = await service.validateCredentials(
      'nobody@sbos.health',
      'anything',
    );

    expect(result).toBeNull();
  });

  it('bug fix: returns null for a correct password on a SUSPENDED account', async () => {
    const passwordHash = await bcrypt.hash('correct-horse', 10);
    const record = { ...baseRecord, passwordHash, status: 'SUSPENDED' };
    const findFirst = vi.fn().mockResolvedValue(record);
    const prisma = { user: { findFirst } } as unknown as PrismaService;
    const { service } = makeService({ prisma });

    const result = await service.validateCredentials(
      'clinician@sbos.health',
      'correct-horse',
    );

    expect(result).toBeNull();
  });

  it('bug fix: returns null for a correct password on a DEACTIVATED account', async () => {
    const passwordHash = await bcrypt.hash('correct-horse', 10);
    const record = { ...baseRecord, passwordHash, status: 'DEACTIVATED' };
    const findFirst = vi.fn().mockResolvedValue(record);
    const prisma = { user: { findFirst } } as unknown as PrismaService;
    const { service } = makeService({ prisma });

    const result = await service.validateCredentials(
      'clinician@sbos.health',
      'correct-horse',
    );

    expect(result).toBeNull();
  });

  it('bug fix: returns null for a correct password on an INVITED (not yet onboarded) account', async () => {
    const passwordHash = await bcrypt.hash('correct-horse', 10);
    const record = { ...baseRecord, passwordHash, status: 'INVITED' };
    const findFirst = vi.fn().mockResolvedValue(record);
    const prisma = { user: { findFirst } } as unknown as PrismaService;
    const { service } = makeService({ prisma });

    const result = await service.validateCredentials(
      'clinician@sbos.health',
      'correct-horse',
    );

    expect(result).toBeNull();
  });
});

describe('UsersService.findActiveById', () => {
  it('returns the user entity for an ACTIVE account', async () => {
    const record = { ...baseRecord, passwordHash: 'irrelevant', status: 'ACTIVE' };
    const findUnique = vi.fn().mockResolvedValue(record);
    const prisma = { user: { findUnique } } as unknown as PrismaService;
    const { service } = makeService({ prisma });

    const result = await service.findActiveById('u1');

    expect(result.id).toBe('u1');
  });

  it('throws NotFoundException for a SUSPENDED account', async () => {
    const record = { ...baseRecord, passwordHash: 'irrelevant', status: 'SUSPENDED' };
    const findUnique = vi.fn().mockResolvedValue(record);
    const prisma = { user: { findUnique } } as unknown as PrismaService;
    const { service } = makeService({ prisma });

    await expect(service.findActiveById('u1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws NotFoundException for a DEACTIVATED account', async () => {
    const record = { ...baseRecord, passwordHash: 'irrelevant', status: 'DEACTIVATED' };
    const findUnique = vi.fn().mockResolvedValue(record);
    const prisma = { user: { findUnique } } as unknown as PrismaService;
    const { service } = makeService({ prisma });

    await expect(service.findActiveById('u1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws NotFoundException when no user matches the id', async () => {
    const findUnique = vi.fn().mockResolvedValue(null);
    const prisma = { user: { findUnique } } as unknown as PrismaService;
    const { service } = makeService({ prisma });

    await expect(service.findActiveById('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('UsersService.create — clinician profile regression', () => {
  it('creates a Clinician profile row when the new user is a CLINICIAN (appointments/notes reference the profile, not the user row)', async () => {
    const created = { id: 'u2', organizationId: 'org1', role: 'CLINICIAN', createdAt: new Date('2026-01-01T00:00:00Z'), updatedAt: new Date() };
    const clinicianCreate = vi.fn().mockResolvedValue({ id: 'c1', userId: 'u2' });
    const prisma = {
      user: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(created),
      },
      clinician: { create: clinicianCreate },
    } as unknown as PrismaService;
    const { service } = makeService({ prisma });

    await service.create('org1', {
      email: 'new-clinician@sbos.health',
      password: 'Password123!',
      name: 'Jordan Fox',
      role: Role.CLINICIAN,
    });

    expect(clinicianCreate).toHaveBeenCalledWith({
      data: { organizationId: 'org1', userId: 'u2' },
    });
  });

  it('does not create a Clinician profile for non-clinician roles', async () => {
    const created = { id: 'u3', organizationId: 'org1', role: 'FRONT_DESK', createdAt: new Date('2026-01-01T00:00:00Z'), updatedAt: new Date() };
    const clinicianCreate = vi.fn();
    const prisma = {
      user: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(created),
      },
      clinician: { create: clinicianCreate },
    } as unknown as PrismaService;
    const { service } = makeService({ prisma });

    await service.create('org1', {
      email: 'fd@sbos.health',
      password: 'Password123!',
      name: 'Peyton Park',
      role: Role.FRONT_DESK,
    });

    expect(clinicianCreate).not.toHaveBeenCalled();
  });
});

describe('UsersService.findByIdInOrg — tenant isolation', () => {
  it('returns the user when id and organizationId match', async () => {
    const record = { ...baseRecord, passwordHash: 'x', status: 'ACTIVE' };
    const findFirst = vi.fn().mockResolvedValue(record);
    const prisma = { user: { findFirst } } as unknown as PrismaService;
    const { service } = makeService({ prisma });

    const result = await service.findByIdInOrg('org1', 'u1');
    expect(result.id).toBe('u1');
    expect(findFirst).toHaveBeenCalledWith({
      where: { id: 'u1', organizationId: 'org1' },
    });
  });

  it('throws NotFoundException for a user in a different organization', async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const prisma = { user: { findFirst } } as unknown as PrismaService;
    const { service } = makeService({ prisma });

    await expect(service.findByIdInOrg('org-other', 'u1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(findFirst).toHaveBeenCalledWith({
      where: { id: 'u1', organizationId: 'org-other' },
    });
  });
});

describe('UsersService.create — tenant organizationId from actor only', () => {
  it('persists organizationId from the service argument, not from any client field', async () => {
    const created = {
      id: 'u4',
      organizationId: 'org-actor',
      email: 'x@sbos.health',
      firstName: 'X',
      lastName: 'Y',
      role: 'CLINICIAN',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date(),
    };
    const userCreate = vi.fn().mockResolvedValue(created);
    const prisma = {
      user: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: userCreate,
      },
      clinician: { create: vi.fn().mockResolvedValue({}) },
    } as unknown as PrismaService;
    const { service } = makeService({ prisma });

    await service.create('org-actor', {
      email: 'x@sbos.health',
      password: 'Password123!',
      name: 'X Y',
      role: Role.CLINICIAN,
    });

    expect(userCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ organizationId: 'org-actor' }),
    });
  });
});
