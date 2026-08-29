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
import { CreateRecurringDto } from './dto/create-recurring.dto';
import { CancelAppointmentDto } from './dto/cancel-appointment.dto';
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
    return this.appointmentsService.create(user.organizationId, user.id, dto);
  }

  @Post('recurring')
  @Roles(Role.FRONT_DESK)
  @ApiOperation({ summary: 'Create a recurring appointment series (skips conflicts)' })
  createRecurring(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateRecurringDto,
  ) {
    return this.appointmentsService.createRecurring(user.organizationId, dto);
  }

  @Post(':id/telehealth')
  @Roles(Role.CLINICIAN)
  @ApiOperation({ summary: 'Provision or fetch the telehealth session URL' })
  telehealth(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.appointmentsService.startTelehealth(user.organizationId, id);
  }

  @Post(':id/check-in')
  @Roles(Role.FRONT_DESK)
  @ApiOperation({ summary: 'Check a client in for their appointment' })
  checkIn(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.appointmentsService.checkIn(user.organizationId, user.id, id);
  }

  @Post(':id/check-out')
  @Roles(Role.FRONT_DESK)
  @ApiOperation({ summary: 'Check a client out and complete the appointment' })
  checkOut(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.appointmentsService.checkOut(user.organizationId, user.id, id);
  }

  @Post(':id/cancel')
  @Roles(Role.FRONT_DESK)
  @ApiOperation({ summary: 'Cancel an appointment' })
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CancelAppointmentDto,
  ) {
    return this.appointmentsService.cancel(user.organizationId, user.id, id, dto.reason);
  }

  @Patch(':id')
  @Roles(Role.FRONT_DESK)
  @ApiOperation({ summary: 'Update or reschedule an appointment' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateAppointmentDto,
  ) {
    return this.appointmentsService.update(user.organizationId, user.id, id, dto);
  }

  @Delete(':id')
  @Roles(Role.ORG_ADMIN)
  @ApiOperation({ summary: 'Delete an appointment' })
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.appointmentsService.remove(user.organizationId, user.id, id);
  }
}
