import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import {
  AuditAction,
  Role as PrismaRole,
  type Prisma,
  type User,
} from '@sbos/database';

import { Role } from '../../common/enums/role.enum';
import * as crypto from 'node:crypto';
import {
  paginate,
  type PaginatedResult,
  type PaginationQueryDto,
} from '../../common/dto/pagination.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UserEntity } from './entities/user.entity';

/**
 * Prisma-backed user store. Login and user management operate on real database
 * records, scoped by organization for multi-tenant isolation.
 */
@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private toEntity(record: User): UserEntity {
    return {
      id: record.id,
      email: record.email,
      firstName: record.firstName,
      lastName: record.lastName,
      name: `${record.firstName} ${record.lastName}`.trim(),
      role: record.role as unknown as Role,
      organizationId: record.organizationId,
      passwordVersion: record.passwordVersion,
      createdAt: record.createdAt.toISOString(),
    };
  }

  /** Create a single-use invite record and return an opaque token (dev-only). */
  async createInvite(
    email: string,
    role: Role,
    invitedById: string,
    organizationId: string,
  ): Promise<{ id: string; previewLink?: string }> {
    // Ensure the inviter belongs to the same organization to prevent cross-org invites.
    const inviter = await this.prisma.user.findUnique({
      where: { id: invitedById },
      select: { organizationId: true },
    });
    if (!inviter || inviter.organizationId !== organizationId) {
      throw new Error('Inviter does not belong to the target organization');
    }
    const token = crypto.randomBytes(24).toString('hex');
    const tokenHash = await bcrypt.hash(token, 10);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    const record = await this.prisma.userInvite.create({
      data: {
        organizationId,
        email: email.trim().toLowerCase(),
        role: role as unknown as PrismaRole,
        tokenHash,
        expiresAt,
        invitedById,
      },
    });

    await this.audit.record({
      organizationId,
      actorId: invitedById,
      action: AuditAction.CREATE,
      entityType: 'UserInvite',
      entityId: record.id,
      metadata: { email: record.email, role: record.role },
    });

    // In production the token is emailed; in development we surface a preview link.
    const previewLink =
      process.env.NODE_ENV !== 'production'
        ? `/invite/accept?id=${record.id}&token=${token}`
        : undefined;

    return { id: record.id, previewLink };
  }

  async findActiveById(id: string): Promise<UserEntity> {
    const record = await this.prisma.user.findFirst({
      where: { id, status: 'ACTIVE' },
    });
    if (!record) {
      throw new NotFoundException('User not found');
    }
    return this.toEntity(record);
  }

  async findByEmail(
    email: string,
    organizationId?: string,
  ): Promise<(UserEntity & { passwordHash: string }) | null> {
    const record = await this.prisma.user.findFirst({
      where: {
        email: email.trim().toLowerCase(),
        ...(organizationId ? { organizationId } : {}),
      },
    });
    if (!record) return null;
    return { ...this.toEntity(record), passwordHash: record.passwordHash };
  }

  async validatePassword(
    email: string,
    password: string,
    organizationId?: string,
  ): Promise<UserEntity | null> {
    const record = await this.prisma.user.findFirst({
      where: {
        email: email.trim().toLowerCase(),
        status: 'ACTIVE',
        ...(organizationId ? { organizationId } : {}),
      },
    });
    if (!record) return null;
    const valid = await bcrypt.compare(password, record.passwordHash);
    if (!valid) return null;
    return this.toEntity(record);
  }

  async recordLogin(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });
  }

  /**
   * Create a user directly (admin/bootstrap path). Prefer invites for normal
   * onboarding so the password is chosen by the invitee.
   */
  async create(dto: CreateUserDto, actorId?: string): Promise<UserEntity> {
    const existing = await this.prisma.user.findFirst({
      where: {
        organizationId: dto.organizationId,
        email: dto.email.trim().toLowerCase(),
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('A user with that email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const [firstName, ...rest] = dto.name.trim().split(' ');
    const record = await this.prisma.user.create({
      data: {
        organizationId: dto.organizationId,
        email: dto.email.trim().toLowerCase(),
        passwordHash,
        firstName: firstName ?? dto.name,
        lastName: rest.join(' ') || '',
        role: dto.role as unknown as PrismaRole,
      },
    });

    // Clinicians must have a Clinician profile row: appointments and notes
    // reference the profile (Appointment.clinicianId -> Clinician.id), not
    // the user row. Without it, booking for an invited clinician fails.
    if (record.role === 'CLINICIAN') {
      await this.prisma.clinician.create({
        data: { organizationId: record.organizationId, userId: record.id },
      });
    }

    await this.audit.record({
      organizationId: record.organizationId,
      actorId,
      action: AuditAction.CREATE,
      entityType: 'User',
      entityId: record.id,
      metadata: {
        email: record.email,
        role: record.role,
      },
    });

    return this.toEntity(record);
  }

  async findAll(
    query: PaginationQueryDto,
    organizationId: string,
  ): Promise<PaginatedResult<UserEntity>> {
    const where: Prisma.UserWhereInput = {
      organizationId,
      ...(query.search
        ? {
            OR: [
              { firstName: { contains: query.search, mode: 'insensitive' } },
              { lastName: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, records] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);

    return paginate(
      records.map((record) => this.toEntity(record)),
      total,
      query.page,
      query.limit,
    );
  }
}
