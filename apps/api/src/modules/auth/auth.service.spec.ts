import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import * as bcrypt from 'bcryptjs';

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
  passwordVersion: 1,
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
    findActiveById: vi.fn().mockResolvedValue(testUser),
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
  it('rotates the refresh token and issues a fresh pair for a valid, unrevoked token from an active user', async () => {
    const { service, usersService, jwtService, prisma } = makeService({
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

    expect(usersService.findActiveById).toHaveBeenCalledWith('u1');
    expect(prisma.refreshToken.update).toHaveBeenCalledWith({
      where: { jti: 'jti-1' },
      data: { revokedAt: expect.any(Date) },
    });
    expect(jwtService.signAsync).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ accessToken: 'signed.jwt.token' });
  });

  it('throws UnauthorizedException and never rotates/reissues for a suspended/deactivated/missing user', async () => {
    const { service, prisma, jwtService } = makeService({
      jwtService: {
        verifyAsync: vi
          .fn()
          .mockResolvedValue({ sub: 'u1', type: 'refresh', jti: 'jti-1' }),
      },
      usersService: {
        // Mirrors UsersService.findActiveById: a non-ACTIVE (or missing) user
        // is treated identically to "not found".
        findActiveById: vi.fn().mockRejectedValue(new NotFoundException()),
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
        },
      },
    });

    await expect(service.refresh('some.refresh.token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(prisma.refreshToken.update).not.toHaveBeenCalled();
    expect(jwtService.signAsync).not.toHaveBeenCalled();
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

describe('AuthService.resetPassword — session invalidation', () => {
  function makeResetService() {
    const storedHash = { current: '$2a$10$originalhash' };
    const storedVersion = { current: 1 };
    let resetSeq = 0;
    const prisma = {
      user: {
        findFirst: vi.fn().mockResolvedValue({ id: 'u1', email: 'admin@sbos.health' }),
        update: vi.fn().mockImplementation(({ data }) => {
          if (data.passwordHash) storedHash.current = data.passwordHash;
          if (data.passwordVersion && typeof data.passwordVersion === 'object' && 'increment' in data.passwordVersion) {
            storedVersion.current += data.passwordVersion.increment;
          } else if (typeof data.passwordVersion === 'number') {
            storedVersion.current = data.passwordVersion;
          }
          return Promise.resolve({});
        }),
      },
      passwordReset: {
        create: vi.fn().mockImplementation(({ data }) =>
          Promise.resolve({ id: `reset-${++resetSeq}`, ...data })),
        findUnique: vi.fn(),
        update: vi.fn().mockResolvedValue({}),
      },
      refreshToken: {
        create: vi.fn().mockResolvedValue({}),
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      $transaction: vi.fn().mockImplementation(async (ops: Promise<unknown>[]) => {
        const results = [];
        for (const op of ops) results.push(await op);
        return results;
      }),
    };
    const { service } = makeService({ prisma });
    return { service, prisma, storedHash, storedVersion };
  }

  it('forgot → reset writes NEW hash, increments passwordVersion, revokes refresh tokens', async () => {
    vi.useFakeTimers();
    try {
      const { service, prisma, storedHash, storedVersion } = makeResetService();

      const forgot = await service.forgotPassword('admin@sbos.health');
      const link = forgot.previewLink;
      expect(link).toBeTruthy();
      const resetId = link!.split('resetId=')[1].split('&')[0];
      const token = link!.split('token=')[1];
      const createdReset = await prisma.passwordReset.create.mock.results[0].value;

      prisma.passwordReset.findUnique.mockResolvedValue(createdReset);

      await service.resetPassword({ resetId, token, password: 'NewAdmin1!' });

      const newOk = await bcrypt.compare('NewAdmin1!', storedHash.current);
      expect(newOk).toBe(true);
      const oldOk = await bcrypt.compare('Admin123!', storedHash.current);
      expect(oldOk).toBe(false);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: createdReset.userId },
          data: expect.objectContaining({
            passwordVersion: { increment: 1 },
          }),
        }),
      );
      expect(storedVersion.current).toBe(2);
      expect(prisma.passwordReset.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: createdReset.id },
          data: expect.objectContaining({ usedAt: expect.any(Date) }),
        }),
      );
      expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: createdReset.userId },
      });

      prisma.passwordReset.findUnique.mockResolvedValue({
        ...createdReset,
        usedAt: new Date(),
      });
      await expect(
        service.resetPassword({ resetId, token, password: 'Again1!' }),
      ).rejects.toThrow('Reset token already used');
    } finally {
      vi.useRealTimers();
    }
  });

  it('concurrent resets each increment passwordVersion (transaction uses increment)', async () => {
    const { service, prisma, storedVersion } = makeResetService();
    const forgot = await service.forgotPassword('admin@sbos.health');
    const link = forgot.previewLink!;
    const resetId = link.split('resetId=')[1].split('&')[0];
    const token = link.split('token=')[1];
    const createdReset = await prisma.passwordReset.create.mock.results[0].value;
    prisma.passwordReset.findUnique.mockResolvedValue(createdReset);

    await service.resetPassword({ resetId, token, password: 'FirstReset1!' });
    expect(storedVersion.current).toBe(2);

    const forgot2 = await service.forgotPassword('admin@sbos.health');
    const link2 = forgot2.previewLink!;
    const resetId2 = link2.split('resetId=')[1].split('&')[0];
    const token2 = link2.split('token=')[1];
    const createdReset2 = await prisma.passwordReset.create.mock.results[1].value;
    prisma.passwordReset.findUnique.mockResolvedValue(createdReset2);
    await service.resetPassword({
      resetId: resetId2,
      token: token2,
      password: 'SecondReset1!',
    });
    expect(storedVersion.current).toBe(3);
  });
});

