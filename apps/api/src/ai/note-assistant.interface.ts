/** Note formats the assistant can scaffold. */
export type AssistableNoteType = 'BIRP' | 'DAP' | 'SOAP' | 'PROGRESS' | 'GROUP';

export interface NoteDraftInput {
  type: AssistableNoteType;
  /** Free-text session summary / clinician prompt. */
  prompt: string;
  clientName?: string;
  presentingProblem?: string;
  interventions?: string[];
}

export interface NoteDraftResult {
  /** Section key -> drafted text (e.g. behavior/intervention/response/plan). */
  sections: Record<string, string>;
  /** A single combined narrative for free-text note types. */
  narrative: string;
  /** Which provider produced the draft (for auditing/telemetry). */
  provider: string;
}

/**
 * Contract for a clinical note-generation assistant. The default implementation
 * is deterministic and offline; a hosted LLM provider (OpenAI/Claude/Gemini)
 * can be bound to the same token without changing callers.
 */
export interface NoteAssistant {
  generateNoteDraft(input: NoteDraftInput): Promise<NoteDraftResult>;
}

export const NOTE_ASSISTANT = Symbol('NOTE_ASSISTANT');
