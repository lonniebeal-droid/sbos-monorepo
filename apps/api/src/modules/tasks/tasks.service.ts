import { Injectable, NotFoundException } from '@nestjs/common';
import { TaskStatus, type Prisma } from '@sbos/database';

import { paginate } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTaskDto, TaskQueryDto, UpdateTaskDto } from './dto/task.dto';

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  create(organizationId: string, createdById: string, dto: CreateTaskDto) {
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
    const { dueDate, status, ...rest } = dto;
    const data: Prisma.TaskUpdateInput = { ...rest };
    if (dueDate) data.dueDate = new Date(dueDate);
    if (status) {
      data.status = status as TaskStatus;
      if (status === 'COMPLETED') data.completedAt = new Date();
    }
    return this.prisma.task.update({ where: { id }, data });
  }

  async remove(organizationId: string, id: string) {
    await this.ensure(organizationId, id);
    await this.prisma.task.delete({ where: { id } });
    return { success: true };
  }
}
