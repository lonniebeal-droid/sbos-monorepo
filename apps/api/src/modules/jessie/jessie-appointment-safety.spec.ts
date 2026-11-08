import { describe, expect, it, vi } from 'vitest';

import { JessieIntegrationService } from './jessie-integration.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { AuditService } from '../../audit/audit.service';
import type { SmsProvider } from '../../channels/sms.provider';
import type { EmailProvider } from '../../channels/email.provider';

/**
 * Issue #57 safety suite: Jessie appointment requests must never create
 * calendar bookings (Appointment rows in calendar-counted statuses) for
 * unavailable slots. Blocked requests must persist as non-booking
 * WaitlistEntry rows instead.
 */

function makeService(prismaOverrides?: any) {
  const appointmentCreate = vi.fn().mockResolvedValue({
    id: 'appt-1',
    status: 'CONFIRMED',
    startTime: new Date('2026-11-16T10:00:00.000Z'),
  });
  const appointmentFindFirst = vi.fn().mockResolvedValue(null);
  const timeOffFindFirst = vi.fn().mockResolvedValue(null);
  const availabilityFindMany = vi.fn().mockResolvedValue([]);
  const waitlistCreate = vi.fn().mockResolvedValue({ id: 'wl-1', status: 'WAITING' });
  const waitlistFindUnique = vi.fn().mockResolvedValue(null);
  const clinicianFindFirst = vi.fn().mockResolvedValue({ id: 'clin-1' });
  const clinicianFindMany = vi.fn().mockResolvedValue([{ id: 'clin-1' }]);

  const tx = {
    appointment: { create: appointmentCreate, findFirst: appointmentFindFirst, findUnique: vi.fn() },
    clinician: { findFirst: clinicianFindFirst, findMany: clinicianFindMany },
    clinicianAvailability: { findMany: availabilityFindMany },
    clinicianTimeOff: { findFirst: timeOffFindFirst },
    waitlistEntry: { create: waitlistCreate, findUnique: waitlistFindUnique },
    idempotencyKey: { create: vi.fn(), update: vi.fn(), findUnique: vi.fn().mockResolvedValue(null) },
  };

  const prisma: any = {
    client: { findFirst: vi.fn().mockResolvedValue({ id: 'client-1' }) },
    appointment: tx.appointment,
    clinician: tx.clinician,
    clinicianAvailability: tx.clinicianAvailability,
    clinicianTimeOff: tx.clinicianTimeOff,
    waitlistEntry: tx.waitlistEntry,
    idempotencyKey: tx.idempotencyKey,
    auditLog: { create: vi.fn().mockResolvedValue({}) },
    $transaction: vi.fn(async (cb: any) => cb(tx)),
    ...prismaOverrides,
  };

  const service = new JessieIntegrationService(
    prisma as unknown as PrismaService,
    { record: vi.fn() } as unknown as AuditService,
    { send: vi.fn() } as unknown as SmsProvider,
    { send: vi.fn() } as unknown as EmailProvider,
  );

  return {
    service,
    prisma,
    tx,
    appointmentCreate,
    appointmentFindFirst,
    timeOffFindFirst,
    availabilityFindMany,
    waitlistCreate,
    waitlistFindUnique,
    clinicianFindMany,
  };
}

const ctx = { organizationId: 'org-1', userId: 'user-1', isServiceAccount: true };

const baseDto = {
  clientId: 'client-1',
  type: 'INDIVIDUAL',
  preferredStartTime: '2026-11-16T10:00:00.000Z',
  preferredClinicianId: 'clin-1',
  idempotencyKey: 'idem-safety-1',
};

