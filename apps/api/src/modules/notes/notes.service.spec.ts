import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AuditAction, NoteStatus } from '@sbos/database';
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
  const defaultPrisma = {
    client: { findFirst: vi.fn().mockResolvedValue({ id: 'c1' }) },
    clinician: { findFirst: vi.fn().mockResolvedValue({ id: 'cl1' }) },
    appointment: { findFirst: vi.fn().mockResolvedValue({ id: 'a1' }) },
  };
  const prisma = {
    ...defaultPrisma,
    ...(overrides?.prisma ?? {}),
  } as unknown as PrismaService;
  if (overrides?.prisma) {
    Object.assign(prisma, overrides.prisma);
  }
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
  return {
    service: new NotesService(prisma, audit, assistant),
    assistant,
    audit,
  };
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

  it('passes presentingProblem to the assistant when provided', async () => {
    const { service, assistant } = makeService();

    await service.generateDraft('org1', {
      type: 'SOAP' as never,
      prompt: 'Session summary',
      presentingProblem: 'Difficulty sleeping',
    });

    expect(assistant.generateNoteDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'SOAP',
        prompt: 'Session summary',
        presentingProblem: 'Difficulty sleeping',
      }),
    );
  });

  it('deletes a DRAFT note and records a DELETE audit entry', async () => {
    const existing = { id: 'n1', status: NoteStatus.DRAFT };
    const prisma = {
      note: {
        findFirst: vi.fn().mockResolvedValue(existing),
        delete: vi.fn().mockResolvedValue(existing),
      },
    } as unknown as PrismaService;
    const audit = { record: vi.fn() } as unknown as AuditService;
    const assistant = {
      generateNoteDraft: vi.fn(),
    } as unknown as NoteAssistant;
    const service = new NotesService(prisma, audit, assistant);

    const result = await service.remove('org1', 'n1', 'actor1');

    expect(prisma.note.delete).toHaveBeenCalledWith({ where: { id: 'n1' } });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org1',
        actorId: 'actor1',
        action: AuditAction.DELETE,
        entityType: 'Note',
        entityId: 'n1',
      }),
    );
    expect(result).toEqual({ success: true });
  });

  it('throws ForbiddenException, never deletes, and records a DENY audit entry for a non-DRAFT note', async () => {
    const existing = { id: 'n2', status: NoteStatus.SIGNED };
    const prisma = {
      note: {
        findFirst: vi.fn().mockResolvedValue(existing),
        delete: vi.fn(),
      },
    } as unknown as PrismaService;
    const audit = { record: vi.fn() } as unknown as AuditService;
    const assistant = {
      generateNoteDraft: vi.fn(),
    } as unknown as NoteAssistant;
    const service = new NotesService(prisma, audit, assistant);

    await expect(service.remove('org1', 'n2', 'actor1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.note.delete).not.toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledTimes(1);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org1',
        actorId: 'actor1',
        action: AuditAction.DENY,
        entityType: 'Note',
        entityId: 'n2',
        metadata: expect.objectContaining({
          attemptedAction: 'DELETE',
          reason: 'not DRAFT',
          status: NoteStatus.SIGNED,
        }),
      }),
    );
  });
});

describe('NotesService.create — tenant ownership of clientId/clinicianId', () => {
  const baseDto = {
    clientId: 'c1',
    clinicianId: 'cl1',
    type: NoteTypeDto.PROGRESS,
    content: 'Session summary',
  };

  it('rejects create when clientId is not in the actor organization', async () => {
    const prisma = {
      client: { findFirst: vi.fn().mockResolvedValue(null) },
      note: { create: vi.fn() },
    } as unknown as PrismaService;
    const { service } = makeService({ prisma });

    await expect(service.create('org1', 'author1', baseDto as never)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.note.create).not.toHaveBeenCalled();
    expect(prisma.client.findFirst).toHaveBeenCalledWith({
      where: { id: 'c1', organizationId: 'org1', deletedAt: null },
      select: { id: true },
    });
  });

  it('rejects create when clinicianId is not in the actor organization', async () => {
    const prisma = {
      client: { findFirst: vi.fn().mockResolvedValue({ id: 'c1' }) },
      clinician: { findFirst: vi.fn().mockResolvedValue(null) },
      note: { create: vi.fn() },
    } as unknown as PrismaService;
    const { service } = makeService({ prisma });

    await expect(service.create('org1', 'author1', baseDto as never)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.note.create).not.toHaveBeenCalled();
  });

  it('rejects create when appointmentId is not in the actor organization', async () => {
    const prisma = {
      client: { findFirst: vi.fn().mockResolvedValue({ id: 'c1' }) },
      clinician: { findFirst: vi.fn().mockResolvedValue({ id: 'cl1' }) },
      appointment: { findFirst: vi.fn().mockResolvedValue(null) },
      note: { create: vi.fn() },
    } as unknown as PrismaService;
    const { service } = makeService({ prisma });

    await expect(
      service.create('org1', 'author1', {
        ...baseDto,
        appointmentId: 'appt-other',
      } as never),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.note.create).not.toHaveBeenCalled();
  });

  it('creates when client, clinician, and appointment belong to the organization', async () => {
    const created = { id: 'n1', type: 'PROGRESS' };
    const prisma = {
      client: { findFirst: vi.fn().mockResolvedValue({ id: 'c1' }) },
      clinician: { findFirst: vi.fn().mockResolvedValue({ id: 'cl1' }) },
      appointment: { findFirst: vi.fn().mockResolvedValue({ id: 'a1' }) },
      note: { create: vi.fn().mockResolvedValue(created) },
    } as unknown as PrismaService;
    const { service, audit } = makeService({ prisma });

    const result = await service.create('org1', 'author1', {
      ...baseDto,
      appointmentId: 'a1',
    } as never);
    expect(prisma.note.create).toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalled();
    expect(result).toBe(created);
  });
});
