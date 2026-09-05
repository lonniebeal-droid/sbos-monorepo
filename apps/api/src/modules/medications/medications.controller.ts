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
import { CreateMedicationDto } from './dto/create-medication.dto';
import { UpdateMedicationDto } from './dto/update-medication.dto';
import { MedicationsService } from './medications.service';

@ApiTags('Medications')
@ApiBearerAuth()
@Controller({ path: 'medications', version: '1' })
export class MedicationsController {
  constructor(private readonly medicationsService: MedicationsService) {}

  @Get()
  @ApiOperation({ summary: 'List medications for a client (?clientId=)' })
  findForClient(
    @CurrentUser() user: AuthenticatedUser,
    @Query('clientId') clientId: string,
  ) {
    return this.medicationsService.findForClient(user.organizationId, clientId);
  }

  @Post()
  @Roles(Role.CLINICIAN)
  @ApiOperation({ summary: 'Add a medication' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateMedicationDto,
  ) {
    return this.medicationsService.create(user.organizationId, dto);
  }

  @Patch(':id')
  @Roles(Role.CLINICIAN)
  @ApiOperation({ summary: 'Update a medication' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateMedicationDto,
  ) {
    return this.medicationsService.update(user.organizationId, user.id, id, dto);
  }

  @Delete(':id')
  @Roles(Role.CLINICIAN)
  @ApiOperation({ summary: 'Delete a medication' })
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.medicationsService.remove(user.organizationId, user.id, id);
  }
}
