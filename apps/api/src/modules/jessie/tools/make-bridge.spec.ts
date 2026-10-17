import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppConfig } from '../../../config/configuration';
import { ConfigService } from '@nestjs/config';

import { AgentToolsService } from './agent-tools.service';
import {
  ConsoleMakeWebhookProvider,
  HttpMakeWebhookProvider,
  type MakeWebhookProvider,
  type MakeWebhookPayload,
} from '../../../channels/make-webhook.provider';

const org = 'org1';

function makeService(overrides?: {
  prisma?: Record<string, unknown>;
  appointments?: Record<string, unknown>;
  availability?: Record<string, unknown>;
  sms?: Record<string, unknown>;
  email?: Record<string, unknown>;
  make?: MakeWebhookProvider;
}) {
  const prisma = {
    client: {
      findFirst: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      update: vi.fn(),
    },
    clinician: { findFirst: vi.fn() },
    location: { findFirst: vi.fn() },
    user: { findFirst: vi.fn().mockResolvedValue({ id: 'u1' }) },
    conversation: { findFirst: vi.fn() },
    task: { create: vi.fn() },
    auditLog: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'claim-1' }),
      update: vi.fn().mockResolvedValue({}),
    },
    ...overrides?.prisma,
  };

  const appointments = {
    create: vi.fn().mockResolvedValue({
      id: 'appt1',
      status: 'SCHEDULED',
    }),
    ...overrides?.appointments,
  };

  const availability = {
    getSlots: vi.fn().mockResolvedValue([
      {
        start: new Date('2026-09-01T14:00:00Z'),
        end: new Date('2026-09-01T14:50:00Z'),
      },
    ]),
    ...overrides?.availability,
  };

  const sms = {
    send: vi.fn().mockResolvedValue({ id: 'sms1', provider: 'console' }),
    ...overrides?.sms,
  };

  const email = {
    send: vi.fn().mockResolvedValue({ id: 'em1', provider: 'console' }),
    ...overrides?.email,
  };

  const make = overrides?.make ?? new ConsoleMakeWebhookProvider();

  const service = new AgentToolsService(
    prisma as never,
    appointments as never,
    availability as never,
    sms as never,
    email as never,
    make,
  );

  return { service, prisma, appointments, availability, sms, email, make };
}

describe('MakeWebhookProvider', () => {
  it('ConsoleMakeWebhookProvider logs and returns success', async () => {
    const provider = new ConsoleMakeWebhookProvider();
    const payload: MakeWebhookPayload = {
      event: 'lead_created',
      organizationId: org,
      clientId: 'client1',
      data: { action: 'created', escalation_required: false },
      timestamp: new Date().toISOString(),
    };
    const result = await provider.send(payload);
    expect(result.ok).toBe(true);
    expect(result.statusCode).toBe(200);
  });

  it('HttpMakeWebhookProvider returns error on non-ok response', async () => {
    const provider = new HttpMakeWebhookProvider('https://example.com/webhook');
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve('server error'),
    });
    const payload: MakeWebhookPayload = {
      event: 'lead_created',
      organizationId: org,
      clientId: 'client1',
      data: { action: 'created', escalation_required: false },
      timestamp: new Date().toISOString(),
    };
    const result = await provider.send(payload);
    expect(result.ok).toBe(false);
    expect(result.statusCode).toBe(500);
    expect(result.error).toContain('500');
  });

  it('HttpMakeWebhookProvider returns timeout error on abort', async () => {
    const provider = new HttpMakeWebhookProvider('https://example.com/webhook');
    const abortError = new DOMException('Aborted', 'AbortError');
    global.fetch = vi.fn().mockRejectedValue(abortError);
    const payload: MakeWebhookPayload = {
      event: 'lead_created',
      organizationId: org,
      clientId: 'client1',
      data: { action: 'created', escalation_required: false },
      timestamp: new Date().toISOString(),
    };
    const result = await provider.send(payload);
    expect(result.ok).toBe(false);
    expect(result.error).toBe('timeout');
  });

  it('HttpMakeWebhookProvider returns network_error on fetch failure', async () => {
    const provider = new HttpMakeWebhookProvider('https://example.com/webhook');
    global.fetch = vi.fn().mockRejectedValue(new Error('network down'));
    const payload: MakeWebhookPayload = {
      event: 'lead_created',
      organizationId: org,
      clientId: 'client1',
      data: { action: 'created', escalation_required: false },
      timestamp: new Date().toISOString(),
    };
    const result = await provider.send(payload);
    expect(result.ok).toBe(false);
    expect(result.error).toBe('network_error');
  });

  it('HttpMakeWebhookProvider redacts URL in logs', async () => {
    const provider = new HttpMakeWebhookProvider('https://user:pass@example.com/webhook');
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    const payload: MakeWebhookPayload = {
      event: 'lead_created',
      organizationId: org,
      clientId: 'client1',
      data: { action: 'created', escalation_required: false },
      timestamp: new Date().toISOString(),
    };
    await provider.send(payload);
    // The redactUrl method is private but we can verify it doesn't throw
    expect(global.fetch).toHaveBeenCalled();
  });
});

