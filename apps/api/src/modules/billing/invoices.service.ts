import { randomUUID } from 'node:crypto';

import { Injectable, NotFoundException } from '@nestjs/common';
import { InvoiceStatus } from '@sbos/database';
import { roundCurrency } from '@sbos/core';

import { PrismaService } from '../../prisma/prisma.service';
import { CreateInvoiceDto } from './dto/invoice.dto';

@Injectable()
export class InvoicesService {
  constructor(private readonly prisma: PrismaService) {}

  private invoiceNumber(): string {
    return `INV-${randomUUID().slice(0, 8).toUpperCase()}`;
  }

  create(organizationId: string, dto: CreateInvoiceDto) {
    const lineItems = dto.lineItems.map((item) => {
      const quantity = item.quantity ?? 1;
      const amount = roundCurrency(quantity * item.unitPrice);
      return {
        description: item.description,
        cptCode: item.cptCode,
        quantity,
        unitPrice: item.unitPrice,
        amount,
      };
    });

    const subtotal = roundCurrency(
      lineItems.reduce((sum, item) => sum + item.amount, 0),
    );
    const tax = roundCurrency(dto.tax ?? 0);
    const total = roundCurrency(subtotal + tax);

    return this.prisma.invoice.create({
      data: {
        organizationId,
        clientId: dto.clientId,
        invoiceNumber: this.invoiceNumber(),
        status: InvoiceStatus.OPEN,
        subtotal,
        tax,
        total,
        amountPaid: 0,
        balanceDue: total,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        lineItems: { create: lineItems },
      },
      include: { lineItems: true },
    });
  }

  findForClient(organizationId: string, clientId: string) {
    return this.prisma.invoice.findMany({
      where: { organizationId, clientId },
      orderBy: { createdAt: 'desc' },
      include: { lineItems: true },
    });
  }

  async findOne(organizationId: string, id: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, organizationId },
      include: { lineItems: true, payments: true },
    });
    if (!invoice) throw new NotFoundException(`Invoice ${id} not found`);
    return invoice;
  }
}
