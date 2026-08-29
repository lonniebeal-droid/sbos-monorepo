import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { AuditAction } from '@sbos/database';

import { AuthService } from './auth.service';
import type { UsersService } from '../users/users.service';
import type { UserEntity } from '../users/entities/user.entity';
import type { AuditService } from '../../audit/audit.service';
import { Role } from '../../common/enums/role.enum';

const jwtConfig = {
  accessSecret: 'test-access-secret',
  refreshSecret: 'test-refresh-secret',
  accessExpiresIn: '15m',
  refreshExpiresIn: '7d',
};

const testUser: UserEntity = {
  id: 'u1',
  email: 'clinician@sbos.health',
  firstName: 'Riley',
  lastName: 'Chen',
  name: 'Riley Chen',
  role: Role.CLINICIAN,
  organizationId: 'org1',
  createdAt: '2026-01-01T00:00:00.000Z',
};

function makeService(overrides?: {
  usersService?: Partial<UsersService>;
  jwtService?: Record<string, unknown>;
  mfaService?: Record<string, unknown>;
  prisma?: Record<string, unknown>;
  audit?: Partial<AuditService>;
}) {
  const usersService = {
    validateCredentials: vi.fn(),
    getMfaState: vi.fn().mockResolvedValue({ mfaEnabled: false, mfaSecret: null }),
    findById: vi.fn().mockResolvedValue(testUser),
    findActiveById: vi.fn().mockResolvedValue(testUser),
    setMfaSecret: vi.fn().mockResolvedValue(undefined),
    setMfaEnabled: vi.fn().mockResolvedValue(undefined),
    create: vi.fn().mockResolvedValue(testUser),
    ...overrides?.usersService,
  } as unknown as UsersService;

  const jwtService = {
    signAsync: vi.fn().mockResolvedValue('signed.jwt.token'),
    verifyAsync: vi.fn(),
    ...overrides?.jwtService,
  };

  const configService = {
    get: vi.fn().mockReturnValue(jwtConfig),
  };

  const mfaService = {
    verify: vi.fn().mockReturnValue(true),
    generate: vi.fn(),
    qrDataUrl: vi.fn(),
    ...overrides?.mfaService,
  };

  const prisma = {
    refreshToken: {
      create: vi.fn().mockResolvedValue({}),
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    user: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
    organization: {
      create: vi.fn(),
    },
    passwordReset: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    ...overrides?.prisma,
  };

  const audit = {
    record: vi.fn().mockResolvedValue(undefined),
    ...overrides?.audit,
  } as unknown as AuditService;

  const service = new AuthService(
    usersService,
    jwtService as never,
    configService as never,
    mfaService as never,
    prisma as never,
    audit,
  );

  return { service, usersService, jwtService, prisma, audit };
}

describe('AuthService.refresh',
 () => {
  it('rotates the refresh token and issues a fresh pair for a valid, unrevoked token', async () => {
    const { service, prisma, jwtService } = makeService({
      jwtService: {
        verifyAsync: vi
          .fn()
          .mockResolvedValue({ sub: 'u1', type: 'refresh', jti: 'jti-1', organizationId: 'org1' }),
        signAsync: vi.fn().mockResolvedValue('new.token'),
      },
      prisma: {
        refreshToken: {
          findUnique: vi.fn().mockResolvedValue({
            jti: 'jti-1',
            userId: 'u1',
            revokedAt: null,
            expiresAt: new Date(Date.now() + 60_000),
          }),
          update: vi.fn().mockResolvedValue({}),
          create: vi.fn().mockResolvedValue({}),
          updateMany: vi.fn(),
        },
      },
    });

    const result = await service.refresh('valid.refresh.token');

    expect(prisma.refreshToken.update).toHaveBeenCalledWith({
      where: { jti: 'jti-1' },
      data: { revokedAt: expect.any(Date) },
    });
    expect(result).toEqual(
      expect.objectContaining({
        accessToken: 'new.token',
        refreshToken: 'new.token',
      }),
    );
  });

  it('throws UnauthorizedException for a token with a bad/expired signature', async () => {
    const { service, prisma } = makeService({
      jwtService: { verifyAsync: vi.fn().mockRejectedValue(new Error('invalid')) },
    });

    await expect(service.refresh('bad.token')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.refreshToken.update).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedException for a non-refresh token type', async () => {
    const { service } = makeService({
      jwtService: {
        verifyAsync: vi.fn().mockResolvedValue({ sub: 'u1', type: 'access', jti: 'jti-1' }),
      },
    });

    await expect(service.refresh('access.token')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('revokes the whole token family and throws on reuse of an already-revoked jti', async () => {
    const { service, prisma } = makeService({
      jwtService: {
        verifyAsync: vi
          .fn()
          .mockResolvedValue({ sub: 'u1', type: 'refresh', jti: 'jti-stolen' }),
      },
      prisma: {
        refreshToken: {
          findUnique: vi.fn().mockResolvedValue({
            jti: 'jti-stolen',
            userId: 'u1',
            revokedAt: new Date(),
            expiresAt: new Date(Date.now() + 60_000),
          }),
          updateMany: vi.fn().mockResolvedValue({ count: 3 }),
          update: vi.fn(),
          create: vi.fn(),
        },
      },
    });

    await expect(service.refresh('stolen.token')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('does not family-revoke when jti is unknown (stored is null)', async () => {
    const { service, prisma } = makeService({
      jwtService: {
        verifyAsync: vi
          .fn()
          .mockResolvedValue({ sub: 'u1', type: 'refresh', jti: 'jti-unknown' }),
      },
      prisma: {
        refreshToken: {
          findUnique: vi.fn().mockResolvedValue(null),
          updateMany: vi.fn(),
          update: vi.fn(),
          create: vi.fn(),
        },
      },
    });

    await expect(service.refresh('unknown.token')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
  });

  it('rejects refresh for an inactive/suspended user (findActiveById throws)', async () => {
    const { service } = makeService({
      jwtService: {
        verifyAsync: vi
          .fn()
          .mockResolvedValue({ sub: 'u1', type: 'refresh', jti: 'jti-1', organizationId: 'org1' }),
      },
      usersService: {
        findActiveById: vi.fn().mockRejectedValue(new NotFoundException('User u1 not found')),
      },
      prisma: {
        refreshToken: {
          findUnique: vi.fn().mockResolvedValue({
            jti: 'jti-1',
            userId: 'u1',
            revokedAt: null,
            expiresAt: new Date(Date.now() + 60_000),
          }),
          update: vi.fn(),
          create: vi.fn(),
          updateMany: vi.fn(),
        },
      },
    });

    await expect(service.refresh('valid.token')).rejects.toBeInstanceOf(NotFoundException);
  });
});
