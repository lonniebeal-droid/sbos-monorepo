import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import * as bcrypt from 'bcryptjs';
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
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    userInvite: {
      findUnique: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    clinician: {
      create: vi.fn().mockResolvedValue({}),
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

  return { service, usersService, jwtService, mfaService, prisma, audit };
}

describe('AuthService.login', () => {
  it('issues tokens and audits LOGIN for a valid non-MFA login', async () => {
    const { service, usersService, jwtService, prisma, audit } = makeService({
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
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: testUser.organizationId,
        actorId: testUser.id,
        action: AuditAction.LOGIN,
        entityType: 'User',
        entityId: testUser.id,
        metadata: { method: 'password' },
      }),
    );
    expect(result).toMatchObject({
      accessToken: 'signed.jwt.token',
      refreshToken: 'signed.jwt.token',
      user: testUser,
    });
  });

  it('returns MFA challenge without LOGIN audit when MFA is enabled', async () => {
    const { service, jwtService, prisma, audit } = makeService({
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
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('does not audit LOGIN on rejected credentials', async () => {
    const { service, jwtService, audit } = makeService({
      usersService: { validateCredentials: vi.fn().mockResolvedValue(null) },
    });
    await expect(
      service.login({ email: 'clinician@sbos.health', password: 'wrong' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(jwtService.signAsync).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });
});

describe('AuthService.loginMfa', () => {
  it('issues tokens and audits LOGIN after valid MFA', async () => {
    const { service, mfaService, prisma, audit } = makeService({
      jwtService: {
        verifyAsync: vi.fn().mockResolvedValue({ sub: 'u1', type: 'mfa' }),
      },
      usersService: {
        getMfaState: vi.fn().mockResolvedValue({ mfaEnabled: true, mfaSecret: 'secret' }),
      },
    });
    const result = await service.loginMfa('mfa.challenge.token', '123456');
    expect(mfaService.verify).toHaveBeenCalledWith('123456', 'secret');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.LOGIN,
        metadata: { method: 'mfa' },
      }),
    );
    expect(prisma.refreshToken.create).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ user: testUser });
  });

  it('does not audit LOGIN on invalid MFA code', async () => {
    const { service, prisma, audit } = makeService({
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
    expect(audit.record).not.toHaveBeenCalled();
  });
});

describe('AuthService.logout', () => {
  it('audits LOGOUT when a refresh token is actually revoked', async () => {
    const { service, prisma, audit } = makeService({
      jwtService: {
        verifyAsync: vi.fn().mockResolvedValue({
          sub: 'u1',
          type: 'refresh',
          jti: 'jti-1',
          organizationId: 'org1',
        }),
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
    const result = await service.logout('some.refresh.token');
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { jti: 'jti-1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org1',
        actorId: 'u1',
        action: AuditAction.LOGOUT,
        entityType: 'User',
        entityId: 'u1',
      }),
    );
    expect(result).toEqual({ success: true });
  });

  it('does not audit LOGOUT for invalid tokens', async () => {
    const { service, prisma, audit } = makeService({
      jwtService: { verifyAsync: vi.fn().mockRejectedValue(new Error('invalid')) },
    });
    const result = await service.logout('garbage');
    expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
    expect(result).toEqual({ success: true });
  });
});

describe('AuthService.resetPassword', () => {
  it('writes new password hash and audits credential change', async () => {
    vi.useFakeTimers();
    try {
      const storedHash = { current: '$2a$10$originalhash' };
      let resetSeq = 0;
      const passwordReset = {
        create: vi.fn().mockImplementation(({ data }) =>
          Promise.resolve({ id: `reset-${++resetSeq}`, ...data })),
        findUnique: vi.fn(),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      };
      const user = {
        findFirst: vi.fn().mockResolvedValue({
          id: 'u1',
          email: 'admin@sbos.health',
          organizationId: 'org1',
        }),
        findUnique: vi.fn().mockResolvedValue({
          id: 'u1',
          email: 'admin@sbos.health',
          organizationId: 'org1',
        }),
        update: vi.fn().mockImplementation(({ data }: { data: { passwordHash: string } }) => {
          storedHash.current = data.passwordHash;
          return Promise.resolve({});
        }),
      };
      const refreshToken = {
        create: vi.fn().mockResolvedValue({}),
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      };
      const tx = { passwordReset, user, refreshToken };
      const prisma = {
        user,
        passwordReset,
        refreshToken,
        $transaction: vi.fn().mockImplementation(async (fn: (tx: typeof tx) => unknown) => fn(tx)),
      };
      const { service, audit } = makeService({ prisma });

      const forgot = await service.forgotPassword('admin@sbos.health');
      const link = forgot.previewLink!;
      const resetId = link.split('resetId=')[1].split('&')[0];
      const token = link.split('token=')[1];
      const createdReset = await passwordReset.create.mock.results[0].value;
      passwordReset.findUnique.mockResolvedValue(createdReset);

      await service.resetPassword({ resetId, token, password: 'NewAdmin1!' });

      expect(await bcrypt.compare('NewAdmin1!', storedHash.current)).toBe(true);
      expect(passwordReset.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: resetId, usedAt: null }),
          data: { usedAt: expect.any(Date) },
        }),
      );
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: 'org1',
          actorId: 'u1',
          action: AuditAction.UPDATE,
          metadata: expect.objectContaining({ credentialChange: 'password_reset' }),
        }),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('rejects a second concurrent claim with controlled already-used error', async () => {
    const token = 'plain-reset-token';
    const tokenHash = await bcrypt.hash(token, 10);
    const resetRow = {
      id: 'reset-1',
      userId: 'u1',
      tokenHash,
      usedAt: null as Date | null,
      expiresAt: new Date(Date.now() + 60_000),
    };
    let claimCount = 0;
    const passwordReset = {
      findUnique: vi.fn().mockResolvedValue(resetRow),
      updateMany: vi.fn().mockImplementation(async () => {
        claimCount += 1;
        if (claimCount === 1) {
          resetRow.usedAt = new Date();
          return { count: 1 };
        }
        return { count: 0 };
      }),
    };
    const user = {
      findUnique: vi.fn().mockResolvedValue({
        id: 'u1',
        email: 'admin@sbos.health',
        organizationId: 'org1',
      }),
      update: vi.fn().mockResolvedValue({}),
    };
    const refreshToken = { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) };
    const tx = { passwordReset, user, refreshToken };
    const prisma = {
      user,
      passwordReset,
      refreshToken,
      $transaction: vi.fn().mockImplementation(async (fn: (tx: typeof tx) => unknown) => fn(tx)),
    };
    const { service, audit } = makeService({ prisma });

    await service.resetPassword({
      resetId: 'reset-1',
      token,
      password: 'NewAdmin1!',
    });
    await expect(
      service.resetPassword({
        resetId: 'reset-1',
        token,
        password: 'OtherPass1!',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(user.update).toHaveBeenCalledTimes(1);
    expect(audit.record).toHaveBeenCalledTimes(1);
  });
});

describe('AuthService MFA audit', () => {
  it('audits MFA enable', async () => {
    const { service, audit } = makeService({
      usersService: {
        getMfaState: vi.fn().mockResolvedValue({ mfaEnabled: false, mfaSecret: 'secret' }),
      },
      mfaService: { verify: vi.fn().mockReturnValue(true) },
    });
    await service.mfaEnable('u1', '123456');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.UPDATE,
        metadata: { mfaEnabled: true },
      }),
    );
  });

  it('audits MFA disable', async () => {
    const { service, audit } = makeService({
      usersService: {
        getMfaState: vi.fn().mockResolvedValue({ mfaEnabled: true, mfaSecret: 'secret' }),
      },
      mfaService: { verify: vi.fn().mockReturnValue(true) },
    });
    await service.mfaDisable('u1', '123456');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.UPDATE,
        metadata: { mfaEnabled: false },
      }),
    );
  });
});

