import { describe, expect, it } from 'vitest';
import { MEDICAL_CONNECTOR_VENDORS, X12_TRANSACTIONS, normalizeScopes, syntheticX12, vendorProfile } from './medical-connectors.types';

describe('medical connector contracts', () => {
  it('normalizes least-privilege SMART scopes', () => {
    expect(normalizeScopes('openid fhirUser openid patient/Patient.read')).toEqual(['fhirUser','openid','patient/Patient.read']);
  });

  it('keeps SMART vendors on FHIR R4 + SMART', () => {
    const profile = vendorProfile('Epic');
    expect(profile.standard).toBe('FHIR R4');
    expect(profile.authMode).toBe('SMART on FHIR');
    expect(profile.suggestedScopes).toContain('patient/Encounter.read');
  });

  it('uses truthful non-FHIR profiles for clearinghouse and interface connectors', () => {
    expect(vendorProfile('Availity')).toMatchObject({ standard:'X12', authMode:'Clearinghouse credentials / vendor-specific' });
    expect(vendorProfile('Generic HL7 v2')).toMatchObject({ standard:'HL7 v2', authMode:'Interface credentials / vendor-specific' });
    expect(vendorProfile('Generic X12')).toMatchObject({ standard:'X12', authMode:'Transport-specific' });
  });

  it('exposes the reconciled 12-option integration catalog without duplicate labels', () => {
    expect(MEDICAL_CONNECTOR_VENDORS).toHaveLength(12);
    expect(new Set(MEDICAL_CONNECTOR_VENDORS).size).toBe(MEDICAL_CONNECTOR_VENDORS.length);
    expect(MEDICAL_CONNECTOR_VENDORS).toContain('NextGen');
    expect(MEDICAL_CONNECTOR_VENDORS).toContain('Veradigm / Allscripts');
    expect(MEDICAL_CONNECTOR_VENDORS).toContain('Change Healthcare / Optum');
  });

  it('tracks synthetic X12 families including institutional claims and prior auth', () => {
    expect(X12_TRANSACTIONS).toEqual(expect.arrayContaining(['270','271','837P','837I','276','277','278','835']));
    expect(syntheticX12('837P','SYN-CLAIM-001')).toMatchObject({ transaction:'837P', transmissionAuthorized:false, mode:'synthetic_only' });
    expect(syntheticX12('278','SYN-AUTH-001')).toMatchObject({ transaction:'278', transmissionAuthorized:false, mode:'synthetic_only' });
    expect(() => syntheticX12('835','REAL-001')).toThrow(/SYN-/);
  });
});
