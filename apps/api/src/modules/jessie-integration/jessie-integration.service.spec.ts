import { NotFoundException, ConflictException } from '@nestjs/common';
import { AuditAction } from '@sbos/database';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { JessieIntegrationService } from './jessie-integration.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { AuditService } from '../../audit/audit.service';
import {
  LookupClientRequestDto,
  LookupIdentifierType,
} from './dto/lookup-client.dto';
import {
  CaptureLeadRequestDto,
  LeadUrgency,
} from './dto/capture-lead.dto';
import {
  CreateAppointmentRequestDto,
} from './dto/appointment-request.dto';
import {
  TransferCallRequestDto,
  TransferUrgency,
} from './dto/transfer-call.dto';
import {
  SendMessageOrCallbackRequestDto,
  CallbackUrgency,
} from './dto/callback-message.dto';
import {
  LogCallOutcomeRequestDto,
  CallOutcomeResolution,
  CallOutcomeLeadQuality,
  CallOutcomeUrgency,
} from './dto/call-outcome.dto';
import {
  GetBusinessInformationRequestDto,
} from './dto/business-information.dto';

function makeMockPrisma(): PrismaService {
  return {
    organization: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      upsert: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
      groupBy: vi.fn(),
    },
    task: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      findFirstOrThrow: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      upsert: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
      groupBy: vi.fn(),
    },
    client: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      upsert: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
      groupBy: vi.fn(),
    },
    user: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      upsert: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
      groupBy: vi.fn(),
    },
    location: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      upsert: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
      groupBy: vi.fn(),
    },
    clinician: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      upsert: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
      groupBy: vi.fn(),
    },
    appointment: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      upsert: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
      groupBy: vi.fn(),
    },
    conversation: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      upsert: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
      groupBy: vi.fn(),
    },
    auditLog: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      upsert: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
      groupBy: vi.fn(),
    },
  } as unknown as PrismaService;
}

function makeService(overrides?: { prisma?: any }) {
  const prisma = { ...makeMockPrisma(), ...(overrides?.prisma ?? {}) } as PrismaService;
  const audit = { record: vi.fn() } as unknown as AuditService;
  return { service: new JessieIntegrationService(prisma, audit), audit };
}

