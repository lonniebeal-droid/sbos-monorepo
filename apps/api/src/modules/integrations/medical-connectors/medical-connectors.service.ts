import { Injectable } from '@nestjs/common';
import { AuditAction, Prisma } from '@sbos/database';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditService } from '../../../audit/audit.service';
import type { MedicalConnectorVendor, X12Transaction } from './medical-connectors.types';
import { MEDICAL_CONNECTOR_VENDORS, normalizeScopes, syntheticX12, vendorProfile } from './medical-connectors.types';

type ConnectorRow = { id:string; organizationId:string; vendor:string; baseUrl:string; clientId:string|null; scopes:string|null; status:string; fhirVersion:string|null; lastTestedAt:Date|null; lastError:string|null };

@Injectable()
export class MedicalConnectorsService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  vendors() { return MEDICAL_CONNECTOR_VENDORS.map(vendorProfile); }

  async list(organizationId: string) {
    return this.prisma.$queryRaw<ConnectorRow[]>`SELECT "id","organizationId","vendor","baseUrl","clientId","scopes","status","fhirVersion","lastTestedAt","lastError" FROM "medical_connectors" WHERE "organizationId"=${organizationId} ORDER BY "updatedAt" DESC`;
  }

  async save(organizationId:string, actorId:string, input:{vendor:MedicalConnectorVendor;baseUrl:string;clientId?:string;scopes?:string}) {
    const id = randomUUID(); const scopes = normalizeScopes(input.scopes ?? '').join(' ');
    const rows = await this.prisma.$queryRaw<ConnectorRow[]>(Prisma.sql`INSERT INTO "medical_connectors" ("id","organizationId","vendor","baseUrl","clientId","scopes","status","updatedAt") VALUES (${id},${organizationId},${input.vendor},${input.baseUrl},${input.clientId ?? null},${scopes || null},'not_connected',CURRENT_TIMESTAMP) ON CONFLICT ("organizationId","vendor") DO UPDATE SET "baseUrl"=EXCLUDED."baseUrl","clientId"=EXCLUDED."clientId","scopes"=EXCLUDED."scopes","status"='not_connected',"lastError"=NULL,"updatedAt"=CURRENT_TIMESTAMP RETURNING *`);
    await this.audit.record({ organizationId, actorId, action: AuditAction.UPDATE, entityType:'medical_connector', entityId:rows[0]?.id, metadata:{ event:'connector.saved', vendor:input.vendor, baseUrl:input.baseUrl } });
    return rows[0];
  }

  async test(organizationId:string, actorId:string, id:string) {
    const rows = await this.prisma.$queryRaw<ConnectorRow[]>`SELECT * FROM "medical_connectors" WHERE "id"=${id} AND "organizationId"=${organizationId} LIMIT 1`;
    const c = rows[0]; if (!c) throw new Error('Connector not found');
    await this.prisma.$executeRaw`UPDATE "medical_connectors" SET "status"='testing',"lastTestedAt"=CURRENT_TIMESTAMP,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=${id} AND "organizationId"=${organizationId}`;
    try {
      const root = c.baseUrl.replace(/\/$/, '');
      const response = await fetch(`${root}/metadata`, { headers:{Accept:'application/fhir+json, application/json, application/fhir+xml, application/xml, text/xml'}, signal:AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error(`FHIR metadata returned HTTP ${response.status}`);
      const contentType = response.headers.get('content-type') ?? '';
      const body = await response.text();
      let fhirVersion:string|null = null; let software:string|undefined; let isCapability = false;
      if (contentType.includes('json') || body.trimStart().startsWith('{')) {
        const data:any = JSON.parse(body);
        isCapability = data?.resourceType === 'CapabilityStatement';
        fhirVersion = data?.fhirVersion ?? null;
        software = data?.software?.name ?? data?.publisher;
      } else {
        isCapability = /<(?:[A-Za-z0-9_-]+:)?CapabilityStatement\b/i.test(body);
        fhirVersion = body.match(/<fhirVersion[^>]*value=["']([^"']+)/i)?.[1] ?? null;
        software = body.match(/<software[\s\S]*?<name[^>]*value=["']([^"']+)/i)?.[1];
      }
      if (!isCapability) throw new Error('FHIR metadata endpoint did not return a CapabilityStatement');
      await this.prisma.$executeRaw`UPDATE "medical_connectors" SET "status"='capability_verified',"fhirVersion"=${fhirVersion},"lastError"=NULL,"lastTestedAt"=CURRENT_TIMESTAMP,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=${id} AND "organizationId"=${organizationId}`;
      await this.audit.record({ organizationId, actorId, action:AuditAction.UPDATE, entityType:'medical_connector', entityId:id, metadata:{event:'connector.capability_verified', fhirVersion} });
      return { ok:true, status:'capability_verified', fhirVersion, software, message:'FHIR CapabilityStatement verified; this does not imply sandbox identity, OAuth authorization, or patient-data access.' };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Connection test failed';
      await this.prisma.$executeRaw`UPDATE "medical_connectors" SET "status"='error',"lastError"=${message},"lastTestedAt"=CURRENT_TIMESTAMP,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=${id} AND "organizationId"=${organizationId}`;
      await this.audit.record({ organizationId, actorId, action:AuditAction.UPDATE, entityType:'medical_connector', entityId:id, metadata:{event:'connector.test_failed'} });
      return { ok:false, status:'error', message };
    }
  }

  async disconnect(organizationId:string, actorId:string, id:string) {
    const changed = await this.prisma.$executeRaw`UPDATE "medical_connectors" SET "status"='not_connected',"lastError"=NULL,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=${id} AND "organizationId"=${organizationId}`;
    if (!changed) throw new Error('Connector not found');
    await this.audit.record({ organizationId, actorId, action: AuditAction.UPDATE, entityType:'medical_connector', entityId:id, metadata:{event:'connector.disconnected'} });
    return { ok:true, status:'not_connected' as const };
  }

  previewX12(transaction:X12Transaction, traceId:string) { return syntheticX12(transaction, traceId); }
}
