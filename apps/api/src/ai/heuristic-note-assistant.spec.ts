import { describe, expect, it } from 'vitest';

import { HeuristicNoteAssistant } from './heuristic-note-assistant';

describe('HeuristicNoteAssistant', () => {
  const assistant = new HeuristicNoteAssistant();

  it('reports its own provider id, with no network involved', async () => {
    const result = await assistant.generateNoteDraft({
      type: 'PROGRESS',
      prompt: 'Discussed coping strategies.',
    });

    expect(result.provider).toBe('heuristic-v1');
  });

  it('generates exactly the section keys for each note type', async () => {
    const cases: Array<[string, string[]]> = [
      ['BIRP', ['behavior', 'intervention', 'response', 'plan']],
      ['DAP', ['data', 'assessment', 'plan']],
      ['SOAP', ['subjective', 'objective', 'assessment', 'plan']],
      ['PROGRESS', ['narrative']],
      ['GROUP', ['narrative']],
    ];

    for (const [type, expectedKeys] of cases) {
      const result = await assistant.generateNoteDraft({
        type: type as never,
        prompt: 'Session summary.',
      });
      expect(Object.keys(result.sections)).toEqual(expectedKeys);
    }
  });

  it('defaults the client reference to "The client" when no name is given', async () => {
    const result = await assistant.generateNoteDraft({
      type: 'BIRP',
      prompt: 'Discussed anxiety.',
    });

    expect(result.sections.behavior).toContain('The client presented for the session');
  });

  it('uses the given client name across sections', async () => {
    const result = await assistant.generateNoteDraft({
      type: 'BIRP',
      prompt: 'Discussed anxiety.',
      clientName: 'Jordan Mitchell',
    });

    expect(result.sections.behavior).toContain('Jordan Mitchell presented for the session');
  });

  it('includes the presenting problem when given, omits it when absent', async () => {
    const withProblem = await assistant.generateNoteDraft({
      type: 'DAP',
      prompt: 'Discussed anxiety.',
      presentingProblem: 'generalized anxiety',
    });
    expect(withProblem.sections.data).toContain('Presenting concern: generalized anxiety.');

    const withoutProblem = await assistant.generateNoteDraft({
      type: 'DAP',
      prompt: 'Discussed anxiety.',
    });
    expect(withoutProblem.sections.data).not.toContain('Presenting concern');
  });

  it('normalizes whitespace and adds terminal punctuation to the prompt observation', async () => {
    const result = await assistant.generateNoteDraft({
      type: 'DAP',
      prompt: '  Client   discussed   coping   strategies  ',
    });

    expect(result.sections.data).toContain('Client discussed coping strategies.');
  });

  it('does not add a redundant period when the prompt already ends with punctuation', async () => {
    const result = await assistant.generateNoteDraft({
      type: 'DAP',
      prompt: 'Client discussed coping strategies!',
    });

    expect(result.sections.data).toContain('Client discussed coping strategies!');
    expect(result.sections.data).not.toContain('strategies!.');
  });

  it('falls back to a generic observation when the prompt is empty', async () => {
    const result = await assistant.generateNoteDraft({ type: 'DAP', prompt: '' });

    expect(result.sections.data).toContain('Session content was documented by the clinician.');
  });

  describe('interventions list formatting', () => {
    it('defaults to two interventions when none are given', async () => {
      const result = await assistant.generateNoteDraft({ type: 'BIRP', prompt: 'x' });

      expect(result.sections.intervention).toContain(
        'supportive processing and psychoeducation',
      );
    });

    it('formats a single given intervention with no conjunction', async () => {
      const result = await assistant.generateNoteDraft({
        type: 'BIRP',
        prompt: 'x',
        interventions: ['CBT'],
      });

      expect(result.sections.intervention).toContain('utilized CBT to address');
    });

    it('formats two interventions joined by "and"', async () => {
      const result = await assistant.generateNoteDraft({
        type: 'BIRP',
        prompt: 'x',
        interventions: ['CBT', 'mindfulness'],
      });

      expect(result.sections.intervention).toContain('CBT and mindfulness');
    });

    it('formats three or more interventions with an Oxford comma before "and"', async () => {
      const result = await assistant.generateNoteDraft({
        type: 'BIRP',
        prompt: 'x',
        interventions: ['CBT', 'mindfulness', 'psychoeducation'],
      });

      expect(result.sections.intervention).toContain(
        'CBT, mindfulness, and psychoeducation',
      );
    });
  });

  it('assembles the narrative as "Title: section" blocks in section order', async () => {
    const result = await assistant.generateNoteDraft({
      type: 'DAP',
      prompt: 'Discussed anxiety.',
    });

    const parts = result.narrative.split('\n\n');
    expect(parts).toEqual([
      `Data: ${result.sections.data}`,
      `Assessment: ${result.sections.assessment}`,
      `Plan: ${result.sections.plan}`,
    ]);
  });
});
