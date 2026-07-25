import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import type {
  ChargeRequest,
  ChargeResult,
  PaymentProvider,
  RefundResult,
} from './payment-provider.interface';

/**
 * Manual payment provider: records payments taken outside the platform (cash,
 * check, external terminal) as succeeded, and marks refunds as processed. This
 * is a real, usable default; a Stripe provider implements the same interface for
 * card processing without changing billing code.
 */
@Injectable()
export class ManualPaymentProvider implements PaymentProvider {
  readonly provider = 'manual';

  async charge(request: ChargeRequest): Promise<ChargeResult> {
    return {
      processorRef: request.reference ?? `man_${randomUUID()}`,
      status: 'SUCCEEDED',
      provider: this.provider,
    };
  }

  async refund(processorRef: string): Promise<RefundResult> {
    return {
      processorRef,
      status: 'REFUNDED',
      provider: this.provider,
    };
  }
}
