import { Injectable, Logger } from '@nestjs/common';

import type {
  ChargeRequest,
  ChargeResult,
  PaymentProvider,
  RefundResult,
} from './payment-provider.interface';

/**
 * Stripe payment provider. Creates a PaymentIntent for the requested amount via
 * the Stripe REST API (no SDK dependency). Card collection/confirmation happens
 * on the client with the returned intent; this adapter provides the server-side
 * lifecycle. Activated when STRIPE_SECRET_KEY is configured.
 */
@Injectable()
export class StripePaymentProvider implements PaymentProvider {
  private readonly logger = new Logger(StripePaymentProvider.name);
  readonly provider = 'stripe';
  private readonly base = 'https://api.stripe.com/v1';

  constructor(private readonly secretKey: string) {}

  private form(params: Record<string, string>): string {
    return new URLSearchParams(params).toString();
  }

  private async request<T>(
    path: string,
    body: Record<string, string>,
  ): Promise<T> {
    const response = await fetch(`${this.base}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: this.form(body),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      this.logger.error(`Stripe error (${response.status}): ${text}`);
      throw new Error(`Stripe request failed: ${response.status}`);
    }
    return (await response.json()) as T;
  }

  async charge(request: ChargeRequest): Promise<ChargeResult> {
    const intent = await this.request<{ id: string; status: string }>(
      '/payment_intents',
      {
        amount: String(Math.round(request.amount * 100)),
        currency: (request.currency ?? 'usd').toLowerCase(),
        description: request.description ?? 'SBOS payment',
        'metadata[organizationId]': request.organizationId,
      },
    );
    return {
      processorRef: intent.id,
      // Intent starts as requires_payment_method until confirmed client-side.
      status: intent.status === 'succeeded' ? 'SUCCEEDED' : 'PENDING',
      provider: this.provider,
    };
  }

  async refund(processorRef: string): Promise<RefundResult> {
    const refund = await this.request<{ status: string }>('/refunds', {
      payment_intent: processorRef,
    });
    return {
      processorRef,
      status: refund.status === 'succeeded' ? 'REFUNDED' : 'FAILED',
      provider: this.provider,
    };
  }
}
