import { NotificationType } from '@sbos/database';
import { describe, expect, it, vi } from 'vitest';

import { NotificationsService } from './notifications.service';
import type { PrismaService } from '../../prisma/prisma.service';

function makeService(overrides?: { prisma?: Record<string, unknown> }) {
  const prisma = {
    notification: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      updateMany: vi.fn(),
    },
    ...overrides?.prisma,
  } as unknown as PrismaService;
  return { service: new NotificationsService(prisma), prisma };
}

describe('NotificationsService.create', () => {
  it('defaults type to SYSTEM when not provided', () => {
    const { service, prisma } = makeService();

    service.create({
      organizationId: 'org1',
      userId: 'user1',
      title: 'Welcome',
    });

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: {
        organizationId: 'org1',
        userId: 'user1',
        type: NotificationType.SYSTEM,
        title: 'Welcome',
        body: undefined,
        linkUrl: undefined,
      },
    });
  });

  it('uses the provided type/body/linkUrl when given', () => {
    const { service, prisma } = makeService();

    service.create({
      organizationId: 'org1',
      userId: 'user1',
      type: NotificationType.APPOINTMENT,
      title: 'Upcoming appointment',
      body: 'Tomorrow at 1pm',
      linkUrl: '/appointments/appt1',
    });

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: {
        organizationId: 'org1',
        userId: 'user1',
        type: NotificationType.APPOINTMENT,
        title: 'Upcoming appointment',
        body: 'Tomorrow at 1pm',
        linkUrl: '/appointments/appt1',
      },
    });
  });
});

describe('NotificationsService.listForUser', () => {
  it('scopes to organization and user, most recent first, capped at 100', () => {
    const { service, prisma } = makeService();

    service.listForUser('org1', 'user1', false);

    expect(prisma.notification.findMany).toHaveBeenCalledWith({
      where: { organizationId: 'org1', userId: 'user1' },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  });

  it('adds the isRead: false filter when unreadOnly is true', () => {
    const { service, prisma } = makeService();

    service.listForUser('org1', 'user1', true);

    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org1', userId: 'user1', isRead: false },
      }),
    );
  });
});

describe('NotificationsService.unreadCount', () => {
  it('wraps the scoped unread count in { count }', async () => {
    const { service, prisma } = makeService({
      prisma: { notification: { count: vi.fn().mockResolvedValue(7) } },
    });

    const result = await service.unreadCount('org1', 'user1');

    expect(prisma.notification.count).toHaveBeenCalledWith({
      where: { organizationId: 'org1', userId: 'user1', isRead: false },
    });
    expect(result).toEqual({ count: 7 });
  });
});

describe('NotificationsService.markRead', () => {
  it('marks the scoped notification read and returns success', async () => {
    const { service, prisma } = makeService({
      prisma: { notification: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) } },
    });

    const result = await service.markRead('org1', 'user1', 'n1');

    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { id: 'n1', organizationId: 'org1', userId: 'user1' },
      data: { isRead: true, readAt: expect.any(Date) },
    });
    expect(result).toEqual({ success: true });
  });

  it('is idempotent/safe (still returns success) for an id that does not match this org/user', async () => {
    const { service, prisma } = makeService({
      prisma: { notification: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) } },
    });

    const result = await service.markRead('org1', 'user1', 'someone-elses-notification');

    expect(result).toEqual({ success: true });
  });
});

describe('NotificationsService.markAllRead', () => {
  it('marks all unread notifications for the user/org read and reports how many', async () => {
    const { service, prisma } = makeService({
      prisma: { notification: { updateMany: vi.fn().mockResolvedValue({ count: 4 }) } },
    });

    const result = await service.markAllRead('org1', 'user1');

    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { organizationId: 'org1', userId: 'user1', isRead: false },
      data: { isRead: true, readAt: expect.any(Date) },
    });
    expect(result).toEqual({ updated: 4 });
  });
});
