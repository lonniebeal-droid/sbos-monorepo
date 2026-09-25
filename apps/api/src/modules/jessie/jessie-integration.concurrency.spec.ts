import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@sbos/database';
import { JessieIntegrationService } from './jessie-integration.service';
import { AuditService } from '../../audit/audit.service';
import { SmsProvider } from '../../channels/sms.provider';
import { EmailProvider } from '../../channels/email.provider';
import { CallOutcomeEnum } from './dto/jessie-integration.dto';

const prisma = new PrismaClient();
const audit = new AuditService(prisma as any);

const mockSms: SmsProvider = {
  send: async (): Promise<any> => ({ id: 'sms-1', success: true, provider: 'mock' }),
};

const mockEmail: EmailProvider = {
  send: async (): Promise<any> => ({ id: 'email-1', success: true, provider: 'mock' }),
};

const service = new JessieIntegrationService(prisma as any, audit, mockSms, mockEmail);

const ctx = {
  organizationId: 'org-test-concurrency',
  userId: 'user-clin-test-1',
  isServiceAccount: true,
};

beforeAll(async () => {
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  await prisma.auditLog.deleteMany({ where: { organizationId: ctx.organizationId } });
  await prisma.idempotencyKey.deleteMany({ where: { organizationId: ctx.organizationId } });
  await prisma.lead.deleteMany({ where: { organizationId: ctx.organizationId } });
  await prisma.callbackRequest.deleteMany({ where: { organizationId: ctx.organizationId } });
  await prisma.callLog.deleteMany({ where: { organizationId: ctx.organizationId } });
  await prisma.callTransfer.deleteMany({ where: { conversationId: { startsWith: 'conv-test-' } } });
  await prisma.appointment.deleteMany({ where: { organizationId: ctx.organizationId } });
  await prisma.conversation.deleteMany({ where: { organizationId: ctx.organizationId } });
  await prisma.clinician.deleteMany({ where: { organizationId: ctx.organizationId } });
  await prisma.user.deleteMany({ where: { organizationId: ctx.organizationId } });
  await prisma.client.deleteMany({ where: { organizationId: ctx.organizationId } });
  await prisma.organization.deleteMany({ where: { id: ctx.organizationId } });

  await prisma.organization.create({
    data: {
      id: ctx.organizationId,
      name: 'Test Org',
      slug: 'test-org-concurrency',
    },
  });

  await prisma.user.create({
    data: {
      id: 'user-clin-test-1',
      organizationId: ctx.organizationId,
      email: 'clin-test-1@example.com',
      passwordHash: 'hash',
      firstName: 'Test',
      lastName: 'Clinician',
      role: 'CLINICIAN',
    },
  });

  await prisma.client.create({
    data: {
      id: 'client-test-1',
      organizationId: ctx.organizationId,
      mrn: 'MRN-TEST-1',
      firstName: 'Test',
      lastName: 'Client',
      dateOfBirth: new Date('1990-01-01'),
    },
  });

  await prisma.clinician.create({
    data: {
      id: 'clin-test-1',
      organizationId: ctx.organizationId,
      userId: 'user-clin-test-1',
      isAcceptingNewClients: true,
    },
  });

  await prisma.conversation.create({
    data: {
      id: 'conv-test-1',
      organizationId: ctx.organizationId,
      kind: 'GENERAL',
      status: 'ACTIVE',
      clientId: 'client-test-1',
    },
  });
});

