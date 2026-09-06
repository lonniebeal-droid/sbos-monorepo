export const MEDICAL_CONNECTOR_VENDORS = ['Epic','athenahealth','Oracle Health / Cerner','eClinicalWorks','Generic FHIR R4'] as const;
export type MedicalConnectorVendor = (typeof MEDICAL_CONNECTOR_VENDORS)[number];
export type MedicalConnectorStatus = 'not_connected' | 'testing' | 'connected' | 'error';
export const X12_TRANSACTIONS = ['270','271','837','276','277','835'] as const;
export type X12Transaction = (typeof X12_TRANSACTIONS)[number];

export const vendorProfile = (vendor: MedicalConnectorVendor) => ({
  vendor,
  standard: 'FHIR R4' as const,
  authMode: 'SMART on FHIR' as const,
  suggestedScopes: ['openid','fhirUser','patient/Patient.read','patient/Appointment.read','patient/Encounter.read','patient/Coverage.read'],
});

export function normalizeScopes(value: string) {
  return [...new Set(value.split(/\s+/).map(v => v.trim()).filter(Boolean))].sort();
}

export function syntheticX12(transaction: X12Transaction, traceId: string) {
  if (!traceId.startsWith('SYN-')) throw new Error('Synthetic trace ID must begin with SYN-');
  return { standard: 'X12', mode: 'synthetic_only', transaction, traceId, transmissionAuthorized: false } as const;
}
