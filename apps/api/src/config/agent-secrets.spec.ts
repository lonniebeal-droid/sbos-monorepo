import { describe, expect, it, afterEach } from 'vitest';

import {
  AgentSecretsParseError,
  parseAgentSecrets,
  resolveOrgFromSecret,
  timingSafeEqualString,
} from './agent-secrets';
import { validateRuntimeConfig } from './validate-config';
import type { AppConfig } from './configuration';

function baseConfig(overrides?: Partial<AppConfig>): AppConfig {
  return {
    port: 4000,
    corsOrigins: ['http://localhost:3000'],
    jwt: {
      accessSecret: 'prod-access-secret-32chars-min!!',
      refreshSecret: 'prod-refresh-secret-32chars-min!',
      accessExpiresIn: '15m',
      refreshExpiresIn: '7d',
    },
    ai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
    stripe: {},
    email: { fromAddress: 'no-reply@sbos.health' },
    sms: {},
    jessieAgent: { secrets: {} },
    ...overrides,
  };
}

describe('parseAgentSecrets', () => {
  it('parses orgId:secret pairs into secret → org map', () => {
    const { secrets } = parseAgentSecrets('org1:sec-aaa,org2:sec-bbb');
    expect(secrets).toEqual({ 'sec-aaa': 'org1', 'sec-bbb': 'org2' });
  });

  it('allows multiple secrets for the same organization', () => {
    const { secrets, orgsWithMultipleSecrets } = parseAgentSecrets(
      'org1:sec-a,org1:sec-b',
    );
    expect(secrets).toEqual({ 'sec-a': 'org1', 'sec-b': 'org1' });
    expect(orgsWithMultipleSecrets).toEqual(['org1']);
  });

  it('rejects duplicate secrets', () => {
    expect(() => parseAgentSecrets('org1:same,org2:same')).toThrow(
      AgentSecretsParseError,
    );
    expect(() => parseAgentSecrets('org1:same,org2:same')).toThrow(
      /Duplicate agent secret/,
    );
  });

  it('rejects malformed entries without leaking secrets', () => {
    expect(() => parseAgentSecrets('no-colon-here')).toThrow(/Malformed/);
    expect(() => parseAgentSecrets(':onlysecret')).toThrow(/Malformed/);
    expect(() => parseAgentSecrets('orgonly:')).toThrow(/Malformed/);
    try {
      parseAgentSecrets('org1:super-secret-value-xyz,bad');
    } catch (err) {
      const msg = (err as Error).message;
      expect(msg).not.toContain('super-secret-value-xyz');
      expect(msg).toMatch(/Malformed/);
    }
  });

  it('returns empty map for blank input', () => {
    expect(parseAgentSecrets(undefined).secrets).toEqual({});
    expect(parseAgentSecrets('').secrets).toEqual({});
    expect(parseAgentSecrets('  ,  ').secrets).toEqual({});
  });
});

describe('timingSafeEqualString / resolveOrgFromSecret', () => {
  it('matches equal strings', () => {
    expect(timingSafeEqualString('abc', 'abc')).toBe(true);
    expect(timingSafeEqualString('abc', 'abd')).toBe(false);
    expect(timingSafeEqualString('abc', 'ab')).toBe(false);
  });

  it('resolves org without exposing secrets in result', () => {
    const map = { 'sec-aaa': 'org1', 'sec-bbb': 'org2' };
    expect(resolveOrgFromSecret(map, 'sec-aaa')).toBe('org1');
    expect(resolveOrgFromSecret(map, 'wrong')).toBeNull();
    expect(resolveOrgFromSecret(map, '')).toBeNull();
  });
});

