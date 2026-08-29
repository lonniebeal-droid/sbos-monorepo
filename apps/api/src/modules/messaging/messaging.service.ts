import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MessageThreadType } from '@sbos/database';

import { PrismaService } from '../../prisma/prisma.service';
import { CreateThreadDto, PostMessageDto } from './dto/messaging.dto';

@Injectable()
export class MessagingService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Every participant userId must belong to this organization.
   * Prevents cross-tenant users from being attached to message threads.
   */
  private async ensureUsersInOrg(
    organizationId: string,
    userIds: string[],
  ): Promise<void> {
    const uniqueIds = Array.from(new Set(userIds));
    const users = await this.prisma.user.findMany({
      where: { organizationId, id: { in: uniqueIds } },
      select: { id: true },
    });
    if (users.length !== uniqueIds.length) {
      const found = new Set(users.map((u) => u.id));
      const missing = uniqueIds.find((id) => !found.has(id));
      throw new NotFoundException(`User ${missing ?? 'unknown'} not found`);
    }
  }

  async createThread(
    organizationId: string,
    creatorId: string,
    dto: CreateThreadDto,
  ) {
    const participantIds = Array.from(
      new Set([creatorId, ...dto.participantIds]),
    );
    await this.ensureUsersInOrg(organizationId, participantIds);

    return this.prisma.messageThread.create({
      data: {
        organizationId,
        type: (dto.type as MessageThreadType) ?? MessageThreadType.DIRECT,
        subject: dto.subject,
        participants: {
          create: participantIds.map((userId) => ({ userId })),
        },
      },
      include: { participants: true },
    });
  }

  listThreads(organizationId: string, userId: string) {
    return this.prisma.messageThread.findMany({
      where: {
        organizationId,
        participants: { some: { userId } },
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        participants: true,
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
  }

  private async ensureParticipant(
    organizationId: string,
    threadId: string,
    userId: string,
  ) {
    const thread = await this.prisma.messageThread.findFirst({
      where: { id: threadId, organizationId },
      include: { participants: { where: { userId }, select: { id: true } } },
    });
    if (!thread) throw new NotFoundException(`Thread ${threadId} not found`);
    if (thread.participants.length === 0) {
      throw new ForbiddenException('You are not a participant in this thread');
    }
    return thread;
  }

  async getThread(organizationId: string, threadId: string, userId: string) {
    await this.ensureParticipant(organizationId, threadId, userId);
    // Update the caller's last-read marker.
    await this.prisma.threadParticipant.updateMany({
      where: { threadId, userId },
      data: { lastReadAt: new Date() },
    });
    return this.prisma.messageThread.findUnique({
      where: { id: threadId },
      include: {
        participants: true,
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });
  }

  async postMessage(
    organizationId: string,
    threadId: string,
    senderId: string,
    dto: PostMessageDto,
  ) {
    await this.ensureParticipant(organizationId, threadId, senderId);
    const message = await this.prisma.message.create({
      data: { threadId, senderId, body: dto.body },
    });
    await this.prisma.messageThread.update({
      where: { id: threadId },
      data: { updatedAt: new Date() },
    });
    return message;
  }
}
