import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction } from '@sbos/database';

import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import {
  CreatePayerDto,
  CreateServiceCodeDto,
  UpdatePayerDto,
  UpdateServiceCodeDto,
} from './dto/reference.dto';

/** Reference/config data for billing: payers and the CPT fee schedule. */
@Injectable()
export class BillingReferenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ----- Payers -----

  async createPayer(organizationId: string, actorId: string, dto: CreatePayerDto) {
    const payer = await this.prisma.payer.create({ data: { ...dto, organizationId } });
    await this.audit.record({
      organizationId,
      actorId,
      action: AuditAction.CREATE,
      entityType: 'Payer',
      entityId: payer.id,
      metadata: { name: payer.name },
    });
    return payer;
  }

  listPayers(organizationId: string) {
    return this.prisma.payer.findMany({
      where: { organizationId },
      orderBy: { name: 'asc' },
    });
  }

  async updatePayer(
    organizationId: string,
    actorId: string,
    id: string,
    dto: UpdatePayerDto,
  ) {
    await this.ensurePayer(organizationId, id);
    const updated = await this.prisma.payer.update({ where: { id }, data: dto });
    await this.audit.record({
      organizationId,
      actorId,
      action: AuditAction.UPDATE,
      entityType: 'Payer',
      entityId: id,
      metadata: { changedFields: Object.keys(dto) },
    });
    return updated;
  }

  private async ensurePayer(organizationId: string, id: string) {
    const payer = await this.prisma.payer.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });
    if (!payer) throw new NotFoundException(`Payer ${id} not found`);
  }

  // ----- Service codes (fee schedule) -----

  async createServiceCode(
    organizationId: string,
    actorId: string,
    dto: CreateServiceCodeDto,
  ) {
    const code = await this.prisma.serviceCode.create({
      data: { ...dto, organizationId },
    });
    await this.audit.record({
      organizationId,
      actorId,
      action: AuditAction.CREATE,
      entityType: 'ServiceCode',
      entityId: code.id,
      metadata: { code: code.code },
    });
    return code;
  }

  listServiceCodes(organizationId: string) {
    return this.prisma.serviceCode.findMany({
      where: { organizationId },
      orderBy: { code: 'asc' },
    });
  }

  async updateServiceCode(
    organizationId: string,
    actorId: string,
    id: string,
    dto: UpdateServiceCodeDto,
  ) {
    const existing = await this.prisma.serviceCode.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException(`Service code ${id} not found`);
    const updated = await this.prisma.serviceCode.update({ where: { id }, data: dto });
    await this.audit.record({
      organizationId,
      actorId,
      action: AuditAction.UPDATE,
      entityType: 'ServiceCode',
      entityId: id,
      metadata: { changedFields: Object.keys(dto) },
    });
    return updated;
  }
}
