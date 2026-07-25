import { Global, Module } from '@nestjs/common';

import { HeuristicNoteAssistant } from './heuristic-note-assistant';
import { NOTE_ASSISTANT } from './note-assistant.interface';

/**
 * AI services module. Binds the {@link NOTE_ASSISTANT} token to the offline
 * heuristic assistant by default; a hosted LLM provider can be swapped in here
 * (selected via configuration) without touching consumers.
 */
@Global()
@Module({
  providers: [
    HeuristicNoteAssistant,
    { provide: NOTE_ASSISTANT, useExisting: HeuristicNoteAssistant },
  ],
  exports: [NOTE_ASSISTANT],
})
export class AiModule {}
