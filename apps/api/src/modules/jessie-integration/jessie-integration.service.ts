import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { AuditAction } from '@sbos/database';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import {
  LookupClientRequestDto,
  LookupClientResponseDto,
  LookupIdentifierType,
} from './dto/lookup-client.dto';
import {
  CaptureLeadRequestDto,
  CaptureLeadResponseDto,
  LeadUrgency,
} from './dto/capture-lead.dto';
import {
  CreateAppointmentRequestDto,
  AppointmentRequestResponseDto,
  AppointmentRequestStatus,
} from './dto/appointment-request.dto';
import {
  TransferCallRequestDto,
  TransferCallResponseDto,
} from './dto/transfer-call.dto';
import {
  SendMessageOrCallbackRequestDto,
  CallbackMessageResponseDto,
  CallbackUrgency,
} from './dto/callback-message.dto';
import {
  LogCallOutcomeRequestDto,
  LogCallOutcomeResponseDto,
  CallOutcomeResolution,
  CallOutcomeLeadQuality,
  CallOutcomeUrgency,
} from './dto/call-outcome.dto';
import {
  GetBusinessInformationRequestDto,
  BusinessInformationResponseDto,
} from './dto/business-information.dto';

interface IdempotencyRecord {
  id: string;
  requestId: string;
  response: unknown;
  createdAt: Date;
}

type OrganizationProfile = {
  id: string;
  name: string;
  slug: string;
  phone: string | null;
  email: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  timezone: string;
  isActive: boolean;
  locations: Array<{
    addressLine1: string | null;
    addressLine2: string | null;
    city: string | null;
    state: string | null;
    postalCode: string | null;
  }>;
};

@Injectable()
export class JessieIntegrationService {
  private readonly logger = new Logger(JessieIntegrationService.name);
  private readonly idempotencyCache = new Map<string, IdempotencyRecord>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private async getActiveOrganization(
    organizationId: string,
  ): Promise<OrganizationProfile> {
    const organization = await this.prisma.organization.findFirst({
      where: { id: organizationId, isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        phone: true,
        email: true,
        addressLine1: true,
        addressLine2: true,
        city: true,
        state: true,
        postalCode: true,
        timezone: true,
        isActive: true,
        locations: {
          select: {
            addressLine1: true,
            addressLine2: true,
            city: true,
            state: true,
            postalCode: true,
          },
        },
      },
    });

    if (!organization) {
      throw new NotFoundException(
        'No active business found for the authenticated organization',
      );
    }

    return organization;
  }

  private async ensureBusinessInOrg(
    organizationId: string,
    requestedBusinessId: string,
  ): Promise<OrganizationProfile> {
    if (requestedBusinessId !== organizationId) {
      throw new NotFoundException(
        'Business not found for the authenticated organization',
      );
    }

    return this.getActiveOrganization(organizationId);
  }

  private async getTaskOwnerId(organizationId: string): Promise<string> {
    const actor = await this.prisma.user.findFirst({
      where: { organizationId, status: 'ACTIVE' },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });

    if (!actor) {
      throw new ConflictException(
        'No active staff user is available to own Jessie receptionist follow-up tasks',
      );
    }

    return actor.id;
  }

  private normalizePhone(value: string | null | undefined): string {
    return value?.replace(/\D/g, '') ?? '';
  }

  private formatAddress(parts: Array<string | null | undefined>): string {
    return parts
      .map((part) => part?.trim())
      .filter((part): part is string => Boolean(part))
      .join(', ');
  }

  private buildLocation(organization: OrganizationProfile): string {
    const primaryLocation = organization.locations[0];
    if (primaryLocation) {
      return this.formatAddress([
        primaryLocation.addressLine1,
        primaryLocation.addressLine2,
        primaryLocation.city,
        primaryLocation.state,
        primaryLocation.postalCode,
      ]);
    }

    return this.formatAddress([
      organization.addressLine1,
      organization.addressLine2,
      organization.city,
      organization.state,
      organization.postalCode,
    ]);
  }

