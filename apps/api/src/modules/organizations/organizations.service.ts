import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction } from '@sbos/database';

import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { UpdateOrganizationDto } from './dto/update-organization.dto';

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Fetch the organization the current user belongs to. */
  async findCurrent(organizationId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });
    if (!org) {
      throw new NotFoundException('Organization not found');
    }
    return org;
  }

  /** Update the current organization's profile. */
  async updateCurrent(
    organizationId: string,
    actorId: string,
    dto: UpdateOrganizationDto,
  ) {
    const before = await this.findCurrent(organizationId);
    const updated = await this.prisma.organization.update({
      where: { id: organizationId },
      data: dto,
    });

    await this.audit.record({
      organizationId,
      actorId,
      action: AuditAction.UPDATE,
      entityType: 'Organization',
      entityId: organizationId,
      metadata: {
        changedFields: Object.keys(dto),
        before: {
          name: before.name,
          email: before.email,
          phone: before.phone,
          timezone: before.timezone,
        },
        after: {
          name: updated.name,
          email: updated.email,
          phone: updated.phone,
          timezone: updated.timezone,
        },
      },
    });

    return updated;
  }

  /** Aggregate counts for the organization overview. */
  async stats(organizationId: string) {
    const [clients, clinicians, appointments, users] = await Promise.all([
      this.prisma.client.count({ where: { organizationId, deletedAt: null } }),
      this.prisma.clinician.count({ where: { organizationId } }),
      this.prisma.appointment.count({ where: { organizationId } }),
      this.prisma.user.count({ where: { organizationId } }),
    ]);
    return { clients, clinicians, appointments, users };
  }
}