describe('Jessie appointment slot safety (issue #57)', () => {
  it('does not book when the preferred clinician has an overlapping appointment', async () => {
    const s = makeService();
    s.appointmentFindFirst.mockResolvedValue({ id: 'conflict' });

    const result = await s.service.createOrRequestAppointment(ctx, baseDto);

    expect(result.success).toBe(true);
    expect(result.data!.status).toBe('REQUESTED');
    expect(result.data!.waitlistEntryId).toBe('wl-1');
    expect(s.appointmentCreate).not.toHaveBeenCalled();
    expect(s.waitlistCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ organizationId: 'org-1', status: 'WAITING' }),
      }),
    );
  });

  it('does not book when the clinician has time off covering the slot', async () => {
    const s = makeService();
    s.timeOffFindFirst.mockResolvedValue({ id: 'pto-1' });

    const result = await s.service.createOrRequestAppointment(ctx, baseDto);

    expect(result.data!.status).toBe('REQUESTED');
    expect(result.data!.waitlistEntryId).toBe('wl-1');
    expect(s.appointmentCreate).not.toHaveBeenCalled();
  });

  it('does not book outside configured weekly availability windows', async () => {
    const s = makeService();
    // 2026-11-16 is a Monday; clinician works 09:00-17:00 UTC.
    s.availabilityFindMany.mockResolvedValue([{ startTime: '09:00', endTime: '17:00' }]);
    const outsideHours = {
      ...baseDto,
      preferredStartTime: '2026-11-16T18:00:00.000Z',
    };

    const result = await s.service.createOrRequestAppointment(ctx, outsideHours);

    expect(result.data!.status).toBe('REQUESTED');
    expect(result.data!.waitlistEntryId).toBe('wl-1');
    expect(s.appointmentCreate).not.toHaveBeenCalled();
  });

  it('books inside configured weekly availability windows', async () => {
    const s = makeService();
    s.availabilityFindMany.mockResolvedValue([{ startTime: '09:00', endTime: '17:00' }]);

    const result = await s.service.createOrRequestAppointment(ctx, baseDto);

    expect(result.data!.status).toBe('CONFIRMED');
    expect(result.data!.appointmentId).toBe('appt-1');
    expect(s.waitlistCreate).not.toHaveBeenCalled();
  });

  it('waitlists without a clinician when no accepting clinician is free', async () => {
    const s = makeService();
    s.clinicianFindMany.mockResolvedValue([{ id: 'clin-1' }, { id: 'clin-2' }]);
    s.appointmentFindFirst.mockResolvedValue({ id: 'conflict' });

    const result = await s.service.createOrRequestAppointment(ctx, {
      ...baseDto,
      preferredClinicianId: undefined,
    });

    expect(result.data!.status).toBe('REQUESTED');
    expect(result.data!.waitlistEntryId).toBe('wl-1');
    expect(s.appointmentCreate).not.toHaveBeenCalled();
    const created = s.waitlistCreate.mock.calls[0][0].data;
    expect(created.clinicianId).toBeUndefined();
  });

  it('rejects when the organization has no accepting clinicians at all', async () => {
    const s = makeService();
    s.clinicianFindMany.mockResolvedValue([]);

    await expect(
      s.service.createOrRequestAppointment(ctx, {
        ...baseDto,
        preferredClinicianId: undefined,
      }),
    ).rejects.toThrow('No clinicians available to accept appointments');
  });

  it('replays a waitlisted request idempotently without creating anything new', async () => {
    const s = makeService();
    s.prisma.idempotencyKey.findUnique = vi.fn().mockResolvedValue({
      resourceId: 'wl-1',
      resourceType: 'Appointment',
    });
    s.prisma.appointment.findUnique = vi.fn().mockResolvedValue(null);
    s.waitlistFindUnique.mockResolvedValue({ id: 'wl-1', status: 'WAITING' });

    const result = await s.service.createOrRequestAppointment(ctx, baseDto);

    expect(result.success).toBe(true);
    expect(result.data!.status).toBe('REQUESTED');
    expect(result.data!.waitlistEntryId).toBe('wl-1');
    expect(s.appointmentCreate).not.toHaveBeenCalled();
    expect(s.waitlistCreate).not.toHaveBeenCalled();
  });

  it('scopes conflict, time-off and waitlist queries to the caller organization', async () => {
    const s = makeService();
    s.timeOffFindFirst.mockResolvedValue({ id: 'pto-1' });

    await s.service.createOrRequestAppointment(ctx, baseDto);

    expect(s.appointmentFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: 'org-1' }),
      }),
    );
    expect(s.timeOffFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: 'org-1' }),
      }),
    );
    // The service short-circuits on time off before checking weekly windows.
    expect(s.availabilityFindMany).not.toHaveBeenCalled();
    expect(s.waitlistCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ organizationId: 'org-1' }),
      }),
    );
  });

  it('records the block reason in the waitlist preferred notes', async () => {
    const s = makeService();
    s.appointmentFindFirst.mockResolvedValue({ id: 'conflict' });

    await s.service.createOrRequestAppointment(ctx, baseDto);

    const notes = JSON.parse(s.waitlistCreate.mock.calls[0][0].data.preferredNotes);
    expect(notes.blockReason).toBe('conflict');
    expect(notes.requestedStartTime).toBe('2026-11-16T10:00:00.000Z');
  });
});
