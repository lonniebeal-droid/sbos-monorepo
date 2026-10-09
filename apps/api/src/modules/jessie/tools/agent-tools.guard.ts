import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

import type { AppConfig } from '../../../config/configuration';
import { resolveOrgFromSecret } from '../../../config/agent-secrets';

export const AGENT_SECRET_HEADER = 'x-sbos-agent-secret';

/**
 * Resolves organizationId from a server-configured secret map.
 * Never trusts organizationId from the request body.
 * Uses constant-time secret comparison; never logs or returns secret values.
 */
@Injectable()
export class AgentToolsGuard implements CanActivate {
  constructor(private readonly config: ConfigService<AppConfig, true>) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const presented = req.header(AGENT_SECRET_HEADER)?.trim() ?? '';
    if (!presented) {
      throw new UnauthorizedException('Missing agent credentials');
    }

    const map =
      this.config.get('jessieAgent', { infer: true })?.secrets ?? {};
    const organizationId = resolveOrgFromSecret(map, presented);
    if (!organizationId) {
      throw new UnauthorizedException('Invalid agent credentials');
    }

    (req as Request & { agentOrganizationId: string }).agentOrganizationId =
      organizationId;
    return true;
  }
}
