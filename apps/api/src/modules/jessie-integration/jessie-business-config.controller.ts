import { BadRequestException, Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuditAction, type Prisma } from '@sbos/database';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { applyJessieProfile } from './jessie-business-profile';
import type { LookupClientResponseDto } from './dto/lookup-client.dto';

const allowed = new Set(['greeting', 'businessType', 'businessHours', 'services', 'faq', 'transferRules', 'transferNumbers', 'afterHoursBehavior', 'restrictedTopics', 'approvedClaims', 'customInstructions']);
const defaults = {
  clientId: '', businessName: '', greeting: '', businessType: 'service_business',
  businessHours: {}, services: [], faq: [], transferRules: {}, transferNumbers: [],
  afterHoursBehavior: 'callback', restrictedTopics: [], approvedClaims: [],
  customInstructions: '', bookingEnabled: false, bookingRules: {},
} as unknown as LookupClientResponseDto;

export function sanitizeJessieAdminProfile(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new BadRequestException('Profile must be a JSON object');
  }
  const raw = input as Record<string, unknown>;
  if (JSON.stringify(raw).length > 16000) throw new BadRequestException('Profile too large');
  if (Object.keys(raw).some(k => !allowed.has(k))) {
    throw new BadRequestException('Profile contains unsupported fields');
  }
  const normalized = applyJessieProfile(defaults, raw);
  return Object.fromEntries([...allowed].filter(k => Object.prototype.hasOwnProperty.call(raw, k))
    .map(k => [k, normalized[k as keyof LookupClientResponseDto]]));
}

@ApiTags('Jessie Business Configuration')
@ApiBearerAuth()
@Controller({ path: 'jessie/business-profile', version: '1' })
export class JessieBusinessConfigController {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  @Get()
  @Roles(Role.ORG_ADMIN)
  async get(@CurrentUser() user: AuthenticatedUser) {
    return (await this.prisma.jessieBusinessConfig.findUnique({
      where: { organizationId: user.organizationId },
      select: { profile: true, isActive: true, updatedAt: true },
    })) ?? { profile: {}, isActive: false, updatedAt: null };
  }

  @Patch()
  @Roles(Role.ORG_ADMIN)
  async update(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new BadRequestException('Expected JSON object');
    }
    const dto = body as Record<string, unknown>;
    if (Object.keys(dto).some(k => !['profile', 'isActive'].includes(k)) ||
        typeof dto.isActive !== 'boolean' || !('profile' in dto)) {
      throw new BadRequestException('Provide profile and isActive');
    }
    const profile = sanitizeJessieAdminProfile(dto.profile);
    const previous = await this.prisma.jessieBusinessConfig.findUnique({
      where: { organizationId: user.organizationId },
      select: { isActive: true },
    });
    const updated = await this.prisma.jessieBusinessConfig.upsert({
      where: { organizationId: user.organizationId },
      create: { organizationId: user.organizationId, profile: profile as Prisma.InputJsonValue, isActive: dto.isActive },
      update: { profile: profile as Prisma.InputJsonValue, isActive: dto.isActive },
      select: { profile: true, isActive: true, updatedAt: true },
    });
    await this.audit.record({
      organizationId: user.organizationId, actorId: user.id,
      action: AuditAction.UPDATE, entityType: 'JessieBusinessConfig',
      entityId: user.organizationId,
      metadata: { fields: Object.keys(profile), wasActive: previous?.isActive ?? false, isActive: updated.isActive },
    });
    return updated;
  }
}
