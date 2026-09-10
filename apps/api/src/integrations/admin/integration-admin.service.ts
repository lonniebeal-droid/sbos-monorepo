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
@Injectable()
export class IntegrationAdminService {
 constructor(private readonly configService:IntegrationConfigService,private readonly x12Generator:X12GeneratorService,private readonly x12Parser:X12ParserService){}
 private args(tenantId:string,c:any){return [this.configService.prisma,this.configService.audit,{...c,tenantId},this.x12Generator,this.x12Parser] as const}
 async connectVendor(tenantId:string,_type:IntegrationType,vendor:string,c:any){if(this.configService.getConnector(tenantId))return {success:false,detail:'Tenant already has a connection registered',status:IntegrationStatus.CODE_READY}; const map:any={simplepractice:SimplePracticeConnector,epic:EpicConnector,athenahealth:AthenahealthConnector,cerner:CernerConnector,eclinicalworks:EclinicalworksConnector,nextgen:NextGenConnector,veradigm:VeradigmConnector,generichl7:GenericHL7V2Connector}; const C=map[vendor]??VendorConnectorBase; const connector:any=new C(...this.args(tenantId,c)); this.configService.register(connector); await connector.authorize('synthetic-demo-code'); return {success:true,connector,detail:`${connector.provider} connector connected (synthetic/demo mode)`,status:IntegrationStatus.AUTOMATED_TESTED};}
 async connectClearinghouse(tenantId:string,_type:IntegrationType,name:'availity'|'change-healthcare'|'generic-x12',c:any){if(this.configService.getConnector(tenantId))return {success:false,detail:'Tenant already has a connection registered',status:IntegrationStatus.CODE_READY}; const map:any={availity:AvailityConnector,'change-healthcare':ChangeHealthcareConnector,'generic-x12':GenericX12Connector}; const connector:any=new map[name](...this.args(tenantId,c));this.configService.register(connector);await connector.authorize('synthetic-demo-code');return {success:true,connector,detail:`${connector.provider} clearinghouse connected (synthetic/demo mode)`,status:IntegrationStatus.AUTOMATED_TESTED};}
 async connectSmartOnFhir(tenantId:string,c:any){if(this.configService.getConnector(tenantId))return {success:false,detail:'Tenant already has a connection registered',status:IntegrationStatus.CODE_READY}; const connector=new SmartOAuthService(this.configService.prisma,this.configService.audit,{...c,tenantId});this.configService.register(connector);await connector.authorize('synthetic-smart-code');return {success:true,connector,detail:'SMART on FHIR R4 connector connected (synthetic/demo mode)',status:IntegrationStatus.AUTOMATED_TESTED};}
 async disconnectTenant(id:string){return this.configService.disconnect(id)}
 getAllStatuses():VendorConnectionStatus[]{return this.configService.listStatuses()}
 async syncSyntheticResources(id:string,type:'patients'|'appointments'|'claims',limit=10){const c:any=this.configService.getConnector(id);return c?c.syncSyntheticResources(type,limit):{success:false,synced:0,resources:[],detail:'No connector registered for this tenant'}}
 async checkHealth(id:string){const h=await this.configService.checkHealth(id);const c=this.configService.getConnector(id);return {...h,connector:c?.connectorName}}
}
