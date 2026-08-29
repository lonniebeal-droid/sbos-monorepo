import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  NoteStatus,
  NoteType,
  type Prisma,
} from '@sbos/database';
import { isNoteEditable, noteStatusAfterSign } from '@sbos/core';

import { paginate } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import {
  NOTE_ASSISTANT,
  type NoteAssistant,
} from '../../ai/note-assistant.interface';
import { CreateNoteDto } from './dto/create-note.dto';
import { UpdateNoteDto } from './dto/update-note.dto';
import { NoteQueryDto } from './dto/note-query.dto';
import { GenerateNoteDto } from './dto/generate-note.dto';

/** Required section keys for each structured note format. */
const REQUIRED_SECTIONS: Partial<Record<NoteType, string[]>> = {
  [NoteType.BIRP]: ['behavior', 'intervention', 'response', 'plan'],
  [NoteType.DAP]: ['data', 'assessment', 'plan'],
  [NoteType.SOAP]: ['subjective', 'objective', 'assessment', 'plan'],
};

@Injectable()
export class NotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(NOTE_ASSISTANT) private readonly assistant: NoteAssistant,
  ) {}

  private validateSections(type: NoteType, sections?: Record<string, string>) {
    const required = REQUIRED_SECTIONS[type];
    if (!required) return;
    if (!sections) {
      throw new BadRequestException(
        `${type} notes require sections: ${required.join(', ')}`,
      );
    }
    const missing = required.filter((key) => !sections[key]?.trim());
    if (missing.length > 0) {
      throw new BadRequestException(
        `Missing required ${type} sections: ${missing.join(', ')}`,
      );
    }
  }

  private renderNarrative(
    type: NoteType,
    sections?: Record<string, string>,
    content?: string,
  ): string | undefined {
    if (content) return content;
    if (!sections) return undefined;
    const order = REQUIRED_SECTIONS[type] ?? Object.keys(sections);
    return order
      .filter((key) => sections[key])
      .map((key) => `${this.titleCase(key)}: ${sections[key]}`)
      .join('\n\n');
  }

  private titleCase(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  private detailCreate(
    type: NoteType,
    sections?: Record<string, string>,
  ): Pick<Prisma.NoteCreateInput, 'birp' | 'dap' | 'soap'> {
    if (!sections) return {};
    switch (type) {
      case NoteType.BIRP:
        return {
          birp: {
            create: {
              behavior: sections.behavior,
              intervention: sections.intervention,
              response: sections.response,
              plan: sections.plan,
            },
          },
        };
      case NoteType.DAP:
        return {
          dap: {
            create: {
              data: sections.data,
              assessment: sections.assessment,
              plan: sections.plan,
            },
          },
        };
      case NoteType.SOAP:
        return {
          soap: {
            create: {
              subjective: sections.subjective,
              objective: sections.objective,
              assessment: sections.assessment,
              plan: sections.plan,
            },
          },
        };
      default:
        return {};
    }
  }

  /**
   * Client-supplied ownership IDs must belong to this organization.
   * Prevents cross-tenant note attachment via clientId/clinicianId/appointmentId.
   */
  private async ensureClientInOrg(
    organizationId: string,
    clientId: string,
  ): Promise<void> {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!client) {
      throw new NotFoundException(`Client ${clientId} not found`);
    }
  }

  private async ensureClinicianInOrg(
    organizationId: string,
    clinicianId: string,
  ): Promise<void> {
    const clinician = await this.prisma.clinician.findFirst({
      where: { id: clinicianId, organizationId },
      select: { id: true },
    });
    if (!clinician) {
      throw new NotFoundException(`Clinician ${clinicianId} not found`);
    }
  }

  private async ensureAppointmentInOrg(
    organizationId: string,
    appointmentId: string,
  ): Promise<void> {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id: appointmentId, organizationId },
      select: { id: true },
    });
    if (!appointment) {
      throw new NotFoundException(`Appointment ${appointmentId} not found`);
    }
  }

  async create(organizationId: string, authorId: string, dto: CreateNoteDto) {
    await this.ensureClientInOrg(organizationId, dto.clientId);
    await this.ensureClinicianInOrg(organizationId, dto.clinicianId);
    if (dto.appointmentId) {
      await this.ensureAppointmentInOrg(organizationId, dto.appointmentId);
    }

    const type = dto.type as unknown as NoteType;
    this.validateSections(type, dto.sections);

    const narrative = this.renderNarrative(type, dto.sections, dto.content);

    const note = await this.prisma.note.create({
      data: {
        organizationId,
        clientId: dto.clientId,
        clinicianId: dto.clinicianId,
        authorId,
        appointmentId: dto.appointmentId,
        type,
        status: NoteStatus.DRAFT,
        title: dto.title,
        content: narrative,
        requiresCosign: dto.requiresCosign ?? false,
        cosignerId: dto.cosignerId,
        ...this.detailCreate(type, dto.sections),
        versions: {
          create: {
            version: 1,
            status: NoteStatus.DRAFT,
            title: dto.title,
            content: narrative,
            structured: dto.sections as Prisma.InputJsonValue | undefined,
            editedById: authorId,
          },
        },
      },
      include: { birp: true, dap: true, soap: true },
    });

    await this.audit.record({
      organizationId,
      actorId: authorId,
      action: AuditAction.CREATE,
      entityType: 'Note',
      entityId: note.id,
      metadata: { type: note.type },
    });

    return note;
  }

  async findAll(organizationId: string, query: NoteQueryDto) {
    const where: Prisma.NoteWhereInput = {
      organizationId,
      ...(query.clientId ? { clientId: query.clientId } : {}),
      ...(query.clinicianId ? { clinicianId: query.clinicianId } : {}),
      ...(query.type ? { type: query.type as unknown as NoteType } : {}),
      ...(query.status ? { status: query.status as unknown as NoteStatus } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { content: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, data] = await Promise.all([
      this.prisma.note.count({ where }),
      this.prisma.note.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: {
          client: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
    ]);

    return paginate(data, total, query.page, query.limit);
  }

  async findOne(organizationId: string, id: string) {
    const note = await this.prisma.note.findFirst({
      where: { id, organizationId },
      include: {
        birp: true,
        dap: true,
        soap: true,
        client: { select: { id: true, firstName: true, lastName: true, mrn: true } },
      },
    });
    if (!note) {
      throw new NotFoundException(`Note ${id} not found`);
    }
    return note;
  }

  async listVersions(organizationId: string, id: string) {
    await this.findOne(organizationId, id);
    return this.prisma.noteVersion.findMany({
      where: { noteId: id },
      orderBy: { version: 'desc' },
    });
  }

  private async nextVersion(noteId: string): Promise<number> {
    const latest = await this.prisma.noteVersion.findFirst({
      where: { noteId },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    return (latest?.version ?? 0) + 1;
  }

  async update(
    organizationId: string,
    id: string,
    editorId: string,
    dto: UpdateNoteDto,
  ) {
    const note = await this.findOne(organizationId, id);
    if (!isNoteEditable(note.status)) {
      throw new ForbiddenException(
        `A ${note.status} note cannot be edited. Create an amendment instead.`,
      );
    }

    if (dto.sections) {
      this.validateSections(note.type, dto.sections);
    }
    const narrative = this.renderNarrative(
      note.type,
      dto.sections,
      dto.content,
    );

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.sections) {
        await this.upsertDetail(tx, note.type, id, dto.sections);
      }
      const result = await tx.note.update({
        where: { id },
        data: {
          title: dto.title ?? note.title,
          content: narrative ?? note.content,
          appointmentId: dto.appointmentId ?? note.appointmentId,
          requiresCosign: dto.requiresCosign ?? note.requiresCosign,
          cosignerId: dto.cosignerId ?? note.cosignerId,
        },
      });
      await tx.noteVersion.create({
        data: {
          noteId: id,
          version: await this.nextVersion(id),
          status: result.status,
          title: result.title,
          content: result.content,
          structured: dto.sections as Prisma.InputJsonValue | undefined,
          editedById: editorId,
        },
      });
      return result;
    });

    await this.audit.record({
      organizationId,
      actorId: editorId,
      action: AuditAction.UPDATE,
      entityType: 'Note',
      entityId: id,
    });

    return updated;
  }

  private async upsertDetail(
    tx: Prisma.TransactionClient,
    type: NoteType,
    noteId: string,
    sections: Record<string, string>,
  ) {
    switch (type) {
      case NoteType.BIRP:
        await tx.birpNote.upsert({
          where: { noteId },
          create: {
            noteId,
            behavior: sections.behavior,
            intervention: sections.intervention,
            response: sections.response,
            plan: sections.plan,
          },
          update: {
            behavior: sections.behavior,
            intervention: sections.intervention,
            response: sections.response,
            plan: sections.plan,
          },
        });
        break;
      case NoteType.DAP:
        await tx.dapNote.upsert({
          where: { noteId },
          create: {
            noteId,
            data: sections.data,
            assessment: sections.assessment,
            plan: sections.plan,
          },
          update: {
            data: sections.data,
            assessment: sections.assessment,
            plan: sections.plan,
          },
        });
        break;
      case NoteType.SOAP:
        await tx.soapNote.upsert({
          where: { noteId },
          create: {
            noteId,
            subjective: sections.subjective,
            objective: sections.objective,
            assessment: sections.assessment,
            plan: sections.plan,
          },
          update: {
            subjective: sections.subjective,
            objective: sections.objective,
            assessment: sections.assessment,
            plan: sections.plan,
          },
        });
        break;
      default:
        break;
    }
  }

  async sign(organizationId: string, id: string, userId: string) {
    const note = await this.findOne(organizationId, id);
    if (note.status !== NoteStatus.DRAFT) {
      throw new BadRequestException('Only draft notes can be signed');
    }
    if (note.authorId !== userId) {
      throw new ForbiddenException('Only the note author can sign this note');
    }

    const nextStatus = noteStatusAfterSign(note.requiresCosign) as NoteStatus;

    const signed = await this.prisma.note.update({
      where: { id },
      data: { status: nextStatus, signedAt: new Date() },
    });

    await this.audit.record({
      organizationId,
      actorId: userId,
      action: AuditAction.SIGN,
      entityType: 'Note',
      entityId: id,
      metadata: { status: nextStatus },
    });

    return signed;
  }

  async cosign(organizationId: string, id: string, userId: string) {
    const note = await this.findOne(organizationId, id);
    if (note.status !== NoteStatus.PENDING_COSIGN) {
      throw new BadRequestException('Note is not awaiting co-signature');
    }
    if (note.cosignerId && note.cosignerId !== userId) {
      throw new ForbiddenException(
        'Only the assigned co-signer can co-sign this note',
      );
    }

    const cosigned = await this.prisma.note.update({
      where: { id },
      data: {
        status: NoteStatus.SIGNED,
        cosignerId: userId,
        cosignedAt: new Date(),
      },
    });

    await this.audit.record({
      organizationId,
      actorId: userId,
      action: AuditAction.SIGN,
      entityType: 'Note',
      entityId: id,
      metadata: { cosign: true },
    });

    return cosigned;
  }

  async amend(
    organizationId: string,
    id: string,
    userId: string,
    dto: UpdateNoteDto,
  ) {
    const note = await this.findOne(organizationId, id);
    if (note.status !== NoteStatus.SIGNED) {
      throw new BadRequestException('Only signed notes can be amended');
    }
    if (dto.sections) {
      this.validateSections(note.type, dto.sections);
    }
    const narrative = this.renderNarrative(note.type, dto.sections, dto.content);

    const amended = await this.prisma.$transaction(async (tx) => {
      if (dto.sections) {
        await this.upsertDetail(tx, note.type, id, dto.sections);
      }
      const result = await tx.note.update({
        where: { id },
        data: {
          status: NoteStatus.AMENDED,
          title: dto.title ?? note.title,
          content: narrative ?? note.content,
        },
      });
      await tx.noteVersion.create({
        data: {
          noteId: id,
          version: await this.nextVersion(id),
          status: NoteStatus.AMENDED,
          title: result.title,
          content: result.content,
          structured: dto.sections as Prisma.InputJsonValue | undefined,
          editedById: userId,
        },
      });
      return result;
    });

    await this.audit.record({
      organizationId,
      actorId: userId,
      action: AuditAction.UPDATE,
      entityType: 'Note',
      entityId: id,
      metadata: { amendment: true },
    });

    return amended;
  }

  async remove(organizationId: string, id: string, userId: string) {
    const note = await this.findOne(organizationId, id);
    if (note.status !== NoteStatus.DRAFT) {
      await this.audit.record({
        organizationId,
        actorId: userId,
        action: AuditAction.DENY,
        entityType: 'Note',
        entityId: id,
        metadata: {
          attemptedAction: 'DELETE',
          reason: 'not DRAFT',
          status: note.status,
        },
      });
      throw new ForbiddenException('Only draft notes can be deleted');
    }
    await this.prisma.note.delete({ where: { id } });
    await this.audit.record({
      organizationId,
      actorId: userId,
      action: AuditAction.DELETE,
      entityType: 'Note',
      entityId: id,
    });
    return { success: true };
  }

  async generateDraft(organizationId: string, dto: GenerateNoteDto) {
    let clientName: string | undefined;
    if (dto.clientId) {
      const client = await this.prisma.client.findFirst({
        where: { id: dto.clientId, organizationId },
        select: { firstName: true, lastName: true },
      });
      if (client) {
        clientName = `${client.firstName} ${client.lastName}`;
      }
    }

    return this.assistant.generateNoteDraft({
      type: dto.type,
      prompt: dto.prompt,
      clientName,
      presentingProblem: dto.presentingProblem,
      interventions: dto.interventions,
    });
  }
}
