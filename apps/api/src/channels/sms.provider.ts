import { Injectable, Logger } from '@nestjs/common';

export interface SmsMessage {
  to: string;
  body: string;
}

export interface SmsResult {
  id: string;
  provider: string;
}

/** Transactional SMS contract (appointment reminders, alerts, etc.). */
export interface SmsProvider {
  send(message: SmsMessage): Promise<SmsResult>;
}

export const SMS_PROVIDER = Symbol('SMS_PROVIDER');

/** Default provider: logs the SMS instead of sending (no credentials). */
@Injectable()
export class ConsoleSmsProvider implements SmsProvider {
  private readonly logger = new Logger(ConsoleSmsProvider.name);

  async send(message: SmsMessage): Promise<SmsResult> {
    this.logger.log(`[sms:console] to=${message.to} body="${message.body}"`);
    return { id: `console_${Date.now()}`, provider: 'console' };
  }
}

export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  from: string;
}

/** Twilio-backed SMS provider (activated when Twilio credentials are set). */
export class TwilioSmsProvider implements SmsProvider {
  private readonly logger = new Logger(TwilioSmsProvider.name);

  constructor(private readonly config: TwilioConfig) {}

  async send(message: SmsMessage): Promise<SmsResult> {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${this.config.accountSid}/Messages.json`;
    const auth = Buffer.from(
      `${this.config.accountSid}:${this.config.authToken}`,
    ).toString('base64');
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: message.to,
        From: this.config.from,
        Body: message.body,
      }).toString(),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      this.logger.error(`Twilio error (${response.status}): ${body}`);
      throw new Error(`Twilio request failed: ${response.status}`);
    }
    const data = (await response.json()) as { sid?: string };
    return { id: data.sid ?? 'unknown', provider: 'twilio' };
  }
}
