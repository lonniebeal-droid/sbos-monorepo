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
  passwordVersion: 1,
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
    userInvite: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
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
          create: vi.fn(),
        },
        passwordReset: {
          create: vi.fn(),
          findUnique: vi.fn(),
          update: vi.fn(),
          updateMany: vi.fn(),
        },
        userInvite: {
          findUnique: vi.fn(),
          updateMany: vi.fn(),
        },
        clinician: { create: vi.fn() },
      }),
    ),
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

describe('AuthService.refresh', () => {
  it('rejects invalid JWT', async () => {
    const { service, jwtService } = makeService({
      jwtService: {
        verifyAsync: vi.fn().mockRejectedValue(new Error('bad')),
      },
    });
    await expect(service.refresh('token')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(jwtService.verifyAsync).toHaveBeenCalled();
  });

  it('rejects non-refresh token type', async () => {
    const { service } = makeService({
      jwtService: {
        verifyAsync: vi.fn().mockResolvedValue({
          sub: 'u1',
          type: 'access',
          organizationId: 'org1',
          passwordVersion: 1,
        }),
      },
    });
    await expect(service.refresh('token')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects missing jti', async () => {
    const { service } = makeService({
      jwtService: {
        verifyAsync: vi.fn().mockResolvedValue({
          sub: 'u1',
          type: 'refresh',
          organizationId: 'org1',
          passwordVersion: 1,
        }),
      },
    });
    await expect(service.refresh('token')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects unknown/revoked refresh token and revokes family on reuse', async () => {
    const { service, prisma } = makeService({
      jwtService: {
        verifyAsync: vi.fn().mockResolvedValue({
          sub: 'u1',
          type: 'refresh',
          jti: 'jti-1',
          organizationId: 'org1',
          passwordVersion: 1,
        }),
      },
      prisma: {
        refreshToken: {
          create: vi.fn(),
          findUnique: vi.fn().mockResolvedValue({
            jti: 'jti-1',
            userId: 'u1',
            revokedAt: new Date(),
            expiresAt: new Date(Date.now() + 60_000),
          }),
          update: vi.fn(),
          updateMany: vi.fn().mockResolvedValue({ count: 2 }),
          deleteMany: vi.fn(),
        },
      },
    });

    await expect(service.refresh('token')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'u1', revokedAt: null },
      }),
    );
  });

  it('rejects when user is no longer active', async () => {
    const { service, prisma, jwtService } = makeService({
      jwtService: {
        verifyAsync: vi.fn().mockResolvedValue({
          sub: 'u1',
          type: 'refresh',
          jti: 'jti-1',
          organizationId: 'org1',
          passwordVersion: 1,
        }),
      },
      usersService: {
        findActiveById: vi.fn().mockRejectedValue(new NotFoundException('gone')),
      },
      prisma: {
        refreshToken: {
          create: vi.fn(),
          findUnique: vi.fn().mockResolvedValue({
            jti: 'jti-1',
            userId: 'u1',
            revokedAt: null,
            expiresAt: new Date(Date.now() + 60_000),
          }),
          update: vi.fn(),
          updateMany: vi.fn(),
          deleteMany: vi.fn(),
        },
      },
    });

    await expect(service.refresh('token')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.refreshToken.update).not.toHaveBeenCalled();
    expect(jwtService.signAsync).not.toHaveBeenCalled();
  });

  it('rejects refresh when passwordVersion is missing from the payload', async () => {
    const { service, jwtService, prisma } = makeService({
      jwtService: {
        verifyAsync: vi.fn().mockResolvedValue({
          sub: 'u1',
          type: 'refresh',
          jti: 'jti-1',
          organizationId: 'org1',
          // passwordVersion intentionally omitted
        }),
      },
      prisma: {
        refreshToken: {
          create: vi.fn(),
          findUnique: vi.fn().mockResolvedValue({
            jti: 'jti-1',
            userId: 'u1',
            revokedAt: null,
            expiresAt: new Date(Date.now() + 60_000),
          }),
          update: vi.fn(),
          updateMany: vi.fn(),
          deleteMany: vi.fn(),
        },
      },
    });

    await expect(service.refresh('token')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.refreshToken.update).not.toHaveBeenCalled();
    expect(jwtService.signAsync).not.toHaveBeenCalled();
  });

  it('rejects refresh when passwordVersion is stale vs current user', async () => {
    const { service, jwtService, prisma } = makeService({
      jwtService: {
        verifyAsync: vi.fn().mockResolvedValue({
          sub: 'u1',
          type: 'refresh',
          jti: 'jti-1',
          organizationId: 'org1',
          passwordVersion: 1,
        }),
      },
      usersService: {
        findActiveById: vi.fn().mockResolvedValue({
          ...testUser,
          passwordVersion: 4,
        }),
      },
      prisma: {
        refreshToken: {
          create: vi.fn(),
          findUnique: vi.fn().mockResolvedValue({
            jti: 'jti-1',
            userId: 'u1',
            revokedAt: null,
            expiresAt: new Date(Date.now() + 60_000),
          }),
          update: vi.fn(),
          updateMany: vi.fn(),
          deleteMany: vi.fn(),
        },
      },
    });

    await expect(service.refresh('token')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.refreshToken.update).not.toHaveBeenCalled();
    expect(jwtService.signAsync).not.toHaveBeenCalled();
  });

  it('rotates successfully when passwordVersion matches current user', async () => {
    const { service, jwtService, prisma } = makeService({
      jwtService: {
        verifyAsync: vi.fn().mockResolvedValue({
          sub: 'u1',
          type: 'refresh',
          jti: 'jti-1',
          organizationId: 'org1',
          passwordVersion: 1,
        }),
      },
      prisma: {
        refreshToken: {
          create: vi.fn().mockResolvedValue({}),
          findUnique: vi.fn().mockResolvedValue({
            jti: 'jti-1',
            userId: 'u1',
            revokedAt: null,
            expiresAt: new Date(Date.now() + 60_000),
          }),
          update: vi.fn().mockResolvedValue({}),
          updateMany: vi.fn(),
          deleteMany: vi.fn(),
        },
      },
    });

    const result = await service.refresh('token');
    expect(result.accessToken).toBe('signed.jwt.token');
    expect(prisma.refreshToken.update).toHaveBeenCalled();
    expect(jwtService.signAsync).toHaveBeenCalled();
  });
});
