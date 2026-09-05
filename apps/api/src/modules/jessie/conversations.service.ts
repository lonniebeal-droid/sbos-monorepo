import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  AssistantKind,
  AuditAction,
  MessageRole,
} from '@sbos/database';

import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import {
  CHAT_PROVIDER,
  type AssistantKindName,
  type ChatMessage,
  type ChatProvider,
} from '../../ai/chat/chat-provider.interface';
import { PromptsService } from './prompts.service';
import { KnowledgeService } from './knowledge.service';
import { StartConversationDto, SendMessageDto } from './dto/jessie.dto';

/** Kinds that benefit from knowledge-base grounding. */
const GROUNDED_KINDS: AssistantKind[] = [
  AssistantKind.RECEPTIONIST,
  AssistantKind.KNOWLEDGE,
  AssistantKind.GENERAL,
];

@Injectable()
export class ConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly prompts: PromptsService,
    private readonly knowledge: KnowledgeService,
    @Inject(CHAT_PROVIDER) private readonly chat: ChatProvider,
  ) {}

  async start(
    organizationId: string,
    userId: string,
    dto: StartConversationDto,
  ) {
    const kind = (dto.kind ?? 'RECEPTIONIST') as AssistantKind;
    const conversation = await this.prisma.conversation.create({
      data: {
        organizationId,
        kind,
        subject: dto.subject,
        clientId: dto.clientId,
        userId,
      },
    });

    if (dto.message) {
      return this.sendMessage(organizationId, conversation.id, { message: dto.message });
    }
    return this.get(organizationId, conversation.id);
  }

  list(organizationId: string) {
    return this.prisma.conversation.findMany({
      where: { organizationId },
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { messages: true } } },
    });
  }

  async get(organizationId: string, id: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id, organizationId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!conversation) {
      throw new NotFoundException(`Conversation ${id} not found`);
    }
    return conversation;
  }

  /**
   * Append a user message, generate an assistant reply grounded in the resolved
   * system prompt, conversation memory, and (for grounded kinds) the knowledge
   * base, then persist and return the assistant message.
   */
  async sendMessage(
    organizationId: string,
    id: string,
    dto: SendMessageDto,
  ) {
    const conversation = await this.get(organizationId, id);
    const kind = conversation.kind as AssistantKindName;

    await this.prisma.conversationMessage.create({
      data: { conversationId: id, role: MessageRole.USER, content: dto.message },
    });

    const [systemPrompt, history] = await Promise.all([
      this.prompts.resolveSystemPrompt(organizationId, kind),
      this.prisma.conversationMessage.findMany({
        where: { conversationId: id },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    const messages: ChatMessage[] = history.map((m) => ({
      role: m.role.toLowerCase() as ChatMessage['role'],
      content: m.content,
    }));

    const knowledge = GROUNDED_KINDS.includes(conversation.kind)
      ? await this.knowledge.retrieve(organizationId)
      : undefined;

    const result = await this.chat.generateReply({
      kind,
      systemPrompt,
      messages,
      knowledge,
    });

    const assistantMessage = await this.prisma.conversationMessage.create({
      data: {
        conversationId: id,
        role: MessageRole.ASSISTANT,
        content: result.content,
        provider: result.provider,
      },
    });

    await this.prisma.conversation.update({
      where: { id },
      data: { updatedAt: new Date() },
    });

    await this.audit.record({
      organizationId,
      action: AuditAction.CREATE,
      entityType: 'ConversationMessage',
      entityId: assistantMessage.id,
      metadata: { kind, provider: result.provider },
    });

    return assistantMessage;
  }

  async close(organizationId: string, actorId: string, id: string) {
    const existing = await this.get(organizationId, id);
    const updated = await this.prisma.conversation.update({
      where: { id },
      data: { status: 'CLOSED' },
    });

    await this.audit.record({
      organizationId,
      actorId,
      action: AuditAction.UPDATE,
      entityType: 'Conversation',
      entityId: id,
      metadata: {
        previousStatus: existing.status,
        newStatus: 'CLOSED',
        kind: existing.kind,
      },
    });

    return updated;
  }
}
