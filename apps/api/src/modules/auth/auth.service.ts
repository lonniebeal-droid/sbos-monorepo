import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import type { AppConfig } from '../../config/configuration';
import { Role } from '../../common/enums/role.enum';
import type {
  JwtPayload,
  MfaChallengePayload,
} from '../../common/interfaces/authenticated-user.interface';
import { UsersService } from '../users/users.service';
import { UserEntity } from '../users/entities/user.entity';
import { AuthResponseDto, AuthTokensDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { MfaService } from './mfa.service';
import { MfaChallengeDto, MfaSetupResponseDto } from './dto/mfa.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<AppConfig, true>,
    private readonly mfaService: MfaService,
  ) {}

  private ttlToSeconds(ttl: string): number {
    const match = /^(\d+)([smhd])$/.exec(ttl);
    if (!match) return 900;
    const value = parseInt(match[1], 10);
    const unit = match[2];
    const multipliers: Record<string, number> = {
      s: 1,
      m: 60,
      h: 3600,
      d: 86400,
    };
    return value * (multipliers[unit] ?? 60);
  }

  private async issueTokens(user: UserEntity): Promise<AuthTokensDto> {
    const jwtConfig = this.configService.get('jwt', { infer: true });
    const basePayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organizationId: user.organizationId,
    };

    const accessToken = await this.jwtService.signAsync(
      { ...basePayload, type: 'access' } satisfies JwtPayload,
      {
        secret: jwtConfig.accessSecret,
        expiresIn: jwtConfig.accessExpiresIn,
      },
    );

    const refreshToken = await this.jwtService.signAsync(
      { ...basePayload, type: 'refresh' } satisfies JwtPayload,
      {
        secret: jwtConfig.refreshSecret,
        expiresIn: jwtConfig.refreshExpiresIn,
      },
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: this.ttlToSeconds(jwtConfig.accessExpiresIn),
    };
  }

  async login(dto: LoginDto): Promise<AuthResponseDto | MfaChallengeDto> {
    const user = await this.usersService.validateCredentials(
      dto.email,
      dto.password,
    );
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const mfa = await this.usersService.getMfaState(user.id);
    if (mfa.mfaEnabled) {
      // Defer token issuance until the second factor is verified.
      const jwtConfig = this.configService.get('jwt', { infer: true });
      const mfaToken = await this.jwtService.signAsync(
        { sub: user.id, type: 'mfa' } satisfies MfaChallengePayload,
        { secret: jwtConfig.accessSecret, expiresIn: '5m' },
      );
      return { mfaRequired: true, mfaToken };
    }

    const tokens = await this.issueTokens(user);
    return { ...tokens, user };
  }

  /** Complete a login after MFA is required: verify the challenge + TOTP code. */
  async loginMfa(mfaToken: string, code: string): Promise<AuthResponseDto> {
    const jwtConfig = this.configService.get('jwt', { infer: true });
    let payload: MfaChallengePayload;
    try {
      payload = await this.jwtService.verifyAsync<MfaChallengePayload>(
        mfaToken,
        { secret: jwtConfig.accessSecret },
      );
    } catch {
      throw new UnauthorizedException('Invalid or expired MFA challenge');
    }
    if (payload.type !== 'mfa') {
      throw new UnauthorizedException('Invalid MFA challenge');
    }

    const mfa = await this.usersService.getMfaState(payload.sub);
    if (!mfa.mfaEnabled || !mfa.mfaSecret) {
      throw new UnauthorizedException('MFA is not enabled for this account');
    }
    if (!this.mfaService.verify(code, mfa.mfaSecret)) {
      throw new UnauthorizedException('Invalid authentication code');
    }

    const user = await this.usersService.findById(payload.sub);
    const tokens = await this.issueTokens(user);
    return { ...tokens, user };
  }

  /** Begin MFA enrollment: generate + store a pending secret, return QR data. */
  async mfaSetup(userId: string): Promise<MfaSetupResponseDto> {
    const user = await this.usersService.findById(userId);
    const { secret, otpauthUrl } = this.mfaService.generate(user.email);
    await this.usersService.setMfaSecret(userId, secret);
    const qrDataUrl = await this.mfaService.qrDataUrl(otpauthUrl);
    return { otpauthUrl, qrDataUrl, secret };
  }

  /** Confirm enrollment: verify the first code, then enable MFA. */
  async mfaEnable(userId: string, code: string): Promise<{ enabled: true }> {
    const mfa = await this.usersService.getMfaState(userId);
    if (!mfa.mfaSecret) {
      throw new BadRequestException('Start MFA setup before enabling');
    }
    if (!this.mfaService.verify(code, mfa.mfaSecret)) {
      throw new BadRequestException('Invalid authentication code');
    }
    await this.usersService.setMfaEnabled(userId, true);
    return { enabled: true };
  }

  /** Disable MFA after verifying a current code. */
  async mfaDisable(userId: string, code: string): Promise<{ enabled: false }> {
    const mfa = await this.usersService.getMfaState(userId);
    if (!mfa.mfaEnabled || !mfa.mfaSecret) {
      throw new BadRequestException('MFA is not enabled');
    }
    if (!this.mfaService.verify(code, mfa.mfaSecret)) {
      throw new BadRequestException('Invalid authentication code');
    }
    await this.usersService.setMfaEnabled(userId, false);
    return { enabled: false };
  }

  async refresh(refreshToken: string): Promise<AuthTokensDto> {
    const jwtConfig = this.configService.get('jwt', { infer: true });
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret: jwtConfig.refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid token type');
    }

    const user = await this.usersService.findById(payload.sub);
    return this.issueTokens(user);
  }

  async profile(userId: string): Promise<UserEntity> {
    return this.usersService.findById(userId);
  }

  /** Exposed for documentation/testing of role constants. */
  get roles(): Role[] {
    return Object.values(Role);
  }
}
