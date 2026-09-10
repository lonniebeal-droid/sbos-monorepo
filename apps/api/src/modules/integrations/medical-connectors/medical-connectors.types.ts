export const MEDICAL_CONNECTOR_VENDORS = [
  'SimplePractice',
  'Epic',
  'athenahealth',
  'Oracle Health / Cerner',
  'eClinicalWorks',
  'NextGen',
  'Veradigm / Allscripts',
  'Generic SMART on FHIR R4',
  'Generic HL7 v2',
  'Availity',
  'Change Healthcare / Optum',
  'Generic X12',
] as const;

export type MedicalConnectorVendor = (typeof MEDICAL_CONNECTOR_VENDORS)[number];
export type MedicalConnectorStatus = 'not_connected' | 'testing' | 'capability_verified' | 'sandbox_verified' | 'connected' | 'error';

export const X12_TRANSACTIONS = ['270','271','837','837P','837I','276','277','278','835'] as const;
export type X12Transaction = (typeof X12_TRANSACTIONS)[number];

type VendorProfile = {
  vendor: MedicalConnectorVendor;
  standard: 'FHIR R4' | 'Vendor API + X12' | 'HL7 v2' | 'X12';
  authMode: 'SMART on FHIR' | 'OAuth 2.0 / vendor-specific' | 'Interface credentials / vendor-specific' | 'Clearinghouse credentials / vendor-specific' | 'Transport-specific';
  suggestedScopes: string[];
};

const SMART_SCOPES = ['openid','fhirUser','patient/Patient.read','patient/Appointment.read','patient/Encounter.read','patient/Coverage.read'];

const PROFILE_OVERRIDES: Partial<Record<MedicalConnectorVendor, Omit<VendorProfile, 'vendor'>>> = {
  'SimplePractice': { standard:'Vendor API + X12', authMode:'OAuth 2.0 / vendor-specific', suggestedScopes:[] },
  'athenahealth': { standard:'Vendor API + X12', authMode:'OAuth 2.0 / vendor-specific', suggestedScopes:[] },
  'Generic HL7 v2': { standard:'HL7 v2', authMode:'Interface credentials / vendor-specific', suggestedScopes:[] },
  'Availity': { standard:'X12', authMode:'Clearinghouse credentials / vendor-specific', suggestedScopes:[] },
  'Change Healthcare / Optum': { standard:'X12', authMode:'Clearinghouse credentials / vendor-specific', suggestedScopes:[] },
  'Generic X12': { standard:'X12', authMode:'Transport-specific', suggestedScopes:[] },
};

export const vendorProfile = (vendor: MedicalConnectorVendor): VendorProfile => ({
  vendor,
  standard: 'FHIR R4',
  authMode: 'SMART on FHIR',
  suggestedScopes: [...SMART_SCOPES],
  ...PROFILE_OVERRIDES[vendor],
});

export function normalizeScopes(value: string) {
  return [...new Set(value.split(/\s+/).map(v => v.trim()).filter(Boolean))].sort();
}

export function syntheticX12(transaction: X12Transaction, traceId: string) {
  if (!traceId.startsWith('SYN-')) throw new Error('Synthetic trace ID must begin with SYN-');
  return { standard: 'X12', mode: 'synthetic_only', transaction, traceId, transmissionAuthorized: false } as const;
}
