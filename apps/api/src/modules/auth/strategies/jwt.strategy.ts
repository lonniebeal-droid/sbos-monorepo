import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import type { AppConfig } from '../../../config/configuration';
import type {
  AuthenticatedUser,
  JwtPayload,
} from '../../../common/interfaces/authenticated-user.interface';
import { UsersService } from '../../users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService<AppConfig, true>,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('jwt', { infer: true }).accessSecret,
    });
  }

  /**
   * Reject non-access tokens, missing/stale passwordVersion, and
   * suspended/deactivated/missing users. Authorization claims (role,
   * organizationId) always come from the current DB row, never from the JWT.
   */
  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    if (payload.type !== 'access') {
      throw new UnauthorizedException('Invalid token type');
    }
    if (typeof payload.passwordVersion !== 'number') {
      throw new UnauthorizedException('Invalid token version');
    }

    // findActiveById throws NotFoundException for missing/non-ACTIVE users.
    // Map to UnauthorizedException so the client treats it as an auth failure.
    let user;
    try {
      user = await this.usersService.findActiveById(payload.sub);
    } catch {
      throw new UnauthorizedException('Invalid or revoked credentials');
    }

    if (user.passwordVersion !== payload.passwordVersion) {
      throw new UnauthorizedException('Invalid or revoked credentials');
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organizationId: user.organizationId,
    };
  }
}
