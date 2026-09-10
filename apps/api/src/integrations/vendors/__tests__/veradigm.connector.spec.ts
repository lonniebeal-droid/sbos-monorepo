import { beforeEach, describe, expect, it } from 'vitest';
import { VeradigmConnector } from '../veradigm.connector';
import { X12GeneratorService } from '../../x12/x12-generator.service';
import { X12ParserService } from '../../x12/x12-parser.service';

describe('VeradigmConnector synthetic parity',()=>{
 let c:VeradigmConnector;
 beforeEach(async()=>{ const g=new X12GeneratorService(); c=new VeradigmConnector({} as any,{record:async()=>{}} as any,{baseUrl:'https://example.test',tenantId:'tenant-a',clientId:'synthetic'},g,new X12ParserService(g)); await c.authorize('synthetic'); });
 it('authorizes and reports healthy without network',async()=>{expect((await c.healthCheck()).healthy).toBe(true);expect(c.getStatus().oauth).toBe('connected')});
 it('returns synthetic demographics',async()=>{const r:any=await c.getPatientDemographics('1');expect(r.success).toBe(true);expect(r.patient.mrn).toMatch(/^VRN/);expect(r.patient.email).toContain('example.test')});
 it('supports bounded synthetic sync',async()=>{const r=await c.syncSyntheticResources('patients',2);expect(r.synced).toBe(2);expect(r.resources.every(x=>x.synthetic)).toBe(true)});
 it('generates synthetic 270/271 and 837P and 835',async()=>{const e=await c.checkEligibility270('SYN');expect(e.x12Inquiry).toContain('*ST*270*0');expect(e.x12Response).toContain('*ST*271*0');const claim=await c.submitClaim837P({patientMemberId:'SYN',cptCode:'90837',icd10Codes:['F32.9'],billedAmount:150,serviceDate:new Date('2026-01-01')});expect(claim.x12).toContain('*ST*837P*0');const era=await c.postEra835(claim.claimId,150);expect(era.x12).toContain('*ST*835*0')});
 it('revoke disconnects health state',async()=>{await c.revokeToken();expect((await c.healthCheck()).healthy).toBe(false)});
});
