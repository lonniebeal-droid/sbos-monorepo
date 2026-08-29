import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, type Prisma } from '@sbos/database';

import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { CreateMedicationDto } from './dto/create-medication.dto';
import { UpdateMedicationDto } from './dto/update-medication.dto';

@Injectable()
export class MedicationsService {
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

  async create(organizationId: string, dto: CreateMedicationDto) {
    const { clientId, startDate, ...rest } = dto;
    await this.ensureClientInOrg(organizationId, clientId);
    return this.prisma.medication.create({
      data: {
        ...rest,
        clientId,
        organizationId,
        ...(startDate ? { startDate: new Date(startDate) } : {}),
      },
    });
  }

  findForClient(organizationId: string, clientId: string) {
    return this.prisma.medication.findMany({
      where: { organizationId, clientId },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async ensure(organizationId: string, id: string) {
    const medication = await this.prisma.medication.findFirst({
      where: { id, organizationId },
    });
    if (!medication) {
      throw new NotFoundException(`Medication ${id} not found`);
    }
    return medication;
  }

  async update(
    organizationId: string,
    actorId: string,
    id: string,
    dto: UpdateMedicationDto,
  ) {
    const existing = await this.ensure(organizationId, id);
    const { startDate, ...rest } = dto;
    const data: Prisma.MedicationUpdateInput = { ...rest };
    if (startDate) {
      data.startDate = new Date(startDate);
    }
    if (dto.status === 'DISCONTINUED' || dto.status === 'COMPLETED') {
      data.endDate = new Date();
    }
    const updated = await this.prisma.medication.update({ where: { id }, data });

    if (dto.status && dto.status !== existing.status) {
      await this.audit.record({
        organizationId,
        actorId,
        action: AuditAction.UPDATE,
        entityType: 'Medication',
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
    await this.prisma.medication.delete({ where: { id } });
    await this.audit.record({
      organizationId,
      actorId,
      action: AuditAction.DELETE,
      entityType: 'Medication',
      entityId: id,
      metadata: { clientId: existing.clientId, name: existing.name },
    });
    return { success: true };
  }
}
