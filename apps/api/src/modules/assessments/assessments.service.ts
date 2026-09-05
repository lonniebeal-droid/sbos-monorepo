import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, type Prisma } from '@sbos/database';

import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { CreateAssessmentDto } from './dto/create-assessment.dto';
import { UpdateAssessmentDto } from './dto/update-assessment.dto';

@Injectable()
export class AssessmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(organizationId: string, actorId: string, dto: CreateAssessmentDto) {
    await this.assertClientInOrganization(organizationId, dto.clientId);
    const { clientId, administeredAt, responses, ...rest } = dto;
    return this.prisma.assessment.create({
      data: {
        ...rest,
        clientId,
        organizationId,
        administeredAt: administeredAt ? new Date(administeredAt) : new Date(),
        ...(responses ? { responses: responses as Prisma.InputJsonValue } : {}),
      },
    });
  }

  private async assertClientInOrganization(organizationId: string, clientId: string) {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!client) {
      throw new NotFoundException(`Client ${clientId} not found`);
    }
  }

  findForClient(organizationId: string, clientId: string) {
    return this.prisma.assessment.findMany({
      where: { organizationId, clientId },
      orderBy: { administeredAt: 'desc' },
    });
  }

  private async ensure(organizationId: string, id: string) {
    const assessment = await this.prisma.assessment.findFirst({
      where: { id, organizationId },
    });
    if (!assessment) {
      throw new NotFoundException(`Assessment ${id} not found`);
    }
    return assessment;
  }

  async update(organizationId: string, id: string, dto: UpdateAssessmentDto) {
    await this.ensure(organizationId, id);
    const { responses, administeredAt, ...rest } = dto;
    const data: Prisma.AssessmentUpdateInput = {
      ...rest,
      ...(responses ? { responses: responses as Prisma.InputJsonValue } : {}),
      ...(administeredAt ? { administeredAt: new Date(administeredAt) } : {}),
    };
    return this.prisma.assessment.update({ where: { id }, data });
  }

  async remove(organizationId: string, actorId: string, id: string) {
    const existing = await this.ensure(organizationId, id);
    await this.prisma.assessment.delete({ where: { id } });
    await this.audit.record({
      organizationId,
      actorId,
      action: AuditAction.DELETE,
      entityType: 'Assessment',
      entityId: id,
      metadata: {
        clientId: existing.clientId,
        instrument: existing.instrument,
        score: existing.score,
      },
    });
    return { success: true };
  }
}
