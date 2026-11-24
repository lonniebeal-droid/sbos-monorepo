import { Injectable } from '@nestjs/common';
import { IntegrationConfigService, IntegrationStatus, IntegrationType, VendorConnectionStatus } from './integration-config.service';
import { X12GeneratorService } from '../x12/x12-generator.service';
import { X12ParserService } from '../x12/x12-parser.service';
import { VendorConnectorBase } from '../vendors/vendor-connector.base';
import { SimplePracticeConnector } from '../vendors/simple-practice.connector';
import { EpicConnector } from '../vendors/epic.connector';
import { AthenahealthConnector } from '../vendors/athenahealth.connector';
import { CernerConnector } from '../vendors/cerner.connector';
import { EclinicalworksConnector } from '../vendors/eclinicalworks.connector';
import { NextGenConnector } from '../vendors/nextgen.connector';
import { VeradigmConnector } from '../vendors/veradigm.connector';
import { GenericHL7V2Connector } from '../vendors/generichl7.connector';
import { AvailityConnector } from '../clearinghouses/availity.connector';
import { ChangeHealthcareConnector } from '../clearinghouses/change-healthcare.connector';
import { GenericX12Connector } from '../clearinghouses/generic-x12.connector';
import { SmartOAuthService } from '../smart/smart-oauth.service';
import { ProviderAdapter, SMART_SCOPES, SmartScope } from '../provider/provider-adapter';

/** Providers an office admin can select for the medical connector lifecycle. */
export const MEDICAL_PROVIDER_IDS = ['smart-fhir','simplepractice','epic','athenahealth','cerner','eclinicalworks','nextgen','veradigm','generichl7'] as const;
export type MedicalProviderId = typeof MEDICAL_PROVIDER_IDS[number];

