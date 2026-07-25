import { BadRequestException, Injectable } from '@nestjs/common';
import { minutesFromHHmm, windowsOverlap, type TimeWindow } from '@sbos/core';

import { PrismaService } from '../../prisma/prisma.service';
import { CreateAvailabilityDto, CreateTimeOffDto } from './dto/availability.dto';

@Injectable()
export class AvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  createAvailability(organizationId: string, dto: CreateAvailabilityDto) {
    if (minutesFromHHmm(dto.endTime) <= minutesFromHHmm(dto.startTime)) {
      throw new BadRequestException('endTime must be after startTime');
    }
    return this.prisma.clinicianAvailability.create({
      data: { ...dto, organizationId },
    });
  }

  listAvailability(organizationId: string, clinicianId: string) {
    return this.prisma.clinicianAvailability.findMany({
      where: { organizationId, clinicianId },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
  }

  async removeAvailability(organizationId: string, id: string) {
    const existing = await this.prisma.clinicianAvailability.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });
    if (!existing) throw new BadRequestException('Availability not found');
    await this.prisma.clinicianAvailability.delete({ where: { id } });
    return { success: true };
  }

  createTimeOff(organizationId: string, dto: CreateTimeOffDto) {
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    if (endsAt <= startsAt) {
      throw new BadRequestException('endsAt must be after startsAt');
    }
    return this.prisma.clinicianTimeOff.create({
      data: {
        organizationId,
        clinicianId: dto.clinicianId,
        reason: dto.reason,
        startsAt,
        endsAt,
      },
    });
  }

  /**
   * Compute bookable slots for a clinician on a given date. Availability windows
   * for that weekday are diced into `slotMinutes` slots; any slot overlapping an
   * existing appointment or a time-off block is removed. Times are treated as
   * UTC wall-clock; timezone-aware localization is a planned enhancement.
   */
  async getSlots(
    organizationId: string,
    clinicianId: string,
    dateStr: string,
    slotMinutes: number,
  ): Promise<TimeWindow[]> {
    const date = new Date(`${dateStr}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('date must be YYYY-MM-DD');
    }
    const dayOfWeek = date.getUTCDay();

    const availability = await this.prisma.clinicianAvailability.findMany({
      where: { organizationId, clinicianId, dayOfWeek, isActive: true },
    });
    if (availability.length === 0) return [];

    const dayStart = new Date(date);
    const dayEnd = new Date(date);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

    const [appointments, timeOff] = await Promise.all([
      this.prisma.appointment.findMany({
        where: {
          organizationId,
          clinicianId,
          status: { notIn: ['CANCELLED', 'NO_SHOW'] },
          startTime: { lt: dayEnd },
          endTime: { gt: dayStart },
        },
        select: { startTime: true, endTime: true },
      }),
      this.prisma.clinicianTimeOff.findMany({
        where: {
          organizationId,
          clinicianId,
          startsAt: { lt: dayEnd },
          endsAt: { gt: dayStart },
        },
        select: { startsAt: true, endsAt: true },
      }),
    ]);

    const busy: TimeWindow[] = [
      ...appointments.map((a) => ({ start: a.startTime, end: a.endTime })),
      ...timeOff.map((t) => ({ start: t.startsAt, end: t.endsAt })),
    ];

    const slots: TimeWindow[] = [];
    const durationMs = slotMinutes * 60_000;

    for (const window of availability) {
      const windowStartMin = minutesFromHHmm(window.startTime);
      const windowEndMin = minutesFromHHmm(window.endTime);
      let cursor = new Date(date.getTime() + windowStartMin * 60_000);
      const windowEnd = new Date(date.getTime() + windowEndMin * 60_000);

      while (cursor.getTime() + durationMs <= windowEnd.getTime()) {
        const slot: TimeWindow = {
          start: new Date(cursor.getTime()),
          end: new Date(cursor.getTime() + durationMs),
        };
        const blocked = busy.some((b) => windowsOverlap(slot, b));
        if (!blocked) slots.push(slot);
        cursor = new Date(cursor.getTime() + durationMs);
      }
    }

    return slots;
  }
}
