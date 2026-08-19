import type { ExecutionContext } from '@nestjs/common';
import { UnauthorizedException } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { JwtAuthGuard } from './jwt-auth.guard';

function makeContext(): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({}) }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;
}

function guardWithIsPublic(isPublic: boolean | undefined): JwtAuthGuard {
  const reflector = {
    getAllAndOverride: vi.fn().mockReturnValue(isPublic),
  } as unknown as Reflector;
  return new JwtAuthGuard(reflector);
}

/**
 * JwtAuthGuard owns exactly one decision: whether to short-circuit on
 * @Public() routes. Everything else -- extracting/validating the bearer JWT,
 * rejecting a missing/malformed/expired token or an inactive user -- is
 * delegated to Passport's AuthGuard('jwt') base class (and beneath that, the
 * JwtStrategy), which is out of scope for this guard's own unit tests. We spy
 * on the exact base-class method JwtAuthGuard delegates to and assert the
 * delegation happens (or does not happen) correctly, without re-testing
 * Passport's own behavior or inventing logic this guard does not have.
 */
describe('JwtAuthGuard', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('short-circuits to true on a @Public() route without delegating to Passport', () => {
    const guard = guardWithIsPublic(true);
    const baseCanActivate = vi.spyOn(
      Object.getPrototypeOf(JwtAuthGuard.prototype),
      'canActivate',
    );

    const result = guard.canActivate(makeContext());

    expect(result).toBe(true);
    expect(baseCanActivate).not.toHaveBeenCalled();
  });

  it('delegates to Passport and allows the request when a valid user/session is present', () => {
    const guard = guardWithIsPublic(undefined);
    const baseCanActivate = vi
      .spyOn(Object.getPrototypeOf(JwtAuthGuard.prototype), 'canActivate')
      .mockReturnValue(true);
    const context = makeContext();

    const result = guard.canActivate(context);

    expect(baseCanActivate).toHaveBeenCalledWith(context);
    expect(result).toBe(true);
  });

  it('delegates to Passport and rejects when the base guard rejects (missing/invalid session)', () => {
    const guard = guardWithIsPublic(false);
    const baseCanActivate = vi
      .spyOn(Object.getPrototypeOf(JwtAuthGuard.prototype), 'canActivate')
      .mockReturnValue(false);
    const context = makeContext();

    const result = guard.canActivate(context);

    expect(baseCanActivate).toHaveBeenCalledWith(context);
    expect(result).toBe(false);
  });

  it('propagates a rejection thrown by the base guard for a missing/malformed token', () => {
    const guard = guardWithIsPublic(undefined);
    vi.spyOn(Object.getPrototypeOf(JwtAuthGuard.prototype), 'canActivate').mockImplementation(
      () => {
        throw new UnauthorizedException();
      },
    );

    expect(() => guard.canActivate(makeContext())).toThrow(UnauthorizedException);
  });
});
