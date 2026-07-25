export interface ChargeRequest {
  organizationId: string;
  amount: number;
  currency?: string;
  description?: string;
  reference?: string;
}

export interface ChargeResult {
  processorRef: string;
  status: 'SUCCEEDED' | 'PENDING' | 'FAILED';
  provider: string;
}

export interface RefundResult {
  processorRef: string;
  status: 'REFUNDED' | 'FAILED';
  provider: string;
}

/**
 * Payment-processing abstraction. The default implementation records payments
 * without an external processor; a Stripe-backed provider can be bound to
 * {@link PAYMENT_PROVIDER} without changing callers.
 */
export interface PaymentProvider {
  charge(request: ChargeRequest): Promise<ChargeResult>;
  refund(processorRef: string): Promise<RefundResult>;
}

export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');