@Injectable()
export class IntegrationAdminService {
 private readonly adapters = new Map<string, ProviderAdapter>();
 constructor(private readonly configService:IntegrationConfigService,private readonly x12Generator:X12GeneratorService,private readonly x12Parser:X12ParserService){}
 private args(tenantId:string,c:any){return [this.configService.prisma,this.configService.audit,{...c,tenantId},this.x12Generator,this.x12Parser] as const}
 private buildConnector(tenantId:string,provider:string,c:any):VendorConnectorBase{const map:any={simplepractice:SimplePracticeConnector,epic:EpicConnector,athenahealth:AthenahealthConnector,cerner:CernerConnector,eclinicalworks:EclinicalworksConnector,nextgen:NextGenConnector,veradigm:VeradigmConnector,generichl7:GenericHL7V2Connector,'smart-fhir':SmartOAuthService};const C=map[provider]??VendorConnectorBase;return new C(...this.args(tenantId,c));}
 private resolveScopes(scopes?:string[]):SmartScope[]{const allowed=Object.values(SMART_SCOPES) as SmartScope[];if(!scopes||!scopes.length)return [SMART_SCOPES.patientRead,SMART_SCOPES.offlineAccess];const valid=scopes.filter((s):s is SmartScope=>(allowed as string[]).includes(s));return valid.length?valid:[SMART_SCOPES.patientRead,SMART_SCOPES.offlineAccess];}
 private adapterFor(tenantId:string){return this.adapters.get(tenantId);}
 /** Number of adapter-managed medical connections (test introspection). */
 adapterCount(){return this.adapters.size;}
 async connectVendor(tenantId:string,_type:IntegrationType,vendor:string,c:any){if(this.configService.getConnector(tenantId))return {success:false,detail:'Tenant already has a connection registered',status:IntegrationStatus.CODE_READY}; const map:any={simplepractice:SimplePracticeConnector,epic:EpicConnector,athenahealth:AthenahealthConnector,cerner:CernerConnector,eclinicalworks:EclinicalworksConnector,nextgen:NextGenConnector,veradigm:VeradigmConnector,generichl7:GenericHL7V2Connector}; const C=map[vendor]??VendorConnectorBase; const connector:any=new C(...this.args(tenantId,c)); this.configService.register(connector); await connector.authorize('synthetic-demo-code'); return {success:true,connector,detail:`${connector.provider} connector connected (synthetic/demo mode)`,status:IntegrationStatus.AUTOMATED_TESTED};}
 async connectClearinghouse(tenantId:string,_type:IntegrationType,name:'availity'|'change-healthcare'|'generic-x12',c:any){if(this.configService.getConnector(tenantId))return {success:false,detail:'Tenant already has a connection registered',status:IntegrationStatus.CODE_READY}; const map:any={availity:AvailityConnector,'change-healthcare':ChangeHealthcareConnector,'generic-x12':GenericX12Connector}; const connector:any=new map[name](...this.args(tenantId,c));this.configService.register(connector);await connector.authorize('synthetic-demo-code');return {success:true,connector,detail:`${connector.provider} clearinghouse connected (synthetic/demo mode)`,status:IntegrationStatus.AUTOMATED_TESTED};}
 async connectSmartOnFhir(tenantId:string,c:any){if(this.configService.getConnector(tenantId))return {success:false,detail:'Tenant already has a connection registered',status:IntegrationStatus.CODE_READY}; const connector=new SmartOAuthService(this.configService.prisma,this.configService.audit,{...c,tenantId});this.configService.register(connector);await connector.authorize('synthetic-smart-code');return {success:true,connector,detail:'SMART on FHIR R4 connector connected (synthetic/demo mode)',status:IntegrationStatus.AUTOMATED_TESTED};}
 async disconnectTenant(id:string){return this.configService.disconnect(id)}
 getAllStatuses():VendorConnectionStatus[]{return this.configService.listStatuses()}
 async syncSyntheticResources(id:string,type:'patients'|'appointments'|'claims',limit=10){const c:any=this.configService.getConnector(id);return c?c.syncSyntheticResources(type,limit):{success:false,synced:0,resources:[],detail:'No connector registered for this tenant'}}
 async checkHealth(id:string){const h=await this.configService.checkHealth(id);const c=this.configService.getConnector(id);return {...h,connector:c?.connectorName}}
 // -- Medical provider lifecycle (ProviderAdapter-backed) -----------------
 // Every method takes the caller's tenantId and delegates to the tenant-bound
 // ProviderAdapter, which re-asserts tenant isolation on every operation.
 // The HTTP layer must always pass user.organizationId, never a body field.
 /** Configure: register connector + adapter (not yet authorized). */
 async configureMedicalProvider(tenantId:string,provider:string,c:{baseUrl:string;clientId:string;scopes?:string[]}){
  if(!tenantId||typeof tenantId!=='string')return {success:false as const,detail:'Invalid tenant'};
  if(!(MEDICAL_PROVIDER_IDS as readonly string[]).includes(provider))return {success:false as const,detail:`Unknown provider '${provider}'`};
  if(this.adapterFor(tenantId)||this.configService.getConnector(tenantId))return {success:false as const,detail:'Tenant already has a connection registered',status:IntegrationStatus.CODE_READY};
  const connector=this.buildConnector(tenantId,provider,c);
  this.configService.register(connector);
  const adapter=new ProviderAdapter(connector,tenantId,this.resolveScopes(c.scopes));
  this.adapters.set(tenantId,adapter);
  return {success:true as const,detail:`${connector.provider} configured (not yet authorized)`,status:IntegrationStatus.CODE_READY,health:adapter.getHealth()};
 }
 /** Authorize: perform the OAuth code exchange through the adapter. */
 async authorizeMedicalConnection(tenantId:string,code='synthetic-adapter-code'){
  const a=this.adapterFor(tenantId);
  if(!a)return {success:false as const,error:'No medical provider configured for this tenant'};
  const r=await a.connect(tenantId,code);
  return {...r,health:a.getHealth()};
 }
 /** Test the connection. */
 async testMedicalConnection(tenantId:string){
  const a=this.adapterFor(tenantId);
  if(!a)return {success:false as const,healthy:false,error:'No medical provider configured for this tenant'};
  return a.test(tenantId);
 }
 /** Connection health model for this tenant. */
 getMedicalConnectionHealth(tenantId:string){
  const a=this.adapterFor(tenantId);
  if(!a)return {status:'disconnected' as const,tenantId,detail:'No medical provider configured for this tenant'};
  return a.getHealth();
 }
 /** Discover capabilities: provider, granted scopes, supported resources, health. */
 getMedicalConnectionCapabilities(tenantId:string){
  const a=this.adapterFor(tenantId);
  if(!a)return {success:false as const,error:'No medical provider configured for this tenant'};
  const h=a.getHealth();
  const connector=this.configService.getConnector(tenantId) as unknown as {supportedResources?:string[]}|undefined;
  return {success:true as const,provider:h.provider,tenantId,grantedScopes:h.grantedScopes,supportedResources:connector?.supportedResources??[],health:h.status};
 }
 /** Sync permitted synthetic FHIR resources. */
 async syncMedicalResources(tenantId:string,resourceTypes:string[]){
  const a=this.adapterFor(tenantId);
  if(!a)return {success:false as const,synced:0,resources:[],error:'No medical provider configured for this tenant'};
  return a.syncFhir(tenantId,resourceTypes);
 }
 /** Retry after a recoverable connection error. */
 async retryMedicalConnection(tenantId:string){
  const a=this.adapterFor(tenantId);
  if(!a)return {success:false as const,recovered:false,error:'No medical provider configured for this tenant'};
  return a.retry(tenantId);
 }
 /** Revoke: adapter revoke + remove from registries. */
 async revokeMedicalConnection(tenantId:string){
  const a=this.adapterFor(tenantId);
  if(!a)return {success:false as const,error:'No medical provider configured for this tenant'};
  const r=await a.revoke(tenantId);
  this.adapters.delete(tenantId);
  await this.configService.disconnect(tenantId);
  return r;
 }
}
