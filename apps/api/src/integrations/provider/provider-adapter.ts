import { VendorConnectorBase } from '../vendors/vendor-connector.base';

/**
 * JU Medical Suite Connector — provider-neutral adapter.
 *
 * Wraps any VendorConnectorBase (SMART on FHIR R4 sandbox/mock included) and
 * adds the connection lifecycle an office admin needs:
 *  - least-privilege SMART scope enforcement (declared per operation)
 *  - tenant isolation (every operation is bound to the adapter's tenant)
 *  - connection health model (disconnected/connected/degraded/error)
 *  - audit events for connect/test/sync/retry/revoke
 *  - synthetic error states + recovery paths (no real PHI, no network)
 *
 * All data is synthetic. No hard-coded vendor credentials.
 */

export type ConnectionHealth = 'disconnected' | 'connected' | 'degraded' | 'error';
export type SyntheticErrorKind = 'expired_token' | 'rate_limited' | 'network' | null;

/** Least-privilege SMART on FHIR v1/v2 scopes used by this adapter. */
export const SMART_SCOPES = {
  patientRead: 'patient/Patient.read',
  appointmentRead: 'patient/Appointment.read',
  observationRead: 'patient/Observation.read',
  offlineAccess: 'offline_access',
} as const;
export type SmartScope = (typeof SMART_SCOPES)[keyof typeof SMART_SCOPES];

/** Minimum scopes required per adapter operation (least privilege). */
const REQUIRED_SCOPES: Record<'connect' | 'test' | 'sync' | 'retry' | 'revoke', SmartScope[]> = {
  connect: [SMART_SCOPES.offlineAccess],
  test: [],
  sync: [SMART_SCOPES.patientRead],
  retry: [],
  revoke: [],
};

export interface AdapterHealth {
  status: ConnectionHealth;
  tenantId: string;
  provider: string;
  grantedScopes: SmartScope[];
  lastHealthCheck: number | null;
  errorCount: number;
  retryCount: number;
  syntheticError: SyntheticErrorKind;
  detail: string;
}

export class ProviderAdapter {
  private syntheticError: SyntheticErrorKind = null;
  private grantedScopes: SmartScope[];

  constructor(
    private readonly connector: VendorConnectorBase,
    private readonly tenantId: string,
    scopes: SmartScope[] = [SMART_SCOPES.patientRead, SMART_SCOPES.offlineAccess],
  ) {
    this.grantedScopes = [...scopes];
  }

  get provider(): string {
    return this.connector.provider;
  }

  // -- tenant isolation -------------------------------------------------
  private assertTenant(tenantId: string): { ok: true } | { ok: false; error: string } {
    return tenantId === this.tenantId
      ? { ok: true }
      : { ok: false, error: `Tenant mismatch: adapter is bound to '${this.tenantId}'` };
  }

  // -- least-privilege scopes --------------------------------------------
  private assertScopes(op: keyof typeof REQUIRED_SCOPES): { ok: true } | { ok: false; error: string } {
    const missing = REQUIRED_SCOPES[op].filter((s) => !this.grantedScopes.includes(s));
    return missing.length === 0
      ? { ok: true }
      : { ok: false, error: `Missing required scope(s) for ${op}: ${missing.join(', ')}` };
  }

  // -- synthetic error states ---------------------------------------------
  /** Inject a synthetic failure (tests / demo). No real network is touched. */
  simulateError(kind: Exclude<SyntheticErrorKind, null>): void {
    this.syntheticError = kind;
  }

  /** Clear injected failure; used to model recovery. */
  clearError(): void {
    this.syntheticError = null;
  }

  private checkSyntheticError():
    | { ok: true }
    | { ok: false; error: string; recoverable: boolean } {
    switch (this.syntheticError) {
      case 'expired_token':
        return { ok: false, error: 'Synthetic: access token expired', recoverable: true };
      case 'rate_limited':
        return { ok: false, error: 'Synthetic: rate limited by sandbox', recoverable: true };
      case 'network':
        return { ok: false, error: 'Synthetic: network unreachable', recoverable: false };
      default:
        return { ok: true };
    }
  }

  private async audit(event: 'CONNECT' | 'TEST' | 'SYNC' | 'RETRY' | 'REVOKE', detail: Record<string, unknown>) {
    const audit = (this.connector as { audit?: { record?: (e: unknown) => Promise<void> } }).audit;
    if (audit?.record) {
      await audit.record({
        organizationId: this.tenantId,
        actorId: 'medical-connector-adapter',
        action: 'UPDATE',
        entityType: 'ProviderConnection',
        entityId: `${this.provider}:${this.tenantId}`,
        metadata: { event, provider: this.provider, synthetic: true, ...detail },
      });
    }
  }

