import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, type Prisma } from '@sbos/database';

import {
  paginate,
  type PaginationQueryDto,
} from '../../common/dto/pagination.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import {
  EMAIL_PROVIDER,
  type EmailProvider,
} from '../../channels/email.provider';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@Injectable()
export class ClientsService {
  private readonly logger = new Logger(ClientsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(EMAIL_PROVIDER) private readonly email: EmailProvider,
  ) {}

  async create(organizationId: string, actorId: string, dto: CreateClientDto) {
    const existing = await this.prisma.client.findFirst({
      where: { organizationId, mrn: dto.mrn },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(`MRN ${dto.mrn} already exists`);
    }

    const { dateOfBirth, ...rest } = dto;
    const client = await this.prisma.client.create({
      data: {
        ...rest,
        dateOfBirth: new Date(dateOfBirth),
        organizationId,
      },
    });

    // Best-effort welcome email (no-op with the console provider).
    if (client.email) {
      void this.email
        .send({
          to: client.email,
          subject: 'Welcome to your care team',
          text: `Hi ${client.firstName}, your client record has been created. Your care team will be in touch to schedule your first appointment.`,
        })
        .catch((error) =>
          this.logger.warn(`Welcome email failed: ${String(error)}`),
        );
    }

    await this.audit.record({
      organizationId,
      actorId,
      action: AuditAction.CREATE,
      entityType: 'Client',
      entityId: client.id,
      metadata: { mrn: client.mrn },
    });

    return client;
  }

  async findAll(
    organizationId: string,
    query: PaginationQueryDto,
    includeDeleted = false,
  ) {
    const where: Prisma.ClientWhereInput = {
      organizationId,
      ...(includeDeleted ? {} : { deletedAt: null }),
      ...(query.search
        ? {
            OR: [
              { firstName: { contains: query.search, mode: 'insensitive' } },
              { lastName: { contains: query.search, mode: 'insensitive' } },
              { mrn: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, data] = await Promise.all([
      this.prisma.client.count({ where }),
      this.prisma.client.findMany({
        where,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: {
          primaryClinician: {
            select: { id: true, title: true, user: { select: { firstName: true, lastName: true } } },
          },
        },
      }),
    ]);

    return paginate(data, total, query.page, query.limit);
  }

  async findOne(organizationId: string, id: string, includeDeleted = false) {
    const client = await this.prisma.client.findFirst({
      where: {
        id,
        organizationId,
        ...(includeDeleted ? {} : { deletedAt: null }),
      },
      include: {
        diagnoses: true,
        insurancePolicies: true,
        treatmentPlans: { include: { goals: { include: { objectives: true } } } },
      },
    });
    if (!client) {
      throw new NotFoundException(`Client ${id} not found`);
    }
    return client;
  }

  async update(
    organizationId: string,
    actorId: string,
    id: string,
    dto: UpdateClientDto,
  ) {
    await this.findOne(organizationId, id);
    const { dateOfBirth, ...rest } = dto;
    const updated = await this.prisma.client.update({
      where: { id },
      data: {
        ...rest,
        ...(dateOfBirth ? { dateOfBirth: new Date(dateOfBirth) } : {}),
      },
    });

    await this.audit.record({
      organizationId,
      actorId,
      action: AuditAction.UPDATE,
      entityType: 'Client',
      entityId: id,
      metadata: { changedFields: Object.keys(dto) },
    });

    return updated;
  }

  async remove(organizationId: string, actorId: string, id: string) {
    const existing = await this.findOne(organizationId, id);
    await this.prisma.client.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.audit.record({
      organizationId,
      actorId,
      action: AuditAction.DELETE,
      entityType: 'Client',
      entityId: id,
      metadata: { mrn: existing.mrn, softDelete: true },
    });

    return { success: true };
  }
}
