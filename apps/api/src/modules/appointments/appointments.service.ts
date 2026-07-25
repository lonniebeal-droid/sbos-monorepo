import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AppointmentStatus, type Prisma } from '@sbos/database';
import {
  expandRecurrence,
  type RecurrenceFrequencyName,
} from '@sbos/core';

import { paginate } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { QueryAppointmentsDto } from './dto/query-appointments.dto';
import { CreateRecurringDto } from './dto/create-recurring.dto';

@Injectable()
export class AppointmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(organizationId: string, dto: CreateAppointmentDto) {
    const start = new Date(dto.startTime);
    const end = new Date(dto.endTime);
    if (end <= start) {
      throw new BadRequestException('endTime must be after startTime');
    }

    // Prevent double-booking a clinician for an overlapping window.
    if (await this.hasConflict(organizationId, dto.clinicianId, start, end)) {
      throw new BadRequestException(
        'The clinician already has an appointment in that time window',
      );
    }

    const { startTime, endTime, ...rest } = dto;
    return this.prisma.appointment.create({
      data: {
        ...rest,
        startTime: start,
        endTime: end,
        organizationId,
      },
    });
  }

  /** True when the clinician has an overlapping non-cancelled appointment. */
  private async hasConflict(
    organizationId: string,
    clinicianId: string,
    start: Date,
    end: Date,
  ): Promise<boolean> {
    const conflict = await this.prisma.appointment.findFirst({
      where: {
        organizationId,
        clinicianId,
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        startTime: { lt: end },
        endTime: { gt: start },
      },
      select: { id: true },
    });
    return conflict !== null;
  }

  /**
   * Create a recurring series. The first occurrence is the parent; subsequent
   * occurrences reference it. Occurrences that would conflict are skipped and
   * reported so the caller can resolve them.
   */
  async createRecurring(organizationId: string, dto: CreateRecurringDto) {
    const start = new Date(dto.startTime);
    const end = new Date(dto.endTime);
    if (end <= start) {
      throw new BadRequestException('endTime must be after startTime');
    }

    const windows = expandRecurrence({
      start,
      end,
      frequency: dto.frequency as RecurrenceFrequencyName,
      count: dto.count,
    });

    const created: string[] = [];
    const skipped: string[] = [];
    let parentId: string | undefined;

    for (const window of windows) {
      if (
        await this.hasConflict(
          organizationId,
          dto.clinicianId,
          window.start,
          window.end,
        )
      ) {
        skipped.push(window.start.toISOString());
        continue;
      }
      const appointment = await this.prisma.appointment.create({
        data: {
          organizationId,
          clientId: dto.clientId,
          clinicianId: dto.clinicianId,
          locationId: dto.locationId,
          type: dto.type,
          isTelehealth: dto.isTelehealth,
          cptCode: dto.cptCode,
          durationMinutes: dto.durationMinutes,
          startTime: window.start,
          endTime: window.end,
          recurrenceFrequency: dto.frequency,
          parentAppointmentId: parentId,
        },
      });
      parentId ??= appointment.id;
      created.push(appointment.id);
    }

    return { createdCount: created.length, skipped, parentId, ids: created };
  }

  async findAll(organizationId: string, query: QueryAppointmentsDto) {
    const where: Prisma.AppointmentWhereInput = {
      organizationId,
      ...(query.clinicianId ? { clinicianId: query.clinicianId } : {}),
      ...(query.clientId ? { clientId: query.clientId } : {}),
      ...(query.from || query.to
        ? {
            startTime: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };

    const [total, data] = await Promise.all([
      this.prisma.appointment.count({ where }),
      this.prisma.appointment.findMany({
        where,
        orderBy: { startTime: 'asc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: {
          client: { select: { id: true, firstName: true, lastName: true, mrn: true } },
          location: { select: { id: true, name: true } },
        },
      }),
    ]);

    return paginate(data, total, query.page, query.limit);
  }

  async findOne(organizationId: string, id: string) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id, organizationId },
      include: { client: true, clinician: true, location: true },
    });
    if (!appointment) {
      throw new NotFoundException(`Appointment ${id} not found`);
    }
    return appointment;
  }

  async update(organizationId: string, id: string, dto: UpdateAppointmentDto) {
    await this.findOne(organizationId, id);
    const { startTime, endTime, ...rest } = dto;
    return this.prisma.appointment.update({
      where: { id },
      data: {
        ...rest,
        ...(startTime ? { startTime: new Date(startTime) } : {}),
        ...(endTime ? { endTime: new Date(endTime) } : {}),
      },
    });
  }

  /**
   * Provision (or return) a telehealth session for an appointment. Produces a
   * stable room URL derived from the appointment id; a hosted video provider
   * (e.g. Daily/Twilio Video) can replace the URL source without changing the
   * lifecycle. Marks the appointment as telehealth.
   */
  async startTelehealth(organizationId: string, id: string) {
    const appointment = await this.findOne(organizationId, id);
    const telehealthUrl =
      appointment.telehealthUrl ??
      `https://telehealth.sbos.app/session/${appointment.id}`;
    const updated = await this.prisma.appointment.update({
      where: { id },
      data: { isTelehealth: true, telehealthUrl },
    });
    return { telehealthUrl: updated.telehealthUrl, appointmentId: id };
  }

  async checkIn(organizationId: string, id: string) {
    await this.findOne(organizationId, id);
    return this.prisma.appointment.update({
      where: { id },
      data: { status: AppointmentStatus.CHECKED_IN, checkedInAt: new Date() },
    });
  }

  async checkOut(organizationId: string, id: string) {
    await this.findOne(organizationId, id);
    return this.prisma.appointment.update({
      where: { id },
      data: { status: AppointmentStatus.COMPLETED, checkedOutAt: new Date() },
    });
  }

  async cancel(organizationId: string, id: string, reason?: string) {
    await this.findOne(organizationId, id);
    return this.prisma.appointment.update({
      where: { id },
      data: { status: AppointmentStatus.CANCELLED, cancelReason: reason },
    });
  }

  async remove(organizationId: string, id: string) {
    await this.findOne(organizationId, id);
    await this.prisma.appointment.delete({ where: { id } });
    return { success: true };
  }
}
