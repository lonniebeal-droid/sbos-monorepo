import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { MessageThreadType } from '@sbos/database';
import { describe, expect, it, vi } from 'vitest';

import { MessagingService } from './messaging.service';
import { MessageThreadTypeDto } from './dto/messaging.dto';
import type { PrismaService } from '../../prisma/prisma.service';

function makeService(overrides?: { prisma?: Record<string, unknown> }) {
  const prisma = {
    messageThread: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    threadParticipant: {
      updateMany: vi.fn(),
    },
    message: {
      create: vi.fn(),
    },
    ...overrides?.prisma,
  } as unknown as PrismaService;
  return { service: new MessagingService(prisma), prisma };
}

describe('MessagingService.createThread', () => {
  it('dedupes the creator into participants and defaults type to DIRECT', async () => {
    const { service, prisma } = makeService();
    (prisma.messageThread.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 't1',
    });

    await service.createThread('org1', 'creator1', {
      participantIds: ['creator1', 'other1'],
    });

    expect(prisma.messageThread.create).toHaveBeenCalledWith({
      data: {
        organizationId: 'org1',
        type: MessageThreadType.DIRECT,
        subject: undefined,
        participants: {
          create: [{ userId: 'creator1' }, { userId: 'other1' }],
        },
      },
      include: { participants: true },
    });
  });

  it('uses the provided thread type and subject when given', async () => {
    const { service, prisma } = makeService();
    (prisma.messageThread.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 't1',
    });

    await service.createThread('org1', 'creator1', {
      type: MessageThreadTypeDto.GROUP,
      subject: 'Care coordination',
      participantIds: ['other1', 'other2'],
    });

    expect(prisma.messageThread.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: MessageThreadType.GROUP,
          subject: 'Care coordination',
        }),
      }),
    );
  });
});

describe('MessagingService.listThreads', () => {
  it('scopes threads to the organization and requires the caller to be a participant', () => {
    const { service, prisma } = makeService();
    (prisma.messageThread.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    service.listThreads('org1', 'user1');

    expect(prisma.messageThread.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId: 'org1',
          participants: { some: { userId: 'user1' } },
        },
      }),
    );
  });
});

describe('MessagingService.getThread', () => {
  it('throws NotFoundException when no thread matches the id/org', async () => {
    const { service, prisma } = makeService();
    (prisma.messageThread.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await expect(service.getThread('org1', 'missing', 'user1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.threadParticipant.updateMany).not.toHaveBeenCalled();
  });

  it('throws ForbiddenException when the caller is not a participant of an existing thread', async () => {
    const { service, prisma } = makeService();
    (prisma.messageThread.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 't1',
      participants: [],
    });

    await expect(service.getThread('org1', 't1', 'outsider')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.threadParticipant.updateMany).not.toHaveBeenCalled();
  });

  it('marks the caller\'s last-read marker and returns the thread with messages ascending', async () => {
    const { service, prisma } = makeService();
    (prisma.messageThread.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 't1',
      participants: [{ id: 'tp1' }],
    });
    const full = { id: 't1', participants: [], messages: [] };
    (prisma.messageThread.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(full);

    const result = await service.getThread('org1', 't1', 'user1');

    expect(prisma.threadParticipant.updateMany).toHaveBeenCalledWith({
      where: { threadId: 't1', userId: 'user1' },
      data: { lastReadAt: expect.any(Date) },
    });
    expect(prisma.messageThread.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 't1' },
        include: expect.objectContaining({
          messages: expect.objectContaining({ orderBy: { createdAt: 'asc' } }),
        }),
      }),
    );
    expect(result).toBe(full);
  });
});

describe('MessagingService.postMessage', () => {
  it('throws NotFoundException when no thread matches the id/org and never creates a message', async () => {
    const { service, prisma } = makeService();
    (prisma.messageThread.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await expect(
      service.postMessage('org1', 'missing', 'user1', { body: 'hi' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.message.create).not.toHaveBeenCalled();
  });

  it('throws ForbiddenException when the sender is not a participant and never creates a message', async () => {
    const { service, prisma } = makeService();
    (prisma.messageThread.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 't1',
      participants: [],
    });

    await expect(
      service.postMessage('org1', 't1', 'outsider', { body: 'hi' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.message.create).not.toHaveBeenCalled();
  });

  it('creates the message and bumps the thread updatedAt for a valid participant', async () => {
    const { service, prisma } = makeService();
    (prisma.messageThread.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 't1',
      participants: [{ id: 'tp1' }],
    });
    const created = { id: 'm1', threadId: 't1', senderId: 'user1', body: 'hi' };
    (prisma.message.create as ReturnType<typeof vi.fn>).mockResolvedValue(created);

    const result = await service.postMessage('org1', 't1', 'user1', { body: 'hi' });

    expect(prisma.message.create).toHaveBeenCalledWith({
      data: { threadId: 't1', senderId: 'user1', body: 'hi' },
    });
    expect(prisma.messageThread.update).toHaveBeenCalledWith({
      where: { id: 't1' },
      data: { updatedAt: expect.any(Date) },
    });
    expect(result).toBe(created);
  });
});
