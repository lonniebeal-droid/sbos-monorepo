import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class ElevenLabsWebhookGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const header = request.headers['elevenlabs-signature'];
    if (typeof header !== 'string' || header.length > 2048) {
      throw new UnauthorizedException('Missing ElevenLabs webhook signature');
    }
    const fields = header.split(',').map((part: string) => part.trim().split('='));
    const timestamps = fields.filter((part: string[]) => part[0] === 't');
    const signatures = fields.filter((part: string[]) => part[0] === 'v0').map((part: string[]) => part[1]);
    const timestamp = timestamps.length === 1 ? timestamps[0][1] : undefined;
    if (!timestamp || !/^\d{10,11}$/.test(timestamp) || !signatures.length || signatures.some((value: string) => !/^[a-f0-9]{64}$/i.test(value))) {
      throw new UnauthorizedException('Malformed ElevenLabs webhook signature');
    }
    const rawBody = request.rawBody as Buffer | string | undefined;
    const body =
      typeof rawBody === 'string'
        ? rawBody
        : Buffer.isBuffer(rawBody)
          ? rawBody.toString('utf8')
          : undefined;

    if (!body) {
      throw new UnauthorizedException('Missing ElevenLabs webhook headers');
    }

    const webhookSecret = this.configService.get<string>('JESSIE_ELEVENLABS_WEBHOOK_SECRET');
    if (!webhookSecret) {
      throw new UnauthorizedException('ElevenLabs webhook secret not configured');
    }

    const expectedSignature = this.computeSignature(webhookSecret, timestamp, body);
    const isValid = signatures.some((signature: string) => this.timingSafeEqual(signature.toLowerCase(), expectedSignature));

    if (!isValid) {
      throw new UnauthorizedException('Invalid ElevenLabs webhook signature');
    }

    const now = Math.floor(Date.now() / 1000);
    const requestTime = Number(timestamp);
    if (!Number.isSafeInteger(requestTime) || Math.abs(now - requestTime) > 300) {
      throw new UnauthorizedException('ElevenLabs webhook timestamp expired');
    }

    return true;
  }

  private computeSignature(secret: string, timestamp: string, body: string): string {
    const payload = `${timestamp}.${body}`;
    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
  }

  private timingSafeEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) {
      return false;
    }
    return crypto.timingSafeEqual(bufA, bufB);
  }
}
