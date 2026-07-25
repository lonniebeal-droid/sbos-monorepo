import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller({ path: 'notifications', version: '1' })
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'List the current user’s notifications (?unread=true)' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('unread') unread?: string,
  ) {
    return this.notifications.listForUser(
      user.organizationId,
      user.id,
      unread === 'true',
    );
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Count unread notifications' })
  unreadCount(@CurrentUser() user: AuthenticatedUser) {
    return this.notifications.unreadCount(user.organizationId, user.id);
  }

  @Post(':id/read')
  @ApiOperation({ summary: 'Mark a notification read' })
  markRead(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.notifications.markRead(user.organizationId, user.id, id);
  }

  @Post('read-all')
  @ApiOperation({ summary: 'Mark all notifications read' })
  markAllRead(@CurrentUser() user: AuthenticatedUser) {
    return this.notifications.markAllRead(user.organizationId, user.id);
  }
}