describe('JessieIntegrationService', () => {
  let service: JessieIntegrationService;

  beforeEach(() => {
    ({ service } = makeService());
    vi.clearAllMocks();
  });

  describe('lookupClient', () => {
    const orgId = 'org_123';
    const clientId = orgId;

    it('should return client configuration when found by organization ID', async () => {
      const mockOrg = {
        id: clientId,
        name: 'Test Counseling Center',
        slug: 'test-counseling',
        phone: '+15551234567',
        email: 'frontdesk@test.example',
        addressLine1: '123 Main St',
        addressLine2: null,
        city: 'Springfield',
        state: 'IL',
        postalCode: '62701',
        timezone: 'America/New_York',
        locations: [
          {
            addressLine1: '123 Main St',
            addressLine2: null,
            city: 'Springfield',
            state: 'IL',
            postalCode: '62701',
          },
        ],
        isActive: true,
      };

      const { service } = makeService({
        prisma: {
          organization: {
            findFirst: vi.fn().mockResolvedValue(mockOrg),
          },
        },
      });

      const dto: LookupClientRequestDto = {
        identifierType: LookupIdentifierType.ORGANIZATION_ID,
        identifierValue: clientId,
        conversationId: 'conv_123',
        requestId: 'req_123',
      };

      const result = await service.lookupClient(orgId, dto);

      expect(result.clientId).toBe(clientId);
      expect(result.businessName).toBe('Test Counseling Center');
      expect(result.businessType).toBe('service_business');
      expect(result.phone).toBe('+15551234567');
      expect(result.bookingEnabled).toBe(false);
    });

    it('should return client configuration when found by slug', async () => {
      const mockOrg = {
        id: clientId,
        name: 'Test Counseling Center',
        slug: 'test-counseling',
        phone: '+15551234567',
        email: null,
        addressLine1: null,
        addressLine2: null,
        city: null,
        state: null,
        postalCode: null,
        timezone: 'America/New_York',
        locations: [],
        isActive: true,
      };

      const { service } = makeService({
        prisma: {
          organization: {
            findFirst: vi.fn().mockResolvedValue(mockOrg),
          },
        },
      });

      const dto: LookupClientRequestDto = {
        identifierType: LookupIdentifierType.CLIENT_SLUG,
        identifierValue: 'test-counseling',
      };

      const result = await service.lookupClient(orgId, dto);

      expect(result.clientId).toBe(clientId);
    });

    it('should allow inbound-number lookup only when it matches the authenticated organization phone', async () => {
      const mockOrg = {
        id: clientId,
        name: 'Test Counseling Center',
        slug: 'test-counseling',
        phone: '+1 (555) 123-4567',
        email: null,
        addressLine1: null,
        addressLine2: null,
        city: null,
        state: null,
        postalCode: null,
        timezone: 'America/New_York',
        locations: [],
        isActive: true,
      };

      const { service } = makeService({
        prisma: {
          organization: {
            findFirst: vi.fn().mockResolvedValue(mockOrg),
          },
        },
      });

      const result = await service.lookupClient(orgId, {
        identifierType: LookupIdentifierType.INBOUND_NUMBER,
        identifierValue: '+15551234567',
      });

      expect(result.clientId).toBe(clientId);
    });

    it('should throw NotFoundException when client not found', async () => {
      const { service } = makeService({
        prisma: {
          organization: {
            findFirst: vi.fn().mockResolvedValue(null),
          },
        },
      });

      const dto: LookupClientRequestDto = {
        identifierType: LookupIdentifierType.ORGANIZATION_ID,
        identifierValue: 'nonexistent',
      };

      await expect(service.lookupClient(orgId, dto)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException for unsupported metadata lookup', async () => {
      const { service } = makeService();

      const dto: LookupClientRequestDto = {
        identifierType: LookupIdentifierType.METADATA,
        identifierValue: 'some_metadata',
      };

      await expect(service.lookupClient(orgId, dto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('captureLead', () => {
    const orgId = 'org_123';
    const clientId = orgId;

    const baseDto: CaptureLeadRequestDto = {
      clientId,
      callerName: 'John Doe',
      callerPhone: '+15551234567',
      callerEmail: 'john@example.com',
      reasonForCall: 'Seeking therapy',
      serviceInterest: 'individual_therapy',
      urgency: LeadUrgency.NORMAL,
      notes: 'Test notes',
      conversationId: 'conv_123',
      requestId: 'req_123',
    };

    it('should create a new lead', async () => {
      const mockTask = {
        id: 'lead_123',
        createdAt: new Date('2026-08-29T10:00:00.000Z'),
      };

      const { service } = makeService({
        prisma: {
          organization: {
            findFirst: vi.fn().mockResolvedValue({
              id: clientId,
              name: 'Test Center',
              slug: 'test-center',
              phone: '+15551234567',
              email: null,
              addressLine1: null,
              addressLine2: null,
              city: null,
              state: null,
              postalCode: null,
              timezone: 'America/New_York',
              locations: [],
              isActive: true,
            }),
          },
          user: {
            findFirst: vi.fn().mockResolvedValue({ id: 'user_123' }),
          },
          task: {
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue(mockTask),
          },
        },
      });

      const result = await service.captureLead(orgId, baseDto);

      expect(result.leadId).toBe('lead_123');
      expect(result.status).toBe('created');
      expect(result.requestId).toBe('req_123');
      expect((service as any).prisma.task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            createdById: 'user_123',
            clientId: null,
          }),
        }),
      );
    });

    it('should return duplicate for same requestId', async () => {
      const mockTask = {
        id: 'lead_123',
        createdAt: new Date('2026-08-29T10:00:00.000Z'),
      };

      const { service } = makeService({
        prisma: {
          organization: {
            findFirst: vi.fn().mockResolvedValue({
              id: clientId,
              name: 'Test Center',
              slug: 'test-center',
              phone: '+15551234567',
              email: null,
              addressLine1: null,
              addressLine2: null,
              city: null,
              state: null,
              postalCode: null,
              timezone: 'America/New_York',
              locations: [],
              isActive: true,
            }),
          },
          task: {
            findFirst: vi.fn().mockResolvedValue(mockTask),
            create: vi.fn(),
          },
        },
      });

      const result = await service.captureLead(orgId, baseDto);

      expect(result.leadId).toBe('lead_123');
      expect(result.status).toBe('duplicate');
    });

    it('should use idempotency cache for duplicate requests', async () => {
      const mockTask = {
        id: 'lead_123',
        createdAt: new Date('2026-08-29T10:00:00.000Z'),
      };

      const { service } = makeService({
        prisma: {
          organization: {
            findFirst: vi.fn().mockResolvedValue({
              id: clientId,
              name: 'Test Center',
              slug: 'test-center',
              phone: '+15551234567',
              email: null,
              addressLine1: null,
              addressLine2: null,
              city: null,
              state: null,
              postalCode: null,
              timezone: 'America/New_York',
              locations: [],
              isActive: true,
            }),
          },
          user: {
            findFirst: vi.fn().mockResolvedValue({ id: 'user_123' }),
          },
          task: {
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue(mockTask),
          },
        },
      });

      await service.captureLead(orgId, baseDto);
      const result = await service.captureLead(orgId, baseDto);

      expect(result.status).toBe('duplicate');
    });
  });

  describe('createAppointmentRequest', () => {
    const orgId = 'org_123';
    const clientId = orgId;

    const baseDto: CreateAppointmentRequestDto = {
      clientId,
      callerName: 'John Doe',
      callerPhone: '+15551234567',
      service: 'individual_therapy',
      requestedDate: '2026-09-01',
      requestedTime: '10:00',
      timezone: 'America/Chicago',
      notes: 'Prefers morning',
      conversationId: 'conv_123',
      requestId: 'req_123',
    };

    it('should create a new appointment request', async () => {
      const mockTask = {
        id: 'appt_req_123',
        createdAt: new Date('2026-08-29T10:00:00.000Z'),
      };

      const { service } = makeService({
        prisma: {
          organization: {
            findFirst: vi.fn().mockResolvedValue({
              id: clientId,
              name: 'Test Center',
              slug: 'test-center',
              phone: '+15551234567',
              email: null,
              addressLine1: null,
              addressLine2: null,
              city: null,
              state: null,
              postalCode: null,
              timezone: 'America/New_York',
              locations: [],
              isActive: true,
            }),
          },
          user: {
            findFirst: vi.fn().mockResolvedValue({ id: 'user_123' }),
          },
          task: {
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue(mockTask),
          },
        },
      });

      const result = await service.createAppointmentRequest(orgId, baseDto);

      expect(result.appointmentRequestId).toBe('appt_req_123');
      expect(result.status).toBe('requested');
      expect(result.requestId).toBe('req_123');
    });

    it('should throw ConflictException for invalid date format', async () => {
      const { service } = makeService({
        prisma: {
          organization: {
            findFirst: vi.fn().mockResolvedValue({
              id: clientId,
              name: 'Test Center',
              slug: 'test-center',
              phone: '+15551234567',
              email: null,
              addressLine1: null,
              addressLine2: null,
              city: null,
              state: null,
              postalCode: null,
              timezone: 'America/New_York',
              locations: [],
              isActive: true,
            }),
          },
        },
      });

      const invalidDto = { ...baseDto, requestedDate: 'invalid-date' };

      await expect(service.createAppointmentRequest(orgId, invalidDto)).rejects.toThrow(ConflictException);
    });

    it('should return duplicate for same requestId', async () => {
      const mockTask = {
        id: 'appt_req_123',
        createdAt: new Date('2026-08-29T10:00:00.000Z'),
      };

      const { service } = makeService({
        prisma: {
          organization: {
            findFirst: vi.fn().mockResolvedValue({
              id: clientId,
              name: 'Test Center',
              slug: 'test-center',
              phone: '+15551234567',
              email: null,
              addressLine1: null,
              addressLine2: null,
              city: null,
              state: null,
              postalCode: null,
              timezone: 'America/New_York',
              locations: [],
              isActive: true,
            }),
          },
          task: {
            findFirst: vi.fn().mockResolvedValue(mockTask),
            create: vi.fn(),
          },
        },
      });

      const result = await service.createAppointmentRequest(orgId, baseDto);

      expect(result.status).toBe('requested');
    });
  });

  describe('transferCall', () => {
    const orgId = 'org_123';
    const clientId = orgId;

    const baseDto: TransferCallRequestDto = {
      clientId,
      intent: 'crisis_transfer',
      urgency: TransferUrgency.ROUTINE,
      conversationId: 'conv_123',
      requestId: 'req_123',
    };

    it('should deny transfer until a real destination is configured', async () => {
      const { service } = makeService({
        prisma: {
          organization: {
            findFirst: vi.fn().mockResolvedValue({
              id: clientId,
              name: 'Test Center',
              slug: 'test-center',
              phone: '+15551234567',
              email: null,
              addressLine1: null,
              addressLine2: null,
              city: null,
              state: null,
              postalCode: null,
              timezone: 'America/New_York',
              locations: [],
              isActive: true,
            }),
          },
        },
      });

      const result = await service.transferCall(orgId, baseDto);

      expect(result.allowed).toBe(false);
      expect(result.fallbackBehavior).toBe('callback');
      expect(result.reason).toContain('No verified telephony transfer destination');
    });

    it('should deny transfer when client not found', async () => {
      const { service } = makeService({
        prisma: {
          organization: {
            findFirst: vi.fn().mockResolvedValue(null),
          },
        },
      });

      const result = await service.transferCall(orgId, baseDto);

      expect(result.allowed).toBe(false);
      expect(result.fallbackBehavior).toBe('callback');
    });

    it('should keep emergency calls in fallback mode until transfer is truly configured', async () => {
      const { service } = makeService({
        prisma: {
          organization: {
            findFirst: vi.fn().mockResolvedValue({
              id: clientId,
              name: 'Test Center',
              slug: 'test-center',
              phone: '+15551234567',
              email: null,
              addressLine1: null,
              addressLine2: null,
              city: null,
              state: null,
              postalCode: null,
              timezone: 'America/New_York',
              locations: [],
              isActive: true,
            }),
          },
        },
      });

      const emergencyDto = { ...baseDto, urgency: TransferUrgency.EMERGENCY, intent: 'routine' };
      const result = await service.transferCall(orgId, emergencyDto);

      expect(result.allowed).toBe(false);
      expect(result.fallbackBehavior).toBe('callback');
    });
  });

  describe('sendMessageOrCallbackRequest', () => {
    const orgId = 'org_123';
    const clientId = orgId;

    const baseDto: SendMessageOrCallbackRequestDto = {
      clientId,
      callerName: 'John Doe',
      callerPhone: '+15551234567',
      callerEmail: 'john@example.com',
      message: 'Please call me back',
      callbackRequested: true,
      preferredCallbackTime: '2026-09-01T10:00:00Z',
      urgency: CallbackUrgency.NORMAL,
      conversationId: 'conv_123',
      requestId: 'req_123',
    };

    it('should create a callback request', async () => {
      const mockTask = {
        id: 'msg_123',
        createdAt: new Date('2026-08-29T10:00:00.000Z'),
      };

      const { service } = makeService({
        prisma: {
          organization: {
            findFirst: vi.fn().mockResolvedValue({
              id: clientId,
              name: 'Test Center',
              slug: 'test-center',
              phone: '+15551234567',
              email: null,
              addressLine1: null,
              addressLine2: null,
              city: null,
              state: null,
              postalCode: null,
              timezone: 'America/New_York',
              locations: [],
              isActive: true,
            }),
          },
          user: {
            findFirst: vi.fn().mockResolvedValue({ id: 'user_123' }),
          },
          task: {
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue(mockTask),
          },
        },
      });

      const result = await service.sendMessageOrCallbackRequest(orgId, baseDto);

      expect(result.messageId).toBe('msg_123');
      expect(result.status).toBe('request_recorded');
      expect(result.requestId).toBe('req_123');
    });

    it('should return duplicate for same requestId', async () => {
      const mockTask = {
        id: 'msg_123',
        createdAt: new Date('2026-08-29T10:00:00.000Z'),
      };

      const { service } = makeService({
        prisma: {
          organization: {
            findFirst: vi.fn().mockResolvedValue({
              id: clientId,
              name: 'Test Center',
              slug: 'test-center',
              phone: '+15551234567',
              email: null,
              addressLine1: null,
              addressLine2: null,
              city: null,
              state: null,
              postalCode: null,
              timezone: 'America/New_York',
              locations: [],
              isActive: true,
            }),
          },
          task: {
            findFirst: vi.fn().mockResolvedValue(mockTask),
            create: vi.fn(),
          },
        },
      });

      const result = await service.sendMessageOrCallbackRequest(orgId, baseDto);

      expect(result.status).toBe('request_recorded');
    });
  });

  describe('logCallOutcome', () => {
    const orgId = 'org_123';
    const clientId = orgId;

    const baseDto: LogCallOutcomeRequestDto = {
      clientId,
      businessName: 'Test Counseling Center',
      callerName: 'John Doe',
      callerPhone: '+15551234567',
      intent: 'therapy_inquiry',
      leadQuality: CallOutcomeLeadQuality.HIGH,
      urgency: CallOutcomeUrgency.NORMAL,
      appointmentRequested: false,
      appointmentCreated: false,
      transferRequested: false,
      transferCompleted: false,
      callbackRequested: true,
      resolution: CallOutcomeResolution.CALLBACK_SCHEDULED,
      followUpRequired: true,
      callSummary: 'Caller requested callback for tomorrow',
      conversationId: 'conv_123',
      requestId: 'req_123',
    };

    it('should log a call outcome', async () => {
      const mockTask = {
        id: 'outcome_123',
        createdAt: new Date('2026-08-29T10:00:00.000Z'),
      };

      const { service } = makeService({
        prisma: {
          organization: {
            findFirst: vi.fn().mockResolvedValue({
              id: clientId,
              name: 'Test Center',
              slug: 'test-center',
              phone: '+15551234567',
              email: null,
              addressLine1: null,
              addressLine2: null,
              city: null,
              state: null,
              postalCode: null,
              timezone: 'America/New_York',
              locations: [],
              isActive: true,
            }),
          },
          user: {
            findFirst: vi.fn().mockResolvedValue({ id: 'user_123' }),
          },
          task: {
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue(mockTask),
          },
        },
      });

      const result = await service.logCallOutcome(orgId, baseDto);

      expect(result.outcomeId).toBe('outcome_123');
      expect(result.status).toBe('logged');
      expect(result.requestId).toBe('req_123');
    });

    it('should return duplicate for same requestId', async () => {
      const mockTask = {
        id: 'outcome_123',
        createdAt: new Date('2026-08-29T10:00:00.000Z'),
      };

      const { service } = makeService({
        prisma: {
          organization: {
            findFirst: vi.fn().mockResolvedValue({
              id: clientId,
              name: 'Test Center',
              slug: 'test-center',
              phone: '+15551234567',
              email: null,
              addressLine1: null,
              addressLine2: null,
              city: null,
              state: null,
              postalCode: null,
              timezone: 'America/New_York',
              locations: [],
              isActive: true,
            }),
          },
          task: {
            findFirst: vi.fn().mockResolvedValue(mockTask),
            create: vi.fn(),
          },
        },
      });

      const result = await service.logCallOutcome(orgId, baseDto);

      expect(result.status).toBe('duplicate');
    });
  });

  describe('getBusinessInformation', () => {
    const orgId = 'org_123';
    const clientId = orgId;

    const baseDto: GetBusinessInformationRequestDto = {
      clientId,
      conversationId: 'conv_123',
      requestId: 'req_123',
    };

    it('should return business information', async () => {
      const mockOrg = {
        id: clientId,
        name: 'Test Counseling Center',
        slug: 'test-counseling',
        phone: '+15551234567',
        email: 'frontdesk@test.example',
        addressLine1: '123 Main St',
        addressLine2: null,
        city: 'Springfield',
        state: 'IL',
        postalCode: '62701',
        timezone: 'America/New_York',
        locations: [
          {
            addressLine1: '123 Main St',
            addressLine2: null,
            city: 'Springfield',
            state: 'IL',
            postalCode: '62701',
          },
        ],
        isActive: true,
      };

      const { service } = makeService({
        prisma: {
          organization: {
            findFirst: vi.fn().mockResolvedValue(mockOrg),
          },
        },
      });

      const result = await service.getBusinessInformation(orgId, baseDto);

      expect(result.clientId).toBe(clientId);
      expect(result.businessName).toBe('Test Counseling Center');
      expect(result.businessType).toBe('service_business');
      expect(result.bookingEnabled).toBe(false);
    });

    it('should throw NotFoundException when client not found', async () => {
      const { service } = makeService({
        prisma: {
          organization: {
            findFirst: vi.fn().mockResolvedValue(null),
          },
        },
      });

      await expect(service.getBusinessInformation(orgId, baseDto)).rejects.toThrow(NotFoundException);
    });
  });
});
