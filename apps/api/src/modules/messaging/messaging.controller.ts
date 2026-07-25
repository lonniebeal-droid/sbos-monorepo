import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { CreateThreadDto, PostMessageDto } from './dto/messaging.dto';
import { MessagingService } from './messaging.service';

@ApiTags('Messaging')
@ApiBearerAuth()
@Controller({ path: 'messaging/threads', version: '1' })
export class MessagingController {
  constructor(private readonly messaging: MessagingService) {}

  @Get()
  @ApiOperation({ summary: 'List threads the current user participates in' })
  listThreads(@CurrentUser() user: AuthenticatedUser) {
    return this.messaging.listThreads(user.organizationId, user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Start a thread with participants' })
  createThread(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateThreadDto,
  ) {
    return this.messaging.createThread(user.organizationId, user.id, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a thread with its messages (marks read)' })
  getThread(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.messaging.getThread(user.organizationId, id, user.id);
  }

  @Post(':id/messages')
  @ApiOperation({ summary: 'Post a message to a thread' })
  postMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: PostMessageDto,
  ) {
    return this.messaging.postMessage(user.organizationId, id, user.id, dto);
  }
}
