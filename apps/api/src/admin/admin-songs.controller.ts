import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AdminSongsService } from './admin-songs.service';
import { AdminSongListQuery, FeatureDto, ReasonDto } from './dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { CurrentUser, RequirePermissions, Roles } from '../common/decorators';
import { AuthUser } from '../common/auth.types';

@Controller('admin/songs')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles('admin', 'moderator')
export class AdminSongsController {
  constructor(private svc: AdminSongsService) {}

  @Get() @RequirePermissions('music.review')
  list(@Query() q: AdminSongListQuery) { return this.svc.list(q); }

  @Get(':id') @RequirePermissions('music.review')
  get(@Param('id', ParseUUIDPipe) id: string) { return this.svc.get(id); }

  @Post(':id/approve') @HttpCode(200) @RequirePermissions('music.review')
  approve(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: AuthUser, @Req() r: Request) { return this.svc.approve(id, u.id, r.ip); }

  @Post(':id/reject') @HttpCode(200) @RequirePermissions('music.review')
  reject(@Param('id', ParseUUIDPipe) id: string, @Body() b: ReasonDto, @CurrentUser() u: AuthUser, @Req() r: Request) {
    return this.svc.reject(id, u.id, b.reason, r.ip);
  }

  @Post(':id/remove') @HttpCode(200) @RequirePermissions('content.remove')
  remove(@Param('id', ParseUUIDPipe) id: string, @Body() b: ReasonDto, @CurrentUser() u: AuthUser, @Req() r: Request) {
    return this.svc.remove(id, u.id, b.reason, r.ip);
  }

  @Patch(':id/feature') @RequirePermissions('music.feature')
  feature(@Param('id', ParseUUIDPipe) id: string, @Body() b: FeatureDto, @CurrentUser() u: AuthUser, @Req() r: Request) {
    return this.svc.setFeatured(id, u.id, b.featured, r.ip);
  }
}
