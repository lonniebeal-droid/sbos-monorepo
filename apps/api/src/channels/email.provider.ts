import { Injectable, Logger } from '@nestjs/common';

export interface EmailMessage {
  to: string;
  subject: string;
  html?: string;
  text?: string;
}

export interface EmailResult {
  id: string;
  provider: string;
}

/** Transactional email contract (appointment reminders, notifications, etc.). */
export interface EmailProvider {
  send(message: EmailMessage): Promise<EmailResult>;
}

export const EMAIL_PROVIDER = Symbol('EMAIL_PROVIDER');

/** Default provider: logs the email instead of sending (no credentials). */
@Injectable()
export class ConsoleEmailProvider implements EmailProvider {
  private readonly logger = new Logger(ConsoleEmailProvider.name);

  async send(message: EmailMessage): Promise<EmailResult> {
    this.logger.log(`[email:console] to=${message.to} subject="${message.subject}"`);
    return { id: `console_${Date.now()}`, provider: 'console' };
  }
}

/** Resend-backed email provider (activated when RESEND_API_KEY is configured). */
export class ResendEmailProvider implements EmailProvider {
  private readonly logger = new Logger(ResendEmailProvider.name);

  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async send(message: EmailMessage): Promise<EmailResult> {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: this.from,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text ?? message.subject,
      }),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      this.logger.error(`Resend error (${response.status}): ${body}`);
      throw new Error(`Resend request failed: ${response.status}`);
    }
    const data = (await response.json()) as { id?: string };
    return { id: data.id ?? 'unknown', provider: 'resend' };
  }
}