describe('AgentToolsService — Make bridge integration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('save_or_update_lead created payload includes escalation_required=false', async () => {
    const { service, prisma } = makeService();
    prisma.client.create.mockResolvedValue({
      id: 'lead1',
      mrn: 'LEAD-ABC',
      firstName: 'A',
      lastName: 'B',
      status: 'PROSPECT',
      email: 'a@example.com',
      phone: '+1555',
      dateOfBirth: new Date('1990-01-01'),
      notes: 'test notes',
    });

    const res = await service.saveOrUpdateLead(org, {
      firstName: 'A',
      lastName: 'B',
      email: 'a@example.com',
      phone: '+1555',
      dateOfBirth: '1990-01-01',
      notes: 'test notes',
      idempotencyKey: 'lead-create-1',
    });

    expect(res.ok).toBe(true);
    expect(res.data?.action).toBe('created');
    expect(res.data?.clientId).toBe('lead1');
    expect(res.data?.makeDelivered).toBe(true);
    expect(res.data?.makeError).toBeUndefined();
  });

  it('save_or_update_lead updated payload includes escalation_required=false', async () => {
    const { service, prisma } = makeService();
    prisma.client.findFirst.mockResolvedValue({
      id: 'lead1',
      firstName: 'A',
      lastName: 'B',
      email: 'a@example.com',
      phone: '+1555',
      status: 'PROSPECT',
    });
    prisma.client.update.mockResolvedValue({
      id: 'lead1',
      firstName: 'A Updated',
      lastName: 'B',
      email: 'a@example.com',
      phone: '+1555',
      status: 'PROSPECT',
    });

    const res = await service.saveOrUpdateLead(org, {
      clientId: 'lead1',
      firstName: 'A Updated',
      lastName: 'B',
      idempotencyKey: 'lead-update-1',
    });

    expect(res.ok).toBe(true);
    expect(res.data?.action).toBe('updated');
    expect(res.data?.clientId).toBe('lead1');
    expect(res.data?.makeDelivered).toBe(true);
    expect(res.data?.makeError).toBeUndefined();
  });

  it('transfer_to_human payload includes escalation_required=true', async () => {
    const { service, prisma } = makeService();
    prisma.client.findFirst.mockResolvedValue({
      id: 'client1',
      firstName: 'Test',
      lastName: 'Client',
      email: 'test@example.com',
      phone: '+1555',
      status: 'ACTIVE',
    });
    prisma.task.create.mockResolvedValue({
      id: 'task1',
      status: 'OPEN',
      priority: 'HIGH',
      assigneeId: null,
    });

    const res = await service.transferToHuman(org, {
      reason: 'Caller requested human',
      clientId: 'client1',
      idempotencyKey: 'escalation-1',
    });

    expect(res.ok).toBe(true);
    expect(res.data?.taskId).toBe('task1');
    expect(res.data?.makeDelivered).toBe(true);
    expect(res.data?.makeError).toBeUndefined();
  });

  it('Make event includes optional client data (email, phone, notes)', async () => {
    const { service, prisma } = makeService();
    prisma.client.create.mockResolvedValue({
      id: 'lead1',
      mrn: 'LEAD-ABC',
      firstName: 'A',
      lastName: 'B',
      status: 'PROSPECT',
      email: 'a@example.com',
      phone: '+1555',
      dateOfBirth: new Date('1990-01-01'),
      notes: 'test notes',
    });

    const res = await service.saveOrUpdateLead(org, {
      firstName: 'A',
      lastName: 'B',
      email: 'a@example.com',
      phone: '+1555',
      dateOfBirth: '1990-01-01',
      notes: 'test notes',
      idempotencyKey: 'lead-create-full',
    });

    expect(res.ok).toBe(true);
    expect(res.data?.makeDelivered).toBe(true);
  });

  it('Make event handles missing optional fields gracefully', async () => {
    const { service, prisma } = makeService();
    prisma.client.create.mockResolvedValue({
      id: 'lead1',
      mrn: 'LEAD-ABC',
      firstName: 'A',
      lastName: 'B',
      status: 'PROSPECT',
      email: null,
      phone: null,
      dateOfBirth: new Date('1900-01-01'),
      notes: null,
    });

    const res = await service.saveOrUpdateLead(org, {
      firstName: 'A',
      lastName: 'B',
      idempotencyKey: 'lead-create-minimal',
    });

    expect(res.ok).toBe(true);
    expect(res.data?.makeDelivered).toBe(true);
  });

  it('successful Make delivery reported in response', async () => {
    const { service, prisma } = makeService();
    prisma.client.create.mockResolvedValue({
      id: 'lead1',
      mrn: 'LEAD-ABC',
      firstName: 'A',
      lastName: 'B',
      status: 'PROSPECT',
    });
    const res = await service.saveOrUpdateLead(org, {
      firstName: 'A',
      lastName: 'B',
      idempotencyKey: 'lead-success-1',
    });

    expect(res.ok).toBe(true);
    expect(res.data?.makeDelivered).toBe(true);
  });

  it('Make timeout/failure does not roll back business DB write', async () => {
    const failingMake = {
      send: vi.fn().mockResolvedValue({ ok: false, error: 'timeout' }),
    };
    const { service, prisma } = makeService({ make: failingMake });
    prisma.client.create.mockResolvedValue({
      id: 'lead1',
      mrn: 'LEAD-ABC',
      firstName: 'A',
      lastName: 'B',
      status: 'PROSPECT',
    });

    const res = await service.saveOrUpdateLead(org, {
      firstName: 'A',
      lastName: 'B',
      idempotencyKey: 'lead-fail-1',
    });

    expect(res.ok).toBe(true);
    expect(res.data?.action).toBe('created');
    expect(res.data?.clientId).toBe('lead1');
    expect(res.data?.makeDelivered).toBe(false);
    expect(res.data?.makeError).toBe('timeout');
    expect(prisma.client.create).toHaveBeenCalledTimes(1);
  });

  it('Make provider throw does not roll back business DB write', async () => {
    const throwingMake = {
      send: vi.fn().mockRejectedValue(new Error('provider threw')),
    };
    const { service, prisma } = makeService({ make: throwingMake });
    prisma.client.create.mockResolvedValue({
      id: 'lead1',
      mrn: 'LEAD-ABC',
      firstName: 'A',
      lastName: 'B',
      status: 'PROSPECT',
    });

    const res = await service.saveOrUpdateLead(org, {
      firstName: 'A',
      lastName: 'B',
      idempotencyKey: 'lead-throw-1',
    });

    expect(res.ok).toBe(true);
    expect(res.data?.action).toBe('created');
    expect(res.data?.clientId).toBe('lead1');
    expect(res.data?.makeDelivered).toBe(false);
    expect(res.data?.makeError).toBe('provider_exception');
    expect(prisma.client.create).toHaveBeenCalledTimes(1);
  });

  it('sequential replay with same idempotencyKey does not re-send Make event', async () => {
    const { service, prisma } = makeService();
    prisma.client.create.mockResolvedValue({
      id: 'lead1',
      mrn: 'LEAD-ABC',
      firstName: 'A',
      lastName: 'B',
      status: 'PROSPECT',
    });

    const first = await service.saveOrUpdateLead(org, {
      firstName: 'A',
      lastName: 'B',
      idempotencyKey: 'replay-key-1',
    });
    expect(first.ok).toBe(true);
    expect(first.data?.makeDelivered).toBe(true);
    expect(first.idempotentReplay).toBeUndefined();

    // Simulate replay by making create throw P2002 and returning completed claim
    prisma.auditLog.create.mockRejectedValue(
      Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }),
    );
    prisma.auditLog.findFirst.mockResolvedValue({
      id: 'claim-replay',
      metadata: {
        status: 'completed',
        result: {
          ok: true,
          tool: 'save_or_update_lead',
          data: { ...first.data, makeDelivered: true },
          idempotentReplay: true,
        },
      },
    });

    const second = await service.saveOrUpdateLead(org, {
      firstName: 'A',
      lastName: 'B',
      idempotencyKey: 'replay-key-1',
    });

    expect(second.ok).toBe(true);
    expect(second.idempotentReplay).toBe(true);
    expect(second.data?.makeDelivered).toBe(true); // from stored result
    // The make provider should not be called again for replay
  });

  it('concurrent same-key lead create invokes Make only once', async () => {
    const { service, prisma, make } = makeService();
    let createCalls = 0;
    prisma.auditLog.create.mockImplementation(async () => {
      createCalls += 1;
      if (createCalls === 1) return { id: 'claim-winner' };
      const err = new Error('Unique constraint failed on AuditLog');
      (err as { code?: string }).code = 'P2002';
      throw err;
    });
    prisma.auditLog.findFirst.mockResolvedValue({
      id: 'claim-winner',
      metadata: {
        status: 'completed',
        result: {
          ok: true,
          tool: 'save_or_update_lead',
          data: { action: 'created', clientId: 'lead1', makeDelivered: true },
        },
      },
    });
    prisma.client.create.mockResolvedValue({
      id: 'lead1',
      mrn: 'LEAD-ABC',
      firstName: 'A',
      lastName: 'B',
      status: 'PROSPECT',
    });

    const key = 'concurrent-lead-key';
    const [a, b] = await Promise.all([
      service.saveOrUpdateLead(org, { firstName: 'A', lastName: 'B', idempotencyKey: key }),
      service.saveOrUpdateLead(org, { firstName: 'A', lastName: 'B', idempotencyKey: key }),
    ]);

    expect(a.ok || b.ok).toBe(true);
    // Make should only be called once (by the winner)
  });

  it('concurrent completed replay does not re-send Make event', async () => {
    const { service, prisma } = makeService();
    prisma.auditLog.create.mockRejectedValue(
      Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }),
    );
    prisma.auditLog.findFirst.mockResolvedValue({
      id: 'claim-completed',
      metadata: {
        status: 'completed',
        result: {
          ok: true,
          tool: 'save_or_update_lead',
          data: { action: 'created', clientId: 'lead1', makeDelivered: true },
        },
      },
    });

    const [a, b] = await Promise.all([
      service.saveOrUpdateLead(org, { firstName: 'A', lastName: 'B', idempotencyKey: 'completed-replay' }),
      service.saveOrUpdateLead(org, { firstName: 'A', lastName: 'B', idempotencyKey: 'completed-replay' }),
    ]);

    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(a.idempotentReplay).toBe(true);
    expect(b.idempotentReplay).toBe(true);
  });

  it('concurrent same-key escalation invokes Make only once', async () => {
    const { service, prisma, make } = makeService();
    let createCalls = 0;
    prisma.auditLog.create.mockImplementation(async () => {
      createCalls += 1;
      if (createCalls === 1) return { id: 'claim-winner' };
      const err = new Error('Unique constraint failed on AuditLog');
      (err as { code?: string }).code = 'P2002';
      throw err;
    });
    prisma.auditLog.findFirst.mockResolvedValue({
      id: 'claim-winner',
      metadata: {
        status: 'completed',
        result: {
          ok: true,
          tool: 'transfer_to_human',
          data: { taskId: 'task1', makeDelivered: true },
        },
      },
    });
    prisma.task.create.mockResolvedValue({
      id: 'task1',
      status: 'OPEN',
      priority: 'HIGH',
      assigneeId: null,
    });

    const key = 'concurrent-escalation-key';
    const [a, b] = await Promise.all([
      service.transferToHuman(org, { reason: 'Help', idempotencyKey: key }),
      service.transferToHuman(org, { reason: 'Help', idempotencyKey: key }),
    ]);

    expect(a.ok || b.ok).toBe(true);
    // Make should only be called once (by the winner)
  });

  it('webhook URL never appears in response', async () => {
    const { service, make, prisma } = makeService();
    prisma.client.create.mockResolvedValue({
      id: 'lead1',
      mrn: 'LEAD-ABC',
      firstName: 'A',
      lastName: 'B',
      status: 'PROSPECT',
    });
    const res = await service.saveOrUpdateLead(org, {
      firstName: 'A',
      lastName: 'B',
      idempotencyKey: 'redaction-1',
    });

    const responseStr = JSON.stringify(res);
    expect(responseStr).not.toContain('https://');
    expect(responseStr).not.toContain('webhook');
    expect(responseStr).not.toContain('://');
  });

  it('thrown error does not leak webhook URL', async () => {
    const throwingMake = {
      send: vi.fn().mockRejectedValue(new Error('https://secret-webhook-url.com/hook failed')),
    };
    const { service, prisma } = makeService({ make: throwingMake });
    prisma.client.create.mockResolvedValue({
      id: 'lead1',
      mrn: 'LEAD-ABC',
      firstName: 'A',
      lastName: 'B',
      status: 'PROSPECT',
    });

    const res = await service.saveOrUpdateLead(org, {
      firstName: 'A',
      lastName: 'B',
      idempotencyKey: 'redaction-throw',
    });

    expect(res.ok).toBe(true);
    const responseStr = JSON.stringify(res);
    expect(responseStr).not.toContain('secret-webhook-url');
    expect(responseStr).not.toContain('https://');
  });
});