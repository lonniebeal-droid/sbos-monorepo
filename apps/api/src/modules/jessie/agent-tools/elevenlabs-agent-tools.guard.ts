import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';

@Injectable()
export class ElevenLabsAgentToolsGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected =
      this.config.get<string>('ELEVENLABS_AGENT_TOOLS_SECRET') ??
      process.env.ELEVENLABS_AGENT_TOOLS_SECRET;
    const request = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, string | string[] | undefined> }>();
    const raw = request.headers['x-ju-agent-tools-secret'];
    const supplied = Array.isArray(raw) ? raw[0] : raw;

    if (!expected || !supplied) {
      throw new UnauthorizedException('Agent tools authentication required');
    }

    const expectedBytes = Buffer.from(expected);
    const suppliedBytes = Buffer.from(supplied);
    if (
      expectedBytes.length !== suppliedBytes.length ||
      !timingSafeEqual(expectedBytes, suppliedBytes)
    ) {
      throw new UnauthorizedException('Invalid agent tools credentials');
    }

    return true;
  }
}