describe('AuthService.bootstrap audit', () => {
  it('audits Organization CREATE after successful bootstrap', async () => {
    const prev = process.env.BOOTSTRAP_TOKEN;
    process.env.BOOTSTRAP_TOKEN = 'boot-secret';
    try {
      const { service, prisma, audit, usersService } = makeService({
        prisma: {
          user: { findFirst: vi.fn().mockResolvedValue(null) },
          organization: {
            create: vi.fn().mockResolvedValue({
              id: 'org-new',
              name: 'New Clinic',
              slug: 'new-clinic',
            }),
          },
          refreshToken: {
            create: vi.fn(),
            findUnique: vi.fn(),
            update: vi.fn(),
            updateMany: vi.fn(),
          },
        },
      });
      await service.bootstrap({
        organizationName: 'New Clinic',
        organizationSlug: 'new-clinic',
        adminEmail: 'admin@new.clinic',
        adminPassword: 'AdminPass1!',
        token: 'boot-secret',
      });
      expect(prisma.organization.create).toHaveBeenCalled();
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: 'org-new',
          action: AuditAction.CREATE,
          entityType: 'Organization',
          entityId: 'org-new',
          metadata: expect.objectContaining({ source: 'bootstrap' }),
        }),
      );
      expect(usersService.create).toHaveBeenCalled();
    } finally {
      if (prev === undefined) delete process.env.BOOTSTRAP_TOKEN;
      else process.env.BOOTSTRAP_TOKEN = prev;
    }
  });

  it('does not audit on invalid bootstrap token', async () => {
    const prev = process.env.BOOTSTRAP_TOKEN;
    process.env.BOOTSTRAP_TOKEN = 'boot-secret';
    try {
      const { service, audit, prisma } = makeService({
        prisma: {
          user: { findFirst: vi.fn() },
          organization: { create: vi.fn() },
          refreshToken: {
            create: vi.fn(),
            findUnique: vi.fn(),
            update: vi.fn(),
            updateMany: vi.fn(),
          },
        },
      });
      await expect(
        service.bootstrap({
          organizationName: 'X',
          organizationSlug: 'x',
          adminEmail: 'a@b.c',
          adminPassword: 'AdminPass1!',
          token: 'wrong',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(prisma.organization.create).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    } finally {
      if (prev === undefined) delete process.env.BOOTSTRAP_TOKEN;
      else process.env.BOOTSTRAP_TOKEN = prev;
    }
  });
});
