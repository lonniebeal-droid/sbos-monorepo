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

  it('BILLING satisfies BILLING requirement', () => {
    const guard = guardWithRequiredRoles([Role.BILLING]);
    expect(guard.canActivate(contextWithUser({ role: Role.BILLING }))).toBe(true);
  });

  it('CLINICIAN does NOT satisfy BILLING requirement (isolated functional roles)', () => {
    const guard = guardWithRequiredRoles([Role.BILLING]);
    expect(() =>
      guard.canActivate(contextWithUser({ role: Role.CLINICIAN })),
    ).toThrow(ForbiddenException);
  });

  it('FRONT_DESK does NOT satisfy BILLING requirement', () => {
    const guard = guardWithRequiredRoles([Role.BILLING]);
    expect(() =>
      guard.canActivate(contextWithUser({ role: Role.FRONT_DESK })),
    ).toThrow(ForbiddenException);
  });

  it('FRONT_DESK satisfies FRONT_DESK requirement', () => {
    const guard = guardWithRequiredRoles([Role.FRONT_DESK]);
    expect(guard.canActivate(contextWithUser({ role: Role.FRONT_DESK }))).toBe(true);
  });

  it('CLINICIAN does NOT satisfy FRONT_DESK requirement (isolated functional roles)', () => {
    const guard = guardWithRequiredRoles([Role.FRONT_DESK]);
    expect(() =>
      guard.canActivate(contextWithUser({ role: Role.CLINICIAN })),
    ).toThrow(ForbiddenException);
  });

  it('BILLING does NOT satisfy CLINICIAN requirement', () => {
    const guard = guardWithRequiredRoles([Role.CLINICIAN]);
    expect(() =>
      guard.canActivate(contextWithUser({ role: Role.BILLING })),
    ).toThrow(ForbiddenException);
  });

  it('FRONT_DESK does NOT satisfy CLINICIAN requirement', () => {
    const guard = guardWithRequiredRoles([Role.CLINICIAN]);
    expect(() =>
      guard.canActivate(contextWithUser({ role: Role.FRONT_DESK })),
    ).toThrow(ForbiddenException);
  });

  it('SUPER_ADMIN satisfies all functional roles', () => {
    for (const role of [
      Role.ORG_ADMIN,
      Role.SUPERVISOR,
      Role.CLINICIAN,
      Role.BILLING,
      Role.FRONT_DESK,
    ]) {
      const guard = guardWithRequiredRoles([role]);
      expect(
        guard.canActivate(contextWithUser({ role: Role.SUPER_ADMIN })),
      ).toBe(true);
    }
  });
});
