import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, TaskStatus, type Prisma } from '@sbos/database';

import { paginate } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { CreateTaskDto, TaskQueryDto, UpdateTaskDto } from './dto/task.dto';

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Optional clientId/assigneeId must belong to this organization.
   * Prevents cross-tenant task attachment.
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

  private async ensureUserInOrg(
    organizationId: string,
    userId: string,
  ): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, organizationId },
      select: { id: true },
    });
    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }
  }

  async create(organizationId: string, createdById: string, dto: CreateTaskDto) {
    if (dto.clientId) {
      await this.ensureClientInOrg(organizationId, dto.clientId);
    }
    if (dto.assigneeId) {
      await this.ensureUserInOrg(organizationId, dto.assigneeId);
    }

    const { dueDate, ...rest } = dto;
    return this.prisma.task.create({
      data: {
        ...rest,
        organizationId,
        createdById,
        ...(dueDate ? { dueDate: new Date(dueDate) } : {}),
      },
    });
  }

  async findAll(organizationId: string, query: TaskQueryDto) {
    const where: Prisma.TaskWhereInput = {
      organizationId,
      ...(query.status ? { status: query.status as TaskStatus } : {}),
      ...(query.assigneeId ? { assigneeId: query.assigneeId } : {}),
      ...(query.search
        ? { title: { contains: query.search, mode: 'insensitive' } }
        : {}),
    };
    const [total, data] = await Promise.all([
      this.prisma.task.count({ where }),
      this.prisma.task.findMany({
        where,
        orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);
    return paginate(data, total, query.page, query.limit);
  }

  private async ensure(organizationId: string, id: string) {
    const task = await this.prisma.task.findFirst({
      where: { id, organizationId },
    });
    if (!task) throw new NotFoundException(`Task ${id} not found`);
    return task;
  }

  findOne(organizationId: string, id: string) {
    return this.ensure(organizationId, id);
  }

  async update(organizationId: string, id: string, dto: UpdateTaskDto) {
    await this.ensure(organizationId, id);
    if (dto.clientId) {
      await this.ensureClientInOrg(organizationId, dto.clientId);
    }
    if (dto.assigneeId) {
      await this.ensureUserInOrg(organizationId, dto.assigneeId);
    }
    const { dueDate, status, ...rest } = dto;
    const data: Prisma.TaskUpdateInput = { ...rest };
    if (dueDate) data.dueDate = new Date(dueDate);
    if (status) {
      data.status = status as TaskStatus;
      if (status === 'COMPLETED') data.completedAt = new Date();
    }
    return this.prisma.task.update({ where: { id }, data });
  }

  async remove(organizationId: string, actorId: string, id: string) {
    const existing = await this.ensure(organizationId, id);
    await this.prisma.task.delete({ where: { id } });
    await this.audit.record({
      organizationId,
      actorId,
      action: AuditAction.DELETE,
      entityType: 'Task',
      entityId: id,
      metadata: { title: existing.title },
    });
    return { success: true };
  }
}
