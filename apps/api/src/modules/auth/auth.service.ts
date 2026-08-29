import { randomUUID } from 'node:crypto';

import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import type { AppConfig } from '../../config/configuration';
import { PrismaService } from '../../prisma/prisma.service';
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
import * as bcrypt from 'bcryptjs';
import * as crypto from 'node:crypto';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<AppConfig, true>,
    private readonly mfaService: MfaService,
    private readonly prisma: PrismaService,
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

    const jti = randomUUID();
    const refreshToken = await this.jwtService.signAsync(
      { ...basePayload, type: 'refresh', jti } satisfies JwtPayload,
      {
        secret: jwtConfig.refreshSecret,
        expiresIn: jwtConfig.refreshExpiresIn,
      },
    );
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        jti,
        expiresAt: new Date(
          Date.now() + this.ttlToSeconds(jwtConfig.refreshExpiresIn) * 1000,
        ),
      },
    });

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

    const user = await this.usersService.findActiveById(payload.sub);
    const tokens = await this.issueTokens(user);
    return { ...tokens, user };
  }

  async mfaSetup(userId: string): Promise<MfaSetupResponseDto> {
    const user = await this.usersService.findActiveById(userId);
    const { secret, otpauthUrl } = this.mfaService.generate(user.email);
    await this.usersService.setMfaSecret(userId, secret);
    const qrDataUrl = await this.mfaService.qrDataUrl(otpauthUrl);
    return { otpauthUrl, qrDataUrl, secret };
  }

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

    if (payload.type !== 'refresh' || !payload.jti) {
      throw new UnauthorizedException('Invalid token type');
    }

    const stored = await this.prisma.refreshToken.findUnique({
      where: { jti: payload.jti },
    });

    if (!stored || stored.revokedAt) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: payload.sub, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      this.logger.warn(
        `Refresh token reuse detected for user ${payload.sub}; family revoked`,
      );
      throw new UnauthorizedException('Refresh token has been revoked');
    }

    if (stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token has expired');
    }

    let user: UserEntity;
    try {
      user = await this.usersService.findActiveById(payload.sub);
    } catch {
      throw new UnauthorizedException('Account is no longer active');
    }

    await this.prisma.refreshToken.update({
      where: { jti: payload.jti },
      data: { revokedAt: new Date() },
    });

    return this.issueTokens(user);
  }

  async logout(refreshToken: string): Promise<{ success: true }> {
    const jwtConfig = this.configService.get('jwt', { infer: true });
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(
        refreshToken,
        { secret: jwtConfig.refreshSecret },
      );
      if (payload.jti) {
        await this.prisma.refreshToken.updateMany({
          where: { jti: payload.jti, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
    } catch {
      // Already invalid/expired
    }
    return { success: true };
  }

  async profile(userId: string): Promise<UserEntity> {
    return this.usersService.findActiveById(userId);
  }

  async bootstrap(dto: {
    token: string;
    organizationName: string;
    organizationSlug: string;
    adminEmail: string;
    adminPassword: string;
  }): Promise<{ success: true }> {
    const configured = this.configService.get('adminBootstrapToken' as any) as string | undefined;
    const envToken = configured ?? process.env.ADMIN_BOOTSTRAP_TOKEN;
    if (!envToken) {
      throw new BadRequestException('Bootstrap is not enabled');
    }
    if (dto.token !== envToken) {
      throw new UnauthorizedException('Invalid bootstrap token');
    }

    const existingAdmin = await this.prisma.user.findFirst({ where: { role: 'ORG_ADMIN' } });
    if (existingAdmin) {
      throw new BadRequestException('An organization admin already exists');
    }

    const org = await this.prisma.organization.create({
      data: {
        name: dto.organizationName,
        slug: dto.organizationSlug,
      },
    });

    await this.usersService.create(org.id, {
      email: dto.adminEmail,
      password: dto.adminPassword,
      name: 'Administrator',
      role: Role.ORG_ADMIN,
    });

    return { success: true };
  }

  async acceptInvite(dto: AcceptInviteDto): Promise<{ success: true }> {
    const invite = await this.prisma.userInvite.findUnique({ where: { id: dto.inviteId } });
    if (!invite) throw new BadRequestException('Invalid invite');
    if (invite.usedAt) throw new BadRequestException('Invite already used');
    if (invite.expiresAt <= new Date()) throw new BadRequestException('Invite expired');

    const ok = await bcrypt.compare(dto.token, invite.tokenHash);
    if (!ok) throw new BadRequestException('Invalid invite token');

    await this.usersService.create(invite.organizationId, {
      email: invite.email,
      password: dto.password,
      name: dto.name,
      role: invite.role as unknown as Role,
    });

    await this.prisma.userInvite.update({ where: { id: invite.id }, data: { usedAt: new Date() } });
    return { success: true };
  }

  async forgotPassword(email: string): Promise<{ success: true; previewLink?: string }> {
    const record = await this.prisma.user.findFirst({ where: { email: email.trim().toLowerCase() } });
    if (!record) return { success: true };

    const token = crypto.randomBytes(24).toString('hex');
    const tokenHash = await bcrypt.hash(token, 10);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    const reset = await this.prisma.passwordReset.create({ data: { userId: record.id, tokenHash, expiresAt } });

    if (process.env.NODE_ENV !== 'production') {
      const previewLink = `/auth/reset?resetId=${reset.id}&token=${token}`;
      return { success: true, previewLink };
    }
    return { success: true };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ success: true }> {
    const reset = await this.prisma.passwordReset.findUnique({ where: { id: dto.resetId } });
    if (!reset) throw new BadRequestException('Invalid reset token');
    if (reset.usedAt) throw new BadRequestException('Reset token already used');
    if (reset.expiresAt <= new Date()) throw new BadRequestException('Reset token expired');

    const ok = await bcrypt.compare(dto.token, reset.tokenHash);
    if (!ok) throw new BadRequestException('Invalid reset token');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    await this.prisma.user.update({ where: { id: reset.userId }, data: { passwordHash } });
    await this.prisma.passwordReset.update({ where: { id: reset.id }, data: { usedAt: new Date() } });
    await this.prisma.refreshToken.deleteMany({ where: { userId: reset.userId } });
    return { success: true };
  }

  get roles(): Role[] {
    return Object.values(Role);
  }
}
