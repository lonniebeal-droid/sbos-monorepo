import { describe, expect, it } from 'vitest';

import { DEFAULT_SYSTEM_PROMPTS } from './assistant-prompts';

describe('Jessie receptionist default prompt', () => {
  const prompt = DEFAULT_SYSTEM_PROMPTS.RECEPTIONIST;

  it('presents Jessie as the practice receptionist without volunteering AI labels', () => {
    expect(prompt).toContain('Identify yourself simply as Jessie');
    expect(prompt).not.toContain('AI receptionist');
    expect(prompt).toContain('answer truthfully');
  });

  it('keeps the call alive while the caller has asked Jessie to hold', () => {
    expect(prompt).toContain('please hold');
    expect(prompt).toContain('Do not treat hold silence as goodbye');
    expect(prompt).toContain('resume naturally when the caller returns');
    expect(prompt).toContain('clear caller intent to finish');
  });
});
