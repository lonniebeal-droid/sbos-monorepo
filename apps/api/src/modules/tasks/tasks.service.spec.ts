import { NotFoundException } from '@nestjs/common';
import { AuditAction } from '@sbos/database';
import { describe, expect, it, vi } from 'vitest';

import { TasksService } from './tasks.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { AuditService } from '../../audit/audit.service';

function makeService(overrides?: { prisma?: Partial<PrismaService> }) {
  const defaultPrisma = {
    client: { findFirst: vi.fn().mockResolvedValue({ id: 'c1' }) },
    user: { findFirst: vi.fn().mockResolvedValue({ id: 'u1' }) },
    task: {
      findFirst: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
  };
  const prisma = {
    ...defaultPrisma,
    ...(overrides?.prisma ?? {}),
  } as unknown as PrismaService;
  if (overrides?.prisma) {
    Object.assign(prisma, overrides.prisma);
  }
  const audit = { record: vi.fn() } as unknown as AuditService;
  return { service: new TasksService(prisma, audit), audit, prisma };
}

describe('TasksService.remove', () => {
  it('deletes the task and records an audit entry', async () => {
    const existing = { id: 't1', title: 'Follow up with client' };
    const prisma = {
      task: {
        findFirst: vi.fn().mockResolvedValue(existing),
        delete: vi.fn().mockResolvedValue(existing),
      },
    } as unknown as PrismaService;
    const { service, audit } = makeService({ prisma });

    const result = await service.remove('org1', 'actor1', 't1');

    expect(prisma.task.delete).toHaveBeenCalledWith({ where: { id: 't1' } });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org1',
        actorId: 'actor1',
        action: AuditAction.DELETE,
        entityType: 'Task',
        entityId: 't1',
        metadata: expect.objectContaining({ title: 'Follow up with client' }),
      }),
    );
    expect(result).toEqual({ success: true });
  });

  it('throws NotFoundException and never deletes/audits a missing task', async () => {
    const prisma = {
      task: { findFirst: vi.fn().mockResolvedValue(null), delete: vi.fn() },
    } as unknown as PrismaService;
    const { service, audit } = makeService({ prisma });

    await expect(service.remove('org1', 'actor1', 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.task.delete).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });
});

describe('TasksService.create — tenant ownership', () => {
  it('rejects when clientId is not in the actor organization', async () => {
    const prisma = {
      client: { findFirst: vi.fn().mockResolvedValue(null) },
      task: { create: vi.fn() },
    } as unknown as PrismaService;
    const { service } = makeService({ prisma });

    await expect(
      service.create('org1', 'creator1', {
        title: 'Follow up',
        clientId: 'c-other',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.task.create).not.toHaveBeenCalled();
  });

  it('rejects when assigneeId is not in the actor organization', async () => {
    const prisma = {
      user: { findFirst: vi.fn().mockResolvedValue(null) },
      task: { create: vi.fn() },
    } as unknown as PrismaService;
    const { service } = makeService({ prisma });

    await expect(
      service.create('org1', 'creator1', {
        title: 'Follow up',
        assigneeId: 'u-other',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.task.create).not.toHaveBeenCalled();
  });

  it('creates when optional client and assignee belong to the organization', async () => {
    const created = { id: 't1', title: 'Follow up' };
    const prisma = {
      client: { findFirst: vi.fn().mockResolvedValue({ id: 'c1' }) },
      user: { findFirst: vi.fn().mockResolvedValue({ id: 'u1' }) },
      task: { create: vi.fn().mockResolvedValue(created) },
    } as unknown as PrismaService;
    const { service } = makeService({ prisma });

    const result = await service.create('org1', 'creator1', {
      title: 'Follow up',
      clientId: 'c1',
      assigneeId: 'u1',
    });
    expect(prisma.task.create).toHaveBeenCalled();
    expect(result).toBe(created);
  });
});
