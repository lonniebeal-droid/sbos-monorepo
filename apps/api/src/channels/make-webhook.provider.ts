import { Injectable, Logger } from '@nestjs/common';

export interface MakeWebhookPayload {
  event: 'lead_created' | 'lead_updated' | 'escalation_created';
  organizationId: string;
  clientId: string;
  conversationId?: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export interface MakeWebhookResult {
  ok: boolean;
  statusCode?: number;
  error?: string;
}

export interface MakeWebhookProvider {
  send(payload: MakeWebhookPayload): Promise<MakeWebhookResult>;
}

export const MAKE_WEBHOOK_PROVIDER = Symbol('MAKE_WEBHOOK_PROVIDER');

@Injectable()
export class ConsoleMakeWebhookProvider implements MakeWebhookProvider {
  private readonly logger = new Logger(ConsoleMakeWebhookProvider.name);

  async send(payload: MakeWebhookPayload): Promise<MakeWebhookResult> {
    this.logger.log(
      `[make:console] event=${payload.event} org=${payload.organizationId} client=${payload.clientId}`,
    );
    return { ok: true, statusCode: 200 };
  }
}

@Injectable()
export class HttpMakeWebhookProvider implements MakeWebhookProvider {
  private readonly logger = new Logger(HttpMakeWebhookProvider.name);
  private readonly url: string;
  private readonly timeoutMs = 10000;

  constructor(url: string) {
    this.url = url;
  }

  private redactUrl(url: string): string {
    try {
      const u = new URL(url);
      u.password = '***';
      u.username = '***';
      return u.toString();
    } catch {
      return '[invalid-url]';
    }
  }

  async send(payload: MakeWebhookPayload): Promise<MakeWebhookResult> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(this.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        this.logger.error(
          `Make webhook error (${response.status}): ${this.redactUrl(this.url)} - ${body}`,
        );
        return {
          ok: false,
          statusCode: response.status,
          error: `Make webhook returned ${response.status}`,
        };
      }

      return { ok: true, statusCode: response.status };
    } catch (err) {
      clearTimeout(timeoutId);
      const message = err instanceof Error ? err.message : String(err);
      const isTimeout = err instanceof DOMException && err.name === 'AbortError';

      this.logger.error(
        `Make webhook ${isTimeout ? 'timeout' : 'failed'}: ${this.redactUrl(this.url)} - ${message}`,
      );

      return {
        ok: false,
        error: isTimeout ? 'timeout' : 'network_error',
      };
    }
  }
}
