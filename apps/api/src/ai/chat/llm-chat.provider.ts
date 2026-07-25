import { Injectable, Logger } from '@nestjs/common';

import type {
  ChatMessage,
  ChatProvider,
  ChatRequest,
  ChatResult,
} from './chat-provider.interface';

export interface LlmChatConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

/**
 * OpenAI-compatible chat provider for Jessie. Works with OpenAI and any
 * OpenAI-compatible endpoint (Azure OpenAI, local gateways, etc.). Grounding
 * knowledge is injected into the system prompt. Activated automatically when an
 * API key is configured; otherwise the offline heuristic provider is used.
 */
@Injectable()
export class LlmChatProvider implements ChatProvider {
  private readonly logger = new Logger(LlmChatProvider.name);
  readonly provider: string;

  constructor(private readonly config: LlmChatConfig) {
    this.provider = `llm:${config.model}`;
  }

  async generateReply(request: ChatRequest): Promise<ChatResult> {
    const knowledge =
      request.knowledge && request.knowledge.length > 0
        ? '\n\nKnowledge base:\n' +
          request.knowledge
            .map((k) => `- ${k.title}: ${k.body}`)
            .join('\n')
            .slice(0, 6000)
        : '';

    const messages: ChatMessage[] = [
      { role: 'system', content: `${request.systemPrompt}${knowledge}` },
      ...request.messages,
    ];

    const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages,
        temperature: 0.4,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      this.logger.error(`LLM request failed (${response.status}): ${body}`);
      throw new Error(`LLM provider error: ${response.status}`);
    }

    const data = (await response.json()) as ChatCompletionResponse;
    const content = data.choices?.[0]?.message?.content?.trim();
    return {
      content: content ?? 'I was unable to generate a response.',
      provider: this.provider,
    };
  }
}
