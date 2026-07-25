import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppConfig } from '../config/configuration';
import {
  ConsoleEmailProvider,
  EMAIL_PROVIDER,
  ResendEmailProvider,
  type EmailProvider,
} from './email.provider';
import {
  ConsoleSmsProvider,
  SMS_PROVIDER,
  TwilioSmsProvider,
  type SmsProvider,
} from './sms.provider';

/**
 * Delivery channels (email + SMS). Each binds to a hosted provider when its
 * credentials are configured (Resend / Twilio), otherwise a console provider
 * that logs the message — so the wiring is complete and testable without keys.
 */
@Global()
@Module({
  providers: [
    ConsoleEmailProvider,
    ConsoleSmsProvider,
    {
      provide: EMAIL_PROVIDER,
      inject: [ConfigService, ConsoleEmailProvider],
      useFactory: (
        configService: ConfigService<AppConfig, true>,
        console: ConsoleEmailProvider,
      ): EmailProvider => {
        const email = configService.get('email', { infer: true });
        if (email.resendApiKey) {
          new Logger('ChannelsModule').log('Email provider: Resend');
          return new ResendEmailProvider(email.resendApiKey, email.fromAddress);
        }
        return console;
      },
    },
    {
      provide: SMS_PROVIDER,
      inject: [ConfigService, ConsoleSmsProvider],
      useFactory: (
        configService: ConfigService<AppConfig, true>,
        console: ConsoleSmsProvider,
      ): SmsProvider => {
        const sms = configService.get('sms', { infer: true });
        if (sms.twilioAccountSid && sms.twilioAuthToken && sms.twilioFromNumber) {
          new Logger('ChannelsModule').log('SMS provider: Twilio');
          return new TwilioSmsProvider({
            accountSid: sms.twilioAccountSid,
            authToken: sms.twilioAuthToken,
            from: sms.twilioFromNumber,
          });
        }
        return console;
      },
    },
  ],
  exports: [EMAIL_PROVIDER, SMS_PROVIDER],
})
export class ChannelsModule {}
