import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

import { Role } from '../../common/enums/role.enum';
import {
  paginate,
  type PaginatedResult,
  type PaginationQueryDto,
} from '../../common/dto/pagination.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UserEntity } from './entities/user.entity';

interface UserRecord extends UserEntity {
  passwordHash: string;
}

/**
 * User store. Backed by an in-memory collection for Phase 2; this is replaced by
 * the Prisma-backed repository in Phase 3 without changing the public surface.
 */
@Injectable()
export class UsersService {
  private readonly users: UserRecord[] = [];

  constructor() {
    void this.seedDefaults();
  }

  private async seedDefaults(): Promise<void> {
    const defaults: Array<Omit<CreateUserDto, 'password'> & { password: string }> =
      [
        {
          email: 'admin@sbos.health',
          name: 'Alex Administrator',
          password: 'Sbos!2026',
          role: Role.ORG_ADMIN,
          organizationId: 'org_success_brand',
        },
        {
          email: 'clinician@sbos.health',
          name: 'Dr. Riley Chen',
          password: 'Sbos!2026',
          role: Role.CLINICIAN,
          organizationId: 'org_success_brand',
        },
      ];

    for (const seed of defaults) {
      const passwordHash = await bcrypt.hash(seed.password, 10);
      this.users.push({
        id: `usr_${this.users.length + 1}`,
        email: seed.email.toLowerCase(),
        name: seed.name,
        role: seed.role,
        organizationId: seed.organizationId,
        createdAt: '2026-01-01T00:00:00.000Z',
        passwordHash,
      });
    }
  }

  private toEntity(record: UserRecord): UserEntity {
    const { passwordHash: _passwordHash, ...entity } = record;
    return entity;
  }

  async findByEmail(email: string): Promise<UserRecord | undefined> {
    return this.users.find((user) => user.email === email.toLowerCase());
  }

  async validateCredentials(
    email: string,
    password: string,
  ): Promise<UserEntity | null> {
    const record = await this.findByEmail(email);
    if (!record) return null;
    const valid = await bcrypt.compare(password, record.passwordHash);
    return valid ? this.toEntity(record) : null;
  }

  async findById(id: string): Promise<UserEntity> {
    const record = this.users.find((user) => user.id === id);
    if (!record) {
      throw new NotFoundException(`User ${id} not found`);
    }
    return this.toEntity(record);
  }

  async create(dto: CreateUserDto): Promise<UserEntity> {
    const existing = await this.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('A user with that email already exists');
    }
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const record: UserRecord = {
      id: `usr_${this.users.length + 1}`,
      email: dto.email.toLowerCase(),
      name: dto.name,
      role: dto.role,
      organizationId: dto.organizationId,
      createdAt: new Date().toISOString(),
      passwordHash,
    };
    this.users.push(record);
    return this.toEntity(record);
  }

  async findAll(
    query: PaginationQueryDto,
    organizationId: string,
  ): Promise<PaginatedResult<UserEntity>> {
    const term = query.search?.toLowerCase();
    const filtered = this.users
      .filter((user) => user.organizationId === organizationId)
      .filter(
        (user) =>
          !term ||
          user.name.toLowerCase().includes(term) ||
          user.email.includes(term),
      );

    const start = (query.page - 1) * query.limit;
    const pageItems = filtered
      .slice(start, start + query.limit)
      .map((record) => this.toEntity(record));

    return paginate(pageItems, filtered.length, query.page, query.limit);
  }
}
