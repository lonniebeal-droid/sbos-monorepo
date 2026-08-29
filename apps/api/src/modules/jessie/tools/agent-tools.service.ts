import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ClientStatus, type Prisma } from '@sbos/database';

import {
  EMAIL_PROVIDER,
  type EmailProvider,
} from '../../../channels/email.provider';
import {
  SMS_PROVIDER,
  type SmsProvider,
} from '../../../channels/sms.provider';
import { PrismaService } from '../../../prisma/prisma.service';
import { AppointmentsService } from '../../appointments/appointments.service';
import { AvailabilityService } from '../../scheduling/availability.service';
import type {
  AgentToolResult,
  CheckCalendarDto,
  LookupClientDto,
  SaveOrUpdateLeadDto,
  ScheduleAppointmentDto,
  SendEmailDto,
  SendSmsDto,
  TransferToHumanDto,
} from './dto/agent-tools.dto';

const ENTITY_TYPE = 'JessieAgentTool';

/**
 * ElevenLabs (and other voice agents) tool handlers.
 * Organization is always supplied by the auth guard from the secret map —
 * never from the request body.
 */
@Injectable()
export class AgentToolsService {
  private readonly logger = new Logger(AgentToolsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly appointments: AppointmentsService,
    private readonly availability: AvailabilityService,
    @Inject(SMS_PROVIDER) private readonly sms: SmsProvider,
    @Inject(EMAIL_PROVIDER) private readonly email: EmailProvider,
  ) {}

