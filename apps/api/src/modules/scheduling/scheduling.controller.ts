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
import { WaitlistStatus } from '@sbos/database';
import {
  CreateAvailabilityDto,
  CreateTimeOffDto,
} from './dto/availability.dto';
import { CreateWaitlistDto, UpdateWaitlistDto } from './dto/waitlist.dto';
import { AvailabilityService } from './availability.service';
import { WaitlistService } from './waitlist.service';

@ApiTags('Scheduling')
@ApiBearerAuth()
@Controller({ path: 'scheduling', version: '1' })
export class SchedulingController {
  constructor(
    private readonly availability: AvailabilityService,
    private readonly waitlist: WaitlistService,
  ) {}

  // ----- Availability -----

  @Get('availability')
  @ApiOperation({ summary: 'List a clinician weekly availability (?clinicianId=)' })
  listAvailability(
    @CurrentUser() user: AuthenticatedUser,
    @Query('clinicianId') clinicianId: string,
  ) {
    return this.availability.listAvailability(user.organizationId, clinicianId);
  }

  @Post('availability')
  @Roles(Role.ORG_ADMIN)
  @ApiOperation({ summary: 'Add a weekly availability window' })
  createAvailability(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAvailabilityDto,
  ) {
    return this.availability.createAvailability(user.organizationId, dto);
  }

  @Delete('availability/:id')
  @Roles(Role.ORG_ADMIN)
  @ApiOperation({ summary: 'Remove an availability window' })
  removeAvailability(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.availability.removeAvailability(user.organizationId, user.id, id);
  }

  @Post('time-off')
  @Roles(Role.ORG_ADMIN)
  @ApiOperation({ summary: 'Add a clinician time-off block' })
  createTimeOff(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTimeOffDto,
  ) {
    return this.availability.createTimeOff(user.organizationId, dto);
  }

  @Get('slots')
  @ApiOperation({
    summary: 'Compute open slots for a clinician on a date',
  })
  getSlots(
    @CurrentUser() user: AuthenticatedUser,
    @Query('clinicianId') clinicianId: string,
    @Query('date') date: string,
    @Query('duration') duration = '50',
  ) {
    const slotMinutes = Number.parseInt(duration, 10) || 50;
    return this.availability.getSlots(
      user.organizationId,
      clinicianId,
      date,
      slotMinutes,
    );
  }

  // ----- Waitlist -----

  @Get('waitlist')
  @ApiOperation({ summary: 'List waitlist entries (?status=)' })
  listWaitlist(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: WaitlistStatus,
  ) {
    return this.waitlist.findAll(user.organizationId, status);
  }

  @Post('waitlist')
  @Roles(Role.FRONT_DESK)
  @ApiOperation({ summary: 'Add a client to the waitlist' })
  createWaitlist(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateWaitlistDto,
  ) {
    return this.waitlist.create(user.organizationId, user.id, dto);
  }

  @Patch('waitlist/:id')
  @Roles(Role.FRONT_DESK)
  @ApiOperation({ summary: 'Update a waitlist entry status' })
  updateWaitlist(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateWaitlistDto,
  ) {
    return this.waitlist.updateStatus(user.organizationId, user.id, id, dto);
  }

  @Delete('waitlist/:id')
  @Roles(Role.FRONT_DESK)
  @ApiOperation({ summary: 'Remove a waitlist entry' })
  removeWaitlist(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.waitlist.remove(user.organizationId, user.id, id);
  }
}
