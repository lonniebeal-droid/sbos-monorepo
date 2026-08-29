import { randomUUID } from 'node:crypto';

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { AuditAction, ClaimStatus, type Prisma } from '@sbos/database';

import { paginate, type PaginationQueryDto } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { CreateClaimDto, UpdateClaimStatusDto } from './dto/claim.dto';

@Injectable()
export class ClaimsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private claimNumber(): string {
    return `CLM-${randomUUID().slice(0, 8).toUpperCase()}`;
  }

  /**
   * Ensure the client (and optional appointment) belong to this tenant.
   * Client-supplied IDs must never cross organization boundaries.
   */
  private async ensureClientInOrg(
    organizationId: string,
    clientId: string,
  ): Promise<void> {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!client) {
      throw new NotFoundException(`Client ${clientId} not found`);
    }
  }

  private async ensureAppointmentInOrg(
    organizationId: string,
    appointmentId: string,
  ): Promise<void> {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id: appointmentId, organizationId },
      select: { id: true },
    });
    if (!appointment) {
      throw new NotFoundException(`Appointment ${appointmentId} not found`);
    }
  }

  async create(organizationId: string, actorId: string, dto: CreateClaimDto) {
    await this.ensureClientInOrg(organizationId, dto.clientId);
    if (dto.appointmentId) {
      await this.ensureAppointmentInOrg(organizationId, dto.appointmentId);
    }

    const claim = await this.prisma.claim.create({
      data: {
        organizationId,
        clientId: dto.clientId,
        insurancePolicyId: dto.insurancePolicyId,
        appointmentId: dto.appointmentId,
        cptCode: dto.cptCode,
        icd10Codes: dto.icd10Codes ?? [],
        billedAmount: dto.billedAmount,
        serviceDate: new Date(dto.serviceDate),
        claimNumber: this.claimNumber(),
        status: ClaimStatus.DRAFT,
      },
    });

    await this.audit.record({
      organizationId,
      actorId,
      action: AuditAction.CREATE,
      entityType: 'Claim',
      entityId: claim.id,
      metadata: {
        claimNumber: claim.claimNumber,
        cptCode: claim.cptCode,
        billedAmount: dto.billedAmount,
      },
    });

    return claim;
  }

  async findAll(organizationId: string, query: PaginationQueryDto) {
    const where: Prisma.ClaimWhereInput = {
      organizationId,
      ...(query.search
        ? { claimNumber: { contains: query.search, mode: 'insensitive' } }
        : {}),
    };
    const [total, data] = await Promise.all([
      this.prisma.claim.count({ where }),
      this.prisma.claim.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: {
          client: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
    ]);
    return paginate(data, total, query.page, query.limit);
  }

  private async ensure(organizationId: string, id: string) {
    const claim = await this.prisma.claim.findFirst({
      where: { id, organizationId },
    });
    if (!claim) throw new NotFoundException(`Claim ${id} not found`);
    return claim;
  }

  async findOne(organizationId: string, id: string) {
    return this.ensure(organizationId, id);
  }

  async updateStatus(
    organizationId: string,
    actorId: string,
    id: string,
    dto: UpdateClaimStatusDto,
  ) {
    const claim = await this.ensure(organizationId, id);

    const statusOrder: ClaimStatus[] = [
      ClaimStatus.DRAFT,
      ClaimStatus.READY,
      ClaimStatus.SUBMITTED,
      ClaimStatus.ACCEPTED,
      ClaimStatus.DENIED,
      ClaimStatus.PARTIALLY_PAID,
      ClaimStatus.PAID,
      ClaimStatus.APPEALED,
      ClaimStatus.VOID,
    ];
    const currentIndex = statusOrder.indexOf(claim.status as ClaimStatus);
    const newIndex = statusOrder.indexOf(dto.status as ClaimStatus);
    if (newIndex === -1) throw new BadRequestException('Invalid claim status');
    if (newIndex < currentIndex) {
      throw new BadRequestException('Invalid status transition');
    }

    if (dto.status === ClaimStatus.PAID && (dto.paidAmount === undefined || dto.paidAmount <= 0)) {
      throw new BadRequestException('paidAmount must be provided and > 0 when marking PAID');
    }

    const data: Prisma.ClaimUpdateInput = {
      status: dto.status as ClaimStatus,
      denialReason: dto.denialReason,
    };
    if (dto.paidAmount !== undefined) {
      data.paidAmount = dto.paidAmount;
    }
    if (dto.status === 'PAID') {
      data.paidAt = new Date();
    }
    const updated = await this.prisma.claim.update({ where: { id }, data });

    await this.audit.record({
      organizationId,
      actorId,
      action: AuditAction.UPDATE,
      entityType: 'Claim',
      entityId: id,
      metadata: {
        claimNumber: claim.claimNumber,
        previousStatus: claim.status,
        newStatus: dto.status,
        denialReason: dto.denialReason,
        paidAmount: dto.paidAmount,
      },
    });

    return updated;
  }
}
