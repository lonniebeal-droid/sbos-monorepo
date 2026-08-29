import { Logger } from '@nestjs/common';

import type { AppConfig } from './configuration';
import { AgentSecretsParseError, parseAgentSecrets } from './agent-secrets';

/**
 * Known insecure JWT secrets that must never be used in production.
 * Includes code defaults and any historical template placeholders.
 */
const INSECURE_JWT_SECRETS = new Set([
  'sbos-dev-access-secret-change-me',
  'sbos-dev-refresh-secret-change-me',
  'change-me-access-secret-min-32-chars',
  'change-me-refresh-secret-min-32-chars',
]);

/**
 * Fail fast in production when required secrets are missing or left at their
 * insecure development defaults. In non-production a warning is logged instead
 * so local development keeps working.
 *
 * Jessie agent secrets: production requires at least one valid mapping.
 * Empty config is allowed in non-production (tools reject all credentials).
 */
export function validateRuntimeConfig(config: AppConfig): void {
  const logger = new Logger('ConfigValidation');
  const isProduction = process.env.NODE_ENV === 'production';
  const problems: string[] = [];

  const access = config.jwt.accessSecret?.trim() ?? '';
  const refresh = config.jwt.refreshSecret?.trim() ?? '';

  if (!access) {
    problems.push('JWT_ACCESS_SECRET is empty or unset');
  } else if (INSECURE_JWT_SECRETS.has(access)) {
    problems.push('JWT_ACCESS_SECRET is a known insecure placeholder');
  }

  if (!refresh) {
    problems.push('JWT_REFRESH_SECRET is empty or unset');
  } else if (INSECURE_JWT_SECRETS.has(refresh)) {
    problems.push('JWT_REFRESH_SECRET is a known insecure placeholder');
  }

  if (access && refresh && access === refresh) {
    problems.push('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must differ');
  }

  if (!process.env.DATABASE_URL) {
    problems.push('DATABASE_URL is not set');
  }

  // Re-parse raw env so malformed entries surface. Never include secret values.
  try {
    const parsed = parseAgentSecrets(process.env.JESSIE_AGENT_SECRETS);
    if (isProduction && Object.keys(parsed.secrets).length === 0) {
      problems.push(
        'JESSIE_AGENT_SECRETS is empty or unset (required in production for agent tools)',
      );
    }
    if (parsed.orgsWithMultipleSecrets.length > 0) {
      logger.log(
        `JESSIE_AGENT_SECRETS: ${parsed.orgsWithMultipleSecrets.length} organization(s) have multiple agent secrets (allowed)`,
      );
    }
  } catch (err) {
    if (err instanceof AgentSecretsParseError) {
      problems.push(err.message);
    } else {
      problems.push('JESSIE_AGENT_SECRETS could not be parsed');
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
