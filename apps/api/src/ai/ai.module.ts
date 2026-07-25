import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppConfig } from '../config/configuration';
import { HeuristicNoteAssistant } from './heuristic-note-assistant';
import { NOTE_ASSISTANT } from './note-assistant.interface';
import { HeuristicChatProvider } from './chat/heuristic-chat.provider';
import { LlmChatProvider } from './chat/llm-chat.provider';
import { CHAT_PROVIDER, type ChatProvider } from './chat/chat-provider.interface';

/**
 * AI services module (the Jessie platform's provider layer). Binds the note
 * assistant and chat provider. The chat provider is a hosted LLM
 * (OpenAI-compatible) when an API key is configured, otherwise the offline
 * heuristic provider — swapped here without touching consumers.
 */
@Global()
@Module({
  providers: [
    HeuristicNoteAssistant,
    { provide: NOTE_ASSISTANT, useExisting: HeuristicNoteAssistant },
    HeuristicChatProvider,
    {
      provide: CHAT_PROVIDER,
      inject: [ConfigService, HeuristicChatProvider],
      useFactory: (
        configService: ConfigService<AppConfig, true>,
        heuristic: HeuristicChatProvider,
      ): ChatProvider => {
        const ai = configService.get('ai', { infer: true });
        if (ai.apiKey) {
          new Logger('AiModule').log(
            `Jessie chat provider: LLM (${ai.model})`,
          );
          return new LlmChatProvider({
            baseUrl: ai.baseUrl,
            apiKey: ai.apiKey,
            model: ai.model,
          });
        }
        new Logger('AiModule').log('Jessie chat provider: offline heuristic');
        return heuristic;
      },
    },
  ],
  exports: [NOTE_ASSISTANT, CHAT_PROVIDER],
})
export class AiModule {}
