import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction } from '@sbos/database';
import { randomUUID } from 'crypto';

import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import {
  LookupClientRequestDto,
  LookupClientResponseDto,
  CaptureLeadRequestDto,
  CaptureLeadResponseDto,
  CreateOrRequestAppointmentRequestDto,
  CreateOrRequestAppointmentResponseDto,
  TransferCallRequestDto,
  TransferCallResponseDto,
  SendMessageOrCallbackRequestDto,
  SendMessageOrCallbackResponseDto,
  LogCallOutcomeRequestDto,
  LogCallOutcomeResponseDto,
  GetBusinessInformationResponseDto,
  MakeEventDto,
  JessieIntegrationResponseDto,
  CallOutcomeEnum,
  TransferTargetEnum,
} from './dto/jessie-integration.dto';
import { SmsProvider, SMS_PROVIDER } from '../../channels/sms.provider';
import { EmailProvider, EMAIL_PROVIDER } from '../../channels/email.provider';

interface AuthenticatedContext {
  organizationId: string;
  userId: string;
  isServiceAccount: boolean;
}

@Injectable()
export class JessieIntegrationService {
  private readonly logger = new Logger(JessieIntegrationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(SMS_PROVIDER) private readonly sms: SmsProvider,
    @Inject(EMAIL_PROVIDER) private readonly email: EmailProvider,
  ) {}

  private generateRequestId(): string {
    return `req-${randomUUID()}`;
  }

  private generateEventId(): string {
    return `evt-${randomUUID()}`;
  }

  private async emitMakeEvent(
    organizationId: string,
    event: Omit<MakeEventDto, 'event_id' | 'organization_id' | 'timestamp'>,
  ): Promise<void> {
    const makeEvent: MakeEventDto = {
      ...event,
      event_id: this.generateEventId(),
      organization_id: organizationId,
      timestamp: new Date().toISOString(),
    };

    await this.prisma.auditLog.create({
      data: {
        organizationId,
        action: AuditAction.CREATE,
        entityType: 'MakeEvent',
        entityId: makeEvent.event_id,
        metadata: makeEvent as any,
      },
    });

    this.logger.debug(`Emitted Make event: ${makeEvent.event_type} (${makeEvent.event_id})`);
  }

  private async checkIdempotency(
    organizationId: string,
    idempotencyKey: string,
    resourceType: string,
  ): Promise<{ exists: boolean; resourceId?: string }> {
    const existing = await this.prisma.idempotencyKey.findUnique({
      where: { organizationId_key: { organizationId, key: idempotencyKey } },
      select: { resourceId: true, resourceType: true },
    });

    if (existing) {
      if (existing.resourceType !== resourceType) {
        throw new BadRequestException(
          `Idempotency key ${idempotencyKey} already used for different resource type: ${existing.resourceType}`,
        );
      }
      return { exists: true, resourceId: existing.resourceId ?? undefined };
    }

    return { exists: false };
  }

  private async recordIdempotency(
    organizationId: string,
    idempotencyKey: string,
    resourceType: string,
    resourceId: string,
  ): Promise<void> {
    await this.prisma.idempotencyKey.create({
      data: {
        organizationId,
        key: idempotencyKey,
        resourceType,
        resourceId,
      },
    });
  }

  async lookupClient(
    ctx: AuthenticatedContext,
    dto: LookupClientRequestDto,
  ): Promise<JessieIntegrationResponseDto<LookupClientResponseDto>> {
    const requestId = this.generateRequestId();

    const client = await this.prisma.client.findFirst({
      where: {
        id: dto.clientId,
        organizationId: ctx.organizationId,
        deletedAt: null,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        preferredName: true,
        mrn: true,
        phone: true,
        email: true,
        status: true,
        primaryClinicianId: true,
      },
    });

    if (!client) {
      await this.emitMakeEvent(ctx.organizationId, {
        request_id: requestId,
        conversation_id: 'lookup-client',
        client_id: dto.clientId,
        event_type: 'lookup_client',
        payload: { found: false, reason: 'NOT_FOUND' },
      });

      return {
        success: false,
        error: 'Client not found',
        requestId,
      };
    }

    const response: LookupClientResponseDto = {
      clientId: client.id,
      firstName: client.firstName,
      lastName: client.lastName,
      preferredName: client.preferredName ?? undefined,
      mrn: client.mrn ?? undefined,
      phone: client.phone ?? undefined,
      email: client.email ?? undefined,
      status: client.status,
      primaryClinicianId: client.primaryClinicianId ?? undefined,
    };

    await this.emitMakeEvent(ctx.organizationId, {
      request_id: requestId,
      conversation_id: 'lookup-client',
      client_id: client.id,
      event_type: 'lookup_client',
      payload: { found: true },
    });

    return {
      success: true,
      data: response,
      requestId,
    };
  }

