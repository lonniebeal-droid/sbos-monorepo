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
import { CreateAssessmentDto } from './dto/create-assessment.dto';
import { UpdateAssessmentDto } from './dto/update-assessment.dto';
import { AssessmentsService } from './assessments.service';

@ApiTags('Assessments')
@ApiBearerAuth()
@Controller({ path: 'assessments', version: '1' })
export class AssessmentsController {
  constructor(private readonly assessmentsService: AssessmentsService) {}

  @Get()
  @ApiOperation({ summary: 'List assessments for a client (?clientId=)' })
  findForClient(
    @CurrentUser() user: AuthenticatedUser,
    @Query('clientId') clientId: string,
  ) {
    return this.assessmentsService.findForClient(user.organizationId, clientId);
  }

  @Post()
  @Roles(Role.CLINICIAN)
  @ApiOperation({ summary: 'Record an assessment result' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAssessmentDto,
  ) {
    return this.assessmentsService.create(
      user.organizationId,
      user.id,
      dto,
    );
  }

  @Patch(':id')
  @Roles(Role.CLINICIAN)
  @ApiOperation({ summary: 'Update an assessment' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateAssessmentDto,
  ) {
    return this.assessmentsService.update(user.organizationId, id, dto);
  }

  @Delete(':id')
  @Roles(Role.CLINICIAN)
  @ApiOperation({ summary: 'Delete an assessment' })
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.assessmentsService.remove(user.organizationId, user.id, id);
  }
}
