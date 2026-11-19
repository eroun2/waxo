import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { DiscoveryService } from './discovery.service';
import { ArtistDirQuery, DiscoverQuery, SearchQuery } from './dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt.guard';
import { CurrentUser } from '../common/decorators';
import { AuthUser } from '../common/auth.types';
import { PageQuery } from '../common/pagination.dto';

@Controller()
export class DiscoveryController {
  constructor(private d: DiscoveryService) {}

  // Everything below is public: no account needed to browse.
  @Get('discover/home') home() { return this.d.home(); }
  @Get('discover/trending') trending(@Query() q: DiscoverQuery) { return this.d.trending(q); }
  @Get('discover/new-releases') newReleases(@Query() q: DiscoverQuery) { return this.d.newReleases(q); }
  @Get('discover/recently-added') recentlyAdded(@Query() q: DiscoverQuery) { return this.d.recentlyAdded(q); }
  @Get('discover/most-streamed') mostStreamed(@Query() q: DiscoverQuery) { return this.d.mostStreamed(q); }
  @Get('discover/most-downloaded') mostDownloaded(@Query() q: DiscoverQuery) { return this.d.mostDownloaded(q); }
  @Get('discover/featured-songs') featuredSongs(@Query() q: DiscoverQuery) { return this.d.featuredSongs(q); }
  @Get('discover/rising-stars') rising(@Query() q: DiscoverQuery) { return this.d.risingStars(q); }
  @Get('discover/featured-artists') featuredArtists(@Query() q: DiscoverQuery) { return this.d.featuredArtists(q); }
  @Get('discover/artists') artists(@Query() q: ArtistDirQuery) { return this.d.artistDirectory(q); }
  @Get('artists/:slug/songs') artistSongs(@Param('slug') slug: string, @Query() q: DiscoverQuery) { return this.d.artistSongs(slug, q); }
  @Get('discover/genres') genres() { return this.d.genreList(); }
  @Get('discover/districts') districts() { return this.d.districtList(); }
  @Get('discover/leaderboard/:district') board(@Param('district') slug: string, @Query() q: DiscoverQuery) { return this.d.leaderboard(slug, q); }

  // Personalised when logged in, sensible defaults when not.
  @UseGuards(OptionalJwtAuthGuard) @Get('discover/recommended')
  recommended(@Query() q: DiscoverQuery, @Req() req: Request & { user?: AuthUser }) { return this.d.recommended(q, req.user); }

  @UseGuards(OptionalJwtAuthGuard) @Get('discover/near-me')
  nearMe(@Query() q: DiscoverQuery, @Req() req: Request & { user?: AuthUser }) { return this.d.nearMe(q, req.user); }

  @UseGuards(JwtAuthGuard) @Get('discover/recently-played')
  recent(@CurrentUser() u: AuthUser, @Query() q: PageQuery) { return this.d.recentlyPlayed(u.id, q); }

  @Get('search') search(@Query() q: SearchQuery) { return this.d.search(q); }
}
