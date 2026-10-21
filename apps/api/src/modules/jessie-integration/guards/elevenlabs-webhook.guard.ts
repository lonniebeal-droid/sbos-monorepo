import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class ElevenLabsWebhookGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const signature = request.headers['x-elevenlabs-signature'] as string | undefined;
    const timestamp = request.headers['x-elevenlabs-timestamp'] as string | undefined;
    const rawBody = request.rawBody as Buffer | string | undefined;
    const body =
      typeof rawBody === 'string'
        ? rawBody
        : Buffer.isBuffer(rawBody)
          ? rawBody.toString('utf8')
          : undefined;

    if (!signature || !timestamp || !body) {
      throw new UnauthorizedException('Missing ElevenLabs webhook headers');
    }

    const webhookSecret = this.configService.get<string>('JESSIE_ELEVENLABS_WEBHOOK_SECRET');
    if (!webhookSecret) {
      throw new UnauthorizedException('ElevenLabs webhook secret not configured');
    }

    const expectedSignature = this.computeSignature(webhookSecret, timestamp, body);
    const isValid = this.timingSafeEqual(signature, expectedSignature);

    if (!isValid) {
      throw new UnauthorizedException('Invalid ElevenLabs webhook signature');
    }

    const now = Math.floor(Date.now() / 1000);
    const requestTime = parseInt(timestamp, 10);
    if (Math.abs(now - requestTime) > 300) {
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
