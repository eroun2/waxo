import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AdminDashboardService } from './admin-dashboard.service';
import { AdminUsersService } from './admin-users.service';
import { AdminReferenceService } from './admin-reference.service';
import { AdminReportsService } from './admin-reports.service';
import {
  AuditQuery, CreateAdminDto, DistrictDto, GenreDto, NoteDto, ReasonDto, ReportListQuery, RequiredNoteDto, UpdateDistrictDto, UpdateGenreDto, UserListQuery,
} from './dto';
import { AnalyticsQuery } from '../artists/dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { CurrentUser, RequirePermissions, Roles } from '../common/decorators';
import { AuthUser } from '../common/auth.types';

/** Admin portal endpoints beyond artist and song moderation. Permissions come from admin_roles; the super admin has '*'. */
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles('admin', 'moderator')
export class AdminMoreController {
  constructor(
    private dash: AdminDashboardService, private users: AdminUsersService, private ref: AdminReferenceService, private reports: AdminReportsService,
  ) {}

  @Get('dashboard') dashboard() { return this.dash.dashboard(); }
  @Get('analytics') @RequirePermissions('analytics.view') analytics(@Query() q: AnalyticsQuery) { return this.dash.analytics(q.range); }

  // ----- listeners -----
  @Get('listeners') @RequirePermissions('users.manage') listeners(@Query() q: UserListQuery) { return this.users.listListeners(q); }
  @Post('listeners/:id/suspend') @HttpCode(200) @RequirePermissions('users.manage')
  suspendListener(@Param('id', ParseUUIDPipe) id: string, @Body() b: ReasonDto, @CurrentUser() u: AuthUser, @Req() r: Request) { return this.users.setListenerStatus(id, u.id, true, b.reason, r.ip); }
  @Post('listeners/:id/reinstate') @HttpCode(200) @RequirePermissions('users.manage')
  reinstateListener(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: AuthUser, @Req() r: Request) { return this.users.setListenerStatus(id, u.id, false, undefined, r.ip); }

  // ----- staff accounts -----
  @Get('roles') @RequirePermissions('admins.manage') roles() { return this.users.roles(); }
  @Get('accounts') @RequirePermissions('admins.manage') accounts() { return this.users.listStaff(); }
  @Post('accounts') @RequirePermissions('admins.manage')
  createAccount(@Body() dto: CreateAdminDto, @CurrentUser() u: AuthUser, @Req() r: Request) { return this.users.createStaff(dto, u.id, r.ip); }
  @Post('accounts/:id/suspend') @HttpCode(200) @RequirePermissions('admins.manage')
  suspendStaff(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: AuthUser, @Req() r: Request) { return this.users.setStaffStatus(id, u.id, true, r.ip); }
  @Post('accounts/:id/reinstate') @HttpCode(200) @RequirePermissions('admins.manage')
  reinstateStaff(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: AuthUser, @Req() r: Request) { return this.users.setStaffStatus(id, u.id, false, r.ip); }

  // ----- audit log -----
  @Get('audit') @RequirePermissions('audit.view') audit(@Query() q: AuditQuery) { return this.users.auditLog(q); }

  // ----- districts & genres -----
  @Get('districts') @RequirePermissions('districts.manage') districts() { return this.ref.districts(); }
  @Post('districts') @RequirePermissions('districts.manage')
  addDistrict(@Body() dto: DistrictDto, @CurrentUser() u: AuthUser, @Req() r: Request) { return this.ref.createDistrict(dto, u.id, r.ip); }
  @Patch('districts/:id') @RequirePermissions('districts.manage')
  editDistrict(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateDistrictDto, @CurrentUser() u: AuthUser, @Req() r: Request) { return this.ref.updateDistrict(id, dto, u.id, r.ip); }

  @Get('genres') @RequirePermissions('genres.manage') genres() { return this.ref.genres(); }
  @Post('genres') @RequirePermissions('genres.manage')
  addGenre(@Body() dto: GenreDto, @CurrentUser() u: AuthUser, @Req() r: Request) { return this.ref.createGenre(dto, u.id, r.ip); }
  @Patch('genres/:id') @RequirePermissions('genres.manage')
  editGenre(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateGenreDto, @CurrentUser() u: AuthUser, @Req() r: Request) { return this.ref.updateGenre(id, dto, u.id, r.ip); }

  // ----- reported content -----
  @Get('reports/music') @RequirePermissions('reports.handle') musicReports(@Query() q: ReportListQuery) { return this.reports.listMusic(q); }
  @Post('reports/music/:id/resolve') @HttpCode(200) @RequirePermissions('reports.handle')
  resolveMusic(@Param('id', ParseUUIDPipe) id: string, @Body() b: NoteDto, @CurrentUser() u: AuthUser, @Req() r: Request) { return this.reports.resolveMusic(id, u.id, b.note, r.ip); }
  @Post('reports/music/:id/dismiss') @HttpCode(200) @RequirePermissions('reports.handle')
  dismissMusic(@Param('id', ParseUUIDPipe) id: string, @Body() b: NoteDto, @CurrentUser() u: AuthUser, @Req() r: Request) { return this.reports.dismissMusic(id, u.id, b.note, r.ip); }
  @Post('reports/music/:id/remove-song') @HttpCode(200) @RequirePermissions('reports.handle', 'content.remove')
  removeSong(@Param('id', ParseUUIDPipe) id: string, @Body() b: NoteDto, @CurrentUser() u: AuthUser, @Req() r: Request) { return this.reports.removeSongForReport(id, u.id, b.note, r.ip); }

  // ----- copyright complaints -----
  @Get('copyright') @RequirePermissions('reports.handle') copyright(@Query() q: ReportListQuery) { return this.reports.listCopyright(q); }
  @Get('copyright/:id') @RequirePermissions('reports.handle') copyrightOne(@Param('id', ParseUUIDPipe) id: string) { return this.reports.getCopyright(id); }
  @Post('copyright/:id/investigate') @HttpCode(200) @RequirePermissions('reports.handle')
  investigate(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: AuthUser, @Req() r: Request) { return this.reports.investigate(id, u.id, r.ip); }
  @Post('copyright/:id/uphold') @HttpCode(200) @RequirePermissions('reports.handle', 'content.remove')
  uphold(@Param('id', ParseUUIDPipe) id: string, @Body() b: RequiredNoteDto, @CurrentUser() u: AuthUser, @Req() r: Request) { return this.reports.uphold(id, u.id, b.note, r.ip); }
  @Post('copyright/:id/dismiss') @HttpCode(200) @RequirePermissions('reports.handle')
  dismissCopyright(@Param('id', ParseUUIDPipe) id: string, @Body() b: RequiredNoteDto, @CurrentUser() u: AuthUser, @Req() r: Request) { return this.reports.dismissCopyright(id, u.id, b.note, r.ip); }
}
