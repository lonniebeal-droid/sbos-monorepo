import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, DiagnosisStatus, type Prisma } from '@sbos/database';

import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { CreateDiagnosisDto } from './dto/create-diagnosis.dto';
import { UpdateDiagnosisDto } from './dto/update-diagnosis.dto';

@Injectable()
export class DiagnosesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Ensure the client exists in this org (and is not soft-deleted). */
  private async ensureClientInOrg(organizationId: string, clientId: string) {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!client) {
      throw new NotFoundException(`Client ${clientId} not found`);
    }
    return client;
  }

  async create(organizationId: string, dto: CreateDiagnosisDto) {
    const { clientId, ...rest } = dto;
    await this.ensureClientInOrg(organizationId, clientId);
    return this.prisma.diagnosis.create({
      data: { ...rest, clientId, organizationId },
    });
  }

  findForClient(organizationId: string, clientId: string) {
    return this.prisma.diagnosis.findMany({
      where: { organizationId, clientId },
      orderBy: [{ type: 'asc' }, { diagnosedAt: 'desc' }],
    });
  }

  private async ensure(organizationId: string, id: string) {
    const diagnosis = await this.prisma.diagnosis.findFirst({
      where: { id, organizationId },
    });
    if (!diagnosis) {
      throw new NotFoundException(`Diagnosis ${id} not found`);
    }
    return diagnosis;
  }

  async update(
    organizationId: string,
    actorId: string,
    id: string,
    dto: UpdateDiagnosisDto,
  ) {
    const existing = await this.ensure(organizationId, id);
    const data: Prisma.DiagnosisUpdateInput = { ...dto };
    if (dto.status === 'RESOLVED') {
      data.resolvedAt = new Date();
    }
    const updated = await this.prisma.diagnosis.update({ where: { id }, data });

    if (dto.status && dto.status !== existing.status) {
      await this.audit.record({
        organizationId,
        actorId,
        action: AuditAction.UPDATE,
        entityType: 'Diagnosis',
        entityId: id,
        metadata: {
          previousStatus: existing.status,
          newStatus: dto.status,
          clientId: existing.clientId,
        },
      });
    }

    return updated;
  }

  async remove(organizationId: string, actorId: string, id: string) {
    const existing = await this.ensure(organizationId, id);
    await this.prisma.diagnosis.delete({ where: { id } });
    await this.audit.record({
      organizationId,
      actorId,
      action: AuditAction.DELETE,
      entityType: 'Diagnosis',
      entityId: id,
      metadata: { clientId: existing.clientId, icd10Code: existing.icd10Code },
    });
    return { success: true };
  }

  countActive(organizationId: string, clientId: string) {
    return this.prisma.diagnosis.count({
      where: { organizationId, clientId, status: DiagnosisStatus.ACTIVE },
    });
  }
}