  private async ensureClientInOrg(
    organizationId: string,
    clientId: string,
  ): Promise<{
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    status: string;
  }> {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, organizationId, deletedAt: null },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        status: true,
      },
    });
    if (!client) {
      throw new NotFoundException(`Client ${clientId} not found`);
    }
    return client;
  }

  private async ensureClinicianInOrg(
    organizationId: string,
    clinicianId: string,
  ): Promise<void> {
    const row = await this.prisma.clinician.findFirst({
      where: { id: clinicianId, organizationId },
      select: { id: true },
    });
    if (!row) {
      throw new NotFoundException(`Clinician ${clinicianId} not found`);
    }
  }

  private async ensureLocationInOrg(
    organizationId: string,
    locationId: string,
  ): Promise<void> {
    const row = await this.prisma.location.findFirst({
      where: { id: locationId, organizationId },
      select: { id: true },
    });
    if (!row) {
      throw new NotFoundException(`Location ${locationId} not found`);
    }
  }

  private async ensureUserInOrg(
    organizationId: string,
    userId: string,
  ): Promise<void> {
    const row = await this.prisma.user.findFirst({
      where: { id: userId, organizationId },
      select: { id: true },
    });
    if (!row) {
      throw new NotFoundException(`User ${userId} not found`);
    }
  }

  private async loadIdempotent(
    organizationId: string,
    tool: string,
    key: string | undefined,
  ): Promise<AgentToolResult | null> {
    if (!key) return null;
    const entityId = `${tool}:${key}`;
    const row = await this.prisma.auditLog.findFirst({
      where: { organizationId, entityType: ENTITY_TYPE, entityId },
      orderBy: { createdAt: 'asc' },
    });
    if (!row?.metadata || typeof row.metadata !== 'object') return null;
    const meta = row.metadata as Record<string, unknown>;
    if (meta.result && typeof meta.result === 'object') {
      return {
        ...(meta.result as AgentToolResult),
        idempotentReplay: true,
      };
    }
    return null;
  }

  private async storeIdempotent(
    organizationId: string,
    tool: string,
    key: string | undefined,
    result: AgentToolResult,
  ): Promise<void> {
    if (!key) return;
    const entityId = `${tool}:${key}`;
    try {
      await this.prisma.auditLog.create({
        data: {
          organizationId,
          action: 'CREATE',
          entityType: ENTITY_TYPE,
          entityId,
          metadata: { result } as unknown as Prisma.InputJsonValue,
        },
      });
    } catch (err) {
      this.logger.warn(
        `Idempotency store race for ${entityId}: ${(err as Error).message}`,
      );
    }
  }

  private fail(tool: string, error: string, message: string): AgentToolResult {
    return { ok: false, tool, error, message };
  }

  async lookupClient(
    organizationId: string,
    dto: LookupClientDto,
  ): Promise<AgentToolResult> {
    const tool = 'lookup_client';
    const replay = await this.loadIdempotent(organizationId, tool, dto.idempotencyKey);
    if (replay) return replay;

    if (dto.clientId) {
      try {
        const client = await this.ensureClientInOrg(organizationId, dto.clientId);
        const result: AgentToolResult = {
          ok: true,
          tool,
          data: {
            found: true,
            clients: [
              {
                id: client.id,
                name: `${client.firstName} ${client.lastName}`.trim(),
                email: client.email,
                phone: client.phone,
                status: client.status,
              },
            ],
          },
        };
        await this.storeIdempotent(organizationId, tool, dto.idempotencyKey, result);
        return result;
      } catch {
        return this.fail(tool, 'not_found', 'Client not found in this organization');
      }
    }

    if (!dto.email && !dto.phone && !dto.name) {
      return this.fail(tool, 'invalid_request', 'Provide clientId, email, phone, or name');
    }

    const where: Prisma.ClientWhereInput = {
      organizationId,
      deletedAt: null,
      ...(dto.email
        ? { email: { equals: dto.email.trim().toLowerCase(), mode: 'insensitive' } }
        : {}),
      ...(dto.phone ? { phone: { contains: dto.phone.replace(/\D/g, '') } } : {}),
      ...(dto.name
        ? {
            OR: [
              { firstName: { contains: dto.name, mode: 'insensitive' } },
              { lastName: { contains: dto.name, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const rows = await this.prisma.client.findMany({
      where,
      take: 5,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        status: true,
      },
    });

    const result: AgentToolResult = {
      ok: true,
      tool,
      data: {
        found: rows.length > 0,
        clients: rows.map((c) => ({
          id: c.id,
          name: `${c.firstName} ${c.lastName}`.trim(),
          email: c.email,
          phone: c.phone,
          status: c.status,
        })),
      },
    };
    await this.storeIdempotent(organizationId, tool, dto.idempotencyKey, result);
    return result;
  }

  async saveOrUpdateLead(
    organizationId: string,
    dto: SaveOrUpdateLeadDto,
  ): Promise<AgentToolResult> {
    const tool = 'save_or_update_lead';
    const replay = await this.loadIdempotent(organizationId, tool, dto.idempotencyKey);
    if (replay) return replay;

    if (dto.clientId) {
      try {
        await this.ensureClientInOrg(organizationId, dto.clientId);
      } catch {
        return this.fail(tool, 'not_found', 'Client not found in this organization');
      }
      const updated = await this.prisma.client.update({
        where: { id: dto.clientId },
        data: {
          firstName: dto.firstName,
          lastName: dto.lastName,
          ...(dto.email !== undefined ? { email: dto.email.trim().toLowerCase() } : {}),
          ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
          ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
          ...(dto.dateOfBirth ? { dateOfBirth: new Date(dto.dateOfBirth) } : {}),
        },
      });
      const result: AgentToolResult = {
        ok: true,
        tool,
        data: {
          action: 'updated',
          clientId: updated.id,
          name: `${updated.firstName} ${updated.lastName}`.trim(),
          status: updated.status,
        },
      };
      await this.storeIdempotent(organizationId, tool, dto.idempotencyKey, result);
      return result;
    }

    const mrn = `LEAD-${Date.now().toString(36).toUpperCase()}`;
    const created = await this.prisma.client.create({
      data: {
        organizationId,
        mrn,
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email?.trim().toLowerCase(),
        phone: dto.phone,
        dateOfBirth: dto.dateOfBirth
          ? new Date(dto.dateOfBirth)
          : new Date('1900-01-01T00:00:00.000Z'),
        status: ClientStatus.PROSPECT,
        notes: dto.notes,
      },
    });

    const result: AgentToolResult = {
      ok: true,
      tool,
      data: {
        action: 'created',
        clientId: created.id,
        mrn: created.mrn,
        name: `${created.firstName} ${created.lastName}`.trim(),
        status: created.status,
      },
    };
    await this.storeIdempotent(organizationId, tool, dto.idempotencyKey, result);
    return result;
  }

  async checkCalendar(
    organizationId: string,
    dto: CheckCalendarDto,
  ): Promise<AgentToolResult> {
    const tool = 'check_calendar';
    const replay = await this.loadIdempotent(organizationId, tool, dto.idempotencyKey);
    if (replay) return replay;

    try {
      await this.ensureClinicianInOrg(organizationId, dto.clinicianId);
    } catch {
      return this.fail(tool, 'not_found', 'Clinician not found in this organization');
    }

    const dateOnly = dto.date.slice(0, 10);
    const slots = await this.availability.getSlots(
      organizationId,
      dto.clinicianId,
      dateOnly,
      dto.slotMinutes ?? 50,
    );

    const result: AgentToolResult = {
      ok: true,
      tool,
      data: {
        clinicianId: dto.clinicianId,
        date: dateOnly,
        slotCount: slots.length,
        slots: slots.slice(0, 12).map((s) => ({
          start: s.start.toISOString(),
          end: s.end.toISOString(),
        })),
      },
    };
    await this.storeIdempotent(organizationId, tool, dto.idempotencyKey, result);
    return result;
  }

  async scheduleAppointment(
    organizationId: string,
    dto: ScheduleAppointmentDto,
  ): Promise<AgentToolResult> {
    const tool = 'schedule_appointment';
    const replay = await this.loadIdempotent(organizationId, tool, dto.idempotencyKey);
    if (replay) return replay;

    try {
      await this.ensureClientInOrg(organizationId, dto.clientId);
      await this.ensureClinicianInOrg(organizationId, dto.clinicianId);
      if (dto.locationId) {
        await this.ensureLocationInOrg(organizationId, dto.locationId);
      }
    } catch {
      return this.fail(
        tool,
        'not_found',
        'Client, clinician, or location not found in this organization',
      );
    }

    try {
      const appt = await this.appointments.create(organizationId, 'jessie-agent', {
        clientId: dto.clientId,
        clinicianId: dto.clinicianId,
        locationId: dto.locationId,
        startTime: dto.startTime,
        endTime: dto.endTime,
        durationMinutes: dto.durationMinutes,
        type: (dto.type as never) ?? undefined,
      });

      const result: AgentToolResult = {
        ok: true,
        tool,
        data: {
          appointmentId: appt.id,
          clientId: dto.clientId,
          clinicianId: dto.clinicianId,
          startTime: dto.startTime,
          endTime: dto.endTime,
          status: appt.status ?? 'SCHEDULED',
        },
      };
      await this.storeIdempotent(organizationId, tool, dto.idempotencyKey, result);
      return result;
    } catch (err) {
      this.logger.warn(`schedule_appointment failed: ${(err as Error).message}`);
      return this.fail(
        tool,
        'schedule_failed',
        (err as Error).message || 'Unable to schedule appointment',
      );
    }
  }

  async sendSms(
    organizationId: string,
    dto: SendSmsDto,
  ): Promise<AgentToolResult> {
    const tool = 'send_sms';
    const replay = await this.loadIdempotent(organizationId, tool, dto.idempotencyKey);
    if (replay) return replay;

    if (dto.clientId) {
      try {
        await this.ensureClientInOrg(organizationId, dto.clientId);
      } catch {
        return this.fail(tool, 'not_found', 'Client not found in this organization');
      }
    }

    try {
      const sent = await this.sms.send({ to: dto.to, body: dto.body });
      const result: AgentToolResult = {
        ok: true,
        tool,
        data: {
          messageId: sent.id,
          provider: sent.provider,
          to: dto.to,
        },
      };
      await this.storeIdempotent(organizationId, tool, dto.idempotencyKey, result);
      return result;
    } catch (err) {
      this.logger.warn(`send_sms failed: ${(err as Error).message}`);
      return this.fail(
        tool,
        'provider_error',
        (err as Error).message || 'SMS provider failed',
      );
    }
  }

  async sendEmail(
    organizationId: string,
    dto: SendEmailDto,
  ): Promise<AgentToolResult> {
    const tool = 'send_email';
    const replay = await this.loadIdempotent(organizationId, tool, dto.idempotencyKey);
    if (replay) return replay;

    if (dto.clientId) {
      try {
        await this.ensureClientInOrg(organizationId, dto.clientId);
      } catch {
        return this.fail(tool, 'not_found', 'Client not found in this organization');
      }
    }

    try {
      const sent = await this.email.send({
        to: dto.to,
        subject: dto.subject,
        text: dto.body,
      });
      const result: AgentToolResult = {
        ok: true,
        tool,
        data: {
          messageId: sent.id,
          provider: sent.provider,
          to: dto.to,
        },
      };
      await this.storeIdempotent(organizationId, tool, dto.idempotencyKey, result);
      return result;
    } catch (err) {
      this.logger.warn(`send_email failed: ${(err as Error).message}`);
      return this.fail(
        tool,
        'provider_error',
        (err as Error).message || 'Email provider failed',
      );
    }
  }

  async transferToHuman(
    organizationId: string,
    dto: TransferToHumanDto,
  ): Promise<AgentToolResult> {
    const tool = 'transfer_to_human';
    const replay = await this.loadIdempotent(organizationId, tool, dto.idempotencyKey);
    if (replay) return replay;

    if (dto.clientId) {
      try {
        await this.ensureClientInOrg(organizationId, dto.clientId);
      } catch {
        return this.fail(tool, 'not_found', 'Client not found in this organization');
      }
    }
    if (dto.assigneeId) {
      try {
        await this.ensureUserInOrg(organizationId, dto.assigneeId);
      } catch {
        return this.fail(tool, 'not_found', 'Assignee not found in this organization');
      }
    }

    const actor =
      (await this.prisma.user.findFirst({
        where: { organizationId, status: 'ACTIVE' },
        select: { id: true },
        orderBy: { createdAt: 'asc' },
      })) ?? null;

    if (!actor) {
      return this.fail(
        tool,
        'no_staff',
        'No active staff user available to own the escalation task',
      );
    }

    const task = await this.prisma.task.create({
      data: {
        organizationId,
        createdById: actor.id,
        assigneeId: dto.assigneeId ?? null,
        clientId: dto.clientId ?? null,
        title: 'Jessie agent: transfer to human',
        description: [
          dto.reason,
          dto.conversationId ? `Conversation: ${dto.conversationId}` : null,
        ]
          .filter(Boolean)
          .join('\n'),
        status: 'OPEN',
        priority: 'HIGH',
      },
    });

    const result: AgentToolResult = {
      ok: true,
      tool,
      data: {
        taskId: task.id,
        status: task.status,
        priority: task.priority,
        assigneeId: task.assigneeId,
      },
      message: 'Escalation task created for staff follow-up',
    };
    await this.storeIdempotent(organizationId, tool, dto.idempotencyKey, result);
    return result;
  }
}
