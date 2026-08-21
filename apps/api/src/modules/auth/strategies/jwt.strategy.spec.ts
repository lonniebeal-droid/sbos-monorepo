import { UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';

import { JwtStrategy } from './jwt.strategy';
import type { AppConfig } from '../../../config/configuration';
import { Role } from '../../../common/enums/role.enum';
import type { JwtPayload } from '../../../common/interfaces/authenticated-user.interface';

function makeStrategy(): JwtStrategy {
  const configService = {
    get: vi.fn().mockReturnValue({
      accessSecret: 'test-access-secret',
      refreshSecret: 'test-refresh-secret',
      accessExpiresIn: '15m',
      refreshExpiresIn: '7d',
    }),
  } as unknown as ConfigService<AppConfig, true>;
  return new JwtStrategy(configService);
}

const basePayload: JwtPayload = {
  sub: 'u1',
  email: 'clinician@sbos.health',
  name: 'Riley Chen',
  role: Role.CLINICIAN,
  organizationId: 'org1',
  type: 'access',
};

/**
 * JwtStrategy runs after passport-jwt has already verified the token's
 * signature and expiry against jwt.accessSecret. Its own validate() owns
 * exactly two things: rejecting a syntactically-valid token whose `type`
 * claim isn't 'access' (so a refresh or MFA-challenge token can't be reused
 * as an access token), and mapping the trusted payload claims onto
 * AuthenticatedUser. It does NOT look up the user in the database, so there
 * is no "missing user" / "invalid user id" rejection to test here -- see the
 * flagged gap below for the consequence of that design.
 */
describe('JwtStrategy.validate', () => {
  it('maps a valid access-token payload onto AuthenticatedUser', () => {
    const strategy = makeStrategy();

    const result = strategy.validate(basePayload);

    expect(result).toEqual({
      id: 'u1',
      email: 'clinician@sbos.health',
      name: 'Riley Chen',
      role: Role.CLINICIAN,
      organizationId: 'org1',
    });
  });

  it('throws UnauthorizedException for a refresh token presented as an access token', () => {
    const strategy = makeStrategy();
    const refreshPayload = { ...basePayload, type: 'refresh' as const, jti: 'jti-1' };

    expect(() => strategy.validate(refreshPayload)).toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException for a payload missing the type claim entirely', () => {
    const strategy = makeStrategy();
    const { type: _type, ...payloadWithoutType } = basePayload;

    expect(() => strategy.validate(payloadWithoutType as JwtPayload)).toThrow(
      UnauthorizedException,
    );
  });

  it('KNOWN GAP: does not reject a well-formed payload for a user that no longer exists or is inactive', () => {
    // JwtStrategy performs no database lookup at all -- it trusts every claim
    // in an already-signature-verified access token. If this test starts
    // failing because validate() now rejects such a payload, that's a
    // deliberate enforcement change; update/remove this test to match.
    const strategy = makeStrategy();

    const result = strategy.validate(basePayload);

    expect(result.id).toBe('u1');
  });
});
