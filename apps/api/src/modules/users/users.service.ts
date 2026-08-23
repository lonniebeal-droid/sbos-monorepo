import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { Role as PrismaRole, type Prisma, type User } from '@sbos/database';
import { roleSatisfies } from '@sbos/core';

import { Role } from '../../common/enums/role.enum';
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
    };
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
   * Tenant-scoped lookup. Use for any request where the id comes from the
   * caller: a user in another organization must be indistinguishable from a
   * user that does not exist.
   */
  async findByIdInOrganization(
    organizationId: string,
    id: string,
  ): Promise<UserEntity> {
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
   * Create a user inside `actor`'s own organization. The organization comes
   * from the caller's token, never the request body, and the new account may
   * not outrank its creator.
   */
  async create(
    actor: { organizationId: string; role: Role },
    dto: CreateUserDto,
  ): Promise<UserEntity> {
    if (!roleSatisfies(actor.role, dto.role)) {
      throw new ForbiddenException(
        'Cannot create a user with more privileges than your own role',
      );
    }

    const organizationId = actor.organizationId;
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
