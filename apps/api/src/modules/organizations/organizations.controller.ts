import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { OrganizationsService } from './organizations.service';

@ApiTags('Organizations')
@ApiBearerAuth()
@Controller({ path: 'organization', version: '1' })
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get()
  @ApiOperation({ summary: "Get the current user's organization" })
  find(@CurrentUser() user: AuthenticatedUser) {
    return this.organizationsService.findCurrent(user.organizationId);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get organization-wide counts' })
  stats(@CurrentUser() user: AuthenticatedUser) {
    return this.organizationsService.stats(user.organizationId);
  }

  @Patch()
  @Roles(Role.ORG_ADMIN)
  @ApiOperation({ summary: 'Update the current organization profile' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateOrganizationDto,
  ) {
    return this.organizationsService.updateCurrent(
      user.organizationId,
      user.id,
      dto,
    );
  }
}
