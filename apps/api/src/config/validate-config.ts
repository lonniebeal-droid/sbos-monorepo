import { Logger } from '@nestjs/common';

import type { AppConfig } from './configuration';

const DEV_DEFAULTS = new Set([
  'sbos-dev-access-secret-change-me',
  'sbos-dev-refresh-secret-change-me',
]);

/**
 * Fail fast in production when required secrets are missing or left at their
 * insecure development defaults. In non-production a warning is logged instead
 * so local development keeps working.
 */
export function validateRuntimeConfig(config: AppConfig): void {
  const logger = new Logger('ConfigValidation');
  const isProduction = process.env.NODE_ENV === 'production';
  const problems: string[] = [];

  if (DEV_DEFAULTS.has(config.jwt.accessSecret)) {
    problems.push('JWT_ACCESS_SECRET is unset or using the dev default');
  }
  if (DEV_DEFAULTS.has(config.jwt.refreshSecret)) {
    problems.push('JWT_REFRESH_SECRET is unset or using the dev default');
  }
  if (config.jwt.accessSecret === config.jwt.refreshSecret) {
    problems.push('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must differ');
  }
  if (!process.env.DATABASE_URL) {
    problems.push('DATABASE_URL is not set');
  }

  if (config.redis.enabled && !config.redis.url) {
    problems.push('REDIS_RATE_LIMIT_ENABLED=true but REDIS_URL is not set');
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
