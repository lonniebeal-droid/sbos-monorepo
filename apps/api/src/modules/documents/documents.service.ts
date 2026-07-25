import { Inject, Injectable, NotFoundException } from '@nestjs/common';

import { AuditAction } from '@sbos/database';

import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import {
  STORAGE_PROVIDER,
  type StorageProvider,
} from '../../storage/storage.interface';
import { CreateDocumentDto } from './dto/create-document.dto';

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  /**
   * Register a document and return a presigned upload target. The client uploads
   * bytes directly to storage, then the record is available for download.
   */
  async create(
    organizationId: string,
    uploadedById: string,
    dto: CreateDocumentDto,
  ) {
    const upload = await this.storage.createUpload({
      organizationId,
      fileName: dto.name,
    });

    const document = await this.prisma.document.create({
      data: {
        organizationId,
        uploadedById,
        clientId: dto.clientId,
        type: dto.type,
        name: dto.name,
        mimeType: dto.mimeType,
        storageKey: upload.storageKey,
      },
    });

    await this.audit.record({
      organizationId,
      actorId: uploadedById,
      action: AuditAction.CREATE,
      entityType: 'Document',
      entityId: document.id,
    });

    return { document, upload };
  }

  findForClient(organizationId: string, clientId: string) {
    return this.prisma.document.findMany({
      where: { organizationId, clientId },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async ensure(organizationId: string, id: string) {
    const document = await this.prisma.document.findFirst({
      where: { id, organizationId },
    });
    if (!document) {
      throw new NotFoundException(`Document ${id} not found`);
    }
    return document;
  }

  async getWithDownloadUrl(organizationId: string, id: string) {
    const document = await this.ensure(organizationId, id);
    const downloadUrl = await this.storage.getDownloadUrl(document.storageKey);
    return { ...document, downloadUrl };
  }

  async sign(organizationId: string, id: string, userId: string) {
    await this.ensure(organizationId, id);
    const signed = await this.prisma.document.update({
      where: { id },
      data: { isSigned: true, signedAt: new Date() },
    });
    await this.audit.record({
      organizationId,
      actorId: userId,
      action: AuditAction.SIGN,
      entityType: 'Document',
      entityId: id,
    });
    return signed;
  }

  async remove(organizationId: string, id: string, userId: string) {
    const document = await this.ensure(organizationId, id);
    await this.storage.remove(document.storageKey);
    await this.prisma.document.delete({ where: { id } });
    await this.audit.record({
      organizationId,
      actorId: userId,
      action: AuditAction.DELETE,
      entityType: 'Document',
      entityId: id,
    });
    return { success: true };
  }
}
