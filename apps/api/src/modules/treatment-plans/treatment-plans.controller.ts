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
import { CreateTreatmentPlanDto } from './dto/create-treatment-plan.dto';
import {
  UpdateGoalDto,
  UpdateTreatmentPlanDto,
} from './dto/update-treatment-plan.dto';
import { TreatmentPlansService } from './treatment-plans.service';

@ApiTags('Treatment Plans')
@ApiBearerAuth()
@Controller({ path: 'treatment-plans', version: '1' })
export class TreatmentPlansController {
  constructor(private readonly service: TreatmentPlansService) {}

  @Get()
  @ApiOperation({ summary: 'List treatment plans for a client (?clientId=)' })
  findForClient(
    @CurrentUser() user: AuthenticatedUser,
    @Query('clientId') clientId: string,
  ) {
    return this.service.findForClient(user.organizationId, clientId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a treatment plan with goals and objectives' })
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.findOne(user.organizationId, id);
  }

  @Post()
  @Roles(Role.CLINICIAN)
  @ApiOperation({ summary: 'Create a treatment plan (with goals/objectives)' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTreatmentPlanDto,
  ) {
    return this.service.create(user.organizationId, dto);
  }

  @Patch(':id')
  @Roles(Role.CLINICIAN)
  @ApiOperation({ summary: 'Update plan details or status' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateTreatmentPlanDto,
  ) {
    return this.service.update(user.organizationId, id, dto);
  }

  @Patch(':id/goals/:goalId')
  @Roles(Role.CLINICIAN)
  @ApiOperation({ summary: 'Update a goal status/progress' })
  updateGoal(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('goalId') goalId: string,
    @Body() dto: UpdateGoalDto,
  ) {
    return this.service.updateGoal(user.organizationId, id, goalId, dto);
  }

  @Delete(':id')
  @Roles(Role.SUPERVISOR)
  @ApiOperation({ summary: 'Delete a treatment plan' })
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.remove(user.organizationId, user.id, id);
  }
}
