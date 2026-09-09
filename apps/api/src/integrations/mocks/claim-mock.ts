export type SyntheticClaim={claimNumber:string;patientMemberId:string;cptCode:string;icd10Codes:string[];billedAmount:number;serviceDate:string;status:'DRAFT'|'SUBMITTED'|'ACCEPTED'|'DENIED'|'PARTIALLY_PAID'|'PAID'|'VOID'};
export function generateSyntheticClaim():SyntheticClaim{return {claimNumber:'SYN-CLM-001',patientMemberId:'SYN-MEMBER',cptCode:'90837',icd10Codes:['F32.9'],billedAmount:150,serviceDate:'2026-01-01',status:'DRAFT'}}
export function generateSyntheticClaimWithCodes(cptCode='90837',icd='F32.9'){return {...generateSyntheticClaim(),cptCode,icd10Codes:[icd]}}
export function generateSyntheticClaimBatch(n=3){return Array.from({length:n},(_,i)=>({...generateSyntheticClaim(),claimNumber:`SYN-CLM-${i+1}`}))}
