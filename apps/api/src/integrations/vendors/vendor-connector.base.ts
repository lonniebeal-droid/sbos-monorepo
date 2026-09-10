import { Injectable, OnModuleInit } from '@nestjs/common';
import { AuditService } from '../../audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { X12GeneratorService } from '../x12/x12-generator.service';
import { X12ParserService } from '../x12/x12-parser.service';

export interface ConnectorConfig { baseUrl:string; tenantId:string; clientId:string; clientSecret?:string; scopes?:string[]; }

@Injectable()
export class VendorConnectorBase implements OnModuleInit {
  public readonly connectorName: string;
  public readonly tenantId: string;
  public readonly baseUrl: string;
  public readonly provider: string = 'generic';
  public readonly supportedResources = ['patient_demographics','appointments','claims','eligibility','era'];
  protected oauthToken: string|null=null;
  protected oauthRefreshToken: string|null=null;
  protected oauthExpiresAt: number|null=null;
  protected lastHealthCheck: number|null=null;
  protected errorCount=0; protected retryCount=0;
  constructor(public readonly prisma:PrismaService, public readonly audit:AuditService, protected readonly config:ConnectorConfig, protected readonly x12Generator?:X12GeneratorService, protected readonly x12Parser?:X12ParserService){ this.connectorName=this.constructor.name; this.tenantId=config.tenantId; this.baseUrl=config.baseUrl; }
  onModuleInit():void{}
  getStatus(){ return {connector:this.connectorName,tenant:this.tenantId,oauth:this.oauthToken?'connected':'disconnected',lastHealthCheck:this.lastHealthCheck,errorCount:this.errorCount,retryCount:this.retryCount}; }
  async authorize(_code?:string){ this.oauthToken=`synthetic_${this.provider}_token`; this.oauthRefreshToken=`synthetic_${this.provider}_refresh`; this.oauthExpiresAt=Date.now()+3600000; await this.auditAction('admin','UPDATE','Integration',this.connectorName,{synthetic:true,provider:this.provider}); return {success:true,detail:`Mock token issued for ${this.displayName}`}; }
  async refreshToken(){ if(!this.oauthRefreshToken)return {success:false,detail:'No refresh token available'}; this.oauthToken=`synthetic_${this.provider}_token_refreshed`; this.oauthExpiresAt=Date.now()+3600000; return {success:true,detail:`Mock token refreshed for ${this.displayName}`}; }
  async revokeToken(){ this.oauthToken=null; this.oauthRefreshToken=null; this.oauthExpiresAt=null; await this.auditAction('admin','UPDATE','Integration',this.connectorName,{revoked:true}); return {success:true,detail:'OAuth token revoked'}; }
  async healthCheck(){ this.lastHealthCheck=Date.now(); return this.oauthToken?{healthy:true,detail:'Synthetic health check passed'}:{healthy:false,detail:'No OAuth token'}; }
  protected get displayName(){ return this.provider; }
  protected get mrnPrefix(){ return 'SRN'; }
  protected get appointmentPrefix(){ return 'appt'; }
  protected get patientPrefix(){ return 'Synthetic'; }
  async getPatientDemographics(patientId:string){ if(!this.oauthToken)return {success:false,patient:null,error:'Not authenticated'}; return {success:true,patient:{id:`${this.patientPrefix.toLowerCase()}_patient_${patientId}`,firstName:'Synthetic',lastName:`${this.displayName}Patient`,mrn:`${this.mrnPrefix}1234567`,npi:'1234567890',dateOfBirth:'1990-01-01',gender:'Other',email:'synthetic@example.test',phone:'555-0100'},error:undefined}; }
  async listAppointments(startDate:Date,_endDate:Date){ if(!this.oauthToken)return {success:false,appointments:[],error:'Not authenticated'}; return {success:true,appointments:[{id:`${this.appointmentPrefix}_1`,startTime:startDate.toISOString(),endTime:new Date(startDate.getTime()+3600000).toISOString(),patientName:`${this.patientPrefix} Patient1`,type:'Synthetic'}],error:undefined}; }
  private generator(){ return this.x12Generator ?? new X12GeneratorService(); }
  async submitClaim837P(d:{patientMemberId:string;cptCode:string;icd10Codes:string[];billedAmount:number;serviceDate:Date;patientFirstName?:string;patientLastName?:string}){ if(!this.oauthToken)return {success:false,claimId:'',x12:'',status:'DENIED' as const,error:'Not authenticated'}; const claimId=`${this.provider}_claim_1`; const x12=await this.generator().generateProfessionalClaim837P(claimId,'1234567890',d.patientFirstName??'Synthetic',d.patientLastName??'Patient',new Date('1990-01-01'),d.patientMemberId,d.icd10Codes,d.cptCode,d.billedAmount,d.serviceDate); return {success:true,claimId,x12,status:'SUBMITTED' as const,error:undefined}; }
  async checkEligibility270(memberId:string,_codes:string[]=[],date=new Date()){ const g=this.generator(); return {success:true,x12Inquiry:await g.generateEligibilityInquiry270('Synthetic','Patient',new Date('1990-01-01'),memberId,'SBOS','TEST'),x12Response:await g.generateEligibilityResponse271('Synthetic','Patient',new Date('1990-01-01'),memberId,'ELIGIBLE'),patientName:`${this.patientPrefix} Patient`,eligibilityStatus:'ELIGIBLE' as const}; }
  async checkClaimStatus276(claimId:string,memberId:string){ const g=this.generator(); return {success:true,x12Inquiry:await g.generateStatusInquiry276(claimId,memberId),x12Response:await g.generateStatusResponse277(claimId,'ACCEPTED',memberId),status:'ACCEPTED' as const}; }
  async postEra835(claimId:string,amount:number,status:'PAID'|'PARTIALLY_PAID'|'DENIED'='PAID',reasons:{code:string;description:string}[]=[]){ return {success:true,x12:await this.generator().generateEra835(claimId,'SYNTHETIC',amount,new Date(),status,reasons),postedAt:new Date().toISOString(),error:undefined}; }
  async syncSyntheticResources(resourceType:'patients'|'appointments'|'claims',limit=10){ const count=Math.max(0,Math.min(limit,3)); const resources=Array.from({length:count},(_,i)=>({id:`synthetic_${resourceType}_${i+1}`,resourceType,synthetic:true})); return {success:true,synced:resources.length,resources,detail:'Synthetic only; no network transmission'}; }
  protected async auditAction(actorId:string,action:string,entityType:string,entityId:string,metadata?:Record<string,any>){ if(this.audit?.record) await this.audit.record({organizationId:this.tenantId,actorId,action:action as any,entityType,entityId,metadata}); }
}