  private buildBusinessProfile(organization: OrganizationProfile) {
    return {
      clientId: organization.id,
      businessName: organization.name,
      businessType: 'service_business',
      greeting: `Welcome to ${organization.name}. How can I help you today?`,
      phone: organization.phone ?? '',
      location: this.buildLocation(organization),
      businessHours: {},
      timezone: organization.timezone ?? 'America/New_York',
      services: [],
      faq: [],
      transferRules: {},
      transferNumbers: [],
      leadCaptureFields: ['name', 'phone', 'email', 'reason_for_call'],
      afterHoursBehavior: 'callback',
      bookingEnabled: false,
      bookingRules: {},
      emergencyRules: {},
      restrictedTopics: [],
      approvedClaims: [],
      customInstructions: '',
      clientStatus: organization.isActive ? 'active' : 'inactive',
    };
  }

  async lookupClient(
    organizationId: string,
    dto: LookupClientRequestDto,
  ): Promise<LookupClientResponseDto> {
    const organization = await this.getActiveOrganization(organizationId);

    switch (dto.identifierType) {
      case LookupIdentifierType.ORGANIZATION_ID:
        if (dto.identifierValue !== organization.id) {
          throw new NotFoundException(
            'No active business found for the provided identifier',
          );
        }
        break;
      case LookupIdentifierType.CLIENT_SLUG:
        if (dto.identifierValue !== organization.slug) {
          throw new NotFoundException(
            'No active business found for the provided identifier',
          );
        }
        break;
      case LookupIdentifierType.INBOUND_NUMBER:
      case LookupIdentifierType.CALLED_PHONE_NUMBER:
      case LookupIdentifierType.LINE_IDENTIFIER:
        if (
          !organization.phone ||
          this.normalizePhone(organization.phone) !==
            this.normalizePhone(dto.identifierValue)
        ) {
          throw new NotFoundException(
            'No active business found for the provided identifier',
          );
        }
        break;
      case LookupIdentifierType.METADATA:
        throw new NotFoundException('Metadata lookup not supported');
      default:
        throw new NotFoundException('Unsupported identifier type');
    }

    return {
      ...this.buildBusinessProfile(organization),
    };
  }

  async captureLead(
    organizationId: string,
    dto: CaptureLeadRequestDto,
  ): Promise<CaptureLeadResponseDto> {
    const business = await this.ensureBusinessInOrg(organizationId, dto.clientId);
    const idempotencyKey = `lead:${dto.requestId}`;
    const cached = this.idempotencyCache.get(idempotencyKey);
    if (cached) {
      return { ...cached.response as CaptureLeadResponseDto, status: 'duplicate' };
    }

    const existing = await this.prisma.task.findFirst({
      where: {
        organizationId,
        title: `Lead: ${dto.callerName}`,
        description: { contains: dto.requestId },
      },
    });

    if (existing) {
      const response: CaptureLeadResponseDto = {
        leadId: existing.id,
        status: 'duplicate',
        createdAt: existing.createdAt.toISOString(),
        requestId: dto.requestId,
      };
      this.idempotencyCache.set(idempotencyKey, { id: existing.id, requestId: dto.requestId, response, createdAt: new Date() });
      return response;
    }

    const ownerId = await this.getTaskOwnerId(organizationId);
    const lead = await this.prisma.task.create({
      data: {
        organizationId,
        createdById: ownerId,
        title: `Lead: ${dto.callerName}`,
        description: `Business: ${business.name} (${business.id})\nPhone: ${dto.callerPhone}\nEmail: ${dto.callerEmail ?? 'N/A'}\nReason: ${dto.reasonForCall}\nService: ${dto.serviceInterest ?? 'N/A'}\nUrgency: ${dto.urgency ?? LeadUrgency.NORMAL}\nNotes: ${dto.notes ?? 'N/A'}\nConversation: ${dto.conversationId}\nRequest: ${dto.requestId}`,
        status: 'OPEN',
        priority: this.mapUrgencyToPriority(dto.urgency),
        clientId: null,
      },
    });

    await this.audit.record({
      organizationId,
      action: AuditAction.CREATE,
      entityType: 'LeadCapture',
      entityId: lead.id,
      metadata: {
        businessId: business.id,
        requestId: dto.requestId,
        conversationId: dto.conversationId,
      },
    });

    const response: CaptureLeadResponseDto = {
      leadId: lead.id,
      status: 'created',
      createdAt: lead.createdAt.toISOString(),
      requestId: dto.requestId,
    };

    this.idempotencyCache.set(idempotencyKey, { id: lead.id, requestId: dto.requestId, response, createdAt: new Date() });
    return response;
  }

