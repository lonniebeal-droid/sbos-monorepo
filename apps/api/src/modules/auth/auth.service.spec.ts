import { NotFoundException, UnauthorizedException } from '@nestjs/common';
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
};

function makeService(overrides?: {
  usersService?: Partial<UsersService>;
  jwtService?: Record<string, unknown>;
  mfaService?: Record<string, unknown>;
  prisma?: Record<string, unknown>;
  audit?: { record: ReturnType<typeof vi.fn> };
}) {
  const usersService = {
    validateCredentials: vi.fn(),
    getMfaState: vi.fn().mockResolvedValue({ mfaEnabled: false, mfaSecret: null }),
    findById: vi.fn().mockResolvedValue(testUser),
    findActiveById: vi.fn().mockResolvedValue(testUser),
    setMfaEnabled: vi.fn().mockResolvedValue(undefined),
    setMfaSecret: vi.fn().mockResolvedValue(undefined),
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
    ...overrides?.prisma,
  };

  const audit = overrides?.audit ?? { record: vi.fn().mockResolvedValue(undefined) };

  const service = new AuthService(
    usersService,
    jwtService as never,
    configService as never,
    mfaService as never,
    prisma as never,
    audit as never,
  );

  return { service, usersService, jwtService, mfaService, prisma, audit };
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
  });

  it('returns an MFA challenge when the user has MFA enabled', async () => {
    const { service, jwtService } = makeService({
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
  });

  it('rejects invalid credentials', async () => {
    const { service } = makeService({
      usersService: { validateCredentials: vi.fn().mockResolvedValue(null) },
    });

    await expect(
      service.login({ email: 'x@y.z', password: 'nope' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

describe('AuthService.loginMfa', () => {
  it('issues tokens after a valid MFA code', async () => {
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
    expect(result).toMatchObject({ accessToken: 'signed.jwt.token', user: testUser });
    expect(prisma.refreshToken.create).toHaveBeenCalled();
  });

  it('rejects an invalid MFA code', async () => {
    const { service } = makeService({
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
  });
});

describe('AuthService.refresh', () => {
  it('rotates a valid refresh token', async () => {
    const { service, prisma, jwtService } = makeService({
      jwtService: {
        verifyAsync: vi.fn().mockResolvedValue({
          sub: 'u1',
          type: 'refresh',
          jti: 'jti-1',
          email: testUser.email,
          name: testUser.name,
          role: testUser.role,
          organizationId: testUser.organizationId,
        }),
      },
      prisma: {
        refreshToken: {
          create: vi.fn().mockResolvedValue({}),
          findUnique: vi.fn().mockResolvedValue({ jti: 'jti-1', userId: 'u1', revokedAt: null }),
          update: vi.fn().mockResolvedValue({}),
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        },
      },
    });

    const result = await service.refresh('valid.refresh.token');
    expect(result).toMatchObject({ accessToken: 'signed.jwt.token', refreshToken: 'signed.jwt.token' });
    expect(prisma.refreshToken.update).toHaveBeenCalled();
    expect(jwtService.signAsync).toHaveBeenCalledTimes(2);
  });

  it('revokes the family on refresh-token reuse', async () => {
    const { service, prisma } = makeService({
      jwtService: {
        verifyAsync: vi.fn().mockResolvedValue({
          sub: 'u1',
          type: 'refresh',
          jti: 'jti-reused',
        }),
      },
      prisma: {
        refreshToken: {
          create: vi.fn().mockResolvedValue({}),
          findUnique: vi.fn().mockResolvedValue({
            jti: 'jti-reused',
            userId: 'u1',
            revokedAt: new Date(),
          }),
          update: vi.fn().mockResolvedValue({}),
          updateMany: vi.fn().mockResolvedValue({ count: 2 }),
        },
      },
    });

    await expect(service.refresh('reused.refresh.token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'u1', revokedAt: null } }),
    );
  });
});

describe('AuthService.logout', () => {
  it('revokes the presented refresh token when valid', async () => {
    const { service, prisma } = makeService({
      jwtService: {
        verifyAsync: vi.fn().mockResolvedValue({ sub: 'u1', type: 'refresh', jti: 'jti-x' }),
      },
      prisma: {
        refreshToken: {
          create: vi.fn().mockResolvedValue({}),
          findUnique: vi.fn(),
          update: vi.fn().mockResolvedValue({}),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
      },
    });

    await expect(service.logout('some.refresh.token')).resolves.toEqual({ success: true });
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { jti: 'jti-x', revokedAt: null } }),
    );
  });

  it('is silent on invalid tokens', async () => {
    const { service } = makeService({
      jwtService: {
        verifyAsync: vi.fn().mockRejectedValue(new Error('bad')),
      },
    });
    await expect(service.logout('garbage')).resolves.toEqual({ success: true });
  });
});

describe('AuthService.profile', () => {
  it('returns the user entity', async () => {
    const { service, usersService } = makeService();
    await expect(service.profile('u1')).resolves.toEqual(testUser);
    expect(usersService.findById).toHaveBeenCalledWith('u1');
  });

  it('propagates NotFoundException', async () => {
    const { service } = makeService({
      usersService: {
        findById: vi.fn().mockRejectedValue(new NotFoundException('missing')),
      },
    });
    await expect(service.profile('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('AuthService.resetPassword — regression: reset → new password works, old password fails', () => {
  function makeResetService() {
    const storedHash = { current: '$2a$10$originalhash' };
    let resetSeq = 0;
    const prisma = {
      user: {
        findFirst: vi.fn().mockResolvedValue({ id: 'u1', email: 'admin@sbos.health', organizationId: 'org1' }),
        findUnique: vi.fn().mockResolvedValue({ id: 'u1', email: 'admin@sbos.health', organizationId: 'org1' }),
        // Capture exactly what resetPassword persists, as the DB would.
        update: vi.fn().mockImplementation(({ data }: { data: { passwordHash: string } }) => {
          storedHash.current = data.passwordHash;
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
    };
    const { service, audit } = makeService({ prisma });
    return { service, prisma, storedHash, audit };
  }

  it('forgot → reset writes a hash of the NEW password only; new verifies, old does not', async () => {
    vi.useFakeTimers();
    try {
      const { service, prisma, storedHash, audit } = makeResetService();

      const forgot = await service.forgotPassword('admin@sbos.health');
      const link = forgot.previewLink;
      expect(link).toBeTruthy();
      const resetId = link!.split('resetId=')[1].split('&')[0];
      const token = link!.split('token=')[1];
      const createdReset = await prisma.passwordReset.create.mock.results[0].value;

      prisma.passwordReset.findUnique.mockResolvedValue(createdReset);

      await service.resetPassword({ resetId, token, password: 'NewAdmin1!' });

      // The persisted hash must verify against the NEW password…
      const newOk = await bcrypt.compare('NewAdmin1!', storedHash.current);
      expect(newOk).toBe(true);
      // …and must NOT verify against any previously used password.
      const oldOk = await bcrypt.compare('Admin123!', storedHash.current);
      expect(oldOk).toBe(false);
      const oldOk2 = await bcrypt.compare('AdminPass123!', storedHash.current);
      expect(oldOk2).toBe(false);

      // Reset is single-use and refresh sessions are revoked.
      expect(prisma.passwordReset.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: createdReset.id }, data: expect.objectContaining({ usedAt: expect.any(Date) }) }),
      );
      expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { userId: createdReset.userId } });
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: 'org1',
          actorId: 'u1',
          action: 'UPDATE',
          entityType: 'User',
          entityId: 'u1',
          metadata: expect.objectContaining({ credentialChange: 'password_reset' }),
        }),
      );

      // A second use of the same reset must be rejected.
      prisma.passwordReset.findUnique.mockResolvedValue({ ...createdReset, usedAt: new Date() });
      await expect(
        service.resetPassword({ resetId, token, password: 'Again1!' }),
      ).rejects.toThrow('Reset token already used');
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('AuthService MFA — audit on enable/disable', () => {
  it('records an audit entry when MFA is enabled', async () => {
    const { service, audit, usersService } = makeService({
      usersService: {
        getMfaState: vi.fn().mockResolvedValue({ mfaEnabled: false, mfaSecret: 'secret' }),
      },
    });
    await service.mfaEnable('u1', '123456');
    expect(usersService.setMfaEnabled).toHaveBeenCalledWith('u1', true);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org1',
        actorId: 'u1',
        action: 'UPDATE',
        entityType: 'User',
        entityId: 'u1',
        metadata: { mfaEnabled: true },
      }),
    );
  });

  it('records an audit entry when MFA is disabled', async () => {
    const { service, audit, usersService } = makeService({
      usersService: {
        getMfaState: vi.fn().mockResolvedValue({ mfaEnabled: true, mfaSecret: 'secret' }),
      },
    });
    await service.mfaDisable('u1', '123456');
    expect(usersService.setMfaEnabled).toHaveBeenCalledWith('u1', false);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org1',
        actorId: 'u1',
        action: 'UPDATE',
        entityType: 'User',
        entityId: 'u1',
        metadata: { mfaEnabled: false },
      }),
    );
  });
});
