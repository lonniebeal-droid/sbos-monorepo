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
    expect(prisma.task.create).toHaveBeenCalled();
    expect(result).toEqual(created);
  });

  it('throws NotFoundException and never inserts when clientId is outside the org', async () => {
    const prisma = {
      client: { findFirst: vi.fn().mockResolvedValue(null) },
      task: { create: vi.fn() },
    } as unknown as PrismaService;
    const { service } = makeService({ prisma });

    await expect(
      service.create('org1', 'user1', {
        title: 'Spoofed',
        clientId: 'foreign-client',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.task.create).not.toHaveBeenCalled();
  });

  it('allows create without clientId', async () => {
    const created = { id: 't2', title: 'Internal task' };
    const prisma = {
      client: { findFirst: vi.fn() },
      task: { create: vi.fn().mockResolvedValue(created) },
    } as unknown as PrismaService;
    const { service } = makeService({ prisma });

    await service.create('org1', 'user1', { title: 'Internal task' });

    expect(prisma.client.findFirst).not.toHaveBeenCalled();
    expect(prisma.task.create).toHaveBeenCalled();
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
      service.update('org1', 't1', { clientId: 'foreign-client' }),
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