  async captureLead(
    ctx: AuthenticatedContext,
    dto: CaptureLeadRequestDto,
  ): Promise<JessieIntegrationResponseDto<CaptureLeadResponseDto>> {
    const requestId = this.generateRequestId();

    const idempotencyCheck = await this.checkIdempotency(
      ctx.organizationId,
      dto.idempotencyKey,
      'Lead',
    );

    if (idempotencyCheck.exists) {
      const existingLead = await this.prisma.lead.findUnique({
        where: { id: idempotencyCheck.resourceId },
        select: { id: true },
      });

      await this.emitMakeEvent(ctx.organizationId, {
        request_id: requestId,
        conversation_id: 'capture-lead',
        client_id: existingLead?.id ?? 'unknown',
        event_type: 'capture_lead',
        payload: { status: 'EXISTS', leadId: existingLead?.id },
      });

      return {
        success: true,
        data: { leadId: existingLead!.id, status: 'EXISTS' },
        requestId,
      };
    }

    const lead = await this.prisma.lead.create({
      data: {
        organizationId: ctx.organizationId,
        idempotencyKey: dto.idempotencyKey,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        email: dto.email,
        reason: dto.reason,
        source: dto.source,
      },
    });

    await this.recordIdempotency(
      ctx.organizationId,
      dto.idempotencyKey,
      'Lead',
      lead.id,
    );

    await this.audit.record({
      organizationId: ctx.organizationId,
      actorId: ctx.userId,
      action: AuditAction.CREATE,
      entityType: 'Lead',
      entityId: lead.id,
      metadata: { source: dto.source },
    });

    await this.emitMakeEvent(ctx.organizationId, {
      request_id: requestId,
      conversation_id: 'capture-lead',
      client_id: lead.id,
      event_type: 'capture_lead',
      payload: { status: 'CREATED', leadId: lead.id },
    });

    return {
      success: true,
      data: { leadId: lead.id, status: 'CREATED' },
      requestId,
    };
  }

