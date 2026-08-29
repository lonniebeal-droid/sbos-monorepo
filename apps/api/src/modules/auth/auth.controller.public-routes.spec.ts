import { describe, expect, it } from 'vitest';
import 'reflect-metadata';

import { AuthController } from './auth.controller';

/**
 * Regression: POST /auth/login was missing @Public(), so the global
 * JwtAuthGuard rejected every login request with a generic 401 before
 * credentials were ever checked (password reset then appeared broken).
 * Every pre-authentication route must stay public.
 */
describe('AuthController public routes', () => {
  const IS_PUBLIC_KEY = 'isPublic';
  type ControllerMethod = keyof AuthController;
  const isPublic = (method: ControllerMethod) =>
    Reflect.getMetadata(
      IS_PUBLIC_KEY,
      AuthController.prototype[method] as object,
    );

  it.each([
    'bootstrap',
    'login',
    'loginMfa',
    'refresh',
    'logout',
    'acceptInvite',
    'forgot',
    'reset',
  ] as const satisfies readonly ControllerMethod[])(
    '%s is publicly accessible (no JWT required)',
    (method) => {
      expect(isPublic(method)).toBe(true);
    },
  );

  it('authenticated-only routes are NOT marked public', () => {
    expect(isPublic('mfaSetup')).toBeUndefined();
    expect(isPublic('profile')).toBeUndefined();
  });
});
