import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, type Prisma } from '@sbos/database';

import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import {
  CreateKnowledgeArticleDto,
  UpdateKnowledgeArticleDto,
} from './dto/jessie.dto';

@Injectable()
export class KnowledgeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  create(organizationId: string, dto: CreateKnowledgeArticleDto) {
    return this.prisma.knowledgeArticle.create({
      data: { ...dto, organizationId },
    });
  }

  list(organizationId: string, search?: string) {
    const where: Prisma.KnowledgeArticleWhereInput = {
      organizationId,
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { body: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    return this.prisma.knowledgeArticle.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
    });
  }

  async update(
    organizationId: string,
    id: string,
    dto: UpdateKnowledgeArticleDto,
  ) {
    const existing = await this.prisma.knowledgeArticle.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException(`Article ${id} not found`);
    return this.prisma.knowledgeArticle.update({ where: { id }, data: dto });
  }

  async remove(organizationId: string, actorId: string, id: string) {
    const existing = await this.prisma.knowledgeArticle.findFirst({
      where: { id, organizationId },
      select: { id: true, title: true, isPublished: true },
    });
    if (!existing) throw new NotFoundException(`Article ${id} not found`);
    await this.prisma.knowledgeArticle.delete({ where: { id } });
    await this.audit.record({
      organizationId,
      actorId,
      action: AuditAction.DELETE,
      entityType: 'KnowledgeArticle',
      entityId: id,
      metadata: { title: existing.title, wasPublished: existing.isPublished },
    });
    return { success: true };
  }

  /** Retrieve published articles as grounding snippets for the assistant. */
  async retrieve(organizationId: string, limit = 20) {
    return this.prisma.knowledgeArticle.findMany({
      where: { organizationId, isPublished: true },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      select: { title: true, body: true },
    });
  }
}
