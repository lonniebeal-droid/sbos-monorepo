import type { Logger } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ConsoleEmailProvider, ResendEmailProvider } from './email.provider';

const FAKE_API_KEY = 'test-fake-resend-key-not-real';

function loggerSpy(provider: ConsoleEmailProvider | ResendEmailProvider) {
  const logger = (provider as unknown as { logger: Logger }).logger;
  return {
    log: vi.spyOn(logger, 'log').mockImplementation(() => undefined),
    error: vi.spyOn(logger, 'error').mockImplementation(() => undefined),
  };
}

describe('ConsoleEmailProvider', () => {
  it('logs the message and returns a console_<timestamp> id without sending anything', async () => {
    const provider = new ConsoleEmailProvider();
    const spies = loggerSpy(provider);

    const result = await provider.send({
      to: 'client@example.com',
      subject: 'Appointment confirmed',
    });

    expect(spies.log).toHaveBeenCalledWith(
      expect.stringContaining('to=client@example.com'),
    );
    expect(spies.log).toHaveBeenCalledWith(
      expect.stringContaining('subject="Appointment confirmed"'),
    );
    expect(result.provider).toBe('console');
    expect(result.id).toMatch(/^console_\d+$/);
  });
});

describe('ResendEmailProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('posts to the Resend API and maps a successful response, with no live network call', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ id: 'resend_abc123' }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const provider = new ResendEmailProvider(FAKE_API_KEY, 'jessie@sbos.health');

    const result = await provider.send({
      to: 'client@example.com',
      subject: 'Appointment confirmed',
      html: '<p>See you soon.</p>',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: `Bearer ${FAKE_API_KEY}`,
          'Content-Type': 'application/json',
        }),
      }),
    );
    const body = JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body);
    expect(body).toEqual({
      from: 'jessie@sbos.health',
      to: 'client@example.com',
      subject: 'Appointment confirmed',
      html: '<p>See you soon.</p>',
      text: 'Appointment confirmed',
    });
    expect(result).toEqual({ id: 'resend_abc123', provider: 'resend' });
  });

  it('defaults text to the subject when no plain-text body is given', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ id: 'resend_1' }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const provider = new ResendEmailProvider(FAKE_API_KEY, 'jessie@sbos.health');

    await provider.send({ to: 'client@example.com', subject: 'Reminder' });

    const body = JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body);
    expect(body.text).toBe('Reminder');
  });

  it('falls back to "unknown" when the response has no id', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({}),
    });
    vi.stubGlobal('fetch', fetchMock);
    const provider = new ResendEmailProvider(FAKE_API_KEY, 'jessie@sbos.health');

    const result = await provider.send({ to: 'client@example.com', subject: 'x' });

    expect(result.id).toBe('unknown');
  });

  it('logs the status/body and throws on a failed request, without leaking the API key', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 402,
      text: vi.fn().mockResolvedValue('Payment required'),
    });
    vi.stubGlobal('fetch', fetchMock);
    const provider = new ResendEmailProvider(FAKE_API_KEY, 'jessie@sbos.health');
    const spies = loggerSpy(provider);

    await expect(
      provider.send({ to: 'client@example.com', subject: 'x' }),
    ).rejects.toThrow('Resend request failed: 402');

    expect(spies.error).toHaveBeenCalledWith(
      expect.stringContaining('Resend error (402): Payment required'),
    );
    expect(spies.error.mock.calls[0][0] as string).not.toContain(FAKE_API_KEY);
  });
});
