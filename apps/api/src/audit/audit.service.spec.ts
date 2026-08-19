import { AuditAction } from '@sbos/database';
import { describe, expect, it, vi } from 'vitest';

import { AuditService } from './audit.service';
import type { PrismaService } from '../prisma/prisma.service';

function makeService(overrides?: {
  auditLog?: Record<string, ReturnType<typeof vi.fn>>;
}) {
  const prisma = {
    auditLog: {
      create: vi.fn().mockResolvedValue({}),
      ...overrides?.auditLog,
    },
  } as unknown as PrismaService;

  return { service: new AuditService(prisma), prisma };
}

describe('AuditService', () => {
  describe('record', () => {
    it('defaults optional fields to null when not provided', async () => {
      const { service, prisma } = makeService();

      await service.record({
        organizationId: 'org1',
        action: AuditAction.CREATE,
        entityType: 'Client',
      });

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          organizationId: 'org1',
          actorId: null,
          action: AuditAction.CREATE,
          entityType: 'Client',
          entityId: null,
          metadata: undefined,
          ipAddress: null,
          userAgent: null,
        },
      });
    });

    it('passes through all provided fields', async () => {
      const { service, prisma } = makeService();

      await service.record({
        organizationId: 'org1',
        actorId: 'actor1',
        action: AuditAction.DELETE,
        entityType: 'Client',
        entityId: 'c1',
        metadata: { reason: 'test' },
        ipAddress: '127.0.0.1',
        userAgent: 'vitest',
      });

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          organizationId: 'org1',
          actorId: 'actor1',
          action: AuditAction.DELETE,
          entityType: 'Client',
          entityId: 'c1',
          metadata: { reason: 'test' },
          ipAddress: '127.0.0.1',
          userAgent: 'vitest',
        },
      });
    });

    it('swallows a write failure instead of throwing, so the caller is never blocked', async () => {
      const { service } = makeService({
        auditLog: { create: vi.fn().mockRejectedValue(new Error('db down')) },
      });

      await expect(
        service.record({
          organizationId: 'org1',
          action: AuditAction.CREATE,
          entityType: 'Client',
          entityId: 'c1',
        }),
      ).resolves.toBeUndefined();
    });

    it('logs a warning with the error message on a thrown Error', async () => {
      const { service } = makeService({
        auditLog: { create: vi.fn().mockRejectedValue(new Error('db down')) },
      });
      const warnSpy = vi
        .spyOn((service as unknown as { logger: { warn: typeof console.warn } }).logger, 'warn')
        .mockImplementation(() => undefined);

      await service.record({
        organizationId: 'org1',
        action: AuditAction.CREATE,
        entityType: 'Client',
        entityId: 'c1',
      });

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Client:c1'),
        'db down',
      );
    });

    it('logs a warning without a message for a non-Error rejection', async () => {
      const { service } = makeService({
        auditLog: { create: vi.fn().mockRejectedValue('not an Error instance') },
      });
      const warnSpy = vi
        .spyOn((service as unknown as { logger: { warn: typeof console.warn } }).logger, 'warn')
        .mockImplementation(() => undefined);

      await service.record({
        organizationId: 'org1',
        action: AuditAction.CREATE,
        entityType: 'Client',
      });

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Client:-'),
        undefined,
      );
    });
  });
});
