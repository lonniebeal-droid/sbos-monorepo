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
import { CreateDiagnosisDto } from './dto/create-diagnosis.dto';
import { UpdateDiagnosisDto } from './dto/update-diagnosis.dto';
import { DiagnosesService } from './diagnoses.service';

@ApiTags('Diagnoses')
@ApiBearerAuth()
@Controller({ path: 'diagnoses', version: '1' })
export class DiagnosesController {
  constructor(private readonly diagnosesService: DiagnosesService) {}

  @Get()
  @ApiOperation({ summary: 'List diagnoses for a client (?clientId=)' })
  findForClient(
    @CurrentUser() user: AuthenticatedUser,
    @Query('clientId') clientId: string,
  ) {
    return this.diagnosesService.findForClient(user.organizationId, clientId);
  }

  @Post()
  @Roles(Role.CLINICIAN)
  @ApiOperation({ summary: 'Add a diagnosis' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateDiagnosisDto,
  ) {
    return this.diagnosesService.create(user.organizationId, dto);
  }

  @Patch(':id')
  @Roles(Role.CLINICIAN)
  @ApiOperation({ summary: 'Update a diagnosis' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateDiagnosisDto,
  ) {
    return this.diagnosesService.update(user.organizationId, user.id, id, dto);
  }

  @Delete(':id')
  @Roles(Role.CLINICIAN)
  @ApiOperation({ summary: 'Delete a diagnosis' })
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.diagnosesService.remove(user.organizationId, user.id, id);
  }
}
