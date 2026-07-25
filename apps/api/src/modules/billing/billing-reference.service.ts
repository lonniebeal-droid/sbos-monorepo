import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import {
  CreatePayerDto,
  CreateServiceCodeDto,
  UpdatePayerDto,
  UpdateServiceCodeDto,
} from './dto/reference.dto';

/** Reference/config data for billing: payers and the CPT fee schedule. */
@Injectable()
export class BillingReferenceService {
  constructor(private readonly prisma: PrismaService) {}

  // ----- Payers -----

  createPayer(organizationId: string, dto: CreatePayerDto) {
    return this.prisma.payer.create({ data: { ...dto, organizationId } });
  }

  listPayers(organizationId: string) {
    return this.prisma.payer.findMany({
      where: { organizationId },
      orderBy: { name: 'asc' },
    });
  }

  async updatePayer(organizationId: string, id: string, dto: UpdatePayerDto) {
    await this.ensurePayer(organizationId, id);
    return this.prisma.payer.update({ where: { id }, data: dto });
  }

  private async ensurePayer(organizationId: string, id: string) {
    const payer = await this.prisma.payer.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });
    if (!payer) throw new NotFoundException(`Payer ${id} not found`);
  }

  // ----- Service codes (fee schedule) -----

  createServiceCode(organizationId: string, dto: CreateServiceCodeDto) {
    return this.prisma.serviceCode.create({
      data: { ...dto, organizationId },
    });
  }

  listServiceCodes(organizationId: string) {
    return this.prisma.serviceCode.findMany({
      where: { organizationId },
      orderBy: { code: 'asc' },
    });
  }

  async updateServiceCode(
    organizationId: string,
    id: string,
    dto: UpdateServiceCodeDto,
  ) {
    const existing = await this.prisma.serviceCode.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException(`Service code ${id} not found`);
    return this.prisma.serviceCode.update({ where: { id }, data: dto });
  }
}
