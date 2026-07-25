import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

/**
 * Generates a superbill — an itemized statement a client can submit to their
 * insurer for out-of-network reimbursement — from claims in a date range.
 */
@Injectable()
export class SuperbillsService {
  constructor(private readonly prisma: PrismaService) {}

  async generate(
    organizationId: string,
    clientId: string,
    fromStr: string,
    toStr: string,
  ) {
    const from = new Date(fromStr);
    const to = new Date(toStr);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new BadRequestException('from and to must be valid ISO dates');
    }

    const [organization, client, claims] = await Promise.all([
      this.prisma.organization.findUnique({ where: { id: organizationId } }),
      this.prisma.client.findFirst({
        where: { id: clientId, organizationId },
      }),
      this.prisma.claim.findMany({
        where: {
          organizationId,
          clientId,
          serviceDate: { gte: from, lte: to },
        },
        orderBy: { serviceDate: 'asc' },
      }),
    ]);

    if (!client) throw new NotFoundException(`Client ${clientId} not found`);

    const lineItems = claims.map((claim) => ({
      serviceDate: claim.serviceDate,
      cptCode: claim.cptCode,
      diagnoses: claim.icd10Codes,
      billedAmount: Number(claim.billedAmount),
      paidAmount: Number(claim.paidAmount),
    }));

    const total = lineItems.reduce((sum, item) => sum + item.billedAmount, 0);

    return {
      provider: organization
        ? {
            name: organization.name,
            npi: organization.npi,
            taxId: organization.taxId,
            address: organization.addressLine1,
            city: organization.city,
            state: organization.state,
          }
        : null,
      client: {
        name: `${client.firstName} ${client.lastName}`,
        mrn: client.mrn,
        dateOfBirth: client.dateOfBirth,
      },
      period: { from, to },
      lineItems,
      total: Math.round(total * 100) / 100,
      generatedAt: new Date(),
    };
  }
}
