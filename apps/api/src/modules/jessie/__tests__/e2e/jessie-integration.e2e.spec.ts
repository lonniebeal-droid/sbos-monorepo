import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { describe, expect, it, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';

import { JessieIntegrationController } from '../../jessie-integration.controller';
import { JessieIntegrationService } from '../../jessie-integration.service';
import { JessieAuthGuard } from '../../jessie-auth.guard';
import { PrismaService } from '../../../../prisma/prisma.service';
import { AuditService } from '../../../../audit/audit.service';
import { SMS_PROVIDER } from '../../../../channels/sms.provider';
import { EMAIL_PROVIDER } from '../../../../channels/email.provider';
import { ConfigService } from '@nestjs/config';

import {
  lookupClientFixtures,
  captureLeadFixtures,
  createOrRequestAppointmentFixtures,
  transferCallFixtures,
  sendMessageOrCallbackFixtures,
  logCallOutcomeFixtures,
  getBusinessInformationFixtures,
  elevenLabsStyleFixtures,
  authFixtures,
  makeEventFixtures,
  VALID_ORG_ID,
  VALID_CLIENT_ID,
  VALID_CONVERSATION_ID,
  VALID_CLINICIAN_ID,
  VALID_OTHER_ORG_ID,
  VALID_SERVICE_SECRET,
} from '../fixtures/jessie-request.fixtures';
import { MockMakeWebhookReceiver, makeEventShapeValidator } from '../mocks/mock-make-webhook';
import {
  LookupClientRequestDto,
  CaptureLeadRequestDto,
  CreateOrRequestAppointmentRequestDto,
  TransferCallRequestDto,
  SendMessageOrCallbackRequestDto,
  LogCallOutcomeRequestDto,
  CallOutcomeEnum,
  TransferTargetEnum,
  MakeEventDto,
} from '../../dto/jessie-integration.dto';

const mockPrisma = {
  client: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
  },
  lead: {
    create: vi.fn(),
    findUnique: vi.fn(),
  },
  appointment: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
  },
  clinician: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
  },
  conversation: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  callTransfer: {
    create: vi.fn(),
  },
  callbackRequest: {
    create: vi.fn(),
    findUnique: vi.fn(),
  },
  callLog: {
    create: vi.fn(),
    findUnique: vi.fn(),
  },
  organization: {
    findUnique: vi.fn(),
  },
  idempotencyKey: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  auditLog: {
    create: vi.fn(),
  },
};

const mockAuditService = {
  record: vi.fn().mockResolvedValue({}),
};

const mockSmsProvider = {
  send: vi.fn().mockResolvedValue({}),
};

const mockEmailProvider = {
  send: vi.fn().mockResolvedValue({}),
};

const mockChatProvider = {
  generateReply: vi.fn().mockResolvedValue({ content: 'Mock reply', provider: 'mock' }),
};

const mockConfigService = {
  get: vi.fn((key: string) => {
    if (key === 'JESSIE_SERVICE_SECRET') return VALID_SERVICE_SECRET;
    return undefined;
  }),
};

let app: INestApplication;
let mockMakeReceiver: MockMakeWebhookReceiver;
let moduleRef: TestingModule;

async function createTestModule(overrides?: {
  prisma?: typeof mockPrisma;
  config?: typeof mockConfigService;
}): Promise<TestingModule> {
  const prisma = overrides?.prisma ?? mockPrisma;
  const config = overrides?.config ?? mockConfigService;

  vi.resetAllMocks();

  prisma.client.findFirst.mockResolvedValue(null);
  prisma.lead.create.mockResolvedValue({ id: 'lead-1' });
  prisma.lead.findUnique.mockResolvedValue({ id: 'lead-1' });
  prisma.appointment.create.mockResolvedValue({
    id: 'appt-1',
    status: 'SCHEDULED',
    startTime: new Date('2026-09-15T10:00:00.000Z'),
  });
  prisma.appointment.findFirst.mockResolvedValue(null);
  prisma.appointment.findUnique.mockResolvedValue({
    id: 'appt-1',
    status: 'SCHEDULED',
    startTime: new Date('2026-09-15T10:00:00.000Z'),
  });
  prisma.clinician.findFirst.mockResolvedValue({ id: VALID_CLINICIAN_ID });
  prisma.clinician.findUnique.mockResolvedValue({ id: VALID_CLINICIAN_ID });
  prisma.conversation.findFirst.mockResolvedValue({
    id: VALID_CONVERSATION_ID,
    clientId: VALID_CLIENT_ID,
  });
  prisma.conversation.findUnique.mockResolvedValue({
    id: VALID_CONVERSATION_ID,
    clientId: VALID_CLIENT_ID,
  });
  prisma.callTransfer.create.mockResolvedValue({ id: 'transfer-1' });
  prisma.callbackRequest.create.mockResolvedValue({ id: 'cb-1' });
  prisma.callbackRequest.findUnique.mockResolvedValue({ id: 'cb-1', status: 'QUEUED' });
  prisma.callLog.create.mockResolvedValue({ id: 'log-1' });
  prisma.callLog.findUnique.mockResolvedValue({ id: 'log-1' });
  prisma.organization.findUnique.mockResolvedValue({
    id: VALID_ORG_ID,
    name: 'Test Org',
    phone: '+15551234567',
    email: 'info@test.org',
    addressLine1: '123 Main St',
    addressLine2: 'Suite 100',
    city: 'City',
    state: 'ST',
    postalCode: '12345',
    timezone: 'America/New_York',
    isActive: true,
  });
  prisma.idempotencyKey.findUnique.mockResolvedValue(null);
  prisma.idempotencyKey.create.mockResolvedValue({});
  prisma.auditLog.create.mockResolvedValue({});

  const module = await Test.createTestingModule({
    controllers: [JessieIntegrationController],
    providers: [
      JessieIntegrationService,
      { provide: PrismaService, useValue: prisma },
      { provide: AuditService, useValue: mockAuditService },
      { provide: SMS_PROVIDER, useValue: mockSmsProvider },
      { provide: EMAIL_PROVIDER, useValue: mockEmailProvider },
      { provide: ConfigService, useValue: config },
    ],
  }).compile();

  return module;
}

function setupApp(module: TestingModule): INestApplication {
  const application = module.createNestApplication();
  application.setGlobalPrefix('api');
  application.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  application.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      errorHttpStatusCode: 400,
    })
  );
  return application;
}

