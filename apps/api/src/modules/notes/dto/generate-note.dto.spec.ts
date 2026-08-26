import 'reflect-metadata';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';

import { AssistNoteTypeDto, GenerateNoteDto } from './generate-note.dto';

describe('GenerateNoteDto', () => {
  it('trims presentingProblem when provided', async () => {
    const dto = plainToInstance(GenerateNoteDto, {
      type: AssistNoteTypeDto.SOAP,
      prompt: 'Session summary',
      presentingProblem: '  Difficulty sleeping  ',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.presentingProblem).toBe('Difficulty sleeping');
  });

  it('rejects whitespace-only presentingProblem', async () => {
    const dto = plainToInstance(GenerateNoteDto, {
      type: AssistNoteTypeDto.SOAP,
      prompt: 'Session summary',
      presentingProblem: '   ',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(1);
    expect(errors[0]?.property).toBe('presentingProblem');
  });
});