  async createOrRequestAppointment(
    ctx: AuthenticatedContext,
    dto: CreateOrRequestAppointmentRequestDto,
  ): Promise<JessieIntegrationResponseDto<CreateOrRequestAppointmentResponseDto>> {
    const requestId = this.generateRequestId();

    const idempotencyCheck = await this.checkIdempotency(
      ctx.organizationId,
      dto.idempotencyKey,
      'Appointment',
    );

    if (idempotencyCheck.exists) {
      const existingAppointment = await this.prisma.appointment.findUnique({
        where: { id: idempotencyCheck.resourceId },
        select: { id: true, status: true, startTime: true },
      });

      await this.emitMakeEvent(ctx.organizationId, {
        request_id: requestId,
        conversation_id: 'create-appointment',
        client_id: dto.clientId,
        event_type: 'create_or_request_appointment',
        payload: { status: 'EXISTS', appointmentId: existingAppointment?.id },
      });

      return {
        success: true,
        data: {
          appointmentId: existingAppointment!.id,
          status: existingAppointment!.status === 'SCHEDULED' ? 'CONFIRMED' : 'REQUESTED',
          confirmedStartTime: existingAppointment!.startTime.toISOString(),
        },
        requestId,
      };
    }

    const client = await this.prisma.client.findFirst({
      where: { id: dto.clientId, organizationId: ctx.organizationId, deletedAt: null },
      select: { id: true },
    });

    if (!client) {
      throw new NotFoundException(`Client ${dto.clientId} not found`);
    }

    const preferredStart = new Date(dto.preferredStartTime);
    const durationMinutes = dto.durationMinutes ? parseInt(dto.durationMinutes, 10) : 60;
    const preferredEnd = new Date(preferredStart.getTime() + durationMinutes * 60_000);

    let appointment;
    let status: 'CONFIRMED' | 'REQUESTED' = 'REQUESTED';
    let message: string | undefined;

    if (dto.preferredClinicianId) {
      const clinician = await this.prisma.clinician.findFirst({
        where: { id: dto.preferredClinicianId, organizationId: ctx.organizationId },
        select: { id: true },
      });

      if (!clinician) {
        throw new NotFoundException(`Clinician ${dto.preferredClinicianId} not found`);
      }

      const conflict = await this.prisma.appointment.findFirst({
        where: {
          organizationId: ctx.organizationId,
          clinicianId: dto.preferredClinicianId,
          status: { notIn: ['CANCELLED', 'NO_SHOW'] },
          startTime: { lt: preferredEnd },
          endTime: { gt: preferredStart },
        },
        select: { id: true },
      });

      if (!conflict) {
        appointment = await this.prisma.appointment.create({
          data: {
            organizationId: ctx.organizationId,
            clientId: dto.clientId,
            clinicianId: dto.preferredClinicianId,
            type: dto.type as any,
            startTime: preferredStart,
            endTime: preferredEnd,
            durationMinutes,
            cptCode: dto.reason,
          },
        });
        status = 'CONFIRMED';
      } else {
        appointment = await this.prisma.appointment.create({
          data: {
            organizationId: ctx.organizationId,
            clientId: dto.clientId,
            clinicianId: dto.preferredClinicianId,
            type: dto.type as any,
            startTime: preferredStart,
            endTime: preferredEnd,
            durationMinutes,
            cptCode: dto.reason,
            status: 'SCHEDULED',
          },
        });
        message = 'Preferred clinician unavailable at requested time; request queued for review.';
      }
    } else {
      const availableClinician = await this.prisma.clinician.findFirst({
        where: {
          organizationId: ctx.organizationId,
          isAcceptingNewClients: true,
          appointments: {
            none: {
              status: { notIn: ['CANCELLED', 'NO_SHOW'] },
              startTime: { lt: preferredEnd },
              endTime: { gt: preferredStart },
            },
          },
        },
        select: { id: true },
      });

      if (availableClinician) {
        appointment = await this.prisma.appointment.create({
          data: {
            organizationId: ctx.organizationId,
            clientId: dto.clientId,
            clinicianId: availableClinician.id,
            type: dto.type as any,
            startTime: preferredStart,
            endTime: preferredEnd,
            durationMinutes,
            cptCode: dto.reason,
          },
        });
        status = 'CONFIRMED';
      } else {
        const anyClinician = await this.prisma.clinician.findFirst({
          where: { organizationId: ctx.organizationId, isAcceptingNewClients: true },
          select: { id: true },
        });

        if (!anyClinician) {
          throw new BadRequestException('No clinicians available to accept appointments');
        }

        appointment = await this.prisma.appointment.create({
          data: {
            organizationId: ctx.organizationId,
            clientId: dto.clientId,
            clinicianId: anyClinician.id,
            type: dto.type as any,
            startTime: preferredStart,
            endTime: preferredEnd,
            durationMinutes,
            cptCode: dto.reason,
            status: 'SCHEDULED',
          },
        });
        message = 'No clinician available at requested time; request queued for review.';
      }
    }

    await this.recordIdempotency(
      ctx.organizationId,
      dto.idempotencyKey,
      'Appointment',
      appointment.id,
    );

    await this.audit.record({
      organizationId: ctx.organizationId,
      actorId: ctx.userId,
      action: AuditAction.CREATE,
      entityType: 'Appointment',
      entityId: appointment.id,
      metadata: { clientId: dto.clientId, type: dto.type, status },
    });

    await this.emitMakeEvent(ctx.organizationId, {
      request_id: requestId,
      conversation_id: 'create-appointment',
      client_id: dto.clientId,
      event_type: 'create_or_request_appointment',
      payload: { status, appointmentId: appointment.id, confirmedStartTime: appointment.startTime.toISOString() },
    });

    return {
      success: true,
      data: {
        appointmentId: appointment.id,
        status,
        confirmedStartTime: status === 'CONFIRMED' ? appointment.startTime.toISOString() : undefined,
        message,
      },
      requestId,
    };
  }

