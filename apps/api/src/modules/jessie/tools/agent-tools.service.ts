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
  GetBusinessInformationDto,
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

  /**
   * When conversationId or sessionId is supplied, it must belong to this org.
   * Rejects cross-tenant and unknown conversations before any side effect.
   */
  private async ensureConversationInOrg(
    organizationId: string,
    conversationId: string,
  ): Promise<void> {
    const row = await this.prisma.conversation.findFirst({
      where: { id: conversationId, organizationId },
      select: { id: true },
    });
    if (!row) {
      throw new NotFoundException(`Conversation ${conversationId} not found`);
    }
  }

  /** Prefer conversationId; fall back to sessionId alias. */
  private resolveConversationId(dto: {
    conversationId?: string;
    sessionId?: string;
  }): string | undefined {
    const id = dto.conversationId?.trim() || dto.sessionId?.trim();
    return id || undefined;
  }

  /**
   * Validate optional conversation context. Returns a structured failure
   * when invalid so callers can return without side effects.
   */
  private async validateConversationContext(
    organizationId: string,
    tool: string,
    dto: { conversationId?: string; sessionId?: string },
  ): Promise<AgentToolResult | null> {
    const conversationId = this.resolveConversationId(dto);
    if (!conversationId) return null;
    try {
      await this.ensureConversationInOrg(organizationId, conversationId);
      return null;
    } catch {
      return this.fail(
        tool,
        'not_found',
        'Conversation not found in this organization',
      );
    }
  }

  /**
   * Atomic idempotency (claim-before-side-effect).
   *
   * 1. INSERT AuditLog row with status=pending under unique (org, JessieAgentTool, tool:key).
   * 2. On unique conflict: re-read — if completed/failed, replay; if pending, do not execute.
   * 3. Execute business side effect only when this caller owns the claim.
   * 4. UPDATE claim metadata with final result (status=completed|failed).
   *
   * Failed provider results are stored and replayed for the same key. Callers that
   * need a retry after a provider failure must use a new idempotencyKey.
   */
  private async claimIdempotent(
    organizationId: string,
    tool: string,
    key: string | undefined,
    conversationId?: string,
  ): Promise<
    | { kind: 'skip' }
    | { kind: 'replay'; result: AgentToolResult }
    | { kind: 'claimed'; claimId: string }
  > {
    if (!key) return { kind: 'skip' };
    const entityId = `${tool}:${key}`;

    try {
      const row = await this.prisma.auditLog.create({
        data: {
          organizationId,
          action: 'CREATE',
          entityType: ENTITY_TYPE,
          entityId,
          metadata: {
            status: 'pending',
            tool,
            conversationId: conversationId ?? null,
            idempotencyKey: key,
          } as unknown as Prisma.InputJsonValue,
        },
        select: { id: true },
      });
      return { kind: 'claimed', claimId: row.id };
    } catch (err) {
      // Unique violation or race — load existing claim. Do not execute side effect.
      const existing = await this.prisma.auditLog.findFirst({
        where: { organizationId, entityType: ENTITY_TYPE, entityId },
        orderBy: { createdAt: 'asc' },
      });
      if (!existing) {
        this.logger.warn(
          `Idempotency claim conflict for ${entityId} but row not found: ${(err as Error).message}`,
        );
        return {
          kind: 'replay',
          result: this.fail(
            tool,
            'idempotency_conflict',
            'Concurrent request in progress; retry shortly',
          ),
        };
      }
      return this.resolveExistingClaim(tool, existing);
    }
  }

  private resolveExistingClaim(
    tool: string,
    row: { id: string; metadata: unknown },
  ):
    | { kind: 'replay'; result: AgentToolResult }
    | { kind: 'claimed'; claimId: string } {
    const meta =
      row.metadata && typeof row.metadata === 'object'
        ? (row.metadata as Record<string, unknown>)
        : {};
    const status = meta.status as string | undefined;

    if (status === 'completed' || status === 'failed') {
      if (meta.result && typeof meta.result === 'object') {
        return {
          kind: 'replay',
          result: {
            ...(meta.result as AgentToolResult),
            idempotentReplay: true,
          },
        };
      }
      return {
        kind: 'replay',
        result: this.fail(
          tool,
          'idempotency_conflict',
          'Prior execution recorded without a structured result',
        ),
      };
    }

    // status === 'pending' (or unknown): another request owns the claim.
    return {
      kind: 'replay',
      result: this.fail(
        tool,
        'idempotency_in_progress',
        'Another request is executing this idempotency key; retry shortly',
      ),
    };
  }

  private async completeIdempotent(
    claimId: string | undefined,
    organizationId: string,
    tool: string,
    key: string | undefined,
    result: AgentToolResult,
    conversationId?: string,
  ): Promise<void> {
    if (!key || !claimId) return;
    try {
      await this.prisma.auditLog.update({
        where: { id: claimId },
        data: {
          metadata: {
            status: result.ok ? 'completed' : 'failed',
            tool,
            conversationId: conversationId ?? null,
            idempotencyKey: key,
            ok: result.ok,
            error: result.error ?? null,
            result,
          } as unknown as Prisma.InputJsonValue,
        },
      });
    } catch (err) {
      this.logger.error(
        `Failed to persist idempotent result for ${tool}:${key}: ${(err as Error).message}`,
      );
      throw err;
    }
  }

  private fail(tool: string, error: string, message: string): AgentToolResult {
    return { ok: false, tool, error, message };
  }

  /** Complete an idempotency claim with a structured failure, then return it. */
  private async finishFail(
    claimId: string | undefined,
    organizationId: string,
    tool: string,
    key: string | undefined,
    error: string,
    message: string,
    conversationId?: string,
  ): Promise<AgentToolResult> {
    const result = this.fail(tool, error, message);
    await this.completeIdempotent(
      claimId,
      organizationId,
      tool,
      key,
      result,
      conversationId,
    );
    return result;
  }

  async lookupClient(
    organizationId: string,
    dto: LookupClientDto,
  ): Promise<AgentToolResult> {
    const tool = 'lookup_client';
    const conversationId = this.resolveConversationId(dto);
    const claim = await this.claimIdempotent(
      organizationId,
      tool,
      dto.idempotencyKey,
      conversationId,
    );
    if (claim.kind === 'replay') return claim.result;
    const claimId = claim.kind === 'claimed' ? claim.claimId : undefined;

    const convFail = await this.validateConversationContext(organizationId, tool, dto);
    if (convFail) {
      await this.completeIdempotent(
        claimId,
        organizationId,
        tool,
        dto.idempotencyKey,
        convFail,
        conversationId,
      );
      return convFail;
    }

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
        await this.completeIdempotent(claimId, organizationId, tool, dto.idempotencyKey, result, conversationId);
        return result;
      } catch {
        return this.finishFail(claimId, organizationId, tool, dto.idempotencyKey, 'not_found', 'Client not found in this organization', conversationId);
      }
    }

    if (!dto.email && !dto.phone && !dto.name) {
      return this.finishFail(claimId, organizationId, tool, dto.idempotencyKey, 'invalid_request', 'Provide clientId, email, phone, or name', conversationId);
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
    await this.completeIdempotent(claimId, organizationId, tool, dto.idempotencyKey, result, conversationId);
    return result;
  }

  async saveOrUpdateLead(
    organizationId: string,
    dto: SaveOrUpdateLeadDto,
  ): Promise<AgentToolResult> {
    const tool = 'save_or_update_lead';
    const conversationId = this.resolveConversationId(dto);
    const claim = await this.claimIdempotent(
      organizationId,
      tool,
      dto.idempotencyKey,
      conversationId,
    );
    if (claim.kind === 'replay') return claim.result;
    const claimId = claim.kind === 'claimed' ? claim.claimId : undefined;

    const convFail = await this.validateConversationContext(organizationId, tool, dto);
    if (convFail) {
      await this.completeIdempotent(
        claimId,
        organizationId,
        tool,
        dto.idempotencyKey,
        convFail,
        conversationId,
      );
      return convFail;
    }

    if (dto.clientId) {
      try {
        await this.ensureClientInOrg(organizationId, dto.clientId);
      } catch {
        return this.finishFail(claimId, organizationId, tool, dto.idempotencyKey, 'not_found', 'Client not found in this organization', conversationId);
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
      await this.completeIdempotent(claimId, organizationId, tool, dto.idempotencyKey, result, conversationId);
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
    await this.completeIdempotent(claimId, organizationId, tool, dto.idempotencyKey, result, conversationId);
    return result;
  }

  async checkCalendar(
    organizationId: string,
    dto: CheckCalendarDto,
  ): Promise<AgentToolResult> {
    const tool = 'check_calendar';
    const conversationId = this.resolveConversationId(dto);
    const claim = await this.claimIdempotent(
      organizationId,
      tool,
      dto.idempotencyKey,
      conversationId,
    );
    if (claim.kind === 'replay') return claim.result;
    const claimId = claim.kind === 'claimed' ? claim.claimId : undefined;

    const convFail = await this.validateConversationContext(organizationId, tool, dto);
    if (convFail) {
      await this.completeIdempotent(
        claimId,
        organizationId,
        tool,
        dto.idempotencyKey,
        convFail,
        conversationId,
      );
      return convFail;
    }

    try {
      await this.ensureClinicianInOrg(organizationId, dto.clinicianId);
    } catch {
      return this.finishFail(claimId, organizationId, tool, dto.idempotencyKey, 'not_found', 'Clinician not found in this organization', conversationId);
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
    await this.completeIdempotent(claimId, organizationId, tool, dto.idempotencyKey, result, conversationId);
    return result;
  }

  async scheduleAppointment(
    organizationId: string,
    dto: ScheduleAppointmentDto,
  ): Promise<AgentToolResult> {
    const tool = 'schedule_appointment';
    const conversationId = this.resolveConversationId(dto);
    const claim = await this.claimIdempotent(
      organizationId,
      tool,
      dto.idempotencyKey,
      conversationId,
    );
    if (claim.kind === 'replay') return claim.result;
    const claimId = claim.kind === 'claimed' ? claim.claimId : undefined;

    const convFail = await this.validateConversationContext(organizationId, tool, dto);
    if (convFail) {
      await this.completeIdempotent(
        claimId,
        organizationId,
        tool,
        dto.idempotencyKey,
        convFail,
        conversationId,
      );
      return convFail;
    }

    try {
      await this.ensureClientInOrg(organizationId, dto.clientId);
      await this.ensureClinicianInOrg(organizationId, dto.clinicianId);
      if (dto.locationId) {
        await this.ensureLocationInOrg(organizationId, dto.locationId);
      }
    } catch {
      return this.finishFail(
        claimId,
        organizationId,
        tool,
        dto.idempotencyKey,
        'not_found',
        'Client, clinician, or location not found in this organization',
        conversationId,
      );
    }

    try {
      const appt = await this.appointments.create(
        organizationId,
        null,
        {
          clientId: dto.clientId,
          clinicianId: dto.clinicianId,
          locationId: dto.locationId,
          startTime: dto.startTime,
          endTime: dto.endTime,
          durationMinutes: dto.durationMinutes,
          type: (dto.type as never) ?? undefined,
        },
        {
          actorType: 'jessie_agent',
          tool,
          conversationId: conversationId ?? null,
          idempotencyKey: dto.idempotencyKey ?? null,
        },
      );

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
      await this.completeIdempotent(claimId, organizationId, tool, dto.idempotencyKey, result, conversationId);
      return result;
    } catch (err) {
      this.logger.warn(`schedule_appointment failed: ${(err as Error).message}`);
      return this.finishFail(
        claimId,
        organizationId,
        tool,
        dto.idempotencyKey,
        'schedule_failed',
        (err as Error).message || 'Unable to schedule appointment',
        conversationId,
      );
    }
  }

  async sendSms(
    organizationId: string,
    dto: SendSmsDto,
  ): Promise<AgentToolResult> {
    const tool = 'send_sms';
    const conversationId = this.resolveConversationId(dto);
    const claim = await this.claimIdempotent(
      organizationId,
      tool,
      dto.idempotencyKey,
      conversationId,
    );
    if (claim.kind === 'replay') return claim.result;
    const claimId = claim.kind === 'claimed' ? claim.claimId : undefined;

    const convFail = await this.validateConversationContext(organizationId, tool, dto);
    if (convFail) {
      await this.completeIdempotent(
        claimId,
        organizationId,
        tool,
        dto.idempotencyKey,
        convFail,
        conversationId,
      );
      return convFail;
    }

    if (dto.clientId) {
      try {
        await this.ensureClientInOrg(organizationId, dto.clientId);
      } catch {
        return this.finishFail(claimId, organizationId, tool, dto.idempotencyKey, 'not_found', 'Client not found in this organization', conversationId);
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
      await this.completeIdempotent(claimId, organizationId, tool, dto.idempotencyKey, result, conversationId);
      return result;
    } catch (err) {
      this.logger.warn(`send_sms failed: ${(err as Error).message}`);
      return this.finishFail(
        claimId,
        organizationId,
        tool,
        dto.idempotencyKey,
        'provider_error',
        (err as Error).message || 'SMS provider failed',
        conversationId,
      );
    }
  }

  async sendEmail(
    organizationId: string,
    dto: SendEmailDto,
  ): Promise<AgentToolResult> {
    const tool = 'send_email';
    const conversationId = this.resolveConversationId(dto);
    const claim = await this.claimIdempotent(
      organizationId,
      tool,
      dto.idempotencyKey,
      conversationId,
    );
    if (claim.kind === 'replay') return claim.result;
    const claimId = claim.kind === 'claimed' ? claim.claimId : undefined;

    const convFail = await this.validateConversationContext(organizationId, tool, dto);
    if (convFail) {
      await this.completeIdempotent(
        claimId,
        organizationId,
        tool,
        dto.idempotencyKey,
        convFail,
        conversationId,
      );
      return convFail;
    }

    if (dto.clientId) {
      try {
        await this.ensureClientInOrg(organizationId, dto.clientId);
      } catch {
        return this.finishFail(claimId, organizationId, tool, dto.idempotencyKey, 'not_found', 'Client not found in this organization', conversationId);
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
      await this.completeIdempotent(claimId, organizationId, tool, dto.idempotencyKey, result, conversationId);
      return result;
    } catch (err) {
      this.logger.warn(`send_email failed: ${(err as Error).message}`);
      return this.finishFail(
        claimId,
        organizationId,
        tool,
        dto.idempotencyKey,
        'provider_error',
        (err as Error).message || 'Email provider failed',
        conversationId,
      );
    }
  }

  async transferToHuman(
    organizationId: string,
    dto: TransferToHumanDto,
  ): Promise<AgentToolResult> {
    const tool = 'transfer_to_human';
    const conversationId = this.resolveConversationId(dto);
    const claim = await this.claimIdempotent(
      organizationId,
      tool,
      dto.idempotencyKey,
      conversationId,
    );
    if (claim.kind === 'replay') return claim.result;
    const claimId = claim.kind === 'claimed' ? claim.claimId : undefined;

    const convFail = await this.validateConversationContext(organizationId, tool, dto);
    if (convFail) {
      await this.completeIdempotent(
        claimId,
        organizationId,
        tool,
        dto.idempotencyKey,
        convFail,
        conversationId,
      );
      return convFail;
    }

    if (dto.clientId) {
      try {
        await this.ensureClientInOrg(organizationId, dto.clientId);
      } catch {
        return this.finishFail(claimId, organizationId, tool, dto.idempotencyKey, 'not_found', 'Client not found in this organization', conversationId);
      }
    }
    if (dto.assigneeId) {
      try {
        await this.ensureUserInOrg(organizationId, dto.assigneeId);
      } catch {
        return this.finishFail(claimId, organizationId, tool, dto.idempotencyKey, 'not_found', 'Assignee not found in this organization', conversationId);
      }
    }

    const actor =
      (await this.prisma.user.findFirst({
        where: { organizationId, status: 'ACTIVE' },
        select: { id: true },
        orderBy: { createdAt: 'asc' },
      })) ?? null;

    if (!actor) {
      return this.finishFail(
        claimId,
        organizationId,
        tool,
        dto.idempotencyKey,
        'no_staff',
        'No active staff user available to own the escalation task',
        conversationId,
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
          conversationId ? `Conversation: ${conversationId}` : null,
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
    await this.completeIdempotent(claimId, organizationId, tool, dto.idempotencyKey, result, conversationId);
    return result;
  }

  async getBusinessInformation(
    organizationId: string,
    dto: GetBusinessInformationDto,
  ): Promise<AgentToolResult> {
    const tool = 'get_business_information';
    const conversationId = this.resolveConversationId(dto);
    const claim = await this.claimIdempotent(
      organizationId,
      tool,
      dto.idempotencyKey,
      conversationId,
    );
    if (claim.kind === 'replay') return claim.result;
    const claimId = claim.kind === 'claimed' ? claim.claimId : undefined;

    const convFail = await this.validateConversationContext(organizationId, tool, dto);
    if (convFail) {
      await this.completeIdempotent(
        claimId,
        organizationId,
        tool,
        dto.idempotencyKey,
        convFail,
        conversationId,
      );
      return convFail;
    }

    try {
      const [services, faqArticles, hoursArticles] = await Promise.all([
        this.prisma.serviceCode.findMany({
          where: { organizationId, isActive: true },
          select: { code: true, description: true, defaultFee: true },
          orderBy: { code: 'asc' },
        }),
        this.prisma.knowledgeArticle.findMany({
          where: {
            organizationId,
            isPublished: true,
            tags: { has: 'faq' },
          },
          select: { title: true, body: true },
          orderBy: { title: 'asc' },
        }),
        this.prisma.knowledgeArticle.findMany({
          where: {
            organizationId,
            isPublished: true,
            tags: { has: 'hours' },
          },
          select: { title: true, body: true },
          orderBy: { title: 'asc' },
        }),
      ]);

      const result: AgentToolResult = {
        ok: true,
        tool,
        data: {
          services: services.map((s) => ({
            code: s.code,
            description: s.description,
            defaultFee: s.defaultFee.toString(),
          })),
          faq: faqArticles.map((a) => ({
            question: a.title,
            answer: a.body,
          })),
          hours: hoursArticles.map((a) => ({
            label: a.title,
            details: a.body,
          })),
        },
      };
      await this.completeIdempotent(claimId, organizationId, tool, dto.idempotencyKey, result, conversationId);
      return result;
    } catch (err) {
      this.logger.warn(`get_business_information failed: ${(err as Error).message}`);
      return this.finishFail(
        claimId,
        organizationId,
        tool,
        dto.idempotencyKey,
        'query_failed',
        (err as Error).message || 'Failed to load business information',
        conversationId,
      );
    }
  }
}
