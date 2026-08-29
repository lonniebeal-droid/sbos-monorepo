import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AppointmentStatus, AuditAction } from '@sbos/database';
import { describe, expect, it, vi } from 'vitest';

import { AppointmentsService } from './appointments.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { AuditService } from '../../audit/audit.service';
import type { SmsProvider } from '../../channels/sms.provider';
import { RecurrenceFrequencyDto } from './dto/create-recurring.dto';

function makeService(overrides?: { prisma?: Record<string, unknown> }) {
  const prisma = {
    client: {
      findUnique: vi.fn().mockResolvedValue(null),
      findFirst: vi.fn().mockResolvedValue({ id: 'c1' }),
    },
    appointment: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    ...overrides?.prisma,
  } as unknown as PrismaService;
  const audit = { record: vi.fn() } as unknown as AuditService;
  const sms = { send: vi.fn().mockResolvedValue({ id: 's1', provider: 'test' }) } as unknown as SmsProvider;
  return { service: new AppointmentsService(prisma, audit, sms), prisma, audit, sms };
}

const validDto = {
  clientId: 'c1',
  clinicianId: 'cl1',
  startTime: '2026-09-01T13:00:00.000Z',
  endTime: '2026-09-01T13:50:00.000Z',
  durationMinutes: 50,
};

describe('AppointmentsService.create', () => {
  it('throws BadRequestException when endTime is not after startTime', async () => {
    const { service, prisma } = makeService();

    await expect(
      service.create('org1', 'actor1', {
        ...validDto,
        endTime: validDto.startTime,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.appointment.create).not.toHaveBeenCalled();
  });

  it('throws NotFoundException and never creates when clientId is outside the org', async () => {
    const { service, prisma } = makeService({
      prisma: {
        client: {
          findUnique: vi.fn().mockResolvedValue(null),
          findFirst: vi.fn().mockResolvedValue(null),
        },
      },
    });

    await expect(service.create('org1', 'actor1', {
      ...validDto,
      clientId: 'foreign-client',
    })).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.appointment.create).not.toHaveBeenCalled();
  });

  it('throws BadRequestException and never creates when the clinician already has an overlapping appointment', async () => {
    const { service, prisma } = makeService({
      prisma: {
        appointment: {
          findFirst: vi.fn().mockResolvedValue({ id: 'existing' }),
          findMany: vi.fn(),
          count: vi.fn(),
          create: vi.fn(),
          update: vi.fn(),
          delete: vi.fn(),
        },
      },
    });

    await expect(service.create('org1', 'actor1', validDto)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.appointment.create).not.toHaveBeenCalled();
  });

  it('creates the appointment, records a CREATE audit entry, and returns it when there is no conflict', async () => {
    const created = { id: 'appt1', clientId: 'c1', clinicianId: 'cl1', startTime: new Date(validDto.startTime) };
    const { service, prisma, audit } = makeService({
      prisma: {
        appointment: {
          findFirst: vi.fn().mockResolvedValue(null),
          findMany: vi.fn(),
          count: vi.fn(),
          create: vi.fn().mockResolvedValue(created),
          update: vi.fn(),
          delete: vi.fn(),
        },
      },
    });

    const result = await service.create('org1', 'actor1', validDto);

    expect(prisma.client.findFirst).toHaveBeenCalledWith({
      where: { id: 'c1', organizationId: 'org1', deletedAt: null },
      select: { id: true },
    });
    expect(prisma.appointment.create).toHaveBeenCalledTimes(1);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org1',
        actorId: 'actor1',
        action: AuditAction.CREATE,
        entityType: 'Appointment',
        entityId: 'appt1',
      }),
    );
    expect(result).toBe(created);
  });

  it('sends a best-effort confirmation SMS when the client has a phone on file', async () => {
    const created = { id: 'appt1', clientId: 'c1', clinicianId: 'cl1', startTime: new Date(validDto.startTime) };
    const { service, sms } = makeService({
      prisma: {
        client: {
          findFirst: vi.fn().mockResolvedValue({ id: 'c1' }),
          findUnique: vi.fn().mockResolvedValue({ phone: '+15555550100', firstName: 'Riley' }),
        },
        appointment: {
          findFirst: vi.fn().mockResolvedValue(null),
          findMany: vi.fn(),
          count: vi.fn(),
          create: vi.fn().mockResolvedValue(created),
          update: vi.fn(),
          delete: vi.fn(),
        },
      },
    });

    await service.create('org1', 'actor1', validDto);
    // sendConfirmation is fire-and-forget (not awaited by create()); flush
    // the microtask queue so its two internal awaits resolve before asserting.
    await Promise.resolve();
    await Promise.resolve();

    expect(sms.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: '+15555550100' }),
    );
  });

  it('does not attempt to send a confirmation SMS when the client has no phone on file', async () => {
    const created = { id: 'appt1', clientId: 'c1', clinicianId: 'cl1', startTime: new Date(validDto.startTime) };
    const { service, sms } = makeService({
      prisma: {
        client: {
          findFirst: vi.fn().mockResolvedValue({ id: 'c1' }),
          findUnique: vi.fn().mockResolvedValue({ phone: null, firstName: 'Riley' }),
        },
        appointment: {
          findFirst: vi.fn().mockResolvedValue(null),
          findMany: vi.fn(),
          count: vi.fn(),
          create: vi.fn().mockResolvedValue(created),
          update: vi.fn(),
          delete: vi.fn(),
        },
      },
    });

    await service.create('org1', 'actor1', validDto);
    await Promise.resolve();
    await Promise.resolve();

    expect(sms.send).not.toHaveBeenCalled();
  });
});

