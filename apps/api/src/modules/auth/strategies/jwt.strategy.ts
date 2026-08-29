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
   * Signature/expiry are already verified by passport-jwt. We load the user so:
   * - SUSPENDED/DEACTIVATED/deleted accounts cannot ride a valid access token
   * - passwordVersion mismatch invalidates tokens issued before a password reset
   * - role/organizationId always come from the DB (never stale JWT claims)
   */
  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    if (payload.type !== 'access') {
      throw new UnauthorizedException('Invalid token type');
    }

    if (
      payload.passwordVersion === undefined ||
      payload.passwordVersion === null ||
      typeof payload.passwordVersion !== 'number'
    ) {
      throw new UnauthorizedException('Invalid token version');
    }

    try {
      const user = await this.usersService.findActiveById(payload.sub);
      if (user.passwordVersion !== payload.passwordVersion) {
        throw new UnauthorizedException('Token version is stale');
      }
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        organizationId: user.organizationId,
      };
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException('Account is no longer active');
    }
  }
}
