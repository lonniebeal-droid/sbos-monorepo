import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { CreateUserDto } from './dto/create-user.dto';
import { UsersService } from './users.service';
import { InviteUserDto } from './dto/invite-user.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { AuthService } from '../auth/auth.service';

@ApiTags('Users')
@ApiBearerAuth()
@Controller({ path: 'users', version: '1' })
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // Admin-only invite: create a single-use invite token scoped to the org.
  @Post('invite')
  @Roles(Role.ORG_ADMIN)
  @ApiOperation({ summary: 'Invite a user to the organization' })
  async invite(
    @Body() dto: InviteUserDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    // Delegate to AuthService for token creation and persistence.
    return this.usersService.createInvite(dto.email, dto.role, user.id, user.organizationId);
  }

  @Get()
  @Roles(Role.ORG_ADMIN)
  @ApiOperation({ summary: 'List users in the current organization' })
  findAll(
    @Query() query: PaginationQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.usersService.findAll(query, user.organizationId);
  }

  @Get('me')
  @ApiOperation({ summary: 'Get the current authenticated user' })
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.findById(user.id);
  }

  @Get(':id')
  @Roles(Role.SUPERVISOR)
  @ApiOperation({ summary: 'Get a user by id' })
  findOne(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Post()
  @Roles(Role.ORG_ADMIN)
  @ApiOperation({ summary: 'Create a new user' })
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }
}