describe('AuthService.issueTokens embeds passwordVersion', () => {
  it('signAsync access payload includes passwordVersion from user entity', async () => {
    const { service, usersService, jwtService, prisma } = makeService({
      usersService: {
        validateCredentials: vi.fn().mockResolvedValue({
          ...testUser,
          passwordVersion: 7,
        }),
        getMfaState: vi.fn().mockResolvedValue({ mfaEnabled: false, mfaSecret: null }),
      },
    });

    await service.login({
      email: 'clinician@sbos.health',
      password: 'x',
    } as never);

    expect(jwtService.signAsync).toHaveBeenCalled();
    const accessCall = jwtService.signAsync.mock.calls.find(
      (c: unknown[]) => (c[0] as { type?: string }).type === 'access',
    );
    expect(accessCall).toBeTruthy();
    expect(accessCall![0]).toEqual(
      expect.objectContaining({
        type: 'access',
        passwordVersion: 7,
        sub: 'u1',
      }),
    );
  });
});

describe('AuthService.acceptInvite atomic claim', () => {
  const inviteRow = {
    id: 'inv1',
    organizationId: 'org1',
    email: 'newhire@sbos.health',
    role: 'CLINICIAN',
    tokenHash: '',
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    usedAt: null as Date | null,
  };

  async function hashToken(token: string) {
    return bcrypt.hash(token, 4);
  }

  it('claims invite via updateMany, creates user inside the same transaction', async () => {
    const token = 'invite-secret-token';
    const tokenHash = await hashToken(token);
    const invite = { ...inviteRow, tokenHash };

    const tx = {
      userInvite: {
        findUnique: vi.fn().mockResolvedValue(invite),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const $transaction = vi.fn(async (fn: (t: typeof tx) => Promise<void>) => fn(tx));
    const create = vi.fn().mockResolvedValue({ id: 'u-new' });

    const { service, usersService } = makeService({
      usersService: { create } as never,
      prisma: { $transaction, userInvite: { findUnique: vi.fn(), updateMany: vi.fn() } },
    });

    await expect(
      service.acceptInvite({
        inviteId: 'inv1',
        token,
        password: 'SecurePass1!',
        name: 'New Hire',
      }),
    ).resolves.toEqual({ success: true });

    expect($transaction).toHaveBeenCalledTimes(1);
    expect(tx.userInvite.findUnique).toHaveBeenCalledWith({ where: { id: 'inv1' } });
    expect(tx.userInvite.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'inv1',
        usedAt: null,
        expiresAt: { gt: expect.any(Date) },
      },
      data: { usedAt: expect.any(Date) },
    });
    expect(create).toHaveBeenCalledWith(
      'org1',
      Role.CLINICIAN,
      {
        email: 'newhire@sbos.health',
        password: 'SecurePass1!',
        name: 'New Hire',
        role: Role.CLINICIAN,
      },
      tx,
    );
  });

  it('rejects when concurrent claim loses (updateMany count 0) without creating a user', async () => {
    const token = 'invite-secret-token';
    const tokenHash = await hashToken(token);
    const invite = { ...inviteRow, tokenHash };

    const tx = {
      userInvite: {
        findUnique: vi.fn().mockResolvedValue(invite),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const $transaction = vi.fn(async (fn: (t: typeof tx) => Promise<void>) => fn(tx));
    const create = vi.fn();

    const { service } = makeService({
      usersService: { create } as never,
      prisma: { $transaction },
    });

    await expect(
      service.acceptInvite({
        inviteId: 'inv1',
        token,
        password: 'SecurePass1!',
        name: 'New Hire',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(tx.userInvite.updateMany).toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects already-used invite before claim/create (sequential replay)', async () => {
    const token = 'invite-secret-token';
    const tokenHash = await hashToken(token);
    const invite = {
      ...inviteRow,
      tokenHash,
      usedAt: new Date(),
    };

    const tx = {
      userInvite: {
        findUnique: vi.fn().mockResolvedValue(invite),
        updateMany: vi.fn(),
      },
    };
    const $transaction = vi.fn(async (fn: (t: typeof tx) => Promise<void>) => fn(tx));
    const create = vi.fn();

    const { service } = makeService({
      usersService: { create } as never,
      prisma: { $transaction },
    });

    await expect(
      service.acceptInvite({
        inviteId: 'inv1',
        token,
        password: 'SecurePass1!',
        name: 'New Hire',
      }),
    ).rejects.toThrow(/already used/i);

    expect(tx.userInvite.updateMany).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it('two concurrent acceptInvite simulations: only the first claim creates a user', async () => {
    const token = 'invite-secret-token';
    const tokenHash = await hashToken(token);
    const invite = { ...inviteRow, tokenHash };

    let claimCount = 0;
    const makeTx = () => ({
      userInvite: {
        findUnique: vi.fn().mockResolvedValue(invite),
        updateMany: vi.fn().mockImplementation(async () => {
          if (claimCount === 0) {
            claimCount = 1;
            return { count: 1 };
          }
          return { count: 0 };
        }),
      },
    });

    const $transaction = vi.fn(async (fn: (t: ReturnType<typeof makeTx>) => Promise<void>) =>
      fn(makeTx()),
    );
    const create = vi.fn().mockResolvedValue({ id: 'u-new' });

    const { service } = makeService({
      usersService: { create } as never,
      prisma: { $transaction },
    });

    const dto = {
      inviteId: 'inv1',
      token,
      password: 'SecurePass1!',
      name: 'New Hire',
    };

    const results = await Promise.allSettled([
      service.acceptInvite(dto),
      service.acceptInvite(dto),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(
      BadRequestException,
    );
    expect(create).toHaveBeenCalledTimes(1);
    expect(claimCount).toBe(1);
  });
});
