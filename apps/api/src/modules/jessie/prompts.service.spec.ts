import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { PromptsService } from './prompts.service';
import { AssistantKindDto } from './dto/jessie.dto';
import { DEFAULT_SYSTEM_PROMPTS } from '../../ai/chat/assistant-prompts';
import type { PrismaService } from '../../prisma/prisma.service';

function makeService(overrides?: {
  promptTemplate?: Record<string, ReturnType<typeof vi.fn>>;
}) {
  const prisma = {
    promptTemplate: {
      create: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
      ...overrides?.promptTemplate,
    },
  } as unknown as PrismaService;

  return { service: new PromptsService(prisma), prisma };
}

describe('PromptsService', () => {
  describe('create', () => {
    it('defaults isActive to true when not given', async () => {
      const { service, prisma } = makeService();

      await service.create('org1', {
        kind: AssistantKindDto.RECEPTIONIST,
        name: 'Default receptionist',
        systemPrompt: 'Be warm and professional.',
      });

      expect(prisma.promptTemplate.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ isActive: true }),
      });
    });

    it('preserves an explicit isActive: false', async () => {
      const { service, prisma } = makeService();

      await service.create('org1', {
        kind: AssistantKindDto.RECEPTIONIST,
        name: 'Draft receptionist',
        systemPrompt: 'Draft.',
        isActive: false,
      });

      expect(prisma.promptTemplate.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ isActive: false }),
      });
    });
  });

  describe('list', () => {
    it('lists templates for the org ordered by kind then name', async () => {
      const { service, prisma } = makeService();

      await service.list('org1');

      expect(prisma.promptTemplate.findMany).toHaveBeenCalledWith({
        where: { organizationId: 'org1' },
        orderBy: [{ kind: 'asc' }, { name: 'asc' }],
      });
    });
  });

  describe('update', () => {
    it('throws NotFoundException without updating when the template is missing', async () => {
      const { service, prisma } = makeService({
        promptTemplate: { findFirst: vi.fn().mockResolvedValue(null) },
      });

      await expect(
        service.update('org1', 'missing', { name: 'New name' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.promptTemplate.update).not.toHaveBeenCalled();
    });

    it('bumps the version when a new systemPrompt is given', async () => {
      const { service, prisma } = makeService({
        promptTemplate: {
          findFirst: vi.fn().mockResolvedValue({ id: 'p1', version: 3 }),
        },
      });

      await service.update('org1', 'p1', { systemPrompt: 'Updated prompt text.' });

      expect(prisma.promptTemplate.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: expect.objectContaining({ version: 4 }),
      });
    });

    it('leaves the version unchanged when systemPrompt is not part of the update', async () => {
      const { service, prisma } = makeService({
        promptTemplate: {
          findFirst: vi.fn().mockResolvedValue({ id: 'p1', version: 3 }),
        },
      });

      await service.update('org1', 'p1', { name: 'Renamed only' });

      expect(prisma.promptTemplate.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: expect.objectContaining({ version: 3 }),
      });
    });
  });

  describe('resolveSystemPrompt', () => {
    it("returns the org's active template prompt when one exists", async () => {
      const { service } = makeService({
        promptTemplate: {
          findFirst: vi.fn().mockResolvedValue({ systemPrompt: 'Custom org prompt.' }),
        },
      });

      await expect(service.resolveSystemPrompt('org1', 'RECEPTIONIST')).resolves.toBe(
        'Custom org prompt.',
      );
    });

    it('falls back to the built-in default when no active template exists', async () => {
      const { service } = makeService({
        promptTemplate: { findFirst: vi.fn().mockResolvedValue(null) },
      });

      await expect(service.resolveSystemPrompt('org1', 'RECEPTIONIST')).resolves.toBe(
        DEFAULT_SYSTEM_PROMPTS.RECEPTIONIST,
      );
    });
  });
});
