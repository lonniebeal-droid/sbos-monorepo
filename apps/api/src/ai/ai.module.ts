import { Global, Module } from '@nestjs/common';

import { HeuristicNoteAssistant } from './heuristic-note-assistant';
import { NOTE_ASSISTANT } from './note-assistant.interface';
import { HeuristicChatProvider } from './chat/heuristic-chat.provider';
import { CHAT_PROVIDER } from './chat/chat-provider.interface';

/**
 * AI services module (the Jessie platform's provider layer). Binds the note
 * assistant and chat provider to offline heuristic implementations by default;
 * hosted LLM providers (OpenAI/Claude/Gemini) can be swapped in here — selected
 * via configuration — without touching consumers.
 */
@Global()
@Module({
  providers: [
    HeuristicNoteAssistant,
    { provide: NOTE_ASSISTANT, useExisting: HeuristicNoteAssistant },
    HeuristicChatProvider,
    { provide: CHAT_PROVIDER, useExisting: HeuristicChatProvider },
  ],
  exports: [NOTE_ASSISTANT, CHAT_PROVIDER],
})
export class AiModule {}
