import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ArtistsService } from './artists.service';
import { ArtistListQuery, UpdateArtistDto } from './dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentUser, Roles } from '../common/decorators';
import { AuthUser } from '../common/auth.types';

@Controller('artists')
export class ArtistsController {
  constructor(private artists: ArtistsService) {}

  // "me" routes are declared before ":slug" so they are matched first.
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles('artist') @Get('me')
  me(@CurrentUser() u: AuthUser) { return this.artists.getOwn(u.id); }

  @UseGuards(JwtAuthGuard, RolesGuard) @Roles('artist') @Patch('me')
  update(@CurrentUser() u: AuthUser, @Body() dto: UpdateArtistDto) { return this.artists.updateOwn(u.id, dto); }

  @UseGuards(JwtAuthGuard, RolesGuard) @Roles('artist') @Post('me/resubmit') @HttpCode(200)
  resubmit(@CurrentUser() u: AuthUser) { return this.artists.resubmit(u.id); }

  @Get() list(@Query() q: ArtistListQuery) { return this.artists.list(q); }

  @Get(':slug') one(@Param('slug') slug: string) { return this.artists.getPublic(slug); }
}
