import { NotFoundException } from '@nestjs/common';
import { AuditAction } from '@sbos/database';
import { describe, expect, it, vi } from 'vitest';

import { KnowledgeService } from './knowledge.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { AuditService } from '../../audit/audit.service';

function makeService(overrides?: { prisma?: Partial<PrismaService> }) {
  const prisma = (overrides?.prisma ?? {}) as PrismaService;
  const audit = { record: vi.fn() } as unknown as AuditService;
  return { service: new KnowledgeService(prisma, audit), audit };
}

describe('KnowledgeService.remove', () => {
  it('deletes the article and records an audit entry', async () => {
    const existing = { id: 'k1', title: 'Intake checklist', isPublished: true };
    const prisma = {
      knowledgeArticle: {
        findFirst: vi.fn().mockResolvedValue(existing),
        delete: vi.fn().mockResolvedValue(existing),
      },
    } as unknown as PrismaService;
    const { service, audit } = makeService({ prisma });

    const result = await service.remove('org1', 'actor1', 'k1');

    expect(prisma.knowledgeArticle.delete).toHaveBeenCalledWith({ where: { id: 'k1' } });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org1',
        actorId: 'actor1',
        action: AuditAction.DELETE,
        entityType: 'KnowledgeArticle',
        entityId: 'k1',
        metadata: expect.objectContaining({
          title: 'Intake checklist',
          wasPublished: true,
        }),
      }),
    );
    expect(result).toEqual({ success: true });
  });

  it('throws NotFoundException and never deletes/audits a missing article', async () => {
    const prisma = {
      knowledgeArticle: {
        findFirst: vi.fn().mockResolvedValue(null),
        delete: vi.fn(),
      },
    } as unknown as PrismaService;
    const { service, audit } = makeService({ prisma });

    await expect(service.remove('org1', 'actor1', 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.knowledgeArticle.delete).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });
});