describe('JessieIntegrationService - Concurrent Idempotency', () => {
  describe('captureLead - concurrent duplicate requests', () => {
    it('handles concurrent duplicate lead creation - only one lead created', async () => {
      const idempotencyKey = `idem-lead-concurrent-${Date.now()}`;
      const dto = {
        firstName: 'Jane',
        lastName: 'Doe',
        idempotencyKey,
      };

      const results = await Promise.all([
        service.captureLead(ctx, dto),
        service.captureLead(ctx, dto),
        service.captureLead(ctx, dto),
      ]);

      const successResults = results.filter(r => r.success);
      expect(successResults).toHaveLength(3);

      const leadIds = new Set(successResults.map(r => r.data?.leadId));
      expect(leadIds.size).toBe(1);

      const createdCount = successResults.filter(r => r.data?.status === 'CREATED').length;
      const existsCount = successResults.filter(r => r.data?.status === 'EXISTS').length;
      expect(createdCount).toBe(1);
      expect(existsCount).toBe(2);

      const dbLeads = await prisma.lead.findMany({
        where: { organizationId: ctx.organizationId, idempotencyKey },
      });
      expect(dbLeads).toHaveLength(1);

      const dbIdempotencyKeys = await prisma.idempotencyKey.findMany({
        where: { organizationId: ctx.organizationId, key: idempotencyKey },
      });
      expect(dbIdempotencyKeys).toHaveLength(1);

      const dbMakeEvents = await prisma.auditLog.findMany({
        where: {
          organizationId: ctx.organizationId,
          entityType: 'MakeEvent',
          metadata: {
            path: ['event_type'],
            equals: 'capture_lead',
          },
        },
      });
      expect(dbMakeEvents).toHaveLength(1);
    });
  });

  describe('createOrRequestAppointment - concurrent duplicate requests', () => {
    it('handles concurrent duplicate appointment creation - only one appointment created', async () => {
      const idempotencyKey = `idem-appt-concurrent-${Date.now()}`;
      const dto = {
        clientId: 'client-test-1',
        type: 'INDIVIDUAL' as const,
        preferredStartTime: '2026-09-20T10:00:00.000Z',
        idempotencyKey,
        preferredClinicianId: 'clin-test-1',
      };

      const results = await Promise.all([
        service.createOrRequestAppointment(ctx, dto),
        service.createOrRequestAppointment(ctx, dto),
        service.createOrRequestAppointment(ctx, dto),
      ]);

      const successResults = results.filter(r => r.success);
      expect(successResults).toHaveLength(3);

      const apptIds = new Set(successResults.map(r => r.data?.appointmentId));
      expect(apptIds.size).toBe(1);

      expect(successResults.every(r => r.data?.status === 'CONFIRMED')).toBe(true);

      const dbAppointments = await prisma.appointment.findMany({
        where: { organizationId: ctx.organizationId },
      });
      expect(dbAppointments).toHaveLength(1);

      const idempotencyRecord = await prisma.idempotencyKey.findUnique({
        where: { organizationId_key: { organizationId: ctx.organizationId, key: idempotencyKey } },
      });
      expect(idempotencyRecord).not.toBeNull();
      expect(idempotencyRecord!.resourceType).toBe('Appointment');

      const dbIdempotencyKeys = await prisma.idempotencyKey.findMany({
        where: { organizationId: ctx.organizationId, key: idempotencyKey },
      });
      expect(dbIdempotencyKeys).toHaveLength(1);

      const dbMakeEvents = await prisma.auditLog.findMany({
        where: {
          organizationId: ctx.organizationId,
          entityType: 'MakeEvent',
          metadata: {
            path: ['event_type'],
            equals: 'create_or_request_appointment',
          },
        },
      });
      expect(dbMakeEvents).toHaveLength(1);
    });
  });

  describe('sendMessageOrCallbackRequest - concurrent duplicate requests', () => {
    it('handles concurrent duplicate callback requests - only one callback created', async () => {
      const idempotencyKey = `idem-cb-concurrent-${Date.now()}`;
      const dto = {
        clientId: 'client-test-1',
        type: 'CALLBACK_REQUEST' as const,
        message: 'Call me back',
        idempotencyKey,
      };

      const results = await Promise.all([
        service.sendMessageOrCallbackRequest(ctx, dto),
        service.sendMessageOrCallbackRequest(ctx, dto),
        service.sendMessageOrCallbackRequest(ctx, dto),
      ]);

      const successResults = results.filter(r => r.success);
      expect(successResults).toHaveLength(3);

      const cbIds = new Set(successResults.map(r => r.data?.requestId));
      expect(cbIds.size).toBe(1);

      const createdCount = successResults.filter(r => r.data?.status === 'QUEUED').length;
      const existsCount = successResults.filter(r => r.data?.status === 'EXISTS').length;
      expect(createdCount).toBe(1);
      expect(existsCount).toBe(2);

      const dbCallbacks = await prisma.callbackRequest.findMany({
        where: { organizationId: ctx.organizationId, idempotencyKey },
      });
      expect(dbCallbacks).toHaveLength(1);

      const dbIdempotencyKeys = await prisma.idempotencyKey.findMany({
        where: { organizationId: ctx.organizationId, key: idempotencyKey },
      });
      expect(dbIdempotencyKeys).toHaveLength(1);

      const dbMakeEvents = await prisma.auditLog.findMany({
        where: {
          organizationId: ctx.organizationId,
          entityType: 'MakeEvent',
          metadata: {
            path: ['event_type'],
            equals: 'send_message_or_callback_request',
          },
        },
      });
      expect(dbMakeEvents).toHaveLength(1);
    });
  });

  describe('logCallOutcome - concurrent duplicate requests', () => {
    it('handles concurrent duplicate call log - only one log created', async () => {
      const idempotencyKey = `idem-calllog-concurrent-${Date.now()}`;
      const dto = {
        conversationId: 'conv-test-1',
        outcome: CallOutcomeEnum.COMPLETED,
        durationSeconds: '120',
        summary: 'Test call',
        idempotencyKey,
      };

      const results = await Promise.all([
        service.logCallOutcome(ctx, dto),
        service.logCallOutcome(ctx, dto),
        service.logCallOutcome(ctx, dto),
      ]);

      const successResults = results.filter(r => r.success);
      expect(successResults).toHaveLength(3);

      const logIds = new Set(successResults.map(r => r.data?.logId));
      expect(logIds.size).toBe(1);

      const createdCount = successResults.filter(r => r.data?.status === 'LOGGED').length;
      const existsCount = successResults.filter(r => r.data?.status === 'EXISTS').length;
      expect(createdCount).toBe(1);
      expect(existsCount).toBe(2);

      const dbCallLogs = await prisma.callLog.findMany({
        where: { organizationId: ctx.organizationId, idempotencyKey },
      });
      expect(dbCallLogs).toHaveLength(1);

      const dbIdempotencyKeys = await prisma.idempotencyKey.findMany({
        where: { organizationId: ctx.organizationId, key: idempotencyKey },
      });
      expect(dbIdempotencyKeys).toHaveLength(1);

      const dbMakeEvents = await prisma.auditLog.findMany({
        where: {
          organizationId: ctx.organizationId,
          entityType: 'MakeEvent',
          metadata: {
            path: ['event_type'],
            equals: 'log_call_outcome',
          },
        },
      });
      expect(dbMakeEvents).toHaveLength(1);
    });
  });

  describe('Cross-method idempotency key conflict', () => {
    it('throws BadRequestException when same idempotency key used for different resource types', async () => {
      const idempotencyKey = `idem-cross-${Date.now()}`;

      await service.captureLead(ctx, {
        firstName: 'Jane',
        lastName: 'Doe',
        idempotencyKey,
      });

      await expect(
        service.createOrRequestAppointment(ctx, {
          clientId: 'client-test-1',
          type: 'INDIVIDUAL',
          preferredStartTime: '2026-09-20T10:00:00.000Z',
          idempotencyKey,
        }),
      ).rejects.toThrow('already used for different resource type');
    });
  });
});
