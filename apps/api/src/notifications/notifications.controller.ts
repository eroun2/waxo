import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators';
import { AuthUser } from '../common/auth.types';
import { PageQuery } from '../common/pagination.dto';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private n: NotificationsService) {}

  @Get() list(@CurrentUser() u: AuthUser, @Query() q: PageQuery) { return this.n.list(u.id, q); }

  @Post('read-all') @HttpCode(204)
  readAll(@CurrentUser() u: AuthUser) { return this.n.markAllRead(u.id); }

  @Post(':id/read') @HttpCode(204)
  read(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) { return this.n.markRead(u.id, id); }
}
