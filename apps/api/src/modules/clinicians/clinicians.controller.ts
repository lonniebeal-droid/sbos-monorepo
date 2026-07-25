import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { CliniciansService } from './clinicians.service';

@ApiTags('Clinicians')
@ApiBearerAuth()
@Controller({ path: 'clinicians', version: '1' })
export class CliniciansController {
  constructor(private readonly cliniciansService: CliniciansService) {}

  @Get()
  @ApiOperation({ summary: 'List clinicians in the organization' })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.cliniciansService.list(user.organizationId);
  }
}
