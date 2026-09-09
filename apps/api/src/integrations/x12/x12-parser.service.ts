import { Injectable } from '@nestjs/common';
import { X12GeneratorService } from './x12-generator.service';
export { X12GeneratorService } from './x12-generator.service';

@Injectable()
export class X12ParserService {
  constructor(private readonly generator: X12GeneratorService) {}
  async parse(x12: string): Promise<any> { return this.generator.parse(x12); }
  extractClaimNumberFrom837P(x12:string){ return x12.match(/\*REF\*FH\*([^*]+)/)?.[1] ?? null; }
  extractMemberIdFromNM1QC(x12:string){ return x12.match(/\*NM1\*QC\*1\*[^*]*\*MI\*([^*]+)/)?.[1] ?? null; }
  extractStatusFrom277(x12:string){ return x12.match(/\*L277\*PS\*1\*[^*]+\*([A-Z_]+)/)?.[1] ?? null; }
  extractCptFromSV1(x12:string){ return x12.match(/\*SV1\*HC\*1\*([^*]+)/)?.[1] ?? null; }
  extractIcd10Codes(x12:string){ return [...x12.matchAll(/\*IK\*([^*]+)/g)].map(m=>m[1]); }
  extractPaidAmountFrom835(x12:string){ const v=x12.match(/\*AMT\*FH\*(\d+)/)?.[1]; return v ? Number(v)/100 : null; }
  extractReasonCodesFrom835(x12:string){ return [...x12.matchAll(/\*CAS\*([^*]+)\*([^*]+)/g)].map(m=>({code:m[1],description:m[2]})); }
  async verifyRoundTrip(fn:(...a:any[])=>Promise<string>, ...args:any[]){ const generated=await fn(...args); const parsed=await this.parse(generated); return {generated, parsed, integrity: Boolean(parsed.transactionSetId)}; }
}
