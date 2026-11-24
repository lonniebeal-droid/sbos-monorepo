import type { Logger } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { StripePaymentProvider } from './stripe-payment.provider';

const FAKE_SECRET_KEY = 'sk_test_fake_not_a_real_stripe_key';

function loggerSpy(provider: StripePaymentProvider) {
  const logger = (provider as unknown as { logger: Logger }).logger;
  return { error: vi.spyOn(logger, 'error').mockImplementation(() => undefined) };
}

function mockFetchOk(json: unknown) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: vi.fn().mockResolvedValue(json),
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('StripePaymentProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('charge', () => {
    it('converts dollars to cents (rounded) and posts to /payment_intents, with no live network call', async () => {
      const fetchMock = mockFetchOk({ id: 'pi_123', status: 'requires_payment_method' });
      const provider = new StripePaymentProvider(FAKE_SECRET_KEY);

      const result = await provider.charge({
        organizationId: 'org1',
        // 19.99 * 100 is 1998.9999999999998 in raw floating point.
        amount: 19.99,
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://api.stripe.com/v1/payment_intents');
      expect((options.headers as Record<string, string>).Authorization).toBe(
        `Bearer ${FAKE_SECRET_KEY}`,
      );
      const body = new URLSearchParams(options.body as string);
      expect(body.get('amount')).toBe('1999');
      expect(body.get('currency')).toBe('usd');
      expect(body.get('description')).toBe('SBOS payment');
      expect(body.get('metadata[organizationId]')).toBe('org1');
      expect(result).toEqual({ processorRef: 'pi_123', status: 'PENDING', provider: 'stripe' });
    });

    it('uses a given currency (lowercased) and description', async () => {
      const fetchMock = mockFetchOk({ id: 'pi_1', status: 'requires_payment_method' });
      const provider = new StripePaymentProvider(FAKE_SECRET_KEY);

      await provider.charge({
        organizationId: 'org1',
        amount: 10,
        currency: 'EUR',
        description: 'Copay',
      });

      const body = new URLSearchParams(
        (fetchMock.mock.calls[0][1] as RequestInit).body as string,
      );
      expect(body.get('currency')).toBe('eur');
      expect(body.get('description')).toBe('Copay');
    });

    it('maps a succeeded PaymentIntent status to SUCCEEDED', async () => {
      mockFetchOk({ id: 'pi_2', status: 'succeeded' });
      const provider = new StripePaymentProvider(FAKE_SECRET_KEY);

      const result = await provider.charge({ organizationId: 'org1', amount: 10 });

      expect(result.status).toBe('SUCCEEDED');
    });
  });

  describe('refund', () => {
    it('posts the payment_intent to /refunds and maps a succeeded status to REFUNDED', async () => {
      const fetchMock = mockFetchOk({ status: 'succeeded' });
      const provider = new StripePaymentProvider(FAKE_SECRET_KEY);

      const result = await provider.refund('pi_123');

      const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://api.stripe.com/v1/refunds');
      const body = new URLSearchParams(options.body as string);
      expect(body.get('payment_intent')).toBe('pi_123');
      expect(result).toEqual({ processorRef: 'pi_123', status: 'REFUNDED', provider: 'stripe' });
    });

    it('maps any non-succeeded refund status to FAILED', async () => {
      mockFetchOk({ status: 'failed' });
      const provider = new StripePaymentProvider(FAKE_SECRET_KEY);

      const result = await provider.refund('pi_123');

      expect(result.status).toBe('FAILED');
    });
  });

  it('logs the status/body and throws on a failed request, without leaking the secret key', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 402,
      text: vi.fn().mockResolvedValue('Your card was declined.'),
    });
    vi.stubGlobal('fetch', fetchMock);
    const provider = new StripePaymentProvider(FAKE_SECRET_KEY);
    const spies = loggerSpy(provider);

    await expect(
      provider.charge({ organizationId: 'org1', amount: 10 }),
    ).rejects.toThrow('Stripe request failed: 402');

    expect(spies.error).toHaveBeenCalledWith(
      expect.stringContaining('Stripe error (402): Your card was declined.'),
    );
    expect(spies.error.mock.calls[0][0] as string).not.toContain(FAKE_SECRET_KEY);
  });
});