  async transferCall(
    ctx: AuthenticatedContext,
    dto: TransferCallRequestDto,
  ): Promise<JessieIntegrationResponseDto<TransferCallResponseDto>> {
    const requestId = this.generateRequestId();

    const conversation = await this.prisma.conversation.findFirst({
      where: { id: dto.conversationId, organizationId: ctx.organizationId },
      select: { id: true, clientId: true },
    });

    if (!conversation) {
      throw new NotFoundException(`Conversation ${dto.conversationId} not found`);
    }

    const transfer = await this.prisma.callTransfer.create({
      data: {
        organizationId: ctx.organizationId,
        conversationId: dto.conversationId,
        target: dto.target,
        reason: dto.reason,
        targetAgentId: dto.targetAgentId,
        status: 'INITIATED',
      },
    });

    await this.audit.record({
      organizationId: ctx.organizationId,
      actorId: ctx.userId,
      action: AuditAction.CREATE,
      entityType: 'CallTransfer',
      entityId: transfer.id,
      metadata: { target: dto.target, conversationId: dto.conversationId },
    });

    let status: 'TRANSFER_INITIATED' | 'TRANSFER_QUEUED' | 'TRANSFER_UNAVAILABLE' = 'TRANSFER_QUEUED';
    let message: string | undefined;

    switch (dto.target) {
      case TransferTargetEnum.HUMAN_AGENT:
        status = 'TRANSFER_QUEUED';
        message = 'Human agent will join within 2 minutes';
        break;
      case TransferTargetEnum.VOICEMAIL:
        status = 'TRANSFER_INITIATED';
        message = 'Transferring to voicemail';
        break;
      case TransferTargetEnum.SCHEDULING_QUEUE:
        status = 'TRANSFER_QUEUED';
        message = 'Added to scheduling queue';
        break;
      case TransferTargetEnum.CRISIS_LINE:
        status = 'TRANSFER_INITIATED';
        message = 'Transferring to crisis line';
        break;
    }

    await this.emitMakeEvent(ctx.organizationId, {
      request_id: requestId,
      conversation_id: dto.conversationId,
      client_id: conversation.clientId ?? 'unknown',
      event_type: 'transfer_call',
      payload: { status, transferId: transfer.id, target: dto.target },
    });

    return {
      success: true,
      data: { status, transferId: transfer.id, message },
      requestId,
    };
  }

  async sendMessageOrCallbackRequest(
    ctx: AuthenticatedContext,
    dto: SendMessageOrCallbackRequestDto,
  ): Promise<JessieIntegrationResponseDto<SendMessageOrCallbackResponseDto>> {
    const requestId = this.generateRequestId();

    const idempotencyCheck = await this.checkIdempotency(
      ctx.organizationId,
      dto.idempotencyKey,
      'CallbackRequest',
    );

    if (idempotencyCheck.exists) {
      const existing = await this.prisma.callbackRequest.findUnique({
        where: { id: idempotencyCheck.resourceId },
        select: { id: true, status: true },
      });

      await this.emitMakeEvent(ctx.organizationId, {
        request_id: requestId,
        conversation_id: 'send-message-callback',
        client_id: dto.clientId,
        event_type: 'send_message_or_callback_request',
        payload: { status: 'EXISTS', requestId: existing?.id },
      });

      return {
        success: true,
        data: { requestId: existing!.id, status: 'EXISTS' },
        requestId,
      };
    }

    const client = await this.prisma.client.findFirst({
      where: { id: dto.clientId, organizationId: ctx.organizationId, deletedAt: null },
      select: { id: true, phone: true, email: true },
    });

    if (!client) {
      throw new NotFoundException(`Client ${dto.clientId} not found`);
    }

    const callbackRequest = await this.prisma.callbackRequest.create({
      data: {
        organizationId: ctx.organizationId,
        clientId: dto.clientId,
        idempotencyKey: dto.idempotencyKey,
        type: dto.type,
        message: dto.message,
        contactValue: dto.contactValue,
        preferredCallbackTime: dto.preferredCallbackTime ? new Date(dto.preferredCallbackTime) : null,
        status: 'QUEUED',
      },
    });

    await this.recordIdempotency(
      ctx.organizationId,
      dto.idempotencyKey,
      'CallbackRequest',
      callbackRequest.id,
    );

    await this.audit.record({
      organizationId: ctx.organizationId,
      actorId: ctx.userId,
      action: AuditAction.CREATE,
      entityType: 'CallbackRequest',
      entityId: callbackRequest.id,
      metadata: { type: dto.type, clientId: dto.clientId },
    });

    if (dto.type === 'SMS' && dto.contactValue) {
      void this.sms
        .send({ to: dto.contactValue, body: dto.message ?? 'You have a message from your care team.' })
        .catch((error) => this.logger.warn(`SMS send failed: ${String(error)}`));
    } else if (dto.type === 'EMAIL' && dto.contactValue) {
      void this.email
        .send({ to: dto.contactValue, subject: 'Message from your care team', text: dto.message ?? '' })
        .catch((error) => this.logger.warn(`Email send failed: ${String(error)}`));
    }

    await this.emitMakeEvent(ctx.organizationId, {
      request_id: requestId,
      conversation_id: 'send-message-callback',
      client_id: dto.clientId,
      event_type: 'send_message_or_callback_request',
      payload: { status: 'QUEUED', requestId: callbackRequest.id, type: dto.type },
    });

    return {
      success: true,
      data: { requestId: callbackRequest.id, status: 'QUEUED' },
      requestId,
    };
  }