describe('AppointmentsService.createRecurring', () => {
  it('throws NotFoundException and never creates when clientId is outside the org', async () => {
    const { service, prisma } = makeService({
      prisma: {
        client: {
          findUnique: vi.fn().mockResolvedValue(null),
          findFirst: vi.fn().mockResolvedValue(null),
        },
      },
    });

    await expect(
      service.createRecurring('org1', {
        ...validDto,
        clientId: 'foreign-client',
        frequency: RecurrenceFrequencyDto.WEEKLY,
        count: 3,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.appointment.create).not.toHaveBeenCalled();
  });

  it('links occurrences to a parent, skips conflicting windows, and reports both', async () => {
    let callCount = 0;
    const findFirst = vi.fn().mockImplementation(() => {
      callCount += 1;
      // Second occurrence conflicts; all others are free.
      return Promise.resolve(callCount === 2 ? { id: 'conflict' } : null);
    });
    const create = vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({ id: `appt-${create.mock.calls.length}`, ...data }),
    );
    const { service, prisma } = makeService({
      prisma: {
        appointment: {
          findFirst,
          findMany: vi.fn(),
          count: vi.fn(),
          create,
          update: vi.fn(),
          delete: vi.fn(),
        },
      },
    });

    const result = await service.createRecurring('org1', {
      ...validDto,
      frequency: RecurrenceFrequencyDto.WEEKLY,
      count: 3,
    });

    expect(prisma.appointment.create).toHaveBeenCalledTimes(2);
    expect(result.createdCount).toBe(2);
    expect(result.skipped).toHaveLength(1);
    expect(result.parentId).toBe('appt-1');

    const secondCreateData = create.mock.calls[1][0].data;
    expect(secondCreateData.parentAppointmentId).toBe('appt-1');
    // The first create is the parent itself and must not self-reference.
    const firstCreateData = create.mock.calls[0][0].data;
    expect(firstCreateData.parentAppointmentId).toBeUndefined();
  });
});

describe('AppointmentsService.update', () => {
  it('rejects reassignment to a foreign-org clientId without updating', async () => {
    const existing = { id: 'appt1', clientId: 'c1' };
    const { service, prisma } = makeService({
      prisma: {
        client: {
          findUnique: vi.fn().mockResolvedValue(null),
          findFirst: vi.fn().mockResolvedValue(null),
        },
        appointment: {
          findFirst: vi.fn().mockResolvedValue(existing),
          findMany: vi.fn(),
          count: vi.fn(),
          create: vi.fn(),
          update: vi.fn(),
          delete: vi.fn(),
        },
      },
    });

    await expect(
      service.update('org1', 'actor1', 'appt1', { clientId: 'foreign-client' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.appointment.update).not.toHaveBeenCalled();
  });
});

describe('AppointmentsService.findOne', () => {
  it('throws NotFoundException when no appointment matches the id/org', async () => {
    const { service } = makeService({
      prisma: {
        appointment: {
          findFirst: vi.fn().mockResolvedValue(null),
          findMany: vi.fn(),
          count: vi.fn(),
          create: vi.fn(),
          update: vi.fn(),
          delete: vi.fn(),
        },
      },
    });

    await expect(service.findOne('org1', 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('AppointmentsService.startTelehealth', () => {
  it('generates and persists a stable room URL when none exists yet', async () => {
    const existing = { id: 'appt1', telehealthUrl: null };
    const updated = { id: 'appt1', telehealthUrl: 'https://telehealth.sbos.app/session/appt1' };
    const { service, prisma } = makeService({
      prisma: {
        appointment: {
          findFirst: vi.fn().mockResolvedValue(existing),
          findMany: vi.fn(),
          count: vi.fn(),
          create: vi.fn(),
          update: vi.fn().mockResolvedValue(updated),
          delete: vi.fn(),
        },
      },
    });

    const result = await service.startTelehealth('org1', 'appt1');

    expect(prisma.appointment.update).toHaveBeenCalledWith({
      where: { id: 'appt1' },
      data: {
        isTelehealth: true,
        telehealthUrl: 'https://telehealth.sbos.app/session/appt1',
      },
    });
    expect(result).toEqual({
      telehealthUrl: 'https://telehealth.sbos.app/session/appt1',
      appointmentId: 'appt1',
    });
  });

  it('reuses the existing room URL instead of generating a new one', async () => {
    const existing = { id: 'appt1', telehealthUrl: 'https://existing.example/room/1' };
    const { service, prisma } = makeService({
      prisma: {
        appointment: {
          findFirst: vi.fn().mockResolvedValue(existing),
          findMany: vi.fn(),
          count: vi.fn(),
          create: vi.fn(),
          update: vi.fn().mockResolvedValue(existing),
          delete: vi.fn(),
        },
      },
    });

    await service.startTelehealth('org1', 'appt1');

    expect(prisma.appointment.update).toHaveBeenCalledWith({
      where: { id: 'appt1' },
      data: { isTelehealth: true, telehealthUrl: 'https://existing.example/room/1' },
    });
  });
});

describe('AppointmentsService.cancel', () => {
  it('sets status to CANCELLED, stores the reason, and audits the transition', async () => {
    const existing = { id: 'appt1', status: AppointmentStatus.SCHEDULED };
    const updated = { id: 'appt1', status: AppointmentStatus.CANCELLED, cancelReason: 'client request' };
    const { service, prisma, audit } = makeService({
      prisma: {
        appointment: {
          findFirst: vi.fn().mockResolvedValue(existing),
          findMany: vi.fn(),
          count: vi.fn(),
          create: vi.fn(),
          update: vi.fn().mockResolvedValue(updated),
          delete: vi.fn(),
        },
      },
    });

    const result = await service.cancel('org1', 'actor1', 'appt1', 'client request');

    expect(prisma.appointment.update).toHaveBeenCalledWith({
      where: { id: 'appt1' },
      data: { status: AppointmentStatus.CANCELLED, cancelReason: 'client request' },
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.UPDATE,
        entityType: 'Appointment',
        entityId: 'appt1',
        metadata: expect.objectContaining({
          previousStatus: AppointmentStatus.SCHEDULED,
          newStatus: 'CANCELLED',
          reason: 'client request',
        }),
      }),
    );
    expect(result).toBe(updated);
  });
});

describe('AppointmentsService.remove', () => {
  it('deletes the appointment and records a DELETE audit entry', async () => {
    const existing = { id: 'appt1', clientId: 'c1', startTime: new Date(validDto.startTime) };
    const { service, prisma, audit } = makeService({
      prisma: {
        appointment: {
          findFirst: vi.fn().mockResolvedValue(existing),
          findMany: vi.fn(),
          count: vi.fn(),
          create: vi.fn(),
          update: vi.fn(),
          delete: vi.fn().mockResolvedValue(existing),
        },
      },
    });

    const result = await service.remove('org1', 'actor1', 'appt1');

    expect(prisma.appointment.delete).toHaveBeenCalledWith({ where: { id: 'appt1' } });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.DELETE,
        entityType: 'Appointment',
        entityId: 'appt1',
        metadata: expect.objectContaining({ clientId: 'c1' }),
      }),
    );
    expect(result).toEqual({ success: true });
  });

  it('throws NotFoundException and never deletes/audits a missing appointment', async () => {
    const { service, prisma, audit } = makeService({
      prisma: {
        appointment: {
          findFirst: vi.fn().mockResolvedValue(null),
          findMany: vi.fn(),
          count: vi.fn(),
          create: vi.fn(),
          update: vi.fn(),
          delete: vi.fn(),
        },
      },
    });

    await expect(service.remove('org1', 'actor1', 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.appointment.delete).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });
});
