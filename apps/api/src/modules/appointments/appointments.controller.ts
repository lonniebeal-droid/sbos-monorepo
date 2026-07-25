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
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { QueryAppointmentsDto } from './dto/query-appointments.dto';
import { AppointmentsService } from './appointments.service';

@ApiTags('Appointments')
@ApiBearerAuth()
@Controller({ path: 'appointments', version: '1' })
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Get()
  @ApiOperation({ summary: 'List appointments (filter by clinician/client/date range)' })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryAppointmentsDto,
  ) {
    return this.appointmentsService.findAll(user.organizationId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an appointment by id' })
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.appointmentsService.findOne(user.organizationId, id);
  }

  @Post()
  @Roles(Role.FRONT_DESK)
  @ApiOperation({ summary: 'Schedule an appointment (checks for conflicts)' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAppointmentDto,
  ) {
    return this.appointmentsService.create(user.organizationId, dto);
  }

  @Patch(':id')
  @Roles(Role.FRONT_DESK)
  @ApiOperation({ summary: 'Update or reschedule an appointment' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateAppointmentDto,
  ) {
    return this.appointmentsService.update(user.organizationId, id, dto);
  }

  @Delete(':id')
  @Roles(Role.ORG_ADMIN)
  @ApiOperation({ summary: 'Delete an appointment' })
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.appointmentsService.remove(user.organizationId, id);
  }
}
