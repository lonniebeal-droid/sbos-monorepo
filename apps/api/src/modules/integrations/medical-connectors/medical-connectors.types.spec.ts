import { describe, expect, it } from 'vitest';
import { normalizeScopes, syntheticX12, vendorProfile } from './medical-connectors.types';

describe('medical connector contracts', () => {
  it('normalizes least-privilege SMART scopes', () => {
    expect(normalizeScopes('openid fhirUser openid patient/Patient.read')).toEqual(['fhirUser','openid','patient/Patient.read']);
  });
  it('keeps vendor profiles FHIR R4 + SMART', () => {
    const profile = vendorProfile('Epic');
    expect(profile.standard).toBe('FHIR R4');
    expect(profile.authMode).toBe('SMART on FHIR');
    expect(profile.suggestedScopes).toContain('patient/Encounter.read');
  });
  it('never authorizes synthetic X12 transmission', () => {
    expect(syntheticX12('837','SYN-CLAIM-001')).toMatchObject({ transaction:'837', transmissionAuthorized:false, mode:'synthetic_only' });
    expect(() => syntheticX12('835','REAL-001')).toThrow(/SYN-/);
  });
});
