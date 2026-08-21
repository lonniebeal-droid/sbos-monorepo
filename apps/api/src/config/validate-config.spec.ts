import { Logger } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { validateRuntimeConfig } from './validate-config';
import type { AppConfig } from './configuration';

function makeConfig(overrides?: Partial<AppConfig['jwt']>): AppConfig {
  return {
    port: 4000,
    corsOrigins: [],
    jwt: {
      accessSecret: 'a-real-strong-access-secret',
      refreshSecret: 'a-real-strong-refresh-secret',
      accessExpiresIn: '15m',
      refreshExpiresIn: '7d',
      ...overrides,
    },
    ai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-fake' },
    stripe: {},
    email: { fromAddress: 'jessie@sbos.health' },
    sms: {},
  };
}

describe('validateRuntimeConfig', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('does nothing when the config is fully valid, in any environment', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('DATABASE_URL', 'postgresql://user:pass@host:5432/db');
    const warnSpy = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    expect(() => validateRuntimeConfig(makeConfig())).not.toThrow();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  describe('in non-production', () => {
    it('warns but does not throw when secrets are left at dev defaults and DATABASE_URL is unset', () => {
      vi.stubEnv('NODE_ENV', 'development');
      vi.stubEnv('DATABASE_URL', '');
      const warnSpy = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

      expect(() =>
        validateRuntimeConfig(
          makeConfig({
            accessSecret: 'sbos-dev-access-secret-change-me',
            refreshSecret: 'sbos-dev-refresh-secret-change-me',
          }),
        ),
      ).not.toThrow();

      expect(warnSpy).toHaveBeenCalledTimes(1);
      const message = warnSpy.mock.calls[0][0] as string;
      expect(message).toContain('JWT_ACCESS_SECRET is unset or using the dev default');
      expect(message).toContain('JWT_REFRESH_SECRET is unset or using the dev default');
      expect(message).toContain('DATABASE_URL is not set');
      expect(message).toContain('allowed in non-production only');
    });
  });

  describe('in production', () => {
    it('throws refusing to start when both secrets are dev defaults', () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('DATABASE_URL', 'postgresql://user:pass@host:5432/db');

      expect(() =>
        validateRuntimeConfig(
          makeConfig({
            accessSecret: 'sbos-dev-access-secret-change-me',
            refreshSecret: 'sbos-dev-refresh-secret-change-me',
          }),
        ),
      ).toThrow(/Refusing to start in production/);
    });

    it('throws when access and refresh secrets are identical, even if neither is a dev default', () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('DATABASE_URL', 'postgresql://user:pass@host:5432/db');

      expect(() =>
        validateRuntimeConfig(
          makeConfig({ accessSecret: 'same-secret-value', refreshSecret: 'same-secret-value' }),
        ),
      ).toThrow(/JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must differ/);
    });

    it('throws when DATABASE_URL is not set, even with strong distinct secrets', () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('DATABASE_URL', '');

      expect(() => validateRuntimeConfig(makeConfig())).toThrow(
        /DATABASE_URL is not set/,
      );
    });

    it('reports only the problems that actually apply, not every possible one', () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('DATABASE_URL', 'postgresql://user:pass@host:5432/db');

      let thrown: Error | undefined;
      try {
        validateRuntimeConfig(
          makeConfig({ accessSecret: 'sbos-dev-access-secret-change-me' }),
        );
      } catch (error) {
        thrown = error as Error;
      }

      expect(thrown?.message).toContain('JWT_ACCESS_SECRET is unset or using the dev default');
      expect(thrown?.message).not.toContain('JWT_REFRESH_SECRET is unset or using the dev default');
      expect(thrown?.message).not.toContain('DATABASE_URL is not set');
    });
  });
});
