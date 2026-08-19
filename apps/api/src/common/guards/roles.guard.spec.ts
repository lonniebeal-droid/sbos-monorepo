import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';

import { RolesGuard } from './roles.guard';
import { ROLES_KEY } from '../decorators/roles.decorator';
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

  it('allows when the required-roles metadata is an empty array', () => {
    const guard = guardWithRequiredRoles([]);
    expect(guard.canActivate(contextWithUser(undefined))).toBe(true);
  });

  it('allows an exact role match, not just a strictly higher one', () => {
    const guard = guardWithRequiredRoles([Role.CLINICIAN]);
    expect(
      guard.canActivate(contextWithUser({ role: Role.CLINICIAN })),
    ).toBe(true);
  });

  it('allows a role that satisfies any one of several required roles', () => {
    const guard = guardWithRequiredRoles([Role.ORG_ADMIN, Role.BILLING]);
    expect(
      guard.canActivate(contextWithUser({ role: Role.BILLING })),
    ).toBe(true);
  });

  it('rejects a role that satisfies none of several required roles', () => {
    const guard = guardWithRequiredRoles([Role.ORG_ADMIN, Role.SUPERVISOR]);
    expect(() =>
      guard.canActivate(contextWithUser({ role: Role.FRONT_DESK })),
    ).toThrow(ForbiddenException);
  });

  it('reads required roles from the route metadata via ROLES_KEY', () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(undefined),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    const context = contextWithUser(undefined);

    guard.canActivate(context);

    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
  });
});
