import { describe, expect, it, vi } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppConfig } from '../../../config/configuration';
import { AgentToolsGuard } from './agent-tools.guard';
import { AgentToolsService } from './agent-tools.service';

const org = 'org1';
const otherOrg = 'org2';

function makeService(overrides?: {
  prisma?: Record<string, unknown>;
  appointments?: Record<string, unknown>;
  availability?: Record<string, unknown>;
  sms?: Record<string, unknown>;
  email?: Record<string, unknown>;
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
    user: { findFirst: vi.fn() },
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

  const service = new AgentToolsService(
    prisma as never,
    appointments as never,
    availability as never,
    sms as never,
    email as never,
  );

  return { service, prisma, appointments, availability, sms, email };
}

describe('AgentToolsGuard', () => {
  it('rejects missing credentials', () => {
    const config = {
      get: vi.fn().mockReturnValue({ secrets: { secret1: org } }),
    } as unknown as ConfigService<AppConfig, true>;
    const guard = new AgentToolsGuard(config);
    const req = { header: vi.fn().mockReturnValue(undefined) };
    expect(() =>
      guard.canActivate({
        switchToHttp: () => ({ getRequest: () => req }),
      } as never),
    ).toThrow(UnauthorizedException);
  });

  it('rejects invalid credentials', () => {
    const config = {
      get: vi.fn().mockReturnValue({ secrets: { secret1: org } }),
    } as unknown as ConfigService<AppConfig, true>;
    const guard = new AgentToolsGuard(config);
    const req = {
      header: vi.fn((h: string) =>
        h === 'x-sbos-agent-secret' ? 'wrong' : undefined,
      ),
    };
    expect(() =>
      guard.canActivate({
        switchToHttp: () => ({ getRequest: () => req }),
      } as never),
    ).toThrow(UnauthorizedException);
  });

  it('resolves organization from secret map (never from body)', () => {
    const config = {
      get: vi.fn().mockReturnValue({ secrets: { secret1: org } }),
    } as unknown as ConfigService<AppConfig, true>;
    const guard = new AgentToolsGuard(config);
    const req: Record<string, unknown> = {
      header: vi.fn((h: string) =>
        h === 'x-sbos-agent-secret' ? 'secret1' : undefined,
      ),
      body: { organizationId: otherOrg },
    };
    expect(
      guard.canActivate({
        switchToHttp: () => ({ getRequest: () => req }),
      } as never),
    ).toBe(true);
    expect(req.agentOrganizationId).toBe(org);
  });
});

describe('AgentToolsService', () => {
  it('lookup_client returns same-org client by id', async () => {
    const { service, prisma } = makeService();
    prisma.client.findFirst.mockResolvedValue({
      id: 'c1',
      firstName: 'Jordan',
      lastName: 'Lee',
      email: 'j@example.com',
      phone: '+1555',
      status: 'ACTIVE',
    });
    const res = await service.lookupClient(org, { clientId: 'c1' });
    expect(res.ok).toBe(true);
    expect(res.data?.found).toBe(true);
    expect((res.data?.clients as unknown[])?.[0]).toMatchObject({
      id: 'c1',
      name: 'Jordan Lee',
    });
  });

  it('lookup_client rejects cross-tenant clientId', async () => {
    const { service, prisma } = makeService();
    prisma.client.findFirst.mockResolvedValue(null);
    const res = await service.lookupClient(org, { clientId: 'foreign' });
    expect(res.ok).toBe(false);
    expect(res.error).toBe('not_found');
  });

  it('save_or_update_lead creates prospect with org context', async () => {
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
      email: 'a@example.com',
    });
    expect(res.ok).toBe(true);
    expect(res.data?.action).toBe('created');
    expect(prisma.client.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ organizationId: org }),
      }),
    );
  });

  it('save_or_update_lead rejects cross-tenant clientId with no write', async () => {
    const { service, prisma } = makeService();
    prisma.client.findFirst.mockResolvedValue(null);
    const res = await service.saveOrUpdateLead(org, {
      clientId: 'foreign',
      firstName: 'A',
      lastName: 'B',
    });
    expect(res.ok).toBe(false);
    expect(prisma.client.update).not.toHaveBeenCalled();
  });

  it('check_calendar returns slots for same-org clinician', async () => {
    const { service, prisma, availability } = makeService();
    prisma.clinician.findFirst.mockResolvedValue({ id: 'cl1' });
    const res = await service.checkCalendar(org, {
      clinicianId: 'cl1',
      date: '2026-09-01',
    });
    expect(res.ok).toBe(true);
    expect(res.data?.slotCount).toBe(1);
    expect(availability.getSlots).toHaveBeenCalledWith(
      org,
      'cl1',
      '2026-09-01',
      50,
    );
  });

  it('check_calendar rejects foreign clinician', async () => {
    const { service, prisma, availability } = makeService();
    prisma.clinician.findFirst.mockResolvedValue(null);
    const res = await service.checkCalendar(org, {
      clinicianId: 'foreign',
      date: '2026-09-01',
    });
    expect(res.ok).toBe(false);
    expect(availability.getSlots).not.toHaveBeenCalled();
  });

  it('schedule_appointment books after ownership checks', async () => {
    const { service, prisma, appointments } = makeService();
    prisma.client.findFirst.mockResolvedValue({
      id: 'c1',
      firstName: 'J',
      lastName: 'L',
      email: null,
      phone: null,
      status: 'ACTIVE',
    });
    prisma.clinician.findFirst.mockResolvedValue({ id: 'cl1' });
    const res = await service.scheduleAppointment(org, {
      clientId: 'c1',
      clinicianId: 'cl1',
      startTime: '2026-09-01T14:00:00.000Z',
      endTime: '2026-09-01T14:50:00.000Z',
      durationMinutes: 50,
    });
    expect(res.ok).toBe(true);
    expect(res.data?.appointmentId).toBe('appt1');
    expect(appointments.create).toHaveBeenCalled();
  });

  it('schedule_appointment rejects cross-tenant client with no write', async () => {
    const { service, prisma, appointments } = makeService();
    prisma.client.findFirst.mockResolvedValue(null);
    const res = await service.scheduleAppointment(org, {
      clientId: 'foreign',
      clinicianId: 'cl1',
      startTime: '2026-09-01T14:00:00.000Z',
      endTime: '2026-09-01T14:50:00.000Z',
      durationMinutes: 50,
    });
    expect(res.ok).toBe(false);
    expect(appointments.create).not.toHaveBeenCalled();
  });

  it('schedule_appointment returns schedule_failed on provider conflict', async () => {
    const { service, prisma, appointments } = makeService({
      appointments: {
        create: vi.fn().mockRejectedValue(new Error('conflict')),
      },
    });
    prisma.client.findFirst.mockResolvedValue({
      id: 'c1',
      firstName: 'J',
      lastName: 'L',
      email: null,
      phone: null,
      status: 'ACTIVE',
    });
    prisma.clinician.findFirst.mockResolvedValue({ id: 'cl1' });
    const res = await service.scheduleAppointment(org, {
      clientId: 'c1',
      clinicianId: 'cl1',
      startTime: '2026-09-01T14:00:00.000Z',
      endTime: '2026-09-01T14:50:00.000Z',
      durationMinutes: 50,
    });
    expect(res.ok).toBe(false);
    expect(res.error).toBe('schedule_failed');
  });

  it('send_sms succeeds via provider', async () => {
    const { service, sms } = makeService();
    const res = await service.sendSms(org, {
      to: '+15552001010',
      body: 'Hello',
    });
    expect(res.ok).toBe(true);
    expect(res.data?.messageId).toBe('sms1');
    expect(sms.send).toHaveBeenCalled();
  });

  it('send_sms rejects foreign clientId with no send', async () => {
    const { service, prisma, sms } = makeService();
    prisma.client.findFirst.mockResolvedValue(null);
    const res = await service.sendSms(org, {
      to: '+15552001010',
      body: 'Hello',
      clientId: 'foreign',
    });
    expect(res.ok).toBe(false);
    expect(sms.send).not.toHaveBeenCalled();
  });

  it('send_sms returns provider_error on failure', async () => {
    const { service } = makeService({
      sms: { send: vi.fn().mockRejectedValue(new Error('twilio down')) },
    });
    const res = await service.sendSms(org, {
      to: '+15552001010',
      body: 'Hello',
    });
    expect(res.ok).toBe(false);
    expect(res.error).toBe('provider_error');
  });

  it('send_email succeeds via provider', async () => {
    const { service, email } = makeService();
    const res = await service.sendEmail(org, {
      to: 'a@example.com',
      subject: 'Hi',
      body: 'Body',
    });
    expect(res.ok).toBe(true);
    expect(res.data?.messageId).toBe('em1');
    expect(email.send).toHaveBeenCalled();
  });

  it('transfer_to_human creates high-priority task', async () => {
    const { service, prisma } = makeService();
    prisma.user.findFirst.mockResolvedValue({ id: 'u1' });
    prisma.task.create.mockResolvedValue({
      id: 't1',
      status: 'OPEN',
      priority: 'HIGH',
      assigneeId: null,
    });
    const res = await service.transferToHuman(org, {
      reason: 'Caller asked for front desk',
    });
    expect(res.ok).toBe(true);
    expect(res.data?.taskId).toBe('t1');
    expect(prisma.task.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: org,
          priority: 'HIGH',
          status: 'OPEN',
        }),
      }),
    );
  });

  it('transfer_to_human rejects foreign client with no write', async () => {
    const { service, prisma } = makeService();
    prisma.client.findFirst.mockResolvedValue(null);
    const res = await service.transferToHuman(org, {
      reason: 'Help',
      clientId: 'foreign',
    });
    expect(res.ok).toBe(false);
    expect(prisma.task.create).not.toHaveBeenCalled();
  });

  it('idempotency replays prior result without side effects', async () => {
    const prior = {
      ok: true,
      tool: 'send_sms',
      data: { messageId: 'prior' },
    };
    const { service, prisma, sms } = makeService();
    prisma.auditLog.create.mockRejectedValue(
      Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }),
    );
    prisma.auditLog.findFirst.mockResolvedValue({
      id: 'prior-claim',
      metadata: { status: 'completed', result: prior },
    });
    const res = await service.sendSms(org, {
      to: '+1555',
      body: 'x',
      idempotencyKey: 'k1',
    });
    expect(res.ok).toBe(true);
    expect(res.idempotentReplay).toBe(true);
    expect(res.data?.messageId).toBe('prior');
    expect(sms.send).not.toHaveBeenCalled();
  });

  it('claims then completes idempotency record after successful side effect', async () => {
    const { service, prisma } = makeService();
    await service.sendSms(org, {
      to: '+15552001010',
      body: 'Hello',
      idempotencyKey: 'k2',
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: org,
          entityType: 'JessieAgentTool',
          entityId: 'send_sms:k2',
          metadata: expect.objectContaining({
            status: 'pending',
            tool: 'send_sms',
          }),
        }),
      }),
    );
    expect(prisma.auditLog.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'claim-1' },
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            status: 'completed',
            ok: true,
          }),
        }),
      }),
    );
  });

  it('lookup_client by email stays within org', async () => {
    const { service, prisma } = makeService();
    prisma.client.findMany.mockResolvedValue([
      {
        id: 'c2',
        firstName: 'Sam',
        lastName: 'Kim',
        email: 'sam@example.com',
        phone: null,
        status: 'ACTIVE',
      },
    ]);
    const res = await service.lookupClient(org, { email: 'sam@example.com' });
    expect(res.ok).toBe(true);
    expect(prisma.client.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: org }),
      }),
    );
  });
});

