import { Global, Module } from '@nestjs/common';

import { ManualPaymentProvider } from './manual-payment.provider';
import { PAYMENT_PROVIDER } from './payment-provider.interface';

/**
 * Payments module. Binds {@link PAYMENT_PROVIDER} to the manual provider by
 * default; a Stripe-backed provider can replace it here (selected via config)
 * without touching billing services.
 */
@Global()
@Module({
  providers: [
    ManualPaymentProvider,
    { provide: PAYMENT_PROVIDER, useExisting: ManualPaymentProvider },
  ],
  exports: [PAYMENT_PROVIDER],
})
export class PaymentsModule {}
