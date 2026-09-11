import { describe, expect, it } from 'vitest';
import { MEDICAL_ECOSYSTEM_CAPABILITIES, buildSyntheticMedicationRequest, dicomWebPaths, documentExchangeDescriptor, fhirResourcePath, patientMessageAllowed, validateNpiChecksum, virtualVisitMetadata } from './medical-ecosystem.types';

describe('medical ecosystem standards contracts', () => {
  it('provides the required ecosystem categories without pretending external authorization', () => {
    expect(MEDICAL_ECOSYSTEM_CAPABILITIES.map(x=>x.category)).toEqual(expect.arrayContaining(['eRx / pharmacy','labs','imaging','HIE / network','provider identity','communications','payments','telehealth','document exchange']));
    expect(MEDICAL_ECOSYSTEM_CAPABILITIES.find(x=>x.category==='payments')?.localStatus).toBe('EXTERNAL-HUMAN-GATE');
  });
  it('builds bounded FHIR resource paths and rejects empty IDs', () => {
    expect(fhirResourcePath('Practitioner','abc-1')).toBe('/Practitioner/abc-1');
    expect(fhirResourcePath('DocumentReference')).toBe('/DocumentReference');
    expect(()=>fhirResourcePath('Binary','../oops')).toThrow(/Invalid/);
    expect(()=>fhirResourcePath('Practitioner','')).toThrow(/Invalid/);
  });
  it('builds a bounded synthetic MedicationRequest workflow without claiming production eRx authority', () => {
    expect(buildSyntheticMedicationRequest({patientId:'pat-1',practitionerId:'prac-1',rxNormCode:'860975',medicationDisplay:'Synthetic medication'})).toMatchObject({
      resourceType:'MedicationRequest',
      status:'draft',
      intent:'order',
      subject:{reference:'Patient/pat-1'},
      requester:{reference:'Practitioner/prac-1'},
      syntheticOnly:true,
    });
    expect(()=>buildSyntheticMedicationRequest({patientId:'',practitionerId:'prac-1',rxNormCode:'860975'})).toThrow(/Invalid FHIR/);
    expect(()=>buildSyntheticMedicationRequest({patientId:'pat-1',practitionerId:'prac-1',rxNormCode:'not-rxnorm'})).toThrow(/RxNorm/);
  });
  it('builds DICOMweb study routes from the parsed URL', () => {
    expect(dicomWebPaths('https://pacs.example.test/dicomweb')).toEqual({qido:'https://pacs.example.test/dicomweb/studies',wado:'https://pacs.example.test/dicomweb/studies',stow:'https://pacs.example.test/dicomweb/studies'});
    expect(dicomWebPaths('https://pacs.example.test/dicomweb?tenant=acme')).toEqual({qido:'https://pacs.example.test/dicomweb/studies?tenant=acme',wado:'https://pacs.example.test/dicomweb/studies?tenant=acme',stow:'https://pacs.example.test/dicomweb/studies?tenant=acme'});
    expect(()=>dicomWebPaths('https://pacs.example.test/dicomweb#fragment')).toThrow(/fragment/);
  });
  it('validates the NPI Luhn checksum but not licensure', () => {
    expect(validateNpiChecksum('1467859900')).toBe(true);
    expect(validateNpiChecksum('1467859901')).toBe(false);
    expect(validateNpiChecksum('abc')).toBe(false);
  });
  it('requires active consent before communications', () => {
    expect(patientMessageAllowed({consented:true,channel:'sms',purpose:'care'})).toBe(true);
    expect(patientMessageAllowed({consented:true,revoked:true,channel:'sms',purpose:'care'})).toBe(false);
    expect(patientMessageAllowed({consented:false,channel:'email',purpose:'billing'})).toBe(false);
  });
  it('requires HTTPS for virtual visits', () => {
    expect(virtualVisitMetadata('https://video.example.test/room').syntheticOnly).toBe(true);
    expect(()=>virtualVisitMetadata('http://video.example.test/room')).toThrow(/HTTPS/);
  });
  it('marks XML document exchange as C-CDA-compatible transport content', () => {
    expect(documentExchangeDescriptor('text/xml')).toMatchObject({ccdaCompatible:true,syntheticOnly:true});
  });
});
