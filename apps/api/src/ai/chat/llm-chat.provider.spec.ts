import type { Logger } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LlmChatProvider } from './llm-chat.provider';
import type { ChatMessage, KnowledgeSnippet } from './chat-provider.interface';

const FAKE_CONFIG = {
  baseUrl: 'https://llm.example.com/v1',
  apiKey: 'sk-fake-not-a-real-llm-key',
  model: 'gpt-fake',
};

function loggerSpy(provider: LlmChatProvider) {
  const logger = (provider as unknown as { logger: Logger }).logger;
  return { error: vi.spyOn(logger, 'error').mockImplementation(() => undefined) };
}

function mockFetchOk(content: string | undefined) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: vi.fn().mockResolvedValue(
      content === undefined ? { choices: [] } : { choices: [{ message: { content } }] },
    ),
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('LlmChatProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reports its provider id as llm:<model>', () => {
    const provider = new LlmChatProvider(FAKE_CONFIG);
    expect(provider.provider).toBe('llm:gpt-fake');
  });

  it('posts to <baseUrl>/chat/completions with Bearer auth and no live network call', async () => {
    const fetchMock = mockFetchOk('Sure, I can help with that.');
    const provider = new LlmChatProvider(FAKE_CONFIG);
    const userMessages: ChatMessage[] = [{ role: 'user', content: 'Hi Jessie' }];

    const result = await provider.generateReply({
      kind: 'GENERAL',
      systemPrompt: 'You are Jessie.',
      messages: userMessages,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://llm.example.com/v1/chat/completions');
    expect((options.headers as Record<string, string>).Authorization).toBe(
      `Bearer ${FAKE_CONFIG.apiKey}`,
    );
    const body = JSON.parse(options.body as string);
    expect(body.model).toBe('gpt-fake');
    expect(body.temperature).toBe(0.4);
    expect(body.messages).toEqual([
      { role: 'system', content: 'You are Jessie.' },
      { role: 'user', content: 'Hi Jessie' },
    ]);
    expect(result).toEqual({
      content: 'Sure, I can help with that.',
      provider: 'llm:gpt-fake',
    });
  });

  it('appends formatted knowledge snippets to the system prompt when given', async () => {
    const fetchMock = mockFetchOk('answer');
    const provider = new LlmChatProvider(FAKE_CONFIG);
    const knowledge: KnowledgeSnippet[] = [
      { title: 'Hours', body: 'Open 9-5.' },
      { title: 'Location', body: '100 Main St.' },
    ];

    await provider.generateReply({
      kind: 'KNOWLEDGE',
      systemPrompt: 'You are Jessie.',
      messages: [],
      knowledge,
    });

    const body = JSON.parse(
      (fetchMock.mock.calls[0][1] as RequestInit).body as string,
    );
    expect(body.messages[0].content).toBe(
      'You are Jessie.\n\nKnowledge base:\n- Hours: Open 9-5.\n- Location: 100 Main St.',
    );
  });

  it('omits the knowledge section entirely when no snippets are given', async () => {
    const fetchMock = mockFetchOk('answer');
    const provider = new LlmChatProvider(FAKE_CONFIG);

    await provider.generateReply({
      kind: 'GENERAL',
      systemPrompt: 'You are Jessie.',
      messages: [],
      knowledge: [],
    });

    const body = JSON.parse(
      (fetchMock.mock.calls[0][1] as RequestInit).body as string,
    );
    expect(body.messages[0].content).toBe('You are Jessie.');
  });

  it('truncates the joined knowledge body to 6000 characters before the "Knowledge base:" prefix', async () => {
    const fetchMock = mockFetchOk('answer');
    const provider = new LlmChatProvider(FAKE_CONFIG);
    const knowledge: KnowledgeSnippet[] = [{ title: 'x', body: 'a'.repeat(7000) }];

    await provider.generateReply({
      kind: 'KNOWLEDGE',
      systemPrompt: 'sys',
      messages: [],
      knowledge,
    });

    const body = JSON.parse(
      (fetchMock.mock.calls[0][1] as RequestInit).body as string,
    );
    const content = body.messages[0].content as string;
    const prefix = 'sys\n\nKnowledge base:\n';
    expect(content.startsWith(prefix)).toBe(true);
    // Only the joined "- x: aaa..." portion is sliced to 6000 chars -- the
    // "Knowledge base:" prefix itself isn't counted against the limit.
    expect(content.length - prefix.length).toBe(6000);
  });

  it('trims whitespace from the completion content', async () => {
    mockFetchOk('  padded response  \n');
    const provider = new LlmChatProvider(FAKE_CONFIG);

    const result = await provider.generateReply({
      kind: 'GENERAL',
      systemPrompt: 'sys',
      messages: [],
    });

    expect(result.content).toBe('padded response');
  });

  it('falls back to a default message when the response has no completion content', async () => {
    mockFetchOk(undefined);
    const provider = new LlmChatProvider(FAKE_CONFIG);

    const result = await provider.generateReply({
      kind: 'GENERAL',
      systemPrompt: 'sys',
      messages: [],
    });

    expect(result.content).toBe('I was unable to generate a response.');
  });

  it('logs the status/body and throws on a failed request, without leaking the API key', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: vi.fn().mockResolvedValue('Rate limit exceeded'),
    });
    vi.stubGlobal('fetch', fetchMock);
    const provider = new LlmChatProvider(FAKE_CONFIG);
    const spies = loggerSpy(provider);

    await expect(
      provider.generateReply({ kind: 'GENERAL', systemPrompt: 'sys', messages: [] }),
    ).rejects.toThrow('LLM provider error: 429');

    expect(spies.error).toHaveBeenCalledWith(
      expect.stringContaining('LLM request failed (429): Rate limit exceeded'),
    );
    expect(spies.error.mock.calls[0][0] as string).not.toContain(FAKE_CONFIG.apiKey);
  });
});