describe('JessieIntegrationController - E2E Tests', () => {
  beforeAll(async () => {
    moduleRef = await createTestModule();
    app = setupApp(moduleRef);
    await app.init();
    mockMakeReceiver = new MockMakeWebhookReceiver();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockMakeReceiver.clear();
    mockPrisma.client.findFirst.mockResolvedValue({
      id: VALID_CLIENT_ID,
      firstName: 'John',
      lastName: 'Doe',
      preferredName: 'Jon',
      mrn: 'MRN-123',
      phone: '+15551234567',
      email: 'john@example.com',
      status: 'ACTIVE',
      primaryClinicianId: VALID_CLINICIAN_ID,
    });
    mockPrisma.organization.findUnique.mockResolvedValue({
      id: VALID_ORG_ID,
      name: 'Test Org',
      phone: '+15551234567',
      email: 'info@test.org',
      addressLine1: '123 Main St',
      addressLine2: 'Suite 100',
      city: 'City',
      state: 'ST',
      postalCode: '12345',
      timezone: 'America/New_York',
      isActive: true,
    });
    mockPrisma.idempotencyKey.findUnique.mockResolvedValue(null);
    mockPrisma.idempotencyKey.create.mockResolvedValue({});
    mockPrisma.auditLog.create.mockResolvedValue({});
    mockPrisma.lead.create.mockResolvedValue({ id: 'lead-1' });
    mockPrisma.lead.findUnique.mockResolvedValue({ id: 'lead-1' });
    mockPrisma.appointment.create.mockResolvedValue({
      id: 'appt-1',
      status: 'SCHEDULED',
      startTime: new Date('2026-09-15T10:00:00.000Z'),
    });
    mockPrisma.appointment.findFirst.mockResolvedValue(null);
    mockPrisma.appointment.findUnique.mockResolvedValue({
      id: 'appt-1',
      status: 'SCHEDULED',
      startTime: new Date('2026-09-15T10:00:00.000Z'),
    });
    mockPrisma.clinician.findFirst.mockResolvedValue({ id: VALID_CLINICIAN_ID, isAcceptingNewClients: true });
    mockPrisma.clinician.findUnique.mockResolvedValue({ id: VALID_CLINICIAN_ID });
    mockPrisma.conversation.findFirst.mockResolvedValue({
      id: VALID_CONVERSATION_ID,
      clientId: VALID_CLIENT_ID,
    });
    mockPrisma.conversation.findUnique.mockResolvedValue({
      id: VALID_CONVERSATION_ID,
      clientId: VALID_CLIENT_ID,
    });
    mockPrisma.callTransfer.create.mockResolvedValue({ id: 'transfer-1' });
    mockPrisma.callbackRequest.create.mockResolvedValue({ id: 'cb-1', status: 'QUEUED' });
    mockPrisma.callbackRequest.findUnique.mockResolvedValue({ id: 'cb-1', status: 'QUEUED' });
    mockPrisma.callLog.create.mockResolvedValue({ id: 'log-1' });
    mockPrisma.callLog.findUnique.mockResolvedValue({ id: 'log-1' });
  });

  function makeRequest(endpoint: string, method: 'get' | 'post' = 'post', body?: any, headers?: Record<string, string>) {
    const req = request(app.getHttpServer())[method](`/api/v1/jessie/integration/${endpoint}`);
    if (headers) {
      req.set(headers);
    }
    if (body) {
      req.send(body);
    }
    return req;
  }

  describe('Authentication & Authorization', () => {
    describe('Missing Authentication', () => {
      it('lookup-client: rejects request with no Authorization header', async () => {
        const res = await makeRequest('lookup-client', 'post', lookupClientFixtures.valid(), authFixtures.missingAuthHeader());
        expect(res.status).toBe(401);
        expect(res.body.message).toContain('Missing Authorization header');
      });

      it('capture-lead: rejects request with no Authorization header', async () => {
        const res = await makeRequest('capture-lead', 'post', captureLeadFixtures.valid(), authFixtures.missingAuthHeader());
        expect(res.status).toBe(401);
      });

      it('create-or-request-appointment: rejects request with no Authorization header', async () => {
        const res = await makeRequest('create-or-request-appointment', 'post', createOrRequestAppointmentFixtures.valid(), authFixtures.missingAuthHeader());
        expect(res.status).toBe(401);
      });

      it('transfer-call: rejects request with no Authorization header', async () => {
        const res = await makeRequest('transfer-call', 'post', transferCallFixtures.valid(), authFixtures.missingAuthHeader());
        expect(res.status).toBe(401);
      });

      it('send-message-or-callback-request: rejects request with no Authorization header', async () => {
        const res = await makeRequest('send-message-or-callback-request', 'post', sendMessageOrCallbackFixtures.valid(), authFixtures.missingAuthHeader());
        expect(res.status).toBe(401);
      });

      it('log-call-outcome: rejects request with no Authorization header', async () => {
        const res = await makeRequest('log-call-outcome', 'post', logCallOutcomeFixtures.valid(), authFixtures.missingAuthHeader());
        expect(res.status).toBe(401);
      });

      it('get-business-information: rejects request with no Authorization header', async () => {
        const res = await makeRequest('business-information', 'get', undefined, authFixtures.missingAuthHeader());
        expect(res.status).toBe(401);
      });
    });

    describe('Invalid Authentication', () => {
      it('rejects request with invalid Bearer token', async () => {
        const res = await makeRequest('lookup-client', 'post', lookupClientFixtures.valid(), authFixtures.invalidToken());
        expect(res.status).toBe(401);
        expect(res.body.message).toContain('Invalid service credentials');
      });

      it('rejects request with wrong auth scheme', async () => {
        const res = await makeRequest('lookup-client', 'post', lookupClientFixtures.valid(), authFixtures.invalidScheme());
        expect(res.status).toBe(401);
        expect(res.body.message).toContain('Invalid Authorization header format');
      });

      it('rejects request with missing X-Organization-Id header', async () => {
        const res = await makeRequest('lookup-client', 'post', lookupClientFixtures.valid(), authFixtures.missingOrgHeader());
        expect(res.status).toBe(401);
        expect(res.body.message).toContain('Missing X-Organization-Id header');
      });

      it('rejects request with invalid organization ID', async () => {
        mockPrisma.organization.findUnique.mockResolvedValue(null);
        const res = await makeRequest('lookup-client', 'post', lookupClientFixtures.valid(), authFixtures.invalidOrg());
        expect(res.status).toBe(401);
        expect(res.body.message).toContain('Invalid or inactive organization');
      });

      it('rejects request with inactive organization', async () => {
        mockPrisma.organization.findUnique.mockResolvedValue({ id: VALID_ORG_ID, isActive: false });
        const res = await makeRequest('lookup-client', 'post', lookupClientFixtures.valid(), authFixtures.validHeaders());
        expect(res.status).toBe(401);
        expect(res.body.message).toContain('Invalid or inactive organization');
      });
    });
  });

  describe('Tenant Isolation / Wrong Tenant', () => {
    const validHeaders = authFixtures.validHeaders();

    it('lookup-client: cannot access client from different organization', async () => {
      mockPrisma.client.findFirst.mockResolvedValue(null);
      const res = await makeRequest('lookup-client', 'post', lookupClientFixtures.wrongTenantClientId(), validHeaders);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Client not found');
      expect(mockPrisma.client.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organizationId: VALID_ORG_ID }),
        })
      );
    });

    it('capture-lead: creates lead only in authenticated organization', async () => {
      const res = await makeRequest('capture-lead', 'post', captureLeadFixtures.valid(), validHeaders);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockPrisma.lead.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ organizationId: VALID_ORG_ID }),
        })
      );
    });

    it('create-or-request-appointment: cannot use client from different organization', async () => {
      mockPrisma.client.findFirst.mockResolvedValue(null);
      const res = await makeRequest(
        'create-or-request-appointment',
        'post',
        createOrRequestAppointmentFixtures.wrongTenantClientId(),
        validHeaders
      );
      expect(res.status).toBe(404);
      expect(res.body.message).toContain('Client');
      expect(res.body.message).toContain('not found');
    });

    it('create-or-request-appointment: cannot use clinician from different organization', async () => {
      mockPrisma.client.findFirst.mockResolvedValue({ id: VALID_CLIENT_ID });
      mockPrisma.clinician.findFirst.mockResolvedValue(null);
      const res = await makeRequest(
        'create-or-request-appointment',
        'post',
        createOrRequestAppointmentFixtures.wrongTenantClinicianId(),
        validHeaders
      );
      expect(res.status).toBe(404);
      expect(res.body.message).toContain('Clinician');
      expect(res.body.message).toContain('not found');
    });

    it('transfer-call: cannot access conversation from different organization', async () => {
      mockPrisma.conversation.findFirst.mockResolvedValue(null);
      const res = await makeRequest('transfer-call', 'post', transferCallFixtures.wrongTenantConversationId(), validHeaders);
      expect(res.status).toBe(404);
      expect(res.body.message).toContain('Conversation');
      expect(res.body.message).toContain('not found');
    });

    it('send-message-or-callback-request: cannot use client from different organization', async () => {
      mockPrisma.client.findFirst.mockResolvedValue(null);
      const res = await makeRequest('send-message-or-callback-request', 'post', sendMessageOrCallbackFixtures.wrongTenantClientId(), validHeaders);
      expect(res.status).toBe(404);
      expect(res.body.message).toContain('Client');
      expect(res.body.message).toContain('not found');
    });

    it('log-call-outcome: cannot access conversation from different organization', async () => {
      mockPrisma.conversation.findFirst.mockResolvedValue(null);
      const res = await makeRequest('log-call-outcome', 'post', logCallOutcomeFixtures.wrongTenantConversationId(), validHeaders);
      expect(res.status).toBe(404);
      expect(res.body.message).toContain('Conversation');
      expect(res.body.message).toContain('not found');
    });

    it('get-business-information: returns only authenticated organization info', async () => {
      const res = await makeRequest('business-information', 'get', undefined, validHeaders);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Test Org');
      expect(mockPrisma.organization.findUnique).toHaveBeenCalledWith({
        where: { id: VALID_ORG_ID },
        select: expect.any(Object),
      });
    });
  });

  describe('Validation - Malformed Payload & Required Fields', () => {
    const validHeaders = authFixtures.validHeaders();

    describe('lookup-client', () => {
      it('rejects missing clientId', async () => {
        const res = await makeRequest('lookup-client', 'post', {}, validHeaders);
        expect(res.status).toBe(400);
        expect(res.body.message).toContain('clientId');
      });

      it('rejects invalid UUID for clientId', async () => {
        const res = await makeRequest('lookup-client', 'post', lookupClientFixtures.invalidClientId(), validHeaders);
        expect(res.status).toBe(400);
      });

      it('accepts optional mrn', async () => {
        const res = await makeRequest('lookup-client', 'post', lookupClientFixtures.withMrn(), validHeaders);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
      });

      it('accepts optional phone', async () => {
        const res = await makeRequest('lookup-client', 'post', lookupClientFixtures.withPhone(), validHeaders);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
      });
    });

    describe('capture-lead', () => {
      it('rejects missing firstName', async () => {
        const res = await makeRequest('capture-lead', 'post', captureLeadFixtures.missingFirstName(), validHeaders);
        expect(res.status).toBe(400);
      });

      it('rejects missing lastName', async () => {
        const res = await makeRequest('capture-lead', 'post', captureLeadFixtures.missingLastName(), validHeaders);
        expect(res.status).toBe(400);
      });

      it('rejects missing idempotencyKey', async () => {
        const res = await makeRequest('capture-lead', 'post', captureLeadFixtures.missingIdempotencyKey(), validHeaders);
        expect(res.status).toBe(400);
      });

      it('rejects empty firstName', async () => {
        const res = await makeRequest('capture-lead', 'post', captureLeadFixtures.emptyFirstName(), validHeaders);
        expect(res.status).toBe(400);
      });

      it('rejects empty lastName', async () => {
        const res = await makeRequest('capture-lead', 'post', captureLeadFixtures.emptyLastName(), validHeaders);
        expect(res.status).toBe(400);
      });

      it('accepts optional phone', async () => {
        const res = await makeRequest('capture-lead', 'post', captureLeadFixtures.withPhone(), validHeaders);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
      });

      it('accepts optional email', async () => {
        const res = await makeRequest('capture-lead', 'post', captureLeadFixtures.withEmail(), validHeaders);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
      });

      it('accepts optional reason', async () => {
        const res = await makeRequest('capture-lead', 'post', captureLeadFixtures.withReason(), validHeaders);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
      });

      it('accepts optional source', async () => {
        const res = await makeRequest('capture-lead', 'post', captureLeadFixtures.withSource(), validHeaders);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
      });
    });

    describe('create-or-request-appointment', () => {
      it('rejects missing clientId', async () => {
        const res = await makeRequest('create-or-request-appointment', 'post', createOrRequestAppointmentFixtures.missingClientId(), validHeaders);
        expect(res.status).toBe(400);
      });

      it('rejects missing type', async () => {
        const res = await makeRequest('create-or-request-appointment', 'post', createOrRequestAppointmentFixtures.missingType(), validHeaders);
        expect(res.status).toBe(400);
      });

      it('rejects missing preferredStartTime', async () => {
        const res = await makeRequest('create-or-request-appointment', 'post', createOrRequestAppointmentFixtures.missingPreferredStartTime(), validHeaders);
        expect(res.status).toBe(400);
      });

      it('rejects missing idempotencyKey', async () => {
        const res = await makeRequest('create-or-request-appointment', 'post', createOrRequestAppointmentFixtures.missingIdempotencyKey(), validHeaders);
        expect(res.status).toBe(400);
      });

      it('rejects invalid UUID for clientId', async () => {
        const res = await makeRequest('create-or-request-appointment', 'post', createOrRequestAppointmentFixtures.invalidClientId(), validHeaders);
        expect(res.status).toBe(400);
      });

      it('rejects invalid date format for preferredStartTime', async () => {
        const res = await makeRequest('create-or-request-appointment', 'post', createOrRequestAppointmentFixtures.invalidPreferredStartTime(), validHeaders);
        expect(res.status).toBe(400);
      });

      it('accepts all valid appointment types', async () => {
        const types = ['INTAKE', 'INDIVIDUAL', 'GROUP', 'FAMILY', 'COUPLES', 'MEDICATION_MANAGEMENT', 'ASSESSMENT', 'TELEHEALTH', 'CONSULTATION'];
        for (const type of types) {
          const res = await makeRequest(
            'create-or-request-appointment',
            'post',
            { ...createOrRequestAppointmentFixtures.valid(), type: type as any, idempotencyKey: `idem-${type.toLowerCase()}` },
            validHeaders
          );
          expect(res.status).toBe(200);
          expect(res.body.success).toBe(true);
        }
      });

      it('accepts optional durationMinutes', async () => {
        const res = await makeRequest('create-or-request-appointment', 'post', createOrRequestAppointmentFixtures.withDuration(90), validHeaders);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
      });

      it('accepts optional preferredClinicianId', async () => {
        const res = await makeRequest('create-or-request-appointment', 'post', createOrRequestAppointmentFixtures.withPreferredClinician(), validHeaders);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
      });

      it('accepts optional reason', async () => {
        const res = await makeRequest('create-or-request-appointment', 'post', createOrRequestAppointmentFixtures.withReason(), validHeaders);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
      });
    });

    describe('transfer-call', () => {
      it('rejects missing conversationId', async () => {
        const res = await makeRequest('transfer-call', 'post', transferCallFixtures.missingConversationId(), validHeaders);
        expect(res.status).toBe(400);
      });

      it('rejects missing target', async () => {
        const res = await makeRequest('transfer-call', 'post', transferCallFixtures.missingTarget(), validHeaders);
        expect(res.status).toBe(400);
      });

      it('rejects invalid UUID for conversationId', async () => {
        const res = await makeRequest('transfer-call', 'post', transferCallFixtures.invalidConversationId(), validHeaders);
        expect(res.status).toBe(400);
      });

      it('rejects invalid target enum value', async () => {
        const res = await makeRequest('transfer-call', 'post', transferCallFixtures.invalidTarget(), validHeaders);
        expect(res.status).toBe(400);
      });

      it('accepts all valid transfer targets', async () => {
        const targets = [TransferTargetEnum.HUMAN_AGENT, TransferTargetEnum.VOICEMAIL, TransferTargetEnum.SCHEDULING_QUEUE, TransferTargetEnum.CRISIS_LINE];
        for (const target of targets) {
          const res = await makeRequest(
            'transfer-call',
            'post',
            { ...transferCallFixtures.valid(), target, conversationId: `conv-${target.toLowerCase()}` },
            validHeaders
          );
          expect(res.status).toBe(200);
          expect(res.body.success).toBe(true);
        }
      });

      it('accepts optional reason', async () => {
        const res = await makeRequest('transfer-call', 'post', { ...transferCallFixtures.valid(), reason: 'Test reason' }, validHeaders);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
      });

      it('accepts optional targetAgentId', async () => {
        const res = await makeRequest('transfer-call', 'post', transferCallFixtures.withTargetAgent(), validHeaders);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
      });
    });

    describe('send-message-or-callback-request', () => {
      it('rejects missing clientId', async () => {
        const res = await makeRequest('send-message-or-callback-request', 'post', sendMessageOrCallbackFixtures.missingClientId(), validHeaders);
        expect(res.status).toBe(400);
      });

      it('rejects missing type', async () => {
        const res = await makeRequest('send-message-or-callback-request', 'post', sendMessageOrCallbackFixtures.missingType(), validHeaders);
        expect(res.status).toBe(400);
      });

      it('rejects missing idempotencyKey', async () => {
        const res = await makeRequest('send-message-or-callback-request', 'post', sendMessageOrCallbackFixtures.missingIdempotencyKey(), validHeaders);
        expect(res.status).toBe(400);
      });

      it('rejects invalid UUID for clientId', async () => {
        const res = await makeRequest('send-message-or-callback-request', 'post', sendMessageOrCallbackFixtures.invalidClientId(), validHeaders);
        expect(res.status).toBe(400);
      });

      it('rejects invalid type enum value', async () => {
        const res = await makeRequest('send-message-or-callback-request', 'post', sendMessageOrCallbackFixtures.invalidType(), validHeaders);
        expect(res.status).toBe(400);
      });

      it('accepts all valid message types', async () => {
        const types = ['SMS', 'EMAIL', 'CALLBACK_REQUEST', 'INTERNAL_NOTE'];
        for (const type of types) {
          const res = await makeRequest(
            'send-message-or-callback-request',
            'post',
            { ...sendMessageOrCallbackFixtures.valid(), type: type as any, idempotencyKey: `idem-${type.toLowerCase()}` },
            validHeaders
          );
          expect(res.status).toBe(200);
          expect(res.body.success).toBe(true);
        }
      });

      it('accepts optional message', async () => {
        const res = await makeRequest('send-message-or-callback-request', 'post', { ...sendMessageOrCallbackFixtures.valid(), message: 'Test message' }, validHeaders);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
      });

      it('accepts optional contactValue', async () => {
        const res = await makeRequest('send-message-or-callback-request', 'post', { ...sendMessageOrCallbackFixtures.valid(), contactValue: '+15551234567' }, validHeaders);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
      });

      it('accepts optional preferredCallbackTime', async () => {
        const res = await makeRequest('send-message-or-callback-request', 'post', sendMessageOrCallbackFixtures.callbackRequest(), validHeaders);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
      });
    });

    describe('log-call-outcome', () => {
      it('rejects missing conversationId', async () => {
        const res = await makeRequest('log-call-outcome', 'post', logCallOutcomeFixtures.missingConversationId(), validHeaders);
        expect(res.status).toBe(400);
      });

      it('rejects missing outcome', async () => {
        const res = await makeRequest('log-call-outcome', 'post', logCallOutcomeFixtures.missingOutcome(), validHeaders);
        expect(res.status).toBe(400);
      });

      it('rejects missing idempotencyKey', async () => {
        const res = await makeRequest('log-call-outcome', 'post', logCallOutcomeFixtures.missingIdempotencyKey(), validHeaders);
        expect(res.status).toBe(400);
      });

      it('rejects invalid UUID for conversationId', async () => {
        const res = await makeRequest('log-call-outcome', 'post', logCallOutcomeFixtures.invalidConversationId(), validHeaders);
        expect(res.status).toBe(400);
      });

      it('rejects invalid outcome enum value', async () => {
        const res = await makeRequest('log-call-outcome', 'post', logCallOutcomeFixtures.invalidOutcome(), validHeaders);
        expect(res.status).toBe(400);
      });

      it('accepts all valid call outcomes', async () => {
        const outcomes = Object.values(CallOutcomeEnum);
        for (const outcome of outcomes) {
          const res = await makeRequest(
            'log-call-outcome',
            'post',
            { ...logCallOutcomeFixtures.valid(), outcome, conversationId: `conv-${outcome.toLowerCase()}` },
            validHeaders
          );
          expect(res.status).toBe(200);
          expect(res.body.success).toBe(true);
        }
      });

      it('accepts optional durationSeconds', async () => {
        const res = await makeRequest('log-call-outcome', 'post', { ...logCallOutcomeFixtures.valid(), durationSeconds: '300' }, validHeaders);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
      });

      it('accepts optional summary', async () => {
        const res = await makeRequest('log-call-outcome', 'post', { ...logCallOutcomeFixtures.valid(), summary: 'Test summary' }, validHeaders);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
      });

      it('accepts optional recordingId', async () => {
        const res = await makeRequest('log-call-outcome', 'post', { ...logCallOutcomeFixtures.valid(), recordingId: 'rec-123' }, validHeaders);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
      });
    });
  });

  describe('Idempotency Behavior', () => {
    const validHeaders = authFixtures.validHeaders();

    describe('capture-lead', () => {
      it('returns CREATED on first request', async () => {
        const fixture = captureLeadFixtures.valid();
        const res = await makeRequest('capture-lead', 'post', fixture, validHeaders);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.status).toBe('CREATED');
        expect(mockPrisma.idempotencyKey.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              organizationId: VALID_ORG_ID,
              key: fixture.idempotencyKey,
              resourceType: 'Lead',
            }),
          })
        );
      });

      it('returns EXISTS on duplicate idempotency key', async () => {
        const key = generateIdempotencyKey('duplicate-lead');
        mockPrisma.idempotencyKey.findUnique
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ resourceId: 'lead-1', resourceType: 'Lead' });

        const firstRes = await makeRequest('capture-lead', 'post', captureLeadFixtures.duplicateIdempotencyKey(key), validHeaders);
        expect(firstRes.status).toBe(200);
        expect(firstRes.body.data.status).toBe('CREATED');

        const secondRes = await makeRequest('capture-lead', 'post', captureLeadFixtures.duplicateIdempotencyKey(key), validHeaders);
        expect(secondRes.status).toBe(200);
        expect(secondRes.body.data.status).toBe('EXISTS');
        expect(secondRes.body.data.leadId).toBe('lead-1');
      });

      it('throws BadRequestException on conflicting resource type', async () => {
        mockPrisma.idempotencyKey.findUnique.mockResolvedValue({ resourceId: 'appt-1', resourceType: 'Appointment' });
        const res = await makeRequest('capture-lead', 'post', captureLeadFixtures.conflictingResourceType(), validHeaders);
        expect(res.status).toBe(400);
        expect(res.body.message).toContain('different resource type');
      });
    });

    describe('create-or-request-appointment', () => {
      it('returns CREATED on first request', async () => {
        const fixture = createOrRequestAppointmentFixtures.valid();
        const res = await makeRequest('create-or-request-appointment', 'post', fixture, validHeaders);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.status).toBe('CONFIRMED');
      });

      it('returns EXISTS on duplicate idempotency key', async () => {
        const key = generateIdempotencyKey('duplicate-appointment');
        mockPrisma.idempotencyKey.findUnique
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ resourceId: 'appt-1', resourceType: 'Appointment' });

        const firstRes = await makeRequest('create-or-request-appointment', 'post', createOrRequestAppointmentFixtures.duplicateIdempotencyKey(key), validHeaders);
        expect(firstRes.status).toBe(200);
        expect(firstRes.body.data.status).toBe('CONFIRMED');

        const secondRes = await makeRequest('create-or-request-appointment', 'post', createOrRequestAppointmentFixtures.duplicateIdempotencyKey(key), validHeaders);
        expect(secondRes.status).toBe(200);
        expect(secondRes.body.data.status).toBe('EXISTS');
        expect(secondRes.body.data.appointmentId).toBe('appt-1');
      });

      it('throws BadRequestException on conflicting resource type', async () => {
        mockPrisma.idempotencyKey.findUnique.mockResolvedValue({ resourceId: 'lead-1', resourceType: 'Lead' });
        const res = await makeRequest('create-or-request-appointment', 'post', createOrRequestAppointmentFixtures.conflictingResourceType(), validHeaders);
        expect(res.status).toBe(400);
        expect(res.body.message).toContain('different resource type');
      });
    });

    describe('send-message-or-callback-request', () => {
      it('returns QUEUED on first request', async () => {
        const fixture = sendMessageOrCallbackFixtures.valid();
        const res = await makeRequest('send-message-or-callback-request', 'post', fixture, validHeaders);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.status).toBe('QUEUED');
      });

      it('returns EXISTS on duplicate idempotency key', async () => {
        const key = generateIdempotencyKey('duplicate-callback');
        mockPrisma.idempotencyKey.findUnique
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ resourceId: 'cb-1', resourceType: 'CallbackRequest' });

        const firstRes = await makeRequest('send-message-or-callback-request', 'post', sendMessageOrCallbackFixtures.duplicateIdempotencyKey(key), validHeaders);
        expect(firstRes.status).toBe(200);
        expect(firstRes.body.data.status).toBe('QUEUED');

        const secondRes = await makeRequest('send-message-or-callback-request', 'post', sendMessageOrCallbackFixtures.duplicateIdempotencyKey(key), validHeaders);
        expect(secondRes.status).toBe(200);
        expect(secondRes.body.data.status).toBe('EXISTS');
        expect(secondRes.body.data.requestId).toBe('cb-1');
      });

      it('throws BadRequestException on conflicting resource type', async () => {
        mockPrisma.idempotencyKey.findUnique.mockResolvedValue({ resourceId: 'lead-1', resourceType: 'Lead' });
        const res = await makeRequest('send-message-or-callback-request', 'post', sendMessageOrCallbackFixtures.conflictingResourceType(), validHeaders);
        expect(res.status).toBe(400);
        expect(res.body.message).toContain('different resource type');
      });
    });

    describe('log-call-outcome', () => {
      it('returns LOGGED on first request', async () => {
        const fixture = logCallOutcomeFixtures.valid();
        const res = await makeRequest('log-call-outcome', 'post', fixture, validHeaders);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.status).toBe('LOGGED');
      });

      it('returns EXISTS on duplicate idempotency key', async () => {
        const key = generateIdempotencyKey('duplicate-call-log');
        mockPrisma.idempotencyKey.findUnique
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ resourceId: 'log-1', resourceType: 'CallLog' });

        const firstRes = await makeRequest('log-call-outcome', 'post', logCallOutcomeFixtures.duplicateIdempotencyKey(key), validHeaders);
        expect(firstRes.status).toBe(200);
        expect(firstRes.body.data.status).toBe('LOGGED');

        const secondRes = await makeRequest('log-call-outcome', 'post', logCallOutcomeFixtures.duplicateIdempotencyKey(key), validHeaders);
        expect(secondRes.status).toBe(200);
        expect(secondRes.body.data.status).toBe('EXISTS');
        expect(secondRes.body.data.logId).toBe('log-1');
      });

      it('throws BadRequestException on conflicting resource type', async () => {
        mockPrisma.idempotencyKey.findUnique.mockResolvedValue({ resourceId: 'lead-1', resourceType: 'Lead' });
        const res = await makeRequest('log-call-outcome', 'post', logCallOutcomeFixtures.conflictingResourceType(), validHeaders);
        expect(res.status).toBe(400);
        expect(res.body.message).toContain('different resource type');
      });
    });
  });

  describe('Parallel Duplicate Requests (Race Conditions)', () => {
    const validHeaders = authFixtures.validHeaders();

    it('capture-lead: handles concurrent duplicate requests', async () => {
      const key = generateIdempotencyKey('parallel-lead');
      const fixture = captureLeadFixtures.duplicateIdempotencyKey(key);

      mockPrisma.idempotencyKey.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ resourceId: 'lead-1', resourceType: 'Lead' })
        .mockResolvedValueOnce({ resourceId: 'lead-1', resourceType: 'Lead' });

      const [res1, res2] = await Promise.all([
        makeRequest('capture-lead', 'post', fixture, validHeaders),
        makeRequest('capture-lead', 'post', fixture, validHeaders),
      ]);

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
      const statuses = [res1.body.data.status, res2.body.data.status].sort();
      expect(statuses).toEqual(['CREATED', 'EXISTS']);
    });

    it('create-or-request-appointment: handles concurrent duplicate requests', async () => {
      const key = generateIdempotencyKey('parallel-appointment');
      const fixture = createOrRequestAppointmentFixtures.duplicateIdempotencyKey(key);

      mockPrisma.idempotencyKey.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ resourceId: 'appt-1', resourceType: 'Appointment' })
        .mockResolvedValueOnce({ resourceId: 'appt-1', resourceType: 'Appointment' });

      const [res1, res2] = await Promise.all([
        makeRequest('create-or-request-appointment', 'post', fixture, validHeaders),
        makeRequest('create-or-request-appointment', 'post', fixture, validHeaders),
      ]);

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
      const statuses = [res1.body.data.status, res2.body.data.status].sort();
      expect(statuses).toEqual(['CONFIRMED', 'EXISTS']);
    });

    it('send-message-or-callback-request: handles concurrent duplicate requests', async () => {
      const key = generateIdempotencyKey('parallel-callback');
      const fixture = sendMessageOrCallbackFixtures.duplicateIdempotencyKey(key);

      mockPrisma.idempotencyKey.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ resourceId: 'cb-1', resourceType: 'CallbackRequest' })
        .mockResolvedValueOnce({ resourceId: 'cb-1', resourceType: 'CallbackRequest' });

      const [res1, res2] = await Promise.all([
        makeRequest('send-message-or-callback-request', 'post', fixture, validHeaders),
        makeRequest('send-message-or-callback-request', 'post', fixture, validHeaders),
      ]);

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
      const statuses = [res1.body.data.status, res2.body.data.status].sort();
      expect(statuses).toEqual(['QUEUED', 'EXISTS']);
    });

    it('log-call-outcome: handles concurrent duplicate requests', async () => {
      const key = generateIdempotencyKey('parallel-call-log');
      const fixture = logCallOutcomeFixtures.duplicateIdempotencyKey(key);

      mockPrisma.idempotencyKey.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ resourceId: 'log-1', resourceType: 'CallLog' })
        .mockResolvedValueOnce({ resourceId: 'log-1', resourceType: 'CallLog' });

      const [res1, res2] = await Promise.all([
        makeRequest('log-call-outcome', 'post', fixture, validHeaders),
        makeRequest('log-call-outcome', 'post', fixture, validHeaders),
      ]);

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
      const statuses = [res1.body.data.status, res2.body.data.status].sort();
      expect(statuses).toEqual(['LOGGED', 'EXISTS']);
    });
  });

  describe('Make Event Names & Payload Shape Validation', () => {
    const validHeaders = authFixtures.validHeaders();

    const contractEventTypes = [
      { endpoint: 'lookup-client', eventType: 'lookup_client', fixture: lookupClientFixtures.valid() },
      { endpoint: 'capture-lead', eventType: 'capture_lead', fixture: captureLeadFixtures.valid() },
      { endpoint: 'create-or-request-appointment', eventType: 'create_or_request_appointment', fixture: createOrRequestAppointmentFixtures.valid() },
      { endpoint: 'transfer-call', eventType: 'transfer_call', fixture: transferCallFixtures.valid() },
      { endpoint: 'send-message-or-callback-request', eventType: 'send_message_or_callback_request', fixture: sendMessageOrCallbackFixtures.valid() },
      { endpoint: 'log-call-outcome', eventType: 'log_call_outcome', fixture: logCallOutcomeFixtures.valid() },
      { endpoint: 'business-information', eventType: 'get_business_information', fixture: getBusinessInformationFixtures.valid(), method: 'get' as const },
    ];

    for (const { endpoint, eventType, fixture, method = 'post' } of contractEventTypes) {
      it(`${endpoint}: emits Make event with correct event_type (${eventType})`, async () => {
        await makeRequest(endpoint, method, fixture, validHeaders);
        const calls = mockPrisma.auditLog.create.mock.calls;
        const makeEventCall = calls.find((call) => {
          const metadata = call[0]?.data?.metadata;
          return metadata && typeof metadata === 'object' && 'event_type' in metadata && metadata.event_type === eventType;
        });
        expect(makeEventCall).toBeDefined();
        const metadata = makeEventCall![0].data.metadata;
        makeEventShapeValidator(metadata as any);
        expect(metadata.event_type).toBe(eventType);
      });

      it(`${endpoint}: Make event contains required fields`, async () => {
        await makeRequest(endpoint, method, fixture, validHeaders);
        const calls = mockPrisma.auditLog.create.mock.calls;
        const makeEventCall = calls.find((call) => {
          const metadata = call[0]?.data?.metadata;
          return metadata && metadata.event_type === eventType;
        });
        expect(makeEventCall).toBeDefined();
        const metadata = makeEventCall![0].data.metadata as MakeEventDto;
        expect(metadata.event_id).toMatch(/^evt-/);
        expect(metadata.request_id).toMatch(/^req-/);
        expect(metadata.conversation_id).toBeDefined();
        expect(metadata.client_id).toBeDefined();
        expect(metadata.organization_id).toBe(VALID_ORG_ID);
        expect(metadata.timestamp).toBeDefined();
      });
    }
  });

  describe('ElevenLabs-Style Request Fixtures', () => {
    const validHeaders = authFixtures.validHeaders();

    it('capture-lead: processes ElevenLabs-style payload', async () => {
      const res = await makeRequest('capture-lead', 'post', elevenLabsStyleFixtures.captureLead.payload, validHeaders);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('CREATED');
    });

    it('create-or-request-appointment: processes ElevenLabs-style payload', async () => {
      const res = await makeRequest('create-or-request-appointment', 'post', elevenLabsStyleFixtures.createAppointment.payload, validHeaders);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('transfer-call: processes ElevenLabs-style payload', async () => {
      const res = await makeRequest('transfer-call', 'post', elevenLabsStyleFixtures.transferCall.payload, validHeaders);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('send-message-or-callback-request: processes ElevenLabs-style payload', async () => {
      const res = await makeRequest('send-message-or-callback-request', 'post', elevenLabsStyleFixtures.sendMessage.payload, validHeaders);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('log-call-outcome: processes ElevenLabs-style payload', async () => {
      const res = await makeRequest('log-call-outcome', 'post', elevenLabsStyleFixtures.logCallOutcome.payload, validHeaders);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('lookup-client: processes ElevenLabs-style payload', async () => {
      const res = await makeRequest('lookup-client', 'post', elevenLabsStyleFixtures.lookupClient.payload, validHeaders);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('get-business-information: processes ElevenLabs-style payload', async () => {
      const res = await makeRequest('business-information', 'get', undefined, validHeaders);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('Database Persistence Verification', () => {
    const validHeaders = authFixtures.validHeaders();

    it('capture-lead: persists Lead record with correct data', async () => {
      const fixture = captureLeadFixtures.valid();
      await makeRequest('capture-lead', 'post', fixture, validHeaders);
      expect(mockPrisma.lead.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId: VALID_ORG_ID,
            firstName: fixture.firstName,
            lastName: fixture.lastName,
            idempotencyKey: fixture.idempotencyKey,
          }),
        })
      );
    });

    it('create-or-request-appointment: persists Appointment record with correct data', async () => {
      const fixture = createOrRequestAppointmentFixtures.valid();
      await makeRequest('create-or-request-appointment', 'post', fixture, validHeaders);
      expect(mockPrisma.appointment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId: VALID_ORG_ID,
            clientId: fixture.clientId,
            type: fixture.type,
          }),
        })
      );
    });

    it('transfer-call: persists CallTransfer record with correct data', async () => {
      const fixture = transferCallFixtures.valid();
      await makeRequest('transfer-call', 'post', fixture, validHeaders);
      expect(mockPrisma.callTransfer.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId: VALID_ORG_ID,
            conversationId: fixture.conversationId,
            target: fixture.target,
          }),
        })
      );
    });

    it('send-message-or-callback-request: persists CallbackRequest record with correct data', async () => {
      const fixture = sendMessageOrCallbackFixtures.valid();
      await makeRequest('send-message-or-callback-request', 'post', fixture, validHeaders);
      expect(mockPrisma.callbackRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId: VALID_ORG_ID,
            clientId: fixture.clientId,
            type: fixture.type,
            idempotencyKey: fixture.idempotencyKey,
          }),
        })
      );
    });

    it('log-call-outcome: persists CallLog record with correct data', async () => {
      const fixture = logCallOutcomeFixtures.valid();
      await makeRequest('log-call-outcome', 'post', fixture, validHeaders);
      expect(mockPrisma.callLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId: VALID_ORG_ID,
            conversationId: fixture.conversationId,
            outcome: fixture.outcome,
            idempotencyKey: fixture.idempotencyKey,
          }),
        })
      );
    });

    it('All operations: persist AuditLog for Make events', async () => {
      const fixture = captureLeadFixtures.valid();
      await makeRequest('capture-lead', 'post', fixture, validHeaders);
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId: VALID_ORG_ID,
            action: 'CREATE',
            entityType: 'MakeEvent',
          }),
        })
      );
    });
  });

  describe('Error Response Security (No Internal Details Leaked)', () => {
    const validHeaders = authFixtures.validHeaders();

    it('lookup-client: not found error does not leak internal details', async () => {
      mockPrisma.client.findFirst.mockResolvedValue(null);
      const res = await makeRequest('lookup-client', 'post', lookupClientFixtures.valid(), validHeaders);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Client not found');
      expect(res.body.requestId).toBeDefined();
    });

    it('create-or-request-appointment: client not found does not leak internal details', async () => {
      mockPrisma.client.findFirst.mockResolvedValue(null);
      const res = await makeRequest('create-or-request-appointment', 'post', createOrRequestAppointmentFixtures.valid(), validHeaders);
      expect(res.status).toBe(404);
      expect(res.body.message).toContain('Client');
      expect(res.body.message).toContain('not found');
      expect(res.body.message).not.toContain('organizationId');
      expect(res.body.message).not.toContain('prisma');
    });

    it('send-message-or-callback-request: client not found does not leak internal details', async () => {
      mockPrisma.client.findFirst.mockResolvedValue(null);
      const res = await makeRequest('send-message-or-callback-request', 'post', sendMessageOrCallbackFixtures.valid(), validHeaders);
      expect(res.status).toBe(404);
      expect(res.body.message).toContain('Client');
      expect(res.body.message).toContain('not found');
    });

    it('log-call-outcome: conversation not found does not leak internal details', async () => {
      mockPrisma.conversation.findFirst.mockResolvedValue(null);
      const res = await makeRequest('log-call-outcome', 'post', logCallOutcomeFixtures.valid(), validHeaders);
      expect(res.status).toBe(404);
      expect(res.body.message).toContain('Conversation');
      expect(res.body.message).toContain('not found');
    });

    it('transfer-call: conversation not found does not leak internal details', async () => {
      mockPrisma.conversation.findFirst.mockResolvedValue(null);
      const res = await makeRequest('transfer-call', 'post', transferCallFixtures.valid(), validHeaders);
      expect(res.status).toBe(404);
      expect(res.body.message).toContain('Conversation');
      expect(res.body.message).toContain('not found');
    });

    it('get-business-information: organization not found does not leak internal details', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue(null);
      const res = await makeRequest('business-information', 'get', undefined, validHeaders);
      expect(res.status).toBe(404);
      expect(res.body.message).toContain('Organization');
      expect(res.body.message).toContain('not found');
    });

    it('idempotency conflict: error message does not leak internal IDs of other resources', async () => {
      mockPrisma.idempotencyKey.findUnique.mockResolvedValue({ resourceId: 'other-resource-123', resourceType: 'Lead' });
      const res = await makeRequest('capture-lead', 'post', captureLeadFixtures.conflictingResourceType(), validHeaders);
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('different resource type');
      expect(res.body.message).toContain('Lead');
    });
  });

  describe('Regression Coverage', () => {
    const validHeaders = authFixtures.validHeaders();

    describe('Auth Guard Regression', () => {
      it('continues to reject requests without Authorization header', async () => {
        const res = await makeRequest('lookup-client', 'post', lookupClientFixtures.valid(), {});
        expect(res.status).toBe(401);
      });

      it('continues to reject requests with invalid token', async () => {
        const res = await makeRequest('lookup-client', 'post', lookupClientFixtures.valid(), authFixtures.invalidToken());
        expect(res.status).toBe(401);
      });

      it('continues to require X-Organization-Id header', async () => {
        const res = await makeRequest('lookup-client', 'post', lookupClientFixtures.valid(), { authorization: `Bearer ${VALID_SERVICE_SECRET}` });
        expect(res.status).toBe(401);
      });

      it('continues to validate organization exists and is active', async () => {
        mockPrisma.organization.findUnique.mockResolvedValue({ id: VALID_ORG_ID, isActive: false });
        const res = await makeRequest('lookup-client', 'post', lookupClientFixtures.valid(), validHeaders);
        expect(res.status).toBe(401);
      });
    });

    describe('Tenant Isolation Regression', () => {
      it('lookup-client: query includes organizationId filter', async () => {
        await makeRequest('lookup-client', 'post', lookupClientFixtures.valid(), validHeaders);
        expect(mockPrisma.client.findFirst).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({ organizationId: VALID_ORG_ID }),
          })
        );
      });

      it('capture-lead: created lead includes organizationId', async () => {
        await makeRequest('capture-lead', 'post', captureLeadFixtures.valid(), validHeaders);
        expect(mockPrisma.lead.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({ organizationId: VALID_ORG_ID }),
          })
        );
      });

      it('create-or-request-appointment: query includes organizationId filter for client lookup', async () => {
        await makeRequest('create-or-request-appointment', 'post', createOrRequestAppointmentFixtures.valid(), validHeaders);
        expect(mockPrisma.client.findFirst).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({ organizationId: VALID_ORG_ID }),
          })
        );
      });

      it('transfer-call: query includes organizationId filter for conversation lookup', async () => {
        await makeRequest('transfer-call', 'post', transferCallFixtures.valid(), validHeaders);
        expect(mockPrisma.conversation.findFirst).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({ organizationId: VALID_ORG_ID }),
          })
        );
      });

      it('send-message-or-callback-request: query includes organizationId filter for client lookup', async () => {
        await makeRequest('send-message-or-callback-request', 'post', sendMessageOrCallbackFixtures.valid(), validHeaders);
        expect(mockPrisma.client.findFirst).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({ organizationId: VALID_ORG_ID }),
          })
        );
      });

      it('log-call-outcome: query includes organizationId filter for conversation lookup', async () => {
        await makeRequest('log-call-outcome', 'post', logCallOutcomeFixtures.valid(), validHeaders);
        expect(mockPrisma.conversation.findFirst).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({ organizationId: VALID_ORG_ID }),
          })
        );
      });

      it('get-business-information: query uses organizationId from auth context', async () => {
        await makeRequest('business-information', 'get', undefined, validHeaders);
        expect(mockPrisma.organization.findUnique).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: VALID_ORG_ID },
          })
        );
      });
    });

    describe('Idempotency Regression', () => {
      it('capture-lead: idempotency key is checked before creating resource', async () => {
        const fixture = captureLeadFixtures.valid();
        await makeRequest('capture-lead', 'post', fixture, validHeaders);
        expect(mockPrisma.idempotencyKey.findUnique).toHaveBeenCalledWith({
          where: { organizationId_key: { organizationId: VALID_ORG_ID, key: fixture.idempotencyKey } },
          select: { resourceId: true, resourceType: true },
        });
      });

      it('create-or-request-appointment: idempotency key is checked before creating resource', async () => {
        const fixture = createOrRequestAppointmentFixtures.valid();
        await makeRequest('create-or-request-appointment', 'post', fixture, validHeaders);
        expect(mockPrisma.idempotencyKey.findUnique).toHaveBeenCalledWith({
          where: { organizationId_key: { organizationId: VALID_ORG_ID, key: fixture.idempotencyKey } },
          select: { resourceId: true, resourceType: true },
        });
      });

      it('send-message-or-callback-request: idempotency key is checked before creating resource', async () => {
        const fixture = sendMessageOrCallbackFixtures.valid();
        await makeRequest('send-message-or-callback-request', 'post', fixture, validHeaders);
        expect(mockPrisma.idempotencyKey.findUnique).toHaveBeenCalledWith({
          where: { organizationId_key: { organizationId: VALID_ORG_ID, key: fixture.idempotencyKey } },
          select: { resourceId: true, resourceType: true },
        });
      });

      it('log-call-outcome: idempotency key is checked before creating resource', async () => {
        const fixture = logCallOutcomeFixtures.valid();
        await makeRequest('log-call-outcome', 'post', fixture, validHeaders);
        expect(mockPrisma.idempotencyKey.findUnique).toHaveBeenCalledWith({
          where: { organizationId_key: { organizationId: VALID_ORG_ID, key: fixture.idempotencyKey } },
          select: { resourceId: true, resourceType: true },
        });
      });

      it('capture-lead: idempotency key is recorded after successful creation', async () => {
        const fixture = captureLeadFixtures.valid();
        await makeRequest('capture-lead', 'post', fixture, validHeaders);
        expect(mockPrisma.idempotencyKey.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              organizationId: VALID_ORG_ID,
              key: fixture.idempotencyKey,
              resourceType: 'Lead',
            }),
          })
        );
      });
    });
  });

  describe('Successful Request for Every Contract', () => {
    const validHeaders = authFixtures.validHeaders();

    it('lookup-client: successful request returns client data', async () => {
      const res = await makeRequest('lookup-client', 'post', lookupClientFixtures.valid(), validHeaders);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        clientId: VALID_CLIENT_ID,
        firstName: 'John',
        lastName: 'Doe',
      });
      expect(res.body.requestId).toMatch(/^req-/);
    });

    it('capture-lead: successful request creates lead', async () => {
      const res = await makeRequest('capture-lead', 'post', captureLeadFixtures.valid(), validHeaders);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        leadId: 'lead-1',
        status: 'CREATED',
      });
      expect(res.body.requestId).toMatch(/^req-/);
    });

    it('create-or-request-appointment: successful request creates/queues appointment', async () => {
      const res = await makeRequest('create-or-request-appointment', 'post', createOrRequestAppointmentFixtures.valid(), validHeaders);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        appointmentId: 'appt-1',
        status: 'CONFIRMED',
      });
      expect(res.body.requestId).toMatch(/^req-/);
    });

    it('transfer-call: successful request creates transfer record', async () => {
      const res = await makeRequest('transfer-call', 'post', transferCallFixtures.valid(), validHeaders);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        transferId: 'transfer-1',
        status: 'TRANSFER_QUEUED',
      });
      expect(res.body.requestId).toMatch(/^req-/);
    });

    it('send-message-or-callback-request: successful request queues message', async () => {
      const res = await makeRequest('send-message-or-callback-request', 'post', sendMessageOrCallbackFixtures.valid(), validHeaders);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        requestId: 'cb-1',
        status: 'QUEUED',
      });
      expect(res.body.requestId).toMatch(/^req-/);
    });

    it('log-call-outcome: successful request logs call outcome', async () => {
      const res = await makeRequest('log-call-outcome', 'post', logCallOutcomeFixtures.valid(), validHeaders);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        logId: 'log-1',
        status: 'LOGGED',
      });
      expect(res.body.requestId).toMatch(/^req-/);
    });

    it('get-business-information: successful request returns business info', async () => {
      const res = await makeRequest('business-information', 'get', undefined, validHeaders);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        name: 'Test Org',
        phone: '+15551234567',
        email: 'info@test.org',
      });
      expect(res.body.requestId).toMatch(/^req-/);
    });
  });
});

function generateIdempotencyKey(suffix: string): string {
  return `idem-${suffix}`;
}