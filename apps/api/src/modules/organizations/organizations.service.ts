import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { UpdateOrganizationDto } from './dto/update-organization.dto';

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

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
  async updateCurrent(organizationId: string, dto: UpdateOrganizationDto) {
    await this.findCurrent(organizationId);
    return this.prisma.organization.update({
      where: { id: organizationId },
      data: dto,
    });
  }

  /** Aggregate counts for the organization overview. */
  async stats(organizationId: string) {
    const [clients, clinicians, appointments, users] = await Promise.all([
      this.prisma.client.count({ where: { organizationId } }),
      this.prisma.clinician.count({ where: { organizationId } }),
      this.prisma.appointment.count({ where: { organizationId } }),
      this.prisma.user.count({ where: { organizationId } }),
    ]);
    return { clients, clinicians, appointments, users };
  }
}
