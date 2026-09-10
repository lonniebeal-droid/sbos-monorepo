import { Injectable } from '@nestjs/common';

export type ClaimStatus = 'ACCEPTED' | 'DENIED' | 'PARTIALLY_PAID' | 'PAID' | 'PENDING';
export type PriorAuthStatus = 'REQUESTED' | 'PENDED' | 'APPROVED' | 'DENIED';

@Injectable()
export class X12GeneratorService {
  private envelope(transaction: string, body: string): string {
    return `ISA*00*          *00*          *ZZ*SBOS*ZZ*TEST*ST*${transaction}*0*${body}*SE*1*0*IEA*1*1`;
  }

  async generateEligibilityInquiry270(first: string, last: string, dob: Date, memberId: string, organization = 'SBOS', payer = 'TEST'): Promise<string> {
    return this.envelope('270', `NM1*QC*1*${last}^${first}*MI*${memberId}*DMG*${dob.toISOString().slice(0,10)}*REF*ORG*${organization}*REF*PR*${payer}`);
  }

  async generateEligibilityResponse271(first: string, last: string, dob: Date, memberId: string, status: 'ELIGIBLE'|'INELIGIBLE'|'PENDING'='ELIGIBLE', plan='Synthetic Plan'): Promise<string> {
    return this.envelope('271', `NM1*85*1*${last}^${first}*MI*${memberId}*DMG*${dob.toISOString().slice(0,10)}*EB*${status}*${plan}`);
  }

  async generateProfessionalClaim837P(claimNumber: string, providerNpi: string, first: string, last: string, dob: Date, memberId: string, icd10Codes: string[], cptCode: string, billedAmount: number, serviceDate: Date): Promise<string> {
    const dx=icd10Codes.slice(0,10).map(c=>`IK*${c}`).join('*');
    return this.envelope('837P', `NM1*85*1*PROVIDER*XX*${providerNpi}*NM1*QC*1*${last}^${first}*MI*${memberId}*DMG*${dob.toISOString().slice(0,10)}*SV1*HC*1*${cptCode}*1*${billedAmount}*AMT*FH*${Math.round(billedAmount*100)}*${dx}*REF*FH*${claimNumber}*DTP*472*D8*${serviceDate.toISOString().slice(0,10)}`);
  }

  async generateInstitutionalClaim837I(claimNumber: string, providerNpi: string, first: string, last: string, dob: Date, memberId: string, icd10Codes: string[], revenueCode: string, billedAmount: number, serviceDate: Date): Promise<string> {
    return this.envelope('837I', `NM1*85*1*PROVIDER*XX*${providerNpi}*NM1*QC*1*${last}^${first}*MI*${memberId}*DMG*${dob.toISOString().slice(0,10)}*SV2*${revenueCode}*${billedAmount}*REF*FH*${claimNumber}*DTP*472*D8*${serviceDate.toISOString().slice(0,10)}*IK*${icd10Codes[0] ?? 'Z00.00'}`);
  }

  async generateStatusInquiry276(claimNumber: string, memberId: string): Promise<string> {
    return this.envelope('276', `NM1*QC*1*SYNTHETIC^PATIENT*MI*${memberId}*REF*FH*${claimNumber}`);
  }

  async generateStatusResponse277(claimNumber: string, status: ClaimStatus, memberId: string): Promise<string> {
    return this.envelope('277', `NM1*QC*1*SYNTHETIC^PATIENT*MI*${memberId}*REF*FH*${claimNumber}*L277*PS*1*${claimNumber}*${status}`);
  }

  async generatePriorAuthorization278(authId: string, memberId: string, providerNpi: string, serviceCode: string, serviceDate: Date, status: PriorAuthStatus='REQUESTED'): Promise<string> {
    return this.envelope('278', `NM1*85*1*PROVIDER*XX*${providerNpi}*NM1*QC*1*SYNTHETIC^PATIENT*MI*${memberId}*REF*G1*${authId}*UM*HS*${serviceCode}*HCR*${status}*DTP*472*D8*${serviceDate.toISOString().slice(0,10)}`);
  }

  async generateEra835(claimId: string, memberId: string, amount: number, paymentDate: Date, status: 'PAID'|'PARTIALLY_PAID'|'DENIED'='PAID', reasons: {code:string;description:string}[]=[]): Promise<string> {
    const cas=(reasons.length?reasons:[{code:'00',description:'Synthetic'}]).map(r=>`CAS*${r.code}*N`).join('*');
    return this.envelope('835', `REF*FH*${claimId}*NM1*QC*1*SYNTHETIC^PATIENT*MI*${memberId}*AMT*FH*${Math.round(amount*100)}*DTM*405*${paymentDate.toISOString().slice(0,10)}*CLP*${status}*${cas}`);
  }

  async parseX12(x12: string): Promise<any> { return this.parse(x12); }
  parse(x12: string): any {
    const tx=x12.match(/\*ST\*([^*]+)\*0/ )?.[1];
    const claim=x12.match(/\*REF\*FH\*([^*]+)/)?.[1];
    const auth=x12.match(/\*REF\*G1\*([^*]+)/)?.[1];
    const cpt=x12.match(/\*SV1\*HC\*1\*([^*]+)/)?.[1];
    const amount=x12.match(/\*AMT\*FH\*(\d+)/)?.[1];
    const status=x12.match(/\*L277\*PS\*1\*[^*]+\*([A-Z_]+)/)?.[1] ?? x12.match(/\*HCR\*([A-Z_]+)/)?.[1];
    const dx=[...x12.matchAll(/\*IK\*([^*]+)/g)].map(m=>m[1]);
    return { transactionSetId: tx, claimNumber: claim, authorizationId: auth, cptCode: cpt, amount: amount ? Number(amount)/100 : undefined, status, icd10Codes: dx };
  }
}
