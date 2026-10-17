import { Logger } from '@nestjs/common';

import { AgentSecretsParseError, parseAgentSecrets } from './agent-secrets';
import type { AppConfig } from './configuration';

const DEV_DEFAULTS = new Set([
  'sbos-dev-access-secret-change-me',
  'sbos-dev-refresh-secret-change-me',
]);

/** Template placeholder secrets that must never reach production. */
const TEMPLATE_PLACEHOLDERS = new Set([
  'change-me-access-secret-min-32-chars',
  'change-me-refresh-secret-min-32-chars',
]);

const KNOWN_INSECURE_PLACEHOLDERS = new Set([
  ...DEV_DEFAULTS,
  ...TEMPLATE_PLACEHOLDERS,
]);

/**
 * Fail fast in production when required secrets are missing or left at their
 * insecure development defaults. In non-production a warning is logged instead
 * so local development keeps working.
 *
 * Agent secrets (JESSIE_AGENT_SECRETS) are parsed and validated in production
 * only. parseAgentSecrets never includes secret material in its error
 * messages, so validation failures are safe to surface.
 */
export function validateRuntimeConfig(config: AppConfig): void {
  const logger = new Logger('ConfigValidation');
  const isProduction = process.env.NODE_ENV === 'production';
  const problems: string[] = [];

  if (!config.jwt.accessSecret) {
    problems.push('JWT_ACCESS_SECRET is empty');
  } else if (KNOWN_INSECURE_PLACEHOLDERS.has(config.jwt.accessSecret)) {
    problems.push('JWT_ACCESS_SECRET uses a known insecure placeholder');
  }
  if (!config.jwt.refreshSecret) {
    problems.push('JWT_REFRESH_SECRET is empty');
  } else if (KNOWN_INSECURE_PLACEHOLDERS.has(config.jwt.refreshSecret)) {
    problems.push('JWT_REFRESH_SECRET uses a known insecure placeholder');
  }
  if (
    config.jwt.accessSecret &&
    config.jwt.refreshSecret &&
    config.jwt.accessSecret === config.jwt.refreshSecret
  ) {
    problems.push('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must differ');
  }
  if (!process.env.DATABASE_URL) {
    problems.push('DATABASE_URL is not set');
  }

  if (config.redis?.enabled && !config.redis.url) {
    problems.push('REDIS_RATE_LIMIT_ENABLED=true but REDIS_URL is not set');
  }

  if (isProduction) {
    const raw = process.env.JESSIE_AGENT_SECRETS;
    if (!raw || !raw.trim()) {
      problems.push(
        'JESSIE_AGENT_SECRETS is empty; configure at least one orgId:secret pair',
      );
    } else {
      try {
        parseAgentSecrets(raw);
      } catch (err) {
        problems.push(
          err instanceof AgentSecretsParseError
            ? err.message
            : 'JESSIE_AGENT_SECRETS is malformed',
        );
      }
    }
  }

  if (problems.length === 0) return;

  const summary = `Insecure/missing configuration:\n - ${problems.join('\n - ')}`;
  if (isProduction) {
    throw new Error(
      `${summary}\nRefusing to start in production. Set these via environment variables.`,
    );
  }
  logger.warn(`${summary}\n(allowed in non-production only)`);
}
