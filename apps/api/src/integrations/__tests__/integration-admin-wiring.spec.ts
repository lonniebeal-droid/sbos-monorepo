import { beforeEach, describe, expect, it } from 'vitest';
import { IntegrationAdminService } from '../admin/integration-admin.service';
import { IntegrationConfigService } from '../admin/integration-config.service';
import { SMART_SCOPES } from '../provider/provider-adapter';
import { X12GeneratorService } from '../x12/x12-generator.service';
import { X12ParserService } from '../x12/x12-parser.service';

function makeAdmin() {
  const config = new IntegrationConfigService({} as any, { record: async () => {} } as any);
  const g = new X12GeneratorService();
  return new IntegrationAdminService(config, g, new X12ParserService(g));
}

const CFG = { baseUrl: 'https://fhir.sandbox.test', clientId: 'sandbox-client' };

describe('IntegrationAdminService medical provider wiring', () => {
  let admin: IntegrationAdminService;
  beforeEach(() => { admin = makeAdmin(); });

  it('runs the full lifecycle: configure -> authorize -> test -> sync -> retry -> revoke', async () => {
    const c = await admin.configureMedicalProvider('t1', 'smart-fhir', CFG);
    expect(c.success).toBe(true);
    if (!c.success) throw new Error('configure failed');
    expect(c.health.status).toBe('disconnected');

    const a = await admin.authorizeMedicalConnection('t1');
    expect(a.success).toBe(true);
    if (!a.success) throw new Error('authorize failed: ' + a.error);
    expect(a.health.status).toBe('connected');

    const t = await admin.testMedicalConnection('t1');
    expect(t.healthy).toBe(true);

    const caps = admin.getMedicalConnectionCapabilities('t1');
    expect(caps.success).toBe(true);
    if (caps.success) {
      expect(caps.provider).toBe('smart-fhir-r4');
      expect(caps.grantedScopes).toContain(SMART_SCOPES.patientRead);
    }

    const s = await admin.syncMedicalResources('t1', ['Patient', 'Appointment']);
    expect(s.success).toBe(true);
    expect(s.synced).toBe(2);

    const r = await admin.retryMedicalConnection('t1');
    expect(r.recovered).toBe(true);

    const rev = await admin.revokeMedicalConnection('t1');
    expect(rev.success).toBe(true);
    expect(admin.getMedicalConnectionHealth('t1').status).toBe('disconnected');
    expect(admin.adapterCount()).toBe(0);
  });

  it('rejects duplicate tenant configuration', async () => {
    await admin.configureMedicalProvider('t1', 'smart-fhir', CFG);
    const dup = await admin.configureMedicalProvider('t1', 'epic', CFG);
    expect(dup.success).toBe(false);
  });

  it('rejects unknown providers', async () => {
    const r = await admin.configureMedicalProvider('t1', 'not-a-vendor', CFG);
    expect(r.success).toBe(false);
  });

  it('isolates tenants: one tenant cannot operate another tenant adapter', async () => {
    await admin.configureMedicalProvider('t1', 'smart-fhir', CFG);
    await admin.authorizeMedicalConnection('t1');
    // t2 has no adapter of its own -> every op reports "not configured"
    expect((await admin.testMedicalConnection('t2')).success).toBe(false);
    expect((await admin.syncMedicalResources('t2', ['Patient'])).success).toBe(false);
    expect((await admin.revokeMedicalConnection('t2')).success).toBe(false);
    // t1's adapter is untouched by t2's attempts
    expect(admin.getMedicalConnectionHealth('t1').status).toBe('connected');
    expect(admin.adapterCount()).toBe(1);
  });

  it('supports vendor connectors through the same lifecycle', async () => {
    const c = await admin.configureMedicalProvider('t9', 'epic', CFG);
    expect(c.success).toBe(true);
    expect((await admin.authorizeMedicalConnection('t9')).success).toBe(true);
    const caps = admin.getMedicalConnectionCapabilities('t9');
    expect(caps.success).toBe(true);
    if (caps.success) expect(caps.provider).toBe('epic');
    expect((await admin.revokeMedicalConnection('t9')).success).toBe(true);
  });

  it('enforces least-privilege scopes through the service', async () => {
    // Grant only offline_access: authorize (needs offline_access) succeeds,
    // but sync (needs patientRead) is rejected by the adapter.
    await admin.configureMedicalProvider('t1', 'smart-fhir', { ...CFG, scopes: [SMART_SCOPES.offlineAccess] });
    expect((await admin.authorizeMedicalConnection('t1')).success).toBe(true);
    const s = await admin.syncMedicalResources('t1', ['Patient']);
    expect(s.success).toBe(false);
    expect(String(s.error)).toMatch(/Missing required scope/);
  });
});
