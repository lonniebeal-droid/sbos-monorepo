import { Injectable } from '@nestjs/common';
import { VendorConnectorBase } from '../vendors/vendor-connector.base';
@Injectable()
export class SmartOAuthService extends VendorConnectorBase {
  public override readonly provider='smart-fhir-r4';
  protected override get displayName(){return 'SMART on FHIR R4';}
  override async authorize(code?:string){ const r=await super.authorize(code); return {...r,token:this.oauthToken}; }
  async fetchFhirResource(resourceType:string,id:string,tenantId:string){ if(!this.oauthToken)return {success:false,resource:null,error:'Not authenticated'}; return {success:true,resource:{resourceType,id:`${resourceType.toLowerCase()}_${id}`,meta:{tenantId,synthetic:true}},error:undefined}; }
  async syncFhirResources(types:string[],tenantId:string){ const resources=types.map((resourceType,i)=>({resourceType,id:`${resourceType.toLowerCase()}_${i+1}`,meta:{tenantId,synthetic:true}})); return {success:true,synced:resources.length,resources}; }
  async getPatientContext(patientId:string,tenantId:string){ if(!this.oauthToken)return {success:false,context:null,error:'Not authenticated'}; return {success:true,context:{patient:{id:patientId,name:'Synthetic Patient',dateOfBirth:'1990-01-01',gender:'Other'},organization:{id:tenantId,name:'Synthetic Organization'}},error:undefined}; }
}
