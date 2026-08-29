import { NotFoundException } from '@nestjs/common';
import { AuditAction } from '@sbos/database';
import { describe, expect, it, vi } from 'vitest';
import * as bcrypt from 'bcryptjs';

import { UsersService } from './users.service';
import { Role } from '../../common/enums/role.enum';
import type { PrismaService } from '../../prisma/prisma.service';
import type { AuditService } from '../../audit/audit.service';

function makeService(overrides?: { prisma?: Partial<PrismaService> }) {
  const prisma = (overrides?.prisma ?? {}) as PrismaService;
  const audit = { record: vi.fn() } as unknown as AuditService;
  return { service: new UsersService(prisma, audit), audit };
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
    const created = {
      id: 'u2',
      organizationId: 'org1',
      role: 'CLINICIAN',
      email: 'new-clinician@sbos.health',
      firstName: 'Jordan',
      lastName: 'Fox',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date(),
    };
    const clinicianCreate = vi.fn().mockResolvedValue({ id: 'c1', userId: 'u2' });
    const prisma = {
      user: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(created),
      },
      clinician: { create: clinicianCreate },
    } as unknown as PrismaService;
    const { service, audit } = makeService({ prisma });

    await service.create(
      {
        organizationId: 'org1',
        email: 'new-clinician@sbos.health',
        password: 'Password123!',
        name: 'Jordan Fox',
        role: Role.CLINICIAN,
      } as never,
      'actor1',
    );

    expect(clinicianCreate).toHaveBeenCalledWith({
      data: { organizationId: 'org1', userId: 'u2' },
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org1',
        actorId: 'actor1',
        action: AuditAction.CREATE,
        entityType: 'User',
        entityId: 'u2',
        metadata: expect.objectContaining({
          email: 'new-clinician@sbos.health',
          role: 'CLINICIAN',
        }),
      }),
    );
  });

  it('does not create a Clinician profile for non-clinician roles', async () => {
    const created = {
      id: 'u3',
      organizationId: 'org1',
      role: 'FRONT_DESK',
      email: 'fd@sbos.health',
      firstName: 'Peyton',
      lastName: 'Park',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date(),
    };
    const clinicianCreate = vi.fn();
    const prisma = {
      user: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(created),
      },
      clinician: { create: clinicianCreate },
    } as unknown as PrismaService;
    const { service } = makeService({ prisma });

    await service.create({
      organizationId: 'org1',
      email: 'fd@sbos.health',
      password: 'Password123!',
      name: 'Peyton Park',
      role: Role.FRONT_DESK,
    } as never);

    expect(clinicianCreate).not.toHaveBeenCalled();
  });
});

describe('UsersService.createInvite', () => {
  it('creates an invite and records a CREATE audit entry', async () => {
    const invite = {
      id: 'inv1',
      email: 'new@sbos.health',
      role: 'CLINICIAN',
      expiresAt: new Date('2026-09-01T00:00:00Z'),
    };
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({ organizationId: 'org1' }),
      },
      userInvite: {
        create: vi.fn().mockResolvedValue(invite),
      },
    } as unknown as PrismaService;
    const { service, audit } = makeService({ prisma });

    const result = await service.createInvite(
      'new@sbos.health',
      Role.CLINICIAN,
      'actor1',
      'org1',
    );

    expect(result.id).toBe('inv1');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org1',
        actorId: 'actor1',
        action: AuditAction.CREATE,
        entityType: 'UserInvite',
        entityId: 'inv1',
        metadata: expect.objectContaining({
          email: 'new@sbos.health',
          role: 'CLINICIAN',
        }),
      }),
    );
  });
});
