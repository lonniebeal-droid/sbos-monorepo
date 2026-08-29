import { NotFoundException } from '@nestjs/common';
import { AuditAction } from '@sbos/database';
import { describe, expect, it, vi } from 'vitest';

import { TasksService } from './tasks.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { AuditService } from '../../audit/audit.service';

function makeService(overrides?: { prisma?: Partial<PrismaService> }) {
  const prisma = (overrides?.prisma ?? {}) as PrismaService;
  const audit = { record: vi.fn() } as unknown as AuditService;
  return { service: new TasksService(prisma, audit), audit };
}

describe('TasksService.create ownership', () => {
  it('creates when optional clientId belongs to the org', async () => {
    const created = { id: 't1', title: 'Follow up', clientId: 'c1' };
    const prisma = {
      client: { findFirst: vi.fn().mockResolvedValue({ id: 'c1' }) },
      task: { create: vi.fn().mockResolvedValue(created) },
    } as unknown as PrismaService;
    const { service } = makeService({ prisma });

    const result = await service.create('org1', 'user1', {
      title: 'Follow up',
      clientId: 'c1',
    });

    expect(prisma.client.findFirst).toHaveBeenCalledWith({
      where: { id: 'c1', organizationId: 'org1', deletedAt: null },
      select: { id: true },
    });
    expect(result).toEqual(created);
  });

  it('rejects foreign-org clientId and never creates', async () => {
    const prisma = {
      client: { findFirst: vi.fn().mockResolvedValue(null) },
      task: { create: vi.fn() },
    } as unknown as PrismaService;
    const { service } = makeService({ prisma });

    await expect(
      service.create('org1', 'user1', { title: 'Follow up', clientId: 'foreign' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.task.create).not.toHaveBeenCalled();
  });

  it('creates without clientId without ownership check', async () => {
    const created = { id: 't1', title: 'Internal task' };
    const prisma = {
      client: { findFirst: vi.fn() },
      task: { create: vi.fn().mockResolvedValue(created) },
    } as unknown as PrismaService;
    const { service } = makeService({ prisma });

    const result = await service.create('org1', 'user1', { title: 'Internal task' });
    expect(prisma.client.findFirst).not.toHaveBeenCalled();
    expect(result).toEqual(created);
  });
});

describe('TasksService.update ownership', () => {
  it('rejects reassignment to a foreign-org clientId', async () => {
    const existing = { id: 't1', title: 'Task' };
    const prisma = {
      client: { findFirst: vi.fn().mockResolvedValue(null) },
      task: {
        findFirst: vi.fn().mockResolvedValue(existing),
        update: vi.fn(),
      },
    } as unknown as PrismaService;
    const { service } = makeService({ prisma });

    await expect(
      service.update('org1', 'actor1', 't1', { clientId: 'foreign-client' }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.task.update).not.toHaveBeenCalled();
  });
});

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
      }),
    );
    expect(result).toEqual({ success: true });
  });

  it('throws NotFoundException and never deletes/audits when missing', async () => {
    const prisma = {
      task: { findFirst: vi.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;
    const { service, audit } = makeService({ prisma });

    await expect(service.remove('org1', 'actor1', 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(audit.record).not.toHaveBeenCalled();
  });
});

describe('TasksService.update status audit', () => {
  it('audits UPDATE when status changes', async () => {
    const existing = { id: 'x1', status: 'OPEN', title: 'Task' };
    const updated = { ...existing, status: 'COMPLETED' };
    const prisma = {
      task: {
        findFirst: vi.fn().mockResolvedValue(existing),
        update: vi.fn().mockResolvedValue(updated),
      },
    } as unknown as PrismaService;
    const { service, audit } = makeService({ prisma });

    const result = await service.update('org1', 'actor1', 'x1', {
      status: 'COMPLETED',
    } as never);

    expect(result).toEqual(updated);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org1',
        actorId: 'actor1',
        action: AuditAction.UPDATE,
        entityType: 'Task',
        entityId: 'x1',
        metadata: expect.objectContaining({
          previousStatus: 'OPEN',
          newStatus: 'COMPLETED',
        }),
      }),
    );
  });

  it('throws NotFoundException and never writes/audits when missing', async () => {
    const prisma = {
      task: { findFirst: vi.fn().mockResolvedValue(null), update: vi.fn() },
    } as unknown as PrismaService;
    const { service, audit } = makeService({ prisma });

    await expect(
      service.update('org1', 'actor1', 'missing', { status: 'COMPLETED' } as never),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.task.update).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });
});
