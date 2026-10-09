import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { CreateAdmissionDto } from './dto/create-admission.dto';
import { UpdateAdmissionDto } from './dto/update-admission.dto';
import { AdmissionsService } from './admissions.service';

@ApiTags('Admissions')
@ApiBearerAuth()
@Controller({ path: 'admissions', version: '1' })
export class AdmissionsController {
  constructor(private readonly admissionsService: AdmissionsService) {}

  @Get()
  @ApiOperation({ summary: 'List admissions for a client (?clientId=)' })
  findForClient(
    @CurrentUser() user: AuthenticatedUser,
    @Query('clientId') clientId: string,
  ) {
    return this.admissionsService.findForClient(
      user.organizationId,
      clientId,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single admission' })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.admissionsService.findOne(user.organizationId, id);
  }

  @Post()
  @Roles(Role.CLINICIAN)
  @ApiOperation({ summary: 'Admit a client to a program' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAdmissionDto,
  ) {
    return this.admissionsService.create(
      user.organizationId,
      user.id,
      dto,
    );
  }

  @Patch(':id')
  @Roles(Role.CLINICIAN)
  @ApiOperation({ summary: 'Update or discharge an admission' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateAdmissionDto,
  ) {
    return this.admissionsService.update(
      user.organizationId,
      user.id,
      id,
      dto,
    );
  }

  @Delete(':id')
  @Roles(Role.CLINICIAN)
  @ApiOperation({ summary: 'Delete an admission record' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.admissionsService.remove(
      user.organizationId,
      user.id,
      id,
    );
  }
}
