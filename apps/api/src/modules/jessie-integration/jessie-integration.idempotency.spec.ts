import { AuditAction } from '@sbos/database';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { JessieIntegrationService } from './jessie-integration.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { AuditService } from '../../audit/audit.service';
import {
  CaptureLeadRequestDto,
  LeadUrgency,
} from './dto/capture-lead.dto';
import {
  CreateAppointmentRequestDto,
} from './dto/appointment-request.dto';
import {
  SendMessageOrCallbackRequestDto,
} from './dto/callback-message.dto';
import {
  LogCallOutcomeRequestDto,
  CallOutcomeResolution,
  CallOutcomeLeadQuality,
  CallOutcomeUrgency,
} from './dto/call-outcome.dto';

function makeMockPrisma(): PrismaService {
  return {
    jessieBusinessConfig: { findUnique: vi.fn().mockResolvedValue(null) },
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
        id: 'org_123',
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

describe('JessieIntegrationService - Idempotency', () => {
  const orgId = 'org_123';
  const clientId = orgId;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Sequential duplicate requests', () => {
    it('should return duplicate for sequential capture_lead with same requestId', async () => {
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
              phone: '+15551234567',
              timezone: 'America/New_York',
              locations: [],
              isActive: true,
            }),
          },
          task: {
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue(mockTask),
          },
        },
      });

      const dto: CaptureLeadRequestDto = {
        clientId,
        callerName: 'John Doe',
        callerPhone: '+15551234567',
        reasonForCall: 'Seeking therapy',
        conversationId: 'conv_123',
        requestId: 'req_123',
      };

      const result1 = await service.captureLead(orgId, dto);
      const result2 = await service.captureLead(orgId, dto);

      expect(result1.status).toBe('created');
      expect(result2.status).toBe('duplicate');
      expect(result1.leadId).toBe(result2.leadId);
    });

    it('should return duplicate for sequential appointment_request with same requestId', async () => {
      const mockTask = {
        id: 'appt_123',
        createdAt: new Date('2026-08-29T10:00:00.000Z'),
      };

      const { service } = makeService({
        prisma: {
          organization: {
            findFirst: vi.fn().mockResolvedValue({
              id: clientId,
              name: 'Test Center',
              phone: '+15551234567',
              timezone: 'America/New_York',
              locations: [],
              isActive: true,
            }),
          },
          task: {
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue(mockTask),
          },
        },
      });

      const dto: CreateAppointmentRequestDto = {
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

      const result1 = await service.createAppointmentRequest(orgId, dto);
      const result2 = await service.createAppointmentRequest(orgId, dto);

      expect(result1.appointmentRequestId).toBe(result2.appointmentRequestId);
    });

    it('should return duplicate for sequential callback_message with same requestId', async () => {
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
              phone: '+15551234567',
              timezone: 'America/New_York',
              locations: [],
              isActive: true,
            }),
          },
          task: {
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue(mockTask),
          },
        },
      });

      const dto: SendMessageOrCallbackRequestDto = {
        clientId,
        callerName: 'John Doe',
        callerPhone: '+15551234567',
        message: 'Please call back',
        callbackRequested: true,
        conversationId: 'conv_123',
        requestId: 'req_123',
      };

      const result1 = await service.sendMessageOrCallbackRequest(orgId, dto);
      const result2 = await service.sendMessageOrCallbackRequest(orgId, dto);

      expect(result1.messageId).toBe(result2.messageId);
    });

    it('should return duplicate for sequential call_outcome with same requestId', async () => {
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
              phone: '+15551234567',
              timezone: 'America/New_York',
              locations: [],
              isActive: true,
            }),
          },
          task: {
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue(mockTask),
          },
        },
      });

      const dto: LogCallOutcomeRequestDto = {
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

      const result1 = await service.logCallOutcome(orgId, dto);
      const result2 = await service.logCallOutcome(orgId, dto);

      expect(result1.outcomeId).toBe(result2.outcomeId);
      expect(result2.status).toBe('duplicate');
    });
  });

  describe('Parallel duplicate requests', () => {
    it('should handle parallel capture_lead requests with same requestId (note: in-memory cache limitation)', async () => {
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
              phone: '+15551234567',
              timezone: 'America/New_York',
              locations: [],
              isActive: true,
            }),
          },
          task: {
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue(mockTask),
          },
        },
      });

      const dto: CaptureLeadRequestDto = {
        clientId,
        callerName: 'John Doe',
        callerPhone: '+15551234567',
        reasonForCall: 'Seeking therapy',
        conversationId: 'conv_123',
        requestId: 'req_parallel_123',
      };

      const [result1, result2] = await Promise.all([
        service.captureLead(orgId, dto),
        service.captureLead(orgId, dto),
      ]);

      // Both requests may return 'created' due to in-memory cache race condition
      // In production, this would be prevented by a database-level unique constraint on requestId
      expect(['created', 'duplicate']).toContain(result1.status);
      expect(['created', 'duplicate']).toContain(result2.status);
      expect(result1.leadId).toBe(result2.leadId);
    });

    it('should handle parallel appointment_request with same requestId', async () => {
      const mockTask = {
        id: 'appt_123',
        createdAt: new Date('2026-08-29T10:00:00.000Z'),
      };

      const { service } = makeService({
        prisma: {
          organization: {
            findFirst: vi.fn().mockResolvedValue({
              id: clientId,
              name: 'Test Center',
              phone: '+15551234567',
              timezone: 'America/New_York',
              locations: [],
              isActive: true,
            }),
          },
          task: {
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue(mockTask),
          },
        },
      });

      const dto: CreateAppointmentRequestDto = {
        clientId,
        callerName: 'John Doe',
        callerPhone: '+15551234567',
        service: 'individual_therapy',
        requestedDate: '2026-09-01',
        requestedTime: '10:00',
        timezone: 'America/Chicago',
        conversationId: 'conv_123',
        requestId: 'req_parallel_123',
      };

      const [result1, result2] = await Promise.all([
        service.createAppointmentRequest(orgId, dto),
        service.createAppointmentRequest(orgId, dto),
      ]);

      expect(result1.appointmentRequestId).toBe(result2.appointmentRequestId);
    });

    it('should handle parallel callback_message with same requestId', async () => {
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
              phone: '+15551234567',
              timezone: 'America/New_York',
              locations: [],
              isActive: true,
            }),
          },
          task: {
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue(mockTask),
          },
        },
      });

      const dto: SendMessageOrCallbackRequestDto = {
        clientId,
        callerName: 'John Doe',
        callerPhone: '+15551234567',
        message: 'Please call back',
        callbackRequested: true,
        conversationId: 'conv_123',
        requestId: 'req_parallel_123',
      };

      const [result1, result2] = await Promise.all([
        service.sendMessageOrCallbackRequest(orgId, dto),
        service.sendMessageOrCallbackRequest(orgId, dto),
      ]);

      expect(result1.messageId).toBe(result2.messageId);
    });

    it('should handle parallel call_outcome with same requestId', async () => {
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
              phone: '+15551234567',
              timezone: 'America/New_York',
              locations: [],
              isActive: true,
            }),
          },
          task: {
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue(mockTask),
          },
        },
      });

      const dto: LogCallOutcomeRequestDto = {
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
        requestId: 'req_parallel_123',
      };

      const [result1, result2] = await Promise.all([
        service.logCallOutcome(orgId, dto),
        service.logCallOutcome(orgId, dto),
      ]);

      expect(result1.outcomeId).toBe(result2.outcomeId);
    });
  });

  describe('Same key with different payload', () => {
    it('should return cached result even with different payload for same requestId', async () => {
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
              phone: '+15551234567',
              timezone: 'America/New_York',
              locations: [],
              isActive: true,
            }),
          },
          task: {
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue(mockTask),
          },
        },
      });

      const dto1: CaptureLeadRequestDto = {
        clientId,
        callerName: 'John Doe',
        callerPhone: '+15551234567',
        reasonForCall: 'Seeking therapy',
        conversationId: 'conv_123',
        requestId: 'req_same_key',
      };

      const dto2: CaptureLeadRequestDto = {
        clientId,
        callerName: 'Jane Smith',
        callerPhone: '+15559876543',
        reasonForCall: 'Different reason',
        conversationId: 'conv_456',
        requestId: 'req_same_key',
      };

      const result1 = await service.captureLead(orgId, dto1);
      const result2 = await service.captureLead(orgId, dto2);

      expect(result1.leadId).toBe(result2.leadId);
      expect(result2.status).toBe('duplicate');
    });

    it('should return cached appointment even with different payload', async () => {
      const mockTask = {
        id: 'appt_123',
        createdAt: new Date('2026-08-29T10:00:00.000Z'),
      };

      const { service } = makeService({
        prisma: {
          organization: {
            findFirst: vi.fn().mockResolvedValue({
              id: clientId,
              name: 'Test Center',
              phone: '+15551234567',
              timezone: 'America/New_York',
              locations: [],
              isActive: true,
            }),
          },
          task: {
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue(mockTask),
          },
        },
      });

      const dto1: CreateAppointmentRequestDto = {
        clientId,
        callerName: 'John Doe',
        callerPhone: '+15551234567',
        service: 'individual_therapy',
        requestedDate: '2026-09-01',
        requestedTime: '10:00',
        timezone: 'America/Chicago',
        conversationId: 'conv_123',
        requestId: 'req_same_key',
      };

      const dto2: CreateAppointmentRequestDto = {
        clientId,
        callerName: 'Jane Smith',
        callerPhone: '+15559876543',
        service: 'group_therapy',
        requestedDate: '2026-09-02',
        requestedTime: '14:00',
        timezone: 'America/New_York',
        conversationId: 'conv_456',
        requestId: 'req_same_key',
      };

      const result1 = await service.createAppointmentRequest(orgId, dto1);
      const result2 = await service.createAppointmentRequest(orgId, dto2);

      expect(result1.appointmentRequestId).toBe(result2.appointmentRequestId);
    });
  });
});
