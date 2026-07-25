import { Injectable } from '@nestjs/common';
import { NotificationType } from '@sbos/database';

import { PrismaService } from '../../prisma/prisma.service';

export interface CreateNotificationInput {
  organizationId: string;
  userId: string;
  type?: NotificationType;
  title: string;
  body?: string;
  linkUrl?: string;
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Internal API used by other modules to emit a notification. */
  create(input: CreateNotificationInput) {
    return this.prisma.notification.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId,
        type: input.type ?? NotificationType.SYSTEM,
        title: input.title,
        body: input.body,
        linkUrl: input.linkUrl,
      },
    });
  }

  listForUser(organizationId: string, userId: string, unreadOnly: boolean) {
    return this.prisma.notification.findMany({
      where: {
        organizationId,
        userId,
        ...(unreadOnly ? { isRead: false } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  unreadCount(organizationId: string, userId: string) {
    return this.prisma.notification
      .count({ where: { organizationId, userId, isRead: false } })
      .then((count) => ({ count }));
  }

  async markRead(organizationId: string, userId: string, id: string) {
    await this.prisma.notification.updateMany({
      where: { id, organizationId, userId },
      data: { isRead: true, readAt: new Date() },
    });
    return { success: true };
  }

  async markAllRead(organizationId: string, userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { organizationId, userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    return { updated: result.count };
  }
}