describe('AgentToolsService — conversation context', () => {
  it('same-org conversationId succeeds and is stored in audit metadata', async () => {
    const { service, prisma } = makeService();
    prisma.conversation.findFirst.mockResolvedValue({ id: 'conv1' });
    prisma.client.findFirst.mockResolvedValue({
      id: 'c1',
      firstName: 'Jordan',
      lastName: 'Lee',
      email: 'j@example.com',
      phone: '+1555',
      status: 'ACTIVE',
    });
    const res = await service.lookupClient(org, {
      clientId: 'c1',
      conversationId: 'conv1',
      idempotencyKey: 'k-conv-1',
    });
    expect(res.ok).toBe(true);
    expect(prisma.conversation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'conv1', organizationId: org },
      }),
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            tool: 'lookup_client',
            conversationId: 'conv1',
            idempotencyKey: 'k-conv-1',
            status: 'pending',
          }),
        }),
      }),
    );
  });

  it('sessionId alias is accepted as conversation context', async () => {
    const { service, prisma } = makeService();
    prisma.conversation.findFirst.mockResolvedValue({ id: 'conv2' });
    prisma.client.findMany.mockResolvedValue([]);
    const res = await service.lookupClient(org, {
      name: 'Nobody',
      sessionId: 'conv2',
    });
    expect(res.ok).toBe(true);
    expect(prisma.conversation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'conv2', organizationId: org },
      }),
    );
  });

  it('cross-org conversationId is rejected', async () => {
    const { service, prisma } = makeService();
    prisma.conversation.findFirst.mockResolvedValue(null);
    const res = await service.lookupClient(org, {
      clientId: 'c1',
      conversationId: 'foreign-conv',
    });
    expect(res.ok).toBe(false);
    expect(res.error).toBe('not_found');
    expect(prisma.client.findFirst).not.toHaveBeenCalled();
  });

  it('unknown conversationId is rejected', async () => {
    const { service, prisma } = makeService();
    prisma.conversation.findFirst.mockResolvedValue(null);
    const res = await service.saveOrUpdateLead(org, {
      firstName: 'A',
      lastName: 'B',
      conversationId: 'missing',
    });
    expect(res.ok).toBe(false);
    expect(res.error).toBe('not_found');
    expect(prisma.client.create).not.toHaveBeenCalled();
    expect(prisma.client.update).not.toHaveBeenCalled();
  });

  it('no business write after conversation validation failure', async () => {
    const { service, prisma, appointments, sms } = makeService();
    prisma.conversation.findFirst.mockResolvedValue(null);
    const r1 = await service.scheduleAppointment(org, {
      clientId: 'c1',
      clinicianId: 'cl1',
      startTime: '2026-09-01T14:00:00.000Z',
      endTime: '2026-09-01T14:50:00.000Z',
      durationMinutes: 50,
      conversationId: 'bad',
    });
    expect(r1.ok).toBe(false);
    expect(appointments.create).not.toHaveBeenCalled();

    const r2 = await service.sendSms(org, {
      to: '+15551212',
      body: 'hi',
      conversationId: 'bad',
    });
    expect(r2.ok).toBe(false);
    expect(sms.send).not.toHaveBeenCalled();
  });

  it('idempotent replay remains scoped and skips side effects', async () => {
    const { service, prisma, appointments } = makeService();
    prisma.auditLog.create.mockRejectedValue(
      Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }),
    );
    prisma.auditLog.findFirst.mockResolvedValue({
      id: 'replay-claim',
      metadata: {
        status: 'completed',
        result: {
          ok: true,
          tool: 'schedule_appointment',
          data: { appointmentId: 'appt-replay' },
        },
      },
    });
    const res = await service.scheduleAppointment(org, {
      clientId: 'c1',
      clinicianId: 'cl1',
      startTime: '2026-09-01T14:00:00.000Z',
      endTime: '2026-09-01T14:50:00.000Z',
      durationMinutes: 50,
      conversationId: 'conv1',
      idempotencyKey: 'k-replay',
    });
    expect(res.ok).toBe(true);
    expect(res.idempotentReplay).toBe(true);
    expect(appointments.create).not.toHaveBeenCalled();
    expect(prisma.conversation.findFirst).not.toHaveBeenCalled();
  });
});