  async createAppointmentRequest(
    organizationId: string,
    dto: CreateAppointmentRequestDto,
  ): Promise<AppointmentRequestResponseDto> {
    const business = await this.ensureBusinessInOrg(organizationId, dto.clientId);
    const idempotencyKey = `appt:${dto.requestId}`;
    const cached = this.idempotencyCache.get(idempotencyKey);
    if (cached) {
      return { ...cached.response as AppointmentRequestResponseDto, status: AppointmentRequestStatus.REQUESTED };
    }

    const requestedDateTime = new Date(`${dto.requestedDate}T${dto.requestedTime}`);
    if (isNaN(requestedDateTime.getTime())) {
      throw new ConflictException('Invalid requested date/time format');
    }

    const existing = await this.prisma.task.findFirst({
      where: {
        organizationId,
        title: { startsWith: 'Appointment Request:' },
        description: { contains: dto.requestId },
      },
    });

    if (existing) {
      const response: AppointmentRequestResponseDto = {
        appointmentRequestId: existing.id,
        status: AppointmentRequestStatus.REQUESTED,
        createdAt: existing.createdAt.toISOString(),
        requestId: dto.requestId,
      };
      this.idempotencyCache.set(idempotencyKey, { id: existing.id, requestId: dto.requestId, response, createdAt: new Date() });
      return response;
    }

    const ownerId = await this.getTaskOwnerId(organizationId);
    const appointmentRequest = await this.prisma.task.create({
      data: {
        organizationId,
        createdById: ownerId,
        title: `Appointment Request: ${dto.service}`,
        description: `Business: ${business.name} (${business.id})\nClient: ${dto.callerName}\nPhone: ${dto.callerPhone}\nService: ${dto.service}\nRequested: ${dto.requestedDate} ${dto.requestedTime} ${dto.timezone}\nNotes: ${dto.notes ?? 'N/A'}\nConversation: ${dto.conversationId}\nRequest: ${dto.requestId}`,
        status: 'OPEN',
        priority: 'HIGH',
        clientId: null,
        dueDate: requestedDateTime,
      },
    });

    await this.audit.record({
      organizationId,
      action: AuditAction.CREATE,
      entityType: 'AppointmentRequest',
      entityId: appointmentRequest.id,
      metadata: {
        businessId: business.id,
        requestId: dto.requestId,
        conversationId: dto.conversationId,
      },
    });

    const response: AppointmentRequestResponseDto = {
      appointmentRequestId: appointmentRequest.id,
      status: AppointmentRequestStatus.REQUESTED,
      createdAt: appointmentRequest.createdAt.toISOString(),
      requestId: dto.requestId,
    };

    this.idempotencyCache.set(idempotencyKey, { id: appointmentRequest.id, requestId: dto.requestId, response, createdAt: new Date() });
    return response;
  }

  async transferCall(
    organizationId: string,
    dto: TransferCallRequestDto,
  ): Promise<TransferCallResponseDto> {
    try {
      await this.ensureBusinessInOrg(organizationId, dto.clientId);
    } catch {
      return {
        allowed: false,
        reason: 'Business not found or inactive for the authenticated organization',
        fallbackBehavior: 'callback',
        requestId: dto.requestId,
      };
    }

    return {
      allowed: false,
      reason:
        'No verified telephony transfer destination is configured for this organization',
      fallbackBehavior: 'callback',
      requestId: dto.requestId,
    };
  }

