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

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    if (payload.type !== 'access') {
      throw new UnauthorizedException('Invalid token type');
    }
    if (typeof payload.passwordVersion !== 'number') {
      throw new UnauthorizedException('Invalid token version');
    }
    try {
      // Resolve authorization from current DB state, never stale JWT role/org claims.
      const user = await this.usersService.findActiveById(payload.sub);
      if (user.passwordVersion !== payload.passwordVersion) {
        throw new UnauthorizedException('Session is no longer valid');
      }
      return {
        id: user.id, email: user.email, name: user.name, role: user.role,
        organizationId: user.organizationId,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Account is no longer active');
    }
  }
}
