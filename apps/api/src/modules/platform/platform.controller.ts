import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { UpsertFeatureFlagDto } from './dto/feature-flag.dto';
import { FeatureFlagsService } from './feature-flags.service';
import { SystemHealthService } from './system-health.service';

@ApiTags('Platform Admin')
@ApiBearerAuth()
@Controller({ path: 'platform', version: '1' })
export class PlatformController {
  constructor(
    private readonly flags: FeatureFlagsService,
    private readonly health: SystemHealthService,
  ) {}

  @Get('feature-flags')
  @ApiOperation({ summary: 'List feature flags for the organization' })
  listFlags(@CurrentUser() user: AuthenticatedUser) {
    return this.flags.list(user.organizationId);
  }

  @Post('feature-flags')
  @Roles(Role.ORG_ADMIN)
  @ApiOperation({ summary: 'Create or update a feature flag' })
  upsertFlag(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpsertFeatureFlagDto,
  ) {
    return this.flags.upsert(user.organizationId, dto);
  }

  @Get('system-health')
  @Roles(Role.ORG_ADMIN)
  @ApiOperation({ summary: 'System-health dashboard (DB, counts, uptime)' })
  systemHealth(@CurrentUser() user: AuthenticatedUser) {
    return this.health.snapshot(user.organizationId);
  }
}
