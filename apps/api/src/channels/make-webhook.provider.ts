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

  constructor(url: string, private readonly apiKey?: string) {
    this.url = url;
  }

  async send(payload: MakeWebhookPayload): Promise<MakeWebhookResult> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(this.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey ? { 'x-make-apikey': this.apiKey } : {}),
        },
        body: JSON.stringify(payload),
        redirect: 'error',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        this.logger.error(
          `Make webhook returned HTTP ${response.status}`,
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
      const isTimeout = err instanceof DOMException && err.name === 'AbortError';

      this.logger.error(
        `Make webhook ${isTimeout ? 'timeout' : 'network failure'}`,
      );

      return {
        ok: false,
        error: isTimeout ? 'timeout' : 'network_error',
      };
    }
  }
}

export function createMakeWebhookProvider(url?: string, apiKey?: string): MakeWebhookProvider {
  if (!url?.trim()) return { send: async () => ({ ok: false, error: 'not_configured' }) };
  const target = new URL(url.trim());
  if (target.protocol !== 'https:' || target.username || target.password || target.port ||
      !/^hook(?:\.[a-z0-9-]+)?\.make\.com$/.test(target.hostname) || target.search || target.hash) {
    throw new Error('MAKE_WEBHOOK_URL must be a direct HTTPS Make webhook URL');
  }
  if (!apiKey?.trim()) throw new Error('MAKE_WEBHOOK_API_KEY is required for Make delivery');
  return new HttpMakeWebhookProvider(target.toString(), apiKey.trim());
}
