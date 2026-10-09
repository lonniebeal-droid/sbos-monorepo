import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, WaitlistStatus, type Prisma } from '@sbos/database';

import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { CreateWaitlistDto, UpdateWaitlistDto } from './dto/waitlist.dto';

@Injectable()
export class WaitlistService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Client-supplied ownership IDs must belong to this organization.
   * Prevents cross-tenant waitlist attachment via clientId/clinicianId.
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

  async create(organizationId: string, actorId: string, dto: CreateWaitlistDto) {
    await this.ensureClientInOrg(organizationId, dto.clientId);
    if (dto.clinicianId) {
      await this.ensureClinicianInOrg(organizationId, dto.clinicianId);
    }

    const entry = await this.prisma.waitlistEntry.create({
      data: { ...dto, organizationId },
    });

    await this.audit.record({
      organizationId,
      actorId,
      action: AuditAction.CREATE,
      entityType: 'WaitlistEntry',
      entityId: entry.id,
      metadata: {
        clientId: entry.clientId,
        priority: entry.priority,
      },
    });

    return entry;
  }

  findAll(organizationId: string, status?: WaitlistStatus) {
    const where: Prisma.WaitlistEntryWhereInput = {
      organizationId,
      ...(status ? { status } : {}),
    };
    return this.prisma.waitlistEntry.findMany({
      where,
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
      include: {
        client: { select: { id: true, firstName: true, lastName: true, mrn: true } },
      },
    });
  }

  async updateStatus(
    organizationId: string,
    actorId: string,
    id: string,
    dto: UpdateWaitlistDto,
  ) {
    const entry = await this.prisma.waitlistEntry.findFirst({
      where: { id, organizationId },
      select: { id: true, status: true, clientId: true },
    });
    if (!entry) throw new NotFoundException(`Waitlist entry ${id} not found`);
    const updated = await this.prisma.waitlistEntry.update({
      where: { id },
      data: { status: dto.status as WaitlistStatus },
    });

    await this.audit.record({
      organizationId,
      actorId,
      action: AuditAction.UPDATE,
      entityType: 'WaitlistEntry',
      entityId: id,
      metadata: {
        previousStatus: entry.status,
        newStatus: dto.status,
        clientId: entry.clientId,
      },
    });

    return updated;
  }

  async remove(organizationId: string, actorId: string, id: string) {
    const entry = await this.prisma.waitlistEntry.findFirst({
      where: { id, organizationId },
      select: { id: true, clientId: true },
    });
    if (!entry) throw new NotFoundException(`Waitlist entry ${id} not found`);
    await this.prisma.waitlistEntry.delete({ where: { id } });
    await this.audit.record({
      organizationId,
      actorId,
      action: AuditAction.DELETE,
      entityType: 'WaitlistEntry',
      entityId: id,
      metadata: { clientId: entry.clientId },
    });
    return { success: true };
  }
}
