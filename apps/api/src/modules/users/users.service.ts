import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { roleSatisfies, type RoleName } from '@sbos/core';
import { Role as PrismaRole, type Prisma, type User } from '@sbos/database';

import { Role } from '../../common/enums/role.enum';
import * as crypto from 'node:crypto';
import {
  paginate,
  type PaginatedResult,
  type PaginationQueryDto,
} from '../../common/dto/pagination.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UserEntity } from './entities/user.entity';

/**
 * Prisma-backed user store. Login and user management operate on real database
 * records, scoped by organization for multi-tenant isolation.
 */
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  private toEntity(record: User): UserEntity {
    return {
      id: record.id,
      email: record.email,
      firstName: record.firstName,
      lastName: record.lastName,
      name: `${record.firstName} ${record.lastName}`.trim(),
      role: record.role as unknown as Role,
      organizationId: record.organizationId,
      createdAt: record.createdAt.toISOString(),
      passwordVersion: record.passwordVersion,
    };
  }

  /**
   * An actor may only grant a role they themselves satisfy under ROLE_SATISFIES.
   * ORG_ADMIN cannot grant SUPER_ADMIN; isolated functional roles cannot grant
   * each other or higher ranks.
   */
  private assertCanGrantRole(actorRole: Role, requestedRole: Role): void {
    if (!roleSatisfies(actorRole as RoleName, requestedRole as RoleName)) {
      throw new ForbiddenException(
        `Role ${actorRole} is not authorized to grant ${requestedRole}`,
      );
    }
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
      select: { organizationId: true, role: true },
    });
    if (!inviter || inviter.organizationId !== organizationId) {
      throw new ForbiddenException(
        'Inviter does not belong to the target organization',
      );
    }

    this.assertCanGrantRole(inviter.role as unknown as Role, role);

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

    // Only reveal the raw token in non-production for dev/test convenience.
    if (process.env.NODE_ENV !== 'production') {
      const previewLink = `/auth/invite/accept?inviteId=${record.id}&token=${token}`;
      return { id: record.id, previewLink };
    }
    return { id: record.id };
  }

  /** Validate email/password. Email lookup is global (first match) for login. */
  async validateCredentials(
    email: string,
    password: string,
  ): Promise<UserEntity | null> {
    const record = await this.prisma.user.findFirst({
      where: { email: email.trim().toLowerCase() },
    });
    if (!record) return null;
    const valid = await bcrypt.compare(password, record.passwordHash);
    if (!valid) return null;
    // A correct password must not be enough on its own: suspended/deactivated/
    // not-yet-onboarded accounts must never be able to log in.
    if (record.status !== 'ACTIVE') return null;
    return this.toEntity(record);
  }

  async findById(id: string): Promise<UserEntity> {
    const record = await this.prisma.user.findUnique({ where: { id } });
    if (!record) {
      throw new NotFoundException(`User ${id} not found`);
    }
    return this.toEntity(record);
  }

  /**
   * Tenant-scoped lookup. Cross-org ids are treated as not found (no leak).
   */
  async findByIdInOrg(organizationId: string, id: string): Promise<UserEntity> {
    const record = await this.prisma.user.findFirst({
      where: { id, organizationId },
    });
    if (!record) {
      throw new NotFoundException(`User ${id} not found`);
    }
    return this.toEntity(record);
  }

  /**
   * Like findById, but treats a non-ACTIVE account the same as a missing one.
   * Use this anywhere a fresh authorization decision is being made (e.g.
   * reissuing tokens on refresh) so a suspended/deactivated account can't
   * silently keep itself signed in -- mirrors the ACTIVE-only gate in
   * validateCredentials.
   */
  async findActiveById(id: string): Promise<UserEntity> {
    const record = await this.prisma.user.findUnique({ where: { id } });
    if (!record || record.status !== 'ACTIVE') {
      throw new NotFoundException(`User ${id} not found`);
    }
    return this.toEntity(record);
  }

  /** Read a user's MFA state (used by the auth flow). */
  async getMfaState(
    userId: string,
  ): Promise<{ mfaEnabled: boolean; mfaSecret: string | null }> {
    const record = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { mfaEnabled: true, mfaSecret: true },
    });
    if (!record) {
      throw new NotFoundException(`User ${userId} not found`);
    }
    return record;
  }

  /** Store a pending TOTP secret (enrollment step; not yet enabled). */
  async setMfaSecret(userId: string, secret: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaSecret: secret, mfaEnabled: false },
    });
  }

  /** Enable or disable MFA. Disabling clears the stored secret. */
  async setMfaEnabled(userId: string, enabled: boolean): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: enabled, ...(enabled ? {} : { mfaSecret: null }) },
    });
  }

  /**
   * Create a user in the given organization. organizationId must come from the
   * authenticated actor — never from client-supplied body fields.
   * actorRole is the grantor's role; requested dto.role must be one the actor
   * is authorized to grant (roleSatisfies).
   */
  async create(
    organizationId: string,
    actorRole: Role,
    dto: CreateUserDto,
  ): Promise<UserEntity> {
    this.assertCanGrantRole(actorRole, dto.role);

    const existing = await this.prisma.user.findFirst({
      where: {
        organizationId,
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
        organizationId,
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
