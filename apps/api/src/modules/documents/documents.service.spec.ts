import { NotFoundException } from '@nestjs/common';
import { AuditAction } from '@sbos/database';
import { describe, expect, it, vi } from 'vitest';

import { DocumentsService } from './documents.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { AuditService } from '../../audit/audit.service';
import type { StorageProvider } from '../../storage/storage.interface';

function makeService(overrides?: { prisma?: Partial<PrismaService> }) {
  const prisma = (overrides?.prisma ?? {}) as PrismaService;
  const audit = { record: vi.fn() } as unknown as AuditService;
  const storage = {
    createUpload: vi.fn(),
    getDownloadUrl: vi.fn(),
    remove: vi.fn(),
  } as unknown as StorageProvider;
  return { service: new DocumentsService(prisma, audit, storage), audit, storage };
}

describe('DocumentsService.remove (soft-delete)', () => {
  it('soft-deletes via update(deletedAt), never calls storage.remove(), and audits it', async () => {
    const existing = { id: 'd1', storageKey: 'orgs/org1/abc/file.pdf' };
    const prisma = {
      document: {
        findFirst: vi.fn().mockResolvedValue(existing),
        update: vi.fn().mockResolvedValue({ ...existing, deletedAt: new Date() }),
        delete: vi.fn(),
      },
    } as unknown as PrismaService;
    const { service, audit, storage } = makeService({ prisma });

    const result = await service.remove('org1', 'd1', 'actor1');

    expect(prisma.document.update).toHaveBeenCalledWith({
      where: { id: 'd1' },
      data: { deletedAt: expect.any(Date) },
    });
    expect(prisma.document.delete).not.toHaveBeenCalled();
    expect(storage.remove).not.toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org1',
        actorId: 'actor1',
        action: AuditAction.DELETE,
        entityType: 'Document',
        entityId: 'd1',
        metadata: expect.objectContaining({ softDelete: true }),
      }),
    );
    expect(result).toEqual({ success: true });
  });

  it('throws NotFoundException and never updates/audits when the document is already deleted or missing', async () => {
    const prisma = {
      document: { findFirst: vi.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;
    const { service, audit, storage } = makeService({ prisma });

    await expect(service.remove('org1', 'missing', 'actor1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(audit.record).not.toHaveBeenCalled();
    expect(storage.remove).not.toHaveBeenCalled();
  });
});

describe('DocumentsService.findForClient (soft-delete filtering)', () => {
  it('excludes soft-deleted documents by default', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const prisma = { document: { findMany } } as unknown as PrismaService;
    const { service } = makeService({ prisma });

    await service.findForClient('org1', 'c1');

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org1', clientId: 'c1', deletedAt: null },
      }),
    );
  });
});

describe('DocumentsService.create', () => {
  it('rejects an associated client from another organization before creating an upload', async () => {
    const prisma = {
      client: { findFirst: vi.fn().mockResolvedValue(null) },
      document: { create: vi.fn() },
    } as unknown as PrismaService;
    const { service, storage } = makeService({ prisma });

    await expect(
      service.create('org1', 'user1', { name: 'intake.pdf', clientId: 'other-org-client' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(storage.createUpload).not.toHaveBeenCalled();
    expect(prisma.document.create).not.toHaveBeenCalled();
  });
});
