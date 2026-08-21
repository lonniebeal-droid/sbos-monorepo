import { NotFoundException } from '@nestjs/common';
import { AssistantKind, AuditAction, MessageRole } from '@sbos/database';
import { describe, expect, it, vi } from 'vitest';

import { ConversationsService } from './conversations.service';
import type { AuditService } from '../../audit/audit.service';
import type { ChatProvider } from '../../ai/chat/chat-provider.interface';
import type { PrismaService } from '../../prisma/prisma.service';
import type { KnowledgeService } from './knowledge.service';
import type { PromptsService } from './prompts.service';

function makeService(overrides?: {
  conversation?: Record<string, ReturnType<typeof vi.fn>>;
  conversationMessage?: Record<string, ReturnType<typeof vi.fn>>;
  prompts?: Partial<PromptsService>;
  knowledge?: Partial<KnowledgeService>;
  chat?: Partial<ChatProvider>;
}) {
  const prisma = {
    conversation: {
      create: vi.fn().mockResolvedValue({ id: 'conv1' }),
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
      ...overrides?.conversation,
    },
    conversationMessage: {
      create: vi.fn().mockResolvedValue({ id: 'msg-assistant' }),
      findMany: vi.fn().mockResolvedValue([]),
      ...overrides?.conversationMessage,
    },
  } as unknown as PrismaService;
  const audit = { record: vi.fn() } as unknown as AuditService;
  const prompts = {
    resolveSystemPrompt: vi.fn().mockResolvedValue('You are Jessie.'),
    ...overrides?.prompts,
  } as unknown as PromptsService;
  const knowledge = {
    retrieve: vi.fn().mockResolvedValue([{ title: 'FAQ', body: 'We are open 9-5.' }]),
    ...overrides?.knowledge,
  } as unknown as KnowledgeService;
  const chat = {
    generateReply: vi
      .fn()
      .mockResolvedValue({ content: 'Sure, I can help.', provider: 'offline' }),
    ...overrides?.chat,
  } as unknown as ChatProvider;

  return {
    service: new ConversationsService(prisma, audit, prompts, knowledge, chat),
    prisma,
    audit,
    prompts,
    knowledge,
    chat,
  };
}

const OPEN_CONVERSATION = { id: 'conv1', kind: AssistantKind.RECEPTIONIST };

