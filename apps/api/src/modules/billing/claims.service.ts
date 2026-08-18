import { randomUUID } from 'node:crypto';

import { Injectable, NotFoundException } from '@nestjs/common';
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

  async create(organizationId: string, actorId: string, dto: CreateClaimDto) {
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

  findOne(organizationId: string, id: string) {
    return this.ensure(organizationId, id);
  }

  async submit(organizationId: string, actorId: string, id: string) {
    const claim = await this.ensure(organizationId, id);
    const submitted = await this.prisma.claim.update({
      where: { id },
      data: { status: ClaimStatus.SUBMITTED, submittedAt: new Date() },
    });

    await this.audit.record({
      organizationId,
      actorId,
      action: AuditAction.SUBMIT,
      entityType: 'Claim',
      entityId: id,
      metadata: { claimNumber: claim.claimNumber, previousStatus: claim.status },
    });

    return submitted;
  }

  async updateStatus(
    organizationId: string,
    actorId: string,
    id: string,
    dto: UpdateClaimStatusDto,
  ) {
    const claim = await this.ensure(organizationId, id);
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

    // Claim status transitions (accept/deny/pay/appeal) are financially and
    // clinically material — always audited with the prior and new status.
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
