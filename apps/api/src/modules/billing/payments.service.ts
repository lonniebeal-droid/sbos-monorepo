import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  AuditAction,
  InvoiceStatus,
  PaymentMethod,
  PaymentStatus,
} from '@sbos/database';

import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import {
  PAYMENT_PROVIDER,
  type PaymentProvider,
} from '../../payments/payment-provider.interface';
import { RecordPaymentDto } from './dto/invoice.dto';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
  ) {}

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }

  /**
   * Record a payment: charge via the configured provider, persist the payment,
   * and (when applied to an invoice) recompute the invoice balance/status.
   */
  async record(
    organizationId: string,
    userId: string,
    dto: RecordPaymentDto,
  ) {
    // Card/ACH route through the provider; cash/check/adjustment are manual.
    const charge = await this.provider.charge({
      organizationId,
      amount: dto.amount,
      reference: dto.reference,
      description: `Payment for client ${dto.clientId}`,
    });

    const payment = await this.prisma.payment.create({
      data: {
        organizationId,
        clientId: dto.clientId,
        invoiceId: dto.invoiceId,
        claimId: dto.claimId,
        method: dto.method as PaymentMethod,
        status:
          charge.status === 'SUCCEEDED'
            ? PaymentStatus.SUCCEEDED
            : PaymentStatus.PENDING,
        amount: dto.amount,
        processorRef: charge.processorRef,
        reference: dto.reference,
        processedAt: charge.status === 'SUCCEEDED' ? new Date() : undefined,
      },
    });

    if (dto.invoiceId && charge.status === 'SUCCEEDED') {
      await this.applyToInvoice(organizationId, dto.invoiceId, dto.amount);
    }

    await this.audit.record({
      organizationId,
      actorId: userId,
      action: AuditAction.CREATE,
      entityType: 'Payment',
      entityId: payment.id,
      metadata: { amount: dto.amount, method: dto.method },
    });

    return payment;
  }

  private async applyToInvoice(
    organizationId: string,
    invoiceId: string,
    amount: number,
  ) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, organizationId },
    });
    if (!invoice) throw new NotFoundException(`Invoice ${invoiceId} not found`);

    const amountPaid = this.round(Number(invoice.amountPaid) + amount);
    const balanceDue = this.round(Number(invoice.total) - amountPaid);
    const status =
      balanceDue <= 0
        ? InvoiceStatus.PAID
        : amountPaid > 0
          ? InvoiceStatus.PARTIALLY_PAID
          : invoice.status;

    await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        amountPaid,
        balanceDue: Math.max(0, balanceDue),
        status,
        paidAt: balanceDue <= 0 ? new Date() : null,
      },
    });
  }

  findForClient(organizationId: string, clientId: string) {
    return this.prisma.payment.findMany({
      where: { organizationId, clientId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
