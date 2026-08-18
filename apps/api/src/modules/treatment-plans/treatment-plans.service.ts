import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, type Prisma } from '@sbos/database';

import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { CreateTreatmentPlanDto } from './dto/create-treatment-plan.dto';
import {
  UpdateGoalDto,
  UpdateTreatmentPlanDto,
} from './dto/update-treatment-plan.dto';

@Injectable()
export class TreatmentPlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  create(organizationId: string, dto: CreateTreatmentPlanDto) {
    return this.prisma.treatmentPlan.create({
      data: {
        organizationId,
        clientId: dto.clientId,
        clinicianId: dto.clinicianId,
        title: dto.title,
        presentingProblem: dto.presentingProblem,
        goals: dto.goals
          ? {
              create: dto.goals.map((goal, index) => ({
                description: goal.description,
                orderIndex: index,
                objectives: goal.objectives
                  ? {
                      create: goal.objectives.map((objective, oIndex) => ({
                        description: objective.description,
                        orderIndex: oIndex,
                      })),
                    }
                  : undefined,
              })),
            }
          : undefined,
      },
      include: { goals: { include: { objectives: true } } },
    });
  }

  findForClient(organizationId: string, clientId: string) {
    return this.prisma.treatmentPlan.findMany({
      where: { organizationId, clientId },
      orderBy: { createdAt: 'desc' },
      include: { goals: { include: { objectives: true } } },
    });
  }

  async findOne(organizationId: string, id: string) {
    const plan = await this.prisma.treatmentPlan.findFirst({
      where: { id, organizationId },
      include: {
        goals: {
          orderBy: { orderIndex: 'asc' },
          include: { objectives: { orderBy: { orderIndex: 'asc' } } },
        },
      },
    });
    if (!plan) {
      throw new NotFoundException(`Treatment plan ${id} not found`);
    }
    return plan;
  }

  async update(organizationId: string, id: string, dto: UpdateTreatmentPlanDto) {
    await this.findOne(organizationId, id);
    const data: Prisma.TreatmentPlanUpdateInput = { ...dto };
    if (dto.status === 'COMPLETED' || dto.status === 'DISCONTINUED') {
      data.endDate = new Date();
    }
    return this.prisma.treatmentPlan.update({ where: { id }, data });
  }

  async updateGoal(
    organizationId: string,
    planId: string,
    goalId: string,
    dto: UpdateGoalDto,
  ) {
    await this.findOne(organizationId, planId);
    const goal = await this.prisma.goal.findFirst({
      where: { id: goalId, treatmentPlanId: planId },
    });
    if (!goal) {
      throw new NotFoundException(`Goal ${goalId} not found on this plan`);
    }
    return this.prisma.goal.update({
      where: { id: goalId },
      data: {
        status: dto.status,
        progressPercent: dto.progressPercent,
      },
    });
  }

  async remove(organizationId: string, actorId: string, id: string) {
    const existing = await this.findOne(organizationId, id);
    if (existing.status !== 'DRAFT') {
      throw new ForbiddenException(
        'Only draft treatment plans can be deleted; discontinue or complete an active plan instead',
      );
    }
    await this.prisma.treatmentPlan.delete({ where: { id } });
    await this.audit.record({
      organizationId,
      actorId,
      action: AuditAction.DELETE,
      entityType: 'TreatmentPlan',
      entityId: id,
      metadata: {
        clientId: existing.clientId,
        title: existing.title,
        goalCount: existing.goals.length,
      },
    });
    return { success: true };
  }
}
