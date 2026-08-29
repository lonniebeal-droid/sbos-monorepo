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

    expect(result).toMatchObject({
      id: 'u1',
      email: 'clinician@sbos.health',
      role: Role.CLINICIAN,
      organizationId: 'org1',
      passwordVersion: 1,
    });
  });

  it('returns null for a wrong password', async () => {
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

  it('returns null when the account is not ACTIVE', async () => {
    const passwordHash = await bcrypt.hash('correct-horse', 10);
    const record = { ...baseRecord, passwordHash, status: 'SUSPENDED' };
    const findFirst = vi.fn().mockResolvedValue(null);
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
  it('returns the entity for an ACTIVE user', async () => {
    const record = { ...baseRecord, status: 'ACTIVE', passwordHash: 'x' };
    const findFirst = vi.fn().mockResolvedValue(record);
    const prisma = { user: { findFirst } } as unknown as PrismaService;
    const { service } = makeService({ prisma });

    const result = await service.findActiveById('u1');
    expect(result.id).toBe('u1');
    expect(result.passwordVersion).toBe(1);
  });

  it('throws NotFoundException when missing or not ACTIVE', async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const prisma = { user: { findFirst } } as unknown as PrismaService;
    const { service } = makeService({ prisma });

    await expect(service.findActiveById('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('UsersService.create', () => {
  it('creates a user and audits CREATE', async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const create = vi.fn().mockResolvedValue({
      ...baseRecord,
      passwordHash: 'hashed',
      status: 'ACTIVE',
    });
    const clinicianCreate = vi.fn().mockResolvedValue({});
    const prisma = {
      user: { findFirst, create },
      clinician: { create: clinicianCreate },
    } as unknown as PrismaService;
    const { service, audit } = makeService({ prisma });

    const result = await service.create(
      {
        organizationId: 'org1',
        email: 'clinician@sbos.health',
        password: 'SecurePass1!',
        name: 'Riley Chen',
        role: Role.CLINICIAN,
      },
      'actor-1',
    );

    expect(create).toHaveBeenCalled();
    expect(clinicianCreate).toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.CREATE,
        entityType: 'User',
      }),
    );
    expect(result.passwordVersion).toBe(1);
  });
});
