import { describe, expect, it } from 'vitest';
import { authenticator } from 'otplib';

import { MfaService } from './mfa.service';

describe('MfaService', () => {
  const service = new MfaService();

  it('generates a secret and matching otpauth URL', () => {
    const { secret, otpauthUrl } = service.generate('user@sbos.health');
    expect(secret).toMatch(/^[A-Z2-7]+$/);
    expect(otpauthUrl).toContain('otpauth://totp/');
    expect(otpauthUrl).toContain('SBOS');
  });

  it('verifies a valid current code', () => {
    const { secret } = service.generate('user@sbos.health');
    const code = authenticator.generate(secret);
    expect(service.verify(code, secret)).toBe(true);
  });

  it('rejects an invalid code', () => {
    const { secret } = service.generate('user@sbos.health');
    expect(service.verify('000000', secret)).toBe(false);
  });

  it('produces a QR data URL', async () => {
    const { otpauthUrl } = service.generate('user@sbos.health');
    const qr = await service.qrDataUrl(otpauthUrl);
    expect(qr.startsWith('data:image/png;base64,')).toBe(true);
  });
});
