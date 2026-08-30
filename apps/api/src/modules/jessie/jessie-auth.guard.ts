import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PrismaService } from '../../prisma/prisma.service';

export interface JessieContext {
  organizationId: string;
  userId: string;
  isServiceAccount: boolean;
}

declare global {
  namespace Express {
    interface Request {
      jessieContext?: JessieContext;
    }
  }
}

@Injectable()
export class JessieAuthGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    const serviceSecret = this.config.get<string>('JESSIE_SERVICE_SECRET');
    if (!serviceSecret) {
      throw new UnauthorizedException('Service authentication not configured');
    }

    const authHeader = request.headers['authorization'] ?? request.headers['Authorization'];
    if (!authHeader) {
      throw new UnauthorizedException('Missing Authorization header');
    }

    const [scheme, token] = authHeader.split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Invalid Authorization header format');
    }

    if (token !== serviceSecret) {
      throw new UnauthorizedException('Invalid service credentials');
    }

    const organizationId = request.headers['x-organization-id'] ?? request.headers['X-Organization-Id'];
    if (!organizationId) {
      throw new UnauthorizedException('Missing X-Organization-Id header');
    }

    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, isActive: true },
    });

    if (!organization || !organization.isActive) {
      throw new UnauthorizedException('Invalid or inactive organization');
    }

    request.jessieContext = {
      organizationId: organization.id,
      userId: 'jessie-service-account',
      isServiceAccount: true,
    };

    return true;
  }
}