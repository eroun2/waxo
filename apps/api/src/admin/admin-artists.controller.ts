import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AdminArtistsService } from './admin-artists.service';
import { AdminArtistListQuery, ArtistFlagsDto, ReasonDto } from './dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { CurrentUser, RequirePermissions, Roles } from '../common/decorators';
import { AuthUser } from '../common/auth.types';

@Controller('admin/artists')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles('admin', 'moderator')
export class AdminArtistsController {
  constructor(private svc: AdminArtistsService) {}

  @Get() @RequirePermissions('artists.review')
  list(@Query() q: AdminArtistListQuery) { return this.svc.list(q); }

  @Get(':id') @RequirePermissions('artists.review')
  get(@Param('id', ParseUUIDPipe) id: string) { return this.svc.get(id); }

  @Post(':id/approve') @HttpCode(200) @RequirePermissions('artists.review')
  approve(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: AuthUser, @Req() r: Request) {
    return this.svc.approve(id, u.id, r.ip);
  }

  @Post(':id/reject') @HttpCode(200) @RequirePermissions('artists.review')
  reject(@Param('id', ParseUUIDPipe) id: string, @Body() b: ReasonDto, @CurrentUser() u: AuthUser, @Req() r: Request) {
    return this.svc.reject(id, u.id, b.reason, r.ip);
  }

  @Post(':id/suspend') @HttpCode(200) @RequirePermissions('artists.suspend')
  suspend(@Param('id', ParseUUIDPipe) id: string, @Body() b: ReasonDto, @CurrentUser() u: AuthUser, @Req() r: Request) {
    return this.svc.suspend(id, u.id, b.reason, r.ip);
  }

  @Post(':id/reinstate') @HttpCode(200) @RequirePermissions('artists.suspend')
  reinstate(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: AuthUser, @Req() r: Request) {
    return this.svc.reinstate(id, u.id, r.ip);
  }

  @Patch(':id/flags') @RequirePermissions('artists.feature')
  flags(@Param('id', ParseUUIDPipe) id: string, @Body() b: ArtistFlagsDto, @CurrentUser() u: AuthUser, @Req() r: Request) {
    return this.svc.setFlags(id, u.id, b, r.ip);
  }
}
