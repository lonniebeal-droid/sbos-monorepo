import { Injectable, Logger } from '@nestjs/common';
import { AuditAction, type Prisma } from '@sbos/database';

import { PrismaService } from '../prisma/prisma.service';

export interface AuditEntry {
  organizationId: string;
  actorId?: string;
  action: AuditAction;
  entityType: string;
  entityId?: string;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Writes immutable audit-trail entries. Failures are logged but never block the
 * originating operation — auditing must not take down a clinical action.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          organizationId: entry.organizationId,
          actorId: entry.actorId ?? null,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId ?? null,
          metadata: entry.metadata,
          ipAddress: entry.ipAddress ?? null,
          userAgent: entry.userAgent ?? null,
        },
      });
    } catch (error) {
      this.logger.warn(
        `Failed to write audit entry for ${entry.entityType}:${entry.entityId ?? '-'} (${entry.action})`,
        error instanceof Error ? error.message : undefined,
      );
    }
  }
}
