import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, type Prisma } from '@sbos/database';

import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { CreateAdmissionDto } from './dto/create-admission.dto';
import { UpdateAdmissionDto } from './dto/update-admission.dto';

@Injectable()
export class AdmissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private async assertClientInOrganization(
    organizationId: string,
    clientId: string,
  ) {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!client) {
      throw new NotFoundException(`Client ${clientId} not found`);
    }
  }

  private async ensure(organizationId: string, id: string) {
    const admission = await this.prisma.admission.findFirst({
      where: { id, organizationId },
    });
    if (!admission) {
      throw new NotFoundException(`Admission ${id} not found`);
    }
    return admission;
  }

  async create(
    organizationId: string,
    actorId: string,
    dto: CreateAdmissionDto,
  ) {
    await this.assertClientInOrganization(organizationId, dto.clientId);
    const { clientId, admittedAt, ...rest } = dto;
    const created = await this.prisma.admission.create({
      data: {
        ...rest,
        clientId,
        organizationId,
        admittedAt: admittedAt ? new Date(admittedAt) : new Date(),
      },
    });
    await this.audit.record({
      organizationId,
      actorId,
      action: AuditAction.CREATE,
      entityType: 'Admission',
      entityId: created.id,
      metadata: {
        clientId: created.clientId,
        program: created.program,
        status: created.status,
      },
    });
    return created;
  }

  findForClient(organizationId: string, clientId: string) {
    return this.prisma.admission.findMany({
      where: { organizationId, clientId },
      orderBy: { admittedAt: 'desc' },
    });
  }

  async findOne(organizationId: string, id: string) {
    return this.ensure(organizationId, id);
  }

  async update(
    organizationId: string,
    actorId: string,
    id: string,
    dto: UpdateAdmissionDto,
  ) {
    await this.ensure(organizationId, id);
    const { admittedAt, dischargedAt, ...rest } = dto;
    const data: Prisma.AdmissionUpdateInput = {
      ...rest,
      ...(admittedAt ? { admittedAt: new Date(admittedAt) } : {}),
      ...(dischargedAt ? { dischargedAt: new Date(dischargedAt) } : {}),
    };
    const updated = await this.prisma.admission.update({ where: { id }, data });
    await this.audit.record({
      organizationId,
      actorId,
      action: AuditAction.UPDATE,
      entityType: 'Admission',
      entityId: id,
      metadata: {
        clientId: updated.clientId,
        status: updated.status,
        dischargedAt: updated.dischargedAt,
      },
    });
    return updated;
  }

  async remove(organizationId: string, actorId: string, id: string) {
    const existing = await this.ensure(organizationId, id);
    await this.prisma.admission.delete({ where: { id } });
    await this.audit.record({
      organizationId,
      actorId,
      action: AuditAction.DELETE,
      entityType: 'Admission',
      entityId: id,
      metadata: {
        clientId: existing.clientId,
        program: existing.program,
        status: existing.status,
      },
    });
    return { success: true };
  }
}
