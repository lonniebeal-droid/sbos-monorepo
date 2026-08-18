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

  create(organizationId: string, dto: CreateMedicationDto) {
    const { clientId, startDate, ...rest } = dto;
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

  async update(organizationId: string, id: string, dto: UpdateMedicationDto) {
    await this.ensure(organizationId, id);
    const { startDate, ...rest } = dto;
    const data: Prisma.MedicationUpdateInput = { ...rest };
    if (startDate) {
      data.startDate = new Date(startDate);
    }
    if (dto.status === 'DISCONTINUED' || dto.status === 'COMPLETED') {
      data.endDate = new Date();
    }
    return this.prisma.medication.update({ where: { id }, data });
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
