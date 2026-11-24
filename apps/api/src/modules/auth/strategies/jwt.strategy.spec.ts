import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';

import type { AppConfig } from '../../../config/configuration';
import { Role } from '../../../common/enums/role.enum';
import type { JwtPayload } from '../../../common/interfaces/authenticated-user.interface';
import type { UsersService } from '../../users/users.service';
import { JwtStrategy } from './jwt.strategy';

function makeStrategy(usersService?: Partial<UsersService>): JwtStrategy {
  const configService = {
    get: vi.fn().mockReturnValue({
      accessSecret: 'test-access-secret',
      refreshSecret: 'test-refresh-secret',
      accessExpiresIn: '15m',
      refreshExpiresIn: '7d',
    }),
  } as unknown as ConfigService<AppConfig, true>;
  const users = {
    findActiveById: vi.fn().mockResolvedValue({
      id: 'u1',
      email: 'clinician@sbos.health',
      name: 'Riley Chen',
      role: Role.CLINICIAN,
      organizationId: 'org1',
      passwordVersion: 1,
    }),
    ...usersService,
  } as unknown as UsersService;
  return new JwtStrategy(configService, users);
}

const basePayload: JwtPayload = {
  sub: 'u1',
  email: 'clinician@sbos.health',
  name: 'Riley Chen',
  role: Role.CLINICIAN,
  organizationId: 'org1',
  type: 'access',
  passwordVersion: 1,
};

describe('JwtStrategy.validate', () => {
  it('maps an ACTIVE user onto AuthenticatedUser from the database', async () => {
    const strategy = makeStrategy();

    const result = await strategy.validate(basePayload);

    expect(result).toEqual({
      id: 'u1',
      email: 'clinician@sbos.health',
      name: 'Riley Chen',
      role: Role.CLINICIAN,
      organizationId: 'org1',
    });
  });

  it('returns current DB role/org instead of stale JWT claims', async () => {
    const strategy = makeStrategy({
      findActiveById: vi.fn().mockResolvedValue({
        id: 'u1',
        email: 'clinician@sbos.health',
        name: 'Riley Chen',
        role: Role.SUPERVISOR,
        organizationId: 'org-moved',
        passwordVersion: 1,
      }),
    });
    const stale = {
      ...basePayload,
      role: Role.CLINICIAN,
      organizationId: 'org1',
    };

    const result = await strategy.validate(stale);

    expect(result.role).toBe(Role.SUPERVISOR);
    expect(result.organizationId).toBe('org-moved');
  });

  it('throws UnauthorizedException for a refresh token presented as an access token', async () => {
    const strategy = makeStrategy();
    const refreshPayload = {
      ...basePayload,
      type: 'refresh' as const,
      jti: 'jti-1',
    };

    await expect(strategy.validate(refreshPayload)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a well-formed access token when the user is missing or inactive', async () => {
    const strategy = makeStrategy({
      findActiveById: vi
        .fn()
        .mockRejectedValue(new Error('User u1 not found')),
    });

    await expect(strategy.validate(basePayload)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects when passwordVersion is missing from the token', async () => {
    const strategy = makeStrategy();
    const { passwordVersion: _drop, ...noVersion } = basePayload;

    await expect(
      strategy.validate(noVersion as JwtPayload),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects when token passwordVersion does not match DB', async () => {
    const strategy = makeStrategy({
      findActiveById: vi.fn().mockResolvedValue({
        id: 'u1',
        email: 'clinician@sbos.health',
        name: 'Riley Chen',
        role: Role.CLINICIAN,
        organizationId: 'org1',
        passwordVersion: 3,
      }),
    });
    const stale = { ...basePayload, passwordVersion: 1 };

    await expect(strategy.validate(stale)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('accepts matching passwordVersion', async () => {
    const strategy = makeStrategy({
      findActiveById: vi.fn().mockResolvedValue({
        id: 'u1',
        email: 'clinician@sbos.health',
        name: 'Riley Chen',
        role: Role.CLINICIAN,
        organizationId: 'org1',
        passwordVersion: 5,
      }),
    });
    const ok = { ...basePayload, passwordVersion: 5 };

    await expect(strategy.validate(ok)).resolves.toMatchObject({ id: 'u1' });
  });
});
