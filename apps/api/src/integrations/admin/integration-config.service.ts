import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { VendorConnectorBase } from '../vendors/vendor-connector.base';
export enum IntegrationStatus { CODE_READY='code-ready', AUTOMATED_TESTED='automated-tested', SANDBOX_VERIFIED='sandbox-verified', PRODUCTION_VERIFIED='production-verified' }
export enum IntegrationType { VENDOR='vendor', CLEARINGHOUSE='clearinghouse', SMART_ON_FHIR='smart-on-fhir', X12='x12' }
export interface VendorConnectionStatus {connector:string;tenant:string;type:IntegrationType;status:IntegrationStatus;oauth:string|null;lastHealthCheck:number|null;errorCount:number;retryCount:number;connectedAt:number|null;lastSyncedAt:number|null;provider?:string}
@Injectable()
export class IntegrationConfigService {
 private readonly integrations=new Map<string,VendorConnectorBase>();
 constructor(public readonly prisma:PrismaService, public readonly audit:AuditService){}
 register(c:VendorConnectorBase){this.integrations.set(c.tenantId,c)}
 getConnector(id:string){return this.integrations.get(id)}
 listConnections(){return [...this.integrations.values()]}
 getStatus(id:string){const c=this.getConnector(id); return c?.getStatus().oauth==='connected'?IntegrationStatus.AUTOMATED_TESTED:c?IntegrationStatus.CODE_READY:undefined}
 async checkHealth(id:string){const c=this.getConnector(id); if(!c)return {healthy:false,status:IntegrationStatus.CODE_READY,detail:'No connector registered for this tenant'}; const h=await c.healthCheck(); return {...h,status:h.healthy?IntegrationStatus.AUTOMATED_TESTED:IntegrationStatus.CODE_READY}}
 async disconnect(id:string){const c=this.getConnector(id); if(!c)return {success:false,detail:'No connector found for tenant'}; const r=await c.revokeToken(); this.integrations.delete(id); return r;}
 listStatuses():VendorConnectionStatus[]{return this.listConnections().map(c=>({connector:c.connectorName,tenant:c.tenantId,type:IntegrationType.VENDOR,status:this.getStatus(c.tenantId)??IntegrationStatus.CODE_READY,oauth:c.getStatus().oauth,lastHealthCheck:c.getStatus().lastHealthCheck,errorCount:c.getStatus().errorCount,retryCount:c.getStatus().retryCount,connectedAt:null,lastSyncedAt:null,provider:c.provider}))}
}
