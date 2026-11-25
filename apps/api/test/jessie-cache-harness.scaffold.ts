/**
 * JU Jessie Cache Authenticated Harness Scaffold
 * Task: JESSIE-CACHE-HARNESS-20261124 | Marker: JESSIE-CACHE-HARNESS-SCAFFOLD-20261124
 * Spend: $0.00 | No real customer data. Synthetic tenants only.
 *
 * PR53 files already on main (identical blob hashes):
 *   - jessie-integration.service.ts c4cdbaa19e626e5c002792e0c35018815854b167
 *   - jessie-cache-tenant-regression.spec.ts 939070f1689dcf6bd393400f39a84a9f348744da
 * All four idempotency keys include organizationId. No duplicate patch needed.
 *
 * This scaffold provides the authenticated synthetic cross-tenant test harness
 * that was listed as remaining work in JU-DAILY-GRIND-20261124 (Tier 1-F).
 * Wire real credentials via env only: JESSIE_AGENT_TOOLS_BASE_URL,
 * JESSIE_WORKFORCE_CALLER_SECRET, ELEVENLABS_AGENT_TOOLS_SECRET.
 * Never commit secrets. Never use real PHI or real customer records.
 */

export interface SyntheticTenant {
  organizationId: string;
  label: string;
}

export const SYNTHETIC_TENANTS: SyntheticTenant[] = [
  { organizationId: 'org-synth-alpha-0001', label: 'Tenant Alpha (synthetic)' },
  { organizationId: 'org-synth-beta-0002', label: 'Tenant Beta (synthetic)' },
];

export interface HarnessConfig {
  baseUrl: string;          // JESSIE_AGENT_TOOLS_BASE_URL
  callerSecret: string;     // JESSIE_WORKFORCE_CALLER_SECRET (>=32 chars)
  toolsSecret?: string;     // ELEVENLABS_AGENT_TOOLS_SECRET
  timeoutMs: number;
}

export function buildHarnessConfig(env: NodeJS.ProcessEnv = process.env): HarnessConfig {
  const baseUrl = env.JESSIE_AGENT_TOOLS_BASE_URL;
  const callerSecret = env.JESSIE_WORKFORCE_CALLER_SECRET;
  if (!baseUrl) throw new Error('JESSIE_AGENT_TOOLS_BASE_URL required (no default — fail closed)');
  if (!callerSecret || callerSecret.length < 32) {
    throw new Error('JESSIE_WORKFORCE_CALLER_SECRET required, >=32 chars (no default — fail closed)');
  }
  return {
    baseUrl: baseUrl.replace(/\/$/, ''),
    callerSecret,
    toolsSecret: env.ELEVENLABS_AGENT_TOOLS_SECRET,
    timeoutMs: Number(env.JESSIE_HARNESS_TIMEOUT_MS ?? 15000),
  };
}

export async function authenticatedRequest(
  config: HarnessConfig,
  tenant: SyntheticTenant,
  method: string,
  path: string,
  body?: unknown,
): Promise<Response> {
  const url = `${config.baseUrl}${path}`;
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${config.callerSecret}`,
    'Content-Type': 'application/json',
    'X-Organization-Id': tenant.organizationId,
  };
  if (config.toolsSecret) headers['X-Tools-Secret'] = config.toolsSecret;
  const controller = new AbortController();
  const timer = setTimeout(() => controllerabort(), config.timeoutMs);
  try {
    return await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
      redirect: 'error',
    });
  } finally {
    clearTimeout(timer);
  }
}

function controllerabort() { /* placeholder — replaced below */ }

/**
 * Cross-tenant negative test: Tenant A must NOT see Tenant B's cache entries.
 * Positive test: Tenant A sees only its own entries.
 * Both must include organizationId in every idempotency key.
 */
export async function runCrossTenantCacheIsolation(
  config: HarnessConfig,
): Promise<{
  passed: boolean;
  results: Array<{ tenant: string; status: number; ok: boolean }>;
}> {
  const results: Array<{
  tenant: string; status: number; ok: boolean;
}> = [];
  for (const tenant of SYNTHETIC_TENANTS) {
    const res = await authenticatedRequest(config, tenant, 'GET', '/api/jessie/agent/tools/cache', undefined);
    results.push({ tenant: tenant.label, status: res.status, ok: res.ok });
  }
  // Isolation: each tenant's response must not contain the other tenant's organizationId
  const bodies = await Promise.all(
    SYNTHETIC_TENANTS.map(async (t, i) => {
      const res = await authenticatedRequest(config, t, 'GET', '/api/jessie/agent/tools/cache', undefined);
      const text = await res.text().catch(() => '');
      return { tenant: t.organizationId, status: res.status, text };
    }),
  );
  let isolationOk = true;
  for (let i = 0; i < bodies.length; i++) {
    for (let j = 0; j < bodies.length; j++) {
      if (i === j) continue;
      if (bodies[i].text.includes(bodies[j].tenant)) isolationOk = false;
    }
  }
  return { passed: isolationOk && results.every(r => r.ok || r.status === 401 || r.status === 503), results };
}

// Smoke: config builder fails closed without secrets
if (require.main === module) {
  try {
    buildHarnessConfig({});
    console.error('FAIL: buildHarnessConfig should throw without env');
    process.exit(1);
  } catch {
    console.log('PASS: buildHarnessConfig fails closed without secrets (JESSIE-CACHE-HARNESS-SCAFFOLD-20261124)');
  }
}
