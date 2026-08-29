import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import * as bcrypt from 'bcryptjs';

import { UsersService } from './users.service';
import { Role } from '../../common/enums/role.enum';
import type { PrismaService } from '../../prisma/prisma.service';

function makeService(overrides?: { prisma?: Partial<PrismaService> }) {
  const prisma = (overrides?.prisma ?? {}) as PrismaService;
  return { service: new UsersService(prisma), prisma };
}

const baseRecord = {
  id: 'u1',
  email: 'clinician@sbos.health',
  firstName: 'Riley',
  lastName: 'Chen',
  role: 'CLINICIAN',
  organizationId: 'org1',
  passwordVersion: 1,
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
    const created = { id: 'u2', organizationId: 'org1', role: 'CLINICIAN', passwordVersion: 1, createdAt: new Date('2026-01-01T00:00:00Z'), updatedAt: new Date() };
    const clinicianCreate = vi.fn().mockResolvedValue({ id: 'c1', userId: 'u2' });
    const prisma = {
      user: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(created),
      },
      clinician: { create: clinicianCreate },
    } as unknown as PrismaService;
    const { service } = makeService({ prisma });

    await service.create('org1', Role.ORG_ADMIN, {
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
    const created = { id: 'u3', organizationId: 'org1', role: 'FRONT_DESK', passwordVersion: 1, createdAt: new Date('2026-01-01T00:00:00Z'), updatedAt: new Date() };
    const clinicianCreate = vi.fn();
    const prisma = {
      user: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(created),
      },
      clinician: { create: clinicianCreate },
    } as unknown as PrismaService;
    const { service } = makeService({ prisma });

    await service.create('org1', Role.ORG_ADMIN, {
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
      passwordVersion: 1,
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

    await service.create('org-actor', Role.ORG_ADMIN, {
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

describe('UsersService.create — role grant authority', () => {
  it('rejects ORG_ADMIN granting SUPER_ADMIN; never calls prisma.user.create', async () => {
    const userCreate = vi.fn();
    const prisma = {
      user: { findFirst: vi.fn(), create: userCreate },
    } as unknown as PrismaService;
    const { service } = makeService({ prisma });

    await expect(
      service.create('org1', Role.ORG_ADMIN, {
        email: 'evil@sbos.health',
        password: 'Password123!',
        name: 'Evil Admin',
        role: Role.SUPER_ADMIN,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(userCreate).not.toHaveBeenCalled();
  });

  it('allows SUPER_ADMIN to grant SUPER_ADMIN', async () => {
    const created = {
      id: 'u-sa',
      organizationId: 'org1',
      passwordVersion: 1,
      email: 'sa@sbos.health',
      firstName: 'Super',
      lastName: 'Admin',
      role: 'SUPER_ADMIN',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const userCreate = vi.fn().mockResolvedValue(created);
    const prisma = {
      user: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: userCreate,
      },
    } as unknown as PrismaService;
    const { service } = makeService({ prisma });

    await service.create('org1', Role.SUPER_ADMIN, {
      email: 'sa@sbos.health',
      password: 'Password123!',
      name: 'Super Admin',
      role: Role.SUPER_ADMIN,
    });

    expect(userCreate).toHaveBeenCalled();
  });

  it('allows ORG_ADMIN to grant permitted same/lower roles (CLINICIAN)', async () => {
    const created = {
      id: 'u-cl',
      organizationId: 'org1',
      passwordVersion: 1,
      email: 'cl@sbos.health',
      firstName: 'C',
      lastName: 'L',
      role: 'CLINICIAN',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const prisma = {
      user: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(created),
      },
      clinician: { create: vi.fn().mockResolvedValue({}) },
    } as unknown as PrismaService;
    const { service } = makeService({ prisma });

    await service.create('org1', Role.ORG_ADMIN, {
      email: 'cl@sbos.health',
      password: 'Password123!',
      name: 'C L',
      role: Role.CLINICIAN,
    });

    expect(prisma.user.create).toHaveBeenCalled();
  });

  it('rejects CLINICIAN granting ORG_ADMIN; never creates', async () => {
    const userCreate = vi.fn();
    const prisma = {
      user: { findFirst: vi.fn(), create: userCreate },
    } as unknown as PrismaService;
    const { service } = makeService({ prisma });

    await expect(
      service.create('org1', Role.CLINICIAN, {
        email: 'x@sbos.health',
        password: 'Password123!',
        name: 'X',
        role: Role.ORG_ADMIN,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(userCreate).not.toHaveBeenCalled();
  });

  it('rejects BILLING granting CLINICIAN (functional-role isolation)', async () => {
    const userCreate = vi.fn();
    const prisma = {
      user: { findFirst: vi.fn(), create: userCreate },
    } as unknown as PrismaService;
    const { service } = makeService({ prisma });

    await expect(
      service.create('org1', Role.BILLING, {
        email: 'x@sbos.health',
        password: 'Password123!',
        name: 'X',
        role: Role.CLINICIAN,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(userCreate).not.toHaveBeenCalled();
  });
});

describe('UsersService.createInvite — role grant authority', () => {
  it('rejects ORG_ADMIN inviting SUPER_ADMIN; never creates invite row', async () => {
    const inviteCreate = vi.fn();
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          organizationId: 'org1',
          role: 'ORG_ADMIN',
        }),
      },
      userInvite: { create: inviteCreate },
    } as unknown as PrismaService;
    const { service } = makeService({ prisma });

    await expect(
      service.createInvite('evil@sbos.health', Role.SUPER_ADMIN, 'admin1', 'org1'),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(inviteCreate).not.toHaveBeenCalled();
  });

  it('allows ORG_ADMIN to invite CLINICIAN', async () => {
    const inviteCreate = vi.fn().mockResolvedValue({ id: 'inv1' });
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          organizationId: 'org1',
          role: 'ORG_ADMIN',
        }),
      },
      userInvite: { create: inviteCreate },
    } as unknown as PrismaService;
    const { service } = makeService({ prisma });

    const result = await service.createInvite(
      'new@sbos.health',
      Role.CLINICIAN,
      'admin1',
      'org1',
    );

    expect(inviteCreate).toHaveBeenCalled();
    expect(result.id).toBe('inv1');
  });

  it('rejects CLINICIAN inviting BILLING (functional isolation); no invite create', async () => {
    const inviteCreate = vi.fn();
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          organizationId: 'org1',
          role: 'CLINICIAN',
        }),
      },
      userInvite: { create: inviteCreate },
    } as unknown as PrismaService;
    const { service } = makeService({ prisma });

    await expect(
      service.createInvite('x@sbos.health', Role.BILLING, 'cl1', 'org1'),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(inviteCreate).not.toHaveBeenCalled();
  });
});
