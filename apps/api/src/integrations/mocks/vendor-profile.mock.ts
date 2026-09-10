export type VendorKind='ehr'|'fhir'|'clearinghouse'|'interface';
export interface VendorProfile { id:string;displayName:string;type:VendorKind;capabilities:string[];auth:'oauth2'|'smart'|'configured';syntheticOnly:boolean; }
export const VENDOR_PROFILES:VendorProfile[]=[
{id:'simplepractice',displayName:'SimplePractice',type:'ehr',capabilities:['patients','appointments','claims'],auth:'oauth2',syntheticOnly:true},
{id:'epic',displayName:'Epic',type:'fhir',capabilities:['Patient','Appointment','Encounter','Coverage'],auth:'smart',syntheticOnly:true},
{id:'athenahealth',displayName:'athenahealth',type:'ehr',capabilities:['patients','appointments','claims'],auth:'oauth2',syntheticOnly:true},
{id:'cerner',displayName:'Oracle Health / Cerner',type:'fhir',capabilities:['Patient','Appointment','Encounter'],auth:'smart',syntheticOnly:true},
{id:'meditech',displayName:'MEDITECH',type:'fhir',capabilities:['Patient','Appointment','Encounter','Coverage'],auth:'smart',syntheticOnly:true},
{id:'eclinicalworks',displayName:'eClinicalWorks',type:'ehr',capabilities:['patients','appointments','claims'],auth:'oauth2',syntheticOnly:true},
{id:'nextgen',displayName:'NextGen',type:'ehr',capabilities:['patients','appointments','claims'],auth:'oauth2',syntheticOnly:true},
{id:'veradigm',displayName:'Veradigm / Allscripts',type:'ehr',capabilities:['patients','appointments','claims'],auth:'oauth2',syntheticOnly:true},
{id:'generic-smart-fhir-r4',displayName:'Generic SMART on FHIR R4',type:'fhir',capabilities:['Patient','Appointment','Encounter','Coverage','Condition','Medication'],auth:'smart',syntheticOnly:true},
{id:'generic-hl7-v2',displayName:'Generic HL7 v2',type:'interface',capabilities:['ADT','SIU','ORU'],auth:'configured',syntheticOnly:true},
{id:'availity',displayName:'Availity',type:'clearinghouse',capabilities:['270/271','837P','276/277','278','835'],auth:'oauth2',syntheticOnly:true},
{id:'change-healthcare',displayName:'Change Healthcare / Optum',type:'clearinghouse',capabilities:['270/271','837P','276/277','278','835'],auth:'oauth2',syntheticOnly:true},
{id:'generic-x12',displayName:'Generic X12',type:'clearinghouse',capabilities:['270/271','837P','837I','276/277','278','835'],auth:'configured',syntheticOnly:true},
];
export function getVendorProfile(id:string){return VENDOR_PROFILES.find(v=>v.id===id)}
