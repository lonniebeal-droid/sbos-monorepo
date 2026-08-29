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
});
