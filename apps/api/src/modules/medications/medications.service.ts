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

  /**
   * Client-supplied ownership IDs must belong to this organization.
   * Prevents cross-tenant medication attachment via clientId/prescriberId.
   */
  private async ensureClientInOrg(
    organizationId: string,
    clientId: string,
  ): Promise<void> {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!client) {
      throw new NotFoundException(`Client ${clientId} not found`);
    }
  }

  private async ensureClinicianInOrg(
    organizationId: string,
    clinicianId: string,
  ): Promise<void> {
    const clinician = await this.prisma.clinician.findFirst({
      where: { id: clinicianId, organizationId },
      select: { id: true },
    });
    if (!clinician) {
      throw new NotFoundException(`Clinician ${clinicianId} not found`);
    }
  }

  async create(organizationId: string, dto: CreateMedicationDto) {
    await this.ensureClientInOrg(organizationId, dto.clientId);
    if (dto.prescriberId) {
      await this.ensureClinicianInOrg(organizationId, dto.prescriberId);
    }

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
