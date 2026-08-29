import { randomUUID } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
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
import { AuditAction } from '@sbos/database';
import { AuditService } from '../../audit/audit.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<AppConfig, true>,
    private readonly mfaService: MfaService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
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
      passwordVersion: user.passwordVersion,
    };

    const accessToken = await this.jwtService.signAsync(
      { ...basePayload, type: 'access' } satisfies JwtPayload,
      {
        secret: jwtConfig.accessSecret,
        expiresIn: jwtConfig.accessExpiresIn,
      },
    );

    // Each refresh token gets a unique jti tracked in the database so it can be
    // rotated on use and revoked on logout.
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
      // Defer token issuance until the second factor is verified.
      const jwtConfig = this.configService.get('jwt', { infer: true });
      const mfaToken = await this.jwtService.signAsync(
        { sub: user.id, type: 'mfa' } satisfies MfaChallengePayload,
        { secret: jwtConfig.accessSecret, expiresIn: '5m' },
      );
      return { mfaRequired: true, mfaToken };
    }

    const tokens = await this.issueTokens(user);
    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: AuditAction.LOGIN,
      entityType: 'User',
      entityId: user.id,
      metadata: { method: 'password' },
    });
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
    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: AuditAction.LOGIN,
      entityType: 'User',
      entityId: user.id,
      metadata: { method: 'mfa' },
    });
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
    const user = await this.usersService.findById(userId);
    await this.audit.record({
      organizationId: user.organizationId,
      actorId: userId,
      action: AuditAction.UPDATE,
      entityType: 'User',
      entityId: userId,
      metadata: { mfaEnabled: true },
    });
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
    const user = await this.usersService.findById(userId);
    await this.audit.record({
      organizationId: user.organizationId,
      actorId: userId,
      action: AuditAction.UPDATE,
      entityType: 'User',
      entityId: userId,
      metadata: { mfaEnabled: false },
    });
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
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Atomic claim: only the first concurrent presenter of this jti wins.
    // Losers see count !== 1 and are treated as reuse (family revoke).
    const claimed = await this.prisma.refreshToken.updateMany({
      where: { jti: payload.jti, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (claimed.count !== 1) {
      const stored = await this.prisma.refreshToken.findUnique({
        where: { jti: payload.jti },
      });
      // Reuse of a revoked token → revoke the whole family for this user.
      if (stored?.revokedAt) {
        this.logger.warn(
          `Refresh token reuse detected for user ${payload.sub}; family revoked`,
        );
        await this.prisma.refreshToken.updateMany({
          where: { userId: payload.sub, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      throw new UnauthorizedException('Invalid or revoked refresh token');
    }

    // A suspended/deactivated (or deleted) account must not be able to
    // silently keep itself signed in via refresh.
    const user = await this.usersService.findActiveById(payload.sub);

    // Credential-version gate: tokens issued under a prior password must not
    // rotate into a new session after a password change/reset.
    if (
      typeof payload.passwordVersion !== 'number' ||
      user.passwordVersion !== payload.passwordVersion
    ) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    return this.issueTokens(user);
  }

  async logout(refreshToken: string): Promise<{ success: true }> {
    const jwtConfig = this.configService.get('jwt', { infer: true });
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret: jwtConfig.refreshSecret,
      });
      if (payload.type === 'refresh' && payload.jti) {
        const result = await this.prisma.refreshToken.updateMany({
          where: { jti: payload.jti, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        // Only audit when a session was actually revoked.
        if (result.count > 0 && payload.sub && payload.organizationId) {
          await this.audit.record({
            organizationId: payload.organizationId,
            actorId: payload.sub,
            action: AuditAction.LOGOUT,
            entityType: 'User',
            entityId: payload.sub,
            metadata: { jtiRevoked: true },
          });
        }
      }
    } catch {
      // Silent: logout is best-effort.
    }
    return { success: true };
  }

  async profile(userId: string): Promise<UserEntity> {
    return this.usersService.findById(userId);
  }

  async bootstrap(dto: {
    organizationName: string;
    organizationSlug: string;
    adminEmail: string;
    adminPassword: string;
    token: string;
  }): Promise<{ success: true }> {
    const envToken = process.env.BOOTSTRAP_TOKEN;
    if (!envToken) {
      throw new UnauthorizedException('Bootstrap is disabled');
    }
    if (dto.token !== envToken) {
      throw new UnauthorizedException('Invalid bootstrap token');
    }

    // Disallow bootstrap if any ORG_ADMIN already exists.
    const existingAdmin = await this.prisma.user.findFirst({ where: { role: 'ORG_ADMIN' } });
    if (existingAdmin) {
      throw new BadRequestException('An organization admin already exists');
    }

    // Create organization and admin user.
    const org = await this.prisma.organization.create({
      data: {
        name: dto.organizationName,
        slug: dto.organizationSlug,
      },
    });

    await this.audit.record({
      organizationId: org.id,
      // System bootstrap: no authenticated human actor.
      action: AuditAction.CREATE,
      entityType: 'Organization',
      entityId: org.id,
      metadata: {
        source: 'bootstrap',
        name: org.name,
        slug: org.slug,
      },
    });

    // UsersService.create records CREATE on User (actorId omitted for bootstrap).
    await this.usersService.create({
      organizationId: org.id,
      email: dto.adminEmail,
      password: dto.adminPassword,
      name: 'Administrator',
      role: Role.ORG_ADMIN,
    } as any);

    return { success: true };
  }

  /**
   * Accept an invite: validate token, atomically claim the invite, create the
   * user. Role and organizationId come only from the stored invite.
   *
   * Concurrency: a conditional update (usedAt IS NULL) claims the invite inside
   * a transaction with user creation. Exactly one concurrent accepter succeeds;
   * losers get a controlled "already used" error. User-create failure rolls
   * back the claim so the invite is not permanently consumed.
   */
  async acceptInvite(dto: AcceptInviteDto): Promise<{ success: true }> {
    const invite = await this.prisma.userInvite.findUnique({
      where: { id: dto.inviteId },
    });
    if (!invite) throw new BadRequestException('Invalid invite');
    if (invite.usedAt) throw new BadRequestException('Invite already used');
    if (invite.expiresAt <= new Date()) {
      throw new BadRequestException('Invite expired');
    }

    const ok = await bcrypt.compare(dto.token, invite.tokenHash);
    if (!ok) throw new BadRequestException('Invalid invite token');

    const email = invite.email.trim().toLowerCase();
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const [firstName, ...rest] = dto.name.trim().split(' ');

    const userId = await this.prisma.$transaction(async (tx) => {
      // Atomic claim: only the first unexpired, unused claim wins.
      const claimed = await tx.userInvite.updateMany({
        where: {
          id: invite.id,
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { usedAt: new Date() },
      });
      if (claimed.count !== 1) {
        // Re-read to distinguish expired vs already-used for a clear message.
        const current = await tx.userInvite.findUnique({
          where: { id: invite.id },
          select: { usedAt: true, expiresAt: true },
        });
        if (current?.usedAt) {
          throw new BadRequestException('Invite already used');
        }
        throw new BadRequestException('Invite expired');
      }

      const existing = await tx.user.findFirst({
        where: { organizationId: invite.organizationId, email },
        select: { id: true },
      });
      if (existing) {
        // Rolls back the claim so the invite is not stuck consumed without a
        // matching new user from this request.
        throw new ConflictException('A user with that email already exists');
      }

      const record = await tx.user.create({
        data: {
          organizationId: invite.organizationId,
          email,
          passwordHash,
          firstName: firstName ?? dto.name,
          lastName: rest.join(' ') || '',
          role: invite.role,
        },
      });

      // Clinician profile is required for appointments/notes FK targets.
      if (record.role === 'CLINICIAN') {
        await tx.clinician.create({
          data: {
            organizationId: record.organizationId,
            userId: record.id,
          },
        });
      }

      return record.id;
    });

    await this.audit.record({
      organizationId: invite.organizationId,
      actorId: userId,
      action: AuditAction.CREATE,
      entityType: 'User',
      entityId: userId,
      metadata: {
        email,
        role: invite.role,
        via: 'invite_accept',
        inviteId: invite.id,
      },
    });

    return { success: true };
  }

  /** Request a password reset. Silent response regardless of email existence. */
  async forgotPassword(email: string): Promise<{ success: true; previewLink?: string }>
  {
    const record = await this.prisma.user.findFirst({ where: { email: email.trim().toLowerCase() } });
    if (!record) return { success: true };

    const token = crypto.randomBytes(24).toString('hex');
    const tokenHash = await bcrypt.hash(token, 10);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    const reset = await this.prisma.passwordReset.create({ data: { userId: record.id, tokenHash, expiresAt } });

    if (process.env.NODE_ENV !== 'production') {
      const previewLink = `/auth/reset?resetId=${reset.id}&token=${token}`;
      return { success: true, previewLink };
    }
    return { success: true };
  }

  /**
   * Reset a password using a reset record. Token claim is atomic (usedAt IS
   * NULL) so concurrent use of the same token yields exactly one password
   * change; the loser receives a controlled already-used error.
   */
  async resetPassword(dto: ResetPasswordDto): Promise<{ success: true }> {
    const reset = await this.prisma.passwordReset.findUnique({
      where: { id: dto.resetId },
    });
    if (!reset) throw new BadRequestException('Invalid reset token');
    if (reset.usedAt) throw new BadRequestException('Reset token already used');
    if (reset.expiresAt <= new Date()) {
      throw new BadRequestException('Reset token expired');
    }

    const ok = await bcrypt.compare(dto.token, reset.tokenHash);
    if (!ok) throw new BadRequestException('Invalid reset token');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.findUnique({
      where: { id: reset.userId },
      select: { id: true, organizationId: true, email: true },
    });
    if (!user) throw new BadRequestException('Invalid reset token');

    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.passwordReset.updateMany({
        where: {
          id: reset.id,
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { usedAt: new Date() },
      });
      if (claimed.count !== 1) {
        const current = await tx.passwordReset.findUnique({
          where: { id: reset.id },
          select: { usedAt: true, expiresAt: true },
        });
        if (current?.usedAt) {
          throw new BadRequestException('Reset token already used');
        }
        throw new BadRequestException('Reset token expired');
      }

      await tx.user.update({
        where: { id: reset.userId },
        data: {
          passwordHash,
          passwordVersion: { increment: 1 },
        },
      });
      await tx.refreshToken.deleteMany({ where: { userId: reset.userId } });
    });

    await this.audit.record({
      organizationId: user.organizationId,
      actorId: user.id,
      action: AuditAction.UPDATE,
      entityType: 'User',
      entityId: user.id,
      metadata: {
        credentialChange: 'password_reset',
        resetId: reset.id,
        email: user.email,
      },
    });
    return { success: true };
  }

  /** Exposed for documentation/testing of role constants. */
  get roles(): Role[] {
    return Object.values(Role);
  }
}