  // -- lifecycle ------------------------------------------------------------
  async connect(tenantId: string, code = 'synthetic-adapter-code') {
    const t = this.assertTenant(tenantId);
    if (!t.ok) return { success: false as const, error: t.error };
    const s = this.assertScopes('connect');
    if (!s.ok) return { success: false as const, error: s.error };
    const r = await this.connector.authorize(code);
    await this.audit('CONNECT', { success: r.success });
    return { success: r.success as boolean, error: r.success ? undefined : 'Authorization failed' };
  }

  async test(tenantId: string) {
    const t = this.assertTenant(tenantId);
    if (!t.ok) return { success: false as const, healthy: false, error: t.error };
    const err = this.checkSyntheticError();
    if (!err.ok) {
      await this.audit('TEST', { healthy: false, error: err.error });
      return { success: false as const, healthy: false, error: err.error };
    }
    const h = await this.connector.healthCheck();
    await this.audit('TEST', { healthy: h.healthy });
    return { success: h.healthy as boolean, healthy: h.healthy as boolean, error: h.healthy ? undefined : h.detail };
  }

  async syncFhir(tenantId: string, resourceTypes: string[]) {
    const t = this.assertTenant(tenantId);
    if (!t.ok) return { success: false as const, synced: 0, resources: [], error: t.error };
    const s = this.assertScopes('sync');
    if (!s.ok) return { success: false as const, synced: 0, resources: [], error: s.error };
    const err = this.checkSyntheticError();
    if (!err.ok) {
      await this.audit('SYNC', { success: false, error: err.error });
      return { success: false as const, synced: 0, resources: [], error: err.error };
    }
    const smart = this.connector as unknown as {
      syncFhirResources?: (types: string[], tenant: string) => Promise<{ success: boolean; synced: number; resources: unknown[] }>;
      syncSyntheticResources?: (type: 'patients' | 'appointments' | 'claims', limit: number) => Promise<{ success: boolean; synced: number; resources: unknown[] }>;
    };
    let out: { success: boolean; synced: number; resources: unknown[] };
    if (smart.syncFhirResources) {
      const r = await smart.syncFhirResources(resourceTypes, this.tenantId);
      out = { success: r.success, synced: r.synced, resources: r.resources };
    } else if (smart.syncSyntheticResources) {
      const r = await smart.syncSyntheticResources('patients', Math.min(resourceTypes.length, 10));
      out = { success: r.success, synced: r.synced, resources: r.resources };
    } else {
      out = { success: false, synced: 0, resources: [] };
    }
    await this.audit('SYNC', { success: out.success, synced: out.synced, resourceTypes });
    return out.success
      ? { ...out, success: true as const, error: undefined }
      : { ...out, success: false as const, error: 'Sync failed' };
  }

  /** Retry after a recoverable synthetic error. Returns whether recovery is possible. */
  async retry(tenantId: string) {
    const t = this.assertTenant(tenantId);
    if (!t.ok) return { success: false as const, recovered: false, error: t.error };
    const err = this.checkSyntheticError();
    if (err.ok) {
      await this.audit('RETRY', { recovered: true, note: 'no error present' });
      return { success: true as const, recovered: true, error: undefined };
    }
    if (!err.recoverable) {
      await this.audit('RETRY', { recovered: false, error: err.error });
      return { success: false as const, recovered: false, error: err.error };
    }
    // Recoverable: expired token -> refresh; rate limit -> backoff clear.
    if (this.syntheticError === 'expired_token') {
      await this.connector.refreshToken();
    }
    this.clearError();
    await this.audit('RETRY', { recovered: true });
    return { success: true as const, recovered: true, error: undefined };
  }

  async revoke(tenantId: string) {
    const t = this.assertTenant(tenantId);
    if (!t.ok) return { success: false as const, error: t.error };
    const r = await this.connector.revokeToken();
    this.clearError();
    await this.audit('REVOKE', { success: r.success });
    return { success: r.success as boolean, error: r.success ? undefined : 'Revoke failed' };
  }

  getHealth(): AdapterHealth {
    const st = this.connector.getStatus() as {
      oauth: string; lastHealthCheck: number | null; errorCount: number; retryCount: number;
    };
    let status: ConnectionHealth = 'disconnected';
    let detail = 'No OAuth token — disconnected';
    if (this.syntheticError) {
      status = 'error';
      detail = `Synthetic error injected: ${this.syntheticError}`;
    } else if (st.oauth === 'connected') {
      status = st.errorCount > 0 ? 'degraded' : 'connected';
      detail = status === 'connected' ? 'Connected and healthy' : `Connected with ${st.errorCount} recorded error(s)`;
    }
    return {
      status,
      tenantId: this.tenantId,
      provider: this.provider,
      grantedScopes: [...this.grantedScopes],
      lastHealthCheck: st.lastHealthCheck,
      errorCount: st.errorCount,
      retryCount: st.retryCount,
      syntheticError: this.syntheticError,
      detail,
    };
  }
}
