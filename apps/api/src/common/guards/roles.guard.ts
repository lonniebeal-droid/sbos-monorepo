import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { ROLES_KEY } from '../decorators/roles.decorator';
import { Role, ROLE_HIERARCHY } from '../enums/role.enum';
import type { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

/**
 * Enforces @Roles() requirements. A user satisfies a requirement if their role
 * is equal to, or higher in the hierarchy than, any of the required roles.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      user?: AuthenticatedUser;
    }>();
    const user = request.user;
    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    const userRank = ROLE_HIERARCHY.indexOf(user.role);
    const allowed = requiredRoles.some((role) => {
      const requiredRank = ROLE_HIERARCHY.indexOf(role);
      return userRank !== -1 && userRank <= requiredRank;
    });

    if (!allowed) {
      throw new ForbiddenException(
        'You do not have permission to perform this action',
      );
    }

    return true;
  }
}
