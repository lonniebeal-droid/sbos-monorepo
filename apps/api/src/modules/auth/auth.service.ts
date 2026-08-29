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

  // SIZE_PROBE_PARTIAL_CONTENT_TEST
}
