import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AppointmentStatus, AuditAction, type Prisma } from '@sbos/database';
import {
  expandRecurrence,
  type RecurrenceFrequencyName,
} from '@sbos/core';

import { paginate } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { SMS_PROVIDER, type SmsProvider } from '../../channels/sms.provider';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { QueryAppointmentsDto } from './dto/query-appointments.dto';
import { CreateRecurringDto } from './dto/create-recurring.dto';

@Injectable()
export class AppointmentsService {
  private readonly logger = new Logger(AppointmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(SMS_PROVIDER) private readonly sms: SmsProvider,
  ) {}

  /** Ensure the client exists in this org (and is not soft-deleted). */
  private async ensureClientInOrg(organizationId: string, clientId: string) {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!client) {
      throw new NotFoundException(`Client ${clientId} not found`);
    }
    return client;
  }

  /** Best-effort appointment confirmation SMS (no-op with the console provider). */
  private async sendConfirmation(clientId: string, start: Date): Promise<void> {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      select: { phone: true, firstName: true },
    });
    if (!client?.phone) return;
    await this.sms
      .send({
        to: client.phone,
        body: `Hi ${client.firstName}, your appointment is confirmed for ${start.toLocaleString()}. Reply STOP to opt out.`,
      })
      .catch((error) =>
        this.logger.warn(`Confirmation SMS failed: ${String(error)}`),
      );
  }

  async create(organizationId: string, actorId: string, dto: CreateAppointmentDto) {
    const start = new Date(dto.startTime);
    const end = new Date(dto.endTime);
    if (end <= start) {
      throw new BadRequestException('endTime must be after startTime');
    }

    await this.ensureClientInOrg(organizationId, dto.clientId);

    // Prevent double-booking a clinician for an overlapping window.
    if (await this.hasConflict(organizationId, dto.clinicianId, start, end)) {
      throw new BadRequestException(
        'The clinician already has an appointment in that time window',
      );
    }

    const { startTime, endTime, ...rest } = dto;
    const appointment = await this.prisma.appointment.create({
      data: {
        ...rest,
        startTime: start,
        endTime: end,
        organizationId,
      },
    });

    await this.audit.record({
      organizationId,
      actorId,
      action: AuditAction.CREATE,
      entityType: 'Appointment',
      entityId: appointment.id,
      metadata: {
        clientId: appointment.clientId,
        clinicianId: appointment.clinicianId,
        startTime: appointment.startTime,
      },
    });

    void this.sendConfirmation(dto.clientId, start);
    return appointment;
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

    await this.ensureClientInOrg(organizationId, dto.clientId);

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

  async update(
    organizationId: string,
    actorId: string,
    id: string,
    dto: UpdateAppointmentDto,
  ) {
    await this.findOne(organizationId, id);
    if (dto.clientId) {
      await this.ensureClientInOrg(organizationId, dto.clientId);
    }
    const { startTime, endTime, ...rest } = dto;
    const updated = await this.prisma.appointment.update({
      where: { id },
      data: {
        ...rest,
        ...(startTime ? { startTime: new Date(startTime) } : {}),
        ...(endTime ? { endTime: new Date(endTime) } : {}),
      },
    });

    await this.audit.record({
      organizationId,
      actorId,
      action: AuditAction.UPDATE,
      entityType: 'Appointment',
      entityId: id,
      metadata: { changedFields: Object.keys(dto) },
    });

    return updated;
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

  async checkIn(organizationId: string, actorId: string, id: string) {
    const existing = await this.findOne(organizationId, id);
    const updated = await this.prisma.appointment.update({
      where: { id },
      data: { status: AppointmentStatus.CHECKED_IN, checkedInAt: new Date() },
    });

    await this.audit.record({
      organizationId,
      actorId,
      action: AuditAction.UPDATE,
      entityType: 'Appointment',
      entityId: id,
      metadata: {
        previousStatus: existing.status,
        newStatus: AppointmentStatus.CHECKED_IN,
      },
    });

    return updated;
  }

  async checkOut(organizationId: string, actorId: string, id: string) {
    const existing = await this.findOne(organizationId, id);
    const updated = await this.prisma.appointment.update({
      where: { id },
      data: { status: AppointmentStatus.COMPLETED, checkedOutAt: new Date() },
    });

    await this.audit.record({
      organizationId,
      actorId,
      action: AuditAction.UPDATE,
      entityType: 'Appointment',
      entityId: id,
      metadata: {
        previousStatus: existing.status,
        newStatus: AppointmentStatus.COMPLETED,
      },
    });

    return updated;
  }

  async cancel(organizationId: string, actorId: string, id: string, reason?: string) {
    const existing = await this.findOne(organizationId, id);
    const updated = await this.prisma.appointment.update({
      where: { id },
      data: { status: AppointmentStatus.CANCELLED, cancelReason: reason },
    });

    await this.audit.record({
      organizationId,
      actorId,
      action: AuditAction.UPDATE,
      entityType: 'Appointment',
      entityId: id,
      metadata: { previousStatus: existing.status, newStatus: 'CANCELLED', reason },
    });

    return updated;
  }

  async remove(organizationId: string, actorId: string, id: string) {
    const existing = await this.findOne(organizationId, id);
    await this.prisma.appointment.delete({ where: { id } });

    await this.audit.record({
      organizationId,
      actorId,
      action: AuditAction.DELETE,
      entityType: 'Appointment',
      entityId: id,
      metadata: { clientId: existing.clientId, startTime: existing.startTime },
    });

    return { success: true };
  }
}
