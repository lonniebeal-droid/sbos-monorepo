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
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { ClientsService } from './clients.service';

@ApiTags('Clients')
@ApiBearerAuth()
@Controller({ path: 'clients', version: '1' })
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  @ApiOperation({ summary: 'List clients (paginated, searchable)' })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
  ) {
    return this.clientsService.findAll(user.organizationId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a client chart by id' })
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.clientsService.findOne(user.organizationId, id);
  }

  @Post()
  @Roles(Role.FRONT_DESK)
  @ApiOperation({ summary: 'Create a client' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateClientDto,
  ) {
    return this.clientsService.create(user.organizationId, user.id, dto);
  }

  @Patch(':id')
  @Roles(Role.CLINICIAN)
  @ApiOperation({ summary: 'Update a client' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateClientDto,
  ) {
    return this.clientsService.update(user.organizationId, user.id, id, dto);
  }

  @Delete(':id')
  @Roles(Role.ORG_ADMIN)
  @ApiOperation({ summary: 'Delete a client' })
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.clientsService.remove(user.organizationId, user.id, id);
  }
}
