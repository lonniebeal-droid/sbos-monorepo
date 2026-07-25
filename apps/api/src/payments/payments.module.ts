import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppConfig } from '../config/configuration';
import { ManualPaymentProvider } from './manual-payment.provider';
import { StripePaymentProvider } from './stripe-payment.provider';
import {
  PAYMENT_PROVIDER,
  type PaymentProvider,
} from './payment-provider.interface';

/**
 * Payments module. Binds {@link PAYMENT_PROVIDER} to Stripe when a secret key is
 * configured, otherwise the manual provider (records cash/check/external
 * payments). Swapped here without touching billing services.
 */
@Global()
@Module({
  providers: [
    ManualPaymentProvider,
    {
      provide: PAYMENT_PROVIDER,
      inject: [ConfigService, ManualPaymentProvider],
      useFactory: (
        configService: ConfigService<AppConfig, true>,
        manual: ManualPaymentProvider,
      ): PaymentProvider => {
        const stripe = configService.get('stripe', { infer: true });
        if (stripe.secretKey) {
          new Logger('PaymentsModule').log('Payment provider: Stripe');
          return new StripePaymentProvider(stripe.secretKey);
        }
        new Logger('PaymentsModule').log('Payment provider: manual');
        return manual;
      },
    },
  ],
  exports: [PAYMENT_PROVIDER],
})
export class PaymentsModule {}