describe('AgentToolsGuard — secret hygiene', () => {
  it('error messages never include the presented secret', () => {
    const config = {
      get: vi.fn().mockReturnValue({ secrets: { secret1: org } }),
    } as unknown as ConfigService<AppConfig, true>;
    const guard = new AgentToolsGuard(config);
    const presented = 'super-secret-value-should-not-leak';
    const req = {
      header: vi.fn((h: string) =>
        h === 'x-sbos-agent-secret' ? presented : undefined,
      ),
    };
    try {
      guard.canActivate({
        switchToHttp: () => ({ getRequest: () => req }),
      } as never);
      throw new Error('expected throw');
    } catch (err) {
      const msg = (err as Error).message;
      expect(msg).not.toContain(presented);
      expect(msg).toMatch(/Invalid agent credentials|Unauthorized/i);
    }
  });
});

describe('AgentToolsService — atomic idempotency concurrency', () => {
  it('two concurrent same-key requests invoke SMS side effect only once', async () => {
    const { service, prisma, sms } = makeService();
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
          tool: 'send_sms',
          data: { messageId: 'sms1', provider: 'console', to: '+1555' },
        },
      },
    });

    const key = 'concurrent-key-1';
    const [a, b] = await Promise.all([
      service.sendSms(org, { to: '+1555', body: 'hi', idempotencyKey: key }),
      service.sendSms(org, { to: '+1555', body: 'hi', idempotencyKey: key }),
    ]);

    expect(sms.send).toHaveBeenCalledTimes(1);
    expect(a.ok || b.ok).toBe(true);
  });

  it('different idempotency keys execute independently', async () => {
    const { service, prisma, sms } = makeService();
    let n = 0;
    prisma.auditLog.create.mockImplementation(async () => {
      n += 1;
      return { id: `claim-${n}` };
    });
    await service.sendSms(org, { to: '+1555', body: 'a', idempotencyKey: 'k-a' });
    await service.sendSms(org, { to: '+1555', body: 'b', idempotencyKey: 'k-b' });
    expect(sms.send).toHaveBeenCalledTimes(2);
  });

  it('agent schedule_appointment passes null actor and agent audit metadata', async () => {
    const { service, prisma, appointments } = makeService();
    prisma.client.findFirst.mockResolvedValue({
      id: 'c1',
      firstName: 'J',
      lastName: 'L',
      email: null,
      phone: null,
      status: 'ACTIVE',
    });
    prisma.clinician.findFirst.mockResolvedValue({ id: 'cl1' });
    await service.scheduleAppointment(org, {
      clientId: 'c1',
      clinicianId: 'cl1',
      startTime: '2026-09-01T14:00:00.000Z',
      endTime: '2026-09-01T14:50:00.000Z',
      durationMinutes: 50,
      idempotencyKey: 'book-1',
    });
    expect(appointments.create).toHaveBeenCalledWith(
      org,
      null,
      expect.objectContaining({ clientId: 'c1', clinicianId: 'cl1' }),
      expect.objectContaining({
        actorType: 'jessie_agent',
        tool: 'schedule_appointment',
        idempotencyKey: 'book-1',
      }),
    );
  });

  it('pending claim returns idempotency_in_progress without side effect', async () => {
    const { service, prisma, sms } = makeService();
    prisma.auditLog.create.mockRejectedValue(
      Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }),
    );
    prisma.auditLog.findFirst.mockResolvedValue({
      id: 'claim-pending',
      metadata: { status: 'pending', tool: 'send_sms', idempotencyKey: 'k-pending' },
    });
    const res = await service.sendSms(org, {
      to: '+1555',
      body: 'hi',
      idempotencyKey: 'k-pending',
    });
    expect(res.ok).toBe(false);
    expect(res.error).toBe('idempotency_in_progress');
    expect(sms.send).not.toHaveBeenCalled();
  });

  it('failed provider result is stored and replayed for the same key', async () => {
    const { service, prisma, sms } = makeService();
    sms.send.mockRejectedValueOnce(new Error('twilio down'));
    prisma.auditLog.create.mockResolvedValue({ id: 'claim-fail' });
    const first = await service.sendSms(org, {
      to: '+1555',
      body: 'hi',
      idempotencyKey: 'k-fail-1',
    });
    expect(first.ok).toBe(false);
    expect(first.error).toBe('provider_error');
    expect(prisma.auditLog.update).toHaveBeenCalled();
    expect(sms.send).toHaveBeenCalledTimes(1);

    prisma.auditLog.create.mockRejectedValue(
      Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }),
    );
    prisma.auditLog.findFirst.mockResolvedValue({
      id: 'claim-fail',
      metadata: {
        status: 'failed',
        result: { ok: false, tool: 'send_sms', error: 'provider_error', message: 'twilio down' },
      },
    });
    const second = await service.sendSms(org, {
      to: '+1555',
      body: 'hi',
      idempotencyKey: 'k-fail-1',
    });
    expect(second.ok).toBe(false);
    expect(second.error).toBe('provider_error');
    expect(second.idempotentReplay).toBe(true);
    expect(sms.send).toHaveBeenCalledTimes(1);
  });

  it('new idempotency key retries after provider failure', async () => {
    const { service, prisma, sms } = makeService();
    let n = 0;
    prisma.auditLog.create.mockImplementation(async () => {
      n += 1;
      return { id: `claim-${n}` };
    });
    sms.send.mockRejectedValueOnce(new Error('twilio down'));
    const fail = await service.sendSms(org, {
      to: '+1555',
      body: 'a',
      idempotencyKey: 'k-old',
    });
    expect(fail.ok).toBe(false);

    sms.send.mockResolvedValueOnce({ id: 'sms-retry', provider: 'console' });
    const ok = await service.sendSms(org, {
      to: '+1555',
      body: 'a',
      idempotencyKey: 'k-new',
    });
    expect(ok.ok).toBe(true);
    expect(ok.data?.messageId).toBe('sms-retry');
    expect(sms.send).toHaveBeenCalledTimes(2);
  });

  it('same idempotency key is isolated across organizations', async () => {
    const { service, prisma, sms } = makeService();
    let creates: string[] = [];
    prisma.auditLog.create.mockImplementation(async (args: { data: { organizationId: string } }) => {
      creates.push(args.data.organizationId);
      return { id: `claim-${args.data.organizationId}` };
    });
    await service.sendSms(org, { to: '+1555', body: 'a', idempotencyKey: 'shared-key' });
    await service.sendSms(otherOrg, { to: '+1555', body: 'b', idempotencyKey: 'shared-key' });
    expect(sms.send).toHaveBeenCalledTimes(2);
    expect(creates).toEqual([org, otherOrg]);
  });
});
