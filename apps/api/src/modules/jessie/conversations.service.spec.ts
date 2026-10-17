import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { ConversationsService } from './conversations.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { AuditService } from '../../audit/audit.service';
import type { PromptsService } from './prompts.service';
import type { KnowledgeService } from './knowledge.service';
import type { ChatProvider } from '../../ai/chat/chat-provider.interface';

function makeService(overrides?: { prisma?: Partial<PrismaService> }) {
  const defaultPrisma = {
    client: { findFirst: vi.fn().mockResolvedValue({ id: 'c1' }) },
    conversation: {
      create: vi.fn().mockResolvedValue({ id: 'conv1', organizationId: 'org1' }),
      findFirst: vi.fn().mockResolvedValue({
        id: 'conv1',
        organizationId: 'org1',
        kind: 'RECEPTIONIST',
        messages: [],
      }),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    conversationMessage: {
      create: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
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
  const prompts = {
    resolveSystemPrompt: vi.fn().mockResolvedValue('system'),
  } as unknown as PromptsService;
  const knowledge = {
    retrieve: vi.fn().mockResolvedValue([]),
  } as unknown as KnowledgeService;
  const chat = {
    generateReply: vi.fn().mockResolvedValue({
      content: 'hello',
      provider: 'stub',
    }),
  } as unknown as ChatProvider;
  return {
    service: new ConversationsService(prisma, audit, prompts, knowledge, chat),
    prisma,
  };
}

describe('ConversationsService.start — tenant ownership of clientId', () => {
  it('rejects when clientId is not in the actor organization; no conversation create', async () => {
    const { service, prisma } = makeService({
      prisma: {
        client: { findFirst: vi.fn().mockResolvedValue(null) },
        conversation: { create: vi.fn() },
      } as never,
    });

    await expect(
      service.start('org1', 'user1', {
        clientId: 'c-other',
        subject: 'Intake',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.conversation.create).not.toHaveBeenCalled();
    expect(prisma.client.findFirst).toHaveBeenCalledWith({
      where: { id: 'c-other', organizationId: 'org1', deletedAt: null },
      select: { id: true },
    });
  });

  it('creates when clientId belongs to the organization', async () => {
    const created = {
      id: 'conv1',
      organizationId: 'org1',
      kind: 'RECEPTIONIST',
      messages: [],
    };
    const { service, prisma } = makeService({
      prisma: {
        client: { findFirst: vi.fn().mockResolvedValue({ id: 'c1' }) },
        conversation: {
          create: vi.fn().mockResolvedValue(created),
          findFirst: vi.fn().mockResolvedValue(created),
        },
      } as never,
    });

    const result = await service.start('org1', 'user1', {
      clientId: 'c1',
      subject: 'Care question',
    });

    expect(prisma.conversation.create).toHaveBeenCalledWith({
      data: {
        organizationId: 'org1',
        kind: 'RECEPTIONIST',
        subject: 'Care question',
        clientId: 'c1',
        userId: 'user1',
      },
    });
    expect(result).toEqual(created);
  });

  it('creates without clientId when omitted; never checks client table', async () => {
    const created = {
      id: 'conv2',
      organizationId: 'org1',
      kind: 'RECEPTIONIST',
      messages: [],
    };
    const { service, prisma } = makeService({
      prisma: {
        client: { findFirst: vi.fn() },
        conversation: {
          create: vi.fn().mockResolvedValue(created),
          findFirst: vi.fn().mockResolvedValue(created),
        },
      } as never,
    });

    await service.start('org1', 'user1', { subject: 'General' });

    expect(prisma.client.findFirst).not.toHaveBeenCalled();
    expect(prisma.conversation.create).toHaveBeenCalled();
  });
});
