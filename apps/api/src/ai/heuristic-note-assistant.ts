import { Injectable } from '@nestjs/common';

import type {
  NoteAssistant,
  NoteDraftInput,
  NoteDraftResult,
} from './note-assistant.interface';

/** Section templates per note format. */
const SECTIONS: Record<NoteDraftInput['type'], string[]> = {
  BIRP: ['behavior', 'intervention', 'response', 'plan'],
  DAP: ['data', 'assessment', 'plan'],
  SOAP: ['subjective', 'objective', 'assessment', 'plan'],
  PROGRESS: ['narrative'],
  GROUP: ['narrative'],
};

/**
 * Deterministic, offline note assistant. It transforms the clinician's session
 * summary and structured context into a clinically-organized draft for each
 * section of the requested note format. This produces a real, editable starting
 * point without any external API dependency; a hosted LLM can replace it behind
 * the same {@link NoteAssistant} interface.
 */
@Injectable()
export class HeuristicNoteAssistant implements NoteAssistant {
  readonly provider = 'heuristic-v1';

  async generateNoteDraft(input: NoteDraftInput): Promise<NoteDraftResult> {
    const client = input.clientName ?? 'The client';
    const prompt = input.prompt.trim();
    const problem = input.presentingProblem?.trim();
    const interventions =
      input.interventions && input.interventions.length > 0
        ? input.interventions
        : ['supportive processing', 'psychoeducation'];
    const interventionText = this.joinList(interventions);

    const builders: Record<string, () => string> = {
      behavior: () =>
        `${client} presented for the session${problem ? ` with ongoing ${problem}` : ''}. ${this.asObservation(prompt)}`,
      subjective: () =>
        `${client} reported: ${this.asReported(prompt)}${problem ? ` Presenting concern: ${problem}.` : ''}`,
      data: () =>
        `${this.asObservation(prompt)}${problem ? ` Presenting concern: ${problem}.` : ''}`,
      objective: () =>
        `Clinician observed ${client.toLowerCase()} as engaged and oriented. ${this.asObservation(prompt)}`,
      intervention: () =>
        `The clinician utilized ${interventionText} to address the presenting concerns.`,
      assessment: () =>
        `${client} is making measurable progress toward treatment goals. Continued clinical support is indicated${problem ? ` for ${problem}` : ''}.`,
      response: () =>
        `${client} engaged with the interventions and demonstrated insight during the session.`,
      plan: () =>
        `Continue the current treatment plan. Next session will reinforce ${interventionText}. Homework and coping strategies were reviewed.`,
      narrative: () =>
        `${client} attended the session${problem ? ` addressing ${problem}` : ''}. ${this.asObservation(prompt)} The clinician utilized ${interventionText}. ${client} responded positively and will continue with the current plan.`,
    };

    const sectionKeys = SECTIONS[input.type];
    const sections: Record<string, string> = {};
    for (const key of sectionKeys) {
      sections[key] = (builders[key] ?? builders.narrative)();
    }

    const narrative = sectionKeys
      .map((key) => `${this.titleCase(key)}: ${sections[key]}`)
      .join('\n\n');

    return { sections, narrative, provider: this.provider };
  }

  private asObservation(prompt: string): string {
    if (!prompt) return 'Session content was documented by the clinician.';
    const trimmed = prompt.replace(/\s+/g, ' ').trim();
    return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
  }

  private asReported(prompt: string): string {
    return this.asObservation(prompt);
  }

  private joinList(items: string[]): string {
    if (items.length === 1) return items[0];
    if (items.length === 2) return `${items[0]} and ${items[1]}`;
    return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
  }

  private titleCase(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }
}
