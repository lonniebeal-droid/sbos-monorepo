/**
 * Jessie / ElevenLabs agent secret parsing and validation.
 * Map format: orgId:secret,orgId2:secret2 → secret → organizationId
 * Secrets are never logged; errors describe structure only.
 */

export class AgentSecretsParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AgentSecretsParseError';
  }
}

export interface ParsedAgentSecrets {
  /** secret → organizationId */
  secrets: Record<string, string>;
  /** organizationIds that appear more than once (allowed; multiple secrets per org) */
  orgsWithMultipleSecrets: string[];
}

/**
 * Parse and validate JESSIE_AGENT_SECRETS.
 * - Rejects malformed entries (missing colon, empty org or secret)
 * - Rejects duplicate secrets (same secret mapped to different orgs, or repeated)
 * - Allows multiple secrets for the same organization (explicit)
 */
export function parseAgentSecrets(raw?: string): ParsedAgentSecrets {
  const secrets: Record<string, string> = {};
  const orgCounts = new Map<string, number>();

  if (raw === undefined || raw === null || !String(raw).trim()) {
    return { secrets: {}, orgsWithMultipleSecrets: [] };
  }

  const parts = String(raw).split(',');
  for (let i = 0; i < parts.length; i++) {
    const trimmed = parts[i].trim();
    if (!trimmed) continue;

    const colon = trimmed.indexOf(':');
    if (colon <= 0 || colon === trimmed.length - 1) {
      throw new AgentSecretsParseError(
        `Malformed JESSIE_AGENT_SECRETS entry at position ${i + 1}: expected orgId:secret`,
      );
    }

    const orgId = trimmed.slice(0, colon).trim();
    const secret = trimmed.slice(colon + 1).trim();
    if (!orgId || !secret) {
      throw new AgentSecretsParseError(
        `Malformed JESSIE_AGENT_SECRETS entry at position ${i + 1}: orgId and secret must be non-empty`,
      );
    }

    if (Object.prototype.hasOwnProperty.call(secrets, secret)) {
      throw new AgentSecretsParseError(
        `Duplicate agent secret at position ${i + 1}: each secret may map to only one organization`,
      );
    }

    secrets[secret] = orgId;
    orgCounts.set(orgId, (orgCounts.get(orgId) ?? 0) + 1);
  }

  const orgsWithMultipleSecrets = [...orgCounts.entries()]
    .filter(([, n]) => n > 1)
    .map(([orgId]) => orgId);

  return { secrets, orgsWithMultipleSecrets };
}

/**
 * Constant-time string equality for secret comparison.
 * Length mismatch still walks the longer buffer to reduce timing signal.
 */
export function timingSafeEqualString(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, 'utf8');
  const bBuf = Buffer.from(b, 'utf8');
  const len = Math.max(aBuf.length, bBuf.length);
  let diff = aBuf.length ^ bBuf.length;
  for (let i = 0; i < len; i++) {
    const av = i < aBuf.length ? aBuf[i] : 0;
    const bv = i < bBuf.length ? bBuf[i] : 0;
    diff |= av ^ bv;
  }
  return diff === 0;
}

/**
 * Resolve organizationId for a presented secret using constant-time compares.
 * Returns null when no match (never throws with secret material).
 */
export function resolveOrgFromSecret(
  secrets: Record<string, string>,
  presented: string,
): string | null {
  if (!presented) return null;
  let matchedOrg: string | null = null;
  for (const [secret, orgId] of Object.entries(secrets)) {
    if (timingSafeEqualString(secret, presented)) {
      // Prefer first match; duplicates are rejected at parse time.
      if (matchedOrg === null) matchedOrg = orgId;
    }
  }
  return matchedOrg;
}
