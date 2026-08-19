import { ConflictException, NotFoundException } from '@nestjs/common';
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

describe('UsersService.findById', () => {
  it('throws NotFoundException for a missing user', async () => {
    const findUnique = vi.fn().mockResolvedValue(null);
    const prisma = { user: { findUnique } } as unknown as PrismaService;
    const { service } = makeService({ prisma });

    await expect(service.findById('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns the mapped entity for an existing user, regardless of status', async () => {
    const record = { ...baseRecord, passwordHash: 'irrelevant', status: 'SUSPENDED' };
    const findUnique = vi.fn().mockResolvedValue(record);
    const prisma = { user: { findUnique } } as unknown as PrismaService;
    const { service } = makeService({ prisma });

    const result = await service.findById('u1');

    expect(result.name).toBe('Riley Chen');
  });
});

describe('UsersService.getMfaState', () => {
  it('throws NotFoundException for a missing user', async () => {
    const findUnique = vi.fn().mockResolvedValue(null);
    const prisma = { user: { findUnique } } as unknown as PrismaService;
    const { service } = makeService({ prisma });

    await expect(service.getMfaState('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns the mfa enabled flag and secret', async () => {
    const findUnique = vi.fn().mockResolvedValue({ mfaEnabled: true, mfaSecret: 'SECRET' });
    const prisma = { user: { findUnique } } as unknown as PrismaService;
    const { service } = makeService({ prisma });

    await expect(service.getMfaState('u1')).resolves.toEqual({
      mfaEnabled: true,
      mfaSecret: 'SECRET',
    });
  });
});

describe('UsersService.setMfaSecret / setMfaEnabled', () => {
  it('stores a pending secret without enabling MFA', async () => {
    const update = vi.fn().mockResolvedValue({});
    const prisma = { user: { update } } as unknown as PrismaService;
    const { service } = makeService({ prisma });

    await service.setMfaSecret('u1', 'NEWSECRET');

    expect(update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { mfaSecret: 'NEWSECRET', mfaEnabled: false },
    });
  });

  it('enabling MFA leaves the stored secret untouched', async () => {
    const update = vi.fn().mockResolvedValue({});
    const prisma = { user: { update } } as unknown as PrismaService;
    const { service } = makeService({ prisma });

    await service.setMfaEnabled('u1', true);

    expect(update).toHaveBeenCalledWith({ where: { id: 'u1' }, data: { mfaEnabled: true } });
  });

  it('disabling MFA clears the stored secret', async () => {
    const update = vi.fn().mockResolvedValue({});
    const prisma = { user: { update } } as unknown as PrismaService;
    const { service } = makeService({ prisma });

    await service.setMfaEnabled('u1', false);

    expect(update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { mfaEnabled: false, mfaSecret: null },
    });
  });
});

describe('UsersService.create', () => {
  const dto = {
    email: 'New.User@SBOS.Health',
    name: 'Jordan Practitioner',
    password: 'S3cure!Pass',
    role: Role.CLINICIAN,
    organizationId: 'org1',
  };

  it('rejects a duplicate email within the same organization', async () => {
    const findFirst = vi.fn().mockResolvedValue({ id: 'existing' });
    const create = vi.fn();
    const prisma = { user: { findFirst, create } } as unknown as PrismaService;
    const { service } = makeService({ prisma });

    await expect(service.create(dto)).rejects.toBeInstanceOf(ConflictException);
    expect(create).not.toHaveBeenCalled();
  });

  it('normalizes the email, hashes the password with a verifiable bcrypt hash, and splits the name', async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const create = vi.fn().mockImplementation(({ data }) =>
      Promise.resolve({ ...baseRecord, ...data, id: 'new-user' }),
    );
    const prisma = { user: { findFirst, create } } as unknown as PrismaService;
    const { service } = makeService({ prisma });

    const result = await service.create(dto);

    expect(findFirst).toHaveBeenCalledWith({
      where: { organizationId: 'org1', email: 'new.user@sbos.health' },
      select: { id: true },
    });
    const createData = create.mock.calls[0][0].data;
    expect(createData.email).toBe('new.user@sbos.health');
    expect(createData.firstName).toBe('Jordan');
    expect(createData.lastName).toBe('Practitioner');
    expect(createData.passwordHash).not.toBe(dto.password);
    expect(await bcrypt.compare(dto.password, createData.passwordHash)).toBe(true);
    expect(result.id).toBe('new-user');
  });

  it('leaves lastName empty for a single-word name', async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const create = vi.fn().mockImplementation(({ data }) =>
      Promise.resolve({ ...baseRecord, ...data, id: 'new-user' }),
    );
    const prisma = { user: { findFirst, create } } as unknown as PrismaService;
    const { service } = makeService({ prisma });

    await service.create({ ...dto, name: 'Cher' });

    const createData = create.mock.calls[0][0].data;
    expect(createData.firstName).toBe('Cher');
    expect(createData.lastName).toBe('');
  });
});

describe('UsersService.findAll', () => {
  it('paginates without a search filter', async () => {
    const count = vi.fn().mockResolvedValue(1);
    const findMany = vi.fn().mockResolvedValue([{ ...baseRecord, status: 'ACTIVE' }]);
    const prisma = { user: { count, findMany } } as unknown as PrismaService;
    const { service } = makeService({ prisma });

    const result = await service.findAll({ page: 1, limit: 20 }, 'org1');

    expect(findMany.mock.calls[0][0].where).toEqual({ organizationId: 'org1' });
    expect(result.meta).toEqual({
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    });
  });

  it('adds a case-insensitive OR search filter across name and email', async () => {
    const count = vi.fn().mockResolvedValue(0);
    const findMany = vi.fn().mockResolvedValue([]);
    const prisma = { user: { count, findMany } } as unknown as PrismaService;
    const { service } = makeService({ prisma });

    await service.findAll({ page: 1, limit: 20, search: 'jordan' }, 'org1');

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId: 'org1',
          OR: [
            { firstName: { contains: 'jordan', mode: 'insensitive' } },
            { lastName: { contains: 'jordan', mode: 'insensitive' } },
            { email: { contains: 'jordan', mode: 'insensitive' } },
          ],
        },
      }),
    );
  });
});
