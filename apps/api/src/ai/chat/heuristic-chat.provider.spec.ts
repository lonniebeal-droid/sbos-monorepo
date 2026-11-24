import { describe, expect, it } from 'vitest';

import { HeuristicChatProvider } from './heuristic-chat.provider';
import type { ChatMessage, KnowledgeSnippet } from './chat-provider.interface';

function userMsg(content: string): ChatMessage {
  return { role: 'user', content };
}
function assistantMsg(content: string): ChatMessage {
  return { role: 'assistant', content };
}

describe('HeuristicChatProvider', () => {
  const provider = new HeuristicChatProvider();

  it('always reports its own provider id, with no network involved', async () => {
    const result = await provider.generateReply({
      kind: 'GENERAL',
      systemPrompt: 'x',
      messages: [userMsg('hi')],
    });

    expect(result.provider).toBe('heuristic-chat-v1');
  });

  it('uses the latest user message, not an intervening assistant reply', async () => {
    const result = await provider.generateReply({
      kind: 'SCHEDULING',
      systemPrompt: 'x',
      messages: [
        userMsg('book me for tomorrow'),
        assistantMsg('Sure, what time?'),
        userMsg('anytime works'),
      ],
    });

    // "anytime works" has no date-like token, so it takes the generic branch --
    // proving the second (latest) user message drove the response, not the first.
    expect(result.content).toContain('What date and time would you prefer');
  });

  describe('RECEPTIONIST', () => {
    it('greets when there is no message yet', async () => {
      const result = await provider.generateReply({
        kind: 'RECEPTIONIST',
        systemPrompt: 'x',
        messages: [],
      });

      expect(result.content).toContain("Hi, I'm Jessie");
    });

    it('prefers a matched knowledge snippet over keyword routing', async () => {
      const knowledge: KnowledgeSnippet[] = [
        { title: 'Hours', body: 'Our office hours are Monday through Friday, nine to five.' },
      ];
      const result = await provider.generateReply({
        kind: 'RECEPTIONIST',
        systemPrompt: 'x',
        messages: [userMsg('What are your office hours?')],
        knowledge,
      });

      expect(result.content).toContain('Our office hours are Monday through Friday');
    });

    it('routes an appointment-related message to scheduling help', async () => {
      const result = await provider.generateReply({
        kind: 'RECEPTIONIST',
        systemPrompt: 'x',
        messages: [userMsg('I need to reschedule my appointment')],
      });

      expect(result.content).toContain("I'd be happy to help with scheduling");
    });

    it('routes a new-client message to the intake welcome', async () => {
      const result = await provider.generateReply({
        kind: 'RECEPTIONIST',
        systemPrompt: 'x',
        messages: [userMsg("I'm a new client and want to register")],
      });

      expect(result.content).toContain('Welcome! I can start your intake');
    });

    it('falls back to a generic prompt for anything else', async () => {
      const result = await provider.generateReply({
        kind: 'RECEPTIONIST',
        systemPrompt: 'x',
        messages: [userMsg('random unrelated question')],
      });

      expect(result.content).toContain('Thanks for your message');
    });
  });

  describe('SCHEDULING', () => {
    it('acknowledges a date-like message', async () => {
      const result = await provider.generateReply({
        kind: 'SCHEDULING',
        systemPrompt: 'x',
        messages: [userMsg('Tuesday at 3pm works for me')],
      });

      expect(result.content).toContain('check the clinician’s availability');
    });
  });

  describe('INTAKE', () => {
    it('progresses through the intake steps as user turns accumulate', async () => {
      const stepAt = async (userTurns: number) => {
        const messages = Array.from({ length: userTurns }, (_, i) => userMsg(`turn ${i}`));
        const result = await provider.generateReply({
          kind: 'INTAKE',
          systemPrompt: 'x',
          messages,
        });
        return result.content;
      };

      expect(await stepAt(0)).toContain('full legal name');
      expect(await stepAt(1)).toContain('date of birth');
      expect(await stepAt(4)).toContain('insurance');
    });

    it('clamps to the final step once turns exceed the script length', async () => {
      const messages = Array.from({ length: 20 }, (_, i) => userMsg(`turn ${i}`));

      const result = await provider.generateReply({
        kind: 'INTAKE',
        systemPrompt: 'x',
        messages,
      });

      expect(result.content).toContain('that’s everything I need');
    });
  });

  describe('CLINICAL', () => {
    it('prompts for a format when no session detail is given', async () => {
      const result = await provider.generateReply({
        kind: 'CLINICAL',
        systemPrompt: 'x',
        messages: [],
      });

      expect(result.content).toContain('BIRP, DAP, or SOAP');
    });

    it('structures a BIRP-style outline from the session detail given', async () => {
      const result = await provider.generateReply({
        kind: 'CLINICAL',
        systemPrompt: 'x',
        messages: [userMsg('Client reported improved mood since last session.')],
      });

      expect(result.content).toContain('Presentation:');
      expect(result.content).toContain('Client reported improved mood since last session.');
    });
  });

  describe('KNOWLEDGE', () => {
    it('answers from a matched snippet', async () => {
      const knowledge: KnowledgeSnippet[] = [
        { title: 'Cancellation policy', body: 'Cancel at least 24 hours in advance to avoid a fee.' },
      ];
      const result = await provider.generateReply({
        kind: 'KNOWLEDGE',
        systemPrompt: 'x',
        messages: [userMsg('What is your cancellation policy?')],
        knowledge,
      });

      expect(result.content).toContain('Cancellation policy:');
      expect(result.content).toContain('Cancel at least 24 hours in advance');
    });

    it('offers a human handoff when nothing matches', async () => {
      const result = await provider.generateReply({
        kind: 'KNOWLEDGE',
        systemPrompt: 'x',
        messages: [userMsg('completely unrelated gibberish topic')],
        knowledge: [{ title: 'Hours', body: 'We are open 9 to 5.' }],
      });

      expect(result.content).toContain("couldn’t find that in our knowledge base");
    });

    it('ignores short (<=3 char) words when scoring matches', async () => {
      // "the" and "how" are both <=3 chars and filtered from match terms, so a
      // snippet that only shares those short words with the message should not
      // be treated as a match.
      const result = await provider.generateReply({
        kind: 'KNOWLEDGE',
        systemPrompt: 'x',
        messages: [userMsg('how are the fees set')],
        knowledge: [{ title: 'Unrelated', body: 'The how and why of something else.' }],
      });

      expect(result.content).toContain("couldn’t find that in our knowledge base");
    });
  });

  describe('GENERAL (and unknown kind default)', () => {
    it('greets when there is no message', async () => {
      const result = await provider.generateReply({
        kind: 'GENERAL',
        systemPrompt: 'x',
        messages: [],
      });

      expect(result.content).toBe("Hi, I'm Jessie. How can I help?");
    });

    it('echoes a summarized version of the question when nothing matches', async () => {
      const result = await provider.generateReply({
        kind: 'GENERAL',
        systemPrompt: 'x',
        messages: [userMsg('What insurance do you accept?')],
      });

      expect(result.content).toContain('What insurance do you accept?');
    });

    it('truncates a long first sentence to 280 characters with an ellipsis', async () => {
      const longSentence = `${'a'.repeat(300)}.`;
      const result = await provider.generateReply({
        kind: 'GENERAL',
        systemPrompt: 'x',
        messages: [userMsg(longSentence)],
      });

      // 277 chars of content + ellipsis, wrapped in the quoted-question template.
      expect(result.content).toContain(`${'a'.repeat(277)}…`);
      expect(result.content).not.toContain('a'.repeat(278));
    });
  });
});
