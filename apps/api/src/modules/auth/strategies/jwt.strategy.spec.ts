import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';

import { JwtStrategy } from './jwt.strategy';
import type { AppConfig } from '../../../config/configuration';
import { Role } from '../../../common/enums/role.enum';
import type { JwtPayload } from '../../../common/interfaces/authenticated-user.interface';
import type { UsersService } from '../../users/users.service';
import type { UserEntity } from '../../users/entities/user.entity';

const activeUser: UserEntity = {
  id: 'u1',
  email: 'clinician@sbos.health',
  firstName: 'Riley',
  lastName: 'Chen',
  name: 'Riley Chen',
  role: Role.CLINICIAN,
  organizationId: 'org1',
  passwordVersion: 3,
  createdAt: '2026-01-01T00:00:00.000Z',
};

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
    findActiveById: vi.fn().mockResolvedValue(activeUser),
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
  passwordVersion: 3,
};

describe('JwtStrategy.validate', () => {
  it('accepts matching passwordVersion and returns current DB role/org', async () => {
    const strategy = makeStrategy({
      findActiveById: vi.fn().mockResolvedValue({
        ...activeUser,
        role: Role.ORG_ADMIN,
        organizationId: 'org-current',
        name: 'DB Name',
      }),
    });

    // Stale role/org in the JWT must not win over the current DB row.
    const result = await strategy.validate({
      ...basePayload,
      role: Role.FRONT_DESK,
      organizationId: 'org-stale',
      name: 'Stale Name',
    });

    expect(result).toEqual({
      id: 'u1',
      email: 'clinician@sbos.health',
      name: 'DB Name',
      role: Role.ORG_ADMIN,
      organizationId: 'org-current',
    });
  });

  it('rejects a refresh token presented as an access token', async () => {
    const strategy = makeStrategy();
    await expect(
      strategy.validate({ ...basePayload, type: 'refresh', jti: 'jti-1' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects missing passwordVersion', async () => {
    const strategy = makeStrategy();
    const payload = { ...basePayload } as JwtPayload;
    // @ts-expect-error intentional missing version
    delete payload.passwordVersion;
    await expect(strategy.validate(payload)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects non-number passwordVersion', async () => {
    const strategy = makeStrategy();
    await expect(
      strategy.validate({
        ...basePayload,
        passwordVersion: '3' as unknown as number,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects stale passwordVersion', async () => {
    const strategy = makeStrategy();
    await expect(
      strategy.validate({ ...basePayload, passwordVersion: 1 }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects suspended/missing users via findActiveById', async () => {
    const strategy = makeStrategy({
      findActiveById: vi.fn().mockRejectedValue(new NotFoundException('gone')),
    });
    await expect(strategy.validate(basePayload)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
