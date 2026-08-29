import { describe, expect, it, afterEach } from 'vitest';

/**
 * configuration() is a pure factory over process.env. These tests prove the
 * env var names documented in .env.example are the ones actually consumed.
 */
describe('configuration — JWT env binding', () => {
  const keys = [
    'JWT_ACCESS_SECRET',
    'JWT_REFRESH_SECRET',
    'JWT_ACCESS_TTL',
    'JWT_REFRESH_TTL',
    'JWT_ACCESS_TTL_SECONDS',
    'JWT_REFRESH_TTL_SECONDS',
    'JESSIE_AGENT_SECRETS',
  ] as const;

  const snapshot: Record<string, string | undefined> = {};

  afterEach(() => {
    for (const k of keys) {
      if (snapshot[k] === undefined) delete process.env[k];
      else process.env[k] = snapshot[k];
      delete snapshot[k];
    }
  });

  function capture(k: string) {
    if (!(k in snapshot)) snapshot[k] = process.env[k];
  }

  async function loadConfig() {
    // Fresh import so the factory re-reads process.env.
    const mod = await import('./configuration');
    return mod.default();
  }

  it('reads JWT_ACCESS_TTL and JWT_REFRESH_TTL duration strings', async () => {
    for (const k of keys) capture(k);
    process.env.JWT_ACCESS_SECRET = 'test-access-secret-not-a-placeholder';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-not-a-placeholder';
    process.env.JWT_ACCESS_TTL = '30m';
    process.env.JWT_REFRESH_TTL = '14d';
    delete process.env.JWT_ACCESS_TTL_SECONDS;
    delete process.env.JWT_REFRESH_TTL_SECONDS;
    delete process.env.JESSIE_AGENT_SECRETS;

    const config = await loadConfig();
    expect(config.jwt.accessExpiresIn).toBe('30m');
    expect(config.jwt.refreshExpiresIn).toBe('14d');
  });

  it('ignores JWT_*_TTL_SECONDS (not consumed by runtime)', async () => {
    for (const k of keys) capture(k);
    process.env.JWT_ACCESS_SECRET = 'test-access-secret-not-a-placeholder';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-not-a-placeholder';
    delete process.env.JWT_ACCESS_TTL;
    delete process.env.JWT_REFRESH_TTL;
    process.env.JWT_ACCESS_TTL_SECONDS = '999';
    process.env.JWT_REFRESH_TTL_SECONDS = '99999';
    delete process.env.JESSIE_AGENT_SECRETS;

    const config = await loadConfig();
    // Falls back to code defaults, not the _SECONDS values.
    expect(config.jwt.accessExpiresIn).toBe('15m');
    expect(config.jwt.refreshExpiresIn).toBe('7d');
  });

  it('defaults TTL when JWT_ACCESS_TTL / JWT_REFRESH_TTL are unset', async () => {
    for (const k of keys) capture(k);
    process.env.JWT_ACCESS_SECRET = 'test-access-secret-not-a-placeholder';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-not-a-placeholder';
    delete process.env.JWT_ACCESS_TTL;
    delete process.env.JWT_REFRESH_TTL;
    delete process.env.JWT_ACCESS_TTL_SECONDS;
    delete process.env.JWT_REFRESH_TTL_SECONDS;
    delete process.env.JESSIE_AGENT_SECRETS;

    const config = await loadConfig();
    expect(config.jwt.accessExpiresIn).toBe('15m');
    expect(config.jwt.refreshExpiresIn).toBe('7d');
  });
});
