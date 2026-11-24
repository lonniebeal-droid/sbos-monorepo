import type { Logger } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ConsoleSmsProvider, TwilioSmsProvider } from './sms.provider';

const FAKE_CONFIG = {
  accountSid: 'AC_fake_account_sid',
  authToken: 'fake_auth_token_not_real',
  from: '+15005550006',
};

function loggerSpy(provider: ConsoleSmsProvider | TwilioSmsProvider) {
  const logger = (provider as unknown as { logger: Logger }).logger;
  return {
    log: vi.spyOn(logger, 'log').mockImplementation(() => undefined),
    error: vi.spyOn(logger, 'error').mockImplementation(() => undefined),
  };
}

describe('ConsoleSmsProvider', () => {
  it('logs the message and returns a console_<timestamp> id without sending anything', async () => {
    const provider = new ConsoleSmsProvider();
    const spies = loggerSpy(provider);

    const result = await provider.send({ to: '+15551234567', body: 'See you soon!' });

    expect(spies.log).toHaveBeenCalledWith(
      expect.stringContaining('to=+15551234567'),
    );
    expect(spies.log).toHaveBeenCalledWith(
      expect.stringContaining('body="See you soon!"'),
    );
    expect(result.provider).toBe('console');
    expect(result.id).toMatch(/^console_\d+$/);
  });
});

describe('TwilioSmsProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('posts to the Twilio API and maps a successful response, with no live network call', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ sid: 'SM_abc123' }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const provider = new TwilioSmsProvider(FAKE_CONFIG);

    const result = await provider.send({ to: '+15551234567', body: 'Reminder' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      `https://api.twilio.com/2010-04-01/Accounts/${FAKE_CONFIG.accountSid}/Messages.json`,
    );
    expect(options.method).toBe('POST');
    expect((options.headers as Record<string, string>)['Content-Type']).toBe(
      'application/x-www-form-urlencoded',
    );
    const expectedAuth = Buffer.from(
      `${FAKE_CONFIG.accountSid}:${FAKE_CONFIG.authToken}`,
    ).toString('base64');
    expect((options.headers as Record<string, string>).Authorization).toBe(
      `Basic ${expectedAuth}`,
    );
    const body = new URLSearchParams(options.body as string);
    expect(body.get('To')).toBe('+15551234567');
    expect(body.get('From')).toBe(FAKE_CONFIG.from);
    expect(body.get('Body')).toBe('Reminder');
    expect(result).toEqual({ id: 'SM_abc123', provider: 'twilio' });
  });

  it('falls back to "unknown" when the response has no sid', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({}),
    });
    vi.stubGlobal('fetch', fetchMock);
    const provider = new TwilioSmsProvider(FAKE_CONFIG);

    const result = await provider.send({ to: '+15551234567', body: 'x' });

    expect(result.id).toBe('unknown');
  });

  it('logs the status/body and throws on a failed request, without leaking the auth token', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: vi.fn().mockResolvedValue('Authenticate'),
    });
    vi.stubGlobal('fetch', fetchMock);
    const provider = new TwilioSmsProvider(FAKE_CONFIG);
    const spies = loggerSpy(provider);

    await expect(provider.send({ to: '+15551234567', body: 'x' })).rejects.toThrow(
      'Twilio request failed: 401',
    );

    expect(spies.error).toHaveBeenCalledWith(
      expect.stringContaining('Twilio error (401): Authenticate'),
    );
    expect(spies.error.mock.calls[0][0] as string).not.toContain(FAKE_CONFIG.authToken);
  });
});