describe('ConversationsService', () => {
  describe('start', () => {
    it('defaults kind to RECEPTIONIST and delegates to get() when no initial message is given', async () => {
      const { service, prisma } = makeService();
      const getSpy = vi.spyOn(service, 'get').mockResolvedValue({ id: 'conv1' } as never);

      await service.start('org1', 'u1', {});

      expect(prisma.conversation.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ kind: AssistantKind.RECEPTIONIST }),
      });
      expect(getSpy).toHaveBeenCalledWith('org1', 'conv1');
    });

    it('preserves an explicitly given kind', async () => {
      const { service, prisma } = makeService();
      vi.spyOn(service, 'get').mockResolvedValue({ id: 'conv1' } as never);

      await service.start('org1', 'u1', { kind: AssistantKind.CLINICAL as never });

      expect(prisma.conversation.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ kind: AssistantKind.CLINICAL }),
      });
    });

    it('delegates to sendMessage() when an initial message is given', async () => {
      const { service } = makeService();
      const sendMessageSpy = vi
        .spyOn(service, 'sendMessage')
        .mockResolvedValue({ id: 'msg-assistant' } as never);
      const getSpy = vi.spyOn(service, 'get');

      const result = await service.start('org1', 'u1', { message: 'Hello Jessie' });

      expect(sendMessageSpy).toHaveBeenCalledWith('org1', 'conv1', {
        message: 'Hello Jessie',
      });
      expect(getSpy).not.toHaveBeenCalled();
      expect(result).toEqual({ id: 'msg-assistant' });
    });
  });

  describe('list', () => {
    it('lists conversations for the org with a message count, newest-updated first', async () => {
      const { service, prisma } = makeService();

      await service.list('org1');

      expect(prisma.conversation.findMany).toHaveBeenCalledWith({
        where: { organizationId: 'org1' },
        orderBy: { updatedAt: 'desc' },
        include: { _count: { select: { messages: true } } },
      });
    });
  });

  describe('get', () => {
    it('throws NotFoundException for a conversation that does not exist in this org', async () => {
      const { service } = makeService({
        conversation: { findFirst: vi.fn().mockResolvedValue(null) },
      });

      await expect(service.get('org1', 'missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('sendMessage', () => {
    it('propagates NotFoundException and never writes a message for a missing conversation', async () => {
      const { service, prisma } = makeService({
        conversation: { findFirst: vi.fn().mockResolvedValue(null) },
      });

      await expect(
        service.sendMessage('org1', 'missing', { message: 'hi' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.conversationMessage.create).not.toHaveBeenCalled();
    });

    it('retrieves knowledge for a grounded kind and includes it in the chat request', async () => {
      const { service, prisma, knowledge, chat } = makeService({
        conversation: { findFirst: vi.fn().mockResolvedValue(OPEN_CONVERSATION) },
      });

      await service.sendMessage('org1', 'conv1', { message: 'What are your hours?' });

      expect(knowledge.retrieve).toHaveBeenCalledWith('org1');
      expect(chat.generateReply).toHaveBeenCalledWith(
        expect.objectContaining({
          knowledge: [{ title: 'FAQ', body: 'We are open 9-5.' }],
        }),
      );
      expect(prisma.conversationMessage.create).toHaveBeenNthCalledWith(1, {
        data: { conversationId: 'conv1', role: MessageRole.USER, content: 'What are your hours?' },
      });
    });

    it('skips knowledge retrieval for a non-grounded kind', async () => {
      const { service, knowledge, chat } = makeService({
        conversation: {
          findFirst: vi
            .fn()
            .mockResolvedValue({ id: 'conv1', kind: AssistantKind.SCHEDULING }),
        },
      });

      await service.sendMessage('org1', 'conv1', { message: 'Reschedule my visit' });

      expect(knowledge.retrieve).not.toHaveBeenCalled();
      expect(chat.generateReply).toHaveBeenCalledWith(
        expect.objectContaining({ knowledge: undefined }),
      );
    });

    it('maps message role case for the chat provider (USER -> user, ASSISTANT -> assistant)', async () => {
      const { service, chat } = makeService({
        conversation: { findFirst: vi.fn().mockResolvedValue(OPEN_CONVERSATION) },
        conversationMessage: {
          findMany: vi.fn().mockResolvedValue([
            { role: MessageRole.USER, content: 'Hi' },
            { role: MessageRole.ASSISTANT, content: 'Hello!' },
          ]),
        },
      });

      await service.sendMessage('org1', 'conv1', { message: 'Follow-up' });

      expect(chat.generateReply).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [
            { role: 'user', content: 'Hi' },
            { role: 'assistant', content: 'Hello!' },
          ],
        }),
      );
    });

    it('persists the assistant reply, touches the conversation, and audits the message', async () => {
      const { service, prisma, audit } = makeService({
        conversation: { findFirst: vi.fn().mockResolvedValue(OPEN_CONVERSATION) },
      });

      const result = await service.sendMessage('org1', 'conv1', { message: 'Hi' });

      expect(prisma.conversationMessage.create).toHaveBeenNthCalledWith(2, {
        data: {
          conversationId: 'conv1',
          role: MessageRole.ASSISTANT,
          content: 'Sure, I can help.',
          provider: 'offline',
        },
      });
      expect(prisma.conversation.update).toHaveBeenCalledWith({
        where: { id: 'conv1' },
        data: { updatedAt: expect.any(Date) },
      });
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: 'org1',
          action: AuditAction.CREATE,
          entityType: 'ConversationMessage',
          entityId: 'msg-assistant',
          metadata: { kind: AssistantKind.RECEPTIONIST, provider: 'offline' },
        }),
      );
      expect(result).toEqual({ id: 'msg-assistant' });
    });
  });

  describe('close', () => {
    it('propagates NotFoundException without updating a missing conversation', async () => {
      const { service, prisma } = makeService({
        conversation: { findFirst: vi.fn().mockResolvedValue(null) },
      });

      await expect(service.close('org1', 'missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.conversation.update).not.toHaveBeenCalled();
    });

    it('marks an existing conversation CLOSED', async () => {
      const { service, prisma } = makeService({
        conversation: { findFirst: vi.fn().mockResolvedValue(OPEN_CONVERSATION) },
      });

      await service.close('org1', 'conv1');

      expect(prisma.conversation.update).toHaveBeenCalledWith({
        where: { id: 'conv1' },
        data: { status: 'CLOSED' },
      });
    });
  });
});
