import { UnauthorizedException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { AuthService } from './auth.service';
import type { UsersService } from '../users/users.service';
import type { UserEntity } from '../users/entities/user.entity';
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
}) {
  const usersService = {
    validateCredentials: vi.fn(),
    getMfaState: vi.fn().mockResolvedValue({ mfaEnabled: false, mfaSecret: null }),
    findById: vi.fn().mockResolvedValue(testUser),
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
    },
    ...overrides?.prisma,
  };

  const service = new AuthService(
    usersService,
    jwtService as never,
    configService as never,
    mfaService as never,
    prisma as never,
  );

  return { service, usersService, jwtService, mfaService, prisma };
}

describe('AuthService.login', () => {
  it('issues an access/refresh token pair and records the refresh token for a valid, non-MFA login', async () => {
    const { service, usersService, jwtService, prisma } = makeService({
      usersService: { validateCredentials: vi.fn().mockResolvedValue(testUser) },
    });

    const result = await service.login({
      email: 'clinician@sbos.health',
      password: 'correct-horse',
    });

    expect(usersService.validateCredentials).toHaveBeenCalledWith(
      'clinician@sbos.health',
      'correct-horse',
    );
    expect(jwtService.signAsync).toHaveBeenCalledTimes(2);
    expect(prisma.refreshToken.create).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      accessToken: 'signed.jwt.token',
      refreshToken: 'signed.jwt.token',
      user: testUser,
    });
    expect((result as { expiresIn: number }).expiresIn).toBe(15 * 60);
  });

  it('returns an MFA challenge instead of tokens when MFA is enabled, and does not create a refresh token', async () => {
    const { service, jwtService, prisma } = makeService({
      usersService: {
        validateCredentials: vi.fn().mockResolvedValue(testUser),
        getMfaState: vi.fn().mockResolvedValue({ mfaEnabled: true, mfaSecret: 'secret' }),
      },
    });

    const result = await service.login({
      email: 'clinician@sbos.health',
      password: 'correct-horse',
    });

    expect(result).toMatchObject({ mfaRequired: true, mfaToken: 'signed.jwt.token' });
    expect(jwtService.signAsync).toHaveBeenCalledTimes(1);
    expect(prisma.refreshToken.create).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedException on a bad password and never issues tokens', async () => {
    const { service, jwtService } = makeService({
      usersService: { validateCredentials: vi.fn().mockResolvedValue(null) },
    });

    await expect(
      service.login({ email: 'clinician@sbos.health', password: 'wrong' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(jwtService.signAsync).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedException when no user matches the email', async () => {
    const { service, jwtService } = makeService({
      usersService: { validateCredentials: vi.fn().mockResolvedValue(null) },
    });

    await expect(
      service.login({ email: 'nobody@sbos.health', password: 'anything' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(jwtService.signAsync).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedException for a correct password on an inactive account (UsersService gate)', async () => {
    // UsersService.validateCredentials returns null for a correct password on a
    // non-ACTIVE account (see users.service.spec.ts) -- AuthService.login must
    // treat that identically to a bad password, not leak account-state detail.
    const { service, jwtService } = makeService({
      usersService: { validateCredentials: vi.fn().mockResolvedValue(null) },
    });

    await expect(
      service.login({ email: 'clinician@sbos.health', password: 'correct-horse' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(jwtService.signAsync).not.toHaveBeenCalled();
  });
});

describe('AuthService.loginMfa', () => {
  it('verifies the challenge + TOTP code and issues tokens', async () => {
    const { service, jwtService, mfaService, prisma } = makeService({
      jwtService: {
        verifyAsync: vi.fn().mockResolvedValue({ sub: 'u1', type: 'mfa' }),
      },
      usersService: {
        getMfaState: vi.fn().mockResolvedValue({ mfaEnabled: true, mfaSecret: 'secret' }),
      },
    });

    const result = await service.loginMfa('mfa.challenge.token', '123456');

    expect(mfaService.verify).toHaveBeenCalledWith('123456', 'secret');
    expect(prisma.refreshToken.create).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ user: testUser });
    expect(jwtService.verifyAsync).toHaveBeenCalled();
  });

  it('throws UnauthorizedException for an invalid TOTP code', async () => {
    const { service, prisma } = makeService({
      jwtService: {
        verifyAsync: vi.fn().mockResolvedValue({ sub: 'u1', type: 'mfa' }),
      },
      usersService: {
        getMfaState: vi.fn().mockResolvedValue({ mfaEnabled: true, mfaSecret: 'secret' }),
      },
      mfaService: { verify: vi.fn().mockReturnValue(false) },
    });

    await expect(service.loginMfa('mfa.challenge.token', '000000')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(prisma.refreshToken.create).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedException for an expired/invalid MFA challenge token', async () => {
    const { service } = makeService({
      jwtService: { verifyAsync: vi.fn().mockRejectedValue(new Error('expired')) },
    });

    await expect(service.loginMfa('bad.token', '123456')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});

describe('AuthService.refresh', () => {
  it('rotates the refresh token and issues a fresh pair for a valid, unrevoked token', async () => {
    const { service, jwtService, prisma } = makeService({
      jwtService: {
        verifyAsync: vi
          .fn()
          .mockResolvedValue({ sub: 'u1', type: 'refresh', jti: 'jti-1' }),
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
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        },
      },
    });

    const result = await service.refresh('some.refresh.token');

    expect(prisma.refreshToken.update).toHaveBeenCalledWith({
      where: { jti: 'jti-1' },
      data: { revokedAt: expect.any(Date) },
    });
    expect(jwtService.signAsync).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ accessToken: 'signed.jwt.token' });
  });

  it('throws UnauthorizedException for a token with a bad/expired signature', async () => {
    const { service, prisma } = makeService({
      jwtService: { verifyAsync: vi.fn().mockRejectedValue(new Error('bad sig')) },
    });

    await expect(service.refresh('garbage')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.refreshToken.findUnique).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedException for a non-refresh token type', async () => {
    const { service } = makeService({
      jwtService: {
        verifyAsync: vi.fn().mockResolvedValue({ sub: 'u1', type: 'access' }),
      },
    });

    await expect(service.refresh('access.token.used.as.refresh')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('revokes the whole token family and throws on reuse of an unknown/already-revoked jti', async () => {
    const { service, prisma } = makeService({
      jwtService: {
        verifyAsync: vi
          .fn()
          .mockResolvedValue({ sub: 'u1', type: 'refresh', jti: 'jti-stolen' }),
      },
      prisma: {
        refreshToken: {
          findUnique: vi.fn().mockResolvedValue(null),
          updateMany: vi.fn().mockResolvedValue({ count: 3 }),
          update: vi.fn(),
          create: vi.fn(),
        },
      },
    });

    await expect(service.refresh('stolen.token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('throws UnauthorizedException for a stored token past its expiresAt', async () => {
    const { service, prisma } = makeService({
      jwtService: {
        verifyAsync: vi
          .fn()
          .mockResolvedValue({ sub: 'u1', type: 'refresh', jti: 'jti-old' }),
      },
      prisma: {
        refreshToken: {
          findUnique: vi.fn().mockResolvedValue({
            jti: 'jti-old',
            userId: 'u1',
            revokedAt: null,
            expiresAt: new Date(Date.now() - 60_000),
          }),
          update: vi.fn(),
          updateMany: vi.fn(),
          create: vi.fn(),
        },
      },
    });

    await expect(service.refresh('expired.token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(prisma.refreshToken.update).not.toHaveBeenCalled();
  });
});

describe('AuthService.logout', () => {
  it('revokes the matching, not-yet-revoked refresh token', async () => {
    const { service, prisma } = makeService({
      jwtService: {
        verifyAsync: vi
          .fn()
          .mockResolvedValue({ sub: 'u1', type: 'refresh', jti: 'jti-1' }),
      },
    });

    const result = await service.logout('some.refresh.token');

    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { jti: 'jti-1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(result).toEqual({ success: true });
  });

  it('is idempotent/best-effort and still returns success for an already-invalid token', async () => {
    const { service, prisma } = makeService({
      jwtService: { verifyAsync: vi.fn().mockRejectedValue(new Error('invalid')) },
    });

    const result = await service.logout('garbage');

    expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
    expect(result).toEqual({ success: true });
  });
});
