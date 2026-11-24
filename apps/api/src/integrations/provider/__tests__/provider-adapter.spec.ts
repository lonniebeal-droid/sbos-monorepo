import { beforeEach, describe, expect, it } from 'vitest';
import { SmartOAuthService } from '../../smart/smart-oauth.service';
import { ProviderAdapter, SMART_SCOPES } from '../provider-adapter';

function makeAdapter(tenantId = 'tenant-a', scopes = [SMART_SCOPES.patientRead, SMART_SCOPES.offlineAccess]) {
  const events: any[] = [];
  const connector = new SmartOAuthService(
    {} as any,
    { record: async (e: any) => { events.push(e); } } as any,
    { baseUrl: 'https://fhir.sandbox.test', tenantId, clientId: 'sandbox-client' },
  );
  return { adapter: new ProviderAdapter(connector, tenantId, scopes), events };
}

describe('ProviderAdapter (provider-neutral connector)', () => {
  it('connects, tests, syncs, and revokes with audit events', async () => {
    const { adapter, events } = makeAdapter();
    expect((await adapter.connect('tenant-a')).success).toBe(true);
    expect((await adapter.test('tenant-a')).healthy).toBe(true);
    const sync = await adapter.syncFhir('tenant-a', ['Patient', 'Appointment']);
    expect(sync.success).toBe(true);
    expect(sync.synced).toBe(2);
    expect((await adapter.revoke('tenant-a')).success).toBe(true);
    expect(adapter.getHealth().status).toBe('disconnected');
    const kinds = events.map((e) => e.metadata.event).filter(Boolean);
    expect(kinds).toEqual(['CONNECT', 'TEST', 'SYNC', 'REVOKE']);
    expect(events.every((e) => e.organizationId === 'tenant-a')).toBe(true);
  });

  it('enforces tenant isolation on every operation', async () => {
    const { adapter } = makeAdapter();
    expect((await adapter.connect('tenant-b')).success).toBe(false);
    expect((await adapter.test('tenant-b')).success).toBe(false);
    expect((await adapter.syncFhir('tenant-b', ['Patient'])).success).toBe(false);
    expect((await adapter.retry('tenant-b')).success).toBe(false);
    expect((await adapter.revoke('tenant-b')).success).toBe(false);
  });

  it('enforces least-privilege scopes', async () => {
    const { adapter } = makeAdapter('tenant-a', []); // no scopes granted
    expect((await adapter.connect('tenant-a')).success).toBe(false);
    const { adapter: reader } = makeAdapter('tenant-a', [SMART_SCOPES.offlineAccess]);
    expect((await reader.connect('tenant-a')).success).toBe(true);
    const sync = await reader.syncFhir('tenant-a', ['Patient']);
    expect(sync.success).toBe(false);
    expect(sync.error).toMatch(/Missing required scope/);
  });

  it('models health: disconnected -> connected -> degraded -> error', async () => {
    const { adapter } = makeAdapter();
    expect(adapter.getHealth().status).toBe('disconnected');
    await adapter.connect('tenant-a');
    expect(adapter.getHealth().status).toBe('connected');
    adapter.simulateError('rate_limited');
    expect(adapter.getHealth().status).toBe('error');
    expect(adapter.getHealth().syntheticError).toBe('rate_limited');
    adapter.clearError();
    expect(adapter.getHealth().status).toBe('connected');
  });

  it('recovers from expired token via retry (refresh), blocks on network error', async () => {
    const { adapter, events } = makeAdapter();
    await adapter.connect('tenant-a');
    adapter.simulateError('expired_token');
    expect((await adapter.test('tenant-a')).healthy).toBe(false);
    const retry = await adapter.retry('tenant-a');
    expect(retry.success).toBe(true);
    expect(retry.recovered).toBe(true);
    expect((await adapter.test('tenant-a')).healthy).toBe(true);
    expect(events.map((e) => e.metadata.event)).toContain('RETRY');

    adapter.simulateError('network');
    const retry2 = await adapter.retry('tenant-a');
    expect(retry2.success).toBe(false);
    expect(retry2.recovered).toBe(false);
  });

  it('sync is blocked while a synthetic error is active, then recovers', async () => {
    const { adapter } = makeAdapter();
    await adapter.connect('tenant-a');
    adapter.simulateError('rate_limited');
    const blocked = await adapter.syncFhir('tenant-a', ['Patient']);
    expect(blocked.success).toBe(false);
    expect(blocked.error).toMatch(/rate limited/);
    await adapter.retry('tenant-a');
    const ok = await adapter.syncFhir('tenant-a', ['Patient']);
    expect(ok.success).toBe(true);
  });

  it('revoke clears error state and audits', async () => {
    const { adapter, events } = makeAdapter();
    await adapter.connect('tenant-a');
    adapter.simulateError('expired_token');
    expect((await adapter.revoke('tenant-a')).success).toBe(true);
    expect(adapter.getHealth().status).toBe('disconnected');
    expect(adapter.getHealth().syntheticError).toBeNull();
    expect(events.map((e) => e.metadata.event)).toContain('REVOKE');
  });
});
