import { Injectable, NotFoundException } from '@nestjs/common';
import { AssistantKind } from '@sbos/database';

import { PrismaService } from '../../prisma/prisma.service';
import { DEFAULT_SYSTEM_PROMPTS } from '../../ai/chat/assistant-prompts';
import type { AssistantKindName } from '../../ai/chat/chat-provider.interface';
import {
  CreatePromptTemplateDto,
  UpdatePromptTemplateDto,
} from './dto/jessie.dto';

@Injectable()
export class PromptsService {
  constructor(private readonly prisma: PrismaService) {}

  create(organizationId: string, dto: CreatePromptTemplateDto) {
    return this.prisma.promptTemplate.create({
      data: {
        organizationId,
        kind: dto.kind as AssistantKind,
        name: dto.name,
        systemPrompt: dto.systemPrompt,
        isActive: dto.isActive ?? true,
      },
    });
  }

  list(organizationId: string) {
    return this.prisma.promptTemplate.findMany({
      where: { organizationId },
      orderBy: [{ kind: 'asc' }, { name: 'asc' }],
    });
  }

  async update(organizationId: string, id: string, dto: UpdatePromptTemplateDto) {
    const existing = await this.prisma.promptTemplate.findFirst({
      where: { id, organizationId },
    });
    if (!existing) throw new NotFoundException(`Prompt ${id} not found`);
    return this.prisma.promptTemplate.update({
      where: { id },
      data: {
        kind: dto.kind as AssistantKind | undefined,
        name: dto.name,
        systemPrompt: dto.systemPrompt,
        isActive: dto.isActive,
        version: dto.systemPrompt ? existing.version + 1 : existing.version,
      },
    });
  }

  /**
   * Resolve the active system prompt for an assistant kind: the org's active
   * template if present, otherwise the built-in default.
   */
  async resolveSystemPrompt(
    organizationId: string,
    kind: AssistantKindName,
  ): Promise<string> {
    const template = await this.prisma.promptTemplate.findFirst({
      where: { organizationId, kind: kind as AssistantKind, isActive: true },
      orderBy: { updatedAt: 'desc' },
    });
    return template?.systemPrompt ?? DEFAULT_SYSTEM_PROMPTS[kind];
  }
}
