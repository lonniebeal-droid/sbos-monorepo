import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AuditAction } from '@sbos/database';
import { describe, expect, it, vi } from 'vitest';

import { JessieIntegrationService } from './jessie-integration.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { AuditService } from '../../audit/audit.service';
import type { SmsProvider } from '../../channels/sms.provider';
import type { EmailProvider } from '../../channels/email.provider';
import { CallOutcomeEnum, TransferTargetEnum } from './dto/jessie-integration.dto';

function makeService(overrides?: {
  prisma?: any;
  audit?: Partial<AuditService>;
  sms?: Partial<SmsProvider>;
  email?: Partial<EmailProvider>;
}) {
  const basePrisma = {
    client: { findFirst: vi.fn() },
    lead: { create: vi.fn(), findUnique: vi.fn() },
    appointment: { create: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn() },
    clinician: { findFirst: vi.fn() },
    conversation: { findFirst: vi.fn() },
    callTransfer: { create: vi.fn() },
    callbackRequest: { create: vi.fn(), findUnique: vi.fn() },
    callLog: { create: vi.fn(), findUnique: vi.fn() },
    organization: { findUnique: vi.fn() },
  serviceCode: { findMany: vi.fn().mockResolvedValue([]) },
  knowledgeArticle: { findMany: vi.fn().mockResolvedValue([]) },
    idempotencyKey: { findUnique: vi.fn(), create: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  const prisma = { ...basePrisma, ...(overrides?.prisma ?? {}) } as unknown as PrismaService;
  const audit = { record: vi.fn(), ...(overrides?.audit ?? {}) } as unknown as AuditService;
  const sms = { send: vi.fn().mockResolvedValue({}), ...(overrides?.sms ?? {}) } as unknown as SmsProvider;
  const email = { send: vi.fn().mockResolvedValue({}), ...(overrides?.email ?? {}) } as unknown as EmailProvider;
  return { service: new JessieIntegrationService(prisma, audit, sms, email), audit, prisma: prisma as any, sms, email };
}

const ctx = {
  organizationId: 'org-1',
  userId: 'user-1',
  isServiceAccount: true,
};

describe('JessieIntegrationService', () => {
  describe('lookupClient', () => {
    it('returns client data when found', async () => {
      const { service } = makeService({
        prisma: {
          client: {
            findFirst: vi.fn().mockResolvedValue({
              id: 'client-1',
              firstName: 'John',
              lastName: 'Doe',
              preferredName: 'Jon',
              mrn: 'MRN-123',
              phone: '+15551234567',
              email: 'john@example.com',
              status: 'ACTIVE',
              primaryClinicianId: 'clin-1',
            }),
          },
          auditLog: { create: vi.fn().mockResolvedValue({}) },
        },
      });

      const result = await service.lookupClient(ctx, { clientId: 'client-1' });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        clientId: 'client-1',
        firstName: 'John',
        lastName: 'Doe',
        preferredName: 'Jon',
        mrn: 'MRN-123',
        phone: '+15551234567',
        email: 'john@example.com',
        status: 'ACTIVE',
        primaryClinicianId: 'clin-1',
      });
      expect(result.requestId).toBeDefined();
    });

    it('returns error when client not found', async () => {
      const { service } = makeService({
        prisma: {
          client: { findFirst: vi.fn().mockResolvedValue(null) },
          auditLog: { create: vi.fn().mockResolvedValue({}) },
        },
      });

      const result = await service.lookupClient(ctx, { clientId: 'missing' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Client not found');
    });

    it('enforces tenant isolation - client in different org not found', async () => {
      const { service, prisma } = makeService({
        prisma: {
          client: { findFirst: vi.fn().mockResolvedValue(null) },
          auditLog: { create: vi.fn().mockResolvedValue({}) },
        },
      });

      const result = await service.lookupClient(ctx, { clientId: 'client-other-org' });

      expect(result.success).toBe(false);
      expect(prisma.client.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organizationId: 'org-1' }),
        }),
      );
    });
  });

  describe('captureLead', () => {
    it('creates new lead with idempotency key', async () => {
      const { service, prisma } = makeService({
        prisma: {
          idempotencyKey: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn() },
          lead: { create: vi.fn().mockResolvedValue({ id: 'lead-1' }) },
          auditLog: { create: vi.fn().mockResolvedValue({}) },
        },
      });

      const result = await service.captureLead(ctx, {
        firstName: 'Jane',
        lastName: 'Smith',
        idempotencyKey: 'idem-1',
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ leadId: 'lead-1', status: 'CREATED' });
      expect(prisma.lead.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId: 'org-1',
            idempotencyKey: 'idem-1',
            firstName: 'Jane',
            lastName: 'Smith',
          }),
        }),
      );
      expect(prisma.idempotencyKey.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ organizationId: 'org-1', key: 'idem-1', resourceType: 'Lead' }),
        }),
      );
    });

    it('returns existing lead on duplicate idempotency key', async () => {
      const { service, prisma } = makeService({
        prisma: {
          idempotencyKey: {
            findUnique: vi.fn().mockResolvedValue({ resourceId: 'lead-1', resourceType: 'Lead' }),
          },
          lead: { create: vi.fn(), findUnique: vi.fn().mockResolvedValue({ id: 'lead-1' }) },
          auditLog: { create: vi.fn().mockResolvedValue({}) },
        },
      });

      const result = await service.captureLead(ctx, {
        firstName: 'Jane',
        lastName: 'Smith',
        idempotencyKey: 'idem-1',
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ leadId: 'lead-1', status: 'EXISTS' });
      expect(prisma.lead.create).not.toHaveBeenCalled();
    });

    it('throws on conflicting resource type for same idempotency key', async () => {
      const { service } = makeService({
        prisma: {
          idempotencyKey: {
            findUnique: vi.fn().mockResolvedValue({ resourceId: 'appt-1', resourceType: 'Appointment' }),
          },
        },
      });

      await expect(
        service.captureLead(ctx, {
          firstName: 'Jane',
          lastName: 'Smith',
          idempotencyKey: 'idem-1',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('createOrRequestAppointment', () => {
    it('creates confirmed appointment when clinician available', async () => {
      const { service } = makeService({
        prisma: {
          idempotencyKey: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn() },
          client: { findFirst: vi.fn().mockResolvedValue({ id: 'client-1' }) },
          clinician: {
            findFirst: vi.fn().mockResolvedValue({ id: 'clin-1' }),
          },
          appointment: {
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue({
              id: 'appt-1',
              status: 'SCHEDULED',
              startTime: new Date('2026-09-15T10:00:00.000Z'),
            }),
          },
          auditLog: { create: vi.fn().mockResolvedValue({}) },
        },
      });

      const result = await service.createOrRequestAppointment(ctx, {
        clientId: 'client-1',
        type: 'INDIVIDUAL',
        preferredStartTime: '2026-09-15T10:00:00.000Z',
        idempotencyKey: 'idem-1',
      });

      expect(result.success).toBe(true);
      expect(result.data!.status).toBe('CONFIRMED');
      expect(result.data!.appointmentId).toBe('appt-1');
    });

    it('queues appointment request when clinician unavailable', async () => {
      const { service } = makeService({
        prisma: {
          idempotencyKey: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn() },
          client: { findFirst: vi.fn().mockResolvedValue({ id: 'client-1' }) },
          clinician: {
            findFirst: vi.fn().mockResolvedValue({ id: 'clin-1' }),
          },
          appointment: {
            findFirst: vi.fn().mockResolvedValue({ id: 'conflict-appt' }),
            create: vi.fn().mockResolvedValue({
              id: 'appt-1',
              status: 'SCHEDULED',
              startTime: new Date('2026-09-15T10:00:00.000Z'),
            }),
          },
          auditLog: { create: vi.fn().mockResolvedValue({}) },
        },
      });

      const result = await service.createOrRequestAppointment(ctx, {
        clientId: 'client-1',
        type: 'INDIVIDUAL',
        preferredStartTime: '2026-09-15T10:00:00.000Z',
        preferredClinicianId: 'clin-1',
        idempotencyKey: 'idem-1',
      });

      expect(result.success).toBe(true);
      expect(result.data!.status).toBe('REQUESTED');
      expect(result.data!.message).toContain('unavailable');
    });

    it('throws when client not found', async () => {
      const { service } = makeService({
        prisma: {
          idempotencyKey: { findUnique: vi.fn().mockResolvedValue(null) },
          client: { findFirst: vi.fn().mockResolvedValue(null) },
        },
      });

      await expect(
        service.createOrRequestAppointment(ctx, {
          clientId: 'missing',
          type: 'INDIVIDUAL',
          preferredStartTime: '2026-09-15T10:00:00.000Z',
          idempotencyKey: 'idem-1',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('transferCall', () => {
    it('creates transfer record and returns decision', async () => {
      const { service } = makeService({
        prisma: {
          conversation: { findFirst: vi.fn().mockResolvedValue({ id: 'conv-1', clientId: 'client-1' }) },
          callTransfer: { create: vi.fn().mockResolvedValue({ id: 'transfer-1' }) },
          auditLog: { create: vi.fn().mockResolvedValue({}) },
        },
      });

      const result = await service.transferCall(ctx, {
        conversationId: 'conv-1',
        target: TransferTargetEnum.HUMAN_AGENT,
        reason: 'Client requested human',
      });

      expect(result.success).toBe(true);
      expect(result.data!.status).toBe('TRANSFER_QUEUED');
      expect(result.data!.transferId).toBe('transfer-1');
      expect(result.data!.message).toContain('Human agent');
    });

    it('returns TRANSFER_QUEUED for unknown target', async () => {
      const { service } = makeService({
        prisma: {
          conversation: { findFirst: vi.fn().mockResolvedValue({ id: 'conv-1', clientId: 'client-1' }) },
          callTransfer: { create: vi.fn().mockResolvedValue({ id: 'transfer-1' }) },
          auditLog: { create: vi.fn().mockResolvedValue({}) },
        },
      });

      const result = await service.transferCall(ctx, {
        conversationId: 'conv-1',
        target: TransferTargetEnum.HUMAN_AGENT,
      });

      expect(result.success).toBe(true);
      expect(result.data!.status).toBe('TRANSFER_QUEUED');
    });
  });

  describe('sendMessageOrCallbackRequest', () => {
    it('queues callback request', async () => {
      const { service } = makeService({
        prisma: {
          idempotencyKey: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn() },
          client: { findFirst: vi.fn().mockResolvedValue({ id: 'client-1', phone: '+15551234567', email: 'test@example.com' }) },
          callbackRequest: { create: vi.fn().mockResolvedValue({ id: 'cb-1' }) },
          auditLog: { create: vi.fn().mockResolvedValue({}) },
        },
      });

      const result = await service.sendMessageOrCallbackRequest(ctx, {
        clientId: 'client-1',
        type: 'CALLBACK_REQUEST',
        message: 'Call me back',
        idempotencyKey: 'idem-1',
      });

      expect(result.success).toBe(true);
      expect(result.data!.status).toBe('QUEUED');
      expect(result.data!.requestId).toBe('cb-1');
    });

    it('sends SMS when type is SMS', async () => {
      const { service, sms } = makeService({
        prisma: {
          idempotencyKey: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn() },
          client: { findFirst: vi.fn().mockResolvedValue({ id: 'client-1', phone: '+15551234567', email: 'test@example.com' }) },
          callbackRequest: { create: vi.fn().mockResolvedValue({ id: 'cb-1' }) },
          auditLog: { create: vi.fn().mockResolvedValue({}) },
        },
        sms: { send: vi.fn().mockResolvedValue({}) },
      });

      const result = await service.sendMessageOrCallbackRequest(ctx, {
        clientId: 'client-1',
        type: 'SMS',
        message: 'Test message',
        contactValue: '+15559876543',
        idempotencyKey: 'idem-1',
      });

      expect(result.success).toBe(true);
      expect(sms.send).toHaveBeenCalledWith(
        expect.objectContaining({ to: '+15559876543', body: 'Test message' }),
      );
    });
  });

  describe('logCallOutcome', () => {
    it('logs call outcome with idempotency', async () => {
      const { service } = makeService({
        prisma: {
          idempotencyKey: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn() },
          conversation: { findFirst: vi.fn().mockResolvedValue({ id: 'conv-1', clientId: 'client-1' }) },
          callLog: { create: vi.fn().mockResolvedValue({ id: 'log-1' }) },
          auditLog: { create: vi.fn().mockResolvedValue({}) },
        },
      });

      const result = await service.logCallOutcome(ctx, {
        conversationId: 'conv-1',
        outcome: CallOutcomeEnum.COMPLETED,
        durationSeconds: '300',
        summary: 'Successful call',
        idempotencyKey: 'idem-1',
      });

      expect(result.success).toBe(true);
      expect(result.data!.status).toBe('LOGGED');
      expect(result.data!.logId).toBe('log-1');
    });

    it('returns existing log on duplicate idempotency key', async () => {
      const { service, prisma } = makeService({
        prisma: {
          idempotencyKey: {
            findUnique: vi.fn().mockResolvedValue({ resourceId: 'log-1', resourceType: 'CallLog' }),
          },
          callLog: { create: vi.fn(), findUnique: vi.fn().mockResolvedValue({ id: 'log-1' }) },
          auditLog: { create: vi.fn().mockResolvedValue({}) },
        },
      });

      const result = await service.logCallOutcome(ctx, {
        conversationId: 'conv-1',
        outcome: CallOutcomeEnum.COMPLETED,
        idempotencyKey: 'idem-1',
      });

      expect(result.success).toBe(true);
      expect(result.data!.status).toBe('EXISTS');
      expect(prisma.callLog.create).not.toHaveBeenCalled();
    });
  });

  describe('getBusinessInformation', () => {
    it('returns tenant-scoped business info with DB-backed services, faq, and hours', async () => {
      const serviceCodeFindMany = vi.fn().mockResolvedValue([
        { description: 'AI Receptionist' },
        { description: 'Lead Capture' },
      ]);
      const knowledgeArticleFindMany = vi.fn().mockResolvedValue([
        {
          title: 'Business Hours',
          body: 'Monday-Friday 9am-6pm',
          tags: ['hours'],
        },
        {
          title: 'What services do you offer?',
          body: 'We provide AI receptionist and lead capture services.',
          tags: ['faq', 'services'],
        },
      ]);

      const { service } = makeService({
        prisma: {
          organization: {
            findUnique: vi.fn().mockResolvedValue({
              name: 'Test Org',
              phone: '+15551234567',
              email: 'info@test.org',
              addressLine1: '123 Main St',
              addressLine2: 'Suite 100',
              city: 'City',
              state: 'ST',
              postalCode: '12345',
              timezone: 'America/New_York',
            }),
          },
          serviceCode: { findMany: serviceCodeFindMany },
          knowledgeArticle: { findMany: knowledgeArticleFindMany },
          auditLog: { create: vi.fn().mockResolvedValue({}) },
        },
      });

      const result = await service.getBusinessInformation(ctx);

      expect(result.success).toBe(true);
      expect(result.data!.name).toBe('Test Org');
      expect(result.data!.address).toContain('123 Main St');
      expect(result.data!.timezone).toBe('America/New_York');
      expect(result.data!.hours).toBe('Monday-Friday 9am-6pm');
      expect(result.data!.services).toEqual(['AI Receptionist', 'Lead Capture']);
      expect(result.data!.faq).toEqual([
        {
          question: 'Business Hours',
          answer: 'Monday-Friday 9am-6pm',
          tags: ['hours'],
        },
        {
          question: 'What services do you offer?',
          answer: 'We provide AI receptionist and lead capture services.',
          tags: ['faq', 'services'],
        },
      ]);

      expect(serviceCodeFindMany).toHaveBeenCalledWith({
        where: {
          organizationId: 'org-1',
          isActive: true,
        },
        select: {
          description: true,
        },
        orderBy: {
          code: 'asc',
        },
      });

      expect(knowledgeArticleFindMany).toHaveBeenCalledWith({
        where: {
          organizationId: 'org-1',
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
      });
    });

    it('returns empty services and faq with no invented hours when no business content exists', async () => {
      const { service } = makeService({
        prisma: {
          organization: {
            findUnique: vi.fn().mockResolvedValue({
              name: 'Empty Org',
              phone: null,
              email: null,
              addressLine1: null,
              addressLine2: null,
              city: null,
              state: null,
              postalCode: null,
              timezone: 'America/New_York',
            }),
          },
          serviceCode: { findMany: vi.fn().mockResolvedValue([]) },
          knowledgeArticle: { findMany: vi.fn().mockResolvedValue([]) },
          auditLog: { create: vi.fn().mockResolvedValue({}) },
        },
      });

      const result = await service.getBusinessInformation(ctx);

      expect(result.success).toBe(true);
      expect(result.data!.services).toEqual([]);
      expect(result.data!.faq).toEqual([]);
      expect(result.data!.hours).toBeUndefined();
    });
  });
});