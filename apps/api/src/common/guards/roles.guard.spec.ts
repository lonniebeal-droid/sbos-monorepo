import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';

import { RolesGuard } from './roles.guard';
import { Role } from '../enums/role.enum';

function contextWithUser(user: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;
}

function guardWithRequiredRoles(roles: Role[] | undefined): RolesGuard {
  const reflector = {
    getAllAndOverride: vi.fn().mockReturnValue(roles),
  } as unknown as Reflector;
  return new RolesGuard(reflector);
}

describe('RolesGuard', () => {
  it('allows when no roles are required', () => {
    const guard = guardWithRequiredRoles(undefined);
    expect(guard.canActivate(contextWithUser(undefined))).toBe(true);
  });

  it('allows a higher role to satisfy a lower requirement', () => {
    const guard = guardWithRequiredRoles([Role.CLINICIAN]);
    expect(
      guard.canActivate(contextWithUser({ role: Role.ORG_ADMIN })),
    ).toBe(true);
  });

  it('rejects a lower role for a higher requirement', () => {
    const guard = guardWithRequiredRoles([Role.ORG_ADMIN]);
    expect(() =>
      guard.canActivate(contextWithUser({ role: Role.CLINICIAN })),
    ).toThrow(ForbiddenException);
  });

  it('rejects when unauthenticated but a role is required', () => {
    const guard = guardWithRequiredRoles([Role.FRONT_DESK]);
    expect(() => guard.canActivate(contextWithUser(undefined))).toThrow(
      ForbiddenException,
    );
  });

  it('enforces BILLING requirement: allows BILLING, rejects CLINICIAN', () => {
    const guard = guardWithRequiredRoles([Role.BILLING]);
    expect(guard.canActivate(contextWithUser({ role: Role.BILLING }))).toBe(true);
    expect(() => guard.canActivate(contextWithUser({ role: Role.CLINICIAN }))).toThrow(
      ForbiddenException,
    );
  });
});
