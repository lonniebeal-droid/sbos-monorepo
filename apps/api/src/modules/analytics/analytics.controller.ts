import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { AnalyticsService } from './analytics.service';

@ApiTags('Analytics')
@ApiBearerAuth()
@Controller({ path: 'analytics', version: '1' })
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('overview')
  @Roles(Role.SUPERVISOR)
  @ApiOperation({ summary: 'Practice-wide KPI overview' })
  overview(@CurrentUser() user: AuthenticatedUser) {
    return this.analytics.overview(user.organizationId);
  }

  @Get('appointments-by-status')
  @Roles(Role.SUPERVISOR)
  @ApiOperation({ summary: 'Appointment counts grouped by status' })
  appointmentsByStatus(@CurrentUser() user: AuthenticatedUser) {
    return this.analytics.appointmentsByStatus(user.organizationId);
  }

  @Get('claims-by-status')
  @Roles(Role.BILLING)
  @ApiOperation({ summary: 'Claim counts and billed totals by status' })
  claimsByStatus(@CurrentUser() user: AuthenticatedUser) {
    return this.analytics.claimsByStatus(user.organizationId);
  }
}
