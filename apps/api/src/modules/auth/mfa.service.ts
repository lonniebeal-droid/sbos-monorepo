import { Injectable } from '@nestjs/common';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';

/**
 * TOTP (RFC 6238) multi-factor authentication helper. Secrets and codes are
 * generated and verified locally — no external service or credentials required.
 */
@Injectable()
export class MfaService {
  private readonly issuer = 'SBOS';

  /** Generate a new base32 TOTP secret and its otpauth:// provisioning URI. */
  generate(accountEmail: string): { secret: string; otpauthUrl: string } {
    const secret = authenticator.generateSecret();
    const otpauthUrl = authenticator.keyuri(accountEmail, this.issuer, secret);
    return { secret, otpauthUrl };
  }

  /** Render an otpauth URI as a data-URL QR image for enrollment. */
  async qrDataUrl(otpauthUrl: string): Promise<string> {
    return QRCode.toDataURL(otpauthUrl);
  }

  /** Verify a 6-digit TOTP code against a secret (±1 step tolerance). */
  verify(code: string, secret: string): boolean {
    try {
      return authenticator.verify({ token: code.trim(), secret });
    } catch {
      return false;
    }
  }
}