  async logCallOutcome(
    ctx: AuthenticatedContext,
    dto: LogCallOutcomeRequestDto,
  ): Promise<JessieIntegrationResponseDto<LogCallOutcomeResponseDto>> {
    const requestId = this.generateRequestId();

    const idempotencyCheck = await this.checkIdempotency(
      ctx.organizationId,
      dto.idempotencyKey,
      'CallLog',
    );

    if (idempotencyCheck.exists) {
      const existing = await this.prisma.callLog.findUnique({
        where: { id: idempotencyCheck.resourceId },
        select: { id: true },
      });

      await this.emitMakeEvent(ctx.organizationId, {
        request_id: requestId,
        conversation_id: dto.conversationId,
        client_id: 'unknown',
        event_type: 'log_call_outcome',
        payload: { status: 'EXISTS', logId: existing?.id },
      });

      return {
        success: true,
        data: { logId: existing!.id, status: 'EXISTS' },
        requestId,
      };
    }

    const conversation = await this.prisma.conversation.findFirst({
      where: { id: dto.conversationId, organizationId: ctx.organizationId },
      select: { id: true, clientId: true },
    });

    if (!conversation) {
      throw new NotFoundException(`Conversation ${dto.conversationId} not found`);
    }

    const callLog = await this.prisma.callLog.create({
      data: {
        organizationId: ctx.organizationId,
        conversationId: dto.conversationId,
        idempotencyKey: dto.idempotencyKey,
        outcome: dto.outcome,
        durationSeconds: dto.durationSeconds ? parseInt(dto.durationSeconds, 10) : null,
        summary: dto.summary,
        recordingId: dto.recordingId,
      },
    });

    await this.recordIdempotency(
      ctx.organizationId,
      dto.idempotencyKey,
      'CallLog',
      callLog.id,
    );

    await this.audit.record({
      organizationId: ctx.organizationId,
      actorId: ctx.userId,
      action: AuditAction.CREATE,
      entityType: 'CallLog',
      entityId: callLog.id,
      metadata: { outcome: dto.outcome, conversationId: dto.conversationId },
    });

    await this.emitMakeEvent(ctx.organizationId, {
      request_id: requestId,
      conversation_id: dto.conversationId,
      client_id: conversation.clientId ?? 'unknown',
      event_type: 'log_call_outcome',
      payload: { status: 'LOGGED', logId: callLog.id, outcome: dto.outcome },
    });

    return {
      success: true,
      data: { logId: callLog.id, status: 'LOGGED' },
      requestId,
    };
  }

  async getBusinessInformation(
    ctx: AuthenticatedContext,
  ): Promise<JessieIntegrationResponseDto<GetBusinessInformationResponseDto>> {
    const requestId = this.generateRequestId();

    const organization = await this.prisma.organization.findUnique({
      where: { id: ctx.organizationId },
      select: {
        name: true,
        phone: true,
        email: true,
        addressLine1: true,
        addressLine2: true,
        city: true,
        state: true,
        postalCode: true,
        timezone: true,
      },
    });

    if (!organization) {
      throw new NotFoundException(`Organization ${ctx.organizationId} not found`);
    }

    const addressParts = [
      organization.addressLine1,
      organization.addressLine2,
      organization.city,
      organization.state,
      organization.postalCode,
    ].filter(Boolean);

    const [serviceCodes, knowledgeArticles] = await Promise.all([
      this.prisma.serviceCode.findMany({
        where: {
          organizationId: ctx.organizationId,
          isActive: true,
        },
        select: {
          description: true,
        },
        orderBy: {
          code: 'asc',
        },
      }),
      this.prisma.knowledgeArticle.findMany({
        where: {
          organizationId: ctx.organizationId,
          isPublished: true,
        },
        select: {
          title: true,
          body: true,
          tags: true,
        },
        orderBy: {
          createdAt: 'asc',
        },
      }),
    ]);

    const hoursArticle = knowledgeArticles.find((article) =>
      article.tags.some((tag) => /hour|hours|schedule|open/i.test(tag)),
    );

    const response: GetBusinessInformationResponseDto = {
      name: organization.name,
      phone: organization.phone ?? undefined,
      email: organization.email ?? undefined,
      address: addressParts.length > 0 ? addressParts.join(', ') : undefined,
      hours: hoursArticle?.body,
      services: serviceCodes.map((service) => service.description),
      faq: knowledgeArticles.map((article) => ({
        question: article.title,
        answer: article.body,
        tags: article.tags,
      })),
      timezone: organization.timezone,
    };

    await this.emitMakeEvent(ctx.organizationId, {
      request_id: requestId,
      conversation_id: 'get-business-info',
      client_id: 'none',
      event_type: 'get_business_information',
      payload: {},
    });

    return {
      success: true,
      data: response,
      requestId,
    };
  }
}