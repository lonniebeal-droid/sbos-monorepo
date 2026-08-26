import { describe, expect, it } from 'vitest';

import { HeuristicNoteAssistant } from './heuristic-note-assistant';

describe('HeuristicNoteAssistant', () => {
  it('incorporates presentingProblem into generated SOAP drafts', async () => {
    const assistant = new HeuristicNoteAssistant();

    const result = await assistant.generateNoteDraft({
      type: 'SOAP',
      prompt: 'Client discussed interrupted sleep and difficulty focusing at work',
      clientName: 'Jordan Mitchell',
      presentingProblem: 'Difficulty sleeping',
    });

    expect(result.sections.subjective).toContain(
      'Presenting concern: Difficulty sleeping.',
    );
    expect(result.sections.assessment).toContain('for Difficulty sleeping');
    expect(result.narrative).toContain(
      'Presenting concern: Difficulty sleeping.',
    );
  });

  it('omits presentingProblem language when none is provided', async () => {
    const assistant = new HeuristicNoteAssistant();

    const result = await assistant.generateNoteDraft({
      type: 'BIRP',
      prompt: 'Client reflected on stress during a job change',
      clientName: 'Jordan Mitchell',
    });

    expect(result.sections.behavior).not.toContain('ongoing');
    expect(result.sections.behavior).not.toContain('Presenting concern:');
    expect(result.narrative).not.toContain('Presenting concern:');
  });
});
