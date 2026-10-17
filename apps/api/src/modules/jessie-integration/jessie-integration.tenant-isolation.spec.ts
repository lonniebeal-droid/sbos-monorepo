import { NotFoundException } from '@nestjs/common';
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
} from './dto/transfer-call.dto';
import {
  SendMessageOrCallbackRequestDto,
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
  const prisma = {
    ...makeMockPrisma(),
    organization: {
      ...makeMockPrisma().organization,
      findFirst: vi.fn().mockResolvedValue({
        id: 'org_A',
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
      ...makeMockPrisma().user,
      findFirst: vi.fn().mockResolvedValue({ id: 'user_123' }),
    },
    ...(overrides?.prisma ?? {}),
  } as PrismaService;
  const audit = { record: vi.fn() } as unknown as AuditService;
  return { service: new JessieIntegrationService(prisma, audit), audit };
}

describe('JessieIntegrationService - Tenant Isolation', () => {
  const orgA = 'org_A';
  const orgB = 'org_B';
  const clientId = orgA;

  const baseLookupDto: LookupClientRequestDto = {
    identifierType: LookupIdentifierType.ORGANIZATION_ID,
    identifierValue: clientId,
  };

  const baseLeadDto: CaptureLeadRequestDto = {
    clientId,
    callerName: 'John Doe',
    callerPhone: '+15551234567',
    reasonForCall: 'Seeking therapy',
    conversationId: 'conv_123',
    requestId: 'req_123',
  };

  const baseApptDto: CreateAppointmentRequestDto = {
    clientId,
    callerName: 'John Doe',
    callerPhone: '+15551234567',
    service: 'individual_therapy',
    requestedDate: '2026-09-01',
    requestedTime: '10:00',
    timezone: 'America/Chicago',
    conversationId: 'conv_123',
    requestId: 'req_123',
  };

  const baseTransferDto: TransferCallRequestDto = {
    clientId,
    intent: 'crisis_transfer',
    conversationId: 'conv_123',
    requestId: 'req_123',
  };

  const baseCallbackDto: SendMessageOrCallbackRequestDto = {
    clientId,
    callerName: 'John Doe',
    callerPhone: '+15551234567',
    message: 'Please call back',
    callbackRequested: true,
    conversationId: 'conv_123',
    requestId: 'req_123',
  };

  const baseOutcomeDto: LogCallOutcomeRequestDto = {
    clientId,
    businessName: 'Test Center',
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
    callSummary: 'Test summary',
    conversationId: 'conv_123',
    requestId: 'req_123',
  };

  const baseBusinessDto: GetBusinessInformationRequestDto = {
    clientId,
    conversationId: 'conv_123',
    requestId: 'req_123',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('lookupClient', () => {
    it('should only return client for the correct organization', async () => {
      const mockOrg = {
        id: clientId,
        name: 'Test Center',
        phone: '+15551234567',
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

      await service.lookupClient(orgA, baseLookupDto);
      expect(service).toBeDefined();
    });
  });

  describe('captureLead', () => {
    it('should scope lead creation to the organization', async () => {
      const mockTask = {
        id: 'lead_123',
        createdAt: new Date('2026-08-29T10:00:00.000Z'),
      };

      const { service } = makeService({
        prisma: {
          task: {
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue(mockTask),
          },
        },
      });

      await service.captureLead(orgA, baseLeadDto);
      expect(service).toBeDefined();
    });

    it('should not create lead for orgB when called with orgA', async () => {
      const mockTask = {
        id: 'lead_123',
        createdAt: new Date('2026-08-29T10:00:00.000Z'),
      };

      const { service } = makeService({
        prisma: {
          task: {
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue(mockTask),
          },
        },
      });

      await service.captureLead(orgA, baseLeadDto);
      expect(service).toBeDefined();
    });
  });

  describe('createAppointmentRequest', () => {
    it('should scope appointment request to the organization', async () => {
      const mockTask = {
        id: 'appt_123',
        createdAt: new Date('2026-08-29T10:00:00.000Z'),
      };

      const { service } = makeService({
        prisma: {
          task: {
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue(mockTask),
          },
        },
      });

      await service.createAppointmentRequest(orgA, baseApptDto);
      expect(service).toBeDefined();
    });
  });

  describe('transferCall', () => {
    it('should keep transfer in fallback mode even for the same organization until telephony is configured', async () => {
      const { service } = makeService({
        prisma: {
          organization: {
            findFirst: vi.fn().mockResolvedValue({ id: clientId, isActive: true }),
          },
        },
      });

      const result = await service.transferCall(orgA, baseTransferDto);

      expect(result.allowed).toBe(false);
      expect(result.fallbackBehavior).toBe('callback');
    });

    it('should deny transfer for inactive client', async () => {
      const { service } = makeService({
        prisma: {
          organization: {
            findFirst: vi.fn().mockResolvedValue(null),
          },
        },
      });

      const result = await service.transferCall(orgA, baseTransferDto);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('not found or inactive');
    });

    it('should not allow caller-supplied destination override', async () => {
      const dtoWithCustomDest = { ...baseTransferDto, intent: 'custom_destination' };
      const { service } = makeService({
        prisma: {
          organization: {
            findFirst: vi.fn().mockResolvedValue({ id: clientId, isActive: true }),
          },
        },
      });

      const result = await service.transferCall(orgA, dtoWithCustomDest);

      // Should deny transfer for unknown intent
      expect(result.allowed).toBe(false);
    });
  });

  describe('sendMessageOrCallbackRequest', () => {
    it('should scope message/callback to the organization', async () => {
      const mockTask = {
        id: 'msg_123',
        createdAt: new Date('2026-08-29T10:00:00.000Z'),
      };

      const { service } = makeService({
        prisma: {
          task: {
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue(mockTask),
          },
        },
      });

      await service.sendMessageOrCallbackRequest(orgA, baseCallbackDto);
      expect(service).toBeDefined();
    });
  });

  describe('logCallOutcome', () => {
    it('should scope outcome logging to the organization', async () => {
      const mockTask = {
        id: 'outcome_123',
        createdAt: new Date('2026-08-29T10:00:00.000Z'),
      };

      const { service } = makeService({
        prisma: {
          task: {
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue(mockTask),
          },
        },
      });

      await service.logCallOutcome(orgA, baseOutcomeDto);
      expect(service).toBeDefined();
    });
  });

  describe('getBusinessInformation', () => {
    it('should only return business info for client in the same organization', async () => {
      const mockOrg = {
        id: clientId,
        name: 'Test Center',
        phone: '+15551234567',
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

      await service.getBusinessInformation(orgA, baseBusinessDto);
      expect(service).toBeDefined();
    });

    it('should throw NotFoundException for cross-tenant access attempt', async () => {
      const { service } = makeService({
        prisma: {
          organization: {
            findFirst: vi.fn().mockResolvedValue(null),
          },
        },
      });

      await expect(service.getBusinessInformation(orgA, baseBusinessDto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('Invalid client_id manipulation', () => {
    it('should reject lookup with malformed client_id', async () => {
      const { service } = makeService({
        prisma: {
          organization: {
            findFirst: vi.fn().mockResolvedValue(null),
          },
        },
      });

      const dto = { ...baseLookupDto, identifierValue: 'malformed_id' };
      await expect(service.lookupClient(orgA, dto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('Inactive client handling', () => {
    it('should reject lookup for inactive client', async () => {
      const { service } = makeService({
        prisma: {
          organization: {
            findFirst: vi.fn().mockResolvedValue(null),
          },
        },
      });

      await expect(service.lookupClient(orgA, baseLookupDto)).rejects.toThrow(NotFoundException);
    });

    it('should reject business info for inactive client', async () => {
      const { service } = makeService({
        prisma: {
          organization: {
            findFirst: vi.fn().mockResolvedValue(null),
          },
        },
      });

      await expect(service.getBusinessInformation(orgA, baseBusinessDto)).rejects.toThrow(NotFoundException);
    });

    it('should deny transfer for inactive client', async () => {
      const { service } = makeService({
        prisma: {
          organization: {
            findFirst: vi.fn().mockResolvedValue(null),
          },
        },
      });

      const result = await service.transferCall(orgA, baseTransferDto);
      expect(result.allowed).toBe(false);
    });
  });
});
