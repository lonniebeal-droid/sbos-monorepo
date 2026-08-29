import { UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';

import { JwtStrategy } from './jwt.strategy';
import type { AppConfig } from '../../../config/configuration';
import { Role } from '../../../common/enums/role.enum';
import type { JwtPayload } from '../../../common/interfaces/authenticated-user.interface';

function makeStrategy(
  usersService = {
    findActiveById: vi.fn().mockResolvedValue({
      id: 'u1',
      email: 'clinician@sbos.health',
      name: 'Riley Chen',
      role: Role.CLINICIAN,
      organizationId: 'org1',
    }),
  },
): JwtStrategy {
  const configService = {
    get: vi.fn().mockReturnValue({
      accessSecret: 'test-access-secret',
      refreshSecret: 'test-refresh-secret',
      accessExpiresIn: '15m',
      refreshExpiresIn: '7d',
    }),
  } as unknown as ConfigService<AppConfig, true>;
  return new JwtStrategy(configService, usersService as never);
}

const basePayload: JwtPayload = {
  sub: 'u1',
  email: 'clinician@sbos.health',
  name: 'Riley Chen',
  role: Role.CLINICIAN,
  organizationId: 'org1',
  type: 'access',
};

/** Passport verifies signature/expiry; this strategy rejects non-access
 * tokens and resolves the current active account before authorizing a route. */
describe('JwtStrategy.validate', () => {
  it('resolves a valid access-token payload to the current active user', async () => {
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
    const refreshPayload = { ...basePayload, type: 'refresh' as const, jti: 'jti-1' };

    await expect(strategy.validate(refreshPayload)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects a signed token after its account is deactivated or deleted', async () => {
    const strategy = makeStrategy({
      findActiveById: vi.fn().mockRejectedValue(new Error('inactive')),
    });

    await expect(strategy.validate(basePayload)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
