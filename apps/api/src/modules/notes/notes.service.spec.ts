import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { NotesService } from './notes.service';
import { NoteTypeDto } from './dto/create-note.dto';
import type { PrismaService } from '../../prisma/prisma.service';
import type { AuditService } from '../../audit/audit.service';
import type { NoteAssistant } from '../../ai/note-assistant.interface';

function makeService(overrides?: {
  prisma?: Partial<PrismaService>;
  assistant?: NoteAssistant;
}) {
  const prisma = (overrides?.prisma ?? {}) as PrismaService;
  const audit = { record: vi.fn() } as unknown as AuditService;
  const assistant =
    overrides?.assistant ??
    ({
      generateNoteDraft: vi.fn().mockResolvedValue({
        sections: { data: 'x' },
        narrative: 'x',
        provider: 'test',
      }),
    } as unknown as NoteAssistant);
  return { service: new NotesService(prisma, audit, assistant), assistant };
}

describe('NotesService', () => {
  it('rejects a BIRP note missing required sections', async () => {
    const { service } = makeService();
    await expect(
      service.create('org1', 'author1', {
        clientId: 'c1',
        clinicianId: 'cl1',
        type: NoteTypeDto.BIRP,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a SOAP note with an empty required section', async () => {
    const { service } = makeService();
    await expect(
      service.create('org1', 'author1', {
        clientId: 'c1',
        clinicianId: 'cl1',
        type: NoteTypeDto.SOAP,
        sections: { subjective: 's', objective: '', assessment: 'a', plan: 'p' },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('generates a draft via the assistant with client context', async () => {
    const prisma = {
      client: {
        findFirst: vi
          .fn()
          .mockResolvedValue({ firstName: 'Jordan', lastName: 'Mitchell' }),
      },
    } as unknown as PrismaService;
    const { service, assistant } = makeService({ prisma });

    await service.generateDraft('org1', {
      type: 'BIRP' as never,
      prompt: 'Discussed anxiety',
      clientId: 'c1',
    });

    expect(assistant.generateNoteDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'BIRP',
        prompt: 'Discussed anxiety',
        clientName: 'Jordan Mitchell',
      }),
    );
  });
});
