import { describe, expect, it } from 'vitest';

import { ManualPaymentProvider } from './manual-payment.provider';

describe('ManualPaymentProvider', () => {
  describe('charge', () => {
    it('uses the given reference as the processor reference', async () => {
      const provider = new ManualPaymentProvider();

      const result = await provider.charge({
        organizationId: 'org1',
        amount: 40,
        reference: 'receipt-001',
      });

      expect(result).toEqual({
        processorRef: 'receipt-001',
        status: 'SUCCEEDED',
        provider: 'manual',
      });
    });

    it('generates a man_<uuid> processor reference when none is given', async () => {
      const provider = new ManualPaymentProvider();

      const result = await provider.charge({ organizationId: 'org1', amount: 40 });

      expect(result.processorRef).toMatch(
        /^man_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
      expect(result.status).toBe('SUCCEEDED');
    });

    it('never fails, regardless of amount', async () => {
      const provider = new ManualPaymentProvider();

      const result = await provider.charge({ organizationId: 'org1', amount: 0 });

      expect(result.status).toBe('SUCCEEDED');
    });
  });

  describe('refund', () => {
    it('marks the given processor reference as refunded', async () => {
      const provider = new ManualPaymentProvider();

      const result = await provider.refund('receipt-001');

      expect(result).toEqual({
        processorRef: 'receipt-001',
        status: 'REFUNDED',
        provider: 'manual',
      });
    });
  });
});