describe('validateRuntimeConfig — agent secrets', () => {
  const prevNodeEnv = process.env.NODE_ENV;
  const prevDb = process.env.DATABASE_URL;
  const prevSecrets = process.env.JESSIE_AGENT_SECRETS;

  afterEach(() => {
    process.env.NODE_ENV = prevNodeEnv;
    process.env.DATABASE_URL = prevDb;
    if (prevSecrets === undefined) delete process.env.JESSIE_AGENT_SECRETS;
    else process.env.JESSIE_AGENT_SECRETS = prevSecrets;
  });

  it('rejects malformed secrets in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgresql://x';
    process.env.JESSIE_AGENT_SECRETS = 'not-valid';
    expect(() => validateRuntimeConfig(baseConfig())).toThrow(/Malformed/);
  });

  it('rejects duplicate secrets in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgresql://x';
    process.env.JESSIE_AGENT_SECRETS = 'org1:dup,org2:dup';
    expect(() => validateRuntimeConfig(baseConfig())).toThrow(/Duplicate/);
  });

  it('fails production startup when agent secrets are empty', () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgresql://x';
    delete process.env.JESSIE_AGENT_SECRETS;
    expect(() => validateRuntimeConfig(baseConfig())).toThrow(
      /JESSIE_AGENT_SECRETS is empty/,
    );
  });

  it('allows empty agent secrets in non-production', () => {
    process.env.NODE_ENV = 'development';
    process.env.DATABASE_URL = 'postgresql://x';
    delete process.env.JESSIE_AGENT_SECRETS;
    expect(() => validateRuntimeConfig(baseConfig())).not.toThrow();
  });

  it('error messages never include secret values', () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgresql://x';
    process.env.JESSIE_AGENT_SECRETS =
      'org1:top-secret-value-999,org2:top-secret-value-999';
    try {
      validateRuntimeConfig(baseConfig());
      throw new Error('expected throw');
    } catch (err) {
      const msg = (err as Error).message;
      expect(msg).not.toContain('top-secret-value-999');
    }
  });
});

describe('validateRuntimeConfig — JWT secrets', () => {
  const prevNodeEnv = process.env.NODE_ENV;
  const prevDb = process.env.DATABASE_URL;
  const prevSecrets = process.env.JESSIE_AGENT_SECRETS;

  afterEach(() => {
    process.env.NODE_ENV = prevNodeEnv;
    process.env.DATABASE_URL = prevDb;
    if (prevSecrets === undefined) delete process.env.JESSIE_AGENT_SECRETS;
    else process.env.JESSIE_AGENT_SECRETS = prevSecrets;
  });

  it('rejects empty JWT secrets in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgresql://x';
    process.env.JESSIE_AGENT_SECRETS = 'org1:agent-sec';
    expect(() =>
      validateRuntimeConfig(
        baseConfig({
          jwt: {
            accessSecret: '',
            refreshSecret: '',
            accessExpiresIn: '15m',
            refreshExpiresIn: '7d',
          },
        }),
      ),
    ).toThrow(/JWT_ACCESS_SECRET is empty/);
  });

  it('rejects known template placeholder JWT secrets in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgresql://x';
    process.env.JESSIE_AGENT_SECRETS = 'org1:agent-sec';
    expect(() =>
      validateRuntimeConfig(
        baseConfig({
          jwt: {
            accessSecret: 'change-me-access-secret-min-32-chars',
            refreshSecret: 'change-me-refresh-secret-min-32-chars',
            accessExpiresIn: '15m',
            refreshExpiresIn: '7d',
          },
        }),
      ),
    ).toThrow(/known insecure placeholder/);
  });

  it('rejects code-default JWT secrets in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgresql://x';
    process.env.JESSIE_AGENT_SECRETS = 'org1:agent-sec';
    expect(() =>
      validateRuntimeConfig(
        baseConfig({
          jwt: {
            accessSecret: 'sbos-dev-access-secret-change-me',
            refreshSecret: 'sbos-dev-refresh-secret-change-me',
            accessExpiresIn: '15m',
            refreshExpiresIn: '7d',
          },
        }),
      ),
    ).toThrow(/known insecure placeholder/);
  });

  it('allows strong distinct JWT secrets in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgresql://x';
    process.env.JESSIE_AGENT_SECRETS = 'org1:agent-sec';
    expect(() =>
      validateRuntimeConfig(
        baseConfig({
          jwt: {
            accessSecret: 'prod-access-secret-32chars-min!!',
            refreshSecret: 'prod-refresh-secret-32chars-min!',
            accessExpiresIn: '15m',
            refreshExpiresIn: '7d',
          },
        }),
      ),
    ).not.toThrow();
  });

  it('warns but allows empty JWT secrets in non-production', () => {
    process.env.NODE_ENV = 'development';
    process.env.DATABASE_URL = 'postgresql://x';
    delete process.env.JESSIE_AGENT_SECRETS;
    expect(() =>
      validateRuntimeConfig(
        baseConfig({
          jwt: {
            accessSecret: '',
            refreshSecret: '',
            accessExpiresIn: '15m',
            refreshExpiresIn: '7d',
          },
        }),
      ),
    ).not.toThrow();
  });
});