  async sendMessageOrCallbackRequest(
    organizationId: string,
    dto: SendMessageOrCallbackRequestDto,
  ): Promise<CallbackMessageResponseDto> {
    const business = await this.ensureBusinessInOrg(organizationId, dto.clientId);
    const idempotencyKey = `callback:${dto.requestId}`;
    const cached = this.idempotencyCache.get(idempotencyKey);
    if (cached) {
      return { ...cached.response as CallbackMessageResponseDto, status: 'request_recorded' };
    }

    const existing = await this.prisma.task.findFirst({
      where: {
        organizationId,
        title: { startsWith: dto.callbackRequested ? 'Callback Request:' : 'Message:' },
        description: { contains: dto.requestId },
      },
    });

    if (existing) {
      const response: CallbackMessageResponseDto = {
        messageId: existing.id,
        status: 'request_recorded',
        createdAt: existing.createdAt.toISOString(),
        requestId: dto.requestId,
      };
      this.idempotencyCache.set(idempotencyKey, { id: existing.id, requestId: dto.requestId, response, createdAt: new Date() });
      return response;
    }

    const ownerId = await this.getTaskOwnerId(organizationId);
    const message = await this.prisma.task.create({
      data: {
        organizationId,
        createdById: ownerId,
        title: dto.callbackRequested ? `Callback Request: ${dto.callerName}` : `Message: ${dto.callerName}`,
        description: `Business: ${business.name} (${business.id})\nPhone: ${dto.callerPhone}\nEmail: ${dto.callerEmail ?? 'N/A'}\nMessage: ${dto.message}\nCallback: ${dto.callbackRequested ? 'Yes' : 'No'}\nPreferred Time: ${dto.preferredCallbackTime ?? 'N/A'}\nUrgency: ${dto.urgency ?? CallbackUrgency.NORMAL}\nConversation: ${dto.conversationId}\nRequest: ${dto.requestId}`,
        status: 'OPEN',
        priority: this.mapCallbackUrgencyToPriority(dto.urgency),
        clientId: null,
        dueDate: dto.preferredCallbackTime ? new Date(dto.preferredCallbackTime) : undefined,
      },
    });

    await this.audit.record({
      organizationId,
      action: AuditAction.CREATE,
      entityType: dto.callbackRequested ? 'CallbackRequest' : 'InboundMessage',
      entityId: message.id,
      metadata: {
        businessId: business.id,
        requestId: dto.requestId,
        conversationId: dto.conversationId,
      },
    });

    const response: CallbackMessageResponseDto = {
      messageId: message.id,
      status: 'request_recorded',
      createdAt: message.createdAt.toISOString(),
      requestId: dto.requestId,
    };

    this.idempotencyCache.set(idempotencyKey, { id: message.id, requestId: dto.requestId, response, createdAt: new Date() });
    return response;
  }

