export const MEDICAL_ECOSYSTEM_CAPABILITIES = [
  { category:'eRx / pharmacy', standard:'FHIR R4 MedicationRequest', localStatus:'IMPLEMENTED-SYNTHETIC', externalGate:'Surescripts/EPCS identity, contract and production authorization where required' },
  { category:'labs', standard:'FHIR R4 Observation/DiagnosticReport + HL7 v2 ORU', localStatus:'IMPLEMENTED-SYNTHETIC', externalGate:'Lab vendor endpoint/credentials where direct exchange is required' },
  { category:'imaging', standard:'DICOMweb QIDO-RS/WADO-RS/STOW-RS + FHIR DiagnosticReport/ImagingStudy', localStatus:'IMPLEMENTED-SYNTHETIC', externalGate:'PACS/RIS endpoint and authorization' },
  { category:'HIE / network', standard:'FHIR R4 + document exchange', localStatus:'IMPLEMENTED-SYNTHETIC', externalGate:'TEFCA/QHIN, Carequality, CommonWell or HIE participation/onboarding as applicable' },
  { category:'provider identity', standard:'NPI checksum + NPPES public registry verification boundary', localStatus:'IMPLEMENTED-SYNTHETIC', externalGate:'NPPES live lookup/network availability; NPI is not license/credential verification' },
  { category:'communications', standard:'consent-gated SMS/voice/email/fax contract', localStatus:'IMPLEMENTED-SYNTHETIC', externalGate:'BAA-capable communications vendor credentials and production consent policy' },
  { category:'payments', standard:'processor-neutral payment handoff', localStatus:'EXTERNAL-HUMAN-GATE', externalGate:'Merchant/processor selection, contract and credentials' },
  { category:'telehealth', standard:'FHIR Appointment virtual-service metadata', localStatus:'IMPLEMENTED-SYNTHETIC', externalGate:'Video vendor/BAA/production meeting credentials if embedded video is required' },
  { category:'document exchange', standard:'FHIR DocumentReference/Binary + C-CDA content boundary', localStatus:'IMPLEMENTED-SYNTHETIC', externalGate:'Receiving network/vendor authorization' },
] as const;

export type FhirEcosystemResource = 'MedicationRequest'|'Observation'|'DiagnosticReport'|'ImagingStudy'|'DocumentReference'|'Binary'|'Practitioner'|'Location'|'Organization'|'Appointment';

export function fhirResourcePath(resource: FhirEcosystemResource, id?: string) {
  if (id && !/^[A-Za-z0-9.-]{1,64}$/.test(id)) throw new Error('Invalid FHIR resource id');
  return `/${resource}${id ? `/${id}` : ''}`;
}

export function dicomWebPaths(baseUrl: string) {
  const url = new URL(baseUrl);
  if (!['https:','http:'].includes(url.protocol)) throw new Error('DICOMweb endpoint must use HTTP(S)');
  const root = baseUrl.replace(/\/$/, '');
  return { qido:`${root}/studies`, wado:`${root}/studies`, stow:`${root}/studies` };
}

export function validateNpiChecksum(npi: string) {
  if (!/^\d{10}$/.test(npi)) return false;
  const digits = `80840${npi}`.split('').map(Number);
  let sum = 0;
  for (let i = digits.length - 1, alt = false; i >= 0; i--, alt = !alt) {
    let d = digits[i];
    if (alt) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
  }
  return sum % 10 === 0;
}

export type PatientMessageConsent = { consented:boolean; revoked?:boolean; channel:'sms'|'voice'|'email'|'fax'; purpose:'care'|'billing'|'operations'; };
export function patientMessageAllowed(input: PatientMessageConsent) {
  return input.consented === true && input.revoked !== true;
}

export function virtualVisitMetadata(url: string) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:') throw new Error('Virtual visit URL must use HTTPS');
  return { appointmentResource:'Appointment' as const, connectionType:'video' as const, url:parsed.toString(), syntheticOnly:true };
}

export function documentExchangeDescriptor(contentType: 'application/fhir+json'|'application/pdf'|'text/xml'|'application/xml') {
  return { resources:['DocumentReference','Binary'] as const, contentType, ccdaCompatible: contentType === 'text/xml' || contentType === 'application/xml', syntheticOnly:true };
}
