import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CliniciansService {
  constructor(private readonly prisma: PrismaService) {}

  /** List clinicians in the organization for pickers and scheduling. */
  async list(organizationId: string) {
    const clinicians = await this.prisma.clinician.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'asc' },
      include: {
        user: { select: { firstName: true, lastName: true } },
      },
    });
    return clinicians.map((clinician) => ({
      id: clinician.id,
      title: clinician.title,
      credentials: clinician.credentials,
      specialties: clinician.specialties,
      isAcceptingNewClients: clinician.isAcceptingNewClients,
      name: `${clinician.title ?? ''} ${clinician.user.firstName} ${clinician.user.lastName}`.trim(),
    }));
  }
}