  async logCallOutcome(
    organizationId: string,
    dto: LogCallOutcomeRequestDto,
  ): Promise<LogCallOutcomeResponseDto> {
    const business = await this.ensureBusinessInOrg(organizationId, dto.clientId);
    const idempotencyKey = `outcome:${dto.requestId}`;
    const cached = this.idempotencyCache.get(idempotencyKey);
    if (cached) {
      return { ...cached.response as LogCallOutcomeResponseDto, status: 'duplicate' };
    }

    const existing = await this.prisma.task.findFirst({
      where: {
        organizationId,
        title: { startsWith: 'Call Outcome:' },
        description: { contains: dto.requestId },
      },
    });

    if (existing) {
      const response: LogCallOutcomeResponseDto = {
        outcomeId: existing.id,
        status: 'duplicate',
        createdAt: existing.createdAt.toISOString(),
        requestId: dto.requestId,
      };
      this.idempotencyCache.set(idempotencyKey, { id: existing.id, requestId: dto.requestId, response, createdAt: new Date() });
      return response;
    }

    const ownerId = await this.getTaskOwnerId(organizationId);
    const outcome = await this.prisma.task.create({
      data: {
        organizationId,
        createdById: ownerId,
        title: `Call Outcome: ${dto.resolution}`,
        description: `Business: ${business.name} (${business.id})\nClient: ${dto.callerName}\nPhone: ${dto.callerPhone}\nEmail: ${dto.callerEmail ?? 'N/A'}\nIntent: ${dto.intent}\nService: ${dto.serviceInterest ?? 'N/A'}\nLead Quality: ${dto.leadQuality}\nUrgency: ${dto.urgency}\nAppointment Requested: ${dto.appointmentRequested}\nAppointment Created: ${dto.appointmentCreated}\nTransfer Requested: ${dto.transferRequested}\nTransfer Completed: ${dto.transferCompleted}\nCallback Requested: ${dto.callbackRequested}\nTool Errors: ${dto.toolErrors?.join(', ') ?? 'None'}\nResolution: ${dto.resolution}\nFollow-up: ${dto.followUpRequired}\nSummary: ${dto.callSummary}\nConversation: ${dto.conversationId}\nRequest: ${dto.requestId}`,
        status: 'COMPLETED',
        priority: this.mapOutcomeUrgencyToPriority(dto.urgency),
        clientId: null,
      },
    });

    await this.audit.record({
      organizationId,
      action: AuditAction.CREATE,
      entityType: 'CallOutcome',
      entityId: outcome.id,
      metadata: {
        businessId: business.id,
        requestId: dto.requestId,
        conversationId: dto.conversationId,
        resolution: dto.resolution,
      },
    });

    const response: LogCallOutcomeResponseDto = {
      outcomeId: outcome.id,
      status: 'logged',
      createdAt: outcome.createdAt.toISOString(),
      requestId: dto.requestId,
    };

    this.idempotencyCache.set(idempotencyKey, { id: outcome.id, requestId: dto.requestId, response, createdAt: new Date() });
    return response;
  }

  async getBusinessInformation(
    organizationId: string,
    dto: GetBusinessInformationRequestDto,
  ): Promise<BusinessInformationResponseDto> {
    const organization = await this.ensureBusinessInOrg(
      organizationId,
      dto.clientId,
    );
    const business = this.buildBusinessProfile(organization);
    return {
      clientId: business.clientId,
      businessName: business.businessName,
      businessType: business.businessType,
      greeting: business.greeting,
      phone: business.phone,
      location: business.location,
      businessHours: business.businessHours,
      timezone: business.timezone,
      services: business.services,
      faq: business.faq,
      transferNumbers: {},
      afterHoursBehavior: business.afterHoursBehavior,
      bookingEnabled: business.bookingEnabled,
      clientStatus: business.clientStatus,
    };
  }

  private mapUrgencyToPriority(urgency?: LeadUrgency): 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' {
    switch (urgency) {
      case LeadUrgency.EMERGENCY:
        return 'URGENT';
      case LeadUrgency.HIGH:
        return 'HIGH';
      case LeadUrgency.LOW:
        return 'LOW';
      default:
        return 'MEDIUM';
    }
  }

  private mapCallbackUrgencyToPriority(urgency?: CallbackUrgency): 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' {
    switch (urgency) {
      case CallbackUrgency.EMERGENCY:
        return 'URGENT';
      case CallbackUrgency.HIGH:
        return 'HIGH';
      case CallbackUrgency.LOW:
        return 'LOW';
      default:
        return 'MEDIUM';
    }
  }

  private mapOutcomeUrgencyToPriority(urgency: CallOutcomeUrgency): 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' {
    switch (urgency) {
      case CallOutcomeUrgency.EMERGENCY:
        return 'URGENT';
      case CallOutcomeUrgency.HIGH:
        return 'HIGH';
      case CallOutcomeUrgency.LOW:
        return 'LOW';
      default:
        return 'MEDIUM';
    }
  }
}
