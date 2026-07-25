import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@sbos/database';

import { paginate } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { QueryAppointmentsDto } from './dto/query-appointments.dto';

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
    const conflict = await this.prisma.appointment.findFirst({
      where: {
        organizationId,
        clinicianId: dto.clinicianId,
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        startTime: { lt: end },
        endTime: { gt: start },
      },
      select: { id: true },
    });
    if (conflict) {
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

  async remove(organizationId: string, id: string) {
    await this.findOne(organizationId, id);
    await this.prisma.appointment.delete({ where: { id } });
    return { success: true };
  }
}
